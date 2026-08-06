# Triagem Acadêmica

Ferramenta de apoio à correção de trabalhos acadêmicos (`.docx` e `.pdf`). Extrai
**evidências verificáveis** — metadados de edição do documento, verificação de referências
bibliográficas (DOI/PMID), inventário de citações e artefatos de colagem — e as apresenta
num relatório para que o(a) docente interprete.

> **Isto não é um detector de IA.** A ferramenta não calcula score, probabilidade ou
> conclusão de autoria. Ela reúne fatos auditáveis (ex.: "o DOI da referência 7 não existe
> no CrossRef") e deixa a interpretação com a pessoa. O uso defensável não é acusar — é
> **fundamentar uma conversa** com o discente. Chegar com "me explique a referência 7"
> resolve a maioria dos casos sem confronto e sem risco de injustiça.

## Princípios do projeto

- **Nenhum score ou percentual.** Só evidência bruta, sempre acompanhada do dado que a gerou.
- **O documento nunca sai da máquina.** Todo o processamento acontece no navegador da pessoa
  (client-side). Apenas identificadores de referência (DOI/PMID) são consultados em APIs
  públicas — o conteúdo do trabalho jamais é enviado a servidor algum. (LGPD: o trabalho é
  dado de um terceiro, o aluno.)
- **Sem backend, sem instalação.** É um site estático. A usuária final apenas acessa um link.
- **Falha de rede nunca vira alarme.** Se uma API estiver fora do ar, o item vira apenas
  informativo — nunca uma sinalização de severidade alta.
- **Nenhuma base decide sozinha.** Um identificador só é dado como inexistente depois que
  *todas* as bases consultadas o negarem. Se uma delas não respondeu, o resultado é
  "não verificada" — a base ausente poderia ser justamente a que o conhece.
- **Ausência de sinalização não é atestado.** Zero flags significa que nenhuma verificação
  encontrou o que procura, não que o trabalho está aprovado.

## O que é analisado

| Módulo | O que examina | Sinalizações |
|---|---|---|
| `metadata` | tempo de edição, revisões, datas, ciclos de edição, editor declarado | 6 |
| `references` | DOIs e PMIDs citados, verificados em cinco bases, com ano de publicação | 2 |
| `inventory` | citações autor-data e numéricas cruzadas com a lista de referências | 9 |
| `artifacts` | caracteres invisíveis, aspas misturadas, espaçamento anômalo | 4 |
| `fonts` | fonte minoritária no corpo do texto (indício de colagem) | 1 |
| `language` | parágrafos em idioma diferente do predominante no documento | 1 |

A lista completa das 23 regras, com limiares e severidades, está em
[`docs/guia-tecnico.md`](docs/guia-tecnico.md).

## Bases consultadas

| Base | Cobre | Usada para |
|---|---|---|
| CrossRef | periódicos científicos | DOI |
| DataCite | teses, datasets, repositórios institucionais | DOI |
| OpenAlex | agregadora, ~250M obras de todas as áreas | DOI |
| PubMed | biomédica | PMID |
| Europe PMC | biomédica ampliada (inclui preprints) | PMID |

SciELO e LILACS — as bases mais relevantes para a produção médica brasileira em português —
não expõem CORS e portanto são inalcançáveis a partir do navegador.

- **SciELO com DOI já está coberta**, sem precisar de nada extra: os periódicos SciELO
  registram DOI no prefixo `10.1590`, junto ao CrossRef — que já é a primeira base do
  encadeamento. Um artigo real da SciELO foi testado e confirmado lá.
- **LILACS não é contornável com um servidor-ponte simples.** A API pública
  (`pesquisa.bvsalud.org`) tem proteção ativa contra bot (desafio de CDN), não apenas
  ausência de CORS — contornar isso significaria driblar uma proteção anti-abuso, fora do
  escopo do projeto.
- **A API pública da SciELO (ArticleMeta)** é tecnicamente alcançável por um servidor, mas
  só permite busca pelo código interno do artigo (ex.: `S0034-89102010000100001`) — nunca
  pelo DOI, que é o único identificador que a ferramenta extrai do texto. Um proxy não
  teria o que consultar. Buscar por título/autor seria a alternativa, mas já vimos esse
  caminho falhar: uma busca bibliográfica real no CrossRef devolveu, com confiança alta,
  um artigo errado para uma referência em português. O risco de gerar evidência falsa é
  maior que o ganho de cobertura, então esse caminho não foi implementado.

## Como funciona

1. A pessoa seleciona (ou arrasta) a pasta com os trabalhos. Subpastas são incluídas e
   arquivos temporários do Word (`~$…`) são ignorados.
2. Cada arquivo é lido e analisado dentro do próprio navegador, em sequência. Um PDF sem
   texto extraível (digitalizado como imagem) é sinalizado como aviso de leitura, em vez
   de gerar um relatório silenciosamente vazio.
3. A tela mostra a turma em uma tabela ordenada por gravidade, com contagem por severidade,
   métricas de contexto e a distribuição do lote em histogramas.
4. Cada trabalho tem um relatório `.html` autocontido (abre com duplo clique, offline).
5. Um `.zip` reúne todos os relatórios mais um `.csv` consolidado do lote.

> Ao escolher uma pasta, o navegador pode perguntar se você deseja *"enviar"* os arquivos.
> É o texto padrão dele para conceder **leitura** — nenhum upload acontece.

### O que o relatório de cada trabalho contém

- Painel de contagem por severidade (ALTA / MÉDIA / BAIXA / INFO)
- **Ficha do documento**: metadados crus e um resumo da edição em linguagem corrente
- Linha do tempo entre criação e última modificação
- Lista de sinalizações, cada uma com a evidência que a gerou
- **Inventário de citações** do corpo, com forma (parentética ou narrativa), ocorrências,
  trecho de contexto e situação frente à lista de referências
- Faixa mostrando onde as citações se distribuem ao longo do texto
- Lista de referências do trabalho, marcando quais são efetivamente citadas
- Identificadores (DOI/PMID) verificados, com título e **ano de publicação** retornados
  pela base (dado descritivo — a ferramenta não julga se é "antigo demais")
- Texto do trabalho com as citações destacadas e numeradas
- Aviso legal obrigatório

## Requisitos

- [Node.js](https://nodejs.org/) 20 ou superior (inclui o `npm`)
- [Git](https://git-scm.com/)
- Um navegador atual (Chrome, Edge ou Firefox). A seleção de pasta usa o atributo
  `webkitdirectory`, suportado por todos eles.

## Rodando o projeto em outra máquina

```bash
# 1. Clonar o repositório
git clone <URL-DO-REPOSITORIO>
cd triagem-academica

# 2. Instalar as dependências
npm install

# 3. Subir o servidor de desenvolvimento
npm run dev
```

O terminal vai mostrar um endereço local (algo como `http://localhost:5173`). Abra-o no
navegador. O servidor recarrega a página automaticamente quando você salva um arquivo.

### Outros comandos

```bash
npm run build      # verifica os tipos e gera o site estático em dist/
npm run preview    # serve localmente a versão de produção, para conferência
```

## Stack

| Ferramenta | Papel |
|---|---|
| TypeScript | linguagem |
| Vite | build e servidor de desenvolvimento |
| jszip | abrir o `.docx` (que por dentro é um ZIP) e montar o `.zip` de saída |
| fast-xml-parser | ler os XMLs internos do `.docx` |
| pdfjs-dist | extrair texto e metadados de PDF (motor da Mozilla) |

Sem framework de UI (React/Vue) e sem biblioteca de gráficos — a interface é uma página
única e os visuais são SVG gerado como texto, o que mantém o relatório autocontido.

## Estrutura

```
triagem-academica/
├── index.html
├── package.json
├── vite.config.ts            # injeta a versão do package.json no bundle
├── docs/
│   └── guia-tecnico.md       # arquitetura, regras e decisões de projeto
└── src/
    ├── vite-env.d.ts         # declara a constante de versão para o TypeScript
    ├── core/                 # lógica pura — NÃO acessa DOM/window
    │   ├── models.ts         # tipos centrais (Documento, Flag, Inventario...)
    │   ├── config.ts         # limiares, URLs das bases, versão, e-mail de contato
    │   ├── batch.ts          # orquestra a análise de um lote
    │   ├── readers/          # abre .docx e .pdf → Documento normalizado
    │   ├── analyzers/        # cada análise recebe um Documento e devolve Flag[]
    │   ├── services/         # consultas às bases de referência + cache
    │   └── report/           # relatório .html, visuais SVG, .csv e .zip
    └── ui/                   # a página (única parte que toca o navegador)
```

A separação `core/` (lógica pura) × `ui/` (navegador) é intencional: a lógica é testável de
forma isolada e não depende do navegador.

## Estado atual

Implementado e verificado manualmente: leitura de `.docx` e `.pdf`, os seis analisadores,
as cinco bases encadeadas com cache, processamento em lote, relatório `.html`, planilha
`.csv`, `.zip` do lote e as visualizações.

A versão exibida no rodapé e em cada relatório vem de `package.json`, injetada em build
time por `vite.config.ts` — uma única fonte de verdade, sem número duplicado em outro lugar.

Pendente:

- **Testes automatizados.** O projeto ainda não tem nenhum.

- **Calibração dos limiares.** Os valores em `config.ts` são provisórios; os histogramas da
  tela de lote existem justamente para ajustá-los contra uma turma real. Os módulos `fonts`
  e `language`, por operarem sobre texto livre, são os que mais precisam dessa calibração —
  ainda não foram testados contra um lote real de trabalhos.

## Aviso

Este projeto não conclui autoria e não constitui prova de uso de IA. Cada sinalização deve ser
verificada manualmente antes de qualquer decisão acadêmica. Recomenda-se conversa com o(a)
discente antes de qualquer procedimento formal.
