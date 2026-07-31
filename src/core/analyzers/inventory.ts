import type {
    CitacaoEncontrada,
    CitacaoNumerica,
    Documento,
    Flag,
    Inventario,
    ListaReferencias,
    OcorrenciaCitacao,
    ReferenciaListada,
} from '../models.ts'

export type {
    CitacaoEncontrada,
    CitacaoNumerica,
    Inventario,
    ListaReferencias,
    ReferenciaListada,
} from '../models.ts'

export function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function semPontuacao(texto: string): string {
    return normalizar(texto).replace(/[.,;:]+$/, '')
}

function primeiroSobrenome(texto: string): string {
    return normalizar(texto)
        .replace(/\bet al\.?/g, '')
        .split(/[;,]/)[0]
        .trim()
        .split(/\s+/)[0]
        ?.replace(/[.;:]+$/, '') ?? ''
}

function montarChave(autores: string, ano: string): string {
    return `${primeiroSobrenome(autores)}|${ano}`
}

function anoPlausivel(ano: string): boolean {
    const n = Number(ano)
    return n >= 1900 && n <= 2100
}

const CONECTORES = new Set([
    'e', 'and', '&', 'et', 'al', 'de', 'da', 'do', 'das', 'dos',
    'von', 'van', 'della', 'di', 'du', 'la', 'le',
])

const NAO_SOBRENOME = new Set([
    'segundo', 'conforme', 'para', 'como', 'ainda', 'assim', 'entretanto',
    'porem', 'portanto', 'contudo', 'alem', 'apos', 'antes', 'durante',
    'desde', 'entre', 'sobre', 'quando', 'onde', 'tambem', 'apenas',
    'somente', 'embora', 'enquanto', 'este', 'esta', 'esse', 'essa',
    'isso', 'aquele', 'aquela', 'no', 'na', 'nos', 'nas', 'em', 'o', 'a',
    'os', 'as', 'um', 'uma', 'mas', 'ou', 'ja', 'ha', 'foi', 'sao', 'ver',
    'veja', 'vide', 'tabela', 'figura', 'quadro', 'anexo', 'apendice',
    'capitulo', 'secao', 'item', 'estudo', 'estudos', 'autor', 'autores',
    'pesquisa', 'dados', 'trabalho', 'artigo', 'segundo-feira',
    'according', 'in', 'the', 'this', 'these', 'those', 'by', 'since',
    'while', 'where', 'when', 'also', 'only', 'although', 'see', 'table',
    'figure', 'chapter', 'section', 'study', 'studies', 'data', 'as', 'of',
])

export function analisarCitacoesDoTexto(texto: string): {
    citacoes: CitacaoEncontrada[]
    ocorrencias: OcorrenciaCitacao[]
} {
    const contagem = new Map<string, CitacaoEncontrada>()
    const ocorrencias: OcorrenciaCitacao[] = []

    function contextoEm(inicio: number, fim: number): string {
        const antes = texto.slice(Math.max(0, inicio - 70), inicio)
        const meio = texto.slice(inicio, fim)
        const depois = texto.slice(fim, fim + 70)
        return `${inicio > 70 ? '…' : ''}${antes}${meio}${depois}${fim + 70 < texto.length ? '…' : ''}`
            .replace(/\s+/g, ' ')
            .trim()
    }

    function registrar(
        autores: string,
        ano: string,
        narrativa: boolean,
        inicio: number,
        fim: number,
    ): void {
        if (!anoPlausivel(ano)) return
        const chave = montarChave(autores, ano)
        if (chave.startsWith('|')) return

        const contexto = contextoEm(inicio, fim)
        ocorrencias.push({ inicio, fim, chave })

        const existente = contagem.get(chave)
        if (existente) {
            existente.ocorrencias++
            if (!narrativa && existente.narrativa) {
                existente.narrativa = false
                existente.contexto = contexto
            }
        } else {
            contagem.set(chave, {
                textoOriginal: `${autores}, ${ano}`,
                ano,
                chave,
                ocorrencias: 1,
                narrativa,
                contexto,
            })
        }
    }

    for (const m of texto.matchAll(/\(([^()]{3,150})\)/g)) {
        let acumulado: string[] = []

        for (const parte of m[1].split(';')) {
            acumulado.push(parte.trim())

            const casou = acumulado.join('; ').match(/^(.{2,150}),\s*(\d{4})[a-z]?\s*$/)
            if (!casou) continue

            acumulado = []
            const inicio = m.index ?? 0
            registrar(casou[1].trim(), casou[2], false, inicio, inicio + m[0].length)
        }
    }

    for (const m of texto.matchAll(/\((\d{4})[a-z]?\)/g)) {
        const ano = m[1]
        if (!anoPlausivel(ano)) continue

        const inicio = m.index ?? 0
        const antes = texto.slice(Math.max(0, inicio - 90), inicio).trimEnd()
        if (antes === '') continue

        const palavras = antes.split(/\s+/)
        const corrida: string[] = []
        for (let i = palavras.length - 1; i >= 0; i--) {
            const palavra = palavras[i]
            if (/^[A-ZÀ-Ú]/.test(palavra) || CONECTORES.has(semPontuacao(palavra))) {
                corrida.unshift(palavra)
                continue
            }
            break
        }

        const candidato = corrida.find(
            (p) => /^[A-ZÀ-Ú]/.test(p) && !NAO_SOBRENOME.has(semPontuacao(p)),
        )
        if (!candidato) continue

        registrar(
            corrida.slice(corrida.indexOf(candidato)).join(' '),
            ano,
            true,
            Math.max(0, inicio - corrida.join(' ').length),
            inicio + m[0].length,
        )
    }

    ocorrencias.sort((a, b) => a.inicio - b.inicio)
    return { citacoes: [...contagem.values()], ocorrencias }
}

export function extrairCitacoes(texto: string): CitacaoEncontrada[] {
    return analisarCitacoesDoTexto(texto).citacoes
}

export function extrairCitacoesNumericas(texto: string): CitacaoNumerica[] {
    const contagem = new Map<number, number>()

    for (const m of texto.matchAll(/\[([^\]]{1,40})\]/g)) {
        const dentro = m[1]
        if (!/^[\d\s,;–—-]+$/.test(dentro)) continue

        for (const parte of dentro.split(/[,;]/)) {
            const alvo = parte.trim()

            const faixa = alvo.match(/^(\d{1,3})\s*[–—-]\s*(\d{1,3})$/)
            if (faixa) {
                const de = Number(faixa[1])
                const ate = Number(faixa[2])
                if (de >= 1 && ate >= de && ate - de <= 60) {
                    for (let n = de; n <= ate; n++) {
                        contagem.set(n, (contagem.get(n) ?? 0) + 1)
                    }
                }
                continue
            }

            const unico = alvo.match(/^(\d{1,3})$/)
            if (unico && Number(unico[1]) >= 1) {
                const n = Number(unico[1])
                contagem.set(n, (contagem.get(n) ?? 0) + 1)
            }
        }
    }

    return [...contagem.entries()]
        .map(([numero, ocorrencias]) => ({ numero, ocorrencias }))
        .sort((a, b) => a.numero - b.numero)
}

const TITULO_SECAO =
    /^\s*(refer[êe]ncias?\b.*|bibliografia\b.*|obras citadas\b.*|references?\b.*|bibliography\b.*|works cited\b.*|literature cited\b.*)$/i

export function extrairListaReferencias(texto: string): ListaReferencias {
    const linhas = texto.split('\n')

    let inicio = -1
    for (let i = linhas.length - 1; i >= 0; i--) {
        if (TITULO_SECAO.test(linhas[i].trim())) {
            inicio = i
            break
        }
    }

    if (inicio === -1) {
        return { encontrada: false, entradas: [] }
    }

    const entradas: ReferenciaListada[] = []
    let indice = 0

    for (const linha of linhas.slice(inicio + 1)) {
        const entrada = linha.trim()
        if (entrada.length < 25) continue

        const sobrenome = primeiroSobrenome(entrada)
        const anos = [...entrada.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0])
        const ano = anos.length > 0 ? anos[anos.length - 1] : ''

        indice++
        entradas.push({
            indice,
            textoOriginal: entrada,
            chave: `${sobrenome}|${ano}`,
            sobrenome,
        })
    }

    return { encontrada: true, entradas }
}

const MINIMO_NUMERICAS = 3

function anoMaisRecenteDoDocumento(doc: Documento): number {
    const anos: number[] = []
    for (const campo of ['created', 'modified']) {
        const valor = doc.metadados[campo]
        if (typeof valor !== 'string') continue
        const data = new Date(valor)
        if (!Number.isNaN(data.getTime())) anos.push(data.getFullYear())
    }
    return anos.length > 0 ? Math.max(...anos) : new Date().getFullYear()
}

export function levantarInventario(doc: Documento): Inventario {
    const { citacoes, ocorrencias } = analisarCitacoesDoTexto(doc.texto)
    return {
        citacoes,
        ocorrencias,
        numericas: extrairCitacoesNumericas(doc.texto),
        lista: extrairListaReferencias(doc.texto),
    }
}

export async function analisarInventario(doc: Documento): Promise<Flag[]> {
    const flags: Flag[] = []
    const { citacoes, numericas, lista } = levantarInventario(doc)

    const totalOcorrencias = citacoes.reduce((s, c) => s + c.ocorrencias, 0)
    const usaNumerico = numericas.length >= MINIMO_NUMERICAS

    const corpo = normalizar(doc.texto)

    if (!lista.encontrada && (citacoes.length > 0 || usaNumerico)) {
        const quanto = citacoes.length > 0
            ? `${citacoes.length} citações distintas (${totalOcorrencias} ocorrências)`
            : `${numericas.length} citações numéricas distintas`
        flags.push({
            modulo: 'inventario',
            severidade: 'MEDIA',
            titulo: 'Citações no corpo sem lista de referências',
            evidencia: `${quanto} e nenhuma seção de referências localizada.`,
            detalhe: 'Nenhuma das citações pode ser conferida. A lista pode estar em arquivo separado.',
        })
    }

    if (citacoes.length === 0 && numericas.length === 0 && doc.texto.length > 3000) {
        flags.push({
            modulo: 'inventario',
            severidade: 'BAIXA',
            titulo: 'Documento sem citações identificáveis',
            evidencia: `${doc.texto.length} caracteres de texto e nenhuma citação "(Autor, ano)" ou "[n]" encontrada.`,
            detalhe: 'O trabalho pode usar número sobrescrito ou notas de rodapé, que não são detectáveis no texto extraído.',
        })
    }

    const anoLimite = anoMaisRecenteDoDocumento(doc)
    const posteriores = citacoes.filter((c) => Number(c.ano) > anoLimite)

    if (posteriores.length > 0) {
        flags.push({
            modulo: 'inventario',
            severidade: 'MEDIA',
            titulo: 'Citação com ano posterior ao documento',
            evidencia: `${posteriores.map((c) => c.textoOriginal).join(' | ')} — o documento não foi editado depois de ${anoLimite}.`,
            detalhe: 'Verificar se é erro de digitação no ano ou obra que ainda não existia.',
        })
    }

    if (!lista.encontrada) return flags

    const porChave = new Map<string, ReferenciaListada[]>()
    for (const e of lista.entradas) {
        porChave.set(e.chave, [...(porChave.get(e.chave) ?? []), e])
    }
    const duplicadas = [...porChave.values()].filter((grupo) => grupo.length > 1)

    if (duplicadas.length > 0) {
        flags.push({
            modulo: 'inventario',
            severidade: 'BAIXA',
            titulo: 'Entradas repetidas na lista de referências',
            evidencia: duplicadas
                .map((g) => `${g[0].sobrenome} ${g[0].chave.split('|')[1]} (entradas ${g.map((e) => `#${e.indice}`).join(', ')})`)
                .join(' | '),
            detalhe: 'Obras diferentes do mesmo autor e ano também caem aqui — conferir antes de concluir que há repetição.',
        })
    }

    const semAno = lista.entradas.filter((e) => e.chave.endsWith('|'))
    if (semAno.length > 0) {
        flags.push({
            modulo: 'inventario',
            severidade: 'INFO',
            titulo: 'Entradas da lista sem ano identificável',
            evidencia: `${semAno.length} de ${lista.entradas.length} entradas sem ano: ${semAno.map((e) => `#${e.indice}`).join(', ')}.`,
            detalhe: 'Pode ser formatação incomum da referência, ou quebra de linha no meio da entrada.',
        })
    }

    const chavesListadas = new Set(lista.entradas.map((e) => e.chave))
    const parenteticas = citacoes.filter((c) => !c.narrativa)
    const naoListadas = parenteticas.filter((c) => !chavesListadas.has(c.chave))

    if (naoListadas.length > 0) {
        flags.push({
            modulo: 'inventario',
            severidade: 'MEDIA',
            titulo: 'Citações que não constam na lista de referências',
            evidencia: `${naoListadas.length} de ${parenteticas.length} citações sem entrada correspondente: ${naoListadas.map((c) => c.textoOriginal).join(' | ')}`,
            detalhe: 'Conferir manualmente: variação na grafia do sobrenome causa divergência sem que haja problema real.',
        })
    }

    const chavesCitadas = new Set(citacoes.map((c) => c.chave))
    const naoCitadas = lista.entradas.filter((e) => {
        if (chavesCitadas.has(e.chave)) return false
        if (e.sobrenome.length >= 4 && corpo.includes(e.sobrenome)) return false
        return true
    })

    if (naoCitadas.length > 0 && !usaNumerico) {
        flags.push({
            modulo: 'inventario',
            severidade: 'BAIXA',
            titulo: 'Referências listadas que não aparecem no corpo',
            evidencia: `${naoCitadas.length} de ${lista.entradas.length} entradas nunca são citadas: ${naoCitadas.map((e) => `#${e.indice}`).join(', ')}`,
            detalhe: 'Comum em trabalhos que passaram por cortes de texto.',
        })
    }

    if (usaNumerico) {
        const foraDaFaixa = numericas.filter((n) => n.numero > lista.entradas.length)
        if (foraDaFaixa.length > 0) {
            flags.push({
                modulo: 'inventario',
                severidade: 'MEDIA',
                titulo: 'Citação numérica sem entrada correspondente na lista',
                evidencia: `A lista tem ${lista.entradas.length} entradas, mas o texto cita ${foraDaFaixa.map((n) => `[${n.numero}]`).join(', ')}.`,
                detalhe: 'Conferir a numeração: entradas em várias linhas podem ter sido contadas a mais ou a menos.',
            })
        }

        const citados = new Set(numericas.map((n) => n.numero))
        const nuncaCitados = lista.entradas.filter((e) => !citados.has(e.indice))
        if (nuncaCitados.length > 0) {
            flags.push({
                modulo: 'inventario',
                severidade: 'BAIXA',
                titulo: 'Entradas da lista que nunca são citadas por número',
                evidencia: `${nuncaCitados.length} de ${lista.entradas.length} entradas sem citação: ${nuncaCitados.map((e) => `#${e.indice}`).join(', ')}.`,
                detalhe: 'Comum em trabalhos que passaram por cortes de texto.',
            })
        }
    }

    return flags
}
