import type { Documento, Flag, Severidade } from '../models.ts'
function escapar(texto: string): string {
    return texto
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

const ORDEM: Severidade[] = ['ALTA', 'MEDIA', 'BAIXA', 'INFO']

const ROTULO: Record<Severidade, string> = {
    ALTA: 'ALTA',
    MEDIA: 'MÉDIA',
    BAIXA: 'BAIXA',
    INFO: 'INFO',
}

const COR: Record<Severidade, string> = {
    ALTA: '#c0392b',
    MEDIA: '#d68910',
    BAIXA: '#7f8c8d',
    INFO: '#2980b9',
}

const AVISO_LEGAL =
    'Este relatório não conclui autoria e não constitui prova de uso de IA. ' +
    'Cada sinalização deve ser verificada manualmente antes de qualquer decisão ' +
    'acadêmica. Recomenda-se conversa com o(a) discente antes de qualquer ' +
    'procedimento formal.'

export function gerarRelatorioHtml(doc: Documento, flags: Flag[]): string {
    const contagem: Record<Severidade, number> = { ALTA: 0, MEDIA: 0, BAIXA: 0, INFO: 0 }
    for (const f of flags) contagem[f.severidade]++

    const painel = ORDEM.map((sev) => `
        <div class="caixa" style="border-color:${COR[sev]}">
            <div class="numero" style="color:${COR[sev]}">${contagem[sev]}</div>
            <div class="rotulo">${ROTULO[sev]}</div>
        </div>`).join('')

    const flagsOrdenadas = [...flags].sort(
        (a, b) => ORDEM.indexOf(a.severidade) - ORDEM.indexOf(b.severidade),
    )

    const lista = flagsOrdenadas.length === 0
        ? '<p class="vazio">Nenhuma sinalização de metadados.</p>'
        : flagsOrdenadas.map((f) => `
        <div class="flag">
            <span class="tag" style="background:${COR[f.severidade]}">${ROTULO[f.severidade]}</span>
            <div class="corpo">
                <div class="titulo">${escapar(f.titulo)}</div>
                <div class="evidencia">${escapar(f.evidencia)}</div>
                ${f.detalhe ? `<div class="detalhe">${escapar(f.detalhe)}</div>` : ''}
            </div>
        </div>`).join('')

    const geradoEm = new Date().toLocaleString('pt-BR')

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Triagem — ${escapar(doc.nome)}</title>
<style>
    body { font-family: system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
    .sub { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .painel { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
    .caixa { flex: 1; border: 2px solid; border-radius: 8px; padding: 0.75rem; text-align: center; }
    .numero { font-size: 1.8rem; font-weight: bold; }
    .rotulo { font-size: 0.75rem; letter-spacing: 0.05em; color: #555; }
    .flag { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-top: 1px solid #eee; }
    .tag { color: #fff; font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.5rem; border-radius: 4px; height: fit-content; }
    .titulo { font-weight: 600; }
    .evidencia { color: #333; font-size: 0.9rem; margin-top: 0.15rem; }
    .detalhe { color: #777; font-size: 0.8rem; margin-top: 0.15rem; }
    .vazio { color: #666; font-style: italic; }
    .aviso { margin-top: 2rem; padding: 0.85rem 1rem; background: #f7f7f7; border-left: 4px solid #999; font-size: 0.8rem; color: #555; }
</style>
</head>
<body>
    <h1>Triagem Acadêmica</h1>
    <div class="sub">${escapar(doc.nome)} · gerado em ${escapar(geradoEm)}</div>
    <div class="painel">${painel}</div>
    ${lista}
    <div class="aviso">${AVISO_LEGAL}</div>
</body>
</html>`
}
