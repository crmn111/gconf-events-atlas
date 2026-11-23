# Alerts backend (Supabase + Resend)

This folder is ready to deploy but **has not been deployed**. There is no
Supabase project and no Resend API key yet. The public site keeps the
sign-up form in an “Alerts coming soon” state (`config.js`,
`alertsEnabled: false`) until the steps below work end to end.

Do not flip that flag, and do not collect email addresses, until double
opt-in, the confirm page, and one-click unsubscribe have been tested.

## What is here

- `supabase/migrations/0001_init.sql` — tables for `subscribers`,
  `consents`, `price_snapshots`, `alert_queue`, `email_log`,
  `organiser_leads`, `listing_views`, all with RLS enabled (no direct
  anon access; edge functions use the service role).
- `supabase/functions/subscribe` — creates a pending subscriber, stores
  the two consents separately, holds organiser leads (does not contact
  organisers), sends a confirm email via Resend.
- `supabase/functions/confirm` — marks the subscriber confirmed and
  sends a welcome email.
- `supabase/functions/unsubscribe` — one-click GET or POST. Every
  outbound email includes `List-Unsubscribe` and
  `List-Unsubscribe-Post`.
- `supabase/functions/send-alerts` — compares a list of upcoming events
  to the latest price snapshots, queues new-event and price-change
  alerts, and sends a digest to confirmed subscribers whose filters
  match. Protect this function with `ALERTS_CRON_SECRET`.

## Deploy steps

1. Create a Supabase project (region close to Europe is fine).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and
   log in: `supabase login`.
3. From this `backend/` folder (or after `supabase init` + link):

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   Or paste `supabase/migrations/0001_init.sql` into the SQL editor.

4. Create a Resend account. Add and verify a sending domain for GConf
   (DNS records for something such as `mail.gconf.ai` or the root
   domain — Dirk chooses). Create an API key.
5. In the Supabase project, set these secrets (Dashboard → Edge
   Functions → Secrets, or `supabase secrets set`):

   | Secret | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Resend API key |
   | `RESEND_FROM` | e.g. `GConf Events Atlas <alerts@mail.gconf.ai>` once DNS is live |
   | `ATLAS_PUBLIC_URL` | Live atlas URL, e.g. `https://crmn111.github.io/gconf-events-atlas` |
   | `ALLOWED_ORIGIN` | Same origin, or `*` for first tests |
   | `ALERTS_CRON_SECRET` | A long random string |
   | `EVENTS_JSON_URL` | Optional. A URL to `events.json` or `data.js` is not required if the cron job POSTs `{ "events": [...] }`. |

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to
   functions automatically.

6. Deploy the functions:

   ```bash
   supabase functions deploy subscribe --no-verify-jwt
   supabase functions deploy confirm --no-verify-jwt
   supabase functions deploy unsubscribe --no-verify-jwt
   supabase functions deploy send-alerts --no-verify-jwt
   ```

7. Test by calling `subscribe` with a real inbox you control, following
   the confirm link, then the unsubscribe link. Confirm that both emails
   carry a `List-Unsubscribe` header.
8. Schedule `send-alerts` (Supabase cron or an external scheduler) twice
   a week, after the atlas refresh, with
   `Authorization: Bearer $ALERTS_CRON_SECRET`.
9. Only then edit `/config.js` on the site:

   ```js
   window.ATLASCONFIG = {
     alertsEnabled: true,
     supabaseUrl: "https://<project-ref>.supabase.co",
     subscribeFn: "https://<project-ref>.supabase.co/functions/v1/subscribe",
     viewsEnabled: false,
     viewsFn: "",
     claimEmail: ""
   };
   ```

   Publish the config change. The “Alerts coming soon” banner hides
   itself when the flag is on.

## Organiser leads and views

`organiser_leads` rows are stored as `held`. Nothing in these functions
emails an organiser. Release of leads is a later product decision.

`listing_views` is a daily counter with no identifiers. The site has a
stub only (`viewsEnabled: false`). A small increment function can be
added later if Dirk wants it.
