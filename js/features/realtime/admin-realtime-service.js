import { supabase } from '../../core/supabase-client.js';

/**
 * Cria o canal Realtime do Admin. A UI fornece callbacks e continua
 * responsável apenas por decidir o que renderizar quando cada evento chega.
 */
export function createAdminRealtimeChannel({ onMessageChange, onSessionUpdate, onStatus } = {}) {
  return supabase
    .channel('admin-v2-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mensagens' },
      payload => onMessageChange?.(payload)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ensaios' },
      payload => onSessionUpdate?.(payload)
    )
    .subscribe(status => onStatus?.(status));
}

export async function removeAdminRealtimeChannel(channel) {
  if (!channel) return;
  return supabase.removeChannel(channel);
}
