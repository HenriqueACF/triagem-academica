import { CONFIG } from '../config.ts'
import type { ResultadoConsulta } from './crossref.ts'
export async function consultarPmidEuropePmc(pmid: string): Promise<ResultadoConsulta> {
    const consulta = `EXT_ID:${pmid} AND SRC:MED`
    const url = `${CONFIG.europepmcBase}/search?query=${encodeURIComponent(consulta)}&format=json&pageSize=1`

    try {
        const res = await fetch(url)

        if (!res.ok) {
            return { status: 'nao_verificada' }
        }

        const json = await res.json()
        const total = Number(json?.hitCount)

        if (!Number.isFinite(total)) {
            return { status: 'nao_verificada' }
        }

        if (total === 0) {
            return { status: 'nao_encontrada' }
        }

        const titulo = json?.resultList?.result?.[0]?.title
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined,
        }
    } catch {
        return { status: 'nao_verificada' }
    }
}
