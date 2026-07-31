export type Severidade  = "ALTA" | "MEDIA" | "BAIXA" | "INFO"

export interface Documento {
    nome: string
    formato: 'docx' | 'pdf'
    texto: string
    metadados: Record<string, unknown>
    errosLeitura: string[]
}

export interface Flag{
    modulo: string
    severidade: Severidade
    titulo: string
    evidencia: string
    detalhe?: string
}

export interface Referencia {
    indice: number
    textoOriginal: string
    doi?: string
    pmid?: string
    status: 'valida' | 'nao_encontrada' | 'divergente' | 'sem_identificador' | 'nao_verificada'
    tituloRetornado?: string
    ocorrenciasNoCorpo: number
}

export interface CitacaoEncontrada {
    textoOriginal: string
    ano: string
    chave: string
    ocorrencias: number
    narrativa: boolean
    contexto: string
}

export interface CitacaoNumerica {
    numero: number
    ocorrencias: number
}

export interface ReferenciaListada {
    indice: number
    textoOriginal: string
    chave: string
    sobrenome: string
}

export interface ListaReferencias {
    encontrada: boolean
    entradas: ReferenciaListada[]
}

export interface OcorrenciaCitacao {
    inicio: number
    fim: number
    chave: string
}

export interface Inventario {
    citacoes: CitacaoEncontrada[]
    numericas: CitacaoNumerica[]
    lista: ListaReferencias
    ocorrencias: OcorrenciaCitacao[]
}

export interface ResultadoTriagem{
    doc: Documento,
    flags: Flag[],
    referencias: Referencia[],
    inventario: Inventario,
}

export type Analisador = (doc: Documento) => Promise<Flag[]>
