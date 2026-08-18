// ============================================
// SOBRE — CMS
// ============================================
// Carrega o conteúdo da página "Sobre" do Supabase
// (tabela site_content, slug 'sobre', seção 'conteudo').
// Se não houver conteúdo salvo, usa os padrões abaixo.

import { getPageContent, getSettings, initSite, esc } from './cms-config.js';

const DEFAULTS = {
  eyebrow: 'Sobre mim',
  paragraphs: [
    'Meu nome é Rangel Santos, fotógrafo em Vale de Cambra, Portugal. Meu trabalho é dedicado ao retrato feminino — não o retrato que só mostra como você é por fora, mas aquele que devolve algo por dentro.',
    'Ajudar mulheres a reconstruir a autoestima é o que me motiva a cada sessão. Muitas chegam inseguras diante da câmera, e minha função é criar o ambiente certo para que isso se dissolva — com luz, tempo, e escuta.',
    'Cada projeto é entregue com cuidado: você recebe um link privado para escolher suas fotos favoritas, e eu trato as imagens escolhidas uma a uma antes da entrega final.'
  ],
  specs: [
    { label: 'Baseado em', value: 'Vale de Cambra, Portugal' },
    { label: 'Especialidade', value: 'Retrato Feminino & Autoestima' },
    { label: 'Prazo de entrega', value: '05–10 dias úteis' },
    { label: 'Atende', value: 'Vale de Cambra e arredores' }
  ],
  portrait_url: 'images/retrato-01.jpg',
  portrait_alt: 'Retrato de Rangel Santos, fotógrafo',
  cta_text: 'Vamos conversar',
  cta_url: '/contato'
};

async function carregarSobre() {
  const { settings } = await initSite();
  const sections = await getPageContent('sobre');
  const c = sections.conteudo || {};

  const eyebrow = document.getElementById('sobre-eyebrow');
  if (eyebrow) eyebrow.textContent = c.eyebrow || DEFAULTS.eyebrow;

  const paragraphs =
    Array.isArray(c.paragraphs) && c.paragraphs.length
      ? c.paragraphs
      : DEFAULTS.paragraphs;

  const parasContainer = document.getElementById('sobre-paragraphs');
  parasContainer.innerHTML = paragraphs
    .map(p => `<p>${esc(p)}</p>`)
    .join('');

  let specs =
    Array.isArray(c.specs) && c.specs.length
      ? c.specs
      : DEFAULTS.specs;

  const fallbacks = {
    'Baseado em': settings.location,
    'Especialidade': settings.specialty,
    'Atende': settings.availability
  };

  specs = specs.map(spec => {
    const valorSalvo = String(spec.value ?? '').trim();
    const fallback = fallbacks[spec.label];

    return !valorSalvo && fallback
      ? { ...spec, value: fallback }
      : spec;
  });

  const specsEl = document.getElementById('sobre-specs');
  specsEl.innerHTML = specs
    .map(
      spec =>
        `<div><dt>${esc(spec.label)}</dt><dd>${esc(spec.value)}</dd></div>`
    )
    .join('');

  const portrait = document.getElementById('sobre-portrait');
  portrait.src = c.portrait_url || DEFAULTS.portrait_url;
  portrait.alt = c.portrait_alt || DEFAULTS.portrait_alt;

  const cta = document.getElementById('sobre-cta');
  cta.href = c.cta_url || DEFAULTS.cta_url;
  cta.textContent = c.cta_text || DEFAULTS.cta_text;
}

document.addEventListener('DOMContentLoaded', carregarSobre);
