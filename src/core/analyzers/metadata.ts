import type { Documento, Flag } from '../models.ts'
import { CONFIG } from '../config.ts'

function num(valor: unknown): number | undefined {
    if (valor === undefined || valor === null || valor === '') return undefined
    const n = Number(valor)
    return Number.isFinite(n) ? n : undefined
}

function data(valor: unknown): Date | undefined {
    if (typeof valor !== 'string' || valor === '') return undefined
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? undefined : d
}

export async function analisarMetadados(doc: Documento): Promise<Flag[]> {
    const flags: Flag[] = []
    const m = doc.metadados
    const L = CONFIG.limiares

    const palavras = num(m.Words)
    const tempo = num(m.TotalTime)
    const revisoes = num(m.revision)
    const rsids = num(m.rsidsDistintos)
    const criado = data(m.created)
    const modificado = data(m.modified)
    const editor = typeof m.Application === 'string' ? m.Application : undefined

    // Regras 1 e 2 — tempo de edição curto para o volume de texto (exclusivas).
    if (palavras !== undefined && tempo !== undefined) {
        if (tempo < L.tempoEdicaoMuitoCurtoMin && palavras >= L.palavrasTempoMuitoCurto) {
            flags.push({
                modulo: 'metadados',
                severidade: 'ALTA',
                titulo: 'Tempo de edição muito curto para o volume de texto',
                evidencia: `Tempo de edição de ${tempo} min para ${palavras} palavras.`,
            })
        } else if (tempo < L.tempoEdicaoCurtoMin && palavras >= L.palavrasTempoCurto) {
            flags.push({
                modulo: 'metadados',
                severidade: 'MEDIA',
                titulo: 'Tempo de edição curto para o volume de texto',
                evidencia: `Tempo de edição de ${tempo} min para ${palavras} palavras.`,
            })
        }
    }

    // Regra 3 — poucas revisões salvas num documento longo.
    if (revisoes !== undefined && palavras !== undefined) {
        if (revisoes <= L.revisoesBaixas && palavras >= L.palavrasDocLongo) {
            flags.push({
                modulo: 'metadados',
                severidade: 'MEDIA',
                titulo: 'Poucas revisões salvas para o tamanho do documento',
                evidencia: `Documento com ${palavras} palavras e apenas ${revisoes} revisão(ões) salva(s).`,
            })
        }
    }

    // Regra 4 — criado e modificado pela última vez muito próximos no tempo.
    if (criado !== undefined && modificado !== undefined) {
        const minutos = (modificado.getTime() - criado.getTime()) / 60000
        if (minutos >= 0 && minutos < L.janelaCriacaoModificacaoMin) {
            flags.push({
                modulo: 'metadados',
                severidade: 'MEDIA',
                titulo: 'Criação e última modificação muito próximas',
                evidencia: `Criado e modificado pela última vez com ${Math.round(minutos)} min de diferença.`,
            })
        }
    }

    // Regra 5 — poucos ciclos de edição (rsids) num documento grande.
    if (rsids !== undefined && palavras !== undefined) {
        if (rsids < L.rsidsMinimos && palavras >= L.palavrasDocGrande) {
            flags.push({
                modulo: 'metadados',
                severidade: 'BAIXA',
                titulo: 'Poucos ciclos de edição no documento',
                evidencia: `${rsids} ciclo(s) de edição (rsids) num documento de ${palavras} palavras.`,
            })
        }
    }

    // Regra 6 — editor declarado fora da lista de editores comuns.
    if (editor !== undefined) {
        const conhecido = L.editoresConhecidos.some((nome) => editor.includes(nome))
        if (!conhecido) {
            flags.push({
                modulo: 'metadados',
                severidade: 'INFO',
                titulo: 'Editor declarado fora da lista de editores comuns',
                evidencia: `Editor declarado: '${editor}' (fora da lista de editores comuns).`,
            })
        }
    }

    return flags
}
