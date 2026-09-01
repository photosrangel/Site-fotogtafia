import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
 if(!url||!key)return new NextResponse('throw new Error("As variaveis publicas do Supabase nao estao configuradas.");',{status:503,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'}});
 return new NextResponse(`export const SUPABASE_URL=${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY=${JSON.stringify(key)};\n`,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'public, max-age=300, s-maxage=300'}});
}
