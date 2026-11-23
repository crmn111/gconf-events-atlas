-- GConf Events Atlas · alerts schema
-- Apply with: supabase db push   (or paste into the SQL editor)
-- RLS is enabled on every table. The anon key can do nothing useful
-- except hit the edge functions, which use the service role.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  status text not null default 'pending'
    check (status in ('pending','confirmed','unsubscribed')),
  confirm_token text unique,
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_alerted_at timestamptz
);

create index if not exists subscribers_status_idx on public.subscribers (status);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  kind text not null check (kind in ('alerts','organiser_share')),
  granted boolean not null default false,
  event_slug text,
  source text not null default 'signup',
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists consents_subscriber_idx on public.consents (subscriber_id);

create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  ticket_price_min numeric,
  ticket_price_max numeric,
  currency text,
  ticket_price_text text,
  source_url text,
  captured_at timestamptz not null default now()
);

create index if not exists price_snapshots_slug_idx
  on public.price_snapshots (event_slug, captured_at desc);

create table if not exists public.alert_queue (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  kind text not null check (kind in ('new_event','price_change','confirm','welcome')),
  event_slug text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists alert_queue_pending_idx
  on public.alert_queue (status, created_at) where status = 'pending';

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references public.subscribers(id) on delete set null,
  template text not null,
  subject text,
  resend_id text,
  to_email text,
  headers jsonb,
  status text not null default 'queued',
  error text,
  sent_at timestamptz not null default now()
);

create table if not exists public.organiser_leads (
  id uuid primary key default gen_random_uuid(),
  event_slug text,
  subscriber_id uuid references public.subscribers(id) on delete set null,
  email text,
  consent_id uuid references public.consents(id) on delete set null,
  status text not null default 'held'
    check (status in ('held','released','withdrawn')),
  notes text,
  created_at timestamptz not null default now()
);
-- Leads are held, never sent on, until a later product decision.

create table if not exists public.listing_views (
  event_slug text not null,
  day date not null default (timezone('utc', now()))::date,
  count integer not null default 0,
  primary key (event_slug, day)
);
-- Counts only. No IP, user agent, or subscriber id is stored.

alter table public.subscribers enable row level security;
alter table public.consents enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.alert_queue enable row level security;
alter table public.email_log enable row level security;
alter table public.organiser_leads enable row level security;
alter table public.listing_views enable row level security;

-- No direct anon/authenticated policies. Edge functions use the service role,
-- which bypasses RLS. This keeps emails and consents off the client.

comment on table public.subscribers is 'Alert subscribers. Status stays pending until the confirm link is used.';
comment on table public.consents is 'Separate rows for alert consent and organiser-share consent.';
comment on table public.organiser_leads is 'Held only. Do not email organisers from this table automatically.';
comment on table public.listing_views is 'Privacy-friendly daily view counts, no identifiers.';
