import type { Documento, Flag, Referencia } from '../models.ts'
import { verificarIdentificador } from '../services/cache.ts'

export interface IdentificadorEncontrado {
    tipo: 'doi' | 'pmid'
    valor: string
    ocorrencias: number
}

export function extrairIdentificadores(texto: string): IdentificadorEncontrado[] {
    const contagem = new Map<string, number>()

    function registrar(tipo: 'doi' | 'pmid', valor: string): void {
        const chave = `${tipo}|${valor}`
        contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    }


    for (const m of texto.matchAll(/\b10\.\d{4,9}\/[^\s"'<>()\[\],;]+/gi)) {

        const limpo = m[0].replace(/[.,;:]+$/, '').toLowerCase()
        registrar('doi', limpo)
    }


    for (const m of texto.matchAll(/PMID:?\s*(\d{4,8})\b/gi)) {
        registrar('pmid', m[1])
    }

    return [...contagem.entries()].map(([chave, ocorrencias]) => {
        const [tipo, valor] = chave.split('|')
        return { tipo: tipo as 'doi' | 'pmid', valor, ocorrencias }
    })
}
export async function levantarReferencias(doc: Documento): Promise<Referencia[]> {
    const encontrados = extrairIdentificadores(doc.texto)
    const referencias: Referencia[] = []

    let indice = 0
    for (const id of encontrados) {
        indice++
        const resultado = await verificarIdentificador(id.tipo, id.valor)
        referencias.push({
            indice,
            textoOriginal: id.valor,
            doi: id.tipo === 'doi' ? id.valor : undefined,
            pmid: id.tipo === 'pmid' ? id.valor : undefined,
            status: resultado.status,
            tituloRetornado: resultado.titulo,
            ocorrenciasNoCorpo: id.ocorrencias,
        })
    }

    return referencias
}

export async function analisarReferencias(doc: Documento): Promise<Flag[]> {
    const referencias = await levantarReferencias(doc)
    const flags: Flag[] = []

    for (const ref of referencias) {
        const rotulo = ref.doi ? `DOI ${ref.doi}` : `PMID ${ref.pmid}`

        if (ref.status === 'nao_encontrada') {
            flags.push({
                modulo: 'referencias',
                severidade: 'ALTA',
                titulo: 'Identificador de referência não encontrado nas bases',
                evidencia: `${rotulo} não foi localizado (DOI: CrossRef e DataCite; PMID: PubMed).`,
                detalhe: `Citado ${ref.ocorrenciasNoCorpo}x no corpo do texto.`,
            })
        }

        if (ref.status === 'nao_verificada') {
            flags.push({
                modulo: 'referencias',
                severidade: 'INFO',
                titulo: 'Não foi possível verificar o identificador',
                evidencia: `${rotulo} não pôde ser consultado (falha de rede ou serviço indisponível).`,
                detalhe: 'Isto não indica problema com a referência — apenas que a checagem não ocorreu.',
            })
        }
    }

    return flags
}
