import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarDoiDataCite } from './datacite.ts'

function mockFetch(resposta: { status?: number; ok: boolean; json?: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta))
}

afterEach(() => vi.unstubAllGlobals())

describe('consultarDoiDataCite', () => {
    it('DOI válido: título vem como lista de OBJETOS, não de strings (formato diferente do CrossRef)', async () => {
        mockFetch({
            ok: true,
            json: async () => ({
                data: {
                    attributes: {
                        titles: [{ title: 'Data from: A new malaria agent in African hominids.' }],
                        publicationYear: 2011,
                    },
                },
            }),
        })
        const r = await consultarDoiDataCite('10.5061/dryad.8515')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBe('Data from: A new malaria agent in African hominids.')
        expect(r.ano).toBe(2011)
    })

    it('DOI inexistente: 404 -> nao_encontrada', async () => {
        mockFetch({ status: 404, ok: false })
        const r = await consultarDoiDataCite('10.9999/naoexiste')
        expect(r.status).toBe('nao_encontrada')
    })

    it('DOI válido em outra agência (ex.: CrossRef) também dá 404 aqui — não é conclusivo sozinho', async () => {
        mockFetch({ status: 404, ok: false })
        const r = await consultarDoiDataCite('10.1038/nature12373')
        expect(r.status).toBe('nao_encontrada')
    })

    it('erro de servidor: nao_verificada', async () => {
        mockFetch({ status: 500, ok: false })
        const r = await consultarDoiDataCite('10.5061/x')
        expect(r.status).toBe('nao_verificada')
    })

    it('falha de rede: nao_verificada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
        const r = await consultarDoiDataCite('10.5061/x')
        expect(r.status).toBe('nao_verificada')
    })
})
