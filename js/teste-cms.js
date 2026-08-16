const { createClient } =
  await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

const { SUPABASE_URL, SUPABASE_ANON_KEY } =
  await import('./supabase-config.js');

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('galleries')
  .select(`
    id,
    title,
    slug,
    cover_url,
    published,
    gallery_photos (
      id,
      image_url,
      published
    )
  `)
  .eq('published', true);

console.log('GALERIAS DO CMS:', data);
console.log('ERRO:', error);
