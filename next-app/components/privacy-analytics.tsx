'use client';

import { Analytics } from '@vercel/analytics/next';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'rangel-privacy-consent-v2';
const VERSION = 2;
const SIX_MONTHS = 180 * 24 * 60 * 60 * 1000;

type Choice = { version: number; analytics: boolean; decidedAt: string; expiresAt: string };

function readChoice(): Choice | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Choice | null;
    if (!value || value.version !== VERSION || new Date(value.expiresAt) <= new Date()) return null;
    return value;
  } catch { return null; }
}

function saveChoice(analytics: boolean): Choice {
  const now = new Date();
  const value = { version: VERSION, analytics, decidedAt: now.toISOString(), expiresAt: new Date(now.getTime() + SIX_MONTHS).toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('rangel:consent', { detail: { analytics } }));
  return value;
}

export function PrivacyAnalytics() {
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [preferences, setPreferences] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);

  useEffect(() => { const stored = readChoice(); setChoice(stored); setAnalyticsDraft(stored?.analytics || false); setReady(true); }, []);
  if (!ready) return null;

  const decide = (analytics: boolean) => { setChoice(saveChoice(analytics)); setAnalyticsDraft(analytics); setPreferences(false); };
  const openPreferences = () => { setAnalyticsDraft(choice?.analytics || false); setPreferences(true); };
  const analyticsAllowed = choice?.analytics === true;

  return <>
    {analyticsAllowed && <Analytics beforeSend={event => {
      const path = new URL(event.url).pathname;
      return path.startsWith('/admin') || path.startsWith('/area-cliente') ? null : event;
    }} />}

    {!choice && !preferences && <section className="privacy-banner" role="dialog" aria-modal="true" aria-labelledby="privacy-banner-title">
      <div><strong id="privacy-banner-title">A sua privacidade</strong><p>Utilizamos recursos essenciais para o funcionamento do site. Com a sua autorização, usamos estatísticas anónimas para compreender visitas e melhorar as páginas.</p><a href="/privacidade">Conheça a Política de Privacidade</a></div>
      <div className="privacy-actions">
        <button type="button" className="privacy-button" onClick={() => decide(false)}>Recusar opcionais</button>
        <button type="button" className="privacy-button" onClick={openPreferences}>Personalizar</button>
        <button type="button" className="privacy-button" onClick={() => decide(true)}>Aceitar estatísticas</button>
      </div>
    </section>}

    {preferences && <div className="privacy-overlay" role="presentation">
      <section className="privacy-panel" role="dialog" aria-modal="true" aria-labelledby="privacy-panel-title">
        <p className="section-eyebrow">Privacidade</p><h2 id="privacy-panel-title">Definições de privacidade</h2>
        <p>Escolha como os recursos opcionais podem ser utilizados. Pode alterar esta decisão quando quiser.</p>
        <div className="privacy-option"><div><strong>Recursos essenciais</strong><small>Necessários para segurança, formulários, autenticação e preferências. Não podem ser desligados.</small></div><span>Sempre ativos</span></div>
        <label className="privacy-option"><div><strong>Estatísticas anónimas</strong><small>Permitem contar visitas e páginas acessadas através do Vercel Web Analytics. Não são usadas para publicidade.</small></div><input type="checkbox" checked={analyticsDraft} onChange={event => setAnalyticsDraft(event.target.checked)} /></label>
        <div className="privacy-panel-actions"><button type="button" className="privacy-button" onClick={() => decide(false)}>Recusar opcionais</button><button type="button" className="privacy-button privacy-primary" onClick={() => decide(analyticsDraft)}>Guardar escolhas</button></div>
      </section>
    </div>}

    {choice && !preferences && <button type="button" className="privacy-settings" onClick={openPreferences}>Definições de privacidade</button>}
  </>;
}
