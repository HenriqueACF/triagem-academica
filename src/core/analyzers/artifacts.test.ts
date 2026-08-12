import { describe, expect, it } from 'vitest'
import { analisarArtefatos } from './artifacts.ts'
import type { Documento } from '../models.ts'

function doc(texto: string): Documento {
    return { nome: 't.docx', formato: 'docx', texto, metadados: {}, errosLeitura: [] }
}

describe('analisarArtefatos', () => {
    it('texto vazio não dispara nada', async () => {
        expect(await analisarArtefatos(doc(''))).toEqual([])
    })

    it('texto normal, sem artefatos, não dispara nada', async () => {
        const flags = await analisarArtefatos(doc('Um texto acadêmico normal, sem nada de especial aqui.'))
        expect(flags).toEqual([])
    })

    it('caracteres invisíveis abaixo do limiar (5) não disparam', async () => {
        const texto = 'a​b​c' // 2 ocorrências
        expect(await analisarArtefatos(doc(texto))).toEqual([])
    })

    it('caracteres invisíveis no limiar (>=5) disparam BAIXA', async () => {
        const texto = 'a​b​c​d​e​f' // 5 ocorrências de U+200B
        const flags = await analisarArtefatos(doc(texto))
        const flag = flags.find((f) => f.titulo === 'Caracteres invisíveis no texto')
        expect(flag).toBeDefined()
        expect(flag!.severidade).toBe('BAIXA')
        expect(flag!.evidencia).toContain('5 ocorrências')
    })

    it('mistura de aspas retas e tipográficas, ambas >= limiar -> INFO', async () => {
        const retas = '"a" "b" "c" "d" "e"'
        const curvas = '“f” “g” “h” “i” “j”'
        const flags = await analisarArtefatos(doc(retas + ' ' + curvas))
        const flag = flags.find((f) => f.titulo === 'Mistura de aspas retas e tipográficas')
        expect(flag).toBeDefined()
        expect(flag!.severidade).toBe('INFO')
    })

    it('só aspas retas (sem tipográficas) não dispara a mistura', async () => {
        const texto = '"a" "b" "c" "d" "e" "f"'
        const flags = await analisarArtefatos(doc(texto))
        expect(flags.find((f) => f.titulo.includes('Mistura'))).toBeUndefined()
    })

    it('espaços não separáveis (U+00A0) em excesso -> INFO', async () => {
        const texto = Array(6).fill('a b').join(' ')
        const flags = await analisarArtefatos(doc(texto))
        const flag = flags.find((f) => f.titulo === 'Espaços não separáveis em quantidade incomum')
        expect(flag).toBeDefined()
        expect(flag!.severidade).toBe('INFO')
    })

    it('espaçamento múltiplo entre palavras -> INFO', async () => {
        // O regex \S {2,}\S não sobrepõe matches: cada par consumido não pode
        // reaproveitar sua letra final no próximo match. Cinco pares
        // isolados por espaço simples garantem 5 ocorrências reais.
        const texto = 'a  b x  y m  n p  q r  s'
        const flags = await analisarArtefatos(doc(texto))
        const flag = flags.find((f) => f.titulo === 'Espaçamento múltiplo entre palavras')
        expect(flag).toBeDefined()
        expect(flag!.severidade).toBe('INFO')
        expect(flag!.evidencia).toContain('5 trechos')
    })

    it('nenhuma severidade passa de BAIXA neste módulo', async () => {
        const texto =
            'a​b​c​d​e​f ' +
            '"a" "b" "c" "d" "e" "f" “g” “h” “i” “j” “k” “l” ' +
            Array(6).fill('a b').join(' ') + ' ' +
            'x  y m  n p  q r  s t  u'
        const flags = await analisarArtefatos(doc(texto))
        expect(flags.length).toBeGreaterThan(0)
        for (const f of flags) {
            expect(['BAIXA', 'INFO']).toContain(f.severidade)
        }
    })
})
