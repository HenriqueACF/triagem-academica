import { describe, expect, it } from 'vitest'
import { analisarFontes } from './fonts.ts'
import type { Documento } from '../models.ts'

function doc(fontesUsadas?: unknown): Documento {
    return {
        nome: 't.docx', formato: 'docx', texto: '', errosLeitura: [],
        metadados: fontesUsadas === undefined ? {} : { fontesUsadas },
    }
}

describe('analisarFontes', () => {
    it('sem metadado de fontes (ex.: PDF) não dispara e não quebra', async () => {
        expect(await analisarFontes(doc())).toEqual([])
    })

    it('metadado que não é array não dispara', async () => {
        expect(await analisarFontes(doc('Calibri'))).toEqual([])
    })

    it('array vazio não dispara', async () => {
        expect(await analisarFontes(doc([]))).toEqual([])
    })

    it('uma única fonte no documento inteiro não dispara', async () => {
        const flags = await analisarFontes(doc(Array(50).fill('Calibri')))
        expect(flags).toEqual([])
    })

    it('fonte minoritária abaixo do limiar mínimo (5) não dispara', async () => {
        const fontes = [...Array(120).fill('Calibri'), ...Array(4).fill('Arial')]
        const flags = await analisarFontes(doc(fontes))
        expect(flags).toEqual([])
    })

    it('fonte minoritária com proporção alta demais (>=5%) não dispara', async () => {
        // 10 de 100 = 10%, acima do limiar de 5%
        const fontes = [...Array(90).fill('Calibri'), ...Array(10).fill('Arial')]
        const flags = await analisarFontes(doc(fontes))
        expect(flags).toEqual([])
    })

    it('fonte minoritária (>=5 ocorrências, <5% do total) dispara BAIXA', async () => {
        const fontes = [...Array(124).fill('Calibri'), ...Array(6).fill('Arial')]
        const flags = await analisarFontes(doc(fontes))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('BAIXA')
        expect(flags[0].evidencia).toContain('Calibri')
        expect(flags[0].evidencia).toContain('Arial')
        expect(flags[0].evidencia).toContain('6x')
    })

    it('duas fontes minoritárias distintas aparecem juntas na mesma evidência', async () => {
        const fontes = [
            ...Array(150).fill('Calibri'),
            ...Array(6).fill('Arial'),
            ...Array(7).fill('Times New Roman'),
        ]
        const flags = await analisarFontes(doc(fontes))
        expect(flags).toHaveLength(1)
        expect(flags[0].evidencia).toContain('Arial')
        expect(flags[0].evidencia).toContain('Times New Roman')
    })
})
