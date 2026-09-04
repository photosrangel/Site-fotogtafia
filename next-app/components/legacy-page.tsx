'use client';

import { useEffect, useRef, useState } from 'react';

type LegacyPageProps = { file: string; title: string };

const routeByPath: Record<string,string> = {
  '/inicio':'/', '/index.html':'/', '/galeria':'/galeria', '/galeria.html':'/galeria',
  '/sobre':'/sobre', '/sobre.html':'/sobre', '/contato':'/contato', '/contato.html':'/contato',
  '/area-cliente':'/area-cliente', '/area-cliente.html':'/area-cliente',
  '/admin-v2':'/admin', '/admin-v2.html':'/admin'
};

export function LegacyPage({ file, title }: LegacyPageProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const baseSource = `/legacy/${file}`;
  const [source, setSource] = useState(baseSource);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const callback = new URLSearchParams(hash.slice(1));
    if (!callback.has('access_token') && !callback.has('error')) return;

    // O Supabase devolve a sessão no fragmento da rota Next. O cliente de
    // autenticação vive no painel legado incorporado, então entregamos o
    // fragmento ao iframe uma única vez e o removemos imediatamente da barra.
    setSource(`${baseSource}${hash}`);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, [baseSource]);

  function connectNavigation() {
    const document = frame.current?.contentDocument;
    if (!document || document.documentElement.dataset.nextBridge === '1') return;
    document.documentElement.dataset.nextBridge = '1';
    document.addEventListener('click', event => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.origin !== window.location.origin) return;
      const route = routeByPath[anchor.pathname];
      if (!route) return;
      event.preventDefault();
      window.location.assign(route);
    });
  }
  return <iframe ref={frame} onLoad={connectNavigation} className="legacy-frame" src={source} title={title} />;
}
