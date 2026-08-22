// Acesso a dados de Galerias.
// Mantém o DOM e as regras visuais no admin-v2.js, isolando o Supabase por domínio.
import { supabase } from '../../core/supabase-client.js';

export async function listGalleries() {
  return supabase
    .from('galleries')
    .select('*, categories(name,trail_id)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
}

export async function getGallery(id) {
  return supabase
    .from('galleries')
    .select('*')
    .eq('id', id)
    .single();
}

export async function getGalleryWithCategory(id) {
  return supabase
    .from('galleries')
    .select('*, categories(name,trail_id)')
    .eq('id', id)
    .single();
}

export async function getGalleryCover(id) {
  return supabase
    .from('galleries')
    .select('cover_url')
    .eq('id', id)
    .single();
}

export async function createGallery(payload) {
  return supabase
    .from('galleries')
    .insert(payload)
    .select()
    .single();
}

export async function updateGallery(id, payload) {
  return supabase
    .from('galleries')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
}

export async function updateGalleryFields(id, payload) {
  return supabase
    .from('galleries')
    .update(payload)
    .eq('id', id);
}

export async function updateGallerySortOrder(id, sortOrder) {
  return updateGalleryFields(id, { sort_order: sortOrder });
}

export async function setGalleryPublished(id, published) {
  return updateGalleryFields(id, { published });
}

export async function setGalleryCover(id, coverUrl) {
  return updateGalleryFields(id, { cover_url: coverUrl || null });
}

export async function removeGallery(id) {
  return supabase
    .from('galleries')
    .delete()
    .eq('id', id);
}
