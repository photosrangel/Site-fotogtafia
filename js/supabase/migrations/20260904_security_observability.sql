create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  outcome text not null check (outcome in ('success','failure','blocked','info')),
  ip_hash text,
  subject_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;

create table if not exists public.security_rate_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from anon, authenticated;
create index if not exists security_events_created_at_idx on public.security_events(created_at desc);

alter table public.galleries add column if not exists seo_title text;
alter table public.galleries add column if not exists seo_description text;
alter table public.galleries add column if not exists social_image_url text;
alter table public.galleries add column if not exists canonical_slug text;
alter table public.gallery_photos add column if not exists alt_text text;

create or replace function public.cleanup_security_events() returns void language sql security definer set search_path=public as $$
  delete from public.security_events where created_at < now() - interval '90 days';
  delete from public.security_rate_limits where window_started_at < now() - interval '2 days';
$$;
revoke all on function public.cleanup_security_events() from public, anon, authenticated;
