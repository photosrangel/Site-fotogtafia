import { uploadToBucket, getPublicUrlFromBucket, removeFromBucket } from '../../core/storage-service.js';
import { createGalleryPhoto } from './gallery-photos-repository.js';

export async function uploadGalleryPhoto({ bucket, path, file, gallery, sortOrder }) {
  const upload = await uploadToBucket(bucket, path, file, { upsert: false });
  if (upload.error) return { error: upload.error, stage: 'upload' };

  const { data } = getPublicUrlFromBucket(bucket, path);
  const result = await createGalleryPhoto({
    gallery_id: gallery.id,
    image_url: data.publicUrl,
    alt_text: gallery.title,
    sort_order: sortOrder,
    published: gallery.published === true
  });

  if (result.error) {
    await removeFromBucket(bucket, [path]);
    return { error: result.error, stage: 'database' };
  }
  return { data: { path, publicUrl: data.publicUrl }, error: null };
}
