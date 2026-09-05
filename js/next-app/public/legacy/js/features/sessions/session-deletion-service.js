import { listBucketFolder, removeFromBucket, storagePathForBucket } from '../../core/storage-service.js';
import { removeSession, updateSession } from './sessions-repository.js';
import { removeSessionPhoto, removeSessionPhotos } from './session-photos-repository.js';

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

export async function deleteSessionProofsWithAssets({ photos, session, bucket }) {
  const proofs = (photos || []).filter(photo => photo?.id && photo.tipo === 'prova');
  if (!proofs.length) return { data: { removedAssets: 0, removedRecords: 0, coverCleared: false }, error: null };

  const paths = [...new Set(proofs
    .map(photo => storagePathForBucket(photo.storage_url || photo.url, bucket))
    .filter(Boolean))];

  if (paths.length) {
    const storage = await removeFromBucket(bucket, paths);
    if (storage.error) return { error: storage.error, stage: 'storage' };
  }

  const ids = proofs.map(photo => photo.id);
  const database = await removeSessionPhotos(ids, session.id);
  if (database.error) return { error: database.error, stage: 'database' };

  const removedRecords = database.data?.length ?? 0;
  if (removedRecords !== ids.length) {
    return {
      error: new Error(`Foram removidos ${removedRecords} de ${ids.length} registros de prova.`),
      stage: 'database'
    };
  }

  return {
    data: {
      removedAssets: paths.length,
      removedRecords,
      coverCleared: Boolean(session.capa_foto_id && ids.includes(session.capa_foto_id))
    },
    error: null
  };
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
