import type { Documento, Flag } from '../models.ts'

const STOPWORDS_PT = new Set([
    'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com',
    'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos',
])

const STOPWORDS_EN = new Set([
    'the', 'of', 'and', 'to', 'in', 'a', 'is', 'that', 'for', 'on',
    'with', 'as', 'are', 'this', 'be', 'by', 'an',
])

const MINIMO_PALAVRAS = 15

function idiomaDoParagrafo(paragrafo: string): 'pt' | 'en' | 'indefinido' {
    const palavras = paragrafo.toLowerCase().split(/\s+/).filter((p) => p.length > 0)
    if (palavras.length < MINIMO_PALAVRAS) return 'indefinido'

    const pt = palavras.filter((p) => STOPWORDS_PT.has(p)).length
    const en = palavras.filter((p) => STOPWORDS_EN.has(p)).length
    if (pt === 0 && en === 0) return 'indefinido'
    return pt >= en ? 'pt' : 'en'
}

export async function analisarIdioma(doc: Documento): Promise<Flag[]> {
    const flags: Flag[] = []
    const paragrafos = doc.texto.split('\n')

    const contagem = { pt: 0, en: 0, indefinido: 0 }
    for (const p of paragrafos) contagem[idiomaDoParagrafo(p)]++

    const total = contagem.pt + contagem.en
    if (total === 0) return flags

    const dominante = contagem.pt >= contagem.en ? 'pt' : 'en'
    const minoritario = dominante === 'pt' ? contagem.en : contagem.pt

    if (minoritario > 1) {
        flags.push({
            modulo: 'idioma',
            severidade: 'INFO',
            titulo: 'Trechos em idioma diferente do predominante',
            evidencia: `${minoritario} parágrafo(s) em ${dominante === 'pt' ? 'inglês' : 'português'} ` +
                `dentro de um documento predominantemente em ${dominante === 'pt' ? 'português' : 'inglês'}.`,
            detalhe: 'Módulo experimental — não validado contra um corpus real. Comum em citação direta ou termo técnico não traduzido. Não indica, por si só, nenhum problema.',
        })
    }

    return flags
}
