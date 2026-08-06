import type { Documento, Flag, Inventario, Referencia, ResultadoTriagem } from './models.ts'
import { lerDocumento } from './readers/index.ts'
import { analisarMetadados } from './analyzers/metadata.ts'
import { analisarReferencias, levantarReferencias } from './analyzers/references.ts'
import { analisarInventario, levantarInventario } from './analyzers/inventory.ts'

const INVENTARIO_VAZIO: Inventario = {
    citacoes: [],
    numericas: [],
    lista: { encontrada: false, entradas: [] },
    ocorrencias: [],
}
import { analisarArtefatos } from './analyzers/artifacts.ts'
import {analisarFontes} from "./analyzers/fonts.ts";
import {analisarIdioma} from "./analyzers/language.ts";

export function ehArquivoSuportado(nome: string): boolean {
    const base = nome.split('/').pop() ?? nome
    if (base.startsWith('~$') || base.startsWith('.')) return false
    return /\.(docx|pdf)$/i.test(base)
}

function documentoComErro(nome: string, erro: unknown): Documento {
    return {
        nome,
        formato: nome.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx',
        texto: '',
        metadados: {},
        errosLeitura: [`Falha ao abrir o arquivo: ${(erro as Error).message}`],
    }
}

async function rodarAnalisador(
    nome: string,
    executar: () => Promise<Flag[]>,
): Promise<Flag[]> {
    try {
        return await executar()
    } catch (erro) {
        return [{
            modulo: nome,
            severidade: 'INFO',
            titulo: `Falha interna no módulo "${nome}"`,
            evidencia: `${(erro as Error).message}`,
            detalhe: 'As demais análises do documento seguem válidas.',
        }]
    }
}

export async function processarArquivo(nome: string, dados: ArrayBuffer): Promise<ResultadoTriagem> {
    let doc: Documento
    try {
        doc = await lerDocumento(nome, dados)
    } catch (erro) {
        return {
            doc: documentoComErro(nome, erro),
            flags: [],
            referencias: [],
            inventario: INVENTARIO_VAZIO,
        }
    }

    let referencias: Referencia[] = []
    try {
        referencias = await levantarReferencias(doc)
    } catch {
        referencias = []
    }

    let inventario: Inventario = INVENTARIO_VAZIO
    try {
        inventario = levantarInventario(doc)
    } catch {
        inventario = INVENTARIO_VAZIO
    }

    const flags = [
        ...(await rodarAnalisador('metadados', () => analisarMetadados(doc))),
        ...(await rodarAnalisador('referencias', () => analisarReferencias(doc))),
        ...(await rodarAnalisador('inventario', () => analisarInventario(doc))),
        ...(await rodarAnalisador('artefatos', () => analisarArtefatos(doc))),
        ...(await rodarAnalisador('fontes', () => analisarFontes(doc))),
        ...(await rodarAnalisador('idioma', () => analisarIdioma(doc))),

    ]

    return { doc, flags, referencias, inventario }
}

export interface ArquivoDoLote {
    nome: string
    dados: ArrayBuffer
}

export async function processarLote(
    arquivos: ArquivoDoLote[],
    aoProgredir?: (concluidos: number, total: number, nome: string) => void,
): Promise<ResultadoTriagem[]> {
    const resultados: ResultadoTriagem[] = []

    for (const arquivo of arquivos) {
        aoProgredir?.(resultados.length, arquivos.length, arquivo.nome)
        await new Promise((seguir) => setTimeout(seguir, 0))
        resultados.push(await processarArquivo(arquivo.nome, arquivo.dados))
    }

    aoProgredir?.(resultados.length, arquivos.length, '')
    return resultados
}
