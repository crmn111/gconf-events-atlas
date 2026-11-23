import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { html, json, layout, siteUrl } from "../_shared.ts";

async function unsub(token: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: sub } = await supabase.from("subscribers")
    .select("id,status").eq("unsubscribe_token", token).maybeSingle();
  if (!sub) return { ok: false as const };
  if (sub.status !== "unsubscribed") {
    await supabase.from("subscribers").update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
    }).eq("id", sub.id);
    await supabase.from("consents").update({
      granted: false,
      withdrawn_at: new Date().toISOString(),
    }).eq("subscriber_id", sub.id).eq("granted", true);
    await supabase.from("organiser_leads").update({ status: "withdrawn" })
      .eq("subscriber_id", sub.id).eq("status", "held");
  }
  return { ok: true as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  if (!token && req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      token = String(body.token || "");
    } else {
      const form = await req.formData().catch(() => null);
      token = String(form?.get("token") || form?.get("List-Unsubscribe") || "");
    }
  }
  if (!token) return html(layout("Missing token", "<p>This unsubscribe link is incomplete.</p>"), 400);
  const result = await unsub(token);
  if (!result.ok) return html(layout("Link not recognised", "<p>This unsubscribe link is not valid.</p>"), 400);
  const page = layout("You are unsubscribed", `<p>You will not get further alert emails from the GConf Events Atlas. <a href="${siteUrl()}/">Return to the atlas</a>.</p>`);
  if (req.method === "POST") return json({ ok: true, message: "Unsubscribed." });
  return html(page);
});
