import { listBucketFolder, removeFromBucket, storagePathForBucket } from '../../core/storage-service.js';
import { removeSession, updateSession } from './sessions-repository.js';
import { removeSessionPhoto } from './session-photos-repository.js';

export async function deleteSessionPhotoWithAsset({ photo, session, bucket }) {
  if (session.capa_foto_id === photo.id) {
    const cover = await updateSession(session.id, { capa_foto_id: null });
    if (cover.error) return { error: cover.error, stage: 'clear-cover' };
  }
  const path = storagePathForBucket(photo.storage_url || photo.url, bucket);
  if (path) {
    const storage = await removeFromBucket(bucket, [path]);
    if (storage.error) return { error: storage.error, stage: 'storage' };
  }
  const database = await removeSessionPhoto(photo.id);
  if (database.error) return { error: database.error, stage: 'database' };
  return { data: { coverCleared: session.capa_foto_id === photo.id, removedAsset: Boolean(path) }, error: null };
}

export async function deleteSessionWithAssets({ sessionId, bucket }) {
  let removedAssets = 0;
  for (const folder of ['prova', 'final']) {
    const listed = await listBucketFolder(bucket, `${sessionId}/${folder}`);
    if (listed.error) return { error: listed.error, stage: 'list-assets' };
    const paths = (listed.data || []).map(file => `${sessionId}/${folder}/${file.name}`);
    if (paths.length) {
      const storage = await removeFromBucket(bucket, paths);
      if (storage.error) return { error: storage.error, stage: 'storage' };
      removedAssets += paths.length;
    }
  }
  const database = await removeSession(sessionId);
  if (database.error) return { error: database.error, stage: 'database' };
  return { data: { removedAssets }, error: null };
}
