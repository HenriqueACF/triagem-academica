import {lerDocumento} from "../core/readers";

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `<main>
<h1>Triagem Acadêmica</h1>
<p>Selecione um arquivo .docx para inspecionar os metadados.</p>
<input type="file" id="arquivo" accept=".docx"/>
<pre id="saida"></pre>
</main>`

const input = document.querySelector<HTMLInputElement>('#arquivo')!
const saida = document.querySelector<HTMLPreElement>('#saida')!

input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return

    saida.textContent = 'Lendo...'
    try {
        // A ponte navegador → core: extrai os bytes crus do arquivo.
        const dados = await file.arrayBuffer()
        const doc = await lerDocumento(file.name, dados)

        // Monta um resumo legível (o texto completo pode ser enorme).
        const resumo = {
            nome: doc.nome,
            formato: doc.formato,
            metadados: doc.metadados,
            errosLeitura: doc.errosLeitura,
            tamanhoDoTexto: doc.texto.length,
            trechoDoTexto: doc.texto.slice(0, 300),
        }
        saida.textContent = JSON.stringify(resumo, null, 2)
    } catch (erro) {
        saida.textContent = 'Erro ao ler o arquivo:\n' + (erro as Error).message
    }
})
