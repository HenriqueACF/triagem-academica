import { describe, expect, it } from 'vitest'
import { analisarIdioma } from './language.ts'
import type { Documento } from '../models.ts'

function doc(texto: string): Documento {
    return { nome: 't.docx', formato: 'docx', texto, metadados: {}, errosLeitura: [] }
}

const PARAGRAFO_PT =
    'Este é um parágrafo em português com bastante conteúdo para passar do limiar ' +
    'estabelecido aqui de fato, com mais de quinze palavras no total.'

const PARAGRAFO_EN =
    'According to the World Health Organization guidelines published this year the ' +
    'recommendation changed significantly for this particular clinical condition.'

describe('analisarIdioma', () => {
    it('documento vazio não dispara e não quebra', async () => {
        expect(await analisarIdioma(doc(''))).toEqual([])
    })

    it('documento inteiramente em português não dispara', async () => {
        const texto = [PARAGRAFO_PT, PARAGRAFO_PT, PARAGRAFO_PT].join('\n')
        expect(await analisarIdioma(doc(texto))).toEqual([])
    })

    it('um único parágrafo em inglês (citação isolada) NÃO dispara', async () => {
        const texto = [PARAGRAFO_PT, PARAGRAFO_EN, PARAGRAFO_PT].join('\n')
        expect(await analisarIdioma(doc(texto))).toEqual([])
    })

    it('dois ou mais parágrafos em inglês disparam INFO', async () => {
        const texto = [PARAGRAFO_PT, PARAGRAFO_EN, PARAGRAFO_PT, PARAGRAFO_EN].join('\n')
        const flags = await analisarIdioma(doc(texto))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('INFO')
        expect(flags[0].evidencia).toContain('2 parágrafo(s) em inglês')
    })

    it('parágrafos curtos (<15 palavras) são ignorados, mesmo que só tenham termos em inglês', async () => {
        const texto = [PARAGRAFO_PT, 'The end.', PARAGRAFO_PT, 'By the way.'].join('\n')
        expect(await analisarIdioma(doc(texto))).toEqual([])
    })

    it('detalhe explica que termo técnico/citação direta é a explicação mais comum', async () => {
        const texto = [PARAGRAFO_PT, PARAGRAFO_EN, PARAGRAFO_PT, PARAGRAFO_EN].join('\n')
        const flags = await analisarIdioma(doc(texto))
        expect(flags[0].detalhe).toMatch(/não indica.*problema/i)
    })

    it('documento majoritariamente em inglês inverte a leitura (minoria vira português)', async () => {
        const texto = [PARAGRAFO_EN, PARAGRAFO_EN, PARAGRAFO_EN, PARAGRAFO_PT, PARAGRAFO_PT].join('\n')
        const flags = await analisarIdioma(doc(texto))
        expect(flags).toHaveLength(1)
        expect(flags[0].evidencia).toContain('português')
    })
})
