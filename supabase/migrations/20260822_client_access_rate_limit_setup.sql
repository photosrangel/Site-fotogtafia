begin;

create table if not exists public.client_access_rate_limits (
  scope text not null check (scope in ('ip', 'ip_slug')),
  key_hash text not null,
  failures integer not null default 0 check (failures >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

alter table public.client_access_rate_limits enable row level security;
revoke all on table public.client_access_rate_limits from public, anon, authenticated;

create or replace function public.client_access_login_internal(
  p_slug text,
  p_codigo text,
  p_ip_hash text,
  p_pair_hash text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  e public.ensaios%rowtype;
  fotos_json jsonb;
  ip_state public.client_access_rate_limits%rowtype;
  pair_state public.client_access_rate_limits%rowtype;
  current_timestamp_utc timestamptz := statement_timestamp();
  retry_seconds integer;
begin
  if p_slug is null or btrim(p_slug) = '' or length(p_slug) > 160
     or p_codigo is null or btrim(p_codigo) = '' or length(p_codigo) > 160
     or p_ip_hash is null or length(p_ip_hash) <> 64
     or p_pair_hash is null or length(p_pair_hash) <> 64 then
    return jsonb_build_object('erro', 'Acesso inválido.');
  end if;

  insert into public.client_access_rate_limits(scope, key_hash)
  values ('ip', p_ip_hash), ('ip_slug', p_pair_hash)
  on conflict (scope, key_hash) do nothing;

  select * into ip_state
  from public.client_access_rate_limits
  where scope = 'ip' and key_hash = p_ip_hash
  for update;

  select * into pair_state
  from public.client_access_rate_limits
  where scope = 'ip_slug' and key_hash = p_pair_hash
  for update;

  if ip_state.window_started_at < current_timestamp_utc - interval '15 minutes' then
    update public.client_access_rate_limits
    set failures = 0, window_started_at = current_timestamp_utc,
        blocked_until = null, updated_at = current_timestamp_utc
    where scope = 'ip' and key_hash = p_ip_hash
    returning * into ip_state;
  end if;

  if pair_state.window_started_at < current_timestamp_utc - interval '15 minutes' then
    update public.client_access_rate_limits
    set failures = 0, window_started_at = current_timestamp_utc,
        blocked_until = null, updated_at = current_timestamp_utc
    where scope = 'ip_slug' and key_hash = p_pair_hash
    returning * into pair_state;
  end if;

  if coalesce(ip_state.blocked_until, '-infinity'::timestamptz) > current_timestamp_utc
     or coalesce(pair_state.blocked_until, '-infinity'::timestamptz) > current_timestamp_utc then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from (
        greatest(
          coalesce(ip_state.blocked_until, current_timestamp_utc),
          coalesce(pair_state.blocked_until, current_timestamp_utc)
        ) - current_timestamp_utc
      )))::integer
    );
    return jsonb_build_object(
      'erro', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      'rate_limited', true,
      'retry_after', retry_seconds
    );
  end if;

  select * into e
  from public.ensaios
  where slug = btrim(p_slug)
    and codigo_acesso = btrim(p_codigo)
  limit 1;

  if e.id is null then
    update public.client_access_rate_limits
    set failures = failures + 1,
        blocked_until = case
          when failures + 1 >= 25 then current_timestamp_utc + interval '30 minutes'
          else blocked_until
        end,
        updated_at = current_timestamp_utc
    where scope = 'ip' and key_hash = p_ip_hash
    returning * into ip_state;

    update public.client_access_rate_limits
    set failures = failures + 1,
        blocked_until = case
          when failures + 1 >= 5 then current_timestamp_utc + interval '30 minutes'
          else blocked_until
        end,
        updated_at = current_timestamp_utc
    where scope = 'ip_slug' and key_hash = p_pair_hash
    returning * into pair_state;

    if ip_state.blocked_until > current_timestamp_utc
       or pair_state.blocked_until > current_timestamp_utc then
      return jsonb_build_object(
        'erro', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        'rate_limited', true,
        'retry_after', 1800
      );
    end if;

    return jsonb_build_object('erro', 'Acesso inválido.');
  end if;

  delete from public.client_access_rate_limits
  where scope = 'ip_slug' and key_hash = p_pair_hash;

  update public.client_access_rate_limits
  set failures = greatest(failures - 1, 0), updated_at = current_timestamp_utc
  where scope = 'ip' and key_hash = p_ip_hash;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'url', f.url,
        'tipo', f.tipo,
        'selecionada', coalesce(f.selecionada, false),
        'ordem', f.ordem
      ) order by coalesce(f.ordem, 999999), f.created_at, f.id
    ),
    '[]'::jsonb
  ) into fotos_json
  from public.fotos f
  where f.ensaio_id = e.id
    and (
      (e.status in ('fotos_disponiveis', 'entregue') and f.tipo = 'final')
      or
      (e.status not in ('fotos_disponiveis', 'entregue') and f.tipo = 'prova')
    );

  return jsonb_build_object(
    'id', e.id,
    'titulo', e.titulo,
    'cliente_nome', e.cliente_nome,
    'status', e.status,
    'fotos', fotos_json
  );
end;
$$;

revoke all on function public.client_access_login_internal(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.client_access_login_internal(text, text, text, text)
to service_role;

commit;
