'use client';

import {useEffect, useLayoutEffect, useState} from 'react';

type LegacyPayload = {
  markup: string;
  styles: string;
  moduleCode: string;
};

const CLIENT_COVER_CACHE = 'photosrangel:client-cover:v1';

export function NativeClientArea() {
  const [payload, setPayload] = useState<LegacyPayload | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/legacy/area-cliente.html', {cache: 'no-store'})
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(source => {
        if (cancelled) return;
        const documentSource = new DOMParser().parseFromString(source, 'text/html');
        const moduleScript = documentSource.querySelector<HTMLScriptElement>('body script[type="module"]');
        const styles = [...documentSource.querySelectorAll('head style')].map(style => style.textContent || '').join('\n');
        documentSource.querySelectorAll('body script').forEach(script => script.remove());
        setPayload({
          markup: documentSource.body.innerHTML,
          styles,
          moduleCode: (moduleScript?.textContent || '').replace("from './js/supabase-config.js'", "from '/legacy/js/supabase-config.js'")
        });
      })
      .catch(error => {
        console.error('[area-cliente] Não foi possível preparar a página nativa:', error);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!payload) return;
    document.body.classList.add('client-area-premium');
    try {
      const cached = JSON.parse(localStorage.getItem(CLIENT_COVER_CACHE) || '{}');
      const visual = document.querySelector<HTMLElement>('.client-access-visual');
      const url = typeof cached.client_access_image === 'string' ? cached.client_access_image.trim() : '';
      if (visual && url) {
        const clamp = (value: unknown, fallback: number) => {
          const number = Number(value);
          return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
        };
        visual.style.setProperty('background-image', `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34)),url("${url.replace(/"/g, '%22')}")`, 'important');
        visual.style.setProperty('background-position', `${clamp(cached.client_focus_x, 50)}% ${clamp(cached.client_focus_y, 50)}%`, 'important');
      }
    } catch {
      // O desenho publicado será aplicado logo abaixo pelo carregador normal.
    }
    return () => document.body.classList.remove('client-area-premium');
  }, [payload]);

  useEffect(() => {
    if (!payload?.moduleCode) return;
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.dataset.nativeClientArea = 'module';
    moduleScript.textContent = payload.moduleCode;
    document.body.appendChild(moduleScript);

    const sharedScript = document.createElement('script');
    sharedScript.src = '/legacy/js/main.js';
    sharedScript.dataset.nativeClientArea = 'shared';
    document.body.appendChild(sharedScript);

    return () => {
      moduleScript.remove();
      sharedScript.remove();
    };
  }, [payload]);

  if (loadError) {
    return <main className="cliente-wrap"><p className="msg erro">Não foi possível carregar a Área do Cliente. Atualize a página e tente novamente.</p></main>;
  }
  if (!payload) return <main className="cliente-wrap" aria-busy="true" />;

  return <>
    <style dangerouslySetInnerHTML={{__html: payload.styles}} />
    <div className="native-client-area-root" dangerouslySetInnerHTML={{__html: payload.markup}} />
  </>;
}
