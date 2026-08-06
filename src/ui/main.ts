import './styles.css'
import type { Flag, ResultadoTriagem, Severidade } from '../core/models.ts'
import { ehArquivoSuportado, processarLote } from '../core/batch.ts'
import { gerarRelatorioHtml } from '../core/report/html.ts'
import { gerarCsv } from '../core/report/csv.ts'
import { gerarZip } from '../core/report/zip.ts'
import { histogramasDoLote, textoDaMetricaDoDocumento } from './histograma.ts'
import { CONFIG } from '../core/config.ts'

const ORDEM: Severidade[] = ['ALTA', 'MEDIA', 'BAIXA', 'INFO']
const ROTULO: Record<Severidade, string> = {
    ALTA: 'ALTA', MEDIA: 'MÉDIA', BAIXA: 'BAIXA', INFO: 'INFO',
}
const CLASSE: Record<Severidade, string> = {
    ALTA: 'alta', MEDIA: 'media', BAIXA: 'baixa', INFO: 'info',
}

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `<main>
<h1>Triagem Acadêmica</h1>
<p class="lead">Reúne evidências verificáveis sobre trabalhos acadêmicos para que você as interprete.
Não calcula score, não conclui autoria e não detecta IA.</p>

<div class="privacidade">
  <span>🔒</span>
  <span>
    <strong>Nada é enviado para lugar nenhum.</strong>
    Os documentos são lidos e analisados dentro do seu navegador. Ao escolher uma pasta,
    o navegador pode perguntar se você deseja <em>“enviar”</em> os arquivos — é o texto padrão
    dele para permitir a leitura; nenhum upload acontece. Apenas identificadores de referência
    (DOI/PMID), quando existirem, são consultados em bases públicas.
  </span>
</div>

<div class="zona" id="zona">
  <p>Arraste aqui a pasta com os trabalhos, ou escolha abaixo</p>
  <div class="escolhas">
    <label class="botao primario">Selecionar pasta
      <input type="file" id="pasta" webkitdirectory multiple hidden />
    </label>
    <label class="botao">Selecionar arquivos
      <input type="file" id="arquivos" accept=".docx,.pdf" multiple hidden />
    </label>
  </div>
  <p class="dica">Aceita .docx e .pdf · subpastas são incluídas · arquivos temporários do Word são ignorados</p>
</div>

<div class="progresso oculto" id="progresso">
  <div class="barra"><div id="preenchimento"></div></div>
  <p class="andamento" id="andamento"></p>
</div>

<div class="resumo oculto" id="resumo"></div>

<div class="acoes oculto" id="acoes">
  <button class="botao primario" id="baixar-zip">Baixar tudo (.zip)</button>
  <button class="botao" id="baixar-csv">Baixar planilha (.csv)</button>
  <input class="filtro" id="filtro" type="search" placeholder="Filtrar por nome do arquivo" />
</div>

<div class="tabela-wrap oculto" id="tabela-wrap"></div>

<div class="oculto" id="distribuicao"></div>

<div class="aviso">
  Este relatório não conclui autoria e não constitui prova de uso de IA. Cada sinalização deve ser
  verificada manualmente antes de qualquer decisão acadêmica. Recomenda-se conversa com o(a)
  discente antes de qualquer procedimento formal.
</div>

<footer class="rodape">Triagem Acadêmica · v${CONFIG.versao}</footer>
</main>`

const zona = el<HTMLDivElement>('#zona')
const inputPasta = el<HTMLInputElement>('#pasta')
const inputArquivos = el<HTMLInputElement>('#arquivos')
const progresso = el<HTMLDivElement>('#progresso')
const preenchimento = el<HTMLDivElement>('#preenchimento')
const andamento = el<HTMLParagraphElement>('#andamento')
const resumo = el<HTMLDivElement>('#resumo')
const acoes = el<HTMLDivElement>('#acoes')
const tabelaWrap = el<HTMLDivElement>('#tabela-wrap')
const filtro = el<HTMLInputElement>('#filtro')
const distribuicao = el<HTMLDivElement>('#distribuicao')
const botaoZip = el<HTMLButtonElement>('#baixar-zip')
const botaoCsv = el<HTMLButtonElement>('#baixar-csv')

function el<T extends Element>(seletor: string): T {
    return document.querySelector<T>(seletor)!
}

let triagens: ResultadoTriagem[] = []
let processando = false

inputPasta.addEventListener('change', () => {
    if (inputPasta.files) analisar([...inputPasta.files])
})
inputArquivos.addEventListener('change', () => {
    if (inputArquivos.files) analisar([...inputArquivos.files])
})

zona.addEventListener('dragover', (e) => {
    e.preventDefault()
    zona.classList.add('ativa')
})
zona.addEventListener('dragleave', () => zona.classList.remove('ativa'))
zona.addEventListener('drop', async (e) => {
    e.preventDefault()
    zona.classList.remove('ativa')
    if (!e.dataTransfer || processando) return
    analisar(await arquivosDoDrop(e.dataTransfer))
})

async function arquivosDoDrop(dt: DataTransfer): Promise<File[]> {
    const raizes = [...dt.items]
        .map((item) => item.webkitGetAsEntry())
        .filter((entrada): entrada is FileSystemEntry => entrada !== null)

    if (raizes.length === 0) return [...dt.files]

    const encontrados: File[] = []

    async function percorrer(entrada: FileSystemEntry): Promise<void> {
        if (entrada.isFile) {
            const arquivo = await new Promise<File>((ok, falhou) =>
                (entrada as FileSystemFileEntry).file(ok, falhou))
            encontrados.push(arquivo)
            return
        }
        if (entrada.isDirectory) {
            const leitor = (entrada as FileSystemDirectoryEntry).createReader()
            let lote: FileSystemEntry[]
            do {
                lote = await new Promise<FileSystemEntry[]>((ok, falhou) =>
                    leitor.readEntries(ok, falhou))
                for (const filho of lote) await percorrer(filho)
            } while (lote.length > 0)
        }
    }

    for (const raiz of raizes) await percorrer(raiz)
    return encontrados
}


async function analisar(lista: File[]): Promise<void> {
    if (processando) return

    const arquivos = lista.filter((f) => ehArquivoSuportado(f.name))

    tabelaWrap.classList.add('oculto')
    resumo.classList.add('oculto')
    acoes.classList.add('oculto')
    distribuicao.classList.add('oculto')

    if (arquivos.length === 0) {
        progresso.classList.remove('oculto')
        preenchimento.style.width = '0'
        andamento.textContent = lista.length > 0
            ? `Nenhum .docx ou .pdf entre os ${lista.length} itens selecionados.`
            : 'Nenhum arquivo selecionado.'
        return
    }

    processando = true
    progresso.classList.remove('oculto')
    preenchimento.style.width = '0'
    andamento.textContent = `Lendo ${arquivos.length} arquivo(s)...`

    const carregados = []
    for (const f of arquivos) {
        carregados.push({ nome: f.name, dados: await f.arrayBuffer() })
    }

    triagens = await processarLote(carregados, (concluidos, total, nome) => {
        preenchimento.style.width = `${(concluidos / total) * 100}%`
        andamento.textContent = nome
            ? `Analisando ${concluidos + 1} de ${total} — ${nome}`
            : `${total} arquivo(s) analisado(s).`
    })

    processando = false
    mostrarResumo()
    mostrarTabela()
    mostrarDistribuicao()
    acoes.classList.remove('oculto')
}

function contar(flags: Flag[], sev: Severidade): number {
    return flags.filter((f) => f.severidade === sev).length
}

function ordenar(lista: ResultadoTriagem[]): ResultadoTriagem[] {
    return [...lista].sort((a, b) => {
        for (const sev of ORDEM) {
            const diferenca = contar(b.flags, sev) - contar(a.flags, sev)
            if (diferenca !== 0) return diferenca
        }
        return a.doc.nome.localeCompare(b.doc.nome)
    })
}

function mostrarResumo(): void {
    const cartoes = ORDEM.map((sev) => {
        const n = triagens.reduce((s, r) => s + contar(r.flags, sev), 0)
        return `<div class="cartao ${CLASSE[sev]}">
            <div class="n">${n}</div><div class="r">${ROTULO[sev]}</div>
        </div>`
    }).join('')

    const comSinalizacao = triagens.filter((r) => r.flags.length > 0).length

    resumo.innerHTML = `<div class="cartao">
        <div class="n">${triagens.length}</div>
        <div class="r">arquivo(s)</div>
    </div>${cartoes}<div class="cartao">
        <div class="n">${comSinalizacao}</div>
        <div class="r">a revisar</div>
    </div>`
    resumo.classList.remove('oculto')
}

function mostrarTabela(): void {
    const termo = normalizarBusca(filtro.value)
    const visiveis = ordenar(triagens)
        .filter((r) => termo === '' || normalizarBusca(r.doc.nome).includes(termo))

    if (visiveis.length === 0) {
        tabelaWrap.innerHTML = '<p style="padding:1rem;color:#666;font-size:.87rem">Nenhum arquivo corresponde ao filtro.</p>'
        tabelaWrap.classList.remove('oculto')
        return
    }

    tabelaWrap.innerHTML = `<table>
      <thead><tr>
        <th>Arquivo</th><th>Alta</th><th>Média</th><th>Baixa</th><th>Info</th>
        <th>Edição</th><th>Rev.</th><th>Palavras</th><th>Citações</th><th></th>
      </tr></thead>
      <tbody>${visiveis.map((r, i) => linhaDe(r, i)).join('')}</tbody>
    </table>`

    tabelaWrap.querySelectorAll<HTMLTableRowElement>('tr.linha').forEach((linha) => {
        linha.addEventListener('click', (evento) => {
            if ((evento.target as HTMLElement).tagName === 'BUTTON') return
            linha.classList.toggle('aberta')
            const detalhe = linha.nextElementSibling
            detalhe?.classList.toggle('oculto')
        })
    })

    tabelaWrap.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const r = visiveis[Number(botao.dataset.i)]
            const html = gerarRelatorioHtml(r.doc, r.flags, r.referencias, r.inventario)
            window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank')
        })
    })

    tabelaWrap.classList.remove('oculto')
}

function linhaDe(r: ResultadoTriagem, i: number): string {
    const m = textoDaMetricaDoDocumento(r)
    const numeros = ORDEM.map((sev) => {
        const n = contar(r.flags, sev)
        return `<td class="num ${n > 0 ? CLASSE[sev] : 'zero'}">${n}</td>`
    }).join('')

    return `<tr class="linha">
        <td><span class="arquivo">
            <span class="seta">▶</span>
            <span>${escapar(r.doc.nome)}</span>
            <span class="formato">${r.doc.formato}</span>
        </span></td>
        ${numeros}
        <td class="ctx">${m.tempo}</td>
        <td class="ctx">${m.revisoes}</td>
        <td class="ctx">${m.palavras}</td>
        <td class="ctx">${m.citacoes}</td>
        <td><button data-i="${i}">ver relatório</button></td>
    </tr>
    <tr class="detalhe oculto"><td colspan="10">${detalheDe(r)}</td></tr>`
}

function detalheDe(r: ResultadoTriagem): string {
    const erros = r.doc.errosLeitura.length > 0
        ? `<p class="erro-leitura">Erros de leitura: ${escapar(r.doc.errosLeitura.join(' · '))}</p>`
        : ''

    if (r.flags.length === 0) {
        return `${erros}<p class="sem-flag">Nenhuma sinalização. Isso não atesta a autoria do
                trabalho — significa apenas que nenhuma das verificações encontrou o que procura.</p>`
    }

    const flags = ORDEM.flatMap((sev) => r.flags.filter((f) => f.severidade === sev))
        .map((f) => `<div class="flag">
            <span class="tag ${CLASSE[f.severidade]}">${ROTULO[f.severidade]}</span>
            <div>
                <div class="titulo">${escapar(f.titulo)}</div>
                <div class="evidencia">${escapar(f.evidencia)}</div>
                ${f.detalhe ? `<div class="obs">${escapar(f.detalhe)}</div>` : ''}
            </div>
        </div>`).join('')

    return erros + flags
}

filtro.addEventListener('input', () => mostrarTabela())

botaoZip.addEventListener('click', async () => {
    botaoZip.disabled = true
    const rotulo = botaoZip.textContent
    botaoZip.textContent = 'Montando...'
    try {
        baixar(await gerarZip(ordenar(triagens)), 'triagem-academica.zip')
    } finally {
        botaoZip.disabled = false
        botaoZip.textContent = rotulo
    }
})

botaoCsv.addEventListener('click', () => {
    const csv = gerarCsv(triagens)
    baixar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'triagem-consolidado.csv')
})

function mostrarDistribuicao(): void {
    const html = histogramasDoLote(triagens)
    distribuicao.innerHTML = html
    distribuicao.classList.toggle('oculto', html === '')
}

function baixar(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    a.click()
    URL.revokeObjectURL(url)
}


function normalizarBusca(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function escapar(texto: string): string {
    return texto
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}
