import { CONFIG } from '../config'
import type { ResultadoConsulta} from "./crossref.ts";

export async function consultarPmid(pmid:string): Promise<ResultadoConsulta> {
    const url = `${CONFIG.pubmedBase}/esummary.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=json&email=${encodeURIComponent(CONFIG.mailto)}`
    try {
        const res = await fetch(url)

        if (!res.ok){
            return {
                status: 'nao_verificada'
            }
        }

        const json = await res.json()
        const registro = json?.result?.[pmid]

        if (!registro) {
            return {
                status: 'nao_verificada'
            }
        }

        if (registro.error){
            return {
                status: 'nao_encontrada'
            }
        }

        const titulo = registro.title
        const anoMatch = typeof registro.pubdate === 'string' ? registro.pubdate.match(/\d{4}/) : null
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined,
            ano: anoMatch ? Number(anoMatch[0]) : undefined,
        }
    } catch{
        return {
            status: 'nao_verificada'
        }
    }
}
