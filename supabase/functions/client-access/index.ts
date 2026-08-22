import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

function requestIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || forwarded
    || 'unknown';
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function storagePath(url: string, bucket: string) {
  try {
    const parsed = new URL(url);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];
    for (const marker of markers) {
      const index = parsed.pathname.indexOf(marker);
      if (index !== -1) return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    }
  } catch {
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('CLIENT_ACCESS_RATE_LIMIT_PEPPER');

  if (!supabaseUrl || !serviceRoleKey || !pepper || pepper.length < 32) {
    console.error('client-access: configuração segura incompleta');
    return json({ erro: 'Não foi possível verificar o acesso agora.' }, 500);
  }

  let payload: { slug?: unknown; codigo?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ erro: 'Acesso inválido.' }, 400);
  }

  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const codigo = typeof payload.codigo === 'string' ? payload.codigo.trim() : '';
  if (!slug || !codigo || slug.length > 160 || codigo.length > 160) {
    return json({ erro: 'Acesso inválido.' }, 400);
  }

  const ip = requestIp(req);
  const normalizedSlug = slug.toLocaleLowerCase('pt-PT');
  const ipHash = await sha256(`${pepper}:ip:${ip}`);
  const pairHash = await sha256(`${pepper}:pair:${ip}:${normalizedSlug}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('client_access_login_internal', {
    p_slug: slug,
    p_codigo: codigo,
    p_ip_hash: ipHash,
    p_pair_hash: pairHash,
  });

  if (error) {
    console.error('client-access RPC:', error.message);
    return json({ erro: 'Não foi possível verificar o acesso agora.' }, 500);
  }

  if (data?.rate_limited) {
    const retryAfter = Math.max(1, Number(data.retry_after) || 1800);
    return json(data, 429, { 'Retry-After': String(retryAfter) });
  }
  if (data?.erro) return json(data, 401);

  const photos = Array.isArray(data?.fotos) ? data.fotos : [];
  if (photos.length) {
    const paths = photos.map((photo: { url?: string }) => storagePath(photo.url || '', 'fotos'));
    if (paths.some((path: string | null) => !path)) {
      console.error('client-access: fotografia sem caminho reconhecível');
      return json({ erro: 'Não foi possível carregar as fotografias agora.' }, 500);
    }
    const { data: signed, error: signError } = await supabase.storage
      .from('fotos')
      .createSignedUrls(paths as string[], 3600);
    if (signError || !signed || signed.length !== photos.length) {
      console.error('client-access signed URLs:', signError?.message || 'resposta incompleta');
      return json({ erro: 'Não foi possível carregar as fotografias agora.' }, 500);
    }
    data.fotos = photos.map((photo: Record<string, unknown>, index: number) => ({
      ...photo,
      url: signed[index]?.signedUrl,
    }));
  }
  return json(data);
});
