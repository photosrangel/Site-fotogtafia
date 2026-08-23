import { uploadToBucket, getPublicUrlFromBucket, removeFromBucket } from '../../core/storage-service.js';
import { createSessionPhoto } from './session-photos-repository.js';

export async function uploadSessionPhoto({ bucket, path, file, sessionId, type, sortOrder }) {
  const upload = await uploadToBucket(bucket, path, file, { upsert: false });
  if (upload.error) return { error: upload.error, stage: 'upload' };

  const { data } = getPublicUrlFromBucket(bucket, path);
  const result = await createSessionPhoto({
    ensaio_id: sessionId,
    url: data.publicUrl,
    tipo: type,
    ordem: sortOrder
  });

  if (result.error) {
    await removeFromBucket(bucket, [path]).catch(() => {});
    return { error: result.error, stage: 'database' };
  }
  return { data: { path, publicUrl: data.publicUrl }, error: null };
}
