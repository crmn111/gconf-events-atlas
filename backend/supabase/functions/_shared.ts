export type Json = Record<string, unknown>;

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors, ...extra },
  });
}

export function html(body: string, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...cors, ...extra },
  });
}

export function siteUrl() {
  return (Deno.env.get("ATLAS_PUBLIC_URL") || "https://crmn111.github.io/gconf-events-atlas").replace(/\/$/, "");
}

export function fnUrl(name: string) {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/functions/v1/${name}`;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
  tags?: { name: string; value: string }[];
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") || "GConf Events Atlas <alerts@example.invalid>";
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: {
        "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: opts.tags,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || `Resend ${res.status}`);
  return data as { id: string };
}

export function layout(title: string, body: string) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;background:#0A0E12;color:#ECEEF0;font:16px/1.5 "Space Grotesk",system-ui,sans-serif;padding:48px 20px}
  main{max-width:560px;margin:0 auto;background:#12181F;border:1px solid #242C35;border-radius:16px;padding:28px}
  a{color:#1FA9C6} h1{font-size:22px;letter-spacing:-.02em} .eyebrow{color:#CFF55A;font:12px/1.4 ui-monospace,Menlo,monospace}
</style>
<main>
  <div class="eyebrow">↳ GConf.ai · Events Atlas</div>
  <h1>${title}</h1>
  ${body}
  <p><a href="${siteUrl()}/">Back to the atlas</a></p>
</main>`;
}
