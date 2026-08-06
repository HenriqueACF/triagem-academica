# Guia técnico — Triagem Acadêmica

Documento de estudo: como o projeto está construído, quais regras ele aplica e por que
cada decisão foi tomada. Complementa o `readme.md`, que é a visão de uso.

---

## 1. A ideia central

O projeto responde a um problema real: a professora recebe uma pasta com dezenas de
trabalhos e precisa decidir quais merecem uma segunda olhada. Detectores de IA não servem
— erram, não são auditáveis e penalizam quem escreve bem.

A aposta aqui é outra: **reunir fatos que qualquer pessoa possa conferir**. "Este DOI não
existe em nenhuma das cinco bases", "estas 35 citações não têm lista de referências",
"o documento foi editado em 8 minutos". Nenhum desses fatos prova nada sozinho — mas todos
podem ser verificados, contestados e explicados numa conversa.

Daí decorre tudo o resto:

| Princípio | Consequência técnica |
|---|---|
| Sem score | não existe função que some pontos; `Flag` não tem peso numérico |
| Evidência bruta sempre | todo `Flag` tem `evidencia` com os números que o geraram |
| Documento não sai da máquina | zero backend; só identificadores vão às APIs |
| Rede fora nunca vira alarme | falha de consulta produz `INFO`, jamais `ALTA` |
| Ausência não é atestado | o relatório diz isso explicitamente quando não há flags |

---

## 2. Arquitetura

```
                     ┌─────────────┐
   arquivo (bytes) → │  readers/   │ → Documento { nome, formato, texto,
                     └─────────────┘                metadados, errosLeitura }
                            │
                            ▼
                     ┌─────────────┐      ┌───────────┐     ┌──────────┐
                     │ analyzers/  │ ───► │ services/ │ ──► │  bases   │
                     └─────────────┘      │  + cache  │     │ externas │
                            │             └───────────┘     └──────────┘
                            ▼
                     Flag[] + Inventario + Referencia[]
                            │
                            ▼
                     ┌─────────────┐
                     │  report/    │ → .html autocontido, .csv, .zip
                     └─────────────┘
```

A regra estrutural: **`core/` nunca toca `document`, `window` ou DOM**. Só `ui/` faz isso.
Por isso toda a lógica é testável sem navegador — e por isso os visuais do relatório são
strings de SVG, não elementos criados via DOM.

### Versão da ferramenta

`CONFIG.versao` vem de `__APP_VERSION__`, uma constante global que `vite.config.ts` injeta
em build time a partir do `version` do `package.json` (bloco `define`). Uma única fonte de
verdade: subir a versão é `npm version` (ou editar o `package.json` direto), e o número
aparece sozinho no rodapé da tela e em cada relatório `.html` gerado dali em diante — útil
para saber, meses depois, qual versão da ferramenta produziu um relatório específico.
`src/vite-env.d.ts` só declara o tipo (`declare const __APP_VERSION__: string`) para o
TypeScript aceitar a variável; quem resolve o valor de fato é o Vite, não roda em `tsc`
isoladamente.

### O fluxo do lote

`batch.ts` orquestra. Duas decisões importantes ali:

1. **Sequencial, não paralelo.** As bases têm limite de taxa (o PubMed aceita 3 requisições
   por segundo sem chave) e o cache só aproveita repetições se elas não acontecerem todas
   ao mesmo tempo.
2. **Isolamento de falhas.** Cada analisador roda dentro de `rodarAnalisador()`, que captura
   exceções e as converte em uma flag `INFO`. Um módulo quebrado não derruba o lote, e um
   arquivo corrompido vira uma linha com o erro registrado em vez de sumir da lista.

---

## 3. Tipos centrais (`models.ts`)

```ts
Documento    { nome, formato: 'docx'|'pdf', texto, metadados, errosLeitura }
Flag         { modulo, severidade, titulo, evidencia, detalhe? }
Severidade   'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO'
Referencia   { indice, doi?, pmid?, status, tituloRetornado?, ocorrenciasNoCorpo }
Inventario   { citacoes, numericas, lista, ocorrencias }
ResultadoTriagem { doc, flags, referencias, inventario }
```

**A severidade é prioridade de revisão, não gravidade da acusação.** ALTA quer dizer
"olhe isto primeiro", não "o aluno fez algo errado".

`Documento.metadados` é `Record<string, unknown>` de propósito: `.docx` e `.pdf` expõem
campos diferentes, e os analisadores tratam a ausência de qualquer campo como "regra não
roda" — nunca como indício.

---

## 4. Leitura de arquivos (`readers/`)

### `.docx` — um ZIP de XMLs

| Arquivo interno | O que fornece |
|---|---|
| `docProps/core.xml` | criador, quem modificou por último, datas, revisões |
| `docProps/app.xml` | tempo total de edição, palavras, caracteres, páginas, editor |
| `word/settings.xml` | rsids — identificadores de sessão de edição |
| `word/document.xml` | o texto |

**Extração de texto — a sutileza que importa.** O Word quebra o texto em várias tags `<w:t>`,
inclusive no meio de uma palavra, quando muda a formatação. Portanto:

- juntar os `<w:t>` **sem separador** dentro de um mesmo parágrafo (senão as palavras se
  estilhaçam);
- quebrar linha **entre** parágrafos, delimitados por `</w:p>` (senão o fim de um parágrafo
  cola no começo do outro, e a regex captura lixo junto).

### `.pdf` — pdfjs-dist

Texto extraído página a página; cada página vira uma linha. Datas em PDF vêm no formato
`D:20260126110800+00'00'` e são convertidas para ISO.

Decisão conservadora: o produtor do PDF **não** é gravado em `metadados.Application`. Um PDF
gerado pelo Chrome informa "Skia/PDF", o que dispararia a regra de "editor incomum" sem
significar nada. Ele vai em `PdfProducer`, que é apenas informativo.

**Limitação estrutural:** a formatação se perde na extração. Um número sobrescrito de
citação Vancouver vira um dígito solto no meio do texto, indistinguível de qualquer outro
número — por isso esse estilo não é detectável.

**PDF digitalizado (sem texto):** depois de extrair o texto de todas as páginas, o leitor
calcula `texto.length / pdf.numPages`. Abaixo de 20 caracteres por página em média, o PDF
provavelmente é uma imagem escaneada sem camada de texto — e isso vira um item em
`errosLeitura`, não uma flag. A distinção importa: sem esse aviso, um PDF escaneado geraria
um relatório com zero sinalizações, que é fácil de confundir com "documento sem problemas".
O aviso deixa explícito que a ferramenta não teve o que examinar.

---

## 5. As 23 regras

### `metadata.ts` — 6 regras

| # | Condição | Limiares | Severidade |
|---|---|---|---|
| 1 | tempo de edição < 30 min **e** palavras ≥ 3000 | `tempoEdicaoMuitoCurtoMin`, `palavrasTempoMuitoCurto` | **ALTA** |
| 2 | tempo de edição < 10 min **e** palavras ≥ 1500 | `tempoEdicaoCurtoMin`, `palavrasTempoCurto` | MÉDIA |
| 3 | revisões ≤ 2 **e** palavras ≥ 1000 | `revisoesBaixas`, `palavrasDocLongo` | MÉDIA |
| 4 | criação → modificação em menos de 15 min | `janelaCriacaoModificacaoMin` | MÉDIA |
| 5 | rsids < 3 **e** palavras ≥ 2000 | `rsidsMinimos`, `palavrasDocGrande` | BAIXA |
| 6 | editor declarado fora da lista conhecida | `editoresConhecidos` | INFO |

As regras 1 e 2 são **exclusivas** (`else if`): se a ALTA dispara, a MÉDIA não repete o
mesmo fato. A regra 6 compara por `includes()`, não por igualdade, porque o Word grava
variações como "Microsoft Office Word" com sufixos de versão.

### `references.ts` — 2 regras

| Situação | Severidade |
|---|---|
| identificador negado por **todas** as bases | **ALTA** |
| não foi possível verificar (rede/serviço) | INFO |
| identificador confirmado | nenhuma flag |

A flag INFO traz no `detalhe` a frase explícita de que isso **não** indica problema com a
referência — sem ela, "não foi possível verificar" seria lido como suspeita.

### `inventory.ts` — 9 regras

| # | Condição | Severidade |
|---|---|---|
| 1 | há citações mas nenhuma seção de referências | MÉDIA |
| 2 | texto > 3000 caracteres sem citação identificável | BAIXA |
| 3 | citação com ano posterior à última edição do documento | MÉDIA |
| 4 | entradas repetidas na lista (mesmo autor + ano) | BAIXA |
| 5 | entrada da lista sem ano identificável | INFO |
| 6 | citação parentética sem entrada correspondente | MÉDIA |
| 7 | entrada da lista que nunca aparece no corpo | BAIXA |
| 8 | citação numérica `[n]` além do tamanho da lista | MÉDIA |
| 9 | entrada nunca citada por número (estilo numérico) | BAIXA |

### `artifacts.ts` — 4 regras

Todas com limiar mínimo de 5 ocorrências (`artefatosMinOcorrencias`), e **nenhuma acima de
BAIXA** — são indícios fracos por natureza, presentes em trabalho legítimo.

| Condição | Severidade |
|---|---|
| caracteres invisíveis (U+200B, U+200C, U+200D, U+00AD, U+FEFF) | BAIXA |
| aspas retas e tipográficas misturadas | INFO |
| espaços não separáveis (U+00A0) em excesso | INFO |
| dois ou mais espaços entre palavras | INFO |

> `referenciaRecenteDias` existe em `config.ts` e **não é usado por regra nenhuma** —
> resíduo de uma ideia não implementada.

### `fonts.ts` — 1 regra

Lê as fontes gravadas em cada `<w:rFonts w:ascii="...">` do `document.xml` (extraídas em
`docx.ts`, guardadas em `metadados.fontesUsadas`) e conta ocorrências. Se uma fonte que não
é a dominante aparece pelo menos `fontesMinOcorrencias` (5) vezes mas continua sendo menos
de `fontesProporcaoMaxima` (5%) do total, isso vira flag BAIXA — "fontes minoritárias no
corpo do texto", com a hipótese de texto colado de outra origem.

**Risco de falso positivo:** moderado. Modelos de trabalho acadêmico usam fonte diferente em
título, citação em bloco ou tabela de propósito — isso é legítimo e pode disparar sem
significar nada. Não usado para `.pdf` (a extração de PDF não captura fontes).

### `language.ts` — 1 regra

Divide o texto em parágrafos (o mesmo split por `\n` usado no inventário de citações) e
classifica cada um como português, inglês ou indefinido, por contagem de palavras comuns
(stopwords) de cada idioma. Parágrafos com menos de 15 palavras são "indefinido" — não há
sinal suficiente. Se **mais de um** parágrafo sai no idioma minoritário do documento, gera
flag INFO — nunca mais que isso, e o `detalhe` explicita que citação direta ou termo técnico
não traduzido é a explicação mais comum.

**Risco de falso positivo:** o maior dos analisadores atuais. Termos técnicos em inglês são
comuns em textos de medicina; o corte por parágrafo (não por frase) reduz o risco, mas o
módulo ainda não foi validado contra um corpus real.

---

## 6. Verificação de referências (`services/`)

### O encadeamento

```
DOI:  CrossRef → DataCite → OpenAlex
PMID: PubMed   → Europe PMC
```

A função `encadear()` implementa a regra que protege o aluno:

- a primeira base que **reconhece** o identificador encerra a busca;
- `nao_encontrada` só é declarado quando **todas** responderam e todas negaram;
- se **qualquer uma** falhou, o resultado é `nao_verificada`.

Sem isso, uma oscilação de rede no meio de um lote de 40 trabalhos produziria flags ALTA
falsas. Isso foi testado derrubando uma base artificialmente.

### Por que várias bases

Um DOI legítimo de dissertação está na **DataCite**, não no CrossRef. Consultado só no
CrossRef, ele daria 404 e viraria ALTA contra um aluno que fez tudo certo. Cada base cobre
um universo diferente, e o DOI da Nature usado nos testes **dá 404 na DataCite** — prova
de que nenhuma delas é autoridade sobre inexistência.

### SciELO e LILACS — por que ficaram de fora

Investigado e descartado, não esquecido. As duas bases mais relevantes para a produção
médica brasileira em português não entraram no encadeamento, por dois motivos distintos:

- **SciELO com DOI já está coberta, sem precisar de nada.** Os periódicos SciELO registram
  DOI no prefixo `10.1590`, no próprio CrossRef — testado com um artigo real, encontrado
  de primeira. A base já é consultada; não há ganho em adicionar outra.
- **A API pública da SciELO (ArticleMeta, `articlemeta.scielo.org`) só busca por código
  interno do artigo** (ex.: `S0034-89102010000100001`), nunca por DOI — testado
  diretamente: o parâmetro `?doi=` é ignorado em silêncio e a API devolve a listagem
  inteira da coleção, sem filtrar nada. Como a ferramenta só extrai DOI e PMID do texto,
  um proxy para essa API não teria identificador nenhum para consultar.
- **LILACS (`pesquisa.bvsalud.org`) não é um caso de CORS ausente — é bloqueio de bot
  ativo.** A resposta do servidor traz `cdn-challenge: true` e um código de erro
  específico, sinal de um WAF que exige resolver um desafio antes de responder. Contornar
  isso significaria construir em torno de uma proteção anti-abuso deliberada, fora do
  escopo do projeto — diferente de simplesmente "adicionar CORS a uma API aberta".
- A alternativa de buscar por **título/autor** (em vez de identificador) foi cogitada e
  descartada: o mesmo teste já feito com a busca bibliográfica do CrossRef mostrou que ela
  pode devolver, com confiança alta, um artigo **errado** para uma referência real em
  português. Sem esse risco resolvido, adicionar mais uma base de busca por texto livre
  aumentaria a chance de gerar evidência falsa — o oposto do que o projeto se propõe a
  fazer.

Se um servidor-ponte (proxy) viesse a ser construído no futuro para outro motivo, ele
também exigiria abrir mão do princípio "sem backend" do projeto — uma decisão de
arquitetura, não só de esforço técnico.

### Cada API mente de um jeito diferente

| Base | Como diz "não existe" |
|---|---|
| CrossRef | HTTP 404 |
| DataCite | HTTP 404 |
| OpenAlex | HTTP 404 |
| PubMed | **HTTP 200** com campo `error` no registro |
| Europe PMC | **HTTP 200** com `hitCount: 0` |

Copiar a lógica do CrossRef para o PubMed faria toda referência inventada passar como
válida. Cada serviço tem seu próprio tratamento.

### Cache

`Map` em memória, chave `tipo:identificador` normalizado. **Só respostas conclusivas são
guardadas** — cachear `nao_verificada` congelaria uma falha momentânea para o lote inteiro.
Medido: 599 ms na primeira consulta, 0,017 ms na segunda.

### Ano de publicação

As cinco bases devolvem o ano de publicação em campos próprios (`issued.date-parts` no
CrossRef, `pubdate` no PubMed — string tipo `"2013 Jul 26"`, exige regex pra extrair só o
ano —, `publicationYear` na DataCite, `publication_year` no OpenAlex, `pubYear` no Europe
PMC). Esse dado vai para `Referencia.anoPublicacao` e aparece no relatório como contexto
puro: uma coluna na tabela de identificadores e um resumo agregado (intervalo, mediana).
**Não vira flag.** "Antigo" depende da área — uma citação de 1975 é normal em filosofia e
pode ser um problema numa diretriz clínica — e esse julgamento não é da ferramenta.

---

## 7. O inventário de citações — a parte mais delicada

É o módulo que mais produz evidência em trabalhos brasileiros, e o que tem maior risco de
falso positivo, porque opera sobre texto livre em português.

### Formas reconhecidas

| Forma | Exemplo | Confiança |
|---|---|---|
| Parentética | `(SILVA, 2020)`, `(Eduardo; Gava, 2012)` | alta |
| Narrativa | `Segundo Silva (2020)`, `According to Smith (2018)` | heurística |
| Numérica | `[1]`, `[2,3]`, `[5-7]` | alta |

### A chave normalizada

Citação e entrada da lista precisam gerar a mesma chave para casarem:
`primeiro sobrenome sem acento, minúsculo, sem pontuação` + `|` + `ano`.

`Loubet et al., 2020` → `loubet|2020`
`LOUBET, P.; RANFAING, J. Alternative... 2020.` → `loubet|2020`

### O problema do ponto e vírgula

`;` tanto separa **obras distintas** (`SILVA, 2010; SOUZA, 2015`) quanto **coautores da
mesma obra** (`Eduardo; Gava, 2012`). A regra que desfaz: *um trecho sem ano é coautor do
trecho seguinte*, então os trechos são acumulados até um deles terminar em ano.

Antes dessa correção, 6 das 36 citações de um documento real perdiam o primeiro autor —
17% do trabalho geraria "citação não consta na lista" indevidamente.

### A assimetria deliberada

Citações **narrativas** contam para dizer que uma referência *foi* citada, mas **não**
geram a flag "citação não consta na lista". O motivo: elas vêm de heurística, e o erro
possível é ler o nome errado. Nessa direção o erro custaria uma acusação injusta; na outra,
custa apenas deixar de sinalizar. Escolhe-se o erro barato.

Há ainda uma rede de segurança: antes de afirmar que uma referência nunca foi citada, o
código procura o sobrenome em qualquer lugar do corpo. Se aparece de alguma forma que não
soubemos interpretar, cala-se.

### A lista de palavras que não são sobrenomes

`Segundo Silva (2020)` — "Segundo" começa a frase com maiúscula e seria lido como
sobrenome. Uma lista de exclusão (`segundo`, `conforme`, `estudo`, `tabela`, `according`,
`the`…) evita isso. Testado: `O estudo (2020) mostrou` e `Na tabela (2019) consta` não
produzem citação alguma.

### O que ficou de fora, e por quê

- **`(1)` como citação numérica**: indistinguível de enumeração (`os fatores são (1) idade,
  (2) sexo`).
- **Vancouver sobrescrito**: a formatação se perde na extração.
- **Comparação aproximada de nomes**: geraria falso
  positivo com facilidade.

---

## 8. Relatório e saídas (`report/`)

- **`html.ts`** — relatório autocontido: todo o CSS embutido, zero dependência externa,
  abre offline com duplo clique. Tem CSS de impressão (`@media print`) para não cortar
  tabelas ao meio.
- **`visuais.ts`** — SVG gerado como string: faixa de posição das citações, linha do tempo
  de edição, texto com citações destacadas.
- **`csv.ts`** — separador `;` e BOM de UTF-8. Os dois detalhes parecem bobos e são a
  diferença entre uma planilha que abre certa no Excel em português e uma que a professora
  não consegue ler. Ordenado por gravidade, porque a função da planilha é dizer por onde
  começar.
- **`zip.ts`** — um `.html` por trabalho mais o `.csv`, com deduplicação de nomes iguais.

**Segurança:** todo texto vindo do documento é escapado antes de entrar no HTML. O nome do
editor, o do arquivo e as evidências são dados de terceiros; um `<script>` num metadado não
pode virar código no relatório.

**Cor:** vermelho aparece nas tags de severidade, onde é pontual e significa algo. Nos
gráficos, série única em azul e cromo em cinza — vermelho num histograma convidaria à
leitura de "risco" que o projeto recusa.

---

## 9. Interface (`ui/`)

- Seleção de pasta via `webkitdirectory` (leitura apenas) — escolhido em vez da *File System
  Access API*, que exige negociação de permissão de **escrita** e só existe em navegadores
  Chromium. A saída é um `.zip`, o que dispensa permissão de escrita.
- Arrastar e soltar pasta usa `webkitGetAsEntry()` com travessia recursiva. **Atenção:**
  `readEntries` devolve no máximo 100 itens por chamada e precisa ser chamado em laço até
  vir vazio — ignorar isso quebra silenciosamente em pastas grandes.
- A barra de progresso só redesenha porque `batch.ts` cede o controle ao navegador
  (`setTimeout(…, 0)`) entre um arquivo e outro.
- Histogramas do lote a partir de 4 trabalhos, com a linha do limiar atual marcada — é o
  instrumento para a calibração ainda pendente.

---

## 10. Glossário

- **rsid** (*revision save ID*): identificador que o Word grava a cada sessão de edição.
  Muitos rsids indicam texto construído em várias sessões; poucos, texto inserido de uma vez.
- **DOI**: identificador permanente de publicação. Emitido por várias agências — daí a
  necessidade de consultar mais de uma base.
- **PMID**: identificador do PubMed, restrito à área biomédica.
- **ABNT autor-data**: `(SOBRENOME, ano)` no corpo, lista ordenada alfabeticamente.
  Padrão dominante em trabalhos de graduação no Brasil.
- **Vancouver**: estilo numérico dominante na medicina internacional.
- **CORS**: mecanismo que permite (ou impede) um site consultar outro domínio pelo
  navegador. Inviabiliza a busca da SciELO (que não expõe o cabeçalho necessário), mas
  **não** é o motivo de a LILACS ficar de fora — essa é bloqueio de bot ativo, ver §6.
- **WAF** (*web application firewall*): camada de proteção de um servidor contra tráfego
  automatizado. É o que bloqueia a LILACS, mesmo em chamadas servidor-a-servidor sem CORS
  envolvido.

---

## 11. Onde mexer para cada tarefa

| Quero… | Arquivo |
|---|---|
| ajustar um limiar | `core/config.ts` |
| criar uma regra nova de metadados | `core/analyzers/metadata.ts` |
| aceitar outro estilo de citação | `core/analyzers/inventory.ts` |
| acrescentar uma base de referências | `core/services/` + encadeamento em `cache.ts` |
| mudar o relatório | `core/report/html.ts` e `visuais.ts` |
| mudar a tela | `ui/main.ts` e `ui/styles.css` |
| suportar outro formato de arquivo | `core/readers/` + despacho em `readers/index.ts` |
| criar um analisador novo | novo arquivo em `core/analyzers/` + registrar em `batch.ts` (import e uma linha no array `flags`) |
| mudar a versão exibida | `package.json` (`version`) — propaga sozinho, nada mais a editar |

Ao criar um analisador novo, ele precisa: seguir a assinatura `(doc) => Promise<Flag[]>`,
não disparar quando o dado necessário estiver ausente, trazer os números na `evidencia`, e
usar `detalhe` para desarmar leituras erradas.
