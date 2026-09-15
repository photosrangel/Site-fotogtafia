alter table public.galleries
  add column if not exists session_type text,
  add column if not exists session_location text,
  add column if not exists session_date_text text,
  add column if not exists credits text,
  add column if not exists cta_text text,
  add column if not exists cta_url text;

comment on column public.galleries.description is 'Texto editorial público exibido na página do ensaio.';
comment on column public.galleries.seo_description is 'Descrição exclusiva para mecanismos de busca e compartilhamento.';
