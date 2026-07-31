import type { ResultadoTriagem } from '../core/models.ts'
import { CONFIG } from '../core/config.ts'

const AZUL = '#2a78d6'
const TINTA_FRACA = '#8a8a86'
const TRILHA = '#eceae6'

interface Metrica {
    rotulo: string
    unidade: string
    limiar?: number
    valorDe: (r: ResultadoTriagem) => number | undefined
}

function numero(valor: unknown): number | undefined {
    if (valor === undefined || valor === null || valor === '') return undefined
    const n = Number(valor)
    return Number.isFinite(n) ? n : undefined
}

const METRICAS: Metrica[] = [
    {
        rotulo: 'Tempo de edição',
        unidade: 'min',
        limiar: CONFIG.limiares.tempoEdicaoMuitoCurtoMin,
        valorDe: (r) => numero(r.doc.metadados.TotalTime),
    },
    {
        rotulo: 'Revisões salvas',
        unidade: '',
        limiar: CONFIG.limiares.revisoesBaixas,
        valorDe: (r) => numero(r.doc.metadados.revision),
    },
    {
        rotulo: 'Ciclos de edição (rsids)',
        unidade: '',
        limiar: CONFIG.limiares.rsidsMinimos,
        valorDe: (r) => numero(r.doc.metadados.rsidsDistintos),
    },
    {
        rotulo: 'Citações por trabalho',
        unidade: '',
        valorDe: (r) => r.inventario.citacoes.length,
    },
]

function escapar(t: string): string {
    return t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function desenhar(metrica: Metrica, valores: number[]): string {
    if (valores.length === 0) return ''

    const largura = 300
    const altura = 130
    const margemEsq = 26
    const margemBaixo = 26
    const topo = 12

    const maximo = Math.max(...valores)
    const minimo = Math.min(...valores)
    const faixa = maximo - minimo || 1
    const nBaldes = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(valores.length))))
    const tamanhoBalde = faixa / nBaldes

    const baldes = new Array<number>(nBaldes).fill(0)
    for (const v of valores) {
        const i = Math.min(nBaldes - 1, Math.floor((v - minimo) / tamanhoBalde))
        baldes[i]++
    }

    const alturaPlot = altura - margemBaixo - topo
    const larguraPlot = largura - margemEsq - 8
    const maiorBalde = Math.max(...baldes)
    const larguraBarra = larguraPlot / nBaldes - 2

    const barras = baldes.map((n, i) => {
        if (n === 0) return ''
        const h = (n / maiorBalde) * alturaPlot
        const x = margemEsq + i * (larguraPlot / nBaldes)
        const y = topo + alturaPlot - h
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larguraBarra.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${AZUL}"/>`
    }).join('')

    let marcaLimiar = ''
    if (metrica.limiar !== undefined && metrica.limiar >= minimo && metrica.limiar <= maximo) {
        const x = margemEsq + ((metrica.limiar - minimo) / faixa) * larguraPlot
        marcaLimiar = `
        <line x1="${x.toFixed(1)}" y1="${topo - 4}" x2="${x.toFixed(1)}" y2="${topo + alturaPlot}" stroke="${TINTA_FRACA}" stroke-width="1"/>
        <text x="${x.toFixed(1)}" y="${topo - 6}" font-size="9" fill="${TINTA_FRACA}" text-anchor="middle">limiar ${metrica.limiar}</text>`
    }

    return `<figure class="hist">
    <figcaption>${escapar(metrica.rotulo)}</figcaption>
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" role="img"
         aria-label="Distribuição de ${escapar(metrica.rotulo)} em ${valores.length} trabalhos">
        <line x1="${margemEsq}" y1="${topo + alturaPlot}" x2="${largura - 8}" y2="${topo + alturaPlot}" stroke="${TRILHA}" stroke-width="1"/>
        ${barras}
        ${marcaLimiar}
        <text x="${margemEsq}" y="${altura - 8}" font-size="9" fill="${TINTA_FRACA}">${arredondar(minimo)}</text>
        <text x="${largura - 8}" y="${altura - 8}" font-size="9" fill="${TINTA_FRACA}" text-anchor="end">${arredondar(maximo)}${metrica.unidade ? ' ' + metrica.unidade : ''}</text>
        <text x="4" y="${topo + 8}" font-size="9" fill="${TINTA_FRACA}">${maiorBalde}</text>
    </svg>
</figure>`
}

function arredondar(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const MINIMO_PARA_DISTRIBUICAO = 4

export function histogramasDoLote(triagens: ResultadoTriagem[]): string {
    if (triagens.length < MINIMO_PARA_DISTRIBUICAO) return ''

    const graficos = METRICAS.map((m) => {
        const valores = triagens
            .map((r) => m.valorDe(r))
            .filter((v): v is number => v !== undefined)
        return valores.length >= MINIMO_PARA_DISTRIBUICAO ? desenhar(m, valores) : ''
    }).filter((g) => g !== '').join('')

    if (graficos === '') return ''

    return `<h2 class="titulo-secao">Distribuição do lote</h2>
    <p class="nota-secao">Como estes ${triagens.length} trabalhos se distribuem. Serve para
    situar cada trabalho no contexto da turma e para ajustar os limiares — um valor só é
    baixo em relação aos demais. A linha marca o limiar em uso hoje.</p>
    <div class="histogramas">${graficos}</div>`
}

export function textoDaMetricaDoDocumento(r: ResultadoTriagem): {
    tempo: string
    revisoes: string
    palavras: string
    citacoes: string
} {
    const tempo = numero(r.doc.metadados.TotalTime)
    const revisoes = numero(r.doc.metadados.revision)
    const palavras = numero(r.doc.metadados.Words)

    return {
        tempo: tempo === undefined ? '—' : tempo < 60 ? `${tempo} min` : `${Math.floor(tempo / 60)} h`,
        revisoes: revisoes === undefined ? '—' : String(revisoes),
        palavras: palavras === undefined ? '—' : palavras.toLocaleString('pt-BR'),
        citacoes: String(r.inventario.citacoes.length),
    }
}
