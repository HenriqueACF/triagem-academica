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

## Como funciona

1. A pessoa seleciona a pasta com os trabalhos.
2. Cada arquivo é lido e analisado dentro do próprio navegador.
3. Para cada trabalho é gerado um relatório `.html` autocontido (abre com duplo clique).
4. Um `.csv` consolidado do lote permite priorizar quais trabalhos abrir primeiro.

O relatório traz um painel de contagem por severidade (ALTA / MÉDIA / BAIXA / INFO), a lista
de sinalizações com a evidência de cada uma, o inventário completo de referências e um aviso
legal obrigatório.

## Requisitos

- [Node.js](https://nodejs.org/) 20 ou superior (inclui o `npm`)
- [Git](https://git-scm.com/)
- Um navegador **Chromium** (Google Chrome ou Microsoft Edge) para a versão final — a seleção
  de pasta usa a *File System Access API*, disponível nesses navegadores. Há um modo de
  compatibilidade (download individual) para navegadores sem suporte.

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
npm run build      # gera a versão de produção (site estático) na pasta dist/
npm run preview    # serve localmente a versão de produção, para conferência
npm test           # roda os testes automatizados (Vitest)
```

## Stack

| Ferramenta | Papel |
|---|---|
| TypeScript | linguagem |
| Vite | build e servidor de desenvolvimento |
| jszip | abrir o `.docx` (que por dentro é um ZIP) |
| fast-xml-parser | ler os XMLs internos do `.docx` |
| pdfjs-dist | extrair texto e metadados de PDF (motor da Mozilla) |
| Vitest | testes automatizados |

Sem framework de UI (React/Vue) — a interface é uma página única e simples, então dependência
extra seria peso morto.

## Estrutura

```
triagem-academica/
├── index.html
├── vite.config.ts
├── package.json
├── src/
│   ├── core/                 # lógica pura — NÃO acessa DOM/window. Testável isolada.
│   │   ├── models.ts         # tipos centrais (Documento, Flag, Referencia...)
│   │   ├── config.ts         # limiares, URLs das APIs, e-mail de contato
│   │   ├── readers/          # abre .docx e .pdf → Documento normalizado
│   │   ├── analyzers/        # cada análise recebe um Documento e devolve Flag[]
│   │   ├── services/         # chamadas a CrossRef/PubMed + cache
│   │   └── report/           # geração do relatório .html e do .csv
│   └── ui/                   # a página (única parte que toca o navegador)
└── tests/
    └── fixtures/             # arquivos de exemplo para os testes
```

A separação `core/` (lógica pura) x `ui/` (navegador) é intencional: a lógica é testável de
forma isolada e não depende do navegador.

## Deploy

O site é estático e pode ser publicado gratuitamente no **GitHub Pages** ou **Cloudflare Pages**,
com deploy automático a cada `git push`.

## Aviso

Este projeto não conclui autoria e não constitui prova de uso de IA. Cada sinalização deve ser
verificada manualmente antes de qualquer decisão acadêmica. Recomenda-se conversa com o(a)
discente antes de qualquer procedimento formal.
