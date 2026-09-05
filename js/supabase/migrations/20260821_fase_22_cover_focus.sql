begin;

alter table public.gallery_trails add column if not exists cover_focus_x numeric not null default 50;
alter table public.gallery_trails add column if not exists cover_focus_y numeric not null default 50;
alter table public.galleries add column if not exists cover_focus_x numeric not null default 50;
alter table public.galleries add column if not exists cover_focus_y numeric not null default 50;

-- Corrige associações conceituais que possam ter sido alteradas durante os
-- primeiros testes da relação entre Galerias, Categorias e Trilhas.
update public.categories c set trail_id=t.id from public.gallery_trails t
where t.slug='retratos-corporativo' and c.slug in ('estudio','externo','corporativo','retratos','retrato');

update public.categories c set trail_id=t.id from public.gallery_trails t
where t.slug='autoestima-sensual' and c.slug in ('autoestima','sensual','boudoir');

update public.galleries g set trail_id=c.trail_id
from public.categories c
where g.category_id=c.id and c.trail_id is not null;

commit;
