-- Execute depois da migration da Fase 68.

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'admin_activity', 'categories', 'ensaios', 'fotos', 'galleries',
    'gallery_photos', 'gallery_trails', 'mensagens', 'page_sections',
    'pages', 'site_content', 'site_settings'
  )
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'admin_activity', 'categories', 'ensaios', 'fotos', 'galleries',
    'gallery_photos', 'gallery_trails', 'mensagens', 'page_sections',
    'pages', 'site_content', 'site_settings'
  )
order by table_name, grantee, privilege_type;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as signature,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'log_admin_activity', 'salvar_selecao', 'verificar_ensaio',
    'client_access_login_internal'
  )
order by p.proname;
