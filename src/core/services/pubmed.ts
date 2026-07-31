import { CONFIG } from '../config'
import type { ResultadoConsulta} from "./crossref.ts";

export async function consultarPmid(pmid:string): Promise<ResultadoConsulta> {
    const url = `${CONFIG.pubmedBase}/esummary.fcgi?db=pubmed&
    id=${encodeURIComponent(pmid)}&retmode=json&
    email=${encodeURIComponent(CONFIG.mailto)}`

    try {
        const res = await fetch(url)

        if (!res.ok){
            return {
                status: 'nao_verificada'
            }
        }

        const json = await res.json()
        const registro = json?.result?.[pmid]

        if (registro.error){
            return {
                status: 'nao_encontrada'
            }
        }

        const titulo = registro.title
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined
        }
    } catch{
        return {
            status: 'nao_verificada'
        }
    }
}
