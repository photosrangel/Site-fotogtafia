begin;

alter table public.galleries
  add column if not exists trail_id uuid references public.gallery_trails(id) on delete set null;

create index if not exists galleries_trail_id_idx on public.galleries(trail_id);

-- Organiza automaticamente as categorias já existentes nas duas trilhas iniciais.
update public.categories c
set trail_id = t.id
from public.gallery_trails t
where c.trail_id is null
  and t.slug = 'retratos-corporativo'
  and c.slug in ('estudio','externo','corporativo','retratos','retrato');

update public.categories c
set trail_id = t.id
from public.gallery_trails t
where c.trail_id is null
  and t.slug = 'autoestima-sensual'
  and c.slug in ('autoestima','sensual','boudoir');

-- Galerias antigas herdam a trilha de sua categoria; o painel passa a gravar
-- também a trilha diretamente para suportar galerias sem categoria.
update public.galleries g
set trail_id = c.trail_id
from public.categories c
where g.category_id = c.id
  and g.trail_id is null
  and c.trail_id is not null;

commit;
