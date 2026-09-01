// Acesso a dados de Ensaios/Sessões de clientes.
import { supabase } from '../../core/supabase-client.js';

export async function listSessions() {
  return supabase
    .from('ensaios')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function countSessionsByStatuses(statuses) {
  return supabase
    .from('ensaios')
    .select('id', { count: 'exact', head: true })
    .in('status', statuses);
}

export async function createSession(payload) {
  return supabase
    .from('ensaios')
    .insert(payload);
}

export async function updateSession(id, payload) {
  return supabase
    .from('ensaios')
    .update(payload)
    .eq('id', id);
}

export async function updateSessionAndReturn(id, payload) {
  return supabase
    .from('ensaios')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
}

export async function removeSession(id) {
  return supabase
    .from('ensaios')
    .delete()
    .eq('id', id);
}
