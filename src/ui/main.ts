import { lerDocumento } from '../core/readers'
import { analisarMetadados } from '../core/analyzers/metadata.ts'
import { gerarRelatorioHtml } from '../core/report/html.ts'

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

        const flags = await analisarMetadados(doc)

        if (flags.length === 0) {
            saida.textContent = 'Nenhuma sinalização de metadados.'
        } else {
            saida.textContent = flags
                .map((f) => `[${f.severidade}] ${f.titulo}\n    ${f.evidencia}`)
                .join('\n\n')
        }

        const html = gerarRelatorioHtml(doc, flags)
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
