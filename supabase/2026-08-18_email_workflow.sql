-- ============================================================
-- CMS V2 — FLUXO DE ENSAIOS + NOTIFICAÇÕES POR E-MAIL
-- Execute UMA VEZ no SQL Editor do Supabase antes de publicar.
-- ============================================================

-- 1) Dados e controle de estado/idempotência
alter table public.ensaios
  add column if not exists cliente_email text,
  add column if not exists selecionado_em timestamptz,
  add column if not exists publicado_em timestamptz,
  add column if not exists email_selecao_cliente_enviado_em timestamptz,
  add column if not exists email_selecao_fotografo_enviado_em timestamptz,
  add column if not exists email_entrega_cliente_enviado_em timestamptz;

create index if not exists ensaios_status_idx on public.ensaios(status);
create index if not exists ensaios_cliente_email_idx on public.ensaios(cliente_email);

-- Mantém os dados antigos compatíveis com o novo fluxo.
update public.ensaios
set status = 'selecao_finalizada',
    selecionado_em = coalesce(selecionado_em, now())
where status = 'selecionado';

update public.ensaios
set status = 'fotos_disponiveis',
    publicado_em = coalesce(publicado_em, now())
where status = 'entregue';

-- 2) RPC de acesso da cliente.
-- Retorna apenas provas antes da entrega e apenas finais após a publicação.
drop function if exists public.verificar_ensaio(text, text);

create function public.verificar_ensaio(p_slug text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.ensaios%rowtype;
  fotos_json jsonb;
begin
  select * into e
  from public.ensaios
  where slug = p_slug
    and codigo_acesso = p_codigo
  limit 1;

  if e.id is null then
    return jsonb_build_object('erro', 'Acesso inválido.');
  end if;

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
  )
  into fotos_json
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

revoke all on function public.verificar_ensaio(text, text) from public;
grant execute on function public.verificar_ensaio(text, text) to anon, authenticated;

-- 3) Finalização da seleção.
-- É idempotente: se a seleção já foi finalizada, não altera novamente.
drop function if exists public.salvar_selecao(uuid, text, uuid[]);

create function public.salvar_selecao(
  p_ensaio_id uuid,
  p_codigo text,
  p_foto_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.ensaios%rowtype;
  qtd integer;
begin
  select * into e
  from public.ensaios
  where id = p_ensaio_id
    and codigo_acesso = p_codigo
  for update;

  if e.id is null then
    return jsonb_build_object('erro', 'Acesso inválido.');
  end if;

  if e.status in ('selecao_finalizada', 'em_edicao', 'fotos_disponiveis', 'selecionado', 'entregue') then
    return jsonb_build_object('ok', true, 'ja_finalizado', true);
  end if;

  if e.status <> 'aguardando_selecao' then
    return jsonb_build_object('erro', 'Este ensaio ainda não está disponível para seleção.');
  end if;

  qtd := coalesce(array_length(p_foto_ids, 1), 0);
  if qtd < 1 then
    return jsonb_build_object('erro', 'Selecione pelo menos uma fotografia.');
  end if;

  -- Garante que somente IDs de provas deste ensaio possam ser selecionados.
  if exists (
    select 1
    from unnest(p_foto_ids) as selected_id
    left join public.fotos f
      on f.id = selected_id
     and f.ensaio_id = p_ensaio_id
     and f.tipo = 'prova'
    where f.id is null
  ) then
    return jsonb_build_object('erro', 'A seleção contém uma fotografia inválida.');
  end if;

  update public.fotos
  set selecionada = false
  where ensaio_id = p_ensaio_id
    and tipo = 'prova';

  update public.fotos
  set selecionada = true
  where ensaio_id = p_ensaio_id
    and tipo = 'prova'
    and id = any(p_foto_ids);

  update public.ensaios
  set status = 'selecao_finalizada',
      selecionado_em = coalesce(selecionado_em, now())
  where id = p_ensaio_id;

  return jsonb_build_object(
    'ok', true,
    'quantidade', qtd,
    'status', 'selecao_finalizada'
  );
end;
$$;

revoke all on function public.salvar_selecao(uuid, text, uuid[]) from public;
grant execute on function public.salvar_selecao(uuid, text, uuid[]) to anon, authenticated;

-- Observação:
-- O envio dos e-mails é feito pela Edge Function `ensaio-notifications`.
-- As colunas *_enviado_em impedem disparos duplicados.
