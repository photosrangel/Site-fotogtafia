import { unstable_cache } from 'next/cache';
import { createSupabasePublicClient } from '@/lib/supabase/public';

export type SiteSettings={site_name?:string;footer_text?:string;instagram_url?:string;whatsapp?:string;email?:string;location?:string;specialty?:string};

const fetchNativePageData=async(slug:string):Promise<{settings:SiteSettings;content:Record<string,any>}>=>{
  const client=createSupabasePublicClient();
  const [s,c]=await Promise.all([
    client.from('site_settings').select('*').limit(1).maybeSingle(),
    client.from('site_content').select('section_key,content').eq('slug',slug)
  ]);
  if(s.error||c.error)throw s.error||c.error;
  return {settings:(s.data||{}) as SiteSettings,content:Object.fromEntries((c.data||[]).map(row=>[row.section_key,typeof row.content==='string'?JSON.parse(row.content):row.content]))};
};

const getCachedNativePageData=unstable_cache(fetchNativePageData,['public-site-content-v69'],{revalidate:30,tags:['public-site-content']});

export async function getNativePageData(slug:string):Promise<{settings:SiteSettings;content:Record<string,any>}>{
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return {settings:{},content:{}};
  try{return await getCachedNativePageData(slug)}catch{return {settings:{},content:{}}}
}

export function legacyMediaUrl(value:string|undefined,fallback:string){const url=(value||fallback).trim();return /^https?:\/\//.test(url)||url.startsWith('/')?url:`/legacy/${url}`}
