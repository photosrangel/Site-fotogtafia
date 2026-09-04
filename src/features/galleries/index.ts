/** Contratos do domínio Galerias para a migração Next.js. */
export interface GalleryRecord {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  category_id?: string | null;
  cover_url?: string | null;
  published: boolean;
  sort_order: number;
  created_at?: string;
}

export interface GalleryPhotoRecord {
  id: string;
  gallery_id: string;
  image_url: string;
  alt_text?: string | null;
  sort_order: number;
  published: boolean;
  created_at?: string;
}

export const galleryFeature = {
  name: 'galleries',
  parityRequired: true,
  currentRuntime: [
    'js/features/galleries/galleries-repository.js',
    'js/features/galleries/gallery-photos-repository.js',
    'js/features/galleries/galleries-controller.js'
  ]
} as const;
