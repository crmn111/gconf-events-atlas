import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { json, sendResend, fnUrl, siteUrl } from "../_shared.ts";

type EventRow = {
  slug: string;
  name: string;
  city?: string;
  country?: string;
  start_date?: string;
  category?: string;
  topics?: string[];
  ticket_price_min?: number | null;
  ticket_price_max?: number | null;
  currency?: string | null;
  ticket_price_text?: string;
  price_source_url?: string;
  status?: string;
};

function matches(filters: Record<string, unknown>, ev: EventRow) {
  const cats = filters.categories as string[] | undefined;
  if (cats?.length && ev.category && !cats.includes(ev.category)) return false;
  const cities = filters.cities as string[] | undefined;
  if (cities?.length) {
    const key = `${ev.city || "Unknown"}|${ev.country || ""}`;
    if (!cities.includes(key)) return false;
  }
  const topics = filters.topics as string[] | undefined;
  if (topics?.length) {
    const have = ev.topics || [];
    if (!topics.some((t) => have.includes(t))) return false;
  }
  return true;
}

function priceKey(ev: EventRow) {
  return JSON.stringify({
    min: ev.ticket_price_min ?? null,
    max: ev.ticket_price_max ?? null,
    cur: ev.currency ?? null,
    text: ev.ticket_price_text ?? null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const secret = Deno.env.get("ALERTS_CRON_SECRET") || "";
  const hdr = req.headers.get("authorization") || "";
  if (!secret || hdr !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let events: EventRow[] = [];
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (Array.isArray(body.events)) events = body.events;
  } catch { /* empty */ }

  if (!events.length) {
    const src = Deno.env.get("EVENTS_JSON_URL");
    if (!src) return json({ error: "Pass {events} or set EVENTS_JSON_URL." }, 400);
    const res = await fetch(src);
    const data = await res.json();
    events = Array.isArray(data) ? data : (data.events || []);
  }
  events = events.filter((e) => String(e.status || "").toLowerCase() === "upcoming" && e.slug && e.name);

  const { data: latestSnaps } = await supabase
    .from("price_snapshots")
    .select("event_slug,ticket_price_min,ticket_price_max,currency,ticket_price_text,captured_at")
    .order("captured_at", { ascending: false });
  const last = new Map<string, Record<string, unknown>>();
  for (const row of latestSnaps || []) {
    if (!last.has(row.event_slug)) last.set(row.event_slug, row);
  }

  const newEvents: EventRow[] = [];
  const changed: { ev: EventRow; before: Record<string, unknown> }[] = [];
  const snapRows = [];
  for (const ev of events) {
    const prev = last.get(ev.slug);
    if (!prev) {
      newEvents.push(ev);
    } else if (priceKey(ev) !== priceKey({
      slug: ev.slug, name: ev.name,
      ticket_price_min: prev.ticket_price_min as number,
      ticket_price_max: prev.ticket_price_max as number,
      currency: prev.currency as string,
      ticket_price_text: prev.ticket_price_text as string,
    })) {
      changed.push({ ev, before: prev });
    }
    snapRows.push({
      event_slug: ev.slug,
      ticket_price_min: ev.ticket_price_min ?? null,
      ticket_price_max: ev.ticket_price_max ?? null,
      currency: ev.currency ?? null,
      ticket_price_text: ev.ticket_price_text ?? null,
      source_url: ev.price_source_url ?? null,
    });
  }
  if (snapRows.length) await supabase.from("price_snapshots").insert(snapRows);

  const { data: subs } = await supabase.from("subscribers")
    .select("id,email,filters,unsubscribe_token")
    .eq("status", "confirmed");

  const queue: Record<string, unknown>[] = [];
  for (const sub of subs || []) {
    const filters = (sub.filters || {}) as Record<string, unknown>;
    for (const ev of newEvents) {
      if (matches(filters, ev)) {
        queue.push({ subscriber_id: sub.id, kind: "new_event", event_slug: ev.slug, payload: { ev }, status: "pending" });
      }
    }
    for (const { ev, before } of changed) {
      if (matches(filters, ev)) {
        queue.push({ subscriber_id: sub.id, kind: "price_change", event_slug: ev.slug, payload: { ev, before }, status: "pending" });
      }
    }
  }
  if (queue.length) await supabase.from("alert_queue").insert(queue);

  const { data: pending } = await supabase.from("alert_queue")
    .select("id,subscriber_id,kind,event_slug,payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  const bySub = new Map<string, typeof pending>();
  for (const row of pending || []) {
    const list = bySub.get(row.subscriber_id) || [];
    list.push(row);
    bySub.set(row.subscriber_id, list);
  }
  const subById = new Map((subs || []).map((s) => [s.id, s]));

  let sent = 0, failed = 0;
  for (const [sid, rows] of bySub) {
    const sub = subById.get(sid);
    if (!sub) continue;
    const unsubUrl = `${fnUrl("unsubscribe")}?token=${sub.unsubscribe_token}`;
    const items = rows!.map((r) => {
      const ev = (r.payload as { ev: EventRow }).ev;
      const kind = r.kind === "price_change" ? "Ticket price change" : "New event";
      return `<li><strong>${kind}:</strong> <a href="${siteUrl()}/#/event/${ev.slug}">${ev.name}</a> — ${ev.city || ""} ${ev.ticket_price_text || ""}</li>`;
    }).join("");
    const text = rows!.map((r) => {
      const ev = (r.payload as { ev: EventRow }).ev;
      return `${r.kind}: ${ev.name} ${siteUrl()}/#/event/${ev.slug}`;
    }).join("\n");
    try {
      const res = await sendResend({
        to: sub.email,
        subject: "GConf Events Atlas: updates that match your filters",
        unsubscribeUrl: unsubUrl,
        tags: [{ name: "template", value: "digest" }],
        text: `${text}\n\nUnsubscribe: ${unsubUrl}`,
        html: `<p>Updates that match your filters:</p><ul>${items}</ul>
          <p><a href="${siteUrl()}/">Open the atlas</a></p>
          <p><a href="${unsubUrl}">Unsubscribe</a></p>`,
      });
      const ids = rows!.map((r) => r.id);
      await supabase.from("alert_queue").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", ids);
      await supabase.from("email_log").insert({
        subscriber_id: sid, template: "digest",
        subject: "GConf Events Atlas: updates that match your filters",
        resend_id: res.id, to_email: sub.email, status: "sent",
        headers: { "List-Unsubscribe": unsubUrl },
      });
      await supabase.from("subscribers").update({ last_alerted_at: new Date().toISOString() }).eq("id", sid);
      sent++;
    } catch (err) {
      const ids = rows!.map((r) => r.id);
      await supabase.from("alert_queue").update({ status: "failed", error: String(err) }).in("id", ids);
      await supabase.from("email_log").insert({
        subscriber_id: sid, template: "digest", to_email: sub.email,
        status: "failed", error: String(err),
      });
      failed++;
    }
  }

  return json({
    ok: true,
    events: events.length,
    newEvents: newEvents.length,
    priceChanges: changed.length,
    queued: queue.length,
    emailsSent: sent,
    emailsFailed: failed,
  });
});
