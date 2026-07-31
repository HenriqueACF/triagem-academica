import JSZip from 'jszip'
import type { ResultadoTriagem } from '../models.ts'
import { gerarRelatorioHtml } from './html.ts'
import { gerarCsv } from './csv.ts'

function nomeSeguro(nome: string): string {
    return (nome.split('/').pop() ?? nome)
        .replace(/\.(docx|pdf)$/i, '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .slice(0, 120)
}

export async function gerarZip(resultados: ResultadoTriagem[]): Promise<Blob> {
    const zip = new JSZip()
    const pasta = zip.folder('relatorios')

    const usados = new Set<string>()

    for (const r of resultados) {
        let nome = nomeSeguro(r.doc.nome)
        let sufixo = 2
        while (usados.has(nome)) {
            nome = `${nomeSeguro(r.doc.nome)} (${sufixo})`
            sufixo++
        }
        usados.add(nome)

        const html = gerarRelatorioHtml(r.doc, r.flags, r.referencias, r.inventario)
        pasta?.file(`${nome}.triagem.html`, html)
    }

    zip.file('triagem-consolidado.csv', gerarCsv(resultados))

    return zip.generateAsync({ type: 'blob' })
}
