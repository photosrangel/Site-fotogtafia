import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
async function sendExpiryEmail(session:any,days:number){const key=Deno.env.get('RESEND_API_KEY');if(!key||!session.cliente_email)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>';const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[session.cliente_email],subject:`Sua galeria expira em ${days} dia${days===1?'':'s'}`,html:`<p>Olá${session.cliente_nome?', '+session.cliente_nome:''}.</p><p>Sua galeria <strong>${session.titulo}</strong> será removida em ${days} dia${days===1?'':'s'}.</p><p>Faça o download das suas fotografias antes do prazo.</p>`})});return response.ok}
async function sendFailureAlert(message:string){const key=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('PHOTOGRAPHER_EMAIL');if(!key||!to)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>';try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Alerta: falha na rotina diária das galerias',html:`<p>A rotina automática <strong>session-lifecycle</strong> encontrou uma falha.</p><p>${message.replace(/[<>&]/g,'')}</p><p>Consulte os logs das Edge Functions no Supabase.</p>`})});return response.ok}catch{return false}}
async function sendDeletionEmail(session:any,count:number){const key=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('PHOTOGRAPHER_EMAIL');if(!key||!to)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>';try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`Galeria removida — ${session.titulo||'Ensaio'}`,html:`<p>A remoção programada da galeria <strong>${String(session.titulo||'Ensaio').replace(/[<>&]/g,'')}</strong> foi concluída.</p><p>${count} fotografia${count===1?' foi removida':'s foram removidas'} do armazenamento após o período de segurança.</p><p>O cadastro e o histórico do ensaio foram preservados no painel.</p>`})});return response.ok}catch{return false}}
const safe=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]||char));
async function sendSelectionReminder(session:any,day:number,hasAccessed:boolean){const key=Deno.env.get('RESEND_API_KEY');if(!key||!session.cliente_email)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>',site=(Deno.env.get('SITE_URL')||'https://photosrangel.pt').replace(/\/$/,'');const message=hasAccessed?'Vimos que você já deu uma olhada nas fotografias. Quando quiser finalizar a escolha, é só voltar à sua área privada.':day>=7?'As fotografias do seu ensaio continuam aguardando a sua seleção.':'Suas fotografias estão esperando por você.';try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[session.cliente_email],subject:day>=15?'Sua seleção de fotografias continua pendente':'Um lembrete sobre a seleção das suas fotografias',html:`<p>Olá${session.cliente_nome?', '+safe(session.cliente_nome):''}.</p><p>${message}</p><p>Ensaio: <strong>${safe(session.titulo||'Ensaio')}</strong>.</p><p><a href="${site}/area-cliente">Continuar seleção</a></p><p>Se tiver alguma dúvida, pode entrar em contato conosco.</p>`})});return response.ok}catch{return false}}
async function sendPendingAlert(session:any){const key=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('PHOTOGRAPHER_EMAIL');if(!key||!to)return false;const from=Deno.env.get('EMAIL_FROM')||'Rangel Santos Fotografia <onboarding@resend.dev>';try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`Seleção pendente há 15 dias — ${session.titulo||'Ensaio'}`,html:`<p><strong>${safe(session.cliente_nome||'Cliente')}</strong> ainda não selecionou as fotografias do ensaio <strong>${safe(session.titulo||'Ensaio')}</strong>.</p><p>Já se passaram 15 dias. Considere entrar em contato diretamente.</p>`})});return response.ok}catch{return false}}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response('Method Not Allowed',{status:405,headers:cors});
  const secret=Deno.env.get('CRON_SECRET');
  if(!secret)return Response.json(
    {ok:false,error:'CRON_SECRET não configurado. Rotina não executada.'},
    {status:500,headers:{...cors,'Content-Type':'application/json'}}
  );
  if(req.headers.get('x-cron-secret')!==secret)return new Response('Unauthorized',{status:401,headers:cors});
  try {
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now=new Date();
  const {data:sessions,error}=await client.from('ensaios').select('*');
  if(error)throw error;
  const results=[];
  for(const session of sessions||[]){
    if(session.status==='aguardando_selecao'){
      const {data:startEvent}=await client.from('admin_activity').select('created_at').eq('activity_type','session_selection_sent').eq('entity_id',String(session.id)).order('created_at',{ascending:true}).limit(1).maybeSingle();
      const startedAt=new Date(startEvent?.created_at||session.updated_at||session.created_at),elapsed=Math.floor((now.getTime()-startedAt.getTime())/86400000),due=elapsed>=15?15:elapsed>=7?7:elapsed>=3?3:0;
      if(due){const eventType=`selection_reminder_day_${due}`;const {count:alreadySent}=await client.from('admin_activity').select('id',{head:true,count:'exact'}).eq('activity_type',eventType).eq('entity_id',String(session.id));if(!alreadySent){const {count:accessCount}=await client.from('admin_activity').select('id',{head:true,count:'exact'}).eq('activity_type','client_gallery_accessed').eq('entity_id',String(session.id));const clientSent=await sendSelectionReminder(session,due,Boolean(accessCount));if(clientSent)await client.from('admin_activity').insert({activity_type:eventType,title:`Lembrete de seleção enviado — ${session.titulo||'Ensaio'}`,detail:`Lembrete automático do dia ${due} enviado à cliente${accessCount?', com tom suave porque ela já acessou a galeria':''}.`,entity_type:'ensaio',entity_id:String(session.id),severity:'info'});let photographerSent=false;if(due===15){const {count:alertSent}=await client.from('admin_activity').select('id',{head:true,count:'exact'}).eq('activity_type','selection_reminder_photographer_day_15').eq('entity_id',String(session.id));if(!alertSent){photographerSent=await sendPendingAlert(session);if(photographerSent)await client.from('admin_activity').insert({activity_type:'selection_reminder_photographer_day_15',title:`Seleção pendente há 15 dias — ${session.titulo||'Ensaio'}`,detail:'Aviso enviado ao fotógrafo para acompanhamento manual.',entity_type:'ensaio',entity_id:String(session.id),severity:'warning'})}}results.push({id:session.id,selection_reminder_day:due,client_sent:clientSent,photographer_sent:photographerSent})}}
      continue;
    }
    if(!session.expires_at)continue;
    const expiry=new Date(session.expires_at);const days=Math.ceil((expiry.getTime()-now.getTime())/86400000);
    if(session.expired_at){
      const deletionAt=session.deletion_scheduled_at?new Date(session.deletion_scheduled_at):null;
      if(deletionAt&&deletionAt.getTime()<=now.getTime()){
        const {data:photos,error:photosError}=await client.from('fotos').select('id,url').eq('ensaio_id',session.id);
        if(photosError)throw photosError;
        const paths=(photos||[]).map((p:any)=>{try{const u=new URL(p.url);const marker='/fotos/';return u.pathname.includes(marker)?decodeURIComponent(u.pathname.split(marker)[1]):null}catch{return null}}).filter(Boolean);
        if(paths.length){const {error:storageError}=await client.storage.from('fotos').remove(paths);if(storageError)throw storageError}
        const {error:deleteError}=await client.from('fotos').delete().eq('ensaio_id',session.id);if(deleteError)throw deleteError;
        const {error:finishError}=await client.from('ensaios').update({deletion_scheduled_at:null}).eq('id',session.id);if(finishError)throw finishError;
        const photographerNotified=await sendDeletionEmail(session,(photos||[]).length);
        await client.from('admin_activity').insert({activity_type:'session_photos_deleted',title:`Fotografias removidas: ${session.titulo}`,detail:`${(photos||[]).length} fotografia(s) removida(s) após o período de segurança. Aviso por e-mail: ${photographerNotified?'enviado':'não enviado'}.`,entity_type:'ensaio',entity_id:String(session.id),severity:'danger'});
        results.push({id:session.id,photos_deleted:true,photographer_notified:photographerNotified});
      }
      continue;
    }
    // Envia apenas o aviso mais urgente de cada execução. Assim, se o aviso
    // de sete dias tiver sido perdido, a cliente não recebe dois e-mails no
    // mesmo dia quando restar somente um dia.
    const warnings=days<=1?[1]:[7];
    for(const warning of warnings){const field=`expiry_warning_${warning}_sent_at`;if(days>0&&days<=warning&&!session[field]){const sent=await sendExpiryEmail(session,days);if(sent)await client.from('ensaios').update({[field]:now.toISOString()}).eq('id',session.id);results.push({id:session.id,warning,days_remaining:days,email_sent:sent})}}
    if(days<=0){const deletionAt=new Date(now.getTime()+3*86400000);const {error:expireError}=await client.from('ensaios').update({expired_at:now.toISOString(),deletion_scheduled_at:deletionAt.toISOString(),status:'expirado'}).eq('id',session.id);if(expireError)throw expireError;await client.from('admin_activity').insert({activity_type:'session_expired',title:`Galeria expirada: ${session.titulo}`,detail:`Fotografias agendadas para remoção em ${deletionAt.toLocaleDateString('pt-PT')}.`,entity_type:'ensaio',entity_id:String(session.id),severity:'warning'});results.push({id:session.id,expired:true,deletion_scheduled_at:deletionAt.toISOString()})}
  }
  return Response.json({ok:true,processed:results},{headers:{...cors,'Content-Type':'application/json'}});
  } catch(error) {
    const message=error instanceof Error?error.message:'Falha interna desconhecida.';
    await sendFailureAlert(message);
    return Response.json({ok:false,error:'Falha na rotina diária.'},{status:500,headers:{...cors,'Content-Type':'application/json'}});
  }
});
