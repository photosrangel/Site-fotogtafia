'use client';

import { useEffect, useState } from 'react';
import type { PublicCategory, PublicGallery, PublicTrail } from '@/lib/public-gallery';

const normalizeName = (value?: string) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PORTRAIT_CATEGORIES = ['estudio', 'externo', 'corporativo', 'retratos', 'retrato'];
const SELF_ESTEEM_CATEGORIES = ['autoestima', 'sensual', 'boudoir'];

function knownTrailCategories(trail?: PublicTrail) {
  if (!trail) return undefined;
  const identity = normalizeName(`${trail.slug} ${trail.name}`);
  if (identity.includes('autoestima') && (identity.includes('sensual') || identity.includes('boudoir'))) return SELF_ESTEEM_CATEGORIES;
  if (identity.includes('retrato') && identity.includes('corporativo')) return PORTRAIT_CATEGORIES;
  return undefined;
}

export function GalleryExperience({ trails, categories, galleries }: {
  trails: PublicTrail[];
  categories: PublicCategory[];
  galleries: PublicGallery[];
}) {
  const [trail, setTrail] = useState<string | null>(null);
  const [filter, setFilter] = useState('todas');
  const [gallery, setGallery] = useState<PublicGallery | null>(null);
  const [photo, setPhoto] = useState(0);

  const selectedTrail = trails.find(item => item.id === trail);
  const semanticCategories = knownTrailCategories(selectedTrail);
  const belongsToSelectedTrail = (categorySlug: string, trailId?: string) => {
    if (!trail) return true;
    if (semanticCategories) return semanticCategories.includes(normalizeName(categorySlug));
    return trailId === trail;
  };

  const galleriesInTrail = galleries.filter(item => belongsToSelectedTrail(item.categorySlug, item.trailId));
  const trailCategories = categories.filter(category => belongsToSelectedTrail(category.slug, category.trail_id));
  const visible = galleriesInTrail.filter(item => filter === 'todas' || item.categorySlug === filter);
  const showingAll = trail === null && filter === 'todas';

  function chooseTrail(id: string | null) {
    setTrail(id);
    setFilter('todas');
  }

  function close() {
    setGallery(null);
    document.body.style.overflow = '';
  }

  function open(item: PublicGallery) {
    setGallery(item);
    setPhoto(0);
    document.body.style.overflow = 'hidden';
  }

  function move(delta: number) {
    if (gallery) setPhoto(value => (value + delta + gallery.photos.length) % gallery.photos.length);
  }

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!gallery) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [gallery]);

  return <>
    <div className="gallery-all-trails">
      <button className={`filter-btn gallery-all-button${trail === null ? ' active' : ''}`} onClick={() => chooseTrail(null)}>Todas as galerias</button>
    </div>
    {trails.length > 0 && <div className="gallery-trails">
      {trails.map(item => {
        const allowed = knownTrailCategories(item);
        const first = galleries.find(g => allowed ? allowed.includes(normalizeName(g.categorySlug)) : g.trailId === item.id);
        return <button key={item.id} data-gallery-trail-id={item.id} className={`gallery-trail-card${trail === item.id ? ' active' : ''}`} onClick={() => chooseTrail(item.id)} style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(8,8,7,.92)),url('${item.cover_url || first?.cover_url || first?.photos[0]?.image_url || ''}')`, backgroundPosition: `${item.cover_focus_x ?? 50}% ${item.cover_focus_y ?? 50}%` }}>
          <span><strong>{item.name}</strong><small>{item.description || 'Ver ensaios →'}</small></span>
        </button>;
      })}
    </div>}
    <div className="filters">
      <button className={`filter-btn${filter === 'todas' ? ' active' : ''}`} onClick={() => setFilter('todas')}>Todas</button>
      {trailCategories.map(category => <button key={category.id} className={`filter-btn${filter === category.slug ? ' active' : ''}`} onClick={() => setFilter(category.slug)}>{category.name}</button>)}
    </div>
    <div className={`grid gallery-adaptive-grid${showingAll ? ' gallery-all-selected-grid' : ''}`}>
      {visible.length ? visible.map(item => <button key={item.id} className="frame" data-category={item.categorySlug} onClick={() => open(item)} aria-label={`Abrir ensaio ${item.title}`}>
        <img src={item.cover_url || item.photos[0].image_url} alt={`Capa do ensaio: ${item.title}`} loading="lazy" style={{ objectPosition: `${item.cover_focus_x ?? 50}% ${item.cover_focus_y ?? 50}%` }}/>
        <span className="frame-count">{item.photos.length} {item.photos.length === 1 ? 'foto' : 'fotos'}</span>
        <div className="frame-title-bar">{item.title}</div>
        <div className="frame-caption"><span>Ver ensaio completo →</span></div>
      </button>) : <div className="gallery-empty">Nenhum ensaio encontrado.</div>}
    </div>
    <div id="lightbox" className={`lightbox${gallery ? ' is-open' : ''}`} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="lightbox-top"><div><p className="lightbox-title">{gallery?.title}</p><p className="lightbox-counter">{gallery ? `${photo + 1} / ${gallery.photos.length}` : ''}</p></div><button className="lightbox-close" aria-label="Fechar visualizador" onClick={close}>✕</button></div>
      <button className="lightbox-arrow lightbox-arrow-left" aria-label="Foto anterior" onClick={() => move(-1)}>‹</button>
      <div className="lightbox-stage">{gallery && <div className="lightbox-carousel">
        <button className="lightbox-slide lightbox-slide-prev" type="button" aria-label="Ver foto anterior" onClick={() => move(-1)}><img src={gallery.photos[(photo - 1 + gallery.photos.length) % gallery.photos.length].image_url} alt="" draggable={false}/></button>
        <button className="lightbox-slide lightbox-slide-current" type="button"><img src={gallery.photos[photo].image_url} alt={gallery.photos[photo].alt_text || gallery.title} draggable={false}/></button>
        <button className="lightbox-slide lightbox-slide-next" type="button" aria-label="Ver próxima foto" onClick={() => move(1)}><img src={gallery.photos[(photo + 1) % gallery.photos.length].image_url} alt="" draggable={false}/></button>
      </div>}</div>
      <button className="lightbox-arrow lightbox-arrow-right" aria-label="Próxima foto" onClick={() => move(1)}>›</button>
    </div>
  </>;
}
