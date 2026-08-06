import JSZip from 'jszip'
import {XMLParser} from 'fast-xml-parser'
import type { Documento} from '../models'

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix:true
})

export async function lerDocx(nome: string, dados: ArrayBuffer): Promise<Documento>{
    const errosLeitura: string[] = []
    const metadados: Record<string,  unknown> = {}

    const zip = await JSZip.loadAsync(dados)

    async function lerEntrada(caminho:string): Promise<string | null>{
        const arquivo = zip.file(caminho)
        if (!arquivo) {
            errosLeitura.push(`Entrada ausente do .docx: ${caminho}`)
            return null
        }
        return arquivo.async('string')
    }

    const coreXml = await lerEntrada('docProps/core.xml')
    if (coreXml) {
        const core = parser.parse(coreXml)?.coreProperties ?? {}
        metadados.creator = textoDe(core.creator)
        metadados.lastModifiedBy = textoDe(core.lastModifiedBy)
        metadados.created = textoDe(core.created)
        metadados.modified = textoDe(core.modified)
        metadados.revision = textoDe(core.revision)
    }

    const appXml = await lerEntrada('docProps/app.xml')
    if (appXml) {
        const app = parser.parse(appXml)?.Properties ?? {}
        metadados.TotalTime = textoDe(app.TotalTime)
        metadados.Pages = textoDe(app.Pages)
        metadados.Words = textoDe(app.Words)
        metadados.Characters = textoDe(app.Characters)
        metadados.Application = textoDe(app.Application)
        metadados.Company = textoDe(app.Company)
    }

    const settingsXml = await lerEntrada('word/settings.xml')
    if (settingsXml) {
        const achados = [...settingsXml.matchAll(/<w:rsid\b[^>]*w:val="([0-9A-Fa-f]+)"/g)]
        const distintos = new Set(achados.map((m)=>m[1]))
        metadados.rsidsDistintos = distintos.size
    }


    const docXml = await lerEntrada('word/document.xml')
    const texto = docXml ? extrairTexto(docXml) : ''

    if (docXml) {
        metadados.fontesUsadas = extrairFontes(docXml)
    }

    return { nome, formato: 'docx', texto, metadados, errosLeitura }

}

function textoDe(valor: unknown): string | undefined {
    if (valor === undefined || valor === null) return undefined
    if (typeof valor === 'object') {
        const t = (valor as Record<string, unknown>)['#text']
        return t === undefined ? undefined : String(t)
    }
    return String(valor)
}

function extrairTexto(documentXml: string): string {
    return documentXml
        .split('</w:p>')
        .map((paragrafo) =>
            [...paragrafo.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
                .map((m) => m[1])
                .join(''),
        )
        .filter((linha) => linha.length > 0)
        .join('\n')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
}

function extrairFontes(documentXml: string): string[] {
    return [...documentXml.matchAll(/<w:rFonts\b[^>]*w:ascii="([^"]+)"/g)]
        .map((m) => m[1])
}
