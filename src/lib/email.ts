import "server-only";

/**
 * S3-8 — E-mail transacional (Resend). PREPARADO mas DESATIVADO por padrão:
 * só envia se RESEND_API_KEY estiver no ambiente (hardening/produção — §fechamento).
 * Sem a chave, é no-op logado (não quebra o agendamento). Sem SDK: fetch direto.
 */
export async function enviarEmail(input: {
  para: string;
  assunto: string;
  html: string;
}): Promise<{ enviado: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM ?? "Sigo Clínicas <nao-responder@sigoclinicas.com>";
  if (!apiKey || !input.para) {
    // Ambiente sem Resend: não envia (comportamento esperado até o hardening).
    return { enviado: false };
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: input.para,
        subject: input.assunto,
        html: input.html,
      }),
    });
    return { enviado: resp.ok };
  } catch {
    return { enviado: false };
  }
}
