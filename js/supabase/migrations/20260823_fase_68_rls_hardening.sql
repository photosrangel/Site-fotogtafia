begin;

-- Fase 68: limita toda escrita administrativa ao proprietário real do painel.
-- A transação é cancelada antes de qualquer mudança se o UID esperado não existir.
do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid
  ) then
    raise exception 'Fase 68 cancelada: UID administrativo não encontrado.';
  end if;
end;
$$;

alter table public.admin_activity enable row level security;
alter table public.categories enable row level security;
alter table public.ensaios enable row level security;
alter table public.fotos enable row level security;
alter table public.galleries enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.gallery_trails enable row level security;
alter table public.mensagens enable row level security;
alter table public.page_sections enable row level security;
alter table public.pages enable row level security;
alter table public.site_content enable row level security;
alter table public.site_settings enable row level security;

-- Remove políticas antigas que aceitavam qualquer conta autenticada.
drop policy if exists admin_activity_authenticated on public.admin_activity;
drop policy if exists admin_activity_admin_select on public.admin_activity;

drop policy if exists admin_full_access_ensaios on public.ensaios;
drop policy if exists admin_manage_ensaios on public.ensaios;

drop policy if exists admin_full_access_fotos on public.fotos;
drop policy if exists admin_manage_fotos on public.fotos;

drop policy if exists gallery_trails_admin_write on public.gallery_trails;
drop policy if exists gallery_trails_public_read on public.gallery_trails;

drop policy if exists mensagens_delete_authed on public.mensagens;
drop policy if exists mensagens_select_authed on public.mensagens;
drop policy if exists mensagens_update_authed on public.mensagens;
drop policy if exists mensagens_insert_anon on public.mensagens;
drop policy if exists mensagens_delete_admin on public.mensagens;
drop policy if exists mensagens_select_admin on public.mensagens;
drop policy if exists mensagens_update_admin on public.mensagens;

drop policy if exists site_content_all_authed on public.site_content;
drop policy if exists site_settings_all_authed on public.site_settings;

-- Recria também as políticas administrativas já corretas com a mesma regra única.
drop policy if exists admin_manage_categories on public.categories;
drop policy if exists admin_manage_galleries on public.galleries;
drop policy if exists admin_manage_gallery_photos on public.gallery_photos;
drop policy if exists admin_manage_page_sections on public.page_sections;
drop policy if exists admin_manage_pages on public.pages;
drop policy if exists admin_manage_site_content on public.site_content;
drop policy if exists admin_manage_site_settings on public.site_settings;

create policy admin_activity_admin_select
on public.admin_activity for select to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_categories
on public.categories for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_ensaios
on public.ensaios for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_fotos
on public.fotos for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_galleries
on public.galleries for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_gallery_photos
on public.gallery_photos for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy gallery_trails_admin_write
on public.gallery_trails for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy gallery_trails_public_read
on public.gallery_trails for select to anon, authenticated
using (published = true);

create policy mensagens_insert_anon
on public.mensagens for insert to anon
with check (true);

create policy mensagens_select_admin
on public.mensagens for select to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy mensagens_update_admin
on public.mensagens for update to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy mensagens_delete_admin
on public.mensagens for delete to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_page_sections
on public.page_sections for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_pages
on public.pages for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_site_content
on public.site_content for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

create policy admin_manage_site_settings
on public.site_settings for all to authenticated
using ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid)
with check ((select auth.uid()) = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid);

-- Grants mínimos: primeiro remove privilégios automáticos e depois devolve só o necessário.
revoke all on table public.admin_activity from anon, authenticated;
grant select on table public.admin_activity to authenticated;

revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon;
grant select, insert, update, delete on table public.categories to authenticated;

revoke all on table public.ensaios from anon, authenticated;
grant select, insert, update, delete on table public.ensaios to authenticated;

revoke all on table public.fotos from anon, authenticated;
grant select, insert, update, delete on table public.fotos to authenticated;

revoke all on table public.galleries from anon, authenticated;
grant select on table public.galleries to anon;
grant select, insert, update, delete on table public.galleries to authenticated;

revoke all on table public.gallery_photos from anon, authenticated;
grant select on table public.gallery_photos to anon;
grant select, insert, update, delete on table public.gallery_photos to authenticated;

revoke all on table public.gallery_trails from anon, authenticated;
grant select on table public.gallery_trails to anon;
grant select, insert, update, delete on table public.gallery_trails to authenticated;

revoke all on table public.mensagens from anon, authenticated;
grant insert on table public.mensagens to anon;
grant select, update, delete on table public.mensagens to authenticated;

revoke all on table public.page_sections from anon, authenticated;
grant select on table public.page_sections to anon;
grant select, insert, update, delete on table public.page_sections to authenticated;

revoke all on table public.pages from anon, authenticated;
grant select on table public.pages to anon;
grant select, insert, update, delete on table public.pages to authenticated;

revoke all on table public.site_content from anon, authenticated;
grant select on table public.site_content to anon;
grant select, insert, update, delete on table public.site_content to authenticated;

revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon;
grant select, insert, update, delete on table public.site_settings to authenticated;

-- A função privilegiada de atividade valida o UID mesmo sendo chamada por RPC.
create or replace function public.log_admin_activity(
  p_activity_type text,
  p_title text,
  p_detail text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_severity text default 'info',
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if (select auth.uid()) is distinct from 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid then
    raise exception 'Acesso administrativo negado.' using errcode = '42501';
  end if;

  insert into public.admin_activity(
    activity_type, title, detail, entity_type, entity_id, severity, metadata
  ) values (
    p_activity_type, p_title, p_detail, p_entity_type, p_entity_id,
    p_severity, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.log_admin_activity(text,text,text,text,text,text,jsonb)
from public, anon, authenticated;
grant execute on function public.log_admin_activity(text,text,text,text,text,text,jsonb)
to authenticated;

-- Mantém as RPCs existentes, mas fixa um search_path vazio e previsível.
alter function public.salvar_selecao(uuid, text, uuid[]) set search_path = '';
alter function public.verificar_ensaio(text, text) set search_path = '';
alter function public.client_access_login_internal(text, text, text, text) set search_path = '';

commit;
