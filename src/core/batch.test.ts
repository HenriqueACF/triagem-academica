import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

// batch.ts importa readers/index.ts, que importa pdf.ts mesmo quando só
// processamos .docx no teste. pdfjs-dist depende de APIs de navegador
// (DOMMatrix) ausentes no Node, então precisa ser mockado aqui também,
// mesmo sem nenhum teste de PDF neste arquivo.
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
}))

const { ehArquivoSuportado, processarArquivo, processarLote } = await import('./batch.ts')
const artefatosModulo = await import('./analyzers/artifacts.ts')

// Nenhum teste aqui deve depender de rede: o texto do .docx fabricado
// nunca contém DOI/PMID, então `levantarReferencias` não encontra nada
// para consultar. Ainda assim, travamos fetch por segurança — se algum
// teste futuro introduzir um identificador sem querer, ele falha rápido
// e alto em vez de tentar uma chamada real de rede.
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede não deveria ser usada neste teste')))
afterEach(() => vi.restoreAllMocks())

async function montarDocxSimples(texto: string): Promise<ArrayBuffer> {
    const zip = new JSZip()
    zip.file('docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y"/>')
    zip.file('docProps/app.xml', '<?xml version="1.0"?><Properties><Words>10</Words></Properties>')
    zip.file('word/settings.xml', '<w:settings/>')
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:body></w:document>`)
    return zip.generateAsync({ type: 'arraybuffer' })
}

describe('ehArquivoSuportado', () => {
    it('aceita .docx e .pdf, insensível a maiúsculas', () => {
        expect(ehArquivoSuportado('trabalho.docx')).toBe(true)
        expect(ehArquivoSuportado('trabalho.PDF')).toBe(true)
    })

    it('rejeita arquivo temporário do Word (~$)', () => {
        expect(ehArquivoSuportado('~$trabalho.docx')).toBe(false)
    })

    it('rejeita arquivo oculto (começa com ponto)', () => {
        expect(ehArquivoSuportado('.trabalho.docx')).toBe(false)
    })

    it('rejeita formato não suportado', () => {
        expect(ehArquivoSuportado('notas.txt')).toBe(false)
    })

    it('considera só o nome do arquivo, ignorando o caminho da pasta', () => {
        expect(ehArquivoSuportado('turma-2026/pasta1/~$rascunho.docx')).toBe(false)
        expect(ehArquivoSuportado('turma-2026/pasta1/trabalho.docx')).toBe(true)
    })
})

describe('processarArquivo', () => {
    it('processa um .docx real de ponta a ponta e devolve o formato esperado', async () => {
        const dados = await montarDocxSimples('Um texto de trabalho qualquer, sem nada de especial.')
        const resultado = await processarArquivo('trabalho.docx', dados)

        expect(resultado.doc.nome).toBe('trabalho.docx')
        expect(resultado.doc.errosLeitura).toEqual([])
        expect(Array.isArray(resultado.flags)).toBe(true)
        expect(Array.isArray(resultado.referencias)).toBe(true)
        expect(resultado.inventario).toBeDefined()
    })

    it('arquivo corrompido não lança exceção: vira um Documento com erro registrado', async () => {
        const dadosInvalidos = new ArrayBuffer(4) // não é um zip válido
        const resultado = await processarArquivo('corrompido.docx', dadosInvalidos)

        expect(resultado.doc.errosLeitura.length).toBeGreaterThan(0)
        expect(resultado.doc.errosLeitura[0]).toContain('Falha ao abrir o arquivo')
        expect(resultado.flags).toEqual([])
    })

    it('ISOLAMENTO: um analisador que lança exceção não derruba os demais', async () => {
        vi.spyOn(artefatosModulo, 'analisarArtefatos').mockRejectedValue(new Error('bug simulado'))

        const dados = await montarDocxSimples('Texto qualquer para o teste de isolamento de falhas.')
        const resultado = await processarArquivo('trabalho.docx', dados)

        // O módulo que falhou vira uma flag INFO explicando a falha...
        const falha = resultado.flags.find((f) => f.titulo.includes('Falha interna no módulo "artefatos"'))
        expect(falha).toBeDefined()
        expect(falha!.severidade).toBe('INFO')
        expect(falha!.evidencia).toContain('bug simulado')

        // ...e os outros analisadores continuam tendo rodado normalmente
        // (o resultado não fica vazio nem incompleto por causa de um só).
        expect(resultado.doc.errosLeitura).toEqual([])
    })
})

describe('processarLote', () => {
    it('processa vários arquivos em sequência e devolve um resultado por arquivo', async () => {
        const a = await montarDocxSimples('Primeiro trabalho da turma, texto qualquer aqui.')
        const b = await montarDocxSimples('Segundo trabalho da turma, outro texto qualquer.')

        const resultados = await processarLote([
            { nome: 'a.docx', dados: a },
            { nome: 'b.docx', dados: b },
        ])

        expect(resultados).toHaveLength(2)
        expect(resultados.map((r) => r.doc.nome)).toEqual(['a.docx', 'b.docx'])
    })

    it('chama o callback de progresso com contagem crescente e nome do arquivo atual', async () => {
        const a = await montarDocxSimples('Trabalho único no lote deste teste específico.')
        const chamadas: Array<[number, number, string]> = []

        await processarLote([{ nome: 'a.docx', dados: a }], (concluidos, total, nome) => {
            chamadas.push([concluidos, total, nome])
        })

        expect(chamadas[0]).toEqual([0, 1, 'a.docx'])
        expect(chamadas[chamadas.length - 1]).toEqual([1, 1, ''])
    })

    it('lote vazio não quebra e devolve lista vazia', async () => {
        const resultados = await processarLote([])
        expect(resultados).toEqual([])
    })
})
