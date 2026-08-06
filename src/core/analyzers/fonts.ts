import type {Documento, Flag} from "../models.ts";
import {CONFIG} from "../config.ts";

export async function analisarFontes(doc: Documento): Promise<Flag[]>{
    const flags: Flag[] = []
    const fontes = doc.metadados.fontesUsadas

    if(!Array.isArray(fontes) || fontes.length === 0) return flags

    const contagem = new Map<string, number>()
    for (const f of fontes) {
        if (typeof f === 'string') {
            contagem.set(f, (contagem.get(f)?? 0)+1)
        }
    }

    const total = fontes.length
    const [fonteDominante] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['']

    const minoritarias = [...contagem.entries()].filter(
        ([fonte, n]) =>
            fonte !== fonteDominante && n >= CONFIG.limiares.fontesMinOcorrencias
            && n / total < CONFIG.limiares.fontesProporcaoMaxima
    )

    if (minoritarias.length > 0) {
        flags.push({
            modulo: 'fontes',
            severidade: 'BAIXA',
            titulo: 'Fontes minoritárias no corpo do texto',
            evidencia: `Fonte predominante: "${fonteDominante}". Outras encontradas: ` +
                minoritarias.map(([f, n]) => `"${f}" (${n}x)`).join(', ') + '.',
            detalhe: 'Pode indicar texto colado de outra origem, ou apenas formatação intencional (título, citação em bloco, tabela).',
        })
    }

    return flags

}
