import { describe, expect, it } from 'vitest'
import { analisarMetadados } from './metadata.ts'
import type { Documento } from '../models.ts'

function doc(metadados: Record<string, unknown>): Documento {
    return { nome: 't.docx', formato: 'docx', texto: '', metadados, errosLeitura: [] }
}

describe('analisarMetadados', () => {
    it('não dispara nada com metadados vazios (dado ausente nunca vira flag)', async () => {
        expect(await analisarMetadados(doc({}))).toEqual([])
    })

    it('regra 1: tempo muito curto (<30min) + doc grande (>=3000 palavras) -> ALTA', async () => {
        const flags = await analisarMetadados(doc({ TotalTime: '8', Words: '4200' }))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('ALTA')
        expect(flags[0].evidencia).toContain('8 min')
        expect(flags[0].evidencia).toContain('4200 palavras')
    })

    it('regra 2: tempo curto (<10min) + doc médio (>=1500 palavras) -> MEDIA', async () => {
        const flags = await analisarMetadados(doc({ TotalTime: '6', Words: '1900' }))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('MEDIA')
        expect(flags[0].titulo).toBe('Tempo de edição curto para o volume de texto')
    })

    it('regras 1 e 2 são exclusivas: ALTA não repete como MEDIA', async () => {
        const flags = await analisarMetadados(doc({ TotalTime: '5', Words: '5000' }))
        const titulosDeTempo = flags.filter((f) => f.titulo.includes('Tempo de edição'))
        expect(titulosDeTempo).toHaveLength(1)
        expect(titulosDeTempo[0].severidade).toBe('ALTA')
    })

    it('tempo folgado não dispara regra 1 nem 2', async () => {
        const flags = await analisarMetadados(doc({ TotalTime: '600', Words: '4000' }))
        expect(flags.filter((f) => f.titulo.includes('Tempo de edição'))).toHaveLength(0)
    })

    it('regra 3: poucas revisões (<=2) em documento longo (>=1000 palavras) -> MEDIA', async () => {
        const flags = await analisarMetadados(doc({ revision: '1', Words: '1400' }))
        expect(flags).toHaveLength(1)
        expect(flags[0].titulo).toBe('Poucas revisões salvas para o tamanho do documento')
    })

    it('muitas revisões não dispara a regra 3', async () => {
        const flags = await analisarMetadados(doc({ revision: '66', Words: '6000' }))
        expect(flags.filter((f) => f.titulo.includes('revisões'))).toHaveLength(0)
    })

    it('regra 4: criação e modificação a menos de 15 min -> MEDIA', async () => {
        const flags = await analisarMetadados(doc({
            created: '2026-03-01T10:00:00Z',
            modified: '2026-03-01T10:06:00Z',
        }))
        expect(flags).toHaveLength(1)
        expect(flags[0].evidencia).toContain('6 min de diferença')
    })

    it('regra 4 não dispara quando o intervalo é confortável', async () => {
        const flags = await analisarMetadados(doc({
            created: '2026-01-26T11:08:00Z',
            modified: '2026-02-12T18:56:00Z',
        }))
        expect(flags).toHaveLength(0)
    })

    it('regra 5: poucos rsids (<3) em documento grande (>=2000 palavras) -> BAIXA', async () => {
        const flags = await analisarMetadados(doc({ rsidsDistintos: 2, Words: '2500' }))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('BAIXA')
    })

    it('regra 6: editor fora da lista conhecida -> INFO', async () => {
        const flags = await analisarMetadados(doc({ Application: 'CoolWriter 9000' }))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('INFO')
        expect(flags[0].evidencia).toContain('CoolWriter 9000')
    })

    it('regra 6 usa includes(): variações do Word não disparam', async () => {
        const flags = await analisarMetadados(doc({ Application: 'Microsoft Office Word' }))
        expect(flags).toHaveLength(0)
    })

    it('documento saudável real (o da professora) não gera nenhuma flag', async () => {
        const flags = await analisarMetadados(doc({
            revision: '66',
            TotalTime: '77',
            Words: '6308',
            rsidsDistintos: 150,
            created: '2026-01-26T11:08:00Z',
            modified: '2026-02-12T18:56:00Z',
            Application: 'Microsoft Office Word',
        }))
        expect(flags).toEqual([])
    })
})
