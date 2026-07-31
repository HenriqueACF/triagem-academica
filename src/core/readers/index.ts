import type {Documento} from '../models.ts'
import {lerDocx} from './docx.ts'
import {lerPdf} from './pdf.ts'

export async function lerDocumento(nome: string,  dados:ArrayBuffer): Promise<Documento> {
    const extensao = nome.toLowerCase().split('.').pop()
    if (extensao==='docx') return lerDocx(nome, dados)
    if (extensao==='pdf') return lerPdf(nome, dados)
    throw new Error(`Formato ainda não suportado: ${extensao}`)
}
