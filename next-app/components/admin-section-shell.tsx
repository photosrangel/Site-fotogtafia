'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { adminUiDefaults, normalizeAdminUi } from '@/lib/admin-ui';

const sectionData={dashboard:['nav_dashboard','/admin-react'],design:['nav_design','/admin-react/design'],galleries:['nav_galleries','/admin-react/galerias'],categories:['nav_categories','/admin-react/categorias'],sessions:['nav_sessions','/admin-react/ensaios'],messages:['nav_messages','/admin-react/mensagens'],settings:['nav_settings','/admin-react/configuracoes']} as const;
export function AdminSectionShell({active,email,eyebrow,title,menuOpen,setMenuOpen,onLogout,children}:{active:string;email:string;eyebrow:string;title:string;menuOpen:boolean;setMenuOpen:(value:boolean)=>void;onLogout:()=>void;children:ReactNode}){
 const [ui,setUi]=useState(adminUiDefaults);
 useEffect(()=>{createSupabaseBrowserClient().from('site_content').select('content').eq('slug','admin').eq('section_key','interface').maybeSingle().then(({data})=>{if(data?.content)setUi(normalizeAdminUi(data.content))})},[]);
 const sections=ui.menu_order.map(key=>{const [labelKey,path]=sectionData[key as keyof typeof sectionData];return [ui[labelKey],path] as const});
 const brandParts=ui.brand.trim().split(/\s+/),last=brandParts.pop()||'',first=brandParts.join(' ');
 return <div className="admin-v2-app"><button className="admin-mobile-menu-toggle" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><span></span><span></span><span></span></button>{menuOpen&&<button className="admin-sidebar-backdrop is-open" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}<aside className={`admin-sidebar ${menuOpen?'is-open':''}`}><div className="sidebar-brand"><Link href="/" className="nav-logo">{first&&`${first} `}<em>{last}</em></Link><span>{ui.version}</span></div><nav className="sidebar-nav">{sections.map(([label,path])=><Link key={path} onClick={()=>setMenuOpen(false)} className={`sidebar-link sidebar-link-anchor ${active===path?'active':''}`} href={path}>{label}</Link>)}</nav><div className="sidebar-bottom"><Link href="/" className="sidebar-link sidebar-link-anchor">{ui.nav_view_site}</Link><button className="sidebar-link" onClick={onLogout}>{ui.nav_logout}</button></div></aside><main className="admin-main"><header className="admin-topbar"><div><p className="section-eyebrow">{eyebrow}</p><h1>{title}</h1></div><div className="admin-user">{email}</div></header>{children}</main></div>
}
