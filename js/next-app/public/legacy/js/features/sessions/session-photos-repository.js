// Acesso a dados das fotografias de prova e entrega dos Ensaios.
import { supabase } from '../../core/supabase-client.js';

export async function listSessionPhotos(sessionId) {
  return supabase
    .from('fotos')
    .select('*')
    .eq('ensaio_id', sessionId)
    .order('ordem');
}

export async function listSessionPhotosForSessions(sessionIds) {
  if (!sessionIds?.length) return { data: [], error: null };
  return supabase
    .from('fotos')
    .select('id, ensaio_id, url, tipo, ordem, created_at')
    .in('ensaio_id', sessionIds)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true });
}

export async function createSessionPhoto(payload) {
  return supabase
    .from('fotos')
    .insert(payload);
}

export async function updateSessionPhoto(id, payload, sessionId = null) {
  let query = supabase
    .from('fotos')
    .update(payload)
    .eq('id', id);

  if (sessionId) query = query.eq('ensaio_id', sessionId);
  return query;
}

export async function removeSessionPhoto(id) {
  return supabase
    .from('fotos')
    .delete()
    .eq('id', id);
}

export async function removeSessionPhotos(ids, sessionId = null) {
  if (!ids?.length) return { data: [], error: null };
  let query = supabase
    .from('fotos')
    .delete()
    .in('id', ids);
  if (sessionId) query = query.eq('ensaio_id', sessionId);
  return query.select('id');
}
