import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { html, json, layout, sendResend, fnUrl, siteUrl } from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return html(layout("Missing token", "<p>This confirmation link is incomplete.</p>"), 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: sub } = await supabase.from("subscribers")
    .select("id,email,status,unsubscribe_token")
    .eq("confirm_token", token).maybeSingle();

  if (!sub) return html(layout("Link expired", "<p>This confirmation link is not valid. Request a new one from the atlas.</p>"), 400);
  if (sub.status === "unsubscribed") {
    return html(layout("Already unsubscribed", "<p>This address was unsubscribed. Sign up again on the atlas if you want alerts.</p>"));
  }

  if (sub.status !== "confirmed") {
    await supabase.from("subscribers").update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
    }).eq("id", sub.id);

    const unsubUrl = `${fnUrl("unsubscribe")}?token=${sub.unsubscribe_token}`;
    try {
      const sent = await sendResend({
        to: sub.email,
        subject: "You are subscribed to GConf Events Atlas alerts",
        unsubscribeUrl: unsubUrl,
        tags: [{ name: "template", value: "welcome" }],
        text: `You are subscribed. Open the atlas: ${siteUrl()}/\nUnsubscribe at any time: ${unsubUrl}`,
        html: `<p>Your subscription is confirmed. We will email you when matching events are added or ticket prices change.</p>
          <p><a href="${siteUrl()}/">Open the atlas</a></p>
          <p><a href="${unsubUrl}">Unsubscribe</a></p>`,
      });
      await supabase.from("email_log").insert({
        subscriber_id: sub.id, template: "welcome",
        subject: "You are subscribed to GConf Events Atlas alerts",
        resend_id: sent.id, to_email: sub.email, status: "sent",
        headers: { "List-Unsubscribe": unsubUrl },
      });
    } catch (err) {
      await supabase.from("email_log").insert({
        subscriber_id: sub.id, template: "welcome", to_email: sub.email,
        status: "failed", error: String(err),
      });
    }
  }

  const redirect = `${siteUrl()}/#/alerts/confirmed`;
  return html(layout("Subscription confirmed", `<p>You are on the list. <a href="${redirect}">Return to the atlas</a>.</p>`), 200, {
    Location: redirect,
  });
});
