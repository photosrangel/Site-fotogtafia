import { supabase } from '../../core/supabase-client.js';

function emptyResult(data = []) {
  return { data, error: null };
}

/**
 * Carrega os totais exibidos no Dashboard sem expor consultas Supabase
 * diretamente à camada de interface.
 */
export async function getDashboardSnapshot() {
  const [galleries, categories, photos, unreadMessages, activities] = await Promise.all([
    supabase.from('galleries').select('id,published'),
    supabase.from('categories').select('id'),
    supabase.from('gallery_photos').select('id,published'),
    supabase
      .from('mensagens')
      .select('id')
      .eq('lida', false)
      .then(result => result, () => emptyResult()),
    supabase.from('admin_activity').select('*').order('created_at',{ascending:false}).limit(12).then(result=>result,()=>emptyResult())
  ]);

  return {
    galleries,
    categories,
    photos,
    unreadMessages,
    activities
  };
}

export async function logAdminActivity(activityType, title, options = {}) {
  const { detail = null, entityType = null, entityId = null, severity = 'info', metadata = {} } = options;
  return supabase.rpc('log_admin_activity', {
    p_activity_type: activityType,
    p_title: title,
    p_detail: detail,
    p_entity_type: entityType,
    p_entity_id: entityId == null ? null : String(entityId),
    p_severity: severity,
    p_metadata: metadata
  });
}
