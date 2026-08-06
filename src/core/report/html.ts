import type { Documento, Flag, Inventario, Severidade, Referencia } from '../models.ts'
import { faixaDeCitacoes, linhaDoTempo, textoComCitacoes } from './visuais.ts'

const INVENTARIO_VAZIO: Inventario = {
    citacoes: [],
    numericas: [],
    lista: { encontrada: false, entradas: [] },
    ocorrencias: [],
}
function escapar(texto: string): string {
    return texto
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

const ORDEM: Severidade[] = ['ALTA', 'MEDIA', 'BAIXA', 'INFO']

const ROTULO: Record<Severidade, string> = {
    ALTA: 'ALTA',
    MEDIA: 'MÉDIA',
    BAIXA: 'BAIXA',
    INFO: 'INFO',
}

const COR: Record<Severidade, string> = {
    ALTA: '#c0392b',
    MEDIA: '#d68910',
    BAIXA: '#7f8c8d',
    INFO: '#2980b9',
}

const ROTULO_STATUS: Record<Referencia['status'], string> = {
    valida: 'verificada',
    nao_encontrada: 'NÃO ENCONTRADA',
    divergente: 'divergente',
    sem_identificador: 'sem identificador',
    nao_verificada: 'não verificada',
}

const CAMPOS_FICHA: Array<[string, string]> = [
    ['creator', 'Criado por'],
    ['lastModifiedBy', 'Última modificação por'],
    ['created', 'Criado em'],
    ['modified', 'Modificado em'],
    ['revision', 'Revisões salvas'],
    ['TotalTime', 'Tempo de edição acumulado'],
    ['rsidsDistintos', 'Ciclos de edição (rsids)'],
    ['Words', 'Palavras'],
    ['Characters', 'Caracteres'],
    ['Pages', 'Páginas'],
    ['Application', 'Editor declarado'],
    ['Company', 'Organização'],
    ['Title', 'Título (metadado)'],
    ['PdfCreator', 'Criador (PDF)'],
    ['PdfProducer', 'Produtor (PDF)'],
]

function comoData(valor: unknown): Date | undefined {
    if (typeof valor !== 'string' || valor === '') return undefined
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? undefined : d
}

function formatarValor(campo: string, valor: unknown): string {
    if (campo === 'created' || campo === 'modified') {
        const d = comoData(valor)
        return d ? d.toLocaleString('pt-BR') : String(valor)
    }
    if (campo === 'TotalTime') {
        const min = Number(valor)
        if (!Number.isFinite(min)) return String(valor)
        if (min < 60) return `${min} min`
        return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
    }
    return String(valor)
}

function resumoDeEdicao(doc: Documento): string {
    const partes: string[] = []
    const criado = comoData(doc.metadados.created)
    const modificado = comoData(doc.metadados.modified)

    if (criado && modificado) {
        const dias = Math.round((modificado.getTime() - criado.getTime()) / 86400000)
        const intervalo = dias >= 1
            ? `ao longo de ${dias} dia${dias > 1 ? 's' : ''}`
            : 'no mesmo dia'
        partes.push(
            `Criado em ${criado.toLocaleDateString('pt-BR')} e modificado pela última vez ` +
            `em ${modificado.toLocaleDateString('pt-BR')} — ${intervalo}.`,
        )
    }

    const revisoes = Number(doc.metadados.revision)
    if (Number.isFinite(revisoes)) {
        partes.push(`${revisoes} revis${revisoes === 1 ? 'ão salva' : 'ões salvas'}.`)
    }

    const tempo = Number(doc.metadados.TotalTime)
    if (Number.isFinite(tempo)) {
        partes.push(`${formatarValor('TotalTime', tempo)} de edição acumulada.`)
    }

    const rsids = Number(doc.metadados.rsidsDistintos)
    if (Number.isFinite(rsids)) {
        partes.push(`${rsids} ciclos de edição registrados.`)
    }

    if (partes.length === 0) {
        return 'O documento não traz metadados de edição — comum em PDF e em arquivos convertidos.'
    }
    return partes.join(' ')
}

const AVISO_LEGAL =
    'Este relatório não conclui autoria e não constitui prova de uso de IA. ' +
    'Cada sinalização deve ser verificada manualmente antes de qualquer decisão ' +
    'acadêmica. Recomenda-se conversa com o(a) discente antes de qualquer ' +
    'procedimento formal.'

export function gerarRelatorioHtml(
    doc: Documento,
    flags: Flag[],
    referencias: Referencia[] = [],
    inventarioCitacoes: Inventario = INVENTARIO_VAZIO,
): string {
    const contagem: Record<Severidade, number> = { ALTA: 0, MEDIA: 0, BAIXA: 0, INFO: 0 }
    for (const f of flags) contagem[f.severidade]++

    const painel = ORDEM.map((sev) => `
        <div class="caixa" style="border-color:${COR[sev]}">
            <div class="numero" style="color:${COR[sev]}">${contagem[sev]}</div>
            <div class="rotulo">${ROTULO[sev]}</div>
        </div>`).join('')

    const flagsOrdenadas = [...flags].sort(
        (a, b) => ORDEM.indexOf(a.severidade) - ORDEM.indexOf(b.severidade),
    )

    const lista = flagsOrdenadas.length === 0
        ? '<p class="vazio">Nenhuma sinalização.</p>'
        : flagsOrdenadas.map((f) => `
        <div class="flag">
            <span class="tag" style="background:${COR[f.severidade]}">${ROTULO[f.severidade]}</span>
            <div class="corpo">
                <div class="titulo">${escapar(f.titulo)}</div>
                <div class="evidencia">${escapar(f.evidencia)}</div>
                ${f.detalhe ? `<div class="detalhe">${escapar(f.detalhe)}</div>` : ''}
            </div>
        </div>`).join('')

    const anos = referencias
        .map((r) => r.anoPublicacao)
        .filter((a): a is number => typeof a === 'number')
        .sort((a, b) => a - b)

    const resumoAnos = anos.length === 0 ? '' : (() => {
        const mediana = anos.length % 2 === 1
            ? anos[(anos.length - 1) / 2]
            : Math.round((anos[anos.length / 2 - 1] + anos[anos.length / 2]) / 2)
        return `<p class="resumo-edicao">${anos.length} referência${anos.length > 1 ? 's' : ''} com ano
            de publicação confirmado pela base: entre ${anos[0]} e ${anos[anos.length - 1]},
            mediana ${mediana}. O que é "atual" varia por área — este dado não é uma sinalização.</p>`
    })()

    const inventario = referencias.length === 0
        ? `<p class="vazio">Nenhum identificador (DOI/PMID) foi encontrado no documento.
           Isso é comum em trabalhos que seguem ABNT autor-data e não constitui indício de nada.</p>`
        : `${resumoAnos}<div class="tabela-wrap"><table>
        <thead><tr><th>#</th><th>Identificador</th><th>Situação</th><th>Ano</th><th>Título retornado pela base</th><th>Ocorrências</th></tr></thead>
        <tbody>${referencias.map((r) => `<tr>
            <td>${r.indice}</td>
            <td>${escapar(r.doi ?? r.pmid ?? '—')}</td>
            <td>${ROTULO_STATUS[r.status]}</td>
            <td>${r.anoPublicacao ?? '—'}</td>
            <td>${escapar(r.tituloRetornado ?? '—')}</td>
            <td>${r.ocorrenciasNoCorpo}</td>
        </tr>`).join('')}</tbody>
        </table></div>`

    const { citacoes, numericas, lista: listaRef } = inventarioCitacoes
    const chavesListadas = new Set(listaRef.entradas.map((e) => e.chave))
    const chavesCitadas = new Set(citacoes.map((c) => c.chave))
    const numerosCitados = new Set(numericas.map((n) => n.numero))

    function situacaoDaCitacao(chave: string): string {
        if (!listaRef.encontrada) return '<span class="cinza">sem lista para conferir</span>'
        if (chavesListadas.has(chave)) return '<span class="ok">consta na lista</span>'
        return '<span class="alerta">não consta na lista</span>'
    }

    const tabelaCitacoes = citacoes.length === 0
        ? '<p class="vazio">Nenhuma citação no formato “(Autor, ano)” foi encontrada.</p>'
        : `<div class="tabela-wrap"><table>
        <thead><tr><th>#</th><th>Citação</th><th>Forma</th><th>Ocorrências</th><th>Situação</th></tr></thead>
        <tbody>${[...citacoes]
            .sort((a, b) => a.chave.localeCompare(b.chave))
            .map((c, i) => `<tr>
            <td>${i + 1}</td>
            <td>${escapar(c.textoOriginal)}
                ${c.contexto ? `<div class="contexto">${escapar(c.contexto)}</div>` : ''}</td>
            <td>${c.narrativa ? 'narrativa' : 'parentética'}</td>
            <td>${c.ocorrencias}</td>
            <td>${situacaoDaCitacao(c.chave)}</td>
        </tr>`).join('')}</tbody>
        </table></div>`

    const tabelaNumericas = numericas.length === 0
        ? ''
        : `<h3>Citações numéricas</h3>
        <div class="tabela-wrap"><table>
        <thead><tr><th>Número</th><th>Ocorrências</th><th>Situação</th></tr></thead>
        <tbody>${numericas.map((n) => `<tr>
            <td>[${n.numero}]</td>
            <td>${n.ocorrencias}</td>
            <td>${!listaRef.encontrada
                ? '<span class="cinza">sem lista para conferir</span>'
                : n.numero <= listaRef.entradas.length
                    ? '<span class="ok">há entrada #' + n.numero + '</span>'
                    : '<span class="alerta">a lista tem só ' + listaRef.entradas.length + ' entradas</span>'}</td>
        </tr>`).join('')}</tbody>
        </table></div>`

    const tabelaLista = !listaRef.encontrada
        ? `<p class="vazio">Nenhuma seção de referências foi localizada no documento.
           Ela pode estar em arquivo separado, ou o trabalho ainda não a possui.</p>`
        : `<div class="tabela-wrap"><table>
        <thead><tr><th>#</th><th>Entrada</th><th>Citada no corpo?</th></tr></thead>
        <tbody>${listaRef.entradas.map((e) => {
            const citada = chavesCitadas.has(e.chave) || numerosCitados.has(e.indice)
            return `<tr>
            <td>${e.indice}</td>
            <td>${escapar(e.textoOriginal)}</td>
            <td>${citada ? '<span class="ok">sim</span>' : '<span class="alerta">não localizada</span>'}</td>
        </tr>`
        }).join('')}</tbody>
        </table></div>`

    const linhasFicha = CAMPOS_FICHA
        .filter(([campo]) => {
            const v = doc.metadados[campo]
            return v !== undefined && v !== null && v !== ''
        })
        .map(([campo, rotulo]) => `<tr>
            <th class="rot">${rotulo}</th>
            <td>${escapar(formatarValor(campo, doc.metadados[campo]))}</td>
        </tr>`).join('')

    const ficha = linhasFicha === ''
        ? '<p class="vazio">O documento não expôs metadados legíveis.</p>'
        : `<p class="resumo-edicao">${escapar(resumoDeEdicao(doc))}</p>
           <div class="tabela-wrap"><table class="ficha"><tbody>${linhasFicha}</tbody></table></div>`

    const errosLeitura = doc.errosLeitura.length === 0
        ? ''
        : `<p class="erros">Avisos de leitura: ${escapar(doc.errosLeitura.join(' · '))}</p>`

    const visualTempo = linhaDoTempo(doc)
    const visualFaixa = faixaDeCitacoes(doc, inventarioCitacoes)
    const corpoDestacado = textoComCitacoes(doc, inventarioCitacoes)

    const geradoEm = new Date().toLocaleString('pt-BR')

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Triagem — ${escapar(doc.nome)}</title>
<style>
    body { font-family: system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
    .sub { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .painel { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
    .caixa { flex: 1; border: 2px solid; border-radius: 8px; padding: 0.75rem; text-align: center; }
    .numero { font-size: 1.8rem; font-weight: bold; }
    .rotulo { font-size: 0.75rem; letter-spacing: 0.05em; color: #555; }
    .flag { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-top: 1px solid #eee; }
    .tag { color: #fff; font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.5rem; border-radius: 4px; height: fit-content; }
    .titulo { font-weight: 600; }
    .evidencia { color: #333; font-size: 0.9rem; margin-top: 0.15rem; }
    .detalhe { color: #777; font-size: 0.8rem; margin-top: 0.15rem; }
    .vazio { color: #666; font-style: italic; }
    .aviso { margin-top: 2rem; padding: 0.85rem 1rem; background: #f7f7f7; border-left: 4px solid #999; font-size: 0.8rem; color: #555; }
   h2 { font-size: 1rem; margin-top: 2rem; margin-bottom: 0.3rem; }
    .tabela-wrap { overflow-x: auto; }
   table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
   th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #eee; vertical-align: top; }
   th { background: #f5f5f5; font-weight: 600; }
    h3 { font-size: 0.9rem; margin-top: 1.2rem; margin-bottom: 0.3rem; color: #444; }
    .nota { font-size: 0.8rem; color: #666; margin: 0.2rem 0 0.6rem; line-height: 1.45; }
    .ok { color: #2d7a2d; }
    .alerta { color: #c0392b; }
    .cinza { color: #999; }
    .visual { margin: 0.8rem 0 1.2rem; }
    .visual .eixo { display: flex; justify-content: space-between; font-size: 0.72rem; color: #999; margin-top: 0.15rem; }
    .legenda-visual { font-size: 0.78rem; color: #777; margin: 0.35rem 0 0; }
    .texto-corpo { font-size: 0.85rem; line-height: 1.65; color: #333; background: #fcfcfb;
                   border: 1px solid #eee; border-radius: 6px; padding: 0.9rem 1.1rem;
                   max-height: 30rem; overflow-y: auto; }
    mark.cit { background: #dbeafe; color: #17416f; padding: 0 0.15rem; border-radius: 3px; }
    mark.cit sup { font-size: 0.65em; color: #2a78d6; margin-left: 0.1rem; font-weight: 600; }
    .contexto { font-size: 0.78rem; color: #777; margin-top: 0.25rem;
                border-left: 2px solid #e0e0e0; padding-left: 0.5rem; max-width: 46ch; }
    .resumo-edicao { font-size: 0.9rem; color: #333; background: #f7f9fb;
                     border-left: 3px solid #2980b9; padding: 0.6rem 0.8rem; margin: 0.3rem 0 0.8rem; }
    table.ficha th.rot { width: 40%; background: #fafafa; font-weight: 500;
                         color: #555; font-size: 0.82rem; }
    .erros { color: #c0392b; font-size: 0.82rem; }
    @media print {
        body { max-width: none; }
        h2 { break-after: avoid; }
        tr, .flag { break-inside: avoid; }
        .painel { break-inside: avoid; }
    }
</style>
</head>
<body>
    <h1>Triagem Acadêmica</h1>
    <div class="sub">${escapar(doc.nome)} · gerado em ${escapar(geradoEm)}</div>
    <div class="painel">${painel}</div>
    ${errosLeitura}

    <h2>Ficha do documento</h2>
    ${ficha}
    ${visualTempo}

    <h2>Sinalizações</h2>
    ${lista}

    <h2>Citações encontradas no corpo do texto</h2>
    <p class="nota">Lista bruta do que foi identificado. “Parentética” é a forma “(Autor, ano)”;
    “narrativa” é “Segundo Autor (ano)”, reconhecida por aproximação e portanto menos precisa.
    Divergências de grafia entre a citação e a lista aparecem aqui como “não consta”, sem que
    haja necessariamente qualquer problema.</p>
    ${visualFaixa}
    ${tabelaCitacoes}
    ${tabelaNumericas}

    <h2>Lista de referências do trabalho</h2>
    ${tabelaLista}

    <h2>Identificadores verificados (DOI / PMID)</h2>
    ${inventario}

    <h2>Texto do trabalho com as citações destacadas</h2>
    <p class="nota">Texto extraído do arquivo, com cada citação marcada e numerada em ordem de
    aparição. Formatação, imagens e tabelas do original não são reproduzidas.</p>
    ${corpoDestacado}

    <div class="aviso">${AVISO_LEGAL}</div>
</body>
</html>`
}
