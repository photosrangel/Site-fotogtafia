begin;
create extension if not exists pgcrypto;

create table if not exists public.client_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  ensaio_id text not null,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_recovery_tokens_ensaio_idx on public.client_recovery_tokens (ensaio_id, created_at desc);
create index if not exists client_recovery_tokens_expiry_idx on public.client_recovery_tokens (expires_at);
alter table public.client_recovery_tokens enable row level security;
revoke all on table public.client_recovery_tokens from public, anon, authenticated;

create or replace function public.cleanup_client_recovery_tokens() returns void
language sql security definer set search_path = public as $$
  delete from public.client_recovery_tokens where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day';
$$;
revoke all on function public.cleanup_client_recovery_tokens() from public, anon, authenticated;

create or replace function public.reset_client_gallery_password(p_token_hash text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recovery public.client_recovery_tokens%rowtype;
begin
  if p_token_hash is null or length(p_token_hash) <> 64
     or p_new_password is null or length(btrim(p_new_password)) < 6
     or length(btrim(p_new_password)) > 64 then
    return false;
  end if;
  select * into recovery from public.client_recovery_tokens
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  for update;
  if recovery.id is null then return false; end if;
  update public.ensaios set codigo_acesso = btrim(p_new_password)
  where id::text = recovery.ensaio_id;
  if not found then return false; end if;
  update public.client_recovery_tokens set used_at = now() where id = recovery.id;
  return true;
end;
$$;
revoke all on function public.reset_client_gallery_password(text, text) from public, anon, authenticated;
grant execute on function public.reset_client_gallery_password(text, text) to service_role;
commit;
