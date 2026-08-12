import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarPmidEuropePmc } from './europepmc.ts'

function mockFetch(resposta: { ok: boolean; json?: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta))
}

afterEach(() => vi.unstubAllGlobals())

describe('consultarPmidEuropePmc', () => {
    it('PMID válido: hitCount > 0, extrai título e pubYear', async () => {
        mockFetch({
            ok: true,
            json: async () => ({
                hitCount: 1,
                resultList: { result: [{ title: 'Título de teste', pubYear: 2013 }] },
            }),
        })
        const r = await consultarPmidEuropePmc('23845944')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBe('Título de teste')
        expect(r.ano).toBe(2013)
    })

    it('PMID inexistente: HTTP 200 mas hitCount 0 -> nao_encontrada (nunca 404)', async () => {
        mockFetch({ ok: true, json: async () => ({ hitCount: 0, resultList: { result: [] } }) })
        const r = await consultarPmidEuropePmc('999999999')
        expect(r.status).toBe('nao_encontrada')
    })

    it('hitCount ausente/não numérico -> nao_verificada, não confunde com "não encontrado"', async () => {
        mockFetch({ ok: true, json: async () => ({}) })
        const r = await consultarPmidEuropePmc('1')
        expect(r.status).toBe('nao_verificada')
    })

    it('erro HTTP: nao_verificada', async () => {
        mockFetch({ ok: false })
        const r = await consultarPmidEuropePmc('1')
        expect(r.status).toBe('nao_verificada')
    })

    it('falha de rede: nao_verificada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
        const r = await consultarPmidEuropePmc('1')
        expect(r.status).toBe('nao_verificada')
    })
})
