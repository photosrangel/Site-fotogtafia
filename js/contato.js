// ============================================
// CONTATO — CMS
// ============================================
// Carrega os textos da página de contato do Supabase
// e envia as mensagens do formulário para a tabela
// 'mensagens', que o painel admin mostra em "Mensagens".

import { getPageContent, getSettings, initSite, esc, supabase } from './cms-config.js';

const DEFAULTS = {
  eyebrow: 'Renove sua autoestima',
  title: 'Contato',
  submit_label: 'Enviar mensagem',
  tipos: [
    'Sessão de Autoestima',
    'Retrato em Estúdio',
    'Retrato Externo',
    'Sessão Sensual',
    'Outro'
  ],
  atendimento: 'Vale de Cambra e arredores — sessões sob agendamento'
};

function formatarWhatsApp(numero) {
  const digits = String(numero || '').replace(/\D/g, '');

  if (/^351\d{9}$/.test(digits)) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 12)}`;
  }

  return numero || '+351 931 159 748';
}

function handleInstagram(url) {
  const value = String(url || '').trim();

  if (!value || value === 'https://instagram.com' || value === 'https://www.instagram.com') {
    return '@photosrangel';
  }

  if (value.startsWith('@')) return value;

  try {
    const pathname = new URL(value).pathname.replace(/^\/+|\/+$/g, '');
    return pathname ? `@${pathname.split('/')[0]}` : '@photosrangel';
  } catch {
    return '@photosrangel';
  }
}

function preencherInfoContato(settings, content) {
  const dl = document.getElementById('contato-info');
  if (!dl) return;

  const email = settings.email || 'rangelsantos1812@gmail.com';

  // Estes dois dados são fixos nesta página para não serem sobrescritos
  // por valores antigos ainda salvos em site_settings no Supabase.
  const whatsapp = '351931159748';
  const instagram = 'https://instagram.com/photosrangel';

  dl.innerHTML = `
    <dt>E-mail</dt>
    <dd><a href="mailto:${esc(email)}" target="_blank" rel="noopener">${esc(email)}</a></dd>
    <dt>WhatsApp</dt>
    <dd><a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">+351 931 159 748</a></dd>
    <dt>Instagram</dt>
    <dd><a href="${instagram}" target="_blank" rel="noopener">@photosrangel</a></dd>
    <dt>Atendimento</dt>
    <dd>${esc(content.atendimento || DEFAULTS.atendimento)}</dd>
  `;

  // Corrige também os links do rodapé desta página após initSite(),
  // impedindo que site_settings antigo volte a colocar os links anteriores.
  document
    .querySelectorAll('a[data-contact-fixed="whatsapp"]')
    .forEach(a => a.href = `https://wa.me/${whatsapp}`);

  document
    .querySelectorAll('a[data-contact-fixed="instagram"]')
    .forEach(a => a.href = instagram);
}

function preencherFormulario(content) {
  const eyebrow = document.getElementById('contato-eyebrow');
  if (eyebrow) eyebrow.textContent = content.eyebrow || DEFAULTS.eyebrow;

  const title = document.getElementById('contato-title');
  if (title) title.textContent = content.title || DEFAULTS.title;

  const submit = document.getElementById('contato-submit');
  if (submit) submit.textContent = content.submit_label || DEFAULTS.submit_label;

  const select = document.getElementById('tipo');
  const tipos =
    Array.isArray(content.tipos) && content.tipos.length
      ? content.tipos
      : DEFAULTS.tipos;

  select.innerHTML = tipos.map(t => `<option>${esc(t)}</option>`).join('');
}

async function enviarMensagem(e) {
  e.preventDefault();

  const msgEl = document.getElementById('contato-msg');
  const btn = document.getElementById('contato-submit');

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const tipo = document.getElementById('tipo').value;
  const mensagem = document.getElementById('mensagem').value.trim();

  if (!nome || !email || !mensagem) {
    msgEl.textContent = 'Preencha nome, e-mail e mensagem.';
    msgEl.className = 'msg erro';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';
  msgEl.textContent = '';
  msgEl.className = 'msg';

  const { error } = await supabase
    .from('mensagens')
    .insert({ nome, email, tipo, mensagem });

  btn.disabled = false;
  btn.textContent =
    document.getElementById('contato-submit').dataset.original ||
    'Enviar mensagem';

  if (error) {
    msgEl.textContent = 'Não foi possível enviar. Tente novamente em instantes.';
    msgEl.className = 'msg erro';
    return;
  }

  msgEl.textContent = 'Mensagem enviada! Em breve entro em contato.';
  msgEl.className = 'msg sucesso';
  e.target.reset();
}

async function iniciarContato() {
  const submit = document.getElementById('contato-submit');
  submit.dataset.original = submit.textContent;

  const { settings } = await initSite();
  const sections = await getPageContent('contato');
  const content = sections.conteudo || {};

  preencherFormulario(content);
  preencherInfoContato(settings, content);

  document
    .getElementById('contato-form')
    .addEventListener('submit', enviarMensagem);
}

document.addEventListener('DOMContentLoaded', iniciarContato);
