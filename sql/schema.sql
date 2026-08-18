-- ============================================
-- RANGEL SANTOS — ATUALIZAÇÃO DO CMS
-- ============================================
-- Rode este script no Supabase (SQL Editor) uma única vez.
-- Ele é seguro de rodar de novo (não apaga nada que já existe).
--
-- O que ele faz:
--   1. Cria a tabela "mensagens" (formulário da página de contato)
--   2. Garante as políticas de segurança das tabelas novas e existentes
--
-- Depois de rodar, publique as novas páginas (zip atualizado) no Vercel.

-- --------------------------------------------------------
-- 1) TABELA DE MENSAGENS DO FORMULÁRIO DE CONTATO
-- --------------------------------------------------------

create table if not exists public.mensagens (
  id bigint generated always as identity primary key,
  nome text not null,
  email text,
  tipo text,
  mensagem text not null,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.mensagens enable row level security;

-- Visitantes anônimos podem enviar mensagens (INSERT)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mensagens'
      and policyname = 'mensagens_insert_anon'
  ) then
    create policy "mensagens_insert_anon"
      on public.mensagens for insert to anon
      with check (true);
  end if;
end $$;

-- Apenas administradores (logados) leem as mensagens
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mensagens'
      and policyname = 'mensagens_select_authed'
  ) then
    create policy "mensagens_select_authed"
      on public.mensagens for select to authenticated
      using (true);
  end if;
end $$;

-- Apenas administradores (logados) atualizam (marcar como lida)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mensagens'
      and policyname = 'mensagens_update_authed'
  ) then
    create policy "mensagens_update_authed"
      on public.mensagens for update to authenticated
      using (true) with check (true);
  end if;
end $$;

-- Apenas administradores (logados) excluem mensagens
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mensagens'
      and policyname = 'mensagens_delete_authed'
  ) then
    create policy "mensagens_delete_authed"
      on public.mensagens for delete to authenticated
      using (true);
  end if;
end $$;

-- --------------------------------------------------------
-- 2) POLÍTICAS DE SEGURANÇA (garantia de que o painel consiga
--    editar conteúdo e o site público consiga ler)
-- --------------------------------------------------------

-- site_content: visitantes leem; administradores editam
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_content'
      and policyname = 'site_content_select_anon'
  ) then
    create policy "site_content_select_anon"
      on public.site_content for select to anon
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_content'
      and policyname = 'site_content_all_authed'
  ) then
    create policy "site_content_all_authed"
      on public.site_content for all to authenticated
      using (true) with check (true);
  end if;
end $$;

-- site_settings: visitantes leem (rodapé, contato); administradores editam
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings'
      and policyname = 'site_settings_select_anon'
  ) then
    create policy "site_settings_select_anon"
      on public.site_settings for select to anon
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings'
      and policyname = 'site_settings_all_authed'
  ) then
    create policy "site_settings_all_authed"
      on public.site_settings for all to authenticated
      using (true) with check (true);
  end if;
end $$;

-- --------------------------------------------------------
-- FIM
-- --------------------------------------------------------
-- Próximos passos:
--  1. Publique os arquivos atualizados no Vercel.
--  2. Abra /admin e edite as páginas na aba "Conteúdo".
--  3. As mensagens de contato chegam na aba "Mensagens".
