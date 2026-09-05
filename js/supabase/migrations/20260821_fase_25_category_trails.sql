begin;

-- Restaura as categorias editoriais conhecidas nas trilhas corretas e garante
-- que elas possam ser exibidas nos filtros públicos.
update public.categories c
set trail_id = t.id,
    published = true
from public.gallery_trails t
where t.slug = 'retratos-corporativo'
  and c.slug in ('estudio','externo','corporativo','retratos','retrato');

update public.categories c
set trail_id = t.id,
    published = true
from public.gallery_trails t
where t.slug = 'autoestima-sensual'
  and c.slug in ('autoestima','sensual','boudoir');

-- A trilha gravada na galeria acompanha a categoria escolhida no painel.
update public.galleries g
set trail_id = c.trail_id
from public.categories c
where g.category_id = c.id
  and c.trail_id is not null;

commit;
