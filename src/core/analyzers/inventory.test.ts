import { describe, expect, it } from 'vitest'
import {
    analisarInventario,
    extrairCitacoes,
    extrairCitacoesNumericas,
    extrairListaReferencias,
    normalizar,
} from './inventory.ts'
import type { Documento } from '../models.ts'

function doc(texto: string, metadados: Record<string, unknown> = {}): Documento {
    return { nome: 't.docx', formato: 'docx', texto, metadados, errosLeitura: [] }
}

describe('normalizar', () => {
    it('remove acentos e baixa a caixa', () => {
        expect(normalizar('GONÇALVES')).toBe('goncalves')
        expect(normalizar('Referências')).toBe('referencias')
    })
})

describe('extrairCitacoes — forma parentética', () => {
    it('citação simples', () => {
        const c = extrairCitacoes('Conforme (SILVA, 2020) isso é verdade.')
        expect(c).toHaveLength(1)
        expect(c[0].chave).toBe('silva|2020')
        expect(c[0].narrativa).toBe(false)
    })

    it('duas citações distintas separadas por ; no mesmo parêntese', () => {
        const c = extrairCitacoes('Ver (SILVA, 2010; SOUZA, 2015) para mais.')
        const chaves = c.map((x) => x.chave).sort()
        expect(chaves).toEqual(['silva|2010', 'souza|2015'])
    })

    it('REGRESSÃO: coautoria com ; não deve perder o primeiro autor', () => {
        // Bug real encontrado no projeto: "Eduardo; Gava, 2012" virava
        // apenas "gava|2012", descartando o primeiro autor.
        const c = extrairCitacoes('A vacinação é promissora (Eduardo; Gava, 2012).')
        expect(c).toHaveLength(1)
        expect(c[0].chave).toBe('eduardo|2012')
        expect(c[0].textoOriginal).toBe('Eduardo; Gava, 2012')
    })

    it('REGRESSÃO: autor institucional não carrega o ponto final na chave', () => {
        // "BRASIL." vira "brasil" na chave, não "brasil."
        const texto = 'Conforme diretriz (BRASIL, 2019) o protocolo mudou.'
        const c = extrairCitacoes(texto)
        expect(c[0].chave).toBe('brasil|2019')
    })

    it('mesma citação repetida conta ocorrências', () => {
        const texto = '(Loubet et al., 2020) ... depois de novo (Loubet et al., 2020).'
        const c = extrairCitacoes(texto)
        expect(c).toHaveLength(1)
        expect(c[0].ocorrencias).toBe(2)
    })

    it('ano implausível (fora de 1900-2100) é descartado', () => {
        const c = extrairCitacoes('Os fatores eram (idade, 30) apenas.')
        expect(c).toHaveLength(0)
    })

    it('APA com & também é reconhecido (mesmo formato de parênteses)', () => {
        const c = extrairCitacoes('As shown by (Smith & Jones, 2018).')
        // "Smith & Jones" -> primeiro token antes da vírgula é "smith & jones",
        // primeiro "sobrenome" (split por espaço) é "smith"
        expect(c[0].chave).toBe('smith|2018')
    })
})

describe('extrairCitacoes — forma narrativa', () => {
    it('reconhece "Segundo Autor (ano)"', () => {
        const c = extrairCitacoes('Segundo Loubet et al. (2020), o tratamento é eficaz.')
        expect(c).toHaveLength(1)
        expect(c[0].chave).toBe('loubet|2020')
        expect(c[0].narrativa).toBe(true)
    })

    it('reconhece narrativa em inglês', () => {
        const c = extrairCitacoes('According to Smith (2018), this is true.')
        expect(c[0].chave).toBe('smith|2018')
    })

    it('NÃO confunde palavra comum de início de frase com sobrenome', () => {
        const c1 = extrairCitacoes('O estudo (2020) mostrou resultados relevantes.')
        const c2 = extrairCitacoes('Na tabela (2019) consta o resultado.')
        expect(c1).toHaveLength(0)
        expect(c2).toHaveLength(0)
    })

    it('trata conector "e" entre dois sobrenomes na forma narrativa', () => {
        const c = extrairCitacoes('Conforme Silva e Souza (2019), o efeito é claro.')
        expect(c[0].chave).toBe('silva|2019')
    })

    it('quando a mesma obra aparece nas duas formas, a parentética prevalece', () => {
        const texto = 'Segundo Silva (2020) isso ocorre. Também (SILVA, 2020) confirma.'
        const c = extrairCitacoes(texto)
        expect(c).toHaveLength(1)
        expect(c[0].narrativa).toBe(false)
        expect(c[0].ocorrencias).toBe(2)
    })
})

describe('extrairCitacoes — contexto', () => {
    it('traz um trecho do texto ao redor da citação', () => {
        const texto = 'Isso é uma frase de teste antes da citação (SILVA, 2020) e depois dela também.'
        const c = extrairCitacoes(texto)
        expect(c[0].contexto).toContain('(SILVA, 2020)')
        expect(c[0].contexto).toContain('antes da citação')
    })
})

describe('extrairCitacoesNumericas', () => {
    it('reconhece citação simples [n]', () => {
        const n = extrairCitacoesNumericas('Confirmado [1].')
        expect(n).toEqual([{ numero: 1, ocorrencias: 1 }])
    })

    it('reconhece lista separada por vírgula [n,m]', () => {
        const n = extrairCitacoesNumericas('Discordam [2,3].')
        expect(n.map((x) => x.numero)).toEqual([2, 3])
    })

    it('expande faixas [n-m]', () => {
        const n = extrairCitacoesNumericas('Ainda [5-7].')
        expect(n.map((x) => x.numero)).toEqual([5, 6, 7])
    })

    it('NÃO confunde enumeração de texto com citação', () => {
        const n = extrairCitacoesNumericas('Os passos são [a], [b] e [texto].')
        expect(n).toEqual([])
    })

    it('ignora faixa absurda (invertida ou grande demais)', () => {
        expect(extrairCitacoesNumericas('[999-1]')).toEqual([])
        expect(extrairCitacoesNumericas('[1-9999]')).toEqual([])
    })

    it('conta ocorrências repetidas do mesmo número', () => {
        const n = extrairCitacoesNumericas('[1] depois de novo [1].')
        expect(n).toEqual([{ numero: 1, ocorrencias: 2 }])
    })
})

describe('extrairListaReferencias', () => {
    it('não encontra seção quando ela não existe', () => {
        const r = extrairListaReferencias('Um texto qualquer sem lista nenhuma no final.')
        expect(r.encontrada).toBe(false)
        expect(r.entradas).toEqual([])
    })

    it('REGRESSÃO: "preferencialmente" não é confundido com "referências"', () => {
        const texto = 'O paciente deve ser posicionado preferencialmente na porção inferior.'
        const r = extrairListaReferencias(texto)
        expect(r.encontrada).toBe(false)
    })

    it('reconhece a seção em maiúsculas e minúsculas, PT e EN', () => {
        for (const titulo of ['REFERÊNCIAS', 'Referências', 'References', 'REFERENCES', 'Bibliografia', 'Works Cited']) {
            const texto = `corpo\n${titulo}\nSILVA, J. Um título qualquer bem longo aqui. Revista, 2020.`
            expect(extrairListaReferencias(texto).encontrada).toBe(true)
        }
    })

    it('extrai sobrenome e ano de uma entrada comum', () => {
        const texto = 'x\nREFERÊNCIAS\nLOUBET, P.; RANFAING, J. Alternative options. Frontiers, 2020.'
        const r = extrairListaReferencias(texto)
        expect(r.entradas[0].chave).toBe('loubet|2020')
    })

    it('REGRESSÃO: autor institucional não carrega ponto na chave da lista', () => {
        const texto = 'x\nREFERÊNCIAS\nBRASIL. Ministério da Saúde. Guia de vigilância. Brasília: MS, 2019.'
        const r = extrairListaReferencias(texto)
        expect(r.entradas[0].chave).toBe('brasil|2019')
    })

    it('usa o ÚLTIMO ano plausível da entrada (ano de publicação vem no fim)', () => {
        const texto = 'x\nREFERÊNCIAS\nSILVA, J. Estudo de 1998 sobre epidemiologia atual. Revista, 2020.'
        const r = extrairListaReferencias(texto)
        expect(r.entradas[0].chave).toBe('silva|2020')
    })

    it('ignora linhas curtas (títulos, numeração de página)', () => {
        const texto = 'x\nREFERÊNCIAS\ncurta\nSILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.'
        const r = extrairListaReferencias(texto)
        expect(r.entradas).toHaveLength(1)
    })

    it('procura de trás para frente: "referências" na prosa não confunde o início da lista', () => {
        const texto =
            'O trabalho tem boas referências bibliográficas ao longo do texto.\n' +
            'REFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.'
        const r = extrairListaReferencias(texto)
        expect(r.entradas).toHaveLength(1)
    })
})

describe('analisarInventario — regras completas', () => {
    it('regra 1: citações sem lista de referências -> MEDIA', async () => {
        const flags = await analisarInventario(doc('Conforme (SILVA, 2020) isso é verdade.'))
        const f = flags.find((x) => x.titulo === 'Citações no corpo sem lista de referências')
        expect(f).toBeDefined()
        expect(f!.severidade).toBe('MEDIA')
    })

    it('regra 2: texto longo sem nenhuma citação -> BAIXA', async () => {
        const flags = await analisarInventario(doc('a '.repeat(2000)))
        const f = flags.find((x) => x.titulo === 'Documento sem citações identificáveis')
        expect(f).toBeDefined()
        expect(f!.severidade).toBe('BAIXA')
    })

    it('regra 2 não dispara em texto curto', async () => {
        const flags = await analisarInventario(doc('texto curto sem citação'))
        expect(flags.find((x) => x.titulo === 'Documento sem citações identificáveis')).toBeUndefined()
    })

    it('regra 3: citação com ano posterior à última edição -> MEDIA', async () => {
        const texto = 'Estudos recentes confirmam a tendência (COSTA, 2031).'
        const flags = await analisarInventario(doc(texto, { modified: '2026-02-01T10:00:00Z' }))
        const f = flags.find((x) => x.titulo === 'Citação com ano posterior ao documento')
        expect(f).toBeDefined()
        expect(f!.evidencia).toContain('2031')
    })

    it('regra 3 não dispara para citação com ano plausível', async () => {
        const texto = 'Segundo (SILVA, 2020) isso é verdade.'
        const flags = await analisarInventario(doc(texto, { modified: '2026-02-01T10:00:00Z' }))
        expect(flags.find((x) => x.titulo === 'Citação com ano posterior ao documento')).toBeUndefined()
    })

    it('regra 4: entradas repetidas na lista (mesmo autor+ano) -> BAIXA', async () => {
        const texto =
            'Nada citado aqui.\nREFERÊNCIAS\n' +
            'SILVA, J. Primeiro trabalho bem longo o suficiente aqui. Revista X, 2020.\n' +
            'SILVA, J. Segundo trabalho diferente também bem longo aqui. Revista Y, 2020.'
        const flags = await analisarInventario(doc(texto))
        const f = flags.find((x) => x.titulo === 'Entradas repetidas na lista de referências')
        expect(f).toBeDefined()
        expect(f!.severidade).toBe('BAIXA')
    })

    it('regra 5: entrada da lista sem ano identificável -> INFO', async () => {
        const texto =
            'Nada citado aqui.\nREFERÊNCIAS\n' +
            'ALVES, R. Entrada sem ano nenhum identificável nesta linha aqui.'
        const flags = await analisarInventario(doc(texto))
        const f = flags.find((x) => x.titulo === 'Entradas da lista sem ano identificável')
        expect(f).toBeDefined()
        expect(f!.severidade).toBe('INFO')
    })

    it('regra 6: citação parentética sem entrada na lista -> MEDIA', async () => {
        const texto =
            'Conforme (SILVA, 2020) e (PEREIRA, 2019).\nREFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.'
        const flags = await analisarInventario(doc(texto))
        const f = flags.find((x) => x.titulo === 'Citações que não constam na lista de referências')
        expect(f).toBeDefined()
        expect(f!.evidencia).toContain('PEREIRA, 2019')
    })

    it('regra 6 NÃO conta citação narrativa (assimetria deliberada)', async () => {
        // Citação só narrativa, sem forma parentética, não gera "não consta
        // na lista" — o risco de erro de leitura do nome é da ferramenta,
        // não do aluno.
        const texto =
            'Segundo Pereira (2019) isso ocorre.\nREFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.'
        const flags = await analisarInventario(doc(texto))
        expect(flags.find((x) => x.titulo === 'Citações que não constam na lista de referências')).toBeUndefined()
    })

    it('regra 7: referência listada nunca citada -> BAIXA', async () => {
        const texto =
            'Conforme (SILVA, 2020).\nREFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.\n' +
            'PEREIRA, K. Outro trabalho que ninguém citou no corpo. Revista Y, 2018.'
        const flags = await analisarInventario(doc(texto))
        const f = flags.find((x) => x.titulo === 'Referências listadas que não aparecem no corpo')
        expect(f).toBeDefined()
        expect(f!.evidencia).toContain('#2')
    })

    it('regra 7 tem rede de segurança: sobrenome mencionado em prosa suprime a flag', async () => {
        const texto =
            'Conforme (SILVA, 2020). O trabalho de Pereira também é mencionado no texto.\n' +
            'REFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.\n' +
            'PEREIRA, K. Outro trabalho mencionado em prosa aqui. Revista Y, 2018.'
        const flags = await analisarInventario(doc(texto))
        expect(flags.find((x) => x.titulo === 'Referências listadas que não aparecem no corpo')).toBeUndefined()
    })

    it('regras 8 e 9: estilo numérico — citação além da lista e entrada nunca citada', async () => {
        const texto =
            'Introdução com fatos [1] e mais dados [2]. Também [9] aparece aqui.\n' +
            'REFERENCES\n' +
            'SMITH, J. A first long reference entry here. Journal, 2020.\n' +
            'BROWN, K. A second long reference entry here. Journal, 2019.\n' +
            'JONES, L. A third long reference entry here. Journal, 2018.'
        const flags = await analisarInventario(doc(texto))

        const foraDaFaixa = flags.find((x) => x.titulo === 'Citação numérica sem entrada correspondente na lista')
        expect(foraDaFaixa).toBeDefined()
        expect(foraDaFaixa!.evidencia).toContain('[9]')

        const nuncaCitada = flags.find((x) => x.titulo === 'Entradas da lista que nunca são citadas por número')
        expect(nuncaCitada).toBeDefined()
        expect(nuncaCitada!.evidencia).toContain('#3')
    })

    it('estilo numérico não dispara a regra 7 (autor-data) simultaneamente', async () => {
        const texto =
            'Fatos aqui [1] e mais [2] e ainda [3].\n' +
            'REFERENCES\n' +
            'SMITH, J. A first long reference entry here. Journal, 2020.\n' +
            'BROWN, K. A second long reference entry here. Journal, 2019.\n' +
            'JONES, L. A third long reference entry here. Journal, 2018.'
        const flags = await analisarInventario(doc(texto))
        expect(flags.find((x) => x.titulo === 'Referências listadas que não aparecem no corpo')).toBeUndefined()
    })

    it('documento real (35 citações, sem lista) gera exatamente a MEDIA esperada', async () => {
        // Reconstrução simplificada do cenário real testado no projeto:
        // muitas citações autor-data, nenhuma lista de referências.
        const citacoes = Array.from({ length: 35 }, (_, i) => `(Autor${i}, ${2000 + (i % 20)})`)
        const texto = citacoes.join(' e também ') + '.'
        const flags = await analisarInventario(doc(texto))
        expect(flags).toHaveLength(1)
        expect(flags[0].titulo).toBe('Citações no corpo sem lista de referências')
        expect(flags[0].evidencia).toContain('35 citações distintas')
    })

    it('documento sem nenhum problema não gera flag nenhuma', async () => {
        const texto =
            'Conforme (SILVA, 2020) isso é verdade.\nREFERÊNCIAS\n' +
            'SILVA, J. Uma entrada de verdade, bem longa o suficiente. Revista, 2020.'
        const flags = await analisarInventario(doc(texto, { modified: '2026-06-01T10:00:00Z' }))
        expect(flags).toEqual([])
    })
})
