import { removeFromBucket, storagePathForBucket } from '../../core/storage-service.js';
import { removeGallery } from './galleries-repository.js';
import { getGalleryPhoto, listGalleryPhotoAssets, removeGalleryPhoto } from './gallery-photos-repository.js';

export async function deleteGalleryWithAssets({ galleryId, bucket }) {
  const photos = await listGalleryPhotoAssets(galleryId);
  if (photos.error) return { error: photos.error, stage: 'list-assets' };

  const paths = (photos.data || [])
    .map(photo => storagePathForBucket(photo.image_url, bucket))
    .filter(Boolean);
  if (paths.length) {
    const storage = await removeFromBucket(bucket, paths);
    if (storage.error) return { error: storage.error, stage: 'storage' };
  }

  const database = await removeGallery(galleryId);
  if (database.error) return { error: database.error, stage: 'database' };
  return { data: { removedAssets: paths.length }, error: null };
}

export async function deleteGalleryPhotoWithAsset({ photoId, bucket }) {
  const photo = await getGalleryPhoto(photoId);
  if (photo.error || !photo.data) return { error: photo.error || new Error('Fotografia não encontrada.'), stage: 'find' };

  const path = storagePathForBucket(photo.data.image_url, bucket);
  if (path) {
    const storage = await removeFromBucket(bucket, [path]);
    if (storage.error) return { error: storage.error, stage: 'storage', photo: photo.data };
  }
  const database = await removeGalleryPhoto(photoId);
  if (database.error) return { error: database.error, stage: 'database', photo: photo.data };
  return { data: { photo: photo.data, removedAsset: Boolean(path) }, error: null };
}
