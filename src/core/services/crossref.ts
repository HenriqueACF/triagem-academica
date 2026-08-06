import {CONFIG} from "../config.ts";

export interface ResultadoConsulta{
    status: 'valida' | 'nao_encontrada' | 'nao_verificada'
    titulo?: string
    ano?: number
}

export async function consultarDoi(doi: string): Promise<ResultadoConsulta>{
    const url = `${CONFIG.crossrefBase}/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CONFIG.mailto)}`;

    try {
        const res = await fetch(url)

        if (res.status === 404) {
            return {status: 'nao_encontrada'}
        }

        if (!res.ok) {
            return {status: "nao_verificada"}
        }

        const json = await res.json()
        const titulo = json?.message?.title?.[0]
        const ano = json?.message?.issued?.['date-parts']?.[0]?.[0]
        return {
            status: 'valida',
            titulo: typeof titulo === 'string' ? titulo : undefined,
            ano: typeof ano === 'number' ? ano : undefined,
        }

    }catch {
        return {status: 'nao_verificada'}
    }
}

