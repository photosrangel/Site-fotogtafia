-- ============================================================
-- REALTIME DO ADMIN V2
-- Execute uma vez no SQL Editor do Supabase.
-- É idempotente: pode executar novamente sem duplicar tabelas.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mensagens'
  ) then
    alter publication supabase_realtime add table public.mensagens;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ensaios'
  ) then
    alter publication supabase_realtime add table public.ensaios;
  end if;
end
$$;

-- Verificação
select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('mensagens', 'ensaios')
order by tablename;
