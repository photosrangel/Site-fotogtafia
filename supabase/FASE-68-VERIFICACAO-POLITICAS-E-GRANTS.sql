select jsonb_pretty(
  jsonb_build_object(
    'policies', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'policy', policyname,
          'roles', roles,
          'command', cmd,
          'using', qual,
          'check', with_check
        ) order by tablename, policyname
      )
      from pg_policies
      where schemaname = 'public'
        and tablename in (
          'admin_activity', 'categories', 'ensaios', 'fotos', 'galleries',
          'gallery_photos', 'gallery_trails', 'mensagens', 'page_sections',
          'pages', 'site_content', 'site_settings'
        )
    ), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table', table_name,
          'role', grantee,
          'privilege', privilege_type
        ) order by table_name, grantee, privilege_type
      )
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated')
        and table_name in (
          'admin_activity', 'categories', 'ensaios', 'fotos', 'galleries',
          'gallery_photos', 'gallery_trails', 'mensagens', 'page_sections',
          'pages', 'site_content', 'site_settings'
        )
    ), '[]'::jsonb)
  )
) as fase_68_verificacao;
