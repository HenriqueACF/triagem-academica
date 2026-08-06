import type { ResultadoTriagem, Severidade } from '../models.ts'

const SEPARADOR = ';'

const ORDEM: Severidade[] = ['ALTA', 'MEDIA', 'BAIXA', 'INFO']

function contar(flags: ResultadoTriagem['flags']): Record<Severidade, number> {
    const contagem: Record<Severidade, number> = { ALTA: 0, MEDIA: 0, BAIXA: 0, INFO: 0 }
    for (const f of flags) contagem[f.severidade]++
    return contagem
}

function celula(valor: string | number): string {
    return `"${String(valor).replaceAll('"', '""')}"`
}

export function gerarCsv(resultados: ResultadoTriagem[]): string {
    const ordenados = [...resultados].sort((a, b) => {
        const ca = contar(a.flags)
        const cb = contar(b.flags)
        for (const sev of ORDEM) {
            if (cb[sev] !== ca[sev]) return cb[sev] - ca[sev]
        }
        return a.doc.nome.localeCompare(b.doc.nome)
    })

    const cabecalho = ['arquivo', 'ALTA', 'MEDIA', 'BAIXA', 'INFO', 'total',
        'citacoes', 'entradas_lista', 'mediana_ano_referencias', 'sinalizacoes', 'erros_leitura']
    const linhas = [cabecalho.map(celula).join(SEPARADOR)]

    for (const r of ordenados) {
        const c = contar(r.flags)
        const anos = r.referencias
            .map((ref) => ref.anoPublicacao)
            .filter((a): a is number => typeof a === 'number')
            .sort((a, b) => a - b)
        const mediana = anos.length === 0
            ? ''
            : anos.length % 2 === 1
                ? anos[(anos.length - 1) / 2]
                : Math.round((anos[anos.length / 2 - 1] + anos[anos.length / 2]) / 2)

        linhas.push([
            celula(r.doc.nome),
            celula(c.ALTA),
            celula(c.MEDIA),
            celula(c.BAIXA),
            celula(c.INFO),
            celula(r.flags.length),
            celula(r.inventario.citacoes.length),
            celula(r.inventario.lista.encontrada ? r.inventario.lista.entradas.length : 'sem lista'),
            celula(mediana),
            celula(r.flags.map((f) => `[${f.severidade}] ${f.titulo}`).join(' | ')),
            celula(r.doc.errosLeitura.join(' | ')),
        ].join(SEPARADOR))
    }

    return '\ufeff' + linhas.join('\r\n')
}
