import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const escapeHtml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const requestIp = (req: Request) => req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function validTurnstile(token: string, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.set('secret', secret); form.set('response', token);
  if (ip !== 'unknown') form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  return (await response.json()).success === true;
}

function storagePath(url: string, bucket: string) {
  try {
    const pathname = new URL(url).pathname;
    for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/authenticated/${bucket}/`]) {
      const index = pathname.indexOf(marker);
      if (index !== -1) return decodeURIComponent(pathname.slice(index + marker.length));
    }
  } catch { /* URL inválido */ }
  return null;
}

function premiumEmail(name: string | null, sessions: Array<{ titulo: string; slug: string; url: string }>) {
  const cards = sessions.map(session => `<div style="margin:18px 0;padding:22px;border:1px solid #39352f;border-radius:14px;background:#151513"><div style="color:#a89b84;font-size:11px;letter-spacing:1.6px;text-transform:uppercase">Galeria privada</div><h2 style="margin:8px 0 14px;color:#f4f0e8;font-family:Georgia,serif;font-weight:400">${escapeHtml(session.titulo)}</h2><p style="margin:0 0 18px;color:#d8d1c5">Seu login: <strong style="color:#fff">${escapeHtml(session.slug)}</strong></p><a href="${escapeHtml(session.url)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#f4f0e8;color:#111;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Criar nova senha</a></div>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#0b0b0a;color:#f4f0e8;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:42px 22px"><div style="font-family:Georgia,serif;font-size:24px">Rangel Santos <span style="color:#a89b84;font-size:15px">Fotografia</span></div><div style="height:1px;background:#34312c;margin:22px 0 32px"></div><p style="color:#a89b84;font-size:11px;letter-spacing:2px;text-transform:uppercase">Recuperação de acesso</p><h1 style="font-family:Georgia,serif;font-size:38px;font-weight:400;margin:10px 0 18px">Olá${name ? `, ${escapeHtml(name)}` : ''}.</h1><p style="color:#d8d1c5;line-height:1.7">Recebemos um pedido para recuperar o acesso à sua galeria. Consulte o seu login e escolha uma nova senha.</p>${cards}<p style="color:#8f8779;font-size:13px;line-height:1.6">Cada link é válido por 30 minutos e pode ser usado uma única vez. Se não fez este pedido, ignore esta mensagem.</p><div style="height:1px;background:#34312c;margin:32px 0 20px"></div><p style="color:#756e63;font-size:12px">Rangel Santos Fotografia · As suas memórias, preservadas com cuidado.</p></div></body></html>`;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ erro: 'Método não permitido.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('CLIENT_ACCESS_RATE_LIMIT_PEPPER');
  if (!supabaseUrl || !serviceKey || !pepper || pepper.length < 32) return reply({ erro: 'Não foi possível verificar o acesso agora.' }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ erro: 'Acesso inválido.' }, 400); }
  const action = String(body.action || 'login');
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
  const ip = requestIp(req);
  const subject = action === 'forgot' ? email : action === 'reset' ? token : slug.toLowerCase();
  const ipHash = await sha256(`${pepper}:ip:${ip}`);
  const pairHash = await sha256(`${pepper}:pair:${ip}:${subject}`);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!await validTurnstile(String(body.turnstileToken || ''), ip)) return reply({ erro: 'Confirme que não é um robô.' }, 400);

  if (action === 'forgot') {
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return reply({ erro: 'Informe um e-mail válido.' }, 400);
    const since = new Date(Date.now() - 60 * 60e3).toISOString();
    const { count } = await db.from('security_events').select('*', { head: true, count: 'exact' }).eq('event_type', 'client_access_recovery').eq('ip_hash', ipHash).gte('created_at', since);
    if ((count || 0) >= 3) return reply({ message: 'Aguarde antes de fazer um novo pedido.', rate_limited: true }, 429);
    const { data } = await db.from('ensaios').select('id,cliente_nome,titulo,slug,expires_at').eq('cliente_email', email);
    const active = (data || []).filter(session => !session.expires_at || new Date(session.expires_at) > new Date());
    const links: Array<{ titulo: string; slug: string; url: string }> = [];
    for (const session of active) {
      await db.from('client_recovery_tokens').delete().eq('ensaio_id', String(session.id)).is('used_at', null);
      const raw = randomToken();
      const { error } = await db.from('client_recovery_tokens').insert({ ensaio_id: String(session.id), token_hash: await sha256(raw), expires_at: new Date(Date.now() + 30 * 60e3).toISOString() });
      if (!error) links.push({ titulo: session.titulo, slug: session.slug, url: `${(Deno.env.get('SITE_URL') || 'https://www.photosrangel.pt').replace(/\/$/, '')}/area-cliente?recuperar=${encodeURIComponent(raw)}` });
    }
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && links.length) {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') || 'Rangel Santos Fotografia <onboarding@resend.dev>', to: [email], subject: 'Recupere o acesso à sua galeria privada', html: premiumEmail(active[0].cliente_nome, links) }) });
      if (!response.ok) console.error('recovery email:', await response.text());
    }
    await db.from('security_events').insert({ event_type: 'client_access_recovery', outcome: 'success', ip_hash: ipHash, subject_hash: pairHash });
    return reply({ message: 'Se o e-mail estiver associado a uma galeria ativa, enviaremos os dados de acesso.' });
  }

  if (action === 'reset') {
    if (token.length < 32 || token.length > 200 || newPassword.length < 6 || newPassword.length > 64) return reply({ erro: 'Link inválido ou nova senha fora do tamanho permitido.' }, 400);
    const { data: changed, error } = await db.rpc('reset_client_gallery_password', { p_token_hash: await sha256(token), p_new_password: newPassword });
    if (error) { console.error('password reset:', error.message); return reply({ erro: 'Não foi possível alterar a senha agora.' }, 500); }
    if (!changed) return reply({ erro: 'Este link é inválido ou já expirou.' }, 400);
    await db.from('security_events').insert({ event_type: 'client_password_reset', outcome: 'success', ip_hash: ipHash, subject_hash: pairHash });
    return reply({ message: 'Senha alterada com sucesso. Já pode entrar na sua galeria.' });
  }

  if (!slug || !codigo || slug.length > 160 || codigo.length > 160) return reply({ erro: 'Acesso inválido.' }, 400);
  const { data, error } = await db.rpc('client_access_login_internal', { p_slug: slug, p_codigo: codigo, p_ip_hash: ipHash, p_pair_hash: pairHash });
  if (error) return reply({ erro: 'Não foi possível verificar o acesso agora.' }, 500);
  if (data?.rate_limited) return new Response(JSON.stringify(data), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(Math.max(1, Number(data.retry_after) || 1800)) } });
  if (data?.erro) return reply(data, 401);
  const photos = Array.isArray(data?.fotos) ? data.fotos : [];
  if (photos.length) {
    const paths = photos.map((photo: { url?: string }) => storagePath(photo.url || '', 'fotos'));
    if (paths.some((path: string | null) => !path)) return reply({ erro: 'Não foi possível carregar as fotografias agora.' }, 500);
    const { data: signed, error: signError } = await db.storage.from('fotos').createSignedUrls(paths as string[], 3600);
    if (signError || !signed || signed.length !== photos.length) return reply({ erro: 'Não foi possível carregar as fotografias agora.' }, 500);
    data.fotos = photos.map((photo: Record<string, unknown>, index: number) => ({ ...photo, url: signed[index]?.signedUrl }));
  }
  return reply(data);
});
