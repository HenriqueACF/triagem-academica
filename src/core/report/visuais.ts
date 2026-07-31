import type { Documento, Inventario } from '../models.ts'

const AZUL = '#2a78d6'
const TINTA_FRACA = '#8a8a86'
const TRILHA = '#eceae6'

function escaparSvg(texto: string): string {
    return texto
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

export function faixaDeCitacoes(doc: Documento, inventario: Inventario): string {
    const total = doc.texto.length
    if (total === 0 || inventario.ocorrencias.length === 0) return ''

    const largura = 760
    const altura = 34

    const marcas = inventario.ocorrencias.map((o) => {
        const x = Math.min(largura - 1, (o.inicio / total) * largura)
        return `<line x1="${x.toFixed(1)}" y1="6" x2="${x.toFixed(1)}" y2="26" stroke="${AZUL}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>`
    }).join('')

    const ultima = inventario.ocorrencias[inventario.ocorrencias.length - 1]
    const percentualFinal = Math.round((ultima.inicio / total) * 100)

    return `<div class="visual">
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img"
         aria-label="Posição das ${inventario.ocorrencias.length} citações ao longo do documento">
        <rect x="0" y="15" width="${largura}" height="2" fill="${TRILHA}"/>
        ${marcas}
    </svg>
    <div class="eixo"><span>início do texto</span><span>fim</span></div>
    <p class="legenda-visual">${inventario.ocorrencias.length} ocorrências de citação.
    A última aparece a ${percentualFinal}% do documento.</p>
</div>`
}

export function linhaDoTempo(doc: Documento): string {
    const criado = comoData(doc.metadados.created)
    const modificado = comoData(doc.metadados.modified)
    if (!criado || !modificado) return ''

    const dias = Math.max(0, (modificado.getTime() - criado.getTime()) / 86400000)
    const largura = 760
    const altura = 46

    const inicioX = 60
    const fimX = largura - 60
    const barra = dias < 0.02
        ? `<circle cx="${inicioX}" cy="20" r="5" fill="${AZUL}"/>`
        : `<rect x="${inicioX}" y="15" width="${fimX - inicioX}" height="10" rx="4" fill="${AZUL}" opacity="0.25"/>
           <circle cx="${inicioX}" cy="20" r="5" fill="${AZUL}"/>
           <circle cx="${fimX}" cy="20" r="5" fill="${AZUL}"/>`

    const intervalo = dias < 1
        ? `${Math.round(dias * 24 * 60)} min`
        : `${Math.round(dias)} dia${Math.round(dias) > 1 ? 's' : ''}`

    return `<div class="visual">
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img"
         aria-label="Intervalo entre criação e última modificação: ${intervalo}">
        ${barra}
        <text x="${inicioX}" y="42" font-size="11" fill="${TINTA_FRACA}" text-anchor="middle">${criado.toLocaleDateString('pt-BR')}</text>
        <text x="${fimX}" y="42" font-size="11" fill="${TINTA_FRACA}" text-anchor="middle">${modificado.toLocaleDateString('pt-BR')}</text>
        <text x="${(inicioX + fimX) / 2}" y="10" font-size="11" fill="${TINTA_FRACA}" text-anchor="middle">${intervalo}</text>
    </svg>
</div>`
}

function comoData(valor: unknown): Date | undefined {
    if (typeof valor !== 'string' || valor === '') return undefined
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? undefined : d
}

const LIMITE_TEXTO = 60000

export function textoComCitacoes(doc: Documento, inventario: Inventario): string {
    const texto = doc.texto
    if (texto.length === 0) return '<p class="vazio">Nenhum texto foi extraído deste documento.</p>'

    const marcas = [...inventario.ocorrencias].sort((a, b) => a.inicio - b.inicio)
    const limpas: typeof marcas = []
    for (const m of marcas) {
        const anterior = limpas[limpas.length - 1]
        if (anterior && m.inicio < anterior.fim) continue
        limpas.push(m)
    }

    const cortado = texto.length > LIMITE_TEXTO
    const fimUtil = cortado ? LIMITE_TEXTO : texto.length

    let html = ''
    let cursor = 0
    let n = 0

    for (const m of limpas) {
        if (m.inicio >= fimUtil) break
        html += escaparSvg(texto.slice(cursor, m.inicio))
        n++
        html += `<mark class="cit" id="cit-${n}" title="${escaparSvg(m.chave)}">${escaparSvg(texto.slice(m.inicio, m.fim))}<sup>${n}</sup></mark>`
        cursor = m.fim
    }
    html += escaparSvg(texto.slice(cursor, fimUtil))

    const aviso = cortado
        ? `<p class="legenda-visual">Exibindo os primeiros ${LIMITE_TEXTO.toLocaleString('pt-BR')} caracteres
           de ${texto.length.toLocaleString('pt-BR')}, para manter o relatório leve.</p>`
        : ''

    return `${aviso}<div class="texto-corpo">${html.replaceAll('\n', '<br>')}</div>`
}
