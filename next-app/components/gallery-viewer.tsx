'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

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
  const gridRef = useRef<HTMLDivElement>(null);
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

  const layoutGalleryRows = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const items = [...grid.querySelectorAll<HTMLElement>('.public-gallery-photo')];
    const width = grid.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(grid).gap) || 6;
    if (!width) return;

    if (width <= 760) {
      for (let index = 0; index < items.length; index += 2) {
        const pair = items.slice(index, index + 2);
        const ratios = pair.map(item => Number(item.dataset.ratio) || 1);
        const usableWidth = pair.length === 2 ? width - gap : width;
        const height = pair.length === 2
          ? usableWidth / (ratios[0] + ratios[1])
          : Math.min(width / ratios[0], width * .78);
        pair.forEach((item, pairIndex) => {
          const itemWidth = ratios[pairIndex] * height;
          item.style.width = `${itemWidth}px`;
          item.style.height = `${height}px`;
          item.style.flexBasis = `${itemWidth}px`;
        });
      }
      return;
    }

    const targetHeight = Math.max(220, Math.min(350, width * .19));
    let row: HTMLElement[] = [];
    let ratioSum = 0;
    const applyRow = (stretch: boolean) => {
      if (!row.length) return;
      const naturalWidth = ratioSum * targetHeight + gap * (row.length - 1);
      const height = stretch || naturalWidth >= width * .68
        ? (width - gap * (row.length - 1)) / ratioSum
        : targetHeight;
      row.forEach(item => {
        const ratio = Number(item.dataset.ratio) || 1;
        const itemWidth = ratio * height;
        item.style.width = `${itemWidth}px`;
        item.style.height = `${height}px`;
        item.style.flexBasis = `${itemWidth}px`;
      });
      row = [];
      ratioSum = 0;
    };

    items.forEach(item => {
      ratioSum += Number(item.dataset.ratio) || 1;
      row.push(item);
      if (ratioSum * targetHeight + gap * (row.length - 1) >= width) applyRow(true);
    });
    applyRow(false);
  }, []);

  const registerImage = useCallback((image: HTMLImageElement) => {
    const item = image.closest<HTMLElement>('.public-gallery-photo');
    if (!item || !image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    item.dataset.ratio = String(ratio);
    item.dataset.orientation = ratio > 1.18 ? 'landscape' : ratio < .85 ? 'portrait' : 'square';
    requestAnimationFrame(layoutGalleryRows);
  }, [layoutGalleryRows]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const resizeAll = () => grid.querySelectorAll<HTMLImageElement>('.public-gallery-photo img').forEach(image => {
      if (image.complete) registerImage(image);
    });
    resizeAll();
    const observer = new ResizeObserver(resizeAll);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [photos, registerImage]);

  return <>
    <div ref={gridRef} className="grid gallery-adaptive-grid public-gallery-grid">
      {photos.map((photo, index) => <button
        className="frame public-gallery-photo"
        key={photo.id}
        type="button"
        onClick={() => setActiveIndex(index)}
        aria-label={`Ampliar fotografia ${index + 1} de ${photos.length}`}
      >
        <img src={photo.image_url} alt={photo.alt_text || `Fotografia da galeria ${galleryTitle}`} loading="lazy" onLoad={event => registerImage(event.currentTarget)} />
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
