import { CONFIG } from '../config.ts'
import type { ResultadoConsulta } from './crossref.ts'
export async function consultarDoiDataCite(doi: string): Promise<ResultadoConsulta> {
    const url = `${CONFIG.dataciteBase}/dois/${encodeURIComponent(doi)}`

    try {
        const res = await fetch(url)

        if (res.status === 404) {
            return { status: 'nao_encontrada' }
        }

        if (!res.ok) {
            return { status: 'nao_verificada' }
        }

        const json = await res.json()
        const titulo = json?.data?.attributes?.titles?.[0]?.title
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined,
        }
    } catch {
        return { status: 'nao_verificada' }
    }
}
