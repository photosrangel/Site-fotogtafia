// ============================================
// CMS — CONFIGURAÇÃO COMPARTILHADA
// ============================================
// Criado para todas as páginas públicas do site.
// Centraliza a inicialização do Supabase, o carregamento
// das configurações gerais e o preenchimento automático
// de elementos globais (rodapé, links de contato).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mantém compatibilidade com os scripts antigos (inicio.js, gallery.js)
window.supabaseClient = supabase;

let settingsCache = null;

export async function getSettings(force = false) {
  if (settingsCache && !force) return settingsCache;

  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  settingsCache = (error ? null : data) || {};
  return settingsCache;
}

export async function getPageContent(slug) {
  const { data } = await supabase
    .from('site_content')
    .select('section_key, content')
    .eq('slug', slug);

  const sections = {};

  (data || []).forEach(s => {
    let content = s.content;

    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (e) {
        content = {};
      }
    }

    sections[s.section_key] = content || {};
  });

  return sections;
}

export async function saveSection(slug, sectionKey, content) {
  const { data: existing } = await supabase
    .from('site_content')
    .select('id')
    .eq('slug', slug)
    .eq('section_key', sectionKey)
    .maybeSingle();

  const payload = {
    slug,
    section_key: sectionKey,
    content,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    return await supabase
      .from('site_content')
      .update(payload)
      .eq('id', existing.id);
  }

  return await supabase.from('site_content').insert(payload);
}

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Aplica as configurações gerais nos elementos do site.
// Os elementos precisam ter atributos data-setting no HTML.
export function applySettings(settings) {
  const s = settings || {};

  const footerText = document.querySelector('[data-setting="footer_text"]');
  if (footerText && s.footer_text) footerText.textContent = s.footer_text;

  const siteName = document.querySelector('[data-setting="site_name"]');
  if (siteName && s.site_name) {
    const em = siteName.querySelector('em');
    if (em) {
      const partes = String(s.site_name).split(/[-–—]/);
      em.textContent = (partes.pop() || s.site_name).trim();
      siteName.childNodes[0].textContent = partes.length ? partes.join('-').trim() + ' ' : '';
    } else {
      siteName.textContent = s.site_name;
    }
  }

  const insta = document.querySelector('[data-setting="instagram_url"]');
  if (insta && s.instagram_url) insta.href = s.instagram_url;

  const wa = document.querySelector('[data-setting="whatsapp"]');
  if (wa && s.whatsapp) {
    const digits = String(s.whatsapp).replace(/\D/g, '');
    if (digits) wa.href = `https://wa.me/${digits}`;
  }

  const email = document.querySelector('[data-setting="email"]');
  if (email && s.email) email.href = `mailto:${s.email}`;
}

// Inicializa a página pública: aplica configurações globais.
export async function initSite() {
  const settings = await getSettings();
  applySettings(settings);
  return { supabase, settings };
}
