// Adaptador do Storage atual.
// Centralizar essas operações permite trocar Supabase Storage por Cloudinary
// posteriormente sem reescrever a interface do Admin.
import { supabase } from './supabase-client.js';

export async function uploadToBucket(bucket, path, file, options = { upsert: false }) {
  return supabase.storage.from(bucket).upload(path, file, options);
}

export function getPublicUrlFromBucket(bucket, path) {
  return supabase.storage.from(bucket).getPublicUrl(path);
}

export async function removeFromBucket(bucket, paths) {
  return supabase.storage.from(bucket).remove(paths);
}

export async function listBucketFolder(bucket, path) {
  return supabase.storage.from(bucket).list(path);
}

export function storagePathForBucket(url, bucket) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = (url || '').indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}
