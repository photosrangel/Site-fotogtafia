import { supabase } from '../../core/supabase-client.js';

export function parseStoredContent(content, fallback = {}) {
  if (content == null) return fallback;
  if (typeof content !== 'string') return content;

  try {
    return JSON.parse(content);
  } catch (_) {
    return fallback;
  }
}

export async function listSiteContent() {
  return supabase
    .from('site_content')
    .select('slug,section_key,content');
}

export async function listSiteContentBySlug(slug, sectionKeys = null) {
  let query = supabase
    .from('site_content')
    .select('id,slug,section_key,content,updated_at')
    .eq('slug', slug);

  if (Array.isArray(sectionKeys) && sectionKeys.length) {
    query = query.in('section_key', sectionKeys);
  }

  return query;
}

export async function getSiteContentSection(slug, sectionKey, columns = 'id,content,updated_at') {
  return supabase
    .from('site_content')
    .select(columns)
    .eq('slug', slug)
    .eq('section_key', sectionKey)
    .limit(1)
    .maybeSingle();
}

export async function upsertSiteContentSection(slug, sectionKey, content) {
  const { data: existing, error: selectError } = await getSiteContentSection(
    slug,
    sectionKey,
    'id'
  );

  if (selectError) return { data: null, error: selectError };

  const row = {
    slug,
    section_key: sectionKey,
    content,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    return supabase
      .from('site_content')
      .update(row)
      .eq('id', existing.id);
  }

  return supabase
    .from('site_content')
    .insert(row);
}
