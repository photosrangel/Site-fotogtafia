-- CMS V2 — capa independente para ensaios
-- Execute uma vez no SQL Editor do Supabase antes de publicar esta versão.

alter table public.ensaios
  add column if not exists capa_foto_id uuid null;

-- Garante que a foto escolhida pertença a uma linha existente da tabela fotos.
-- ON DELETE SET NULL evita referência quebrada se a foto de capa for apagada.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ensaios_capa_foto_id_fkey'
  ) then
    alter table public.ensaios
      add constraint ensaios_capa_foto_id_fkey
      foreign key (capa_foto_id)
      references public.fotos(id)
      on delete set null;
  end if;
end $$;

create index if not exists ensaios_capa_foto_id_idx
  on public.ensaios(capa_foto_id);
