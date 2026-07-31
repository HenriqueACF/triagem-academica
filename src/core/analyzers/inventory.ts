import type { Documento, Flag } from '../models.ts'
export interface CitacaoEncontrada {
    textoOriginal: string
    ano: string
    chave: string
    ocorrencias: number
}

export function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function primeiroSobrenome(texto: string): string {
    return normalizar(texto)
        .replace(/\bet al\.?/g, '')
        .split(/[;,]/)[0]
        .trim()
        .split(/\s+/)[0]
        ?.replace(/[.;:]+$/, '') ?? ''
}

function montarChave(autores: string, ano: string): string {
    return `${primeiroSobrenome(autores)}|${ano}`
}

export function extrairCitacoes(texto: string): CitacaoEncontrada[] {
    const contagem = new Map<string, CitacaoEncontrada>()

    for (const m of texto.matchAll(/\(([^()]{3,150})\)/g)) {
        let acumulado: string[] = []

        for (const parte of m[1].split(';')) {
            acumulado.push(parte.trim())

            const casou = acumulado.join('; ').match(/^(.{2,150}),\s*(\d{4})[a-z]?\s*$/)
            if (!casou) continue

            acumulado = []
            const autores = casou[1].trim()
            const ano = casou[2]

            const n = Number(ano)
            if (n < 1900 || n > 2100) continue

            const chave = montarChave(autores, ano)
            const existente = contagem.get(chave)
            if (existente) {
                existente.ocorrencias++
            } else {
                contagem.set(chave, {
                    textoOriginal: `${autores}, ${ano}`,
                    ano,
                    chave,
                    ocorrencias: 1,
                })
            }
        }
    }

    return [...contagem.values()]
}

export interface ReferenciaListada {
    indice: number
    textoOriginal: string
    chave: string
}

export interface ListaReferencias {
    encontrada: boolean
    entradas: ReferenciaListada[]
}


const TITULO_SECAO = /^\s*(refer[êe]ncias?\b.*|bibliografia\b.*|obras citadas\b.*)$/i
export function extrairListaReferencias(texto: string): ListaReferencias {
    const linhas = texto.split('\n')

    let inicio = -1
    for (let i = linhas.length - 1; i >= 0; i--) {
        if (TITULO_SECAO.test(linhas[i].trim())) {
            inicio = i
            break
        }
    }

    if (inicio === -1) {
        return { encontrada: false, entradas: [] }
    }

    const entradas: ReferenciaListada[] = []
    let indice = 0

    for (const linha of linhas.slice(inicio + 1)) {
        const entrada = linha.trim()
        if (entrada.length < 25) continue

        const sobrenome = primeiroSobrenome(entrada)

        const anos = [...entrada.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0])
        const ano = anos.length > 0 ? anos[anos.length - 1] : ''

        indice++
        entradas.push({
            indice,
            textoOriginal: entrada,
            chave: `${sobrenome}|${ano}`,
        })
    }

    return { encontrada: true, entradas }
}

export async function analisarInventario(doc: Documento): Promise<Flag[]> {
    const flags: Flag[] = []
    const citacoes = extrairCitacoes(doc.texto)
    const lista = extrairListaReferencias(doc.texto)
    const totalOcorrencias = citacoes.reduce((s, c) => s + c.ocorrencias, 0)

    if (!lista.encontrada && citacoes.length > 0) {
        flags.push({
            modulo: 'inventario',
            severidade: 'MEDIA',
            titulo: 'Citações no corpo sem lista de referências',
            evidencia: `${citacoes.length} citações distintas (${totalOcorrencias} ocorrências) e nenhuma seção de referências localizada.`,
            detalhe: 'Nenhuma das citações pode ser conferida. A lista pode estar em arquivo separado.',
        })
    }

    if (citacoes.length === 0 && doc.texto.length > 3000) {
        flags.push({
            modulo: 'inventario',
            severidade: 'BAIXA',
            titulo: 'Documento sem citações no formato autor-data',
            evidencia: `${doc.texto.length} caracteres de texto e nenhuma citação "(Autor, ano)" encontrada.`,
            detalhe: 'O trabalho pode usar outro sistema de citação (numérico, notas de rodapé).',
        })
    }

    if (lista.encontrada) {
        const chavesListadas = new Set(lista.entradas.map((e) => e.chave))
        const chavesCitadas = new Set(citacoes.map((c) => c.chave))

        const naoListadas = citacoes.filter((c) => !chavesListadas.has(c.chave))
        if (naoListadas.length > 0) {
            flags.push({
                modulo: 'inventario',
                severidade: 'MEDIA',
                titulo: 'Citações que não constam na lista de referências',
                evidencia: `${naoListadas.length} de ${citacoes.length} citações sem entrada correspondente: ${naoListadas.map((c) => c.textoOriginal).join(' | ')}`,
                detalhe: 'Conferir manualmente: variação na grafia do sobrenome causa divergência sem que haja problema real.',
            })
        }

        const naoCitadas = lista.entradas.filter((e) => !chavesCitadas.has(e.chave))
        if (naoCitadas.length > 0) {
            flags.push({
                modulo: 'inventario',
                severidade: 'BAIXA',
                titulo: 'Referências listadas que não aparecem no corpo',
                evidencia: `${naoCitadas.length} de ${lista.entradas.length} entradas nunca são citadas: ${naoCitadas.map((e) => `#${e.indice}`).join(', ')}`,
                detalhe: 'Comum em trabalhos que passaram por cortes de texto.',
            })
        }
    }

    return flags
}
