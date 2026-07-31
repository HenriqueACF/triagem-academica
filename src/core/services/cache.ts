import type { ResultadoConsulta } from './crossref.ts'
import { consultarDoi } from './crossref.ts'
import { consultarPmid } from './pubmed.ts'
import { consultarDoiDataCite } from './datacite.ts'
import { consultarDoiOpenAlex } from './openalex.ts'
import { consultarPmidEuropePmc } from './europepmc.ts'

const cache = new Map<string, ResultadoConsulta>()

async function encadear(
    consultas: Array<() => Promise<ResultadoConsulta>>,
): Promise<ResultadoConsulta> {
    let houveFalha = false

    for (const consultar of consultas) {
        const resultado = await consultar()
        if (resultado.status === 'valida') return resultado
        if (resultado.status === 'nao_verificada') houveFalha = true
    }

    return { status: houveFalha ? 'nao_verificada' : 'nao_encontrada' }
}

export async function verificarIdentificador(
    tipo: 'doi' | 'pmid',
    id: string,
): Promise<ResultadoConsulta> {
    const chave = `${tipo}:${id.toLowerCase()}`

    const guardado = cache.get(chave)
    if (guardado) return guardado

    const resultado = tipo === 'doi'
        ? await encadear([
            () => consultarDoi(id),
            () => consultarDoiDataCite(id),
            () => consultarDoiOpenAlex(id),
        ])
        : await encadear([
            () => consultarPmid(id),
            () => consultarPmidEuropePmc(id),
        ])

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
