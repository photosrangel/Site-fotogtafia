-- Use somente se a Fase 68 impedir o login ou operações do painel.
-- Esta reversão restaura temporariamente as políticas amplas anteriores.

begin;

drop policy if exists admin_activity_admin_select on public.admin_activity;
create policy admin_activity_authenticated on public.admin_activity
for all to authenticated using (true) with check (true);

drop policy if exists admin_manage_ensaios on public.ensaios;
create policy admin_full_access_ensaios on public.ensaios
for all to public
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists admin_manage_fotos on public.fotos;
create policy admin_full_access_fotos on public.fotos
for all to public
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists gallery_trails_admin_write on public.gallery_trails;
create policy gallery_trails_admin_write on public.gallery_trails
for all to authenticated using (true) with check (true);

drop policy if exists mensagens_select_admin on public.mensagens;
drop policy if exists mensagens_update_admin on public.mensagens;
drop policy if exists mensagens_delete_admin on public.mensagens;
create policy mensagens_select_authed on public.mensagens for select to authenticated using (true);
create policy mensagens_update_authed on public.mensagens for update to authenticated using (true) with check (true);
create policy mensagens_delete_authed on public.mensagens for delete to authenticated using (true);

grant all on table public.admin_activity, public.categories, public.ensaios,
  public.fotos, public.galleries, public.gallery_photos, public.gallery_trails,
  public.mensagens, public.page_sections, public.pages, public.site_content,
  public.site_settings to authenticated;

commit;
