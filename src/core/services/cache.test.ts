import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as crossref from './crossref.ts'
import * as pubmed from './pubmed.ts'
import * as datacite from './datacite.ts'
import * as openalex from './openalex.ts'
import * as europepmc from './europepmc.ts'
import { limparCache, tamanhoCache, verificarIdentificador } from './cache.ts'
import type { ResultadoConsulta } from './crossref.ts'

vi.mock('./crossref.ts', () => ({ consultarDoi: vi.fn() }))
vi.mock('./pubmed.ts', () => ({ consultarPmid: vi.fn() }))
vi.mock('./datacite.ts', () => ({ consultarDoiDataCite: vi.fn() }))
vi.mock('./openalex.ts', () => ({ consultarDoiOpenAlex: vi.fn() }))
vi.mock('./europepmc.ts', () => ({ consultarPmidEuropePmc: vi.fn() }))

const NAO_ENCONTRADA: ResultadoConsulta = { status: 'nao_encontrada' }
const NAO_VERIFICADA: ResultadoConsulta = { status: 'nao_verificada' }
const VALIDA = (titulo: string): ResultadoConsulta => ({ status: 'valida', titulo })

beforeEach(() => {
    limparCache()
    vi.mocked(crossref.consultarDoi).mockReset()
    vi.mocked(datacite.consultarDoiDataCite).mockReset()
    vi.mocked(openalex.consultarDoiOpenAlex).mockReset()
    vi.mocked(pubmed.consultarPmid).mockReset()
    vi.mocked(europepmc.consultarPmidEuropePmc).mockReset()
})

describe('verificarIdentificador — encadeamento de DOI', () => {
    it('se a primeira base (CrossRef) reconhece, para ali — não consulta as demais', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(VALIDA('do CrossRef'))
        const r = await verificarIdentificador('doi', '10.1/x')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBe('do CrossRef')
        expect(datacite.consultarDoiDataCite).not.toHaveBeenCalled()
        expect(openalex.consultarDoiOpenAlex).not.toHaveBeenCalled()
    })

    it('CrossRef nega, DataCite reconhece -> usa o resultado da DataCite', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(datacite.consultarDoiDataCite).mockResolvedValue(VALIDA('da DataCite'))
        const r = await verificarIdentificador('doi', '10.1/x')
        expect(r.status).toBe('valida')
        expect(r.titulo).toBe('da DataCite')
        expect(openalex.consultarDoiOpenAlex).not.toHaveBeenCalled()
    })

    it('as três negam -> nao_encontrada', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(datacite.consultarDoiDataCite).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(openalex.consultarDoiOpenAlex).mockResolvedValue(NAO_ENCONTRADA)
        const r = await verificarIdentificador('doi', '10.1/inventado')
        expect(r.status).toBe('nao_encontrada')
    })

    it('PROTEÇÃO CENTRAL: se qualquer base falhar por rede, o resultado NUNCA é nao_encontrada', async () => {
        // Mesmo que as outras duas neguem, uma falha de rede em qualquer
        // base é motivo suficiente para não afirmar "não existe" — a base
        // que faltou poderia ser justamente a que conhece o identificador.
        vi.mocked(crossref.consultarDoi).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(datacite.consultarDoiDataCite).mockResolvedValue(NAO_VERIFICADA)
        vi.mocked(openalex.consultarDoiOpenAlex).mockResolvedValue(NAO_ENCONTRADA)
        const r = await verificarIdentificador('doi', '10.1/x')
        expect(r.status).toBe('nao_verificada')
    })
})

describe('verificarIdentificador — encadeamento de PMID', () => {
    it('PubMed reconhece -> não consulta Europe PMC', async () => {
        vi.mocked(pubmed.consultarPmid).mockResolvedValue(VALIDA('do PubMed'))
        const r = await verificarIdentificador('pmid', '123')
        expect(r.titulo).toBe('do PubMed')
        expect(europepmc.consultarPmidEuropePmc).not.toHaveBeenCalled()
    })

    it('PubMed nega, Europe PMC reconhece -> usa Europe PMC', async () => {
        vi.mocked(pubmed.consultarPmid).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(europepmc.consultarPmidEuropePmc).mockResolvedValue(VALIDA('do Europe PMC'))
        const r = await verificarIdentificador('pmid', '123')
        expect(r.titulo).toBe('do Europe PMC')
    })

    it('as duas negam -> nao_encontrada', async () => {
        vi.mocked(pubmed.consultarPmid).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(europepmc.consultarPmidEuropePmc).mockResolvedValue(NAO_ENCONTRADA)
        const r = await verificarIdentificador('pmid', '123')
        expect(r.status).toBe('nao_encontrada')
    })

    it('PMID nunca consulta as bases de DOI', async () => {
        vi.mocked(pubmed.consultarPmid).mockResolvedValue(VALIDA('x'))
        await verificarIdentificador('pmid', '123')
        expect(crossref.consultarDoi).not.toHaveBeenCalled()
        expect(datacite.consultarDoiDataCite).not.toHaveBeenCalled()
    })
})

describe('verificarIdentificador — cache', () => {
    it('resultado válido é cacheado: segunda chamada não consulta de novo', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(VALIDA('x'))
        await verificarIdentificador('doi', '10.1/x')
        await verificarIdentificador('doi', '10.1/x')
        expect(crossref.consultarDoi).toHaveBeenCalledTimes(1)
        expect(tamanhoCache()).toBe(1)
    })

    it('nao_encontrada é cacheado', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(datacite.consultarDoiDataCite).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(openalex.consultarDoiOpenAlex).mockResolvedValue(NAO_ENCONTRADA)
        await verificarIdentificador('doi', '10.1/x')
        await verificarIdentificador('doi', '10.1/x')
        expect(crossref.consultarDoi).toHaveBeenCalledTimes(1)
    })

    it('nao_verificada NUNCA é cacheado: nova tentativa consulta de novo', async () => {
        // Congelar uma falha temporária de rede penalizaria o lote inteiro
        // por uma instabilidade momentânea.
        vi.mocked(crossref.consultarDoi).mockResolvedValue(NAO_ENCONTRADA)
        vi.mocked(datacite.consultarDoiDataCite).mockResolvedValue(NAO_VERIFICADA)
        vi.mocked(openalex.consultarDoiOpenAlex).mockResolvedValue(NAO_ENCONTRADA)
        await verificarIdentificador('doi', '10.1/x')
        await verificarIdentificador('doi', '10.1/x')
        expect(crossref.consultarDoi).toHaveBeenCalledTimes(2)
    })

    it('DOI é normalizado para minúsculo na chave do cache', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(VALIDA('x'))
        await verificarIdentificador('doi', '10.1/ABC')
        await verificarIdentificador('doi', '10.1/abc')
        expect(crossref.consultarDoi).toHaveBeenCalledTimes(1)
    })

    it('DOI e PMID com o mesmo texto não colidem na chave do cache', async () => {
        vi.mocked(crossref.consultarDoi).mockResolvedValue(VALIDA('doi'))
        vi.mocked(pubmed.consultarPmid).mockResolvedValue(VALIDA('pmid'))
        await verificarIdentificador('doi', '123')
        await verificarIdentificador('pmid', '123')
        expect(tamanhoCache()).toBe(2)
    })
})
