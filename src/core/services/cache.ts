import type { ResultadoConsulta } from './crossref.ts'
import { consultarDoi } from './crossref.ts'
import { consultarPmid } from './pubmed.ts'
import { consultarDoiDataCite } from './datacite.ts'
const cache = new Map<string, ResultadoConsulta>()

export async function verificarIdentificador(
    tipo: 'doi' | 'pmid',
    id: string,
): Promise<ResultadoConsulta> {
    const chave = `${tipo}:${id.toLowerCase()}`

    const guardado = cache.get(chave)
    if (guardado) return guardado

    // const resultado = tipo === 'doi' ? await consultarDoi(id) : await consultarPmid(id)
    let resultado = tipo === 'doi' ? await consultarDoi(id) : await consultarPmid(id)

    if (tipo === 'doi' && resultado.status === 'nao_encontrada') {
        resultado = await consultarDoiDataCite(id)
    }

    if (resultado.status !== 'nao_verificada') {
        cache.set(chave, resultado)
    }

    return resultado
}

export function limparCache(): void {
    cache.clear()
}

export function tamanhoCache(): number {
    return cache.size
}
