import { uploadToBucket, getPublicUrlFromBucket, removeFromBucket } from '../../core/storage-service.js';
import { createSessionPhoto } from './session-photos-repository.js';

export async function uploadSessionPhoto({ bucket, path, file, sessionId, type, sortOrder }) {
  const uploadPath=path;
  const upload = await uploadToBucket(bucket, uploadPath, file, { upsert: false });
  if (upload.error) return { error: upload.error, stage: 'upload' };

  const { data } = getPublicUrlFromBucket(bucket, uploadPath);
  const result = await createSessionPhoto({
    ensaio_id: sessionId,
    url: data.publicUrl,
    tipo: type,
    ordem: sortOrder
  });

  if (result.error) {
    await removeFromBucket(bucket, [uploadPath]).catch(() => {});
    return { error: result.error, stage: 'database' };
  }
  return { data: { path:uploadPath, publicUrl: data.publicUrl }, error: null };
}
