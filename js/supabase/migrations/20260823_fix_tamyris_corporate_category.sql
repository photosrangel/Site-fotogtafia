begin;

-- Garante uma categoria Corporativo real na trilha editorial correta.
insert into public.categories (name, slug, sort_order, published, trail_id)
select
  'Corporativo',
  'corporativo',
  30,
  true,
  t.id
from public.gallery_trails t
where t.slug in ('retratos-e-corporativo', 'retratos-corporativo')
order by case when t.slug = 'retratos-e-corporativo' then 0 else 1 end
limit 1
on conflict (slug) do update
set
  name = excluded.name,
  published = true,
  trail_id = excluded.trail_id;

-- A galeria estava na trilha certa, porém com category_id vazio.
update public.galleries g
set
  category_id = c.id,
  trail_id = c.trail_id
from public.categories c
where c.slug = 'corporativo'
  and g.slug = 'tamyris-santana';

commit;
