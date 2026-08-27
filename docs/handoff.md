# Handoff — Triagem Acadêmica

Documento de continuidade: onde o projeto está, como chegou aqui, e o que falta. Serve
tanto para retomar o trabalho numa sessão futura quanto para qualquer pessoa nova que
precise entender o estado real do projeto rapidamente.

Para a arquitetura e as regras em detalhe, ver [`guia-tecnico.md`](guia-tecnico.md). Para a
visão de uso e princípios, ver [`../readme.md`](../readme.md). Este documento é o terceiro
ângulo: **estado e histórico**, não arquitetura nem uso.

---

## O que é, em uma frase

Ferramenta client-side de apoio à correção de trabalhos acadêmicos (`.docx`/`.pdf`) que
reúne evidências verificáveis — nunca score, nunca conclusão de autoria — para fundamentar
uma conversa entre professor(a) e aluno(a).

## Status em uma frase

**Núcleo funcional completo, testado e publicado.** Calibração dos limiares e alguns
módulos de apresentação seguem pendentes — detalhado abaixo.

---

## Progresso

- [x] Passo 0 — Scaffold Vite (vanilla-ts) + deps (jszip, fast-xml-parser, pdfjs-dist, vitest)
- [x] Passo 1 — Fundações e leitura de `.docx` (metadados, texto, rsids)
- [x] Passo 2 — `analyzers/metadata.ts` (6 regras) + `report/html.ts`
- [x] Passo 4 — `readers/pdf.ts` (pdfjs-dist), incluindo aviso de PDF digitalizado sem texto
- [x] Passo 5 — Verificação de referências: 5 bases encadeadas (CrossRef → DataCite →
      OpenAlex para DOI; PubMed → Europe PMC para PMID) + cache + `analyzers/references.ts`
- [x] Passo 6 — `analyzers/inventory.ts`: citações autor-data (parentética e narrativa),
      citações numéricas (`[n]`), cruzamento com a lista de referências
- [x] Passo 7 — `analyzers/artifacts.ts` (4 regras: caracteres invisíveis, aspas mistas,
      espaços não separáveis, espaçamento múltiplo)
- [x] Passo 8 — Lote completo: seleção/arrastar de pasta, `report/csv.ts`, `report/zip.ts`,
      processamento sequencial com isolamento de falha por analisador
- [x] Passo 9 — Deploy: publicado na Vercel — **`<URL AQUI — preencher>`**
- [x] Extra — `analyzers/fonts.ts` (1 regra: fonte minoritária) e `analyzers/language.ts`
      (1 regra: trecho em idioma diferente do predominante)
- [x] Extra — Ano de publicação das referências verificadas (dado descritivo, nunca flag)
- [x] Extra — Rodapé com versão da ferramenta (`__APP_VERSION__`, injetada do
      `package.json` via `vite.config.ts` — fonte única)
- [x] Extra — Visualizações: histogramas do lote, faixa de posição das citações, linha do
      tempo de edição, texto do trabalho com citações destacadas
- [x] Extra — **179 testes automatizados** (Vitest) cobrindo `analyzers/`, `services/`,
      `readers/`, `batch.ts` e `report/csv.ts`
- [ ] Passo 3 — Calibração dos limiares (§11 do plano original) — **bloqueado**: depende de
      a professora ter uma turma inteira de trabalhos reais, sem previsão

### Investigado e conscientemente não implementado

- **SciELO/LILACS como bases adicionais de verificação.** SciELO com DOI já está coberta
  via CrossRef (prefixo `10.1590`). A API pública da SciELO (ArticleMeta) só busca por
  código interno, nunca por DOI — um proxy não teria o que consultar. LILACS tem bloqueio
  de bot ativo (WAF), não CORS — contornar seria driblar proteção anti-abuso. Busca por
  título foi descartada pelo risco de correspondência errada (testado e confirmado com o
  próprio CrossRef). Detalhe completo em `guia-tecnico.md §6`.

---

## O que ficou fora desta fase

- **Testes de `report/html.ts`, `visuais.ts`, `zip.ts` e tudo em `ui/`.** São geração de
  string de apresentação e DOM; verificados manualmente ao longo do projeto (screenshots,
  medição de layout, testes end-to-end no navegador), mas sem cobertura automatizada.
  Motivo do corte: `core/analyzers`, `core/services` e `core/readers` tinham histórico real
  de bugs (ver seção abaixo) e eram testáveis em Node puro sem jsdom; a UI exigiria outro
  tipo de investimento (jsdom ou testes no navegador).
- **Painel de calibração ao vivo, marcar-como-revisado, hash de arquivo idêntico, vestígios
  de edição do `.docx` (comentários, controle de alterações).** Ideias discutidas e
  aprovadas em conversa, não implementadas — ficam como próximos passos candidatos.
- **Vancouver com número sobrescrito** não é detectável — a formatação se perde na
  extração de texto (limitação estrutural, não escopo cortado).

---

## Modo de trabalho (como o projeto foi construído)

Começou como ensino passo a passo: Henrique escrevia cada arquivo a partir de trechos
explicados no chat, sem o Claude usar ferramentas de escrita direto. Isso mudou ao longo do
projeto — depois de algumas rodadas de depuração colaborativa (ver histórico de bugs
abaixo), o modo passou a alternar conforme o pedido explícito da mensagem:

- **"Implemente" / "faça"** → Claude escreve direto, com verificação (`tsc`, testes,
  checagem manual no navegador) antes de reportar concluído.
- **"Me mostre como fazer" / "não implemente"** → Claude explica o passo a passo com
  arquivo e linha exatos, Henrique aplica.

Ambos os modos foram usados de forma real ao longo da conversa — não é uma regra fixa, é
sensível ao que cada mensagem pediu.

## Onde estão as decisões de princípio

O projeto tem um conjunto de princípios não negociáveis que vale relembrar antes de mexer
em qualquer coisa (detalhados no `readme.md`):

1. Nenhum score/percentual — só evidência bruta.
2. O documento nunca sai da máquina (zero backend; só identificadores vão a APIs públicas).
3. Falha de rede nunca vira alarme (sempre INFO, nunca ALTA).
4. Nenhuma base decide sozinha que um identificador "não existe".
5. Ausência de sinalização não é atestado de nada.

Qualquer feature nova deve ser avaliada contra esses cinco pontos antes de ser construída —
foi o critério usado para recusar, por exemplo, a busca por título nas bases de referência
e qualquer forma de "score de risco".

---

## Histórico de bugs reais (por que os testes importam)

Ao longo do projeto, os seguintes bugs de produção foram encontrados — a maioria só na
marra, testando manualmente contra o `.docx` real da professora:

| Bug | Onde | Como foi achado |
|---|---|---|
| `json.message.titulo` em vez de `.title` | `crossref.ts` | Teste manual no console |
| URL quebrada em 3 linhas numa template string | `pubmed.ts` | Teste manual no console |
| `if (registro)` em vez de `if (!registro)` | `pubmed.ts` | Teste manual no console |
| `;` de coautoria descartava o 1º autor (17% das citações reais) | `inventory.ts` | Teste contra o `.docx` real |
| Autor institucional carregava o ponto na chave (`brasil.` ≠ `brasil`) | `inventory.ts` | Teste com dado sintético |
| Parêntese sobrando (erro de sintaxe) | `fonts.ts` | `tsc` |
| **Rede de segurança da regra 7 buscava na lista inteira, incluindo a própria entrada — a regra nunca disparava de verdade** | `inventory.ts` | **Escrevendo o teste automatizado** |
| **Referência em várias linhas virava entradas separadas — sobrenome e ano em linhas diferentes, e a regra 6 (citação que não consta na lista) disparava em falso para todas as citações do 1º autor** | `inventory.ts` | **Relato da professora em trabalho real (qualificação de doutorado), reproduzido e corrigido em 2026-08-27** |
| **Cabeçalho numerado ("5. Bibliografia") não era localizado — a regra 1 alegava "nenhuma seção de referências"** | `inventory.ts` | **Mesmo trabalho real: o cabeçalho saía colado ao número da página no PDF ("355. Bibliografia1. Fried...")** |
| **Lista Vancouver numerada: o número na frente da entrada virava a chave ("1\|2001"), e a regra 6 disparava em falso para citações autor-data** | `inventory.ts` | **Mesmo trabalho real (referências numeradas 1-41, corpo com citações autor-data)** |
| **PDF: fragmentos de texto colados sem espaço quebravam sobrenomes e citações ("Drouinet", "Ferrucci&")** | `readers/pdf.ts` | **Mesmo trabalho real: a extração unia os itens do pdfjs com `''`** |

O último é o mais importante para justificar a suíte de testes: foi um bug real, silencioso,
introduzido numa correção posterior, e só apareceu ao escrever `inventory.test.ts` — exatamente
o cenário que os cinco bugs anteriores (todos achados manualmente, um por um) deveriam ter
ensinado a evitar.

---

## Pendências, em ordem de prioridade

1. **Calibração dos limiares (`config.ts`)** — bloqueada externamente. Os histogramas da
   tela de lote já são o instrumento para isso; falta só a professora ter uma turma inteira
   de trabalhos para rodar.
2. **Preencher a URL da Vercel neste documento** e no `readme.md`.
3. **Cobertura de teste para `report/` e `ui/`** — não bloqueante, mas é a maior lacuna que
   resta na rede de segurança.
4. Ideias discutidas e aprovadas, não implementadas: hash de arquivo idêntico no lote,
   vestígios de edição no `.docx` (comentários, controle de alterações), marcar trabalho
   como revisado (localStorage), painel de calibração ao vivo.

## Comandos úteis

```bash
npm run dev         # servidor de desenvolvimento
npm run build       # tsc + build de produção
npm test            # roda a suíte de testes (vitest run)
npm run test:watch  # testes em modo observação
```
