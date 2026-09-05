import { uploadToBucket, getPublicUrlFromBucket, removeFromBucket } from '../../core/storage-service.js';
import { createSessionPhoto } from './session-photos-repository.js';
import { watermarkProof } from './proof-watermark.js';

export async function uploadSessionPhoto({ bucket, path, file, sessionId, type, sortOrder }) {
  const uploadFile=type==='prova'?await watermarkProof(file):file;
  const uploadPath=type==='prova'?path.replace(/\.[^.]+$/,'.jpg'):path;
  const upload = await uploadToBucket(bucket, uploadPath, uploadFile, { upsert: false });
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
