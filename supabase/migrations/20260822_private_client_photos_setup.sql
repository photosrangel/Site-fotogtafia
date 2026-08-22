begin;

-- Mantém o bucket público durante o preview, mas prepara o painel para URLs assinadas.
drop policy if exists admin_select_fotos on storage.objects;
create policy admin_select_fotos
on storage.objects for select
to authenticated
using (
  bucket_id = 'fotos'
  and auth.uid() = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid
);

drop policy if exists admin_upload_fotos on storage.objects;
create policy admin_upload_fotos
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and auth.uid() = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid
);

drop policy if exists admin_delete_fotos on storage.objects;
create policy admin_delete_fotos
on storage.objects for delete
to authenticated
using (
  bucket_id = 'fotos'
  and auth.uid() = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a'::uuid
);

commit;
