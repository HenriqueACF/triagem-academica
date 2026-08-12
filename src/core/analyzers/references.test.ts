import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analisarReferencias, extrairIdentificadores } from './references.ts'
import * as cache from '../services/cache.ts'
import type { Documento } from '../models.ts'
import type { ResultadoConsulta } from '../services/crossref.ts'

vi.mock('../services/cache.ts', () => ({ verificarIdentificador: vi.fn() }))

function doc(texto: string): Documento {
    return { nome: 't.docx', formato: 'docx', texto, metadados: {}, errosLeitura: [] }
}

beforeEach(() => vi.mocked(cache.verificarIdentificador).mockReset())

describe('extrairIdentificadores', () => {
    it('extrai um DOI simples', () => {
        const ids = extrairIdentificadores('Ver doi:10.1038/nature12373 para detalhes.')
        expect(ids).toHaveLength(1)
        expect(ids[0]).toMatchObject({ tipo: 'doi', valor: '10.1038/nature12373', ocorrencias: 1 })
    })

    it('remove pontuação de fim de frase colada ao DOI', () => {
        const ids = extrairIdentificadores('Conforme 10.1038/nature12373.')
        expect(ids[0].valor).toBe('10.1038/nature12373')
    })

    it('conta repetições do mesmo DOI', () => {
        const texto = 'Ver 10.1038/nature12373 e de novo 10.1038/nature12373 aqui.'
        const ids = extrairIdentificadores(texto)
        expect(ids).toHaveLength(1)
        expect(ids[0].ocorrencias).toBe(2)
    })

    it('extrai PMID apenas quando rotulado — número solto não conta', () => {
        const texto = 'Ver PMID: 23845944, mas também o ano 2020 e a página 1234567 aqui.'
        const ids = extrairIdentificadores(texto)
        expect(ids).toHaveLength(1)
        expect(ids[0]).toMatchObject({ tipo: 'pmid', valor: '23845944' })
    })

    it('texto sem nenhum identificador retorna lista vazia (caso comum em ABNT autor-data)', () => {
        const texto = 'Um texto acadêmico normal (SILVA, 2020), sem nenhum DOI.'
        expect(extrairIdentificadores(texto)).toEqual([])
    })

    it('DOI é normalizado para minúsculo', () => {
        const ids = extrairIdentificadores('10.1038/NATURE12373')
        expect(ids[0].valor).toBe('10.1038/nature12373')
    })
})

describe('analisarReferencias', () => {
    it('identificador não encontrado em nenhuma base -> ALTA', async () => {
        vi.mocked(cache.verificarIdentificador).mockResolvedValue({ status: 'nao_encontrada' } as ResultadoConsulta)
        const flags = await analisarReferencias(doc('Conforme 10.9999/naoexiste.'))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('ALTA')
        expect(flags[0].evidencia).toContain('10.9999/naoexiste')
    })

    it('falha ao verificar (rede) -> INFO, nunca ALTA', async () => {
        vi.mocked(cache.verificarIdentificador).mockResolvedValue({ status: 'nao_verificada' } as ResultadoConsulta)
        const flags = await analisarReferencias(doc('Conforme 10.1038/x.'))
        expect(flags).toHaveLength(1)
        expect(flags[0].severidade).toBe('INFO')
        expect(flags[0].detalhe).toMatch(/não indica problema/i)
    })

    it('identificador válido não gera flag nenhuma', async () => {
        vi.mocked(cache.verificarIdentificador).mockResolvedValue({ status: 'valida', titulo: 'x' } as ResultadoConsulta)
        const flags = await analisarReferencias(doc('Conforme 10.1038/x.'))
        expect(flags).toEqual([])
    })

    it('documento sem identificador nenhum não consulta nenhuma base', async () => {
        const flags = await analisarReferencias(doc('Texto (SILVA, 2020) sem DOI.'))
        expect(flags).toEqual([])
        expect(cache.verificarIdentificador).not.toHaveBeenCalled()
    })
})
