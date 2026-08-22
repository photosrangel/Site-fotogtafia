begin;

-- Execute somente depois de validar cliente, admin, upload e exclusão com URLs assinadas.
update storage.buckets
set public = false
where id = 'fotos';

commit;
