import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Documento } from '../models.ts'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

function dataPdf(valor: unknown): string | undefined {
    if (typeof valor !== 'string') return undefined
    const m = valor.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
    if (!m) return undefined
    return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}Z`
}

function textoDe(valor: unknown): string | undefined {
    if (valor === undefined || valor === null || valor === '') return undefined
    return String(valor)
}

export async function lerPdf(nome: string, dados: ArrayBuffer): Promise<Documento> {
    const errosLeitura: string[] = []
    const metadados: Record<string, unknown> = {}

    const pdf = await pdfjs.getDocument({ data: new Uint8Array(dados) }).promise

    try {
        const info = (await pdf.getMetadata()).info as Record<string, unknown>
        metadados.creator = textoDe(info.Author)
        metadados.created = dataPdf(info.CreationDate)
        metadados.modified = dataPdf(info.ModDate)
        metadados.PdfCreator = textoDe(info.Creator)
        metadados.PdfProducer = textoDe(info.Producer)
        metadados.Title = textoDe(info.Title)
    } catch {
        errosLeitura.push('Não foi possível ler os metadados do PDF.')
    }

    metadados.Pages = String(pdf.numPages)

    const paginas: string[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
        try {
            const pagina = await pdf.getPage(n)
            const conteudo = await pagina.getTextContent()
            let linha = ''
            for (const item of conteudo.items) {
                const s = 'str' in item ? item.str : ''
                if (s === '') continue
                if (
                    linha !== '' &&
                    !/\s$/.test(linha) &&
                    !/^\s/.test(s) &&
                    !linha.endsWith('-') &&
                    !s.startsWith('-')
                ) {
                    linha += ' '
                }
                linha += s
            }
            linha = linha
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\b(10\.\d{4,9}\/)\s+(?=\S)/g, '$1')
                .trim()
            paginas.push(linha)
        } catch {
            errosLeitura.push(`Falha ao extrair texto da página ${n}.`)
        }
    }

    const texto = paginas.join('\n')
    metadados.Words = String(texto.split(/\s+/).filter((p) => p.length > 0).length)

    const mediaPorPagina = texto.length / pdf.numPages
    if (mediaPorPagina < 20) {
        errosLeitura.push(
            'Este PDF parece ser digitalizado (imagem) — quase nenhum texto pôde ser extraído. ' +
            'As análises de citações e artefatos não têm o que examinar neste documento.'
        )
    }


    return { nome, formato: 'pdf', texto, metadados, errosLeitura }
}
