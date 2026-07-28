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

export type Analisador = (doc: Documento) => Promise<Flag[]>
