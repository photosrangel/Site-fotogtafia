import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || ''
const PHOTOGRAPHER_EMAIL = Deno.env.get('PHOTOGRAPHER_EMAIL') || ''
const SITE_URL = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
const ADMIN_USER_ID = Deno.env.get('ADMIN_USER_ID') || ''

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Olá'
}

function emailShell(content) {
  return `<!doctype html>
  <html><body style="margin:0;background:#0b0b0a;color:#dedbd4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0a;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#151412;border:1px solid #302e2a;">
          <tr><td style="padding:34px 36px;border-bottom:1px solid #302e2a;">
            <div style="font-family:Georgia,serif;font-size:24px;color:#f0ede6;">Rangel <em style="font-weight:300;">Santos</em></div>
            <div style="margin-top:7px;font-family:monospace;font-size:10px;letter-spacing:2px;color:#8e8980;text-transform:uppercase;">Fotografia</div>
          </td></tr>
          <tr><td style="padding:36px;color:#bcb7ae;font-size:15px;line-height:1.75;">${content}</td></tr>
          <tr><td style="padding:22px 36px;border-top:1px solid #302e2a;color:#777269;font-family:monospace;font-size:10px;letter-spacing:1px;">RANGEL SANTOS — FOTOGRAFIA</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}

function button(label, url) {
  return `<p style="margin:28px 0 8px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#dedbd4;color:#0b0b0a;text-decoration:none;padding:13px 20px;font-family:monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(label)}</a></p>`
}

async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada.')
  if (!EMAIL_FROM) throw new Error('EMAIL_FROM não configurado.')
  if (!SITE_URL) throw new Error('SITE_URL não configurada.')
  if (!to) throw new Error('Destinatário não informado.')

  const payload = {
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Resend respondeu ${response.status}`)
  }
  return data
}

async function getPhotographerEmail() {
  if (PHOTOGRAPHER_EMAIL) return PHOTOGRAPHER_EMAIL
  const { data } = await admin.from('site_settings').select('email').limit(1).maybeSingle()
  return data?.email || ''
}

async function requireAdmin(req) {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.getUser()
  const user = error ? null : data?.user
  if (!user) return null
  if (ADMIN_USER_ID && user.id !== ADMIN_USER_ID) return null
  return user
}

async function loadEnsaio(id) {
  const { data, error } = await admin.from('ensaios').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Ensaio não encontrado.')
  return data
}

async function selectedCount(ensaioId) {
  const { count } = await admin
    .from('fotos')
    .select('id', { count: 'exact', head: true })
    .eq('ensaio_id', ensaioId)
    .eq('tipo', 'prova')
    .eq('selecionada', true)
  return count || 0
}

async function finalCount(ensaioId) {
  const { count } = await admin
    .from('fotos')
    .select('id', { count: 'exact', head: true })
    .eq('ensaio_id', ensaioId)
    .eq('tipo', 'final')
  return count || 0
}

async function notifySelection(ensaio, codigo) {
  if (!codigo || codigo !== ensaio.codigo_acesso) {
    return json({ error: 'Acesso inválido.' }, 401)
  }

  if (!['selecao_finalizada', 'em_edicao', 'fotos_disponiveis', 'selecionado', 'entregue'].includes(ensaio.status)) {
    return json({ error: 'A seleção ainda não foi finalizada.' }, 409)
  }

  const count = await selectedCount(ensaio.id)
  const results = []
  const nome = firstName(ensaio.cliente_nome)
  const areaCliente = `${SITE_URL}/area-cliente`
  const adminUrl = `${SITE_URL}/admin-v2.html`

  if (!ensaio.email_selecao_cliente_enviado_em) {
    if (!ensaio.cliente_email) {
      results.push({ recipient: 'cliente', sent: false, reason: 'E-mail da cliente não informado.' })
    } else {
      try {
        const html = emailShell(`
          <p style="margin-top:0;color:#f0ede6;font-family:Georgia,serif;font-size:27px;line-height:1.25;">Olá, ${escapeHtml(nome)}.</p>
          <p>A sua seleção foi recebida com sucesso.</p>
          <p>A partir de agora, as fotografias escolhidas seguem para a etapa de edição, onde cada imagem será trabalhada com o cuidado necessário para chegar ao resultado final.</p>
          <p>Assim que tudo estiver pronto e disponível na sua área privada, você receberá um novo e-mail.</p>
          <p>Obrigado pela confiança.</p>
          ${button('Acessar área do cliente', areaCliente)}
        `)
        await sendEmail({
          to: ensaio.cliente_email,
          subject: 'Seleção recebida — Rangel Santos Fotografia',
          html,
          text: `Olá, ${nome}. A sua seleção foi recebida com sucesso. As fotografias escolhidas seguem agora para a etapa de edição. Assim que tudo estiver pronto, você receberá um novo e-mail.`,
        })
        const sentAt = new Date().toISOString()
        await admin.from('ensaios').update({ email_selecao_cliente_enviado_em: sentAt }).eq('id', ensaio.id)
        ensaio.email_selecao_cliente_enviado_em = sentAt
        results.push({ recipient: 'cliente', sent: true })
      } catch (error) {
        console.error('Falha ao enviar confirmação para cliente:', error)
        results.push({ recipient: 'cliente', sent: false, reason: error?.message || 'Falha no envio.' })
      }
    }
  }

  if (!ensaio.email_selecao_fotografo_enviado_em) {
    try {
      const photographerEmail = await getPhotographerEmail()
      if (!photographerEmail) {
        results.push({ recipient: 'fotografo', sent: false, reason: 'PHOTOGRAPHER_EMAIL/site_settings.email ausente.' })
      } else {
        const dataSelecao = ensaio.selecionado_em
          ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(ensaio.selecionado_em))
          : 'Agora'
        const html = emailShell(`
          <p style="margin-top:0;color:#f0ede6;font-family:Georgia,serif;font-size:27px;line-height:1.25;">Nova seleção finalizada</p>
          <p><strong style="color:#f0ede6;">${escapeHtml(ensaio.cliente_nome || 'Cliente')}</strong> finalizou a seleção do ensaio <strong style="color:#f0ede6;">${escapeHtml(ensaio.titulo)}</strong>.</p>
          <div style="margin:22px 0;padding:18px;border:1px solid #302e2a;background:#10100f;">
            <div><strong style="color:#f0ede6;">Fotografias selecionadas:</strong> ${count}</div>
            <div style="margin-top:8px;"><strong style="color:#f0ede6;">Data:</strong> ${escapeHtml(dataSelecao)}</div>
          </div>
          ${button('Abrir Admin V2', adminUrl)}
        `)
        await sendEmail({
          to: photographerEmail,
          subject: `Nova seleção finalizada — ${ensaio.cliente_nome || ensaio.titulo}`,
          html,
          text: `${ensaio.cliente_nome || 'Cliente'} finalizou a seleção do ensaio ${ensaio.titulo}. Fotografias selecionadas: ${count}.`,
        })
        const sentAt = new Date().toISOString()
        await admin.from('ensaios').update({ email_selecao_fotografo_enviado_em: sentAt }).eq('id', ensaio.id)
        ensaio.email_selecao_fotografo_enviado_em = sentAt
        results.push({ recipient: 'fotografo', sent: true })
      }
    } catch (error) {
      console.error('Falha ao enviar aviso para fotógrafo:', error)
      results.push({ recipient: 'fotografo', sent: false, reason: error?.message || 'Falha no envio.' })
    }
  }

  const refreshed = await loadEnsaio(ensaio.id)
  const sent = results.filter(r => r.sent).length
  const pending = results.filter(r => r.sent === false).length

  return json({
    ok: true,
    email_sent: pending === 0,
    message: pending
      ? 'Seleção registrada; algumas notificações ainda precisam de configuração ou nova tentativa.'
      : (sent ? 'E-mails da seleção enviados com sucesso.' : 'Os e-mails da seleção já haviam sido enviados.'),
    results,
    ensaio: refreshed,
  })
}

async function publishFinal(req, ensaio) {
  const user = await requireAdmin(req)
  if (!user) return json({ error: 'Acesso administrativo necessário.' }, 401)

  const qty = await finalCount(ensaio.id)
  if (qty < 1) return json({ error: 'Adicione pelo menos uma fotografia final antes de publicar.' }, 409)

  if (!['em_edicao', 'fotos_disponiveis', 'entregue'].includes(ensaio.status)) {
    return json({ error: 'O ensaio precisa estar em edição antes da publicação.' }, 409)
  }

  const now = new Date().toISOString()
  if (!['fotos_disponiveis', 'entregue'].includes(ensaio.status)) {
    const { error } = await admin.from('ensaios').update({
      status: 'fotos_disponiveis',
      publicado_em: ensaio.publicado_em || now,
    }).eq('id', ensaio.id)
    if (error) throw new Error(error.message)
    ensaio = await loadEnsaio(ensaio.id)
  }

  if (ensaio.email_entrega_cliente_enviado_em) {
    return json({
      ok: true,
      email_sent: true,
      message: 'As fotos já estavam publicadas e o e-mail de entrega já havia sido enviado.',
      ensaio,
    })
  }

  if (!ensaio.cliente_email) {
    return json({
      ok: true,
      email_sent: false,
      message: 'Fotos publicadas, mas o ensaio não possui e-mail da cliente. Adicione o e-mail e tente novamente.',
      ensaio,
    })
  }

  const nome = firstName(ensaio.cliente_nome)
  const areaCliente = `${SITE_URL}/area-cliente`
  const html = emailShell(`
    <p style="margin-top:0;color:#f0ede6;font-family:Georgia,serif;font-size:29px;line-height:1.25;">Suas fotografias estão prontas.</p>
    <p>Olá, ${escapeHtml(nome)}.</p>
    <p>O resultado final do seu ensaio já está disponível na sua área privada.</p>
    <p>Reserve um momento para vê-las com calma. Espero que você goste do resultado tanto quanto eu gostei de preparar cada imagem.</p>
    ${SITE_URL ? button('Ver minhas fotografias', areaCliente) : ''}
    <p style="margin-top:28px;">Obrigado por confiar em meu trabalho e me permitir fazer parte desse momento.</p>
  `)

  try {
    await sendEmail({
      to: ensaio.cliente_email,
      subject: 'Suas fotografias estão prontas ✦',
      html,
      text: `Olá, ${nome}. Suas fotografias estão prontas. O resultado final do seu ensaio já está disponível na sua área privada: ${areaCliente}`,
    })

    const sentAt = new Date().toISOString()
    await admin.from('ensaios').update({ email_entrega_cliente_enviado_em: sentAt }).eq('id', ensaio.id)
    const refreshed = await loadEnsaio(ensaio.id)

    return json({
      ok: true,
      email_sent: true,
      message: 'Fotos publicadas e cliente notificada por e-mail.',
      ensaio: refreshed,
    })
  } catch (error) {
    console.error('Fotos publicadas, mas o e-mail de entrega falhou:', error)
    const refreshed = await loadEnsaio(ensaio.id)
    return json({
      ok: true,
      email_sent: false,
      message: `Fotos publicadas, mas o e-mail não foi enviado: ${error?.message || 'falha no envio.'}`,
      ensaio: refreshed,
    })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: 'Configuração do Supabase ausente na Edge Function.' }, 500)
  }

  try {
    const body = await req.json()
    const action = body?.action
    const ensaioId = body?.ensaio_id
    if (!action || !ensaioId) return json({ error: 'action e ensaio_id são obrigatórios.' }, 400)

    const ensaio = await loadEnsaio(ensaioId)

    if (action === 'selection_finalized') {
      return await notifySelection(ensaio, body?.codigo)
    }

    if (action === 'publish_final') {
      return await publishFinal(req, ensaio)
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: error?.message || 'Erro interno.' }, 500)
  }
})
