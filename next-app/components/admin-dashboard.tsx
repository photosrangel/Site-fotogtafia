'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const ADMIN_ID=process.env.NEXT_PUBLIC_ADMIN_USER_ID||'e0a315bb-3614-4dbb-b020-3e8175a67e8a';
type Activity={id?:string|number;title?:string;detail?:string;severity?:string;created_at?:string};
type Stats={galleries:number;published:number;categories:number;photos:number;messages:number};
const emptyStats:Stats={galleries:0,published:0,categories:0,photos:0,messages:0};
const futureJwt=(error:any)=>String(error?.code||'')==='PGRST303'&&/issued at future/i.test(String(error?.message||''));
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const formatDate=(value?:string)=>{if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';try{return new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short'}).format(date)}catch{return date.toLocaleString('pt-PT')}};

export function AdminDashboard(){
  const clientRef=useRef<SupabaseClient|null>(null);
  const [booting,setBooting]=useState(true);const [session,setSession]=useState<Session|null>(null);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [loginMessage,setLoginMessage]=useState('');
  const [busy,setBusy]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const [stats,setStats]=useState(emptyStats);
  const [activities,setActivities]=useState<Activity[]>([]);const [dashboardMessage,setDashboardMessage]=useState('');const [loadingDashboard,setLoadingDashboard]=useState(false);
  const client=()=>{clientRef.current||=createSupabaseBrowserClient();return clientRef.current};

  const acceptSession=useCallback(async(next:Session|null)=>{
    if(!next){setSession(null);return false}
    if(next.expires_at&&next.expires_at*1000<=Date.now()){await client().auth.signOut().catch(()=>{});setLoginMessage('Sua sessão anterior expirou. Entre novamente.');setSession(null);return false}
    if(next.user.id!==ADMIN_ID){await client().auth.signOut();setLoginMessage('Este usuário não possui permissão de administrador.');setSession(null);return false}
    setSession(next);return true;
  },[]);

  const loadDashboard=useCallback(async()=>{
    setLoadingDashboard(true);setDashboardMessage('');
    const query=async()=>{const supabase=client();const [galleries,categories,photos,messages,activity]=await Promise.all([
      supabase.from('galleries').select('id,published'),supabase.from('categories').select('id'),supabase.from('gallery_photos').select('id,published'),
      supabase.from('mensagens').select('id').eq('lida',false).then(value=>value,()=>({data:[],error:null})),
      supabase.from('admin_activity').select('*').order('created_at',{ascending:false}).limit(12).then(value=>value,()=>({data:[],error:null}))
    ]);return {galleries,categories,photos,messages,activity}};
    try{let result=await query();let errors=[result.galleries.error,result.categories.error,result.photos.error,result.messages.error,result.activity.error].filter(Boolean);if(errors.some(futureJwt)){await wait(1600);result=await query();errors=[result.galleries.error,result.categories.error,result.photos.error,result.messages.error,result.activity.error].filter(Boolean)}
      const galleries=result.galleries.data||[];const photos=result.photos.data||[];
      setStats({galleries:galleries.length,published:galleries.filter(item=>item.published).length,categories:(result.categories.data||[]).length,photos:photos.filter(item=>item.published).length,messages:(result.messages.data||[]).length});setActivities((result.activity.data||[]) as Activity[]);
      if(errors.length)setDashboardMessage(`Não foi possível carregar parte do painel: ${String((errors[0] as any)?.message||(errors[0] as any)?.code||'erro desconhecido')}. Tente atualizar a página.`)
    }catch(error){console.error('[admin-next] Falha no Dashboard:',error);setDashboardMessage('Não foi possível carregar o Dashboard. Tente atualizar a página.')}finally{setLoadingDashboard(false)}
  },[]);

  useEffect(()=>{let active=true;const supabase=client();supabase.auth.getSession().then(async({data})=>{if(!active)return;await acceptSession(data.session);setBooting(false)}).catch(()=>{if(active)setBooting(false)});const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)acceptSession(next)});return()=>{active=false;listener.subscription.unsubscribe()}},[acceptSession]);
  useEffect(()=>{if(!session)return;const timer=setTimeout(loadDashboard,500);const channel=client().channel('admin-next-dashboard').on('postgres_changes',{event:'*',schema:'public',table:'galleries'},loadDashboard).on('postgres_changes',{event:'*',schema:'public',table:'categories'},loadDashboard).on('postgres_changes',{event:'*',schema:'public',table:'gallery_photos'},loadDashboard).on('postgres_changes',{event:'*',schema:'public',table:'mensagens'},loadDashboard).subscribe();return()=>{clearTimeout(timer);client().removeChannel(channel)}},[session,loadDashboard]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false)};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[]);

  async function login(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setLoginMessage('Entrando...');try{const result=await Promise.race([client().auth.signInWithPassword({email:email.trim().toLowerCase(),password}),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),10000))]);if(result.error){setLoginMessage(/confirm|verified|verification|mail/i.test(String(result.error.message||''))?'Seu e-mail ainda não foi confirmado.':'E-mail ou senha incorretos.');return}if(!result.data.session){setLoginMessage('Sessão não estabelecida. Tente novamente.');return}const accepted=await acceptSession(result.data.session);if(accepted)setLoginMessage('')}catch(error){console.error('[admin-next] Erro no login:',error);setLoginMessage(error instanceof Error&&error.message==='timeout'?'Demorou demais para conectar ao servidor. Verifique sua internet e tente novamente.':'Erro inesperado ao entrar.')}finally{setBusy(false)}}
  async function logout(){setBusy(true);await client().auth.signOut();setSession(null);setBusy(false)}
  const openLegacy=()=>{const label=(document.activeElement?.textContent||'').toLocaleLowerCase('pt-PT');window.location.assign(label.includes('categorias')?'/admin/categorias':'/legacy/admin-v2.html')};

  if(booting)return <div className="admin-native-loading">Verificando sessão administrativa…</div>;
  if(!session)return <div className="admin-v2-login"><div className="login-box-v2"><p className="section-eyebrow">Acesso restrito</p><h1>Administração</h1><p className="admin-lead">Entre para gerenciar o conteúdo do novo site.</p><p className="footer-mono">Painel Next.js · migração em andamento</p><form onSubmit={login}><div className="field"><label htmlFor="login-email">E-mail</label><input type="email" id="login-email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)}/></div><div className="field"><label htmlFor="login-password">Senha</label><input type="password" id="login-password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></div><button className="btn btn-accent" type="submit" disabled={busy}>Entrar</button><p className={`msg ${loginMessage&&loginMessage!=='Entrando...'?'erro':''}`}>{loginMessage}</p></form></div></div>;

  const menu=[['Dashboard',false],['Design',true],['Galerias',true],['Categorias',true],['Ensaios',true],['Mensagens',true],['Configurações',true]] as const;
  return <div className="admin-v2-app"><button className={`admin-mobile-menu-toggle ${menuOpen?'is-open':''}`} type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}><span></span><span></span><span></span></button>{menuOpen&&<button className="admin-sidebar-backdrop is-open" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}<aside className={`admin-sidebar ${menuOpen?'is-open':''}`}><div className="sidebar-brand"><a href="/" className="nav-logo">Rangel <em>Santos</em></a><span>CMS NEXT</span></div><nav className="sidebar-nav">{menu.map(([label,pending])=><button key={label} className={`sidebar-link ${label==='Dashboard'?'active':''} ${pending?'admin-native-disabled':''}`} onClick={pending?openLegacy:()=>setMenuOpen(false)}>{label}{pending&&<span className="admin-native-badge">em migração</span>}</button>)}</nav><div className="sidebar-bottom"><a href="/" className="sidebar-link sidebar-link-anchor">Ver site</a><button className="sidebar-link" onClick={logout} disabled={busy}>Sair</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><p className="section-eyebrow">Painel</p><h1>Dashboard</h1></div><div className="admin-user">{session.user.email||''}</div></header>{dashboardMessage&&<div className="flash erro">{dashboardMessage}</div>}<section className="admin-view"><div className="admin-native-legacy-note">Dashboard já migrado para Next.js. As demais seções continuam disponíveis no painel atual enquanto são migradas uma a uma.</div><div className="dashboard-quick-actions"><button className="btn btn-accent" onClick={openLegacy}>+ Nova galeria</button><button className="btn" onClick={openLegacy}>+ Novo ensaio</button><button className="btn" onClick={openLegacy}>Ver mensagens</button><button className="btn" onClick={openLegacy}>Editar site</button></div><div className="stats-grid"><article className="stat-card"><span>Galerias</span><strong>{loadingDashboard?'—':stats.galleries}</strong></article><article className="stat-card"><span>Publicadas</span><strong>{loadingDashboard?'—':stats.published}</strong></article><article className="stat-card"><span>Categorias</span><strong>{loadingDashboard?'—':stats.categories}</strong></article><article className="stat-card"><span>Fotos públicas</span><strong>{loadingDashboard?'—':stats.photos}</strong></article><article className="stat-card"><span>Mensagens</span><strong style={stats.messages?{color:'var(--accent)'}:undefined}>{loadingDashboard?'—':stats.messages}</strong></article></div><article className="panel dashboard-activity-panel"><div className="panel-head"><h2>Atividade recente</h2><div className="admin-native-refresh"><button className="small-btn" onClick={loadDashboard} disabled={loadingDashboard}>Atualizar</button></div></div><div className="dashboard-activity-list">{loadingDashboard&&<p className="panel-copy">Carregando atividades…</p>}{!loadingDashboard&&!activities.length&&<p className="panel-copy">Nenhuma atividade registrada ainda.</p>}{!loadingDashboard&&activities.map((item,index)=><div className={`dashboard-activity-item is-${item.severity||'info'}`} key={item.id||index}><span className="dashboard-activity-dot"></span><div><strong>{item.title||'Atividade'}</strong>{item.detail&&<small>{item.detail}</small>}</div><time>{formatDate(item.created_at)}</time></div>)}</div></article></section></main></div>;
}
