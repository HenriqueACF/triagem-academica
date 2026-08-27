import { describe, expect, it, vi } from 'vitest'

// Mocka o pdfjs-dist inteiro: testar a lógica de pdf.ts não deve depender
// do motor real de PDF, só do contrato que ele expõe (getDocument,
// getMetadata, numPages, getPage/getTextContent).
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
}))

function fakePdf(opcoes: {
    numPages: number
    info?: Record<string, unknown>
    metadataFalha?: boolean
    textoPorPagina: string[]
    paginaComErro?: number
}) {
    return {
        numPages: opcoes.numPages,
        getMetadata: async () => {
            if (opcoes.metadataFalha) throw new Error('metadados corrompidos')
            return { info: opcoes.info ?? {} }
        },
        getPage: async (n: number) => {
            if (n === opcoes.paginaComErro) throw new Error('página corrompida')
            return {
                getTextContent: async () => ({
                    items: opcoes.textoPorPagina[n - 1]
                        .split(' ')
                        .map((palavra) => ({ str: palavra + ' ' })),
                }),
            }
        },
    }
}

async function montarMock(pdf: ReturnType<typeof fakePdf>) {
    const pdfjs = await import('pdfjs-dist')
    vi.mocked(pdfjs.getDocument).mockReturnValue({ promise: Promise.resolve(pdf) } as never)
    return pdfjs
}

describe('lerPdf', () => {
    it('extrai texto de todas as páginas, separadas por quebra de linha', async () => {
        await montarMock(fakePdf({
            numPages: 2,
            textoPorPagina: [
                'Este é um texto razoavelmente longo para não disparar o aviso de PDF digitalizado numa das páginas',
                'Esta segunda página também tem bastante texto para não ser confundida com um PDF escaneado sem conteúdo',
            ],
        }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('t.pdf', new ArrayBuffer(0))

        expect(doc.formato).toBe('pdf')
        expect(doc.texto.split('\n')).toHaveLength(2)
        expect(doc.metadados.Pages).toBe('2')
    })

    it('REGRESSÃO: fragmentos de texto grudados ganham espaço (senão nomes/citações quebram)', async () => {
        // No PDF real, parte dos espaços é só posição visual e some dos itens;
        // unir com '' gerava "systemicdepletion" e "Ferrucci& Fabbri".
        vi.mocked((await import('pdfjs-dist')).getDocument).mockReturnValue({
            promise: Promise.resolve({
                numPages: 1,
                getMetadata: async () => ({ info: {} }),
                getPage: async () => ({
                    getTextContent: async () => ({
                        items: [
                            { str: 'systemic' }, { str: 'depletion' },
                            { str: ' ' }, { str: 'et' }, { str: 'al.' },
                            { str: 'Ferrucci' }, { str: '&' }, { str: ' Fabbri' },
                            { str: 'Ferreira-' }, { str: 'Fernandes' },
                        ],
                    }),
                }),
            }),
        } as never)
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('t.pdf', new ArrayBuffer(0))
        expect(doc.texto).toBe('systemic depletion et al. Ferrucci & Fabbri Ferreira-Fernandes')
    })

    it('converte data no formato PDF (D:20260126110800) para ISO', async () => {
        await montarMock(fakePdf({
            numPages: 1,
            info: { CreationDate: 'D:20260126110800+00\'00\'', Author: 'aluno01' },
            textoPorPagina: ['Um texto qualquer razoavelmente longo para não disparar o aviso de digitalização'],
        }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('t.pdf', new ArrayBuffer(0))
        expect(doc.metadados.created).toBe('2026-01-26T11:08:00Z')
        expect(doc.metadados.creator).toBe('aluno01')
    })

    it('REGRESSÃO: PDF digitalizado (sem texto) vira aviso em errosLeitura, não fica silencioso', async () => {
        await montarMock(fakePdf({
            numPages: 3,
            textoPorPagina: ['', '', ''], // como um PDF só de imagem, sem camada de texto
        }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('escaneado.pdf', new ArrayBuffer(0))
        expect(doc.errosLeitura.some((e) => e.includes('digitalizado'))).toBe(true)
    })

    it('PDF com texto de verdade não dispara o aviso de digitalização', async () => {
        const textoLongo = 'Palavra '.repeat(50) // bem acima de 20 caracteres/página
        await montarMock(fakePdf({ numPages: 1, textoPorPagina: [textoLongo] }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('normal.pdf', new ArrayBuffer(0))
        expect(doc.errosLeitura.some((e) => e.includes('digitalizado'))).toBe(false)
    })

    it('falha ao ler metadados não impede a extração de texto', async () => {
        await montarMock(fakePdf({
            numPages: 1,
            metadataFalha: true,
            textoPorPagina: ['Um texto qualquer razoavelmente longo para não disparar o aviso de digitalização'],
        }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('t.pdf', new ArrayBuffer(0))
        expect(doc.errosLeitura).toContain('Não foi possível ler os metadados do PDF.')
        expect(doc.texto.length).toBeGreaterThan(0)
    })

    it('falha numa página isolada não derruba as demais', async () => {
        await montarMock(fakePdf({
            numPages: 3,
            paginaComErro: 2,
            textoPorPagina: [
                'Primeira página com bastante texto para passar do limiar de digitalização com folga',
                'não deveria ser lida por causa do erro',
                'Terceira página também com bastante texto para passar do limiar estabelecido aqui',
            ],
        }))
        const { lerPdf } = await import('./pdf.ts')
        const doc = await lerPdf('t.pdf', new ArrayBuffer(0))
        expect(doc.errosLeitura.some((e) => e.includes('página 2'))).toBe(true)
        expect(doc.texto).toContain('Primeira página')
        expect(doc.texto).toContain('Terceira página')
    })
})
