// Acesso a dados de Mensagens.
import { supabase } from '../../core/supabase-client.js';

export async function listMessages() {
  try {
    return await supabase
      .from('mensagens')
      .select('*')
      .order('created_at', { ascending: false });
  } catch (_) {
    return { data: null, error: { message: 'tabela-inexistente' } };
  }
}

export async function countUnreadMessages() {
  return supabase
    .from('mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('lida', false);
}

export async function markMessageRead(id) {
  return supabase
    .from('mensagens')
    .update({ lida: true })
    .eq('id', id);
}

export async function removeMessage(id) {
  return supabase
    .from('mensagens')
    .delete()
    .eq('id', id);
}
