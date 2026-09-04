// Acesso a dados das fotografias das Galerias.
import { supabase } from '../../core/supabase-client.js';

export async function listGalleryPhotos(galleryId) {
  return supabase
    .from('gallery_photos')
    .select('id,gallery_id,image_url,alt_text,sort_order,published,created_at')
    .eq('gallery_id', galleryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
}

export async function listGalleryPhotoAssets(galleryId) {
  return supabase
    .from('gallery_photos')
    .select('id,image_url')
    .eq('gallery_id', galleryId);
}

export async function getGalleryPhoto(id) {
  return supabase
    .from('gallery_photos')
    .select('*')
    .eq('id', id)
    .single();
}

export async function getGalleryPhotoPublication(id) {
  return supabase
    .from('gallery_photos')
    .select('id,published')
    .eq('id', id)
    .single();
}

export async function getFirstGalleryPhoto(galleryId) {
  return supabase
    .from('gallery_photos')
    .select('image_url')
    .eq('gallery_id', galleryId)
    .order('sort_order')
    .limit(1)
    .maybeSingle();
}

export async function getMaxGalleryPhotoOrder(galleryId) {
  return supabase
    .from('gallery_photos')
    .select('sort_order')
    .eq('gallery_id', galleryId)
    .order('sort_order', { ascending: false })
    .limit(1);
}

export async function createGalleryPhoto(payload) {
  return supabase
    .from('gallery_photos')
    .insert(payload);
}

export async function updateGalleryPhoto(id, payload) {
  return supabase
    .from('gallery_photos')
    .update(payload)
    .eq('id', id);
}

export async function updateGalleryPhotoSortOrder(id, sortOrder) {
  return updateGalleryPhoto(id, { sort_order: sortOrder });
}

export async function setGalleryPhotoPublished(id, published) {
  return updateGalleryPhoto(id, { published });
}

export async function setGalleryPhotosPublished(galleryId, published) {
  return supabase
    .from('gallery_photos')
    .update({ published })
    .eq('gallery_id', galleryId);
}

export async function removeGalleryPhoto(id) {
  return supabase
    .from('gallery_photos')
    .delete()
    .eq('id', id);
}
