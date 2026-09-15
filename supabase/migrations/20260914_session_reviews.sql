alter table public.ensaios
  add column if not exists review_prompted_at timestamptz;

alter table public.site_settings
  add column if not exists google_review_url text;

create table if not exists public.session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ensaios(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  feedback_text text,
  created_at timestamptz not null default now(),
  unique (session_id)
);

alter table public.session_reviews enable row level security;

drop policy if exists "Admins can read session reviews" on public.session_reviews;
create policy "Admins can read session reviews"
on public.session_reviews for select
to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

revoke all on table public.session_reviews from public, anon, authenticated;
grant select on table public.session_reviews to authenticated;

create index if not exists session_reviews_created_at_idx
  on public.session_reviews(created_at desc);

update public.site_settings
set google_review_url = coalesce(nullif(google_review_url, ''), 'https://g.page/r/CVogEUoNe595ECE/review');
