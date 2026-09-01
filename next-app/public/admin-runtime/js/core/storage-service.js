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

export async function createSignedUrlFromBucket(bucket, path, expiresIn = 3600) {
  return supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
}

export async function removeFromBucket(bucket, paths) {
  return supabase.storage.from(bucket).remove(paths);
}

export async function listBucketFolder(bucket, path) {
  return supabase.storage.from(bucket).list(path);
}

export function storagePathForBucket(url, bucket) {
  const value = url || '';
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`
  ];
  for (const marker of markers) {
    const index = value.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
    }
  }
  return null;
}
