import { CONFIG } from '../config.ts'
import type { ResultadoConsulta } from './crossref.ts'
export async function consultarDoiOpenAlex(doi: string): Promise<ResultadoConsulta> {
    const url = `${CONFIG.openalexBase}/works/doi:${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CONFIG.mailto)}`

    try {
        const res = await fetch(url)

        if (res.status === 404) {
            return { status: 'nao_encontrada' }
        }

        if (!res.ok) {
            return { status: 'nao_verificada' }
        }

        const json = await res.json()
        const titulo = json?.title ?? json?.display_name
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined,
        }
    } catch {
        return { status: 'nao_verificada' }
    }
}
