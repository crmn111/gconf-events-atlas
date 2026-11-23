import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  json, isEmail, normalizeEmail, sendResend, fnUrl, siteUrl,
} from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const email = String(body.email || "");
  if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  if (body.alert_consent !== true) {
    return json({ error: "Alerts consent is required." }, 400);
  }

  const norm = normalizeEmail(email);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const eventSlug = String(body.event_slug || "") || null;
  const share = body.organiser_share === true;
  const confirmToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const { data: existing } = await supabase
    .from("subscribers")
    .select("id,status,confirm_token,unsubscribe_token")
    .eq("email_normalized", norm)
    .maybeSingle();

  let subscriber = existing;
  if (!existing) {
    const { data, error } = await supabase.from("subscribers").insert({
      email: email.trim(),
      email_normalized: norm,
      status: "pending",
      confirm_token: confirmToken,
      filters,
    }).select("id,status,confirm_token,unsubscribe_token").single();
    if (error) return json({ error: "Could not save subscription." }, 500);
    subscriber = data;
  } else if (existing.status === "unsubscribed") {
    const { error } = await supabase.from("subscribers").update({
      status: "pending",
      confirm_token: confirmToken,
      filters,
      unsubscribed_at: null,
    }).eq("id", existing.id);
    if (error) return json({ error: "Could not reopen subscription." }, 500);
    subscriber = { ...existing, status: "pending", confirm_token: confirmToken };
  } else if (existing.status === "confirmed") {
    await supabase.from("subscribers").update({ filters }).eq("id", existing.id);
    return json({ ok: true, message: "You are already subscribed. Your filters have been updated." });
  } else {
    await supabase.from("subscribers").update({
      confirm_token: existing.confirm_token || confirmToken,
      filters,
    }).eq("id", existing.id);
    subscriber = { ...existing, confirm_token: existing.confirm_token || confirmToken };
  }

  const sid = subscriber!.id as string;
  const upsertConsent = async (kind: "alerts" | "organiser_share", granted: boolean) => {
    const { data: row } = await supabase.from("consents")
      .select("id").eq("subscriber_id", sid).eq("kind", kind)
      .eq("event_slug", kind === "organiser_share" ? eventSlug : null)
      .maybeSingle();
    const patch = {
      subscriber_id: sid,
      kind,
      granted,
      event_slug: kind === "organiser_share" ? eventSlug : null,
      source: "signup",
      granted_at: granted ? new Date().toISOString() : null,
      withdrawn_at: granted ? null : new Date().toISOString(),
    };
    if (row) await supabase.from("consents").update(patch).eq("id", row.id);
    else {
      const { data } = await supabase.from("consents").insert(patch).select("id").single();
      return data?.id as string | undefined;
    }
    return row?.id as string | undefined;
  };

  await upsertConsent("alerts", true);
  const consentId = await upsertConsent("organiser_share", share);
  if (share) {
    await supabase.from("organiser_leads").insert({
      event_slug: eventSlug,
      subscriber_id: sid,
      email: email.trim(),
      consent_id: consentId || null,
      status: "held",
      notes: "Held. Do not contact the organiser automatically.",
    });
  }

  const confirmUrl = `${fnUrl("confirm")}?token=${subscriber!.confirm_token}`;
  const unsubUrl = `${fnUrl("unsubscribe")}?token=${subscriber!.unsubscribe_token}`;
  try {
    const sent = await sendResend({
      to: email.trim(),
      subject: "Confirm your GConf Events Atlas alerts",
      unsubscribeUrl: unsubUrl,
      tags: [{ name: "template", value: "confirm" }],
      text: `Confirm your alert subscription:\n${confirmUrl}\n\nIf you did not request this, ignore this email.\nUnsubscribe: ${unsubUrl}`,
      html: `<p>Please confirm you want alerts from the GConf Events Atlas.</p>
        <p><a href="${confirmUrl}">Confirm subscription</a></p>
        <p>If you did not request this, ignore this email.</p>
        <p><a href="${unsubUrl}">Unsubscribe</a></p>`,
    });
    await supabase.from("email_log").insert({
      subscriber_id: sid,
      template: "confirm",
      subject: "Confirm your GConf Events Atlas alerts",
      resend_id: sent.id,
      to_email: email.trim(),
      status: "sent",
      headers: { "List-Unsubscribe": unsubUrl },
    });
  } catch (err) {
    await supabase.from("email_log").insert({
      subscriber_id: sid, template: "confirm", to_email: email.trim(),
      status: "failed", error: String(err),
    });
    return json({ error: "Could not send the confirmation email." }, 502);
  }

  return json({ ok: true, message: "Check your inbox to confirm the subscription." });
});
