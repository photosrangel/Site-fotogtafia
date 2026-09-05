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
    // Tanto a query string da página Next (ex.: ?recuperar=TOKEN, usada no
    // link de "criar nova senha" do e-mail) quanto o fragmento que o
    // Supabase devolve após confirmar um e-mail (ex.: #access_token=...)
    // ficam só na URL do navegador por padrão — o iframe tem sua própria
    // URL independente e nunca os recebe sozinho. Aqui repassamos os dois.
    const search = window.location.search;
    const hash = window.location.hash;
    const hashParams = hash ? new URLSearchParams(hash.slice(1)) : null;
    const hashIsAuthCallback = !!hashParams && (hashParams.has('access_token') || hashParams.has('error'));

    if (!search && !hashIsAuthCallback) return;

    setSource(`${baseSource}${search}${hashIsAuthCallback ? hash : ''}`);

    if (hashIsAuthCallback) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
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
