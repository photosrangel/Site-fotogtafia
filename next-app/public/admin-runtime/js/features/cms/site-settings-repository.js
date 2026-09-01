import { supabase } from '../../core/supabase-client.js';

export async function getSiteSettings() {
  return supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
}

export async function saveSiteSettings(payload) {
  const { data: existing, error: selectError } = await supabase
    .from('site_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (selectError) return { data: null, error: selectError };

  if (existing?.id) {
    return supabase
      .from('site_settings')
      .update(payload)
      .eq('id', existing.id);
  }

  return supabase
    .from('site_settings')
    .insert(payload);
}
