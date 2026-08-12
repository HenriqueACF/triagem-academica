import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarDoi } from './crossref.ts'

function mockFetch(resposta: { status: number; ok: boolean; json?: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta))
}

afterEach(() => vi.unstubAllGlobals())

describe('consultarDoi (CrossRef)', () => {
    it('DOI válido: extrai título e ano do formato real da API', async () => {
        mockFetch({
            status: 200, ok: true,
            json: async () => ({
                message: {
                    title: ['Nanometre-scale thermometry in a living cell'],
                    issued: { 'date-parts': [[2013, 7, 31]] },
                },
            }),
        })
        const r = await consultarDoi('10.1038/nature12373')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBe('Nanometre-scale thermometry in a living cell')
        expect(r.ano).toBe(2013)
    })

    it('DOI inexistente: 404 -> nao_encontrada', async () => {
        mockFetch({ status: 404, ok: false })
        const r = await consultarDoi('10.9999/naoexiste')
        expect(r.status).toBe('nao_encontrada')
    })

    it('erro de servidor (500): nao_verificada, nunca nao_encontrada', async () => {
        mockFetch({ status: 500, ok: false })
        const r = await consultarDoi('10.1038/qualquer')
        expect(r.status).toBe('nao_verificada')
    })

    it('falha de rede (fetch rejeita): nao_verificada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))
        const r = await consultarDoi('10.1038/qualquer')
        expect(r.status).toBe('nao_verificada')
    })

    it('resposta sem título (campo ausente): status válido, título indefinido', async () => {
        mockFetch({ status: 200, ok: true, json: async () => ({ message: {} }) })
        const r = await consultarDoi('10.1038/x')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBeUndefined()
    })
})
