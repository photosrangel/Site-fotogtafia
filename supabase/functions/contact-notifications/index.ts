import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  ''

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || ''
const PHOTOGRAPHER_EMAIL = Deno.env.get('PHOTOGRAPHER_EMAIL') || ''

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function emailValido(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function firstName(name: string) {
  return String(name || '').trim().split(/\s+/)[0] || 'Olá'
}

function emailShell(content: string) {
  return `<!doctype html>
<html>
<body style="margin:0;background:#0b0b0a;color:#dedbd4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0a;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#151412;border:1px solid #302e2a;">
          <tr>
            <td style="padding:34px 36px;border-bottom:1px solid #302e2a;">
              <div style="font-family:Georgia,serif;font-size:24px;color:#f0ede6;">Rangel Santos</div>
              <div style="margin-top:7px;font-size:10px;letter-spacing:2px;color:#8e8980;text-transform:uppercase;">Fotografia</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 36px;font-size:15px;line-height:1.75;color:#c7c1b8;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #302e2a;color:#777269;font-size:11px;letter-spacing:1px;">
              RANGEL SANTOS — FOTOGRAFIA
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error('RESEND_API_KEY ou EMAIL_FROM ausente.')
  }

  const payload: Record<string, unknown> = {
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
  }

  if (replyTo) payload.reply_to = replyTo

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
    throw new Error(
      String(data?.message || data?.error || `Resend respondeu ${response.status}`)
    )
  }

  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não permitido.' }, 405)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'Configuração do Supabase ausente.' }, 500)
  }

  try {
    const body = await req.json().catch(() => ({}))

    // Honeypot: responde como sucesso sem armazenar/enviar nada.
    if (clean(body?.website, 200)) {
      return json({
        ok: true,
        saved: false,
        spam_filtered: true,
        notifications: { photographer: false, client: false },
      })
    }

    const nome = clean(body?.nome, 120)
    const email = clean(body?.email, 254).toLowerCase()
    const tipo = clean(body?.tipo, 100)
    const mensagem = clean(body?.mensagem, 3000)

    if (!nome || !email || !mensagem) {
      return json({ ok: false, error: 'Nome, e-mail e mensagem são obrigatórios.' }, 400)
    }

    if (!emailValido(email)) {
      return json({ ok: false, error: 'E-mail inválido.' }, 400)
    }

    const { data: inserted, error: insertError } = await admin
      .from('mensagens')
      .insert({
        nome,
        email,
        tipo: tipo || null,
        mensagem,
        lida: false,
      })
      .select('id,created_at')
      .single()

    if (insertError) {
      console.error('[contact-notifications] Falha ao salvar mensagem:', insertError)
      return json({ ok: false, error: 'Não foi possível registrar a mensagem.' }, 500)
    }

    let photographerSent = false
    let clientSent = false

    // 1) Notificação para o fotógrafo
    if (PHOTOGRAPHER_EMAIL) {
      try {
        const html = emailShell(`
          <p style="margin-top:0;color:#f0ede6;font-family:Georgia,serif;font-size:28px;line-height:1.25;">Nova mensagem pelo site.</p>
          <p><strong style="color:#f0ede6;">Nome:</strong> ${escapeHtml(nome)}</p>
          <p><strong style="color:#f0ede6;">E-mail:</strong> ${escapeHtml(email)}</p>
          <p><strong style="color:#f0ede6;">Interesse:</strong> ${escapeHtml(tipo || 'Não informado')}</p>
          <div style="margin-top:24px;padding:18px;border:1px solid #302e2a;background:#0f0f0e;color:#dedbd4;white-space:pre-wrap;">${escapeHtml(mensagem)}</div>
        `)

        await sendEmail({
          to: PHOTOGRAPHER_EMAIL,
          subject: `Nova mensagem pelo site — ${nome}`,
          html,
          text: `Nova mensagem pelo site.\n\nNome: ${nome}\nE-mail: ${email}\nInteresse: ${tipo || 'Não informado'}\n\n${mensagem}`,
          replyTo: email,
        })

        photographerSent = true
      } catch (error) {
        console.error('[contact-notifications] E-mail do fotógrafo falhou:', error)
      }
    }

    // 2) Confirmação para a cliente
    try {
      const nomeCurto = firstName(nome)
      const html = emailShell(`
        <p style="margin-top:0;color:#f0ede6;font-family:Georgia,serif;font-size:28px;line-height:1.25;">Olá, ${escapeHtml(nomeCurto)}.</p>
        <p>Recebi a sua mensagem e o seu interesse em ${escapeHtml(tipo || 'uma sessão fotográfica')}.</p>
        <p>Obrigado por entrar em contato. Assim que possível responderei pessoalmente para conversarmos sobre o ensaio e esclarecer todas as suas dúvidas.</p>
        <p style="margin-top:28px;color:#f0ede6;">Até breve,<br>Rangel Santos</p>
      `)

      await sendEmail({
        to: email,
        subject: 'Recebi a sua mensagem — Rangel Santos Fotografia',
        html,
        text: `Olá, ${nomeCurto}. Recebi a sua mensagem. Obrigado por entrar em contato. Assim que possível responderei pessoalmente para conversarmos sobre o ensaio e esclarecer todas as suas dúvidas.\n\nRangel Santos Fotografia`,
        replyTo: PHOTOGRAPHER_EMAIL || undefined,
      })

      clientSent = true
    } catch (error) {
      console.error('[contact-notifications] Confirmação da cliente falhou:', error)
    }

    return json({
      ok: true,
      saved: true,
      message_id: inserted?.id || null,
      created_at: inserted?.created_at || null,
      notifications: {
        photographer: photographerSent,
        client: clientSent,
      },
    })
  } catch (error) {
    console.error('[contact-notifications] Erro interno:', error)
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro interno.',
      },
      500
    )
  }
})
