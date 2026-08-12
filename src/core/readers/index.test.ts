import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lerDocumento } from './index.ts'
import * as docx from './docx.ts'
import * as pdf from './pdf.ts'
import type { Documento } from '../models.ts'

vi.mock('./docx.ts', () => ({ lerDocx: vi.fn() }))
vi.mock('./pdf.ts', () => ({ lerPdf: vi.fn() }))

const docFalso: Documento = { nome: 'x', formato: 'docx', texto: '', metadados: {}, errosLeitura: [] }

beforeEach(() => {
    vi.mocked(docx.lerDocx).mockReset().mockResolvedValue(docFalso)
    vi.mocked(pdf.lerPdf).mockReset().mockResolvedValue(docFalso)
})

describe('lerDocumento — despacho por extensão', () => {
    it('.docx vai para lerDocx', async () => {
        await lerDocumento('trabalho.docx', new ArrayBuffer(0))
        expect(docx.lerDocx).toHaveBeenCalledWith('trabalho.docx', expect.anything())
        expect(pdf.lerPdf).not.toHaveBeenCalled()
    })

    it('.pdf vai para lerPdf', async () => {
        await lerDocumento('trabalho.pdf', new ArrayBuffer(0))
        expect(pdf.lerPdf).toHaveBeenCalled()
        expect(docx.lerDocx).not.toHaveBeenCalled()
    })

    it('extensão é insensível a maiúsculas/minúsculas', async () => {
        await lerDocumento('TRABALHO.DOCX', new ArrayBuffer(0))
        expect(docx.lerDocx).toHaveBeenCalled()
    })

    it('extensão não suportada lança erro específico', async () => {
        await expect(lerDocumento('trabalho.txt', new ArrayBuffer(0)))
            .rejects.toThrow('Formato ainda não suportado: txt')
    })
})
