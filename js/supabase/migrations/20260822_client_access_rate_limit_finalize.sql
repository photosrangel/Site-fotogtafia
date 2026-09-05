begin;

-- Execute somente depois de publicar e testar a Edge Function client-access.
revoke execute on function public.verificar_ensaio(text, text) from public, anon, authenticated;
grant execute on function public.verificar_ensaio(text, text) to service_role;

commit;
