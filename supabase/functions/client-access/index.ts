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

async function validTurnstile(token:string,ip:string){const secret=Deno.env.get('TURNSTILE_SECRET_KEY');if(!secret)return true;if(!token)return false;const form=new FormData();form.set('secret',secret);form.set('response',token);if(ip!=='unknown')form.set('remoteip',ip);const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});const result=await response.json();return result.success===true}

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

  let payload: { action?: unknown; slug?: unknown; codigo?: unknown; turnstileToken?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ erro: 'Acesso inválido.' }, 400);
  }

  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const codigo = typeof payload.codigo === 'string' ? payload.codigo.trim() : '';
  const action=payload.action==='forgot'?'forgot':'login';
  if (!slug || (action==='login'&&!codigo) || slug.length > 160 || codigo.length > 160) {
    return json({ erro: 'Acesso inválido.' }, 400);
  }

  const ip = requestIp(req);
  const normalizedSlug = slug.toLocaleLowerCase('pt-PT');
  const ipHash = await sha256(`${pepper}:ip:${ip}`);
  const pairHash = await sha256(`${pepper}:pair:${ip}:${normalizedSlug}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if(!await validTurnstile(String(payload.turnstileToken||''),ip)){await supabase.from('security_events').insert({event_type:'client_access',outcome:'blocked',ip_hash:ipHash,subject_hash:pairHash,metadata:{reason:'turnstile'}});return json({erro:'Confirme que não é um robô.'},400)}
  if(action==='forgot'){
    const since=new Date(Date.now()-60*60e3).toISOString();const {count}=await supabase.from('security_events').select('*',{head:true,count:'exact'}).eq('event_type','client_code_resend').eq('ip_hash',ipHash).gte('created_at',since);
    if((count||0)>=3)return json({message:'Aguarde antes de pedir um novo envio.',rate_limited:true},429);
    const {data:session}=await supabase.from('ensaios').select('cliente_email,cliente_nome,titulo,codigo_acesso,expires_at').eq('slug',slug).maybeSingle();
    if(session?.cliente_email&&(!session.expires_at||new Date(session.expires_at)>new Date())){const key=Deno.env.get('RESEND_API_KEY');if(key)await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>',to:[session.cliente_email],subject:'Código da sua galeria privada',html:`<p>Olá${session.cliente_nome?', '+session.cliente_nome:''}.</p><p>O código da galeria <strong>${session.titulo}</strong> é <strong>${session.codigo_acesso}</strong>.</p>`})})}
    await supabase.from('security_events').insert({event_type:'client_code_resend',outcome:'success',ip_hash:ipHash,subject_hash:pairHash});return json({message:'Se o ensaio estiver ativo, o código será enviado para o e-mail já cadastrado.'});
  }
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
    await supabase.from('security_events').insert({event_type:'client_access',outcome:'blocked',ip_hash:ipHash,subject_hash:pairHash});
    const retryAfter = Math.max(1, Number(data.retry_after) || 1800);
    return json(data, 429, { 'Retry-After': String(retryAfter) });
  }
  if (data?.erro) {await supabase.from('security_events').insert({event_type:'client_access',outcome:'failure',ip_hash:ipHash,subject_hash:pairHash});return json(data, 401)}
  await supabase.from('security_events').insert({event_type:'client_access',outcome:'success',ip_hash:ipHash,subject_hash:pairHash});

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
