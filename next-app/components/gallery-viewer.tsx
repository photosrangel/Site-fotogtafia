'use client';

import {useCallback, useEffect, useState} from 'react';

type GalleryPhoto = {
  id: string;
  image_url: string;
  alt_text?: string | null;
};

type GalleryViewerProps = {
  photos: GalleryPhoto[];
  galleryTitle: string;
};

export function GalleryViewer({photos, galleryTitle}: GalleryViewerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isOpen = activeIndex !== null;

  const close = useCallback(() => setActiveIndex(null), []);
  const previous = useCallback(() => {
    setActiveIndex(index => index === null ? null : (index - 1 + photos.length) % photos.length);
  }, [photos.length]);
  const next = useCallback(() => {
    setActiveIndex(index => index === null ? null : (index + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') previous();
      if (event.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, isOpen, next, previous]);

  if (!photos.length) return null;

  const current = activeIndex === null ? null : photos[activeIndex];
  const before = activeIndex === null ? null : photos[(activeIndex - 1 + photos.length) % photos.length];
  const after = activeIndex === null ? null : photos[(activeIndex + 1) % photos.length];
  const hasNeighbors = photos.length > 1;

  return <>
    <div className="grid gallery-adaptive-grid public-gallery-grid">
      {photos.map((photo, index) => <button
        className="frame public-gallery-photo"
        key={photo.id}
        type="button"
        onClick={() => setActiveIndex(index)}
        aria-label={`Ampliar fotografia ${index + 1} de ${photos.length}`}
      >
        <img src={photo.image_url} alt={photo.alt_text || `Fotografia da galeria ${galleryTitle}`} loading="lazy" />
      </button>)}
    </div>

    {current && <div className="public-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Fotografia ampliada de ${galleryTitle}`} onMouseDown={event => {
      if (event.target === event.currentTarget) close();
    }}>
      <div className="public-gallery-lightbox-top">
        <div>
          <span>Foto ampliada</span>
          <small>{activeIndex! + 1} / {photos.length}</small>
        </div>
        <button type="button" onClick={close} aria-label="Fechar visualizador">×</button>
      </div>

      <div className="public-gallery-carousel">
        {hasNeighbors && before ? <button className="public-gallery-neighbor public-gallery-neighbor-prev" type="button" onClick={previous} aria-label="Ver fotografia anterior">
          <img src={before.image_url} alt="" />
        </button> : <span />}

        <figure className="public-gallery-current">
          <img src={current.image_url} alt={current.alt_text || `Fotografia ampliada da galeria ${galleryTitle}`} />
        </figure>

        {hasNeighbors && after ? <button className="public-gallery-neighbor public-gallery-neighbor-next" type="button" onClick={next} aria-label="Ver próxima fotografia">
          <img src={after.image_url} alt="" />
        </button> : <span />}
      </div>

      {hasNeighbors && <>
        <button className="public-gallery-arrow public-gallery-arrow-prev" type="button" onClick={previous} aria-label="Fotografia anterior">‹</button>
        <button className="public-gallery-arrow public-gallery-arrow-next" type="button" onClick={next} aria-label="Próxima fotografia">›</button>
      </>}
    </div>}
  </>;
}
