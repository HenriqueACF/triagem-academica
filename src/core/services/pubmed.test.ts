import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarPmid } from './pubmed.ts'

function mockFetch(resposta: { status?: number; ok: boolean; json?: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta))
}

afterEach(() => vi.unstubAllGlobals())

describe('consultarPmid (PubMed)', () => {
    it('PMID válido: extrai título e ano (pubdate "2013 Jul 26" -> 2013)', async () => {
        mockFetch({
            ok: true,
            json: async () => ({
                result: {
                    '23845944': {
                        title: 'Xk-related protein 8 and CED-8 promote phosphatidylserine exposure.',
                        pubdate: '2013 Jul 26',
                    },
                },
            }),
        })
        const r = await consultarPmid('23845944')
        expect(r.status).toBe('valida')
        expect(r.titulo).toContain('Xk-related protein 8')
        expect(r.ano).toBe(2013)
    })

    it('PMID inexistente: HTTP 200 mas com campo error no registro -> nao_encontrada', async () => {
        // O PubMed NUNCA responde 404 para PMID inexistente — sinaliza
        // via um campo `error` dentro de um registro HTTP 200.
        mockFetch({
            ok: true,
            json: async () => ({
                result: { '999999999': { uid: '999999999', error: 'cannot get document summary' } },
            }),
        })
        const r = await consultarPmid('999999999')
        expect(r.status).toBe('nao_encontrada')
    })

    it('REGRESSÃO: resposta sem o registro esperado -> nao_verificada, sem lançar exceção', async () => {
        // Bug real do projeto: a guarda estava escrita como `if (registro)`
        // em vez de `if (!registro)`, fazendo o caso normal e o de erro
        // darem o mesmo resultado (nao_verificada) sempre.
        mockFetch({ ok: true, json: async () => ({ result: {} }) })
        const r = await consultarPmid('12345678')
        expect(r.status).toBe('nao_verificada')
    })

    it('erro HTTP: nao_verificada', async () => {
        mockFetch({ ok: false })
        const r = await consultarPmid('12345678')
        expect(r.status).toBe('nao_verificada')
    })

    it('falha de rede: nao_verificada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
        const r = await consultarPmid('12345678')
        expect(r.status).toBe('nao_verificada')
    })

    it('pubdate só com ano ("2013") também extrai o ano', async () => {
        mockFetch({
            ok: true,
            json: async () => ({ result: { '1': { title: 't', pubdate: '2013' } } }),
        })
        const r = await consultarPmid('1')
        expect(r.ano).toBe(2013)
    })
})
