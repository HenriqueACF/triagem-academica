import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarDoiOpenAlex } from './openalex.ts'

function mockFetch(resposta: { status?: number; ok: boolean; json?: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta))
}

afterEach(() => vi.unstubAllGlobals())

describe('consultarDoiOpenAlex', () => {
    it('DOI válido: título e ano no formato da API', async () => {
        mockFetch({
            ok: true,
            json: async () => ({ title: 'Nanometre-scale thermometry in a living cell', publication_year: 2013 }),
        })
        const r = await consultarDoiOpenAlex('10.1038/nature12373')
        expect(r.status).toBe('valida')
        expect(r.titulo).toContain('Nanometre-scale')
        expect(r.ano).toBe(2013)
    })

    it('usa display_name como alternativa quando title está ausente', async () => {
        mockFetch({ ok: true, json: async () => ({ display_name: 'Título alternativo' }) })
        const r = await consultarDoiOpenAlex('10.1038/x')
        expect(r.titulo).toBe('Título alternativo')
    })

    it('DOI inexistente: 404 -> nao_encontrada', async () => {
        mockFetch({ status: 404, ok: false })
        const r = await consultarDoiOpenAlex('10.9999/naoexiste')
        expect(r.status).toBe('nao_encontrada')
    })

    it('erro de servidor: nao_verificada', async () => {
        mockFetch({ status: 500, ok: false })
        const r = await consultarDoiOpenAlex('10.1038/x')
        expect(r.status).toBe('nao_verificada')
    })

    it('falha de rede: nao_verificada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
        const r = await consultarDoiOpenAlex('10.1038/x')
        expect(r.status).toBe('nao_verificada')
    })
})
