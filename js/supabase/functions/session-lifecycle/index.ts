import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
async function sendExpiryEmail(session:any,days:number){const key=Deno.env.get('RESEND_API_KEY');if(!key||!session.cliente_email)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>';const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[session.cliente_email],subject:`Sua galeria expira em ${days} dia${days===1?'':'s'}`,html:`<p>Olá${session.cliente_nome?', '+session.cliente_nome:''}.</p><p>Sua galeria <strong>${session.titulo}</strong> será removida em ${days} dia${days===1?'':'s'}.</p><p>Faça o download das suas fotografias antes do prazo.</p>`})});return response.ok}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  const secret=Deno.env.get('CRON_SECRET');
  if(secret&&req.headers.get('x-cron-secret')!==secret)return new Response('Unauthorized',{status:401});
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now=new Date();
  const {data:sessions,error}=await client.from('ensaios').select('*').not('expires_at','is',null).is('expired_at',null);
  if(error)return Response.json({ok:false,error:error.message},{status:500,headers:cors});
  const results=[];
  for(const session of sessions||[]){
    const expiry=new Date(session.expires_at);const days=Math.ceil((expiry.getTime()-now.getTime())/86400000);
    for(const warning of [7]){const field=`expiry_warning_${warning}_sent_at`;if(days===warning&&!session[field]){const sent=await sendExpiryEmail(session,days);if(sent)await client.from('ensaios').update({[field]:now.toISOString()}).eq('id',session.id);results.push({id:session.id,warning,email_sent:sent})}}
    if(days<=0){const {data:photos}=await client.from('fotos').select('id,url').eq('ensaio_id',session.id);const paths=(photos||[]).map((p:any)=>{try{const u=new URL(p.url);const marker='/fotos/';return u.pathname.includes(marker)?decodeURIComponent(u.pathname.split(marker)[1]):null}catch{return null}}).filter(Boolean);if(paths.length)await client.storage.from('fotos').remove(paths);await client.from('fotos').delete().eq('ensaio_id',session.id);await client.from('ensaios').update({expired_at:now.toISOString(),status:'expirado'}).eq('id',session.id);await client.from('admin_activity').insert({activity_type:'session_expired',title:`Galeria expirada: ${session.titulo}`,entity_type:'ensaio',entity_id:String(session.id),severity:'warning'});results.push({id:session.id,expired:true})}
  }
  return Response.json({ok:true,processed:results},{headers:{...cors,'Content-Type':'application/json'}});
});
