// Acesso a dados de Categorias.
// A interface continua no admin-v2.js para preservar 100% do layout atual,
// enquanto as consultas ao banco passam a ficar isoladas por domínio.
import { supabase } from '../../core/supabase-client.js';

export async function listCategories() {
  return supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name');
}


export async function listPublishedCategories() {
  return supabase
    .from('categories')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
}

export async function createCategory(payload) {
  return supabase
    .from('categories')
    .insert(payload);
}

export async function updateCategory(id, payload) {
  return supabase
    .from('categories')
    .update(payload)
    .eq('id', id);
}

export async function removeCategory(id) {
  return supabase
    .from('categories')
    .delete()
    .eq('id', id);
}
export async function listTrails(){return supabase.from('gallery_trails').select('*').order('sort_order').order('name')}
export async function createTrail(payload){return supabase.from('gallery_trails').insert(payload)}
export async function updateTrail(id,payload){return supabase.from('gallery_trails').update(payload).eq('id',id).select().single()}
export async function removeTrail(id){return supabase.from('gallery_trails').delete().eq('id',id)}
