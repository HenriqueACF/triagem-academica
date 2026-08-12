import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { lerDocx } from './docx.ts'

interface OpcoesDocx {
    creator?: string
    lastModifiedBy?: string
    created?: string
    modified?: string
    revision?: string
    totalTime?: string
    words?: string
    application?: string
    rsids?: string[]
    paragrafos?: string[]
    fontes?: string[]
    omitirDocumentXml?: boolean
}

// Monta um .docx mínimo, mas estruturalmente real, do mesmo jeito que o
// Word gera por dentro: um ZIP com docProps/core.xml, docProps/app.xml,
// word/settings.xml e word/document.xml.
async function montarDocx(opcoes: OpcoesDocx): Promise<ArrayBuffer> {
    const zip = new JSZip()

    zip.file('docProps/core.xml', `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="x" xmlns:dc="y" xmlns:dcterms="z">
            <dc:creator>${opcoes.creator ?? ''}</dc:creator>
            <cp:lastModifiedBy>${opcoes.lastModifiedBy ?? ''}</cp:lastModifiedBy>
            <dcterms:created>${opcoes.created ?? ''}</dcterms:created>
            <dcterms:modified>${opcoes.modified ?? ''}</dcterms:modified>
            <cp:revision>${opcoes.revision ?? ''}</cp:revision>
        </cp:coreProperties>`)

    zip.file('docProps/app.xml', `<?xml version="1.0"?>
        <Properties>
            <TotalTime>${opcoes.totalTime ?? ''}</TotalTime>
            <Words>${opcoes.words ?? ''}</Words>
            <Application>${opcoes.application ?? ''}</Application>
        </Properties>`)

    const rsidsXml = (opcoes.rsids ?? []).map((v) => `<w:rsid w:val="${v}"/>`).join('')
    zip.file('word/settings.xml', `<w:settings>${rsidsXml}</w:settings>`)

    if (!opcoes.omitirDocumentXml) {
        const fontesTag = (i: number) =>
            opcoes.fontes?.[i] ? `<w:rFonts w:ascii="${opcoes.fontes[i]}"/>` : ''
        const paras = (opcoes.paragrafos ?? []).map((texto, i) => {
            // Simula o Word quebrando o texto em múltiplos <w:t> dentro do
            // MESMO parágrafo — é a situação real que a extração precisa
            // tratar juntando sem separador.
            const partes = texto.split('|').map((p) => `<w:r>${fontesTag(i)}<w:t>${p}</w:t></w:r>`).join('')
            return `<w:p>${partes}</w:p>`
        }).join('')
        zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body>${paras}</w:body></w:document>`)
    }

    return zip.generateAsync({ type: 'arraybuffer' })
}

describe('lerDocx', () => {
    it('lê os metadados básicos de core.xml e app.xml', async () => {
        const dados = await montarDocx({
            creator: 'aluno01', lastModifiedBy: 'Maria Silva',
            created: '2026-01-26T11:08:00Z', modified: '2026-02-12T18:56:00Z',
            revision: '66', totalTime: '77', words: '6308', application: 'Microsoft Office Word',
        })
        const doc = await lerDocx('trabalho.docx', dados)

        expect(doc.formato).toBe('docx')
        expect(doc.metadados.creator).toBe('aluno01')
        expect(doc.metadados.lastModifiedBy).toBe('Maria Silva')
        expect(doc.metadados.revision).toBe('66')
        expect(doc.metadados.TotalTime).toBe('77')
        expect(doc.metadados.Words).toBe('6308')
        expect(doc.metadados.Application).toBe('Microsoft Office Word')
    })

    it('conta rsids DISTINTOS, não o total de ocorrências', async () => {
        const dados = await montarDocx({ rsids: ['00AA1111', '00BB2222', '00AA1111', '00CC3333'] })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.metadados.rsidsDistintos).toBe(3)
    })

    it('REGRESSÃO: junta <w:t> SEM separador dentro do mesmo parágrafo', async () => {
        // O Word quebra o texto no meio da palavra quando muda formatação.
        // Juntar com espaço estilhaçaria a palavra: "pal|avra" -> "pal avra".
        const dados = await montarDocx({ paragrafos: ['pal|avra completa aqui'] })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.texto).toBe('palavra completa aqui')
    })

    it('quebra linha ENTRE parágrafos distintos', async () => {
        const dados = await montarDocx({ paragrafos: ['Primeiro parágrafo', 'Segundo parágrafo'] })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.texto).toBe('Primeiro parágrafo\nSegundo parágrafo')
    })

    it('parágrafos vazios são descartados, não viram linhas em branco', async () => {
        const dados = await montarDocx({ paragrafos: ['Texto real', '', 'Outro texto'] })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.texto).toBe('Texto real\nOutro texto')
    })

    it('decodifica entidades XML no texto (&amp; &lt; &gt; etc.)', async () => {
        const dados = await montarDocx({ paragrafos: ['Risco &amp; benefício &lt; 10%'] })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.texto).toBe('Risco & benefício < 10%')
    })

    it('extrai as fontes usadas via w:rFonts, na ordem de aparição', async () => {
        const dados = await montarDocx({
            paragrafos: ['Um parágrafo', 'Outro parágrafo'],
            fontes: ['Calibri', 'Arial'],
        })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.metadados.fontesUsadas).toEqual(['Calibri', 'Arial'])
    })

    it('entrada ausente (document.xml faltando) registra erro de leitura e não quebra', async () => {
        const dados = await montarDocx({ omitirDocumentXml: true })
        const doc = await lerDocx('t.docx', dados)
        expect(doc.texto).toBe('')
        expect(doc.errosLeitura.some((e) => e.includes('document.xml'))).toBe(true)
    })

    it('tag XML vazia vira string vazia, sem quebrar (metadata.ts já trata "" como ausente)', async () => {
        const dados = await montarDocx({})
        const doc = await lerDocx('t.docx', dados)
        expect(doc.metadados.creator).toBe('')
    })
})
