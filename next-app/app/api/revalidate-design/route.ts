import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { createSupabasePublicClient } from '@/lib/supabase/public';

const ADMIN_ID = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!accessToken) {
    return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });
  }

  const client = createSupabasePublicClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user || data.user.id !== ADMIN_ID) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  revalidateTag('published-design', 'max');
  revalidateTag('public-site-content', 'max');
  revalidateTag('public-gallery', 'max');
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true });
}
