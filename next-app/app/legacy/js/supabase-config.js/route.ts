import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function asJavaScriptString(value: string) {
  return JSON.stringify(value);
}

export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  // Site key do Turnstile: não é segredo (é feita para ficar no código do
  // navegador), por isso tem um valor padrão aqui. Pode ser sobrescrita por
  // variável de ambiente na Vercel se a chave mudar, sem precisar redeploy.
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEoCYWIrfz5DDpH5';

  if (!url || !publishableKey) {
    return new NextResponse(
      'throw new Error("As variaveis publicas do Supabase nao estao configuradas.");',
      {
        status: 503,
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }

  return new NextResponse(
    `export const SUPABASE_URL=${asJavaScriptString(url)};\nexport const SUPABASE_ANON_KEY=${asJavaScriptString(publishableKey)};\nexport const TURNSTILE_SITE_KEY=${asJavaScriptString(turnstileSiteKey)};\n`,
    {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
