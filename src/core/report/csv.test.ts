import { describe, expect, it } from 'vitest'
import { gerarCsv } from './csv.ts'
import type { Documento, Inventario, ResultadoTriagem } from '../models.ts'

function doc(nome: string): Documento {
    return { nome, formato: 'docx', texto: '', metadados: {}, errosLeitura: [] }
}

const INVENTARIO_VAZIO: Inventario = {
    citacoes: [], numericas: [], lista: { encontrada: false, entradas: [] }, ocorrencias: [],
}

function resultado(
    nome: string,
    severidades: Array<'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO'>,
    extra: Partial<ResultadoTriagem> = {},
): ResultadoTriagem {
    return {
        doc: doc(nome),
        flags: severidades.map((s) => ({ modulo: 'x', severidade: s, titulo: `flag ${s}`, evidencia: 'ev' })),
        referencias: [],
        inventario: INVENTARIO_VAZIO,
        ...extra,
    }
}

describe('gerarCsv', () => {
    it('começa com o BOM de UTF-8', () => {
        const csv = gerarCsv([resultado('a.docx', [])])
        expect(csv.charCodeAt(0)).toBe(0xFEFF)
    })

    it('usa ponto e vírgula como separador', () => {
        const csv = gerarCsv([resultado('a.docx', ['ALTA'])])
        const primeiraLinha = csv.slice(1).split('\r\n')[0]
        expect(primeiraLinha.split(';').length).toBeGreaterThan(5)
    })

    it('cabeçalho tem os campos esperados', () => {
        const csv = gerarCsv([])
        const cabecalho = csv.slice(1).split('\r\n')[0]
        expect(cabecalho).toContain('"arquivo"')
        expect(cabecalho).toContain('"mediana_ano_referencias"')
        expect(cabecalho).toContain('"erros_leitura"')
    })

    it('escapa aspas internas duplicando-as', () => {
        const r = resultado('a.docx', [])
        r.doc.errosLeitura = ['erro com "aspas" dentro']
        const csv = gerarCsv([r])
        expect(csv).toContain('erro com ""aspas"" dentro')
    })

    it('ponto e vírgula DENTRO de um campo não quebra as colunas (fica entre aspas)', () => {
        const r = resultado('a.docx', [])
        r.doc.errosLeitura = ['erro; com ponto e vírgula']
        const csv = gerarCsv([r])
        const linha = csv.slice(1).split('\r\n')[1]
        // O campo inteiro, ponto-e-vírgula incluso, deve estar entre um par de aspas.
        expect(linha).toContain('"erro; com ponto e vírgula"')
    })

    it('ordena por gravidade: mais ALTA primeiro', () => {
        const csv = gerarCsv([
            resultado('sem-flags.docx', []),
            resultado('com-alta.docx', ['ALTA']),
            resultado('com-media.docx', ['MEDIA']),
        ])
        const linhas = csv.slice(1).split('\r\n').slice(1) // sem cabeçalho
        expect(linhas[0]).toContain('com-alta.docx')
        expect(linhas[1]).toContain('com-media.docx')
        expect(linhas[2]).toContain('sem-flags.docx')
    })

    it('empate na gravidade desempata por nome do arquivo', () => {
        const csv = gerarCsv([resultado('z.docx', []), resultado('a.docx', [])])
        const linhas = csv.slice(1).split('\r\n').slice(1)
        expect(linhas[0]).toContain('a.docx')
        expect(linhas[1]).toContain('z.docx')
    })

    it('mediana de anos de referência: ímpar pega o do meio, par tira a média', () => {
        const impar = resultado('a.docx', [], {
            referencias: [
                { indice: 1, textoOriginal: 'x', status: 'valida', anoPublicacao: 2010, ocorrenciasNoCorpo: 1 },
                { indice: 2, textoOriginal: 'x', status: 'valida', anoPublicacao: 2015, ocorrenciasNoCorpo: 1 },
                { indice: 3, textoOriginal: 'x', status: 'valida', anoPublicacao: 2020, ocorrenciasNoCorpo: 1 },
            ],
        })
        const csvImpar = gerarCsv([impar])
        expect(csvImpar.slice(1).split('\r\n')[1]).toContain('"2015"')

        const par = resultado('b.docx', [], {
            referencias: [
                { indice: 1, textoOriginal: 'x', status: 'valida', anoPublicacao: 2010, ocorrenciasNoCorpo: 1 },
                { indice: 2, textoOriginal: 'x', status: 'valida', anoPublicacao: 2020, ocorrenciasNoCorpo: 1 },
            ],
        })
        const csvPar = gerarCsv([par])
        expect(csvPar.slice(1).split('\r\n')[1]).toContain('"2015"')
    })

    it('sem referência com ano, a mediana fica vazia', () => {
        const csv = gerarCsv([resultado('a.docx', [])])
        const linha = csv.slice(1).split('\r\n')[1]
        expect(linha).toContain('""') // campo vazio entre aspas
    })

    it('lista de referências não encontrada mostra "sem lista"', () => {
        const csv = gerarCsv([resultado('a.docx', [])])
        expect(csv).toContain('"sem lista"')
    })

    it('lista encontrada mostra o número de entradas', () => {
        const r = resultado('a.docx', [], {
            inventario: {
                ...INVENTARIO_VAZIO,
                lista: {
                    encontrada: true,
                    entradas: [{ indice: 1, textoOriginal: 'x', chave: 'x|2020', sobrenome: 'x' }],
                },
            },
        })
        const csv = gerarCsv([r])
        const linha = csv.slice(1).split('\r\n')[1]
        expect(linha).toContain('"1"')
    })
})
