// Utilidades de saneamento. escapeHtml: escapa entrada não confiável antes de
// interpolar em HTML (e-mail transacional etc.), prevenindo injeção de HTML /
// phishing. Módulo puro (testável).

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
