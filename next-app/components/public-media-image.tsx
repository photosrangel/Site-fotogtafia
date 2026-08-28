'use client';

import { useState } from 'react';

type PublicMediaImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
};

export function PublicMediaImage({ src, fallbackSrc, alt }: PublicMediaImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
