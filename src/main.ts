const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <main>
    <h1>Triagem Acadêmica</h1>
    <p>Selecione um arquivo .docx para inspecionar os metadados.</p>
    <input type="file" id="arquivo" accept=".docx" />
    <pre id="saida"></pre>
  </main>
`
