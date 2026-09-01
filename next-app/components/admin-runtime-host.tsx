'use client';

import {useRef} from 'react';

const publicRoutes:Record<string,string>={
  'index.html':'/',inicio:'/',galeria:'/galeria','galeria.html':'/galeria',
  sobre:'/sobre','sobre.html':'/sobre',contato:'/contato','contato.html':'/contato',
  'area-cliente':'/area-cliente','area-cliente.html':'/area-cliente'
};

/**
 * Hospeda o painel administrativo integral dentro da rota Next /admin.
 * O runtime administrativo integral fica isolado em /admin-runtime.
 * Toda navegação destinada ao site público sai do quadro e usa as rotas Next.
 */
export function AdminRuntimeHost(){
  const frame=useRef<HTMLIFrameElement>(null);
  function connect(){
    const doc=frame.current?.contentDocument;
    if(!doc||doc.documentElement.dataset.adminNextHost==='1')return;
    doc.documentElement.dataset.adminNextHost='1';
    doc.addEventListener('click',event=>{
      const anchor=(event.target as Element|null)?.closest('a[href]') as HTMLAnchorElement|null;
      if(!anchor||anchor.target==='_blank'||anchor.origin!==location.origin)return;
      const name=anchor.pathname.split('/').filter(Boolean).at(-1)||'index.html';
      const route=publicRoutes[name];
      if(!route)return;
      event.preventDefault();
      location.assign(route);
    });
  }
  return <iframe ref={frame} onLoad={connect} className="admin-runtime-frame" src="/admin-runtime/admin-v2.html" title="Painel administrativo Rangel Santos"/>;
}
