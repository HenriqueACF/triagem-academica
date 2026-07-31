import type { Documento, Flag } from '../models.ts'
import { CONFIG } from '../config.ts'

const INVISIVEIS: Array<{ codigo: string; nome: string }> = [
    { codigo: '​', nome: 'espaço de largura zero (U+200B)' },
    { codigo: '‌', nome: 'não-juntador de largura zero (U+200C)' },
    { codigo: '‍', nome: 'juntador de largura zero (U+200D)' },
    { codigo: '­', nome: 'hífen opcional (U+00AD)' },
    { codigo: '﻿', nome: 'marca de ordem de bytes (U+FEFF)' },
]

function contarOcorrencias(texto: string, alvo: string): number {
    let total = 0
    let posicao = texto.indexOf(alvo)
    while (posicao !== -1) {
        total++
        posicao = texto.indexOf(alvo, posicao + alvo.length)
    }
    return total
}

export async function analisarArtefatos(doc: Documento): Promise<Flag[]> {
    const flags: Flag[] = []
    const texto = doc.texto
    const minimo = CONFIG.limiares.artefatosMinOcorrencias

    if (texto.length === 0) return flags

    const achados = INVISIVEIS.map((c) => ({ ...c, total: contarOcorrencias(texto, c.codigo) }))
        .filter((c) => c.total > 0)

    const totalInvisiveis = achados.reduce((s, c) => s + c.total, 0)
    if (totalInvisiveis >= minimo) {
        flags.push({
            modulo: 'artefatos',
            severidade: 'BAIXA',
            titulo: 'Caracteres invisíveis no texto',
            evidencia: `${totalInvisiveis} ocorrências: ${achados.map((c) => `${c.nome} ×${c.total}`).join(', ')}.`,
            detalhe: 'Comum em texto colado de páginas web ou PDF. Não indica origem específica.',
        })
    }

    const retas = contarOcorrencias(texto, '"')
    const curvas = contarOcorrencias(texto, '“') + contarOcorrencias(texto, '”')
    if (retas >= minimo && curvas >= minimo) {
        flags.push({
            modulo: 'artefatos',
            severidade: 'INFO',
            titulo: 'Mistura de aspas retas e tipográficas',
            evidencia: `${retas} aspas retas (") e ${curvas} aspas tipográficas (“ ”) no mesmo documento.`,
            detalhe: 'Pode ocorrer por configuração do editor. Isoladamente não significa nada.',
        })
    }

    const naoSeparaveis = contarOcorrencias(texto, ' ')
    if (naoSeparaveis >= minimo) {
        flags.push({
            modulo: 'artefatos',
            severidade: 'INFO',
            titulo: 'Espaços não separáveis em quantidade incomum',
            evidencia: `${naoSeparaveis} ocorrências de espaço não separável (U+00A0).`,
            detalhe: 'Frequente em texto copiado de páginas web.',
        })
    }

    const multiplos = [...texto.matchAll(/\S {2,}\S/g)].length
    if (multiplos >= minimo) {
        flags.push({
            modulo: 'artefatos',
            severidade: 'INFO',
            titulo: 'Espaçamento múltiplo entre palavras',
            evidencia: `${multiplos} trechos com dois ou mais espaços seguidos entre palavras.`,
            detalhe: 'Resíduo comum de conversão de formato.',
        })
    }

    return flags
}
