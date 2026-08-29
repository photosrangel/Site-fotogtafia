import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export const ADMIN_USER_ID=process.env.NEXT_PUBLIC_ADMIN_USER_ID||'e0a315bb-3614-4dbb-b020-3e8175a67e8a';
export function getAdminBrowserClient(ref:{current:SupabaseClient|null}){ref.current||=createSupabaseBrowserClient();return ref.current}
export async function requireAdminSession(client:SupabaseClient):Promise<Session|null>{const {data}=await client.auth.getSession();const session=data.session;if(!session||session.user.id!==ADMIN_USER_ID)return null;if(session.expires_at&&session.expires_at*1000<=Date.now())return null;return session}
