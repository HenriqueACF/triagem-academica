import { lerDocumento } from '../core/readers'
import { analisarMetadados } from '../core/analyzers/metadata.ts'
import { gerarRelatorioHtml } from '../core/report/html.ts'
import { analisarReferencias, levantarReferencias } from '../core/analyzers/references.ts'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `<main>
<h1>Triagem Acadêmica</h1>
<p>Selecione um arquivo .docx para analisar os metadados.</p>
<input type="file" id="arquivo" accept=".docx"/>
<div id="acoes"></div>
<pre id="saida"></pre>
</main>`

const input = document.querySelector<HTMLInputElement>('#arquivo')!
const saida = document.querySelector<HTMLPreElement>('#saida')!
const acoes = document.querySelector<HTMLDivElement>('#acoes')!

input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return

    saida.textContent = 'Lendo...'
    acoes.innerHTML = ''

    try {
        const dados = await file.arrayBuffer()
        const doc = await lerDocumento(file.name, dados)
        // console.log('TEXTO EXTRAÍDO:\n' + doc.texto.slice(0, 800))
        // console.log('FINAL DO TEXTO:\n' + doc.texto.slice(-2000))
        // console.log([...doc.texto.matchAll(/refer[êe]ncias?/gi)].map((m) => m.index + ' → ...' + doc.texto.slice(Math.max(0, m.index - 50), m.index + 70) + '...'))
        // const { extrairIdentificadores } = await import('../core/analyzers/references.ts')
        // console.log('IDs no documento real:', extrairIdentificadores(doc.texto))
        // console.log('IDs num texto de teste:', extrairIdentificadores('Ver doi:10.1038/nature12373. Também PMID: 23845944 e de novo 10.1038/nature12373.'))
        // console.log('METADADOS:', doc.metadados)
        // const { analisarReferencias } = await import('../core/analyzers/references.ts')
        // console.log('FLAGS de referências (doc real):', await analisarReferencias(doc))
        // console.log('TESTE com DOI falso:', await analisarReferencias({ ...doc, texto: 'Conforme 10.9999/naoexiste e também 10.1038/nature12373.' }))

        // const flags = await analisarMetadados(doc)
        const referencias = await levantarReferencias(doc)
        const flags = [
            ...(await analisarMetadados(doc)),
            ...(await analisarReferencias(doc))
        ]
        // console.log('inventário:', referencias)
        if (flags.length === 0) {
            saida.textContent = 'Nenhuma sinalização.'
        } else {
            saida.textContent = flags
                .map((f) => `[${f.severidade}] ${f.titulo}\n    ${f.evidencia}`)
                .join('\n\n')
        }

        const html = gerarRelatorioHtml(doc, flags, referencias)
        const botao = document.createElement('button')
        botao.textContent = 'Baixar relatório .html'
        botao.addEventListener('click', () => baixar(html, file.name))
        acoes.appendChild(botao)
    } catch (erro) {
        saida.textContent = 'Erro ao ler o arquivo:\n' + (erro as Error).message
    }
})

function baixar(html: string, nomeArquivo: string): void {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo.replace(/\.docx$/i, '') + '.triagem.html'
    a.click()
    URL.revokeObjectURL(url)
}
