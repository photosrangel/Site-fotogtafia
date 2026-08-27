import { ADMIN_ID, SITE_GALLERY_BUCKET as BUCKET } from './core/admin-config.js';
import { getAdminSession, signInAdmin, signOutAdmin, onAdminAuthStateChange } from './core/admin-auth-service.js';
import {
  listCategories,
  listPublishedCategories,
  createCategory,
  updateCategory,
  removeCategory,
  listTrails,
  createTrail,
  updateTrail,
  removeTrail
} from './features/categories/categories-repository.js';
import {
  listGalleries,
  getGallery,
  getGalleryWithCategory,
  getGalleryCover,
  createGallery,
  updateGallery,
  updateGalleryFields,
  updateGallerySortOrder,
  setGalleryPublished,
  setGalleryCover
} from './features/galleries/galleries-repository.js';
import {
  listGalleryPhotos,
  getGalleryPhotoPublication,
  getFirstGalleryPhoto,
  getMaxGalleryPhotoOrder,
  updateGalleryPhotoSortOrder,
  setGalleryPhotoPublished,
  setGalleryPhotosPublished,
} from './features/galleries/gallery-photos-repository.js';
import {
  listMessages,
  countUnreadMessages,
  markMessageRead,
  removeMessage
} from './features/messages/messages-repository.js';
import {
  listSessions,
  countSessionsByStatuses,
  createSession,
  updateSession,
  updateSessionAndReturn
} from './features/sessions/sessions-repository.js';
import {
  listSessionPhotos,
  listSessionPhotosForSessions,
  updateSessionPhoto,
} from './features/sessions/session-photos-repository.js';
import {
  uploadToBucket,
  getPublicUrlFromBucket,
  createSignedUrlFromBucket
} from './core/storage-service.js';
import { storagePathForBucket } from './core/storage-service.js';
import { uploadGalleryPhoto } from './features/galleries/gallery-upload-service.js';
import { uploadSessionPhoto } from './features/sessions/session-upload-service.js';
import {
  deleteGalleryWithAssets,
  deleteGalleryPhotoWithAsset
} from './features/galleries/gallery-deletion-service.js';
import {
  deleteSessionPhotoWithAsset,
  deleteSessionProofsWithAssets,
  deleteSessionWithAssets
} from './features/sessions/session-deletion-service.js';
import { getDashboardSnapshot, logAdminActivity } from './features/dashboard/dashboard-repository.js';
import {
  listSiteContent,
  listSiteContentBySlug,
  getSiteContentSection,
  upsertSiteContentSection,
  parseStoredContent
} from './features/cms/site-content-repository.js';
import {
  getSiteSettings,
  saveSiteSettings
} from './features/cms/site-settings-repository.js';
import {
  createAdminRealtimeChannel,
  removeAdminRealtimeChannel
} from './features/realtime/admin-realtime-service.js';
import {
  sendContactReply,
  notifySession
} from './features/notifications/notifications-service.js';
import {
  renderCategorySelectUI,
  renderCategoriesUI
} from './features/categories/categories-controller.js';
import { renderGalleriesUI } from './features/galleries/galleries-controller.js';
import { renderGalleryPhotosUI } from './features/galleries/gallery-detail-controller.js';
import { renderMessagesUI } from './features/messages/messages-controller.js';
import { renderSessionsUI } from './features/sessions/sessions-controller.js';
import {
  normalizeSessionStatus,
  renderSessionDetailUI
} from './features/sessions/session-detail-controller.js';

console.log('[admin-v2] Build v67 — menu mobile virou gaveta deslizante (fim da faixa horizontal quebrada)');

const $ = id => document.getElementById(id);

/*
  Modo de depuração do painel.
  Por padrão fica DESLIGADO: os logs internos (dlog/dwarn) não
  aparecem no console em produção — evita ruído e evita expor
  dados de sessão (e-mail, IDs) a quem abrir o DevTools.
  Para depurar, digite no console do navegador: ADMIN_DEBUG = true
  (ou adicione ?debug=1 na URL do painel) e recarregue a página.
*/
window.ADMIN_DEBUG = /[?&]debug=1\b/.test(location.search);
function dlog(...args) { if (window.ADMIN_DEBUG) console.log(...args); }
function dwarn(...args) { if (window.ADMIN_DEBUG) console.warn(...args); }

/* ============================================================
   MOTOR GENÉRICO DE CAMPOS DO CMS  (data-cms-field)
   ============================================================
   Por que existe:
   Cada campo editável do painel tinha sua própria função de
   ler/escrever direto do DOM (ex.: collectHeroContentPayload lendo
   $('hero-title').value em vários pontos do código). Foi exatamente
   isso que causou o bug em que a quebra de linha do hero-title se
   perdia: o DOM era relido em momentos diferentes, sem uma fonte
   única — e o mesmo padrão se repete, silenciosamente, em outros
   campos que ainda não tropeçaram visivelmente.

   Como usar (para qualquer campo novo, sem escrever função nova):
   1. No HTML do painel, adicione ao input/textarea/select:
        data-cms-field="inicio.hero.title"
      (o caminho é livre — use "pagina.bloco.campo".)
   2. Pronto. cmsBindAllFields() já vai:
      - inicializar o cmsState com o valor atual do campo;
      - atualizar o cmsState sempre que o utilizador digitar;
      - nunca mais será preciso reler $('id').value na mão para
        montar o payload de salvamento — leia com cmsFieldGet().

   Quando o CÓDIGO (não o utilizador) muda um valor — ao carregar um
   rascunho, ao publicar, ao editar pelo editor visual — use
   cmsFieldSet(caminho, valor). Isso atualiza o cmsState E empurra o
   valor de volta para qualquer campo do DOM com esse data-cms-field,
   nos dois sentidos sempre pelo mesmo caminho.
   ============================================================ */
let cmsState = {};

function cmsGetPath(path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), cmsState);
}

function cmsSetPath(path, value) {
  const keys = path.split('.');
  let node = cmsState;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
}

/* Lê o valor atual de um campo do CMS. Use isto (não $('id').value)
   sempre que for montar um payload de salvamento ou uma prévia. */
function cmsFieldGet(path, fallback = '') {
  const v = cmsGetPath(path);
  return v == null ? fallback : v;
}

/* Define o valor "oficial" de um campo — a partir do código, não de
   digitação do utilizador. Atualiza o estado E qualquer campo do
   DOM ligado ao mesmo caminho. */
function cmsFieldSet(path, value) {
  cmsSetPath(path, value);
  document.querySelectorAll(`[data-cms-field="${path}"]`).forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!value;
    } else if (el.value !== value) {
      el.value = value == null ? '' : value;
    }
  });
}

/* Liga um único campo do DOM ao cmsState. Idempotente — pode ser
   chamado de novo no mesmo elemento sem duplicar o listener. */
function cmsBindField(el) {
  const path = el.dataset.cmsField;
  if (!path || el.dataset.cmsBound === '1') return;
  el.dataset.cmsBound = '1';
  // Se o estado ainda não tem valor para este caminho, usa o que já
  // estiver no campo do DOM como ponto de partida (ex.: HTML estático).
  if (cmsGetPath(path) === undefined) {
    cmsSetPath(path, el.type === 'checkbox' ? el.checked : (el.value ?? ''));
  }
  const onUserEdit = () => {
    cmsSetPath(path, el.type === 'checkbox' ? el.checked : el.value);
  };
  el.addEventListener('input', onUserEdit);
  el.addEventListener('change', onUserEdit);
}

/* Liga todos os campos com data-cms-field encontrados dentro de
   `root` (por padrão, o documento inteiro). Chamar de novo depois
   de inserir HTML novo no painel (ex.: um modal) é seguro. */
function cmsBindAllFields(root = document) {
  root.querySelectorAll('[data-cms-field]').forEach(cmsBindField);
}

let currentGallery = null;
let categoriesCache = [];
let trailsCache = [];
let trailDraftEdits = {};
let galleriesCache = [];
let sessionsCache = [];
let currentSession = null;
let currentSessionPhotos = [];
const SESSIONS_BUCKET = 'fotos';
let designStudioReady = false;
let heroSlidesDraft = [];
let messagesCache = [];
let activeView = 'dashboard';
let adminRealtimeChannel = null;
let replyAttachmentsDraft = [];
let heroAdminPreviewTimer = null;
const sessionStageOpen = {
  provas: false,
  finais: false
};

const HERO_SLIDESHOW_DEFAULTS = {
  width: 'extended',
  fit: 'cover',
  ratio: 'fullscreen',
  animation: 'fade',
  order: 'sequential',
  behind_menu: true
};


const slugify = v =>
  String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');


function emailValido(value) {
  const email = String(value || '').trim().toLowerCase();

  // Validação simples e segura para endereços usados no CMS.
  // Aceita, por exemplo: rs.dj.rs@gmail.com
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function msg(el, t, c = '') {
  el.textContent = t || '';
  el.className = c ? `msg ${c}` : 'msg';
}


const operationLocks = new Set();

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function safeHttpUrl(value, { allowRelative = true } = {}) {
  const v = safeText(value, 2048);
  if (!v) return '';
  if (allowRelative && /^\/(?!\/)/.test(v)) return v;
  try {
    const u = new URL(v, location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return v;
  } catch (_) {}
  return '';
}

function beginFormBusy(form) {
  if (!form || form.dataset.busy === '1') return false;
  form.dataset.busy = '1';
  form.setAttribute('aria-busy', 'true');
  form.querySelectorAll('button[type="submit"]').forEach(b => {
    b.dataset.wasDisabled = b.disabled ? '1' : '0';
    b.disabled = true;
  });
  return true;
}

function endFormBusy(form) {
  if (!form) return;
  form.dataset.busy = '0';
  form.removeAttribute('aria-busy');
  form.querySelectorAll('button[type="submit"]').forEach(b => {
    b.disabled = b.dataset.wasDisabled === '1';
    delete b.dataset.wasDisabled;
  });
}

async function withOperationLock(key, task) {
  if (operationLocks.has(key)) return { skipped: true };
  operationLocks.add(key);
  try { return await task(); }
  finally { operationLocks.delete(key); }
}

function validarImagens(files, maxBytes = 25 * 1024 * 1024) {
  const permitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const validos = [];
  const rejeitados = [];
  for (const file of files || []) {
    if (!permitidos.has(file.type)) {
      rejeitados.push(`${file.name}: formato não suportado`);
    } else if (file.size > maxBytes) {
      rejeitados.push(`${file.name}: excede 25 MB`);
    } else if (file.size <= 0) {
      rejeitados.push(`${file.name}: arquivo vazio`);
    } else {
      validos.push(file);
    }
  }
  return { validos, rejeitados };
}

function flash(t, c = '') {
  const e = $('flash');

  e.textContent = t;
  e.className = `flash ${c}`;
  e.hidden = false;

  clearTimeout(flash.timer);

  flash.timer = setTimeout(() => {
    e.hidden = true;
  }, 3500);
}

function setView(v) {
  activeView = v;

  document
    .querySelectorAll('.admin-view')
    .forEach(e => {
      e.hidden = e.id !== `view-${v}`;
    });

  document
    .querySelectorAll('.sidebar-link[data-view]')
    .forEach(b => {
      b.classList.toggle(
        'active',
        b.dataset.view === v
      );
    });

  $('content-nav-toggle')?.classList.toggle(
    'active',
    v === 'content'
  );

  $('design-nav-toggle')?.classList.toggle(
    'active',
    v === 'design'
  );

  const l = {
    dashboard: ['Painel', 'Dashboard'],
    content: ['Páginas', 'Conteúdo'],
    design: ['Site', 'Design'],
    galleries: ['Conteúdo', 'Galerias'],
    categories: ['Organização', 'Categorias'],
    sessions: ['Clientes', 'Ensaios'],
    messages: ['Site', 'Mensagens'],
    settings: ['Site', 'Configurações']
  }[v];

  $('view-eyebrow').textContent = l[0];
  $('view-title').textContent = l[1];

  if (v === 'dashboard') {
    if (adminUiConfig) {
      $('view-eyebrow').textContent =
        adminUiConfig.dashboard_eyebrow ||
        l[0];

      $('view-title').textContent =
        adminUiConfig.dashboard_title ||
        l[1];
    }

    loadDashboard();
  }
  if (v === 'content') loadContent();
  if (v === 'design') initDesignStudio();
  if (v === 'galleries') loadGalleries();
  if (v === 'categories') loadCategories();
  if (v === 'sessions') loadSessions();
  if (v === 'messages') loadMessages();
  if (v === 'settings') loadSettings();
}


/* =========================================================
   REALTIME + NOTIFICAÇÕES INTERNAS
   Funciona apenas enquanto o Admin V2 estiver aberto.
========================================================= */

function ensureAdminToastContainer() {
  let container = document.getElementById('admin-live-toasts');

  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-live-toasts';
    container.className = 'admin-live-toasts';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  return container;
}

function liveToast({
  eyebrow = 'Atualização',
  title = '',
  text = '',
  actionLabel = '',
  onAction = null,
  timeout = 9000
} = {}) {
  const container = ensureAdminToastContainer();
  const toast = document.createElement('article');

  toast.className = 'admin-live-toast';
  toast.innerHTML = `
    <button class="admin-live-toast-close" type="button" aria-label="Fechar">×</button>
    <p class="section-eyebrow">${esc(eyebrow)}</p>
    <div class="admin-live-toast-title">${esc(title)}</div>
    ${text ? `<p class="admin-live-toast-text">${esc(text)}</p>` : ''}
    ${actionLabel ? `<button class="small-btn admin-live-toast-action" type="button">${esc(actionLabel)}</button>` : ''}
  `;

  const remove = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.admin-live-toast-close')
    ?.addEventListener('click', remove);

  const action = toast.querySelector('.admin-live-toast-action');
  if (action && typeof onAction === 'function') {
    action.addEventListener('click', () => {
      onAction();
      remove();
    });
  }

  container.appendChild(toast);

  if (timeout > 0) {
    setTimeout(() => {
      if (toast.isConnected) remove();
    }, timeout);
  }
}

function ensureSidebarBadge(view) {
  const button = document.querySelector(`.sidebar-link[data-view="${view}"]`);
  if (!button) return null;

  let badge = button.querySelector('.sidebar-live-badge');

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'sidebar-live-badge';
    badge.hidden = true;
    button.appendChild(badge);
  }

  return badge;
}

function ensureMessagesBadge() {
  return ensureSidebarBadge('messages');
}

function ensureSessionsBadge() {
  return ensureSidebarBadge('sessions');
}

function updateSidebarBadge(badge, total, title = '') {
  if (!badge) return;

  const value = Number(total || 0);
  badge.textContent = value > 99 ? '99+' : String(value);
  badge.hidden = value < 1;

  if (title) badge.title = title;
}

async function refreshUnreadMessagesCount() {
  const { count, error } = await countUnreadMessages();

  if (error) {
    dwarn(
      '[admin-v2] Não foi possível atualizar contador de mensagens:',
      error.message
    );
    return;
  }

  const total = Number(count || 0);
  const badge = ensureMessagesBadge();

  updateSidebarBadge(
    badge,
    total,
    `${total} mensagem(ns) não lida(s)`
  );

  const dashboardCount = $('stat-messages');
  if (dashboardCount) {
    dashboardCount.textContent = total;
    dashboardCount.style.color = total ? 'var(--accent)' : '';
  }
}

async function refreshCompletedSelectionsCount() {
  const statuses = [
    'selecao_finalizada',
    'selecionado',
    'em_edicao',
    'fotos_disponiveis',
    'entregue'
  ];

  const { count, error } = await countSessionsByStatuses(statuses);

  if (error) {
    dwarn(
      '[admin-v2] Não foi possível atualizar contador de seleções:',
      error.message
    );
    return;
  }

  const total = Number(count || 0);

  updateSidebarBadge(
    ensureSessionsBadge(),
    total,
    `${total} seleção(ões) finalizada(s)`
  );
}

function normalizarRealtimeStatus(status) {
  if (status === 'selecionado') return 'selecao_finalizada';
  if (status === 'entregue') return 'fotos_disponiveis';
  return status || 'preparando';
}

async function handleRealtimeMessage(payload) {
  const event = payload?.eventType;
  const row = payload?.new || payload?.old || {};

  dlog('[admin-v2] Realtime mensagens:', event, row?.id || '');

  await refreshUnreadMessagesCount();

  if (activeView === 'messages') {
    await loadMessages();
  }

  if (event === 'INSERT') {
    const nome = safeText(row.nome || 'Nova cliente', 120);
    const tipo = safeText(row.tipo || '', 100);

    liveToast({
      eyebrow: 'Nova mensagem',
      title: nome,
      text: tipo
        ? `${tipo} · nova mensagem recebida pelo site.`
        : 'Nova mensagem recebida pelo site.',
      actionLabel: 'Abrir mensagem',
      onAction: () => setView('messages')
    });
  }
}

async function handleRealtimeEnsaio(payload) {
  const novo = payload?.new || {};
  if (!novo?.id) return;

  await refreshCompletedSelectionsCount();

  const cacheAntes = sessionsCache.find(s => s.id === novo.id);
  const statusAntes = normalizarRealtimeStatus(cacheAntes?.status);
  const statusAgora = normalizarRealtimeStatus(novo.status);

  dlog(
    '[admin-v2] Realtime ensaio:',
    novo.id,
    statusAntes,
    '→',
    statusAgora
  );

  // Atualiza cache imediatamente para evitar notificação duplicada.
  if (cacheAntes) {
    Object.assign(cacheAntes, novo);
  }

  if (
    statusAgora === 'selecao_finalizada' &&
    statusAntes !== 'selecao_finalizada'
  ) {
    const nome = safeText(novo.cliente_nome || novo.titulo || 'Cliente', 160);

    liveToast({
      eyebrow: 'Seleção finalizada',
      title: nome,
      text: 'A cliente terminou a escolha das fotografias.',
      actionLabel: 'Abrir ensaio',
      onAction: async () => {
        setView('sessions');
        await loadSessions();
        await openSessionModal(novo.id);
      }
    });
  }

  if (activeView === 'sessions' || currentSession?.id === novo.id) {
    await loadSessions();

    if (currentSession?.id === novo.id) {
      const atualizado = sessionsCache.find(s => s.id === novo.id);
      if (atualizado) currentSession = atualizado;
      await loadSessionPhotos();
    }
  }
}

async function startAdminRealtime() {
  if (adminRealtimeChannel) return;

  ensureMessagesBadge();
  ensureSessionsBadge();

  await Promise.all([
    refreshUnreadMessagesCount(),
    refreshCompletedSelectionsCount()
  ]);

  adminRealtimeChannel = createAdminRealtimeChannel({
    onMessageChange: payload => {
      handleRealtimeMessage(payload)
        .catch(error => console.error('[admin-v2] Realtime mensagens falhou:', error));
    },
    onSessionUpdate: payload => {
      handleRealtimeEnsaio(payload)
        .catch(error => console.error('[admin-v2] Realtime ensaios falhou:', error));
    },
    onStatus: status => dlog('[admin-v2] Realtime:', status)
  });
}

async function stopAdminRealtime() {
  if (!adminRealtimeChannel) return;

  const channel = adminRealtimeChannel;
  adminRealtimeChannel = null;

  try {
    await removeAdminRealtimeChannel(channel);
  } catch (error) {
    dwarn('[admin-v2] Falha ao encerrar Realtime:', error);
  }
}


/* =========================================================
   RESPOSTA DE MENSAGENS
========================================================= */


const REPLY_ATTACHMENT_MAX_FILES = 5;
const REPLY_ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const REPLY_ATTACHMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

const REPLY_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

function defaultContactReply(message) {
  const primeiroNome =
    safeText(message?.nome || 'Olá', 120)
      .trim()
      .split(/\s+/)[0] || 'Olá';

  const interesse =
    safeText(message?.tipo || 'o ensaio', 100);

  return `Olá, ${primeiroNome}.

Obrigado pela sua mensagem e pelo interesse no meu trabalho.

Será um prazer conversar consigo sobre ${interesse} e perceber melhor aquilo que procura, para que possamos construir uma experiência pensada para si.

Estou à disposição para esclarecer todas as suas dúvidas e explicar com calma como funciona a sessão, preparação, valores e disponibilidade.

Se desejar, podemos continuar por aqui e alinhar todos os detalhes.

Até breve,
Rangel Santos
Fotografia`;
}

function humanFileSize(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function renderReplyAttachments() {
  const list = document.getElementById('message-reply-attachments-list');
  const summary = document.getElementById('message-reply-attachments-summary');

  if (!list || !summary) return;

  const totalBytes = replyAttachmentsDraft
    .reduce((sum, file) => sum + Number(file.size || 0), 0);

  summary.textContent = replyAttachmentsDraft.length
    ? `${replyAttachmentsDraft.length} anexo(s) · ${humanFileSize(totalBytes)}`
    : 'Nenhum anexo selecionado.';

  if (!replyAttachmentsDraft.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = replyAttachmentsDraft.map((file, index) => `
    <div class="reply-attachment-chip">
      <div class="reply-attachment-chip-info">
        <strong>${esc(file.name)}</strong>
        <span>${esc(humanFileSize(file.size))}</span>
      </div>
      <button
        class="reply-attachment-remove"
        type="button"
        data-remove-reply-attachment="${index}"
        aria-label="Remover ${attr(file.name)}"
      >×</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-remove-reply-attachment]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeReplyAttachment);

      if (Number.isInteger(index)) {
        replyAttachmentsDraft.splice(index, 1);
        renderReplyAttachments();
      }
    });
  });
}

function addReplyAttachments(fileList) {
  const statusEl = $('message-reply-msg');
  const incoming = Array.from(fileList || []);

  if (!incoming.length) return;

  const draft = [...replyAttachmentsDraft];

  for (const file of incoming) {
    if (draft.length >= REPLY_ATTACHMENT_MAX_FILES) {
      msg(
        statusEl,
        `É possível anexar no máximo ${REPLY_ATTACHMENT_MAX_FILES} arquivos.`,
        'erro'
      );
      break;
    }

    if (!REPLY_ATTACHMENT_TYPES.has(file.type)) {
      msg(
        statusEl,
        `Formato não permitido: ${file.name}`,
        'erro'
      );
      continue;
    }

    if (file.size > REPLY_ATTACHMENT_MAX_FILE_BYTES) {
      msg(
        statusEl,
        `${file.name} ultrapassa 5 MB.`,
        'erro'
      );
      continue;
    }

    const currentTotal = draft
      .reduce((sum, current) => sum + Number(current.size || 0), 0);

    if (currentTotal + file.size > REPLY_ATTACHMENT_MAX_TOTAL_BYTES) {
      msg(
        statusEl,
        'Os anexos juntos não podem ultrapassar 8 MB.',
        'erro'
      );
      break;
    }

    draft.push(file);
  }

  replyAttachmentsDraft = draft;
  renderReplyAttachments();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');

      resolve({
        filename: safeText(file.name, 180),
        content: comma >= 0 ? result.slice(comma + 1) : result
      });
    };

    reader.onerror = () =>
      reject(new Error(`Não foi possível ler ${file.name}.`));

    reader.readAsDataURL(file);
  });
}

async function serializeReplyAttachments() {
  const serialized = [];

  for (const file of replyAttachmentsDraft) {
    serialized.push(await fileToBase64(file));
  }

  return serialized;
}


function ensureReplyModal() {
  let modal = document.getElementById('message-reply-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'message-reply-modal';
  modal.className = 'modal message-reply-modal';
  modal.hidden = true;

  modal.innerHTML = `
    <div class="modal-backdrop" data-close-reply></div>
    <div class="modal-dialog message-reply-dialog" role="dialog" aria-modal="true" aria-labelledby="message-reply-title">
      <div class="modal-head">
        <div>
          <p class="section-eyebrow">Responder cliente</p>
          <h2 id="message-reply-title">Nova resposta</h2>
        </div>
        <button class="icon-btn" type="button" data-close-reply>×</button>
      </div>

      <div class="message-reply-recipient">
        <span>Para</span>
        <strong id="message-reply-recipient"></strong>
      </div>

      <div class="message-reply-original">
        <p class="section-eyebrow">Mensagem recebida</p>
        <p id="message-reply-original"></p>
      </div>

      <form id="message-reply-form">
        <input type="hidden" id="message-reply-id">

        <div class="field">
          <label for="message-reply-text">Sua resposta</label>
          <textarea
            id="message-reply-text"
            rows="8"
            maxlength="5000"
            placeholder="Escreva aqui a sua resposta..."
            required
          ></textarea>
        </div>

        <div class="reply-attachments-box">
          <div class="reply-attachments-head">
            <div>
              <p class="section-eyebrow">Anexos</p>
              <p class="reply-attachments-summary" id="message-reply-attachments-summary">
                Nenhum anexo selecionado.
              </p>
            </div>

            <label class="small-btn reply-attachment-picker">
              Anexar arquivos
              <input
                id="message-reply-attachments"
                type="file"
                multiple
                hidden
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              >
            </label>
          </div>

          <div
            class="reply-attachments-list"
            id="message-reply-attachments-list"
          ></div>

          <p class="field-help">
            Até 5 arquivos. Máximo de 5 MB por arquivo e 8 MB no total.
            Fotos, PDF, Word, Excel, PowerPoint, TXT e CSV.
          </p>
        </div>

        <div class="form-actions">
          <button class="btn btn-accent" type="submit">Enviar resposta</button>
          <button class="btn" type="button" data-close-reply>Cancelar</button>
          <span class="msg" id="message-reply-msg"></span>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll('[data-close-reply]').forEach(element => {
    element.addEventListener('click', closeReplyModal);
  });

  modal.querySelector('#message-reply-form')
    ?.addEventListener('submit', sendReplyMessage);

  modal.querySelector('#message-reply-attachments')
    ?.addEventListener('change', event => {
      addReplyAttachments(event.target.files);
      event.target.value = '';
    });

  return modal;
}

function openReplyMessage(id) {
  const message = messagesCache.find(row => String(row.id) === String(id));

  if (!message) {
    flash('Mensagem não encontrada. Atualize a lista e tente novamente.', 'erro');
    return;
  }

  const modal = ensureReplyModal();

  $('message-reply-id').value = String(message.id);
  $('message-reply-recipient').textContent =
    `${message.nome || 'Cliente'} · ${message.email || ''}`;

  $('message-reply-original').textContent =
    message.mensagem || '';

  $('message-reply-title').textContent =
    `Responder ${message.nome || 'cliente'}`;

  replyAttachmentsDraft = [];
  renderReplyAttachments();

  $('message-reply-text').value =
    defaultContactReply(message);

  msg($('message-reply-msg'), '');

  modal.hidden = false;

  setTimeout(() => $('message-reply-text')?.focus(), 40);
}

function closeReplyModal() {
  const modal = document.getElementById('message-reply-modal');
  if (!modal) return;

  modal.hidden = true;

  replyAttachmentsDraft = [];
  renderReplyAttachments();

  const form = document.getElementById('message-reply-form');
  form?.reset();

  msg($('message-reply-msg'), '');
}

async function sendReplyMessage(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!beginFormBusy(form)) return;

  const messageId = safeText($('message-reply-id').value, 100);
  const replyText = safeText($('message-reply-text').value, 5000);
  const statusEl = $('message-reply-msg');

  if (!messageId || !replyText) {
    msg(statusEl, 'Escreva uma resposta antes de enviar.', 'erro');
    endFormBusy(form);
    return;
  }

  msg(
    statusEl,
    replyAttachmentsDraft.length
      ? 'Preparando anexos e enviando...'
      : 'Enviando...'
  );

  try {
    const attachments = await serializeReplyAttachments();

    const data = await sendContactReply({
      messageId,
      replyText,
      attachments
    });

    if (!data?.ok) {
      throw new Error(data?.error || 'Não foi possível enviar a resposta.');
    }

    msg(statusEl, 'Resposta enviada por e-mail.', 'sucesso');

    await Promise.all([
      loadMessages(),
      refreshUnreadMessagesCount()
    ]);

    setTimeout(() => {
      closeReplyModal();
      flash('Resposta enviada para a cliente.', 'sucesso');
    }, 650);
  } catch (error) {
    console.error('[admin-v2] Falha ao responder mensagem:', error);
    msg(
      statusEl,
      `Não foi possível enviar: ${error?.message || 'erro desconhecido'}`,
      'erro'
    );
  } finally {
    endFormBusy(form);
  }
}


async function requireAdmin() {
  const {
    data: { session }
  } = await getAdminSession();

  dlog(
    '[admin-v2] requireAdmin: sessão',
    session ? session.user.email + ' (id ' + session.user.id + ')' : 'ausente'
  );

  if (!session) {
    $('login-screen').hidden = false;
    $('app').hidden = true;
    return false;
  }

  const expirou =
    session.expires_at
      ? session.expires_at * 1000 <= Date.now()
      : false;

  if (expirou) {
    await signOutAdmin().catch(() => {});

    $('login-screen').hidden = false;
    $('app').hidden = true;

    msg(
      $('login-msg'),
      'Sua sessão anterior expirou. Entre novamente.',
      'erro'
    );

    return false;
  }

  if (session.user.id !== ADMIN_ID) {
    await signOutAdmin();

    $('login-screen').hidden = false;
    $('app').hidden = true;

    msg(
      $('login-msg'),
      'Este usuário não possui permissão de administrador.',
      'erro'
    );

    return false;
  }

  $('user-email').textContent =
    session.user.email || '';

  $('login-screen').hidden = true;
  $('app').hidden = false;

  await startAdminRealtime();

  // Pequena margem antes da primeira chamada à Data API.
  // Evita rejeição transitória do claim iat logo após o login.
  await new Promise(
    resolve => setTimeout(resolve, 500)
  );

  setView('dashboard');

  return true;
}


/* =========================================================
   LOGIN
========================================================= */

$('login-form').addEventListener(
  'submit',
  async e => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!beginFormBusy(form)) return;

    msg($('login-msg'), 'Entrando...');
    const inicio = Date.now();

    try {
      dlog('[admin-v2] login: iniciando signInWithPassword', safeText($('login-email').value, 254));
      const resultado = await Promise.race([
        signInAdmin(
          safeText($('login-email').value, 254).toLowerCase(),
          $('login-password').value
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ]);

      dlog(
        '[admin-v2] login: resposta em', Date.now() - inicio, 'ms —',
        resultado.error
          ? ('ERRO: ' + (resultado.error.message || resultado.error.code))
          : (resultado.data?.session ? 'SESSÃO OK' : 'SEM SESSÃO')
      );

      if (resultado.error) {
        const msgErro = String(resultado.error.message || resultado.error.code || '');
        msg(
          $('login-msg'),
          /confirm|verified|verification|mail/i.test(msgErro)
            ? 'Seu e-mail ainda não foi confirmado.'
            : 'E-mail ou senha incorretos.',
          'erro'
        );
        return;
      }

      if (!resultado.data?.session) {
        msg($('login-msg'), 'Sessão não estabelecida. Tente novamente.', 'erro');
        return;
      }

      const entrou = await requireAdmin();
      if (!entrou && $('login-msg').textContent === 'Entrando...') {
        msg($('login-msg'), 'Sessão não estabelecida. Tente novamente.', 'erro');
      }
    } catch (err) {
      console.error('[admin-v2] login: exceção em', Date.now() - inicio, 'ms:', err);
      msg(
        $('login-msg'),
        err?.message === 'timeout'
          ? 'Demorou demais para conectar ao servidor. Verifique sua internet e tente novamente.'
          : 'Erro inesperado ao entrar. Veja o console do navegador (F12).',
        'erro'
      );
    } finally {
      endFormBusy(form);
    }
  }
);


$('logout-btn').addEventListener(
  'click',
  async () => {
    await stopAdminRealtime();
    await signOutAdmin();
    location.reload();
  }
);


/* =========================================================
   NAVEGAÇÃO
========================================================= */

document
  .querySelectorAll('[data-view]')
  .forEach(b => {
    b.addEventListener(
      'click',
      () => setView(b.dataset.view)
    );
  });

/*
  Menu mobile (gaveta deslizante).
  Abaixo de 860px o menu lateral vira uma gaveta escondida fora da
  tela por padrão — abre ao tocar no botão ☰ e fecha ao tocar fora
  dela, ao pressionar Esc, ou ao escolher qualquer item do menu
  (navegar já é o sinal de que a pessoa terminou de usar o menu).
*/
function initMobileSidebarDrawer() {
  const toggle = $('admin-mobile-menu-toggle');
  const sidebar = $('admin-sidebar');
  const backdrop = $('admin-sidebar-backdrop');
  if (!toggle || !sidebar || !backdrop) return;
  if (toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';

  const openDrawer = () => {
    sidebar.classList.add('is-open');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { if (!backdrop.classList.contains('is-visible')) backdrop.hidden = true; }, 260);
  };

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) closeDrawer();
    else openDrawer();
  });

  backdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeDrawer();
  });

  /*
    Fecha a gaveta ao escolher qualquer destino real do menu —
    exceto os botões que só abrem/fecham um submenu (esses têm
    aria-expanded e não devem fechar a gaveta inteira).
  */
  sidebar.addEventListener('click', e => {
    const target = e.target.closest(
      '.sidebar-link[data-view], .sidebar-link-anchor, #logout-btn, [data-design-jump]'
    );
    if (target && window.matchMedia('(max-width: 860px)').matches) closeDrawer();
  });
}
initMobileSidebarDrawer();

/*
  Conteúdo e Design fazem parte da navegação principal.
  Eles precisam estar ativos desde a abertura do Admin,
  e não somente depois que a view Design for carregada.
*/
initDesignSidebarNavigation();


$('dashboard-new-gallery').addEventListener(
  'click',
  () => {
    setView('galleries');
    openGalleryForm();
  }
);


$('new-gallery-btn').addEventListener(
  'click',
  openGalleryForm
);


$('close-gallery-form').addEventListener(
  'click',
  closeGalleryForm
);


$('cancel-gallery-form').addEventListener(
  'click',
  closeGalleryForm
);


$('gallery-title').addEventListener(
  'input',
  () => {
    if (!$('gallery-id').value) {
      $('gallery-slug').value =
        slugify($('gallery-title').value);
    }
  }
);


$('gallery-form').addEventListener(
  'submit',
  saveGallery
);


$('category-form').addEventListener(
  'submit',
  saveCategory
);
initTrailEditor();
$('trail-form')?.addEventListener('submit',saveTrail);
$('gallery-trail')?.addEventListener('change',event=>renderGalleryCategoryOptions(event.target.value));
$('gallery-cover')?.addEventListener('input',updateGalleryCoverFocusPreview);
['gallery-cover-focus-x','gallery-cover-focus-y'].forEach(id=>$(id)?.addEventListener('input',updateGalleryCoverFocusPreview));
$('gallery-cover-focus-preview')?.addEventListener('click',event=>{const rect=event.currentTarget.getBoundingClientRect();$('gallery-cover-focus-x').value=Math.round((event.clientX-rect.left)/rect.width*100);$('gallery-cover-focus-y').value=Math.round((event.clientY-rect.top)/rect.height*100);updateGalleryCoverFocusPreview()});


$('cancel-category').addEventListener(
  'click',
  resetCategoryForm
);


$('settings-form').addEventListener(
  'submit',
  saveSettings
);


$('admin-interface-form')?.addEventListener(
  'submit',
  saveAdminUiSettings
);

$('admin-ui-reset')?.addEventListener(
  'click',
  resetAdminUiSettings
);


initAdminContentOrderDnD();
initAdminMainMenuReorder();


$('photo-upload').addEventListener(
  'change',
  async e => {
    const f = [...e.target.files];

    if (f.length && currentGallery) {
      await uploadPhotos(
        f,
        currentGallery
      );
    }

    e.target.value = '';
  }
);


document
  .querySelectorAll('[data-close-modal]')
  .forEach(e => {
    e.addEventListener(
      'click',
      closeGalleryModal
    );
  });


/* =========================================================
   DASHBOARD
========================================================= */

function formatDateTime(value){
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '—';
  try{
    return new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short'}).format(date);
  }catch(_){
    return date.toLocaleString('pt-PT');
  }
}

async function loadDashboard() {

  if (!document.body.dataset.adminUiBooted) {
    document.body.dataset.adminUiBooted = '1';
    loadAdminUiSettings();
    /*
      Liga o motor genérico a todos os campos do painel que já
      tiverem data-cms-field no HTML — inclusive os que ainda vão
      aparecer dentro de modais abertos depois (cmsBindAllFields
      pode ser chamado de novo com segurança a qualquer momento).
    */
    cmsBindAllFields();
  }

  dlog('[admin-v2] loadDashboard: iniciando');

  const consultar = async () => {
    const snapshot = await getDashboardSnapshot();

    return {
      a: snapshot.galleries,
      b: snapshot.categories,
      c: snapshot.photos,
      m: snapshot.unreadMessages,
      activities: snapshot.activities
    };
  };


  let resultado =
    await consultar();


  let falhas = [
    resultado.a,
    resultado.b,
    resultado.c,
    resultado.m,
    resultado.activities
  ]
    .map(r => (r && r.error ? r.error : null))
    .filter(Boolean);


  /*
    PGRST303 "JWT issued at future" pode ser transitório quando
    Auth e Data API ainda não estão perfeitamente alinhados no instante
    logo após o login. Não encerramos mais a sessão imediatamente.

    Esperamos um pouco e repetimos as consultas com a MESMA sessão.
  */
  const jwtFuture =
    falhas.some(error => {
      const code =
        String(error?.code || '');

      const message =
        String(error?.message || '');

      return (
        code === 'PGRST303' &&
        /issued at future/i.test(message)
      );
    });


  if (jwtFuture) {

    dwarn(
      '[admin-v2] Data API recusou o JWT por diferença temporal. Aguardando e tentando novamente...'
    );

    await new Promise(
      resolve => setTimeout(resolve, 1600)
    );

    resultado =
      await consultar();

    falhas = [
      resultado.a,
      resultado.b,
      resultado.c,
      resultado.m,
      resultado.activities
    ]
      .map(r => (r && r.error ? r.error : null))
      .filter(Boolean);
  }


  if (falhas.length) {

    const erroDashboard =
      falhas[0];

    console.error(
      '[admin-v2] Falha ao carregar dados do dashboard:',
      {
        message:
          erroDashboard?.message || '',
        code:
          erroDashboard?.code || '',
        details:
          erroDashboard?.details || '',
        hint:
          erroDashboard?.hint || ''
      }
    );


    const detalhe =
      String(
        erroDashboard?.message ||
        erroDashboard?.code ||
        JSON.stringify(
          erroDashboard
        )
      );


    /*
      Não fazemos signOut automático por erro da Data API.
      O Auth já foi validado separadamente por requireAdmin().
      Isso evita o efeito "entra no painel e sai sozinho".
    */
    flash(
      `Não foi possível carregar parte do painel: ${detalhe}. Tente atualizar a página.`,
      'erro'
    );

  }


  const g =
    resultado.a?.data || [];

  const k =
    resultado.b?.data || [];

  const p =
    resultado.c?.data || [];

  const mensagens =
    resultado.m?.data || [];


  $('stat-galleries').textContent =
    g.length;

  $('stat-published').textContent =
    g.filter(
      x => x.published
    ).length;

  $('stat-categories').textContent =
    k.length;

  $('stat-photos').textContent =
    p.filter(
      x => x.published
    ).length;


  const msgEl =
    $('stat-messages');

  msgEl.textContent =
    mensagens.length;

  msgEl.style.color =
    mensagens.length
      ? 'var(--accent)'
      : '';

  const activityHost=$('dashboard-activity-list');
  if(activityHost){
    const activities=resultado.activities?.data||[];
    activityHost.innerHTML=activities.length?activities.map(item=>`<div class="dashboard-activity-item is-${esc(item.severity||'info')}"><span class="dashboard-activity-dot"></span><div><strong>${esc(item.title||'Atividade')}</strong>${item.detail?`<small>${esc(item.detail)}</small>`:''}</div><time>${formatDateTime(item.created_at)}</time></div>`).join(''):'<p class="panel-copy">Nenhuma atividade registrada ainda.</p>';
  }
}


/* =========================================================
   CATEGORIAS
========================================================= */

async function loadCategories() {

  await ensureDesignPersistenceLoaded().catch(() => {});

  const {
    data,
    error
  } = await listCategories();

  if (error) {
    flash(
      `Erro ao carregar categorias: ${error.message}`,
      'erro'
    );

    return;
  }

  categoriesCache = data || [];

  const trailsResult=await listTrails();
  trailsCache=(trailsResult.data||[]).map(trail=>trailDraftEdits[trail.id]?{...trail,...trailDraftEdits[trail.id]}:trail).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));
  if(!galleriesCache.length){const galleriesResult=await listGalleries();galleriesCache=galleriesResult.data||[]}

  renderCategorySelect();
  renderCategories();
  renderTrails();
  enhanceTrailRows();
}


function renderCategorySelect() {
  const currentTrail = $('gallery-trail')?.value || '';
  const currentCategory = $('gallery-category')?.value || '';
  renderCategorySelectUI({ $, categories: categoriesCache, esc });
  const options='<option value="">Sem trilha</option>'+trailsCache.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  if($('category-trail'))$('category-trail').innerHTML=options;
  if($('gallery-trail'))$('gallery-trail').innerHTML='<option value="">Todas / sem trilha</option>'+trailsCache.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  if($('gallery-trail')&&trailsCache.some(trail=>trail.id===currentTrail))$('gallery-trail').value=currentTrail;
  renderGalleryCategoryOptions($('gallery-trail')?.value||'', currentCategory);
}

function renderGalleryCategoryOptions(trailId='',selected=''){
  const select=$('gallery-category');if(!select)return;
  const available=categoriesCache.filter(category=>!trailId||category.trail_id===trailId);
  select.innerHTML='<option value="">Sem categoria</option>'+available.map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join('');
  select.value=available.some(category=>category.id===selected)?selected:'';
}

function initTrailEditor(){
  const form=$('trail-form');
  if(!form||form.dataset.editorReady==='1')return;
  form.dataset.editorReady='1';
  const id=document.createElement('input');id.type='hidden';id.id='trail-id';form.prepend(id);
  const slug=document.createElement('input');slug.id='trail-slug';slug.maxLength=120;slug.placeholder='slug automático';slug.readOnly=true;
  $('trail-name')?.insertAdjacentElement('afterend',slug);
  const cancel=document.createElement('button');cancel.type='button';cancel.id='cancel-trail';cancel.className='btn';cancel.textContent='Cancelar';cancel.hidden=true;form.appendChild(cancel);
  $('trail-name')?.addEventListener('input',()=>{slug.value=slugify($('trail-name').value).slice(0,120)});
  cancel.addEventListener('click',resetTrailForm);
}

function resetTrailForm(){
  $('trail-form')?.reset();
  if($('trail-id'))$('trail-id').value='';
  if($('trail-slug'))$('trail-slug').value='';
  if($('cancel-trail'))$('cancel-trail').hidden=true;
  const submit=$('trail-form')?.querySelector('button[type="submit"]');if(submit)submit.textContent='+ Adicionar trilha';
}

function editTrail(id){
  const trail=trailsCache.find(item=>item.id===id);if(!trail)return;
  $('trail-id').value=trail.id;$('trail-name').value=trail.name||'';$('trail-slug').value=trail.slug||slugify(trail.name||'');$('trail-description').value=trail.description||'';
  $('cancel-trail').hidden=false;
  const submit=$('trail-form')?.querySelector('button[type="submit"]');if(submit)submit.textContent='Salvar alterações';
  $('trail-name').focus();$('trail-form').scrollIntoView({behavior:'smooth',block:'center'});
}

function enhanceTrailRows(){
  $('trails-list')?.querySelectorAll('[data-trail-row]').forEach(row=>{
    const actions=row.querySelector('.trail-admin-actions');if(!actions||actions.querySelector('[data-edit-trail]'))return;
    const button=document.createElement('button');button.type='button';button.className='small-btn';button.dataset.editTrail=row.dataset.trailRow;button.textContent='Editar';
    actions.prepend(button);button.addEventListener('click',()=>editTrail(row.dataset.trailRow));
  });
}

function applyTrailDraftPreview(doc){
  if(!doc)return;
  const host=doc.querySelector('.gallery-trails');
  if(host){
    const desired=trailsCache.map(trail=>String(trail.id));
    const current=Array.from(host.querySelectorAll(':scope > [data-gallery-trail-id]')).map(card=>String(card.dataset.galleryTrailId||''));
    const needsReorder=desired.some((id,index)=>current[index]!==id);
    if(needsReorder){
      desired.forEach(id=>{
        const card=host.querySelector(`[data-gallery-trail-id="${id}"]`);
        if(card)host.appendChild(card);
      });
    }
  }
  Object.entries(trailDraftEdits).forEach(([id,draft])=>{
    const card=doc.querySelector(`[data-gallery-trail-id="${id}"]`);const title=card?.querySelector('strong');const description=card?.querySelector('small');
    if(title)title.textContent=draft.name||'';if(description&&draft.description!==undefined)description.textContent=draft.description||'Ver ensaios →';
  });
}

async function moveTrailDraft(id,direction){
  const from=trailsCache.findIndex(trail=>trail.id===id),to=from+direction;
  if(from<0||to<0||to>=trailsCache.length)return;
  const [trail]=trailsCache.splice(from,1);trailsCache.splice(to,0,trail);
  trailsCache.forEach((item,index)=>{
    item.sort_order=index*10;
    trailDraftEdits[item.id]={...trailDraftEdits[item.id],name:item.name,slug:item.slug,description:item.description??null,sort_order:item.sort_order};
  });
  renderCategorySelect();renderTrails();enhanceTrailRows();renderGalleries();
  try{applyTrailDraftPreview($('design-preview-frame')?.contentDocument)}catch(_){}
  await saveDesignDraft();updateDesignPublicationState();
  msg($('trail-msg'),'Nova ordem salva no rascunho. Publique as alterações para atualizar o site.','sucesso');
}

function renderTrails(){
  const host=$('trails-list');if(!host)return;
  host.classList.add('trail-admin-grid');
  host.innerHTML=trailsCache.length?trailsCache.map((t,index)=>{const cover=t.cover_url||galleriesCache.find(g=>g.trail_id===t.id)?.cover_url||'';const x=Number(t.cover_focus_x??50),y=Number(t.cover_focus_y??50);return `<div class="trail-admin-row" data-trail-row="${t.id}"><div class="trail-admin-identity"><strong>${esc(t.name)}</strong><span>/${esc(t.slug)}</span></div><div class="trail-admin-count">${categoriesCache.filter(c=>c.trail_id===t.id).length} categorias</div><div class="trail-order-actions" aria-label="Reordenar ${attr(t.name)}"><button class="small-btn" type="button" data-move-trail="-1" ${index===0?'disabled':''} aria-label="Mover para a esquerda">←</button><span>${index+1}</span><button class="small-btn" type="button" data-move-trail="1" ${index===trailsCache.length-1?'disabled':''} aria-label="Mover para a direita">→</button></div><div class="trail-focus-editor"><div class="cover-focus-preview" data-trail-focus-preview style="background-image:${cover?`url('${attr(cover)}')`:'none'};background-position:${x}% ${y}%"><span class="cover-focus-marker" style="left:${x}%;top:${y}%"></span></div><label>Horizontal <input data-trail-focus-x type="range" min="0" max="100" value="${x}"></label><label>Vertical <input data-trail-focus-y type="range" min="0" max="100" value="${y}"></label></div><div class="trail-admin-actions"><button class="small-btn" data-save-trail-focus="${t.id}">Salvar enquadramento</button><button class="small-btn" data-delete-trail="${t.id}">Excluir</button></div></div>`}).join(''):'<p class="panel-copy">Nenhuma trilha criada.</p>';
  host.querySelectorAll('[data-trail-row]').forEach(row=>{const preview=row.querySelector('[data-trail-focus-preview]'),x=row.querySelector('[data-trail-focus-x]'),y=row.querySelector('[data-trail-focus-y]');const draw=()=>{preview.style.backgroundPosition=`${x.value}% ${y.value}%`;const marker=preview.querySelector('.cover-focus-marker');marker.style.left=x.value+'%';marker.style.top=y.value+'%'};x.addEventListener('input',draw);y.addEventListener('input',draw);preview.addEventListener('click',event=>{const rect=preview.getBoundingClientRect();x.value=Math.round((event.clientX-rect.left)/rect.width*100);y.value=Math.round((event.clientY-rect.top)/rect.height*100);draw()});row.querySelectorAll('[data-move-trail]').forEach(button=>button.addEventListener('click',()=>moveTrailDraft(row.dataset.trailRow,Number(button.dataset.moveTrail))));row.querySelector('[data-save-trail-focus]').addEventListener('click',async()=>{const result=await updateTrail(row.dataset.trailRow,{cover_focus_x:Number(x.value),cover_focus_y:Number(y.value)});if(result.error)return flash(result.error.message,'erro');const trail=trailsCache.find(item=>item.id===row.dataset.trailRow);if(trail){trail.cover_focus_x=Number(x.value);trail.cover_focus_y=Number(y.value)}flash('Enquadramento da trilha salvo.','sucesso')})});
  host.querySelectorAll('[data-delete-trail]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Excluir esta trilha? As categorias ficarão sem trilha.'))return;const r=await removeTrail(b.dataset.deleteTrail);if(r.error)return flash(r.error.message,'erro');await loadCategories()}));
}

async function saveTrail(event){
  event.preventDefault();
  const id=$('trail-id')?.value||'';
  const name=safeText($('trail-name').value,100);if(!name)return;
  const slug=slugify(name).slice(0,120);
  const description=safeText($('trail-description').value,240)||null;
  if(id){
    await ensureDesignPersistenceLoaded();
    trailDraftEdits[id]={...trailDraftEdits[id],name,slug,description};
    const trail=trailsCache.find(item=>item.id===id);if(trail)Object.assign(trail,trailDraftEdits[id]);
    renderCategorySelect();renderTrails();enhanceTrailRows();renderGalleries();resetTrailForm();
    const frame=$('design-preview-frame');try{applyTrailDraftPreview(frame?.contentDocument)}catch(_){}
    await saveDesignDraft();
    msg($('trail-msg'),'Alteração salva no rascunho. Revise na prévia e publique quando estiver pronto.','sucesso');
    updateDesignPublicationState();return;
  }
  const r=await createTrail({name,slug,description,published:true,sort_order:trailsCache.length*10});
  if(r.error)return msg($('trail-msg'),r.error.message,'erro');
  await logAdminActivity('trail_created',`Trilha “${name}” criada`,{entityType:'gallery_trail',entityId:r.data?.id}).catch(()=>{});
  resetTrailForm();msg($('trail-msg'),'Trilha criada.','sucesso');await loadCategories();await loadDashboard();
}

function renderCategories() {
  renderCategoriesUI({
    $,
    categories: categoriesCache,
    esc,
    onEdit: editCategory,
    onDelete: deleteCategory,
    withOperationLock
  });
}

async function saveCategory(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!beginFormBusy(form)) return;

  try {
    const id = $('category-id').value;
    const name = safeText($('category-name').value, 80);
    const slug = slugify(safeText($('category-slug').value, 120)).slice(0, 120);

    if (!name || !slug) {
      msg($('category-msg'), 'Preencha nome e slug com conteúdo válido.', 'erro');
      return;
    }

    const p = {
      name,
      slug,
      sort_order: clampNumber($('category-order').value, 0, 9999, 0),
      published: true
      ,trail_id: $('category-trail')?.value || null
    };

    const r = id
      ? await updateCategory(id, p)
      : await createCategory(p);

    if (r.error) {
      msg($('category-msg'), r.error.message, 'erro');
      return;
    }

    await logAdminActivity(id ? 'category_updated' : 'category_created', `Categoria “${name}” ${id ? 'atualizada' : 'criada'}`, { entityType: 'category', entityId: id || r.data?.id }).catch(() => {});

    msg($('category-msg'), 'Categoria salva.', 'sucesso');
    resetCategoryForm();
    await loadCategories();
    await loadDashboard();
  } finally {
    endFormBusy(form);
  }
}


function editCategory(id) {

  const c =
    categoriesCache.find(
      x => x.id === id
    );

  if (!c) return;

  $('category-id').value = c.id;
  $('category-name').value = c.name;
  $('category-slug').value = c.slug;
  $('category-order').value =
    c.sort_order;
  if($('category-trail'))$('category-trail').value=c.trail_id||'';

  $('cancel-category').hidden = false;

  $('category-name').focus();
}


async function deleteCategory(id) {

  const c =
    categoriesCache.find(
      x => x.id === id
    );

  if (
    !c ||
    !confirm(
      `Excluir a categoria "${c.name}"? Galerias vinculadas ficarão sem categoria.`
    )
  ) {
    return;
  }

  const {
    error
  } = await removeCategory(id);

  if (error) {

    flash(
      `Não foi possível excluir: ${error.message}`,
      'erro'
    );

    return;
  }

  flash(
    'Categoria excluída.',
    'sucesso'
  );

  await loadCategories();
  await loadGalleries();
  await loadDashboard();
}


function resetCategoryForm() {

  $('category-form').reset();

  $('category-id').value = '';

  $('category-order').value = 0;

  $('cancel-category').hidden = true;
}


/* =========================================================
   GALERIAS
========================================================= */

async function loadGalleries() {
  await ensureDesignPersistenceLoaded().catch(() => {});

  const {
    data: galleries,
    error: galleriesError
  } = await listGalleries();

  if (galleriesError) {

    flash(
      `Erro ao carregar galerias: ${galleriesError.message}`,
      'erro'
    );

    return;
  }

  galleriesCache =
    galleries || [];


  const {
    data: categories,
    error: categoriesError
  } = await listPublishedCategories();

  if (categoriesError) {

    flash(
      `Erro ao carregar categorias: ${categoriesError.message}`,
      'erro'
    );

    return;
  }

  categoriesCache =
    categories || [];

  const trailsResult=await listTrails();trailsCache=(trailsResult.data||[]).map(trail=>trailDraftEdits[trail.id]?{...trail,...trailDraftEdits[trail.id]}:trail).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0));

  renderGalleries();
  renderCategorySelect();
}


function renderGalleries() {
  renderGalleriesUI({
    $,
    galleries: galleriesCache,
    esc,
    attr,
    openGalleryModal,
    editGallery,
    toggleGallery,
    deleteGallery,
    withOperationLock,
    onReorder: salvarOrdemGalerias
  });
}

/* =========================================================
   SALVAR ORDEM DAS GALERIAS
   ESTA É A ÚNICA DECLARAÇÃO
========================================================= */

async function salvarOrdemGalerias() {

  const cards = [
    ...$('galleries-list')
      .querySelectorAll(
        '.gallery-admin-card'
      )
  ];

  if (!cards.length) return;

  const atualizacoes =
    cards.map(
      (card, index) => {

        const id =
          card.dataset.galleryId;

        return updateGallerySortOrder(id, index + 1);

      }
    );


  const resultados =
    await Promise.all(
      atualizacoes
    );


  const erro =
    resultados.find(
      resultado => resultado.error
    );


  if (erro) {

    flash(
      `Erro ao salvar a ordem: ${erro.error.message}`,
      'erro'
    );

    return;
  }


  cards.forEach(
    (card, index) => {

      const gallery =
        galleriesCache.find(
          g =>
            g.id ===
            card.dataset.galleryId
        );

      if (gallery) {
        gallery.sort_order =
          index + 1;
      }

    }
  );


  galleriesCache.sort(
    (a, b) =>
      (a.sort_order ?? 0) -
      (b.sort_order ?? 0)
  );


  flash(
    'Ordem das galerias atualizada.',
    'sucesso'
  );

}


/* =========================================================
   FORMULÁRIO DE GALERIA
========================================================= */

function updateGalleryCoverFocusPreview(){
  const preview=$('gallery-cover-focus-preview');if(!preview)return;
  const url=safeText($('gallery-cover')?.value,2048),x=clampNumber($('gallery-cover-focus-x')?.value,0,100,50),y=clampNumber($('gallery-cover-focus-y')?.value,0,100,50);
  preview.style.backgroundImage=url?`url("${url.replace(/"/g,'%22')}")`:'';preview.style.backgroundPosition=`${x}% ${y}%`;preview.classList.toggle('empty',!url);
  const marker=preview.querySelector('.cover-focus-marker');if(marker){marker.style.left=x+'%';marker.style.top=y+'%'}
  if($('gallery-cover-focus-x-out'))$('gallery-cover-focus-x-out').textContent=x+'%';if($('gallery-cover-focus-y-out'))$('gallery-cover-focus-y-out').textContent=y+'%';
}

function openGalleryForm(g = null) {

  $('gallery-form-wrap').hidden =
    false;

  $('gallery-form-title').textContent =
    g
      ? 'Editar galeria'
      : 'Nova galeria';

  $('gallery-id').value =
    g?.id || '';

  $('gallery-title').value =
    g?.title || '';

  $('gallery-slug').value =
    g?.slug || '';

  const selectedCategory=categoriesCache.find(c=>c.id===g?.category_id);
  if($('gallery-trail'))$('gallery-trail').value=g?.trail_id||selectedCategory?.trail_id||'';
  renderGalleryCategoryOptions($('gallery-trail')?.value||'',g?.category_id||'');

  $('gallery-description').value =
    g?.description || '';

  $('gallery-cover').value =
    g?.cover_url || '';

  $('gallery-cover-focus-x').value=Number(g?.cover_focus_x??50);
  $('gallery-cover-focus-y').value=Number(g?.cover_focus_y??50);
  updateGalleryCoverFocusPreview();

  $('gallery-order').value =
    g?.sort_order ?? 0;

  $('gallery-title').focus();
}


function closeGalleryForm() {

  $('gallery-form-wrap').hidden =
    true;

  $('gallery-form').reset();

  $('gallery-id').value =
    '';

  $('gallery-order').value =
    0;

  msg(
    $('gallery-form-msg'),
    ''
  );
}


async function saveGallery(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!beginFormBusy(form)) return;

  try {
    const id = $('gallery-id').value;
    const title = safeText($('gallery-title').value, 120);
    const slug = slugify(safeText($('gallery-slug').value, 120)).slice(0, 120);
    const coverInput = safeText($('gallery-cover').value, 2048);
    const coverUrl = coverInput ? safeHttpUrl(coverInput, { allowRelative: false }) : '';

    if (!title || !slug) {
      msg($('gallery-form-msg'), 'Preencha título e slug com conteúdo válido.', 'erro');
      return;
    }
    if (coverInput && !coverUrl) {
      msg($('gallery-form-msg'), 'A URL da capa precisa começar com http:// ou https://.', 'erro');
      return;
    }

    const p = {
      title,
      slug,
      description: safeText($('gallery-description').value, 2000) || null,
      category_id: $('gallery-category').value || null,
      trail_id: $('gallery-trail')?.value || null,
      cover_focus_x: clampNumber($('gallery-cover-focus-x')?.value,0,100,50),
      cover_focus_y: clampNumber($('gallery-cover-focus-y')?.value,0,100,50),
      cover_url: coverUrl || null,
      sort_order: clampNumber($('gallery-order').value, 0, 9999, 0)
    };


    const r = id
      ? await updateGallery(id, p)
      : await createGallery(p);

    if (r.error) {
      msg($('gallery-form-msg'), r.error.message, 'erro');
      return;
    }

    await logAdminActivity(id ? 'gallery_updated' : 'gallery_created', `Galeria “${title}” ${id ? 'atualizada' : 'criada'}`, { entityType: 'gallery', entityId: id || r.data?.id }).catch(() => {});

    msg($('gallery-form-msg'), 'Galeria salva.', 'sucesso');
    await loadGalleries();
    await loadDashboard();

    if (!id && r.data) {
      setTimeout(() => openGalleryModal(r.data.id), 250);
    }
  } finally {
    endFormBusy(form);
  }
}


async function editGallery(id) {
  const fresh = await getGalleryWithCategory(id);
  if (fresh.error) {
    flash(`Não foi possível abrir a galeria: ${fresh.error.message}`, 'erro');
    return;
  }
  const g = fresh.data || galleriesCache.find(x => x.id === id);
  if (!g) return;
  const index = galleriesCache.findIndex(item => item.id === id);
  if (index >= 0) galleriesCache[index] = g;
  openGalleryForm(g);
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


async function toggleGallery(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (!g) return;


  const novoEstado =
    !g.published;


  /*
    O estado da galeria é o comando principal:
    - OCULTAR galeria  => oculta TODAS as fotos;
    - PUBLICAR galeria => publica TODAS as fotos.

    Depois disso, cada fotografia continua podendo ser
    ocultada/publicada individualmente pelo botão da foto.
  */

  const {
    error: galleryError
  } = await setGalleryPublished(id, novoEstado);


  if (galleryError) {

    flash(
      `Erro ao alterar a galeria: ${galleryError.message}`,
      'erro'
    );

    return;
  }


  const {
    error: photosError
  } = await setGalleryPhotosPublished(id, novoEstado);


  if (photosError) {

    await setGalleryPublished(id, g.published);


    flash(
      `Não foi possível atualizar todas as fotografias: ${photosError.message}`,
      'erro'
    );

    return;
  }


  flash(
    novoEstado
      ? 'Galeria publicada. Todas as fotografias foram publicadas.'
      : 'Galeria ocultada. Todas as fotografias foram ocultadas.',
    'sucesso'
  );


  if (
    currentGallery &&
    currentGallery.id === id
  ) {
    currentGallery = {
      ...currentGallery,
      published: novoEstado
    };

    await loadPhotos();
  }


  await loadGalleries();
  await loadDashboard();
}


async function deleteGallery(id) {
  const gallery = galleriesCache.find(item => item.id === id);
  if (!gallery || !confirm(`Excluir "${gallery.title}" e todas as suas fotografias? Esta ação não pode ser desfeita.`)) return;

  const result = await deleteGalleryWithAssets({ galleryId: id, bucket: BUCKET });
  if (result.error) {
    const label = result.stage === 'list-assets' ? 'Erro ao localizar fotos' :
      result.stage === 'storage' ? 'Não foi possível apagar os arquivos' : 'Erro ao excluir galeria';
    flash(`${label}: ${result.error.message}`, 'erro');
    return;
  }
  flash('Galeria excluída.', 'sucesso');
  await loadGalleries();
  await loadDashboard();
}

async function openGalleryModal(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (!g) return;

  currentGallery = g;

  $('modal-gallery-title').textContent =
    g.title;

  $('gallery-editor-modal').hidden =
    false;

  await loadPhotos();
}


function closeGalleryModal() {

  $('gallery-editor-modal').hidden =
    true;

  currentGallery = null;

  $('photo-grid').innerHTML =
    '';
}


/* =========================================================
   FOTOGRAFIAS
========================================================= */

async function loadPhotos() {

  if (!currentGallery) return;


  const {
    data: freshGallery,
    error: ge
  } = await getGallery(currentGallery.id);


  if (ge) {

    msg(
      $('upload-msg'),
      ge.message,
      'erro'
    );

    return;
  }


  currentGallery =
    freshGallery;


  const {
    data,
    error
  } = await listGalleryPhotos(currentGallery.id);


  if (error) {

    msg(
      $('upload-msg'),
      error.message,
      'erro'
    );

    return;
  }


  const photos =
    data || [];

  renderGalleryPhotosUI({
    $, photos, gallery: currentGallery, attr, withOperationLock,
    setCover, togglePhotoPublished, deletePhoto, savePhotoOrder
  });
  return;


}


/* =========================================================
   PUBLICAR / OCULTAR FOTO
========================================================= */

async function togglePhotoPublished(id) {

  const {
    data: photo,
    error: findError
  } = await getGalleryPhotoPublication(id);


  if (
    findError ||
    !photo
  ) {

    flash(
      'Fotografia não encontrada.',
      'erro'
    );

    return;
  }


  const novoEstado =
    !photo.published;


  const {
    error
  } = await setGalleryPhotoPublished(id, novoEstado);


  if (error) {

    flash(
      `Erro ao alterar publicação: ${error.message}`,
      'erro'
    );

    return;
  }


  flash(
    novoEstado
      ? 'Fotografia publicada no site.'
      : 'Fotografia ocultada do site.',
    'sucesso'
  );


  await loadPhotos();
  await loadDashboard();
}


/* =========================================================
   ORDEM DAS FOTOGRAFIAS
========================================================= */

async function savePhotoOrder() {

  const items = [
    ...$('photo-grid')
      .querySelectorAll(
        '.admin-photo'
      )
  ];


  if (!items.length) return;


  const updates =
    items.map(
      (el, index) => ({
        id:
          el.dataset.photoId,

        sort_order:
          index
      })
    );


  msg(
    $('upload-msg'),
    'Salvando nova ordem...'
  );


  for (const item of updates) {

    const {
      error
    } = await updateGalleryPhotoSortOrder(item.id, item.sort_order);


    if (error) {

      msg(
        $('upload-msg'),
        `Erro ao salvar a ordem: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  items.forEach(
    (el, index) => {

      const number =
        el.querySelector(
          '.photo-order'
        );

      if (number) {
        number.textContent =
          index + 1;
      }

    }
  );


  msg(
    $('upload-msg'),
    'Ordem das fotografias atualizada.',
    'sucesso'
  );


  await loadGalleries();
}


/* =========================================================
   UPLOAD DE FOTOGRAFIAS
========================================================= */

async function uploadPhotos(files, g) {

  const checked = validarImagens(files);
  if (checked.rejeitados.length) {
    msg($('upload-msg'), checked.rejeitados.join(' · '), 'erro');
  }
  files = checked.validos;
  if (!files.length) return;

  msg(
    $('upload-msg'),
    `Enviando ${files.length} fotografia(s)...`
  );


  const q = await getMaxGalleryPhotoOrder(g.id);


  let order =
    q.data?.[0]?.sort_order ??
    -1;


  for (const file of files) {

    const ext =
      (
        file.name
          .split('.')
          .pop() ||
        'jpg'
      ).toLowerCase();


    const safe =
      [
        'jpg',
        'jpeg',
        'png',
        'webp'
      ].includes(ext)
        ? ext
        : 'jpg';


    const path =
      `${g.id}/${Date.now()}-${crypto.randomUUID()}-${slugify(
        file.name.replace(
          /\.[^.]+$/,
          ''
        )
      )}.${safe}`;


    const result = await uploadGalleryPhoto({
      bucket: BUCKET,
      path,
      file,
      gallery: g,
      sortOrder: order + 1
    });

    if (result.error) {
      msg(
        $('upload-msg'),
        `${result.stage === 'upload' ? 'Erro no upload de' : 'Erro ao registrar'} ${file.name}: ${result.error.message}`,
        'erro'
      );
      if (result.stage === 'database') order++;
      continue;
    }
    order++;

  }


  await ensureCover(
    g.id
  );

  await refreshGalleryCache(
    g.id
  );

  await loadPhotos();
  await loadGalleries();
  await loadDashboard();


  msg(
    $('upload-msg'),
    'Upload concluído. As fotografias foram atualizadas na galeria.',
    'sucesso'
  );
}


/* =========================================================
   CAPA
========================================================= */

async function ensureCover(id) {

  const {
    data: g
  } = await getGalleryCover(id);


  if (g?.cover_url) {
    return;
  }


  const {
    data: p
  } = await getFirstGalleryPhoto(id);


  if (p?.image_url) {

    await setGalleryCover(id, p.image_url);

  }
}


async function setCover(p) {

  if (!currentGallery) {
    return;
  }


  const {
    error
  } = await setGalleryCover(currentGallery.id, p.image_url);


  if (error) {

    flash(
      `Erro ao definir capa: ${error.message}`,
      'erro'
    );

    return;
  }


  currentGallery.cover_url =
    p.image_url;


  flash(
    'Capa atualizada.',
    'sucesso'
  );


  await loadPhotos();
  await loadGalleries();
}


/* =========================================================
   EXCLUIR FOTO
========================================================= */

async function deletePhoto(id) {
  if (!confirm('Excluir esta fotografia?')) return;

  const result = await deleteGalleryPhotoWithAsset({ photoId: id, bucket: BUCKET });
  if (result.error) {
    const label = result.stage === 'find' ? 'Fotografia não encontrada' :
      result.stage === 'storage' ? 'Erro ao excluir arquivo' : 'Erro ao excluir registro';
    flash(`${label}: ${result.error.message || ''}`, 'erro');
    return;
  }

  const photo = result.data.photo;
  if (currentGallery.cover_url === photo.image_url) {
    await setGalleryCover(currentGallery.id, null);
    await ensureCover(currentGallery.id);
    await refreshGalleryCache(currentGallery.id);
  }
  flash('Fotografia excluída.', 'sucesso');
  await loadPhotos();
  await loadGalleries();
  await loadDashboard();
}

async function refreshGalleryCache(id) {

  const {
    data
  } = await getGalleryWithCategory(id);


  if (data) {

    galleriesCache =
      galleriesCache.map(
        g =>
          g.id === id
            ? data
            : g
      );

    currentGallery =
      data;
  }
}


/* =========================================================
   STORAGE
========================================================= */

function storagePath(url) {
  return storagePathForBucket(url, BUCKET);
}

/* Legacy implementation kept above as a compatible wrapper. */
/* Original body replaced by the generic helper. */
/*
function storagePath(url) {
  const marker =
    `/storage/v1/object/public/${BUCKET}/`;

/* =========================================================
   CONFIGURAÇÕES
========================================================= */


const ADMIN_UI_DEFAULTS = Object.freeze({
  brand: 'Rangel Santos',
  version: 'CMS V2',

  nav_dashboard: 'Dashboard',
  nav_design: 'Design',
  nav_galleries: 'Galerias',
  nav_categories: 'Categorias',
  nav_sessions: 'Ensaios',
  nav_messages: 'Mensagens',
  nav_settings: 'Configurações',
  nav_view_site: 'Ver site',
  nav_logout: 'Sair',

  dashboard_eyebrow: 'Painel',
  dashboard_title: 'Dashboard',

  gallery_card_title: 'Galeria',
  gallery_card_button: 'Nova galeria',
  gallery_card_copy:
    'Crie uma galeria, envie as fotografias, escolha a capa e publique quando estiver pronta.',

  safe_title: 'Ambiente seguro',
  safe_status: 'PROTEGIDO',
  safe_copy:
    'Este painel usa o seu usuário autenticado e as políticas RLS do novo CMS.',

  design_content_order: [
    'inicio',
    'sobre',
    'contato',
    'client_area'
  ],
  menu_order: [
    'dashboard',
    'design',
    'galleries',
    'categories',
    'sessions',
    'messages',
    'settings'
  ]
});

let adminUiConfig =
  { ...ADMIN_UI_DEFAULTS };

function normalizeAdminUiConfig(config = {}) {
  const c =
    { ...ADMIN_UI_DEFAULTS, ...(config || {}) };

  const field = (key, max) =>
    safeText(c[key], max) ||
    ADMIN_UI_DEFAULTS[key];

  return {
    brand: field('brand', 80),
    version: field('version', 40),

    nav_dashboard: field('nav_dashboard', 40),
    nav_design: field('nav_design', 40),
    nav_galleries: field('nav_galleries', 40),
    nav_categories: field('nav_categories', 40),
    nav_sessions: field('nav_sessions', 40),
    nav_messages: field('nav_messages', 40),
    nav_settings: field('nav_settings', 40),
    nav_view_site: field('nav_view_site', 40),
    nav_logout: field('nav_logout', 40),

    dashboard_eyebrow: field('dashboard_eyebrow', 60),
    dashboard_title: field('dashboard_title', 80),

    gallery_card_title: field('gallery_card_title', 80),
    gallery_card_button: field('gallery_card_button', 60),
    gallery_card_copy: field('gallery_card_copy', 300),

    safe_title: field('safe_title', 80),
    safe_status: field('safe_status', 40),
    safe_copy: field('safe_copy', 300),

    design_content_order: (() => {
      const allowed = [
        'inicio',
        'sobre',
        'contato',
        'client_area'
      ];

      const incoming =
        Array.isArray(c.design_content_order)
          ? c.design_content_order
          : [];

      const normalized =
        incoming.filter(
          item =>
            allowed.includes(item)
        );

      allowed.forEach(item => {
        if (!normalized.includes(item)) {
          normalized.push(item);
        }
      });

      return normalized.slice(0, allowed.length);
    })(),

    menu_order: (() => {
      const allowed = [
        'dashboard','design','galleries','categories','sessions','messages','settings'
      ];
      const incoming = Array.isArray(c.menu_order) ? c.menu_order : [];
      const normalized = incoming.filter(item => allowed.includes(item));
      allowed.forEach(item => { if (!normalized.includes(item)) normalized.push(item); });
      return normalized.slice(0, allowed.length);
    })()
  };
}

function collectAdminUiConfig() {
  return normalizeAdminUiConfig({
    brand: $('admin-ui-brand')?.value,
    version: $('admin-ui-version')?.value,

    nav_dashboard: $('admin-ui-nav-dashboard')?.value,
    nav_design: $('admin-ui-nav-design')?.value,
    nav_galleries: $('admin-ui-nav-galleries')?.value,
    nav_categories: $('admin-ui-nav-categories')?.value,
    nav_sessions: $('admin-ui-nav-sessions')?.value,
    nav_messages: $('admin-ui-nav-messages')?.value,
    nav_settings: $('admin-ui-nav-settings')?.value,
    nav_view_site: $('admin-ui-nav-view-site')?.value,
    nav_logout: $('admin-ui-nav-logout')?.value,

    dashboard_eyebrow: $('admin-ui-dashboard-eyebrow')?.value,
    dashboard_title: $('admin-ui-dashboard-title')?.value,

    gallery_card_title: $('admin-ui-gallery-card-title')?.value,
    gallery_card_button: $('admin-ui-gallery-card-button')?.value,
    gallery_card_copy: $('admin-ui-gallery-card-copy')?.value,

    safe_title: $('admin-ui-safe-title')?.value,
    safe_status: $('admin-ui-safe-status')?.value,
    menu_order: collectAdminMenuOrder(),
    safe_copy: $('admin-ui-safe-copy')?.value,

    design_content_order:
      collectAdminContentOrder()
  });
}

function fillAdminUiSettings(config) {
  const c =
    normalizeAdminUiConfig(config);

  const map = {
    'admin-ui-brand': c.brand,
    'admin-ui-version': c.version,

    'admin-ui-nav-dashboard': c.nav_dashboard,
    'admin-ui-nav-design': c.nav_design,
    'admin-ui-nav-galleries': c.nav_galleries,
    'admin-ui-nav-categories': c.nav_categories,
    'admin-ui-nav-sessions': c.nav_sessions,
    'admin-ui-nav-messages': c.nav_messages,
    'admin-ui-nav-settings': c.nav_settings,
    'admin-ui-nav-view-site': c.nav_view_site,
    'admin-ui-nav-logout': c.nav_logout,

    'admin-ui-dashboard-eyebrow': c.dashboard_eyebrow,
    'admin-ui-dashboard-title': c.dashboard_title,

    'admin-ui-gallery-card-title': c.gallery_card_title,
    'admin-ui-gallery-card-button': c.gallery_card_button,
    'admin-ui-gallery-card-copy': c.gallery_card_copy,

    'admin-ui-safe-title': c.safe_title,
    'admin-ui-safe-status': c.safe_status,
    'admin-ui-safe-copy': c.safe_copy
  };

  Object.entries(map)
    .forEach(([id, value]) => {
      if ($(id)) {
        $(id).value = value;
      }
    });

  renderAdminContentOrder(
    c.design_content_order
  );
}

function setAdminText(selector, value) {
  const el =
    document.querySelector(selector);

  if (el) {
    el.textContent = value;
  }
}

function applyAdminUiConfig(config = adminUiConfig) {
  const c =
    normalizeAdminUiConfig(config);

  adminUiConfig = c;

  const brand =
    $('admin-ui-brand-render');

  if (brand) {
    const parts =
      c.brand.trim().split(/\s+/);

    if (parts.length > 1) {
      const last =
        parts.pop();

      brand.innerHTML =
        `${esc(parts.join(' '))} <em>${esc(last)}</em>`;
    } else {
      brand.textContent =
        c.brand;
    }
  }

  setAdminText(
    '#admin-ui-version-render',
    c.version
  );

  document
    .querySelectorAll(
      '[data-admin-ui-text]'
    )
    .forEach(el => {
      const key =
        el.dataset.adminUiText;

      if (c[key]) {
        el.textContent =
          c[key];
      }
    });

  setAdminText(
    '#admin-ui-gallery-card-title-render',
    c.gallery_card_title
  );

  setAdminText(
    '#admin-ui-gallery-card-button-render',
    c.gallery_card_button
  );

  setAdminText(
    '#admin-ui-gallery-card-copy-render',
    c.gallery_card_copy
  );

  setAdminText(
    '#admin-ui-safe-title-render',
    c.safe_title
  );

  setAdminText(
    '#admin-ui-safe-status-render',
    c.safe_status
  );

  setAdminText(
    '#admin-ui-safe-copy-render',
    c.safe_copy
  );

  /*
    O cabeçalho superior muda de acordo com a tela.
    No Dashboard respeitamos os textos personalizados.
  */
  applyDesignContentOrder(
    c.design_content_order
  );

  renderAdminMenuOrder(
    c.menu_order
  );

  if (activeView === 'dashboard') {
    if ($('view-eyebrow')) {
      $('view-eyebrow').textContent =
        c.dashboard_eyebrow;
    }

    if ($('view-title')) {
      $('view-title').textContent =
        c.dashboard_title;
    }
  }
}


function collectAdminMenuOrder() {
  const menu = $('admin-main-menu');
  if (!menu) return [...ADMIN_UI_DEFAULTS.menu_order];
  return [...menu.querySelectorAll(':scope > [data-admin-menu-key]')]
    .map(node => node.dataset.adminMenuKey)
    .filter(Boolean);
}

function renderAdminMenuOrder(order = []) {
  const menu = $('admin-main-menu');
  if (!menu) return;
  const nodes = new Map(
    [...menu.querySelectorAll(':scope > [data-admin-menu-key]')]
      .map(node => [node.dataset.adminMenuKey,node])
  );
  order.forEach(key => { const node=nodes.get(key); if(node) menu.appendChild(node); });
}

async function persistAdminMenuOrder() {
  const order = collectAdminMenuOrder();
  adminUiConfig = normalizeAdminUiConfig({...adminUiConfig,menu_order:order});
  try {
    const result = await upsertSiteContentSection('admin','interface',adminUiConfig);
    if (result.error) throw result.error;
    flash('Nova ordem do menu guardada.','sucesso');
  } catch (error) {
    dwarn('[admin-v2] Não foi possível guardar a ordem do menu:',error);
    flash('Não foi possível guardar a ordem do menu.','erro');
  }
}

function initAdminMainMenuReorder() {
  const menu=$('admin-main-menu'),button=$('admin-menu-reorder');
  if(!menu||!button||menu.dataset.reorderBound==='1')return;
  menu.dataset.reorderBound='1';
  let active=false,dragged=null;
  const items=()=>[...menu.querySelectorAll(':scope > [data-admin-menu-key]')];
  const setMode=value=>{
    active=value;menu.classList.toggle('is-reordering',active);
    button.setAttribute('aria-pressed',String(active));
    button.textContent=active?'Concluir reordenação':'Reordenar menu';
    items().forEach(item=>{item.draggable=active;});
  };
  menu.addEventListener('dragstart',event=>{
    if(!active)return event.preventDefault();
    const item=event.target.closest('[data-admin-menu-key]');
    if(!item||item.parentElement!==menu)return;
    dragged=item;item.classList.add('is-menu-dragging');event.dataTransfer.effectAllowed='move';
  });
  menu.addEventListener('dragover',event=>{
    if(!active||!dragged)return;
    const target=event.target.closest('[data-admin-menu-key]');
    if(!target||target.parentElement!==menu||target===dragged)return;
    event.preventDefault();const rect=target.getBoundingClientRect();
    menu.insertBefore(dragged,event.clientY<rect.top+rect.height/2?target:target.nextSibling);
  });
  menu.addEventListener('dragend',()=>{dragged?.classList.remove('is-menu-dragging');dragged=null;});
  button.addEventListener('click',async()=>{
    if(active){setMode(false);await persistAdminMenuOrder();}else setMode(true);
  });
  setMode(false);
}


function collectAdminContentOrder() {
  const list =
    $('admin-content-order-list');

  if (!list) {
    return [
      'inicio',
      'sobre',
      'contato',
      'client_area'
    ];
  }

  return [
    ...list.querySelectorAll(
      '[data-admin-content-order]'
    )
  ]
    .map(
      item =>
        item.dataset.adminContentOrder
    )
    .filter(Boolean);
}

function renderAdminContentOrder(order = []) {
  const list =
    $('admin-content-order-list');

  if (!list) return;

  const map =
    new Map(
      [
        ...list.querySelectorAll(
          '[data-admin-content-order]'
        )
      ].map(
        node => [
          node.dataset.adminContentOrder,
          node
        ]
      )
    );

  order.forEach(key => {
    const node =
      map.get(key);

    if (node) {
      list.appendChild(node);
    }
  });
}

function applyDesignContentOrder(order = []) {
  const submenu =
    $('design-content-submenu');

  if (!submenu) return;

  const map =
    new Map(
      [
        ...submenu.querySelectorAll(
          '[data-design-content-order]'
        )
      ].map(
        node => [
          node.dataset.designContentOrder,
          node
        ]
      )
    );

  order.forEach(key => {
    const node =
      map.get(key);

    if (node) {
      submenu.appendChild(node);
    }
  });
}

function bindSimpleReorderList({
  container,
  itemSelector,
  handleSelector,
  onChange
}) {
  if (!container) return;

  let dragged = null;

  const arm = item => {
    item.dataset.dragArmed = '1';
    item.draggable = true;
  };

  const disarm = item => {
    item.dataset.dragArmed = '0';
    item.draggable = false;
  };

  container
    .querySelectorAll(itemSelector)
    .forEach(item => {
      const handle =
        item.querySelector(handleSelector);

      if (handle) {
        handle.addEventListener(
          'pointerdown',
          event => {
            if (
              event.pointerType === 'mouse' &&
              event.button !== 0
            ) {
              return;
            }

            arm(item);
          }
        );

        handle.addEventListener(
          'mousedown',
          () => arm(item)
        );
      }

      item.addEventListener(
        'dragstart',
        event => {
          if (
            item.dataset.dragArmed !== '1'
          ) {
            event.preventDefault();
            return;
          }

          dragged = item;
          item.classList.add('is-dragging');

          event.dataTransfer.effectAllowed =
            'move';
        }
      );

      item.addEventListener(
        'dragover',
        event => {
          if (!dragged) return;

          event.preventDefault();

          const target =
            event.currentTarget;

          if (
            target === dragged
          ) {
            return;
          }

          const rect =
            target.getBoundingClientRect();

          const before =
            event.clientY <
            rect.top +
            rect.height / 2;

          container.insertBefore(
            dragged,
            before
              ? target
              : target.nextSibling
          );
        }
      );

      item.addEventListener(
        'dragend',
        () => {
          if (!dragged) return;

          dragged.classList.remove(
            'is-dragging'
          );

          disarm(dragged);

          dragged = null;

          onChange?.();
        }
      );
    });
}

function initAdminContentOrderDnD() {
  bindSimpleReorderList({
    container:
      $('admin-content-order-list'),
    itemSelector:
      '[data-admin-content-order]',
    handleSelector:
      '.admin-content-order-handle',
    onChange: () => {
      msg(
        $('admin-interface-msg'),
        'Ordem alterada. Clique em “Salvar interface do painel” para guardar.',
        ''
      );
    }
  });
}

function initDesignContentOrderDnD() {
  bindSimpleReorderList({
    container:
      $('design-content-submenu'),
    itemSelector:
      '[data-design-content-order]',
    handleSelector:
      '.design-content-drag-handle',
    onChange: async () => {
      const order =
        [
          ...$('design-content-submenu')
            .querySelectorAll(
              '[data-design-content-order]'
            )
        ]
          .map(
            node =>
              node.dataset.designContentOrder
          );

      adminUiConfig = {
        ...adminUiConfig,
        design_content_order: order
      };

      renderAdminContentOrder(
        order
      );

      try {
        const result = await upsertSiteContentSection(
          'admin',
          'interface',
          normalizeAdminUiConfig(adminUiConfig)
        );

        if (result.error) {
          throw result.error;
        }
      } catch (error) {
        dwarn(
          '[admin-v2] Não foi possível salvar a ordem do Conteúdo:',
          error
        );
      }
    }
  });
}

async function loadAdminUiSettings() {
  try {
    const { data, error } =
      await getSiteContentSection(
        'admin',
        'interface',
        'content'
      );

    if (error) {
      dwarn(
        '[admin-v2] Interface do painel não carregada:',
        error.message
      );

      adminUiConfig =
        { ...ADMIN_UI_DEFAULTS };
    } else {
      let content =
        data?.content || {};

      if (typeof content === 'string') {
        try {
          content =
            JSON.parse(content);
        } catch (_) {
          content = {};
        }
      }

      adminUiConfig =
        normalizeAdminUiConfig(content);
    }

    fillAdminUiSettings(
      adminUiConfig
    );

    applyAdminUiConfig(
      adminUiConfig
    );
  } catch (error) {
    dwarn(
      '[admin-v2] Falha ao carregar interface:',
      error
    );
  }
}

async function saveAdminUiSettings(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  if (!beginFormBusy(form)) {
    return;
  }

  try {
    const payload =
      collectAdminUiConfig();

    const result = await upsertSiteContentSection(
      'admin',
      'interface',
      payload
    );

    if (result.error) {
      throw result.error;
    }

    adminUiConfig =
      payload;

    applyAdminUiConfig(
      adminUiConfig
    );

    msg(
      $('admin-interface-msg'),
      'Interface do painel salva.',
      'sucesso'
    );
  } catch (error) {
    msg(
      $('admin-interface-msg'),
      `Erro ao salvar: ${error.message}`,
      'erro'
    );
  } finally {
    endFormBusy(form);
  }
}

function resetAdminUiSettings() {
  fillAdminUiSettings(
    ADMIN_UI_DEFAULTS
  );

  msg(
    $('admin-interface-msg'),
    'Textos padrão carregados. Clique em “Salvar interface do painel” para confirmar.',
    ''
  );
}

async function loadSettings() {

  loadAdminUiSettings();

  const {
    data,
    error
  } = await getSiteSettings();


  if (error) {

    flash(
      `Erro ao carregar configurações: ${error.message}`,
      'erro'
    );

    return;
  }


  if (!data) {
    return;
  }


  $('settings-site-name').value =
    data.site_name || '';

  $('settings-email').value =
    data.email || '';

  $('settings-whatsapp').value =
    data.whatsapp || '';

  $('settings-instagram').value =
    data.instagram_url || '';

  $('settings-location').value =
    data.location || '';

  $('settings-specialty').value =
    data.specialty || '';

  $('settings-availability').value =
    data.availability || '';

  $('settings-footer').value =
    data.footer_text || '';
}


async function saveSettings(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!beginFormBusy(form)) return;

  try {
    const email = safeText($('settings-email').value, 254).toLowerCase();
    const whatsappRaw = safeText($('settings-whatsapp').value, 20);
    const whatsapp = whatsappRaw.replace(/\D/g, '');

    if (email && !emailValido(email)) {
      msg($('settings-msg'), 'Informe um e-mail válido.', 'erro');
      return;
    }
    if (whatsappRaw && (whatsapp.length < 7 || whatsapp.length > 15)) {
      msg($('settings-msg'), 'WhatsApp deve conter entre 7 e 15 dígitos.', 'erro');
      return;
    }

    const p = {
      site_name: safeText($('settings-site-name').value, 120),
      email: email || null,
      whatsapp: whatsapp || null,
      instagram_url: safeText($('settings-instagram').value, 2048) || null,
      location: safeText($('settings-location').value, 160) || null,
      specialty: safeText($('settings-specialty').value, 160) || null,
      availability: safeText($('settings-availability').value, 160) || null,
      footer_text: safeText($('settings-footer').value, 1000) || null,
      updated_at: new Date().toISOString()
    };

    const r = await saveSiteSettings(p);

    if (r.error) {
      msg($('settings-msg'), r.error.message, 'erro');
      return;
    }
    msg($('settings-msg'), 'Configurações salvas.', 'sucesso');
  } finally {
    endFormBusy(form);
  }
}


/* =========================================================
   CONTEÚDO DAS PÁGINAS (site_content)
========================================================= */

const CONTENT_DEFAULTS = {
  inicio: {
    hero: {
      eyebrow: '',
      title: '',
      description: '',
      desktop_image: '',
      mobile_image: '',
      static_focus_x: 50,
      static_focus_y: 50,
      static_mobile_focus_x: 50,
      static_mobile_focus_y: 50,
      image_alt: 'Rangel Santos, fotógrafo',
      primary_button: { text: 'Ver galeria', url: '/galeria' },
      secondary_button: { text: 'Agendar sessão', url: '/contato' },
      meta: []
    },
    recent_work: {
      eyebrow: '',
      title: '',
      gallery_limit: 6,
      button: { text: 'Galeria completa →', url: '/galeria' }
    }
  },
  sobre: {
    conteudo: {
      eyebrow: 'Sobre mim',
      paragraphs: [],
      specs: [],
      portrait_url: '',
      portrait_alt: 'Retrato de Rangel Santos, fotógrafo',
      cta_text: 'Vamos conversar',
      cta_url: '/contato'
    }
  },
  contato: {
    conteudo: {
      eyebrow: 'Renove sua autoestima',
      title: 'Contato',
      submit_label: 'Enviar mensagem',
      tipos: [],
      atendimento: ''
    }
  }
};

let contentCache = null;

async function fetchContent() {
  const { data } = await listSiteContent();

  const map = { inicio: {}, sobre: {}, contato: {} };

  (data || []).forEach(row => {
    if (!map[row.slug]) return;

    map[row.slug][row.section_key] =
      parseStoredContent(row.content, {});
  });

  return map;
}

function mergeContent(map) {
  const out = JSON.parse(JSON.stringify(CONTENT_DEFAULTS));

  ['inicio', 'sobre', 'contato'].forEach(page => {
    Object.keys(out[page]).forEach(key => {
      if (map[page][key]) {
        Object.assign(out[page][key], map[page][key]);
      }
    });
  });

  return out;
}

async function loadContent() {
  const map = await fetchContent();
  contentCache = mergeContent(map);

  const h = contentCache.inicio.hero;
  cmsFieldSet('inicio.hero.eyebrow', h.eyebrow || '');
  cmsFieldSet('inicio.hero.title', h.title || '');
  cmsFieldSet('inicio.hero.description', h.description || '');
  $('hero-desktop-image').value = h.desktop_image || '';
  $('hero-mobile-image').value = h.mobile_image || '';
  $('hero-image-alt').value = h.image_alt || '';
  const heroMode = h.mode === 'slideshow' ? 'slideshow' : 'static';
  $('hero-mode-static').checked = heroMode === 'static';
  $('hero-mode-slideshow').checked = heroMode === 'slideshow';
  $('hero-static-focus-x').value = Number(h.static_focus_x ?? 50);
  $('hero-static-focus-y').value = Number(h.static_focus_y ?? 50);
  $('hero-static-mobile-focus-x').value = Number(h.static_mobile_focus_x ?? h.static_focus_x ?? 50);
  $('hero-static-mobile-focus-y').value = Number(h.static_mobile_focus_y ?? h.static_focus_y ?? 50);
  $('hero-slide-interval').value = Number(h.slide_interval ?? 5);
  $('hero-slide-transition').value = Number(h.slide_transition ?? 1.2);
  $('hero-slide-width').value = h.slide_width || HERO_SLIDESHOW_DEFAULTS.width;
  $('hero-slide-fit').value = h.slide_fit || HERO_SLIDESHOW_DEFAULTS.fit;
  $('hero-slide-ratio').value = h.slide_ratio || HERO_SLIDESHOW_DEFAULTS.ratio;
  $('hero-slide-animation').value = h.slide_animation || HERO_SLIDESHOW_DEFAULTS.animation;
  $('hero-slide-order').value = h.slide_order || HERO_SLIDESHOW_DEFAULTS.order;
  $('hero-slide-behind-menu').value = h.slide_behind_menu === false ? 'no' : 'yes';
  heroSlidesDraft = Array.isArray(h.slides)
    ? h.slides.map((s, i) => ({
        id: s.id || `slide-${Date.now()}-${i}`,
        url: s.url || '',
        alt: s.alt || '',
        focus_x: Number(s.focus_x ?? 50),
        focus_y: Number(s.focus_y ?? 50),
        published: s.published !== false
      })).filter(s => s.url)
    : [];
  updateHeroModeUI();
  updateStaticFocalPreview();
  updateStaticMobilePreview();
  renderHeroSlidesAdmin();
  renderHeroSlideshowOverview();
  $('hero-primary-text').value = h.primary_button?.text || '';
  $('hero-primary-url').value = h.primary_button?.url || '';
  $('hero-secondary-text').value = h.secondary_button?.text || '';
  $('hero-secondary-url').value = h.secondary_button?.url || '';
  $('hero-meta').value = (h.meta || [])
    .map(m => `${m.label} | ${m.value}`)
    .join('\n');

  const r = contentCache.inicio.recent_work;
  $('recent-eyebrow').value = r.eyebrow || '';
  $('recent-title').value = r.title || '';
  $('recent-limit').value = r.gallery_limit ?? 6;
  $('recent-btn-text').value = r.button?.text || '';
  $('recent-btn-url').value = r.button?.url || '';

  const s = contentCache.sobre.conteudo;
  $('sobre-eyebrow').value = s.eyebrow || '';
  $('sobre-paragraphs').value = (s.paragraphs || []).join('\n');
  $('sobre-portrait-url').value = s.portrait_url || '';
  $('sobre-portrait-alt').value = s.portrait_alt || '';
  $('sobre-cta-text').value = s.cta_text || '';
  $('sobre-cta-url').value = s.cta_url || '';
  renderSpecsEditor(s.specs || []);

  const ct = contentCache.contato.conteudo;
  $('contato-eyebrow').value = ct.eyebrow || '';
  $('contato-title').value = ct.title || '';
  $('contato-submit-label').value = ct.submit_label || '';
  $('contato-tipos').value = (ct.tipos || []).join('\n');
  $('contato-atendimento').value = ct.atendimento || '';

  ['hero-msg', 'recent-msg', 'sobre-msg', 'contato-msg']
    .forEach(id => msg($(id), ''));
}

function renderSpecsEditor(specs) {
  const c = $('sobre-specs-editor');
  const lista = specs.length
    ? specs
    : [{ label: 'Baseado em', value: 'Vale de Cambra, Portugal' }];

  c.innerHTML = lista.map((s, i) => `
    <div class="inline-form" style="margin-bottom:10px;align-items:flex-end;" data-spec-row>
      <div class="field" style="flex:1;margin-bottom:0;"><label>Rótulo</label><input class="spec-label" maxlength="80" value="${esc(s.label)}"></div>
      <div class="field" style="flex:1;margin-bottom:0;"><label>Valor</label><input class="spec-value" maxlength="160" value="${esc(s.value)}"></div>
      <button type="button" class="small-btn" data-remove-spec>Remover</button>
    </div>`).join('');

  c.querySelectorAll('[data-remove-spec]').forEach(b =>
    b.addEventListener('click', () => b.closest('[data-spec-row]').remove())
  );
}

function collectSpecs() {
  return [...document.querySelectorAll('#sobre-specs-editor [data-spec-row]')]
    .map(row => ({
      label: row.querySelector('.spec-label').value.trim(),
      value: row.querySelector('.spec-value').value.trim()
    }))
    .filter(s => s.label || s.value);
}

async function upsertContent(slug, sectionKey, payload, msgId) {
  if (msgId && $(msgId)) msg($(msgId), 'Salvando...');

  const r = await upsertSiteContentSection(
    slug,
    sectionKey,
    payload
  );

  if (r.error) {
    if (msgId && $(msgId)) msg($(msgId), 'Erro ao salvar: ' + r.error.message, 'erro');
    return false;
  }

  if (msgId && $(msgId)) msg($(msgId), 'Salvo!', 'sucesso');
  contentCache = null;
  return true;
}


function updateHeroModeUI() {
  const mode = document.querySelector('input[name="hero-mode"]:checked')?.value || 'static';
  $('hero-static-editor').classList.toggle('is-primary-mode', mode === 'static');
  $('hero-slideshow-editor').classList.toggle('is-primary-mode', mode === 'slideshow');
}

function focalStyle(x, y) {
  return `${Number(x ?? 50)}% ${Number(y ?? 50)}%`;
}

function resolvePreviewMediaUrl(value) {
  const url=String(value||'').trim();
  if(!url||/^https?:\/\//i.test(url)||url.startsWith('/'))return url;
  if(/^images\//i.test(url))return `/${url.replace(/^\.\//,'')}`;
  return `/legacy/${url.replace(/^\.\//,'')}`;
}


function updateStaticMobilePreview() {
  const preview = $('hero-static-mobile-preview');
  if (!preview) return;

  const desktopUrl = resolvePreviewMediaUrl(safeText($('hero-desktop-image')?.value, 2048));
  const mobileUrl = resolvePreviewMediaUrl(safeText($('hero-mobile-image')?.value, 2048));
  const activeUrl = mobileUrl || desktopUrl;

  preview.style.backgroundImage = activeUrl
    ? `url("${activeUrl.replace(/"/g, '%22')}")`
    : '';

  const x=clampNumber($('hero-static-mobile-focus-x')?.value,0,100,50);
  const y=clampNumber($('hero-static-mobile-focus-y')?.value,0,100,50);
  preview.style.backgroundPosition=focalStyle(x,y);
  const marker=preview.querySelector('.focal-marker');
  if(marker){marker.style.left=x+'%';marker.style.top=y+'%'}
  if($('hero-static-mobile-focus-x-out'))$('hero-static-mobile-focus-x-out').textContent=x+'%';
  if($('hero-static-mobile-focus-y-out'))$('hero-static-mobile-focus-y-out').textContent=y+'%';

  preview.classList.toggle('empty', !activeUrl);
  preview.classList.toggle('uses-desktop-fallback', !mobileUrl && Boolean(desktopUrl));
}


function heroSettingLabel(map, value, fallback = '') {
  return map[value] || fallback || value;
}

function heroSlideshowSettingsSummary() {
  const animation = heroSettingLabel({
    fade: 'Esmaecer',
    'slide-horizontal': 'Deslizar horizontal',
    'slide-vertical': 'Deslizar do topo',
    kenburns: 'Movimentação suave'
  }, $('hero-slide-animation')?.value, 'Esmaecer');

  const ratio = heroSettingLabel({
    fullscreen: 'Tela cheia',
    '16-9': '16:9',
    '2.4-1': '2,4:1',
    '4-1': '4:1'
  }, $('hero-slide-ratio')?.value, 'Tela cheia');

  const order = $('hero-slide-order')?.value === 'random'
    ? 'Randômica'
    : 'Sequencial';

  const interval = clampNumber(
    $('hero-slide-interval')?.value,
    2,
    30,
    5
  );

  return `${animation} · ${ratio} · ${order} · ${interval}s`;
}

function updateHeroSlideshowConfigSummary() {
  const el = $('hero-slideshow-config-summary');
  if (el) el.textContent = heroSlideshowSettingsSummary();
}

function openHeroSlideshowSettings() {
  const modal = $('hero-slideshow-settings-modal');
  if (!modal) return;

  msg($('hero-settings-msg'), '');
  modal.hidden = false;
}

function closeHeroSlideshowSettings() {
  const modal = $('hero-slideshow-settings-modal');
  if (!modal) return;

  modal.hidden = true;
  updateHeroSlideshowConfigSummary();
  renderHeroSlideshowOverview();
}

function applyHeroSlideshowSettings() {
  $('hero-slide-interval').value = clampNumber(
    $('hero-slide-interval').value,
    2,
    30,
    5
  );

  $('hero-slide-transition').value = clampNumber(
    $('hero-slide-transition').value,
    .3,
    5,
    1.2
  );

  updateHeroSlideshowConfigSummary();
  renderHeroSlideshowOverview();

  msg(
    $('hero-settings-msg'),
    'Configurações aplicadas. Clique em “Salvar herói” para publicar.',
    'sucesso'
  );

  setTimeout(closeHeroSlideshowSettings, 650);
}

function stopHeroAdminPreview() {
  if (heroAdminPreviewTimer) {
    clearInterval(heroAdminPreviewTimer);
    heroAdminPreviewTimer = null;
  }
}

function renderHeroSlideshowOverview() {
  const preview = $('hero-slideshow-admin-preview');
  const summary = $('hero-slideshow-summary');

  if (!preview || !summary) return;

  stopHeroAdminPreview();

  let slides = heroSlidesDraft
    .filter(slide => slide?.url && slide.published !== false);

  const total = heroSlidesDraft.length;
  const published = slides.length;

  summary.textContent =
    `${total} ${total === 1 ? 'imagem' : 'imagens'} · ${published} ${published === 1 ? 'publicada' : 'publicadas'}`;

  updateHeroSlideshowConfigSummary();

  const animation =
    $('hero-slide-animation')?.value || 'fade';

  const order =
    $('hero-slide-order')?.value || 'sequential';

  const fit =
    $('hero-slide-fit')?.value || 'cover';

  const transitionMs =
    Math.max(
      300,
      (Number($('hero-slide-transition')?.value) || 1.2) * 1000
    );

  const intervalMs =
    Math.max(
      1800,
      (Number($('hero-slide-interval')?.value) || 5) * 1000
    );

  if (order === 'random' && slides.length > 1) {
    slides = [...slides];

    for (let i = slides.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [slides[i], slides[j]] = [slides[j], slides[i]];
    }
  }

  preview.dataset.animation = animation;
  preview.dataset.fit = fit;

  preview.style.setProperty(
    '--admin-hero-transition',
    `${transitionMs}ms`
  );

  preview.style.setProperty(
    '--admin-hero-interval',
    `${intervalMs}ms`
  );

  if (!slides.length) {
    preview.innerHTML =
      '<div class="hero-slideshow-admin-empty">Nenhuma imagem publicada no slideshow.</div>';
    return;
  }

  preview.innerHTML = slides.map((slide, index) => `
    <div
      class="hero-slideshow-admin-frame ${index === 0 ? 'is-visible' : ''}"
      data-admin-frame="${index}"
      style="
        background-image:url('${attr(slide.url)}');
        background-position:${focalStyle(slide.focus_x, slide.focus_y)};
      "
      aria-hidden="${index === 0 ? 'false' : 'true'}"
    ></div>
  `).join('');

  if (slides.length < 2) return;

  const frames = [
    ...preview.querySelectorAll(
      '.hero-slideshow-admin-frame'
    )
  ];

  let current = 0;

  const activate = next => {
    const currentFrame =
      frames[current];

    const nextFrame =
      frames[next];

    frames.forEach(frame => {
      frame.classList.remove(
        'is-prev',
        'is-entering',
        'is-from-right',
        'is-from-top'
      );
    });

    if (animation === 'slide-horizontal') {

      nextFrame.classList.add(
        'is-entering',
        'is-from-right',
        'is-visible'
      );

      currentFrame.classList.add(
        'is-prev'
      );

      nextFrame.setAttribute(
        'aria-hidden',
        'false'
      );

      requestAnimationFrame(() => {
        nextFrame.classList.remove(
          'is-from-right'
        );
      });

    } else if (animation === 'slide-vertical') {

      nextFrame.classList.add(
        'is-entering',
        'is-from-top',
        'is-visible'
      );

      currentFrame.classList.add(
        'is-prev'
      );

      nextFrame.setAttribute(
        'aria-hidden',
        'false'
      );

      requestAnimationFrame(() => {
        nextFrame.classList.remove(
          'is-from-top'
        );
      });

    } else {

      currentFrame.classList.remove(
        'is-visible'
      );

      currentFrame.setAttribute(
        'aria-hidden',
        'true'
      );

      nextFrame.classList.add(
        'is-visible'
      );

      nextFrame.setAttribute(
        'aria-hidden',
        'false'
      );
    }

    window.setTimeout(
      () => {
        if (
          animation === 'slide-horizontal' ||
          animation === 'slide-vertical'
        ) {
          currentFrame.classList.remove(
            'is-visible',
            'is-prev'
          );

          currentFrame.setAttribute(
            'aria-hidden',
            'true'
          );

          nextFrame.classList.remove(
            'is-entering'
          );
        }
      },
      transitionMs + 70
    );

    current = next;
  };

  heroAdminPreviewTimer =
    setInterval(
      () => {
        const next =
          (current + 1) %
          frames.length;

        activate(next);
      },
      intervalMs
    );
}

function openHeroSlidesManager() {
  const modal = $('hero-slides-manager-modal');
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  modal.hidden = false;
  document.body.classList.add('modal-open');
  renderHeroSlidesAdmin();
}

function closeHeroSlidesManager() {
  const modal = $('hero-slides-manager-modal');
  if (!modal) return;

  modal.hidden = true;

  if (
    $('hero-slideshow-settings-modal')?.hidden !== false
  ) {
    document.body.classList.remove('modal-open');
  }

  renderHeroSlideshowOverview();
}

function updateStaticFocalPreview() {
  const preview = $('hero-static-preview');
  const url = resolvePreviewMediaUrl($('hero-desktop-image').value);
  const x = clampNumber($('hero-static-focus-x').value,0,100,50);
  const y = clampNumber($('hero-static-focus-y').value,0,100,50);
  preview.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : '';
  preview.style.backgroundPosition = focalStyle(x, y);
  preview.classList.toggle('empty', !url);
  const marker = preview.querySelector('.focal-marker');
  marker.style.left = x + '%';
  marker.style.top = y + '%';
  $('hero-static-focus-x-out').textContent = x + '%';
  $('hero-static-focus-y-out').textContent = y + '%';
  updateStaticMobilePreview();
}

function setFocalFromClick(preview, event, onChange) {
  const r = preview.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - r.left) / r.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - r.top) / r.height) * 100));
  onChange(Math.round(x), Math.round(y));
}

async function uploadHeroFiles(files) {
  const uploaded = [];
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `home-hero/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error } = await uploadToBucket(BUCKET, path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;
    const { data } = getPublicUrlFromBucket(BUCKET, path);
    if (data?.publicUrl) uploaded.push(data.publicUrl);
  }
  return uploaded;
}

function renderHeroSlidesAdmin() {
  const c = $('hero-slides-list');
  if (!c) return;

  if (!heroSlidesDraft.length) {
    c.innerHTML = '<div class="hero-slides-empty">Nenhuma foto adicionada ao slideshow.</div>';
    renderHeroSlideshowOverview();
    return;
  }

  c.innerHTML = heroSlidesDraft.map((s, i) => `
    <article
      class="hero-slide-card"
      data-slide-index="${i}"
    >
      <button
        class="hero-slide-drag-handle"
        type="button"
        title="Arraste para mudar a ordem"
        aria-label="Arraste para mudar a ordem da fotografia ${i + 1}"
      >⋮⋮</button>

      <div
        class="hero-slide-preview focal-preview"
        style="
          background-image:url('${esc(s.url)}');
          background-position:${focalStyle(s.focus_x,s.focus_y)}
        "
      >
        <span
          class="focal-marker"
          style="
            left:${Number(s.focus_x ?? 50)}%;
            top:${Number(s.focus_y ?? 50)}%
          "
        ></span>

        <span class="hero-slide-number">
          ${String(i + 1).padStart(2, '0')}
        </span>

        <span class="status-pill ${s.published !== false ? 'online' : ''}">
          ${s.published !== false ? 'PUBLICADA' : 'OCULTA'}
        </span>
      </div>

      <div class="hero-slide-fields">
        <div class="field">
          <label>Texto alternativo</label>

          <input
            data-slide-alt
            maxlength="240"
            value="${esc(s.alt || '')}"
            placeholder="Descrição da fotografia"
          >
        </div>

        <div class="hero-slide-actions">
          <button
            type="button"
            class="small-btn"
            data-slide-publish
          >
            ${s.published !== false ? 'Ocultar' : 'Publicar'}
          </button>

          <button
            type="button"
            class="small-btn danger"
            data-slide-remove
          >
            Remover
          </button>
        </div>

        <p class="field-help">
          Ponto focal:
          ${Math.round(s.focus_x ?? 50)}% ×
          ${Math.round(s.focus_y ?? 50)}%
          — clique na foto para alterar.
        </p>
      </div>
    </article>
  `).join('');

  c.querySelectorAll(
    '.hero-slide-card'
  ).forEach(card => {

    const i =
      Number(
        card.dataset.slideIndex
      );

    const preview =
      card.querySelector(
        '.hero-slide-preview'
      );

    preview.addEventListener(
      'click',
      e => {
        setFocalFromClick(
          preview,
          e,
          (x, y) => {
            heroSlidesDraft[i].focus_x = x;
            heroSlidesDraft[i].focus_y = y;
            renderHeroSlidesAdmin();
          }
        );
      }
    );

    card
      .querySelector('[data-slide-alt]')
      .addEventListener(
        'input',
        e => {
          heroSlidesDraft[i].alt =
            e.target.value;
        }
      );

    card
      .querySelector('[data-slide-publish]')
      .addEventListener(
        'click',
        () => {
          heroSlidesDraft[i].published =
            heroSlidesDraft[i].published === false;

          renderHeroSlidesAdmin();
        }
      );

    card
      .querySelector('[data-slide-remove]')
      .addEventListener(
        'click',
        () => {
          heroSlidesDraft.splice(
            i,
            1
          );

          renderHeroSlidesAdmin();
        }
      );
  });

  configurarOrdenacaoHeroSlides();

  renderHeroSlideshowOverview();
}


/* =========================================================
   SLIDESHOW — ORDENAÇÃO MANUAL POR ARRASTAR
   Pointer Events: mouse, toque e caneta.
========================================================= */

function configurarOrdenacaoHeroSlides() {
  const container = $('hero-slides-list');
  if (!container) return;

  const handles = [
    ...container.querySelectorAll('.hero-slide-drag-handle')
  ];

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const card = handle.closest('.hero-slide-card');
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();

      const original = [...heroSlidesDraft];
      const rect = card.getBoundingClientRect();

      const placeholder = document.createElement('div');
      placeholder.className = 'hero-slide-drop-placeholder';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;

      container.insertBefore(placeholder, card.nextSibling);

      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      card.classList.add('is-pointer-dragging');
      card.style.width = `${rect.width}px`;
      card.style.height = `${rect.height}px`;
      card.style.position = 'fixed';
      card.style.left = `${rect.left}px`;
      card.style.top = `${rect.top}px`;
      card.style.zIndex = '5000';
      card.style.pointerEvents = 'none';
      card.style.margin = '0';

      document.body.appendChild(card);

      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch (_) {}

      let moved = false;

      const clearHighlights = () => {
        container
          .querySelectorAll('.hero-slide-card')
          .forEach(item => item.classList.remove('drag-over'));
      };

      const moveCard = e => {
        e.preventDefault();
        moved = true;

        card.style.left = `${e.clientX - offsetX}px`;
        card.style.top = `${e.clientY - offsetY}px`;

        const underPointer = document.elementFromPoint(e.clientX, e.clientY);
        const target = underPointer?.closest('.hero-slide-card');

        clearHighlights();

        if (!target || target === card) return;

        target.classList.add('drag-over');

        const targetRect = target.getBoundingClientRect();
        const placeholderRect = placeholder.getBoundingClientRect();

        const sameRow =
          Math.abs(targetRect.top - placeholderRect.top) <
          Math.min(targetRect.height, rect.height) * 0.55;

        if (sameRow) {
          const before = e.clientX < targetRect.left + targetRect.width / 2;

          container.insertBefore(
            placeholder,
            before ? target : target.nextSibling
          );
        } else {
          const before = e.clientY < targetRect.top + targetRect.height / 2;

          container.insertBefore(
            placeholder,
            before ? target : target.nextSibling
          );
        }
      };

      const restoreCard = () => {
        container.insertBefore(card, placeholder);
        placeholder.remove();

        card.classList.remove('is-pointer-dragging');
        card.removeAttribute('style');

        clearHighlights();
      };

      const finishDrag = e => {
        document.removeEventListener('pointermove', moveCard);
        document.removeEventListener('pointerup', finishDrag);
        document.removeEventListener('pointercancel', cancelDrag);

        try {
          handle.releasePointerCapture?.(event.pointerId);
        } catch (_) {}

        restoreCard();

        const novaOrdem = [
          ...container.querySelectorAll('.hero-slide-card')
        ]
          .map(item => {
            const oldIndex = Number(item.dataset.slideIndex);
            return original[oldIndex];
          })
          .filter(Boolean);

        if (
          moved &&
          novaOrdem.length === heroSlidesDraft.length
        ) {
          heroSlidesDraft = novaOrdem;

          renderHeroSlidesAdmin();

          msg(
            $('hero-msg'),
            'Ordem alterada. Clique em “Salvar herói” para publicar.',
            'sucesso'
          );
        } else {
          renderHeroSlidesAdmin();
        }
      };

      const cancelDrag = () => {
        document.removeEventListener('pointermove', moveCard);
        document.removeEventListener('pointerup', finishDrag);
        document.removeEventListener('pointercancel', cancelDrag);

        restoreCard();
        renderHeroSlidesAdmin();
      };

      document.addEventListener('pointermove', moveCard, { passive: false });
      document.addEventListener('pointerup', finishDrag, { once: true });
      document.addEventListener('pointercancel', cancelDrag, { once: true });
    });
  });
}


document.querySelectorAll('input[name="hero-mode"]').forEach(r =>
  r.addEventListener('change', () => {
    updateHeroModeUI();
    renderHeroSlideshowOverview();
    applyDesignContentPreview();
    updateDesignPublicationState();
  })
);

$('btn-manage-hero-slides')?.addEventListener('click', event => {
  event.stopPropagation();
  openHeroSlidesManager();
});

$('hero-slideshow-config-card')?.addEventListener('click', openHeroSlideshowSettings);

$('btn-save-hero-settings')?.addEventListener('click', applyHeroSlideshowSettings);

document.querySelectorAll('[data-close-hero-settings]').forEach(element =>
  element.addEventListener('click', closeHeroSlideshowSettings)
);

document.querySelectorAll('[data-close-hero-slides]').forEach(element =>
  element.addEventListener('click', closeHeroSlidesManager)
);

/*
  Antes havia aqui um listener manual só para o hero-title, para
  manter a variável de fonte única sincronizada quando o utilizador
  digitava direto no campo. Com o motor genérico (cmsBindAllFields),
  qualquer campo com data-cms-field já faz isso sozinho — este
  listener específico deixou de ser necessário.
*/

[
  'hero-slide-interval',
  'hero-slide-transition',
  'hero-slide-width',
  'hero-slide-fit',
  'hero-slide-ratio',
  'hero-slide-animation',
  'hero-slide-order',
  'hero-slide-behind-menu'
].forEach(id => {
  $(id)?.addEventListener('input', () => {
    updateHeroSlideshowConfigSummary();
    renderHeroSlideshowOverview();
  });

  $(id)?.addEventListener('change', () => {
    updateHeroSlideshowConfigSummary();
    renderHeroSlideshowOverview();
  });
});

['hero-static-focus-x', 'hero-static-focus-y'].forEach(id =>
  $(id).addEventListener('input', updateStaticFocalPreview)
);

['hero-static-mobile-focus-x','hero-static-mobile-focus-y'].forEach(id=>
  $(id)?.addEventListener('input',updateStaticMobilePreview)
);

$('hero-desktop-image').addEventListener('input', updateStaticFocalPreview);
$('hero-mobile-image').addEventListener('input', updateStaticMobilePreview);

$('hero-static-preview').addEventListener('click', e => {
  setFocalFromClick($('hero-static-preview'), e, (x, y) => {
    $('hero-static-focus-x').value = x;
    $('hero-static-focus-y').value = y;
    updateStaticFocalPreview();
  });
});

$('hero-static-mobile-preview').addEventListener('click',e=>{
  setFocalFromClick($('hero-static-mobile-preview'),e,(x,y)=>{
    $('hero-static-mobile-focus-x').value=x;
    $('hero-static-mobile-focus-y').value=y;
    updateStaticMobilePreview();
  });
});

$('hero-static-upload').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  const { validos, rejeitados } = validarImagens(files.slice(0, 1));
  if (rejeitados.length) msg($('hero-msg'), rejeitados.join(' · '), 'erro');
  if (!validos.length) { e.target.value = ''; return; }
  try {
    msg($('hero-msg'), 'Enviando foto...');
    const urls = await withOperationLock('hero-static-upload', () => uploadHeroFiles(validos));
    if (urls?.skipped) { e.target.value = ''; return; }
    if (urls[0]) {
      $('hero-desktop-image').value = urls[0];
      updateStaticFocalPreview();
      msg($('hero-msg'), 'Foto enviada. Clique em “Salvar herói” para aplicar.', 'sucesso');
    }
  } catch (error) {
    msg($('hero-msg'), 'Erro no upload: ' + error.message, 'erro');
  }
  e.target.value = '';
});


$('hero-static-mobile-upload').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;

  const { validos, rejeitados } = validarImagens(files.slice(0, 1));

  if (rejeitados.length) {
    msg($('hero-msg'), rejeitados.join(' · '), 'erro');
  }

  if (!validos.length) {
    e.target.value = '';
    return;
  }

  try {
    msg($('hero-msg'), 'Enviando foto para celular...');

    const urls = await withOperationLock(
      'hero-static-mobile-upload',
      () => uploadHeroFiles(validos)
    );

    if (urls?.skipped) {
      e.target.value = '';
      return;
    }

    if (urls[0]) {
      $('hero-mobile-image').value = urls[0];
      updateStaticMobilePreview();

      msg(
        $('hero-msg'),
        'Foto de celular enviada. Clique em “Salvar herói” para aplicar.',
        'sucesso'
      );
    }
  } catch (error) {
    msg(
      $('hero-msg'),
      'Erro no upload da foto de celular: ' + error.message,
      'erro'
    );
  }

  e.target.value = '';
});

$('hero-slides-upload').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  const { validos, rejeitados } = validarImagens(files);
  if (rejeitados.length) msg($('hero-msg'), rejeitados.join(' · '), 'erro');
  if (!validos.length) { e.target.value = ''; return; }
  try {
    msg($('hero-msg'), `Enviando ${validos.length} foto(s)...`);
    const urls = await withOperationLock('hero-slides-upload', () => uploadHeroFiles(validos));
    if (urls?.skipped) { e.target.value = ''; return; }
    urls.forEach((url, i) => heroSlidesDraft.push({
      id: `slide-${Date.now()}-${i}`,
      url,
      alt: '',
      focus_x: 50,
      focus_y: 50,
      published: true
    }));
    renderHeroSlidesAdmin();
    msg($('hero-msg'), 'Fotos adicionadas. Clique em “Salvar herói” para aplicar.', 'sucesso');
  } catch (error) {
    msg($('hero-msg'), 'Erro no upload: ' + error.message, 'erro');
  }
  e.target.value = '';
});

$('form-hero').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!beginFormBusy(form))return;const y=window.scrollY;try{const payload=collectHeroContentPayload();if(!payload.desktop_image){msg($('hero-msg'),'Escolha uma foto estática. Ela também é a proteção/fallback do slideshow.','erro');return}if(payload.mode==='slideshow'&&!payload.slides.some(x=>x.published!==false&&x.url)){msg($('hero-msg'),'Para usar Slideshow, publique pelo menos uma foto.','erro');return}if(activeView==='design'){await saveDesignDraft();msg($('hero-msg'),'Herói salvo no rascunho. O site público ainda não foi alterado.','sucesso');applyDesignContentPreview()}else await upsertContent('inicio','hero',payload,'hero-msg')}finally{endFormBusy(form);requestAnimationFrame(()=>window.scrollTo(0,y))}});

$('form-recent').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!beginFormBusy(form))return;const y=window.scrollY;try{const payload=collectRecentContentPayload();if(activeView==='design'){await saveDesignDraft();msg($('recent-msg'),'Seção salva no rascunho.','sucesso');applyDesignContentPreview()}else await upsertContent('inicio','recent_work',payload,'recent-msg')}finally{endFormBusy(form);requestAnimationFrame(()=>window.scrollTo(0,y))}});

$('form-sobre').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!beginFormBusy(form))return;const y=window.scrollY;try{const payload=collectSobreContentPayload();if(activeView==='design'){await saveDesignDraft();msg($('sobre-msg'),'Página Sobre salva no rascunho.','sucesso');applyDesignContentPreview()}else await upsertContent('sobre','conteudo',payload,'sobre-msg')}finally{endFormBusy(form);requestAnimationFrame(()=>window.scrollTo(0,y))}});

$('form-contato').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!beginFormBusy(form))return;const y=window.scrollY;try{const payload=collectContatoContentPayload();if(activeView==='design'){await saveDesignDraft();msg($('contato-msg'),'Página Contato salva no rascunho.','sucesso');applyDesignContentPreview()}else await upsertContent('contato','conteudo',payload,'contato-msg')}finally{endFormBusy(form);requestAnimationFrame(()=>window.scrollTo(0,y))}});

$('btn-add-spec').addEventListener('click', () => {
  const c = $('sobre-specs-editor');
  const div = document.createElement('div');
  div.className = 'inline-form';
  div.style.cssText = 'margin-bottom:10px;align-items:flex-end;';
  div.dataset.specRow = '';
  div.innerHTML = `
    <div class="field" style="flex:1;margin-bottom:0;"><label>Rótulo</label><input class="spec-label" maxlength="80"></div>
    <div class="field" style="flex:1;margin-bottom:0;"><label>Valor</label><input class="spec-value" maxlength="160"></div>
    <button type="button" class="small-btn" data-remove-spec>Remover</button>`;
  div.querySelector('[data-remove-spec]')
    .addEventListener('click', () => div.remove());
  c.appendChild(div);
});



/* =========================================================
   MENSAGENS
========================================================= */

async function loadMessages() {
  const list = $('messages-list');
  list.innerHTML = '';

  const { data, error } = await listMessages();

  if (error) {
    messagesCache = [];
    list.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Tabela ainda não criada</p>
        <p class="panel-copy">Rode o script SQL de "mensagens" no Supabase para começar a receber mensagens do formulário de contato.</p>
      </div>`;
    return;
  }

  const rows = data || [];
  messagesCache = rows;

  await refreshUnreadMessagesCount();

  renderMessagesUI({
    list,
    rows,
    esc,
    attr,
    openReplyMessage,
    markRead: marcarLida,
    deleteMessage: excluirMensagem,
    withOperationLock
  });
}

async function marcarLida(id) {
  const { error } = await markMessageRead(id);

  if (error) {
    flash('Erro: ' + error.message, 'erro');
    return;
  }

  await Promise.all([
    loadMessages(),
    refreshUnreadMessagesCount()
  ]);
}

async function excluirMensagem(id) {
  if (!confirm('Excluir esta mensagem?')) return;

  const { error } = await removeMessage(id);

  if (error) {
    flash('Erro: ' + error.message, 'erro');
    return;
  }

  flash('Mensagem excluída.', 'sucesso');
  await Promise.all([
    loadMessages(),
    refreshUnreadMessagesCount()
  ]);
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function esc(v) {
  return String(v ?? '')
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}

function attr(v) {
  return esc(v);
}


/* =========================================================
   AUTH
========================================================= */

onAdminAuthStateChange(
  (_e, s) => {

    if (!s) {

      stopAdminRealtime().catch(() => {});

      $('login-screen').hidden =
        false;

      $('app').hidden =
        true;

    }

  }
);


requireAdmin().catch(err => {
  console.error('Erro ao verificar sessão:', err);
  $('login-screen').hidden = false;
  $('app').hidden = true;
});


/* =========================================================
   ENSAIOS (SESSÕES DE CLIENTES)
   ========================================================= */

const numero = (i) => String(i + 1).padStart(4, '0');

function statusLabel(status) {
  if (status === 'fotos_disponiveis' || status === 'entregue') return 'Fotos disponíveis';
  if (status === 'em_edicao') return 'Em edição';
  if (status === 'selecao_finalizada' || status === 'selecionado') return 'Seleção finalizada';
  if (status === 'aguardando_selecao') return 'Aguardando seleção';
  return 'Preparando fotos';
}

async function loadSessions() {

  const { data, error } = await listSessions();

  if (error) {
    flash(`Erro ao carregar ensaios: ${error.message}`, 'erro');
    return;
  }

  sessionsCache = data || [];
  // Mostra os ensaios imediatamente. Capas e contador são enriquecimentos e
  // não devem bloquear a navegação até o Storage terminar de responder.
  renderSessions();
  refreshCompletedSelectionsCount().catch(error => {
    dwarn('Não foi possível atualizar o contador de seleções:', error?.message || error);
  });
  // Busca as fotografias apenas para obter a capa de cada ensaio.
  // Não altera a estrutura da tabela ensaios nem a lógica das sessões.
  if (sessionsCache.length) {
    const ids = sessionsCache.map(s => s.id);

    const { data: photos, error: photosError } = await listSessionPhotosForSessions(ids);

    if (photosError) {
      dwarn('Não foi possível carregar as capas dos ensaios:', photosError.message);
    }

    const bySession = new Map();

    (photos || []).forEach(photo => {
      if (!bySession.has(photo.ensaio_id)) {
        bySession.set(photo.ensaio_id, []);
      }
      bySession.get(photo.ensaio_id).push(photo);
    });

    const covers = sessionsCache.map(s => {
      const photosForSession = bySession.get(s.id) || [];

      const explicitlySelectedCover =
        s.capa_foto_id
          ? photosForSession.find(p => p.id === s.capa_foto_id)
          : null;

      const fallbackCover =
        [...photosForSession]
          .sort((a, b) => {
            const ao = Number.isFinite(Number(a.ordem)) ? Number(a.ordem) : 999999;
            const bo = Number.isFinite(Number(b.ordem)) ? Number(b.ordem) : 999999;
            return ao - bo;
          })[0] ||
        photosForSession.find(p => p.tipo === 'prova') ||
        photosForSession.find(p => p.tipo === 'final') ||
        photosForSession[0] ||
        null;

      return explicitlySelectedCover || fallbackCover;
    });

    // Antes eram assinadas todas as fotos de todos os ensaios. Agora somente
    // uma capa por ensaio recebe URL temporária.
    const signedCovers = await signSessionPhotoUrls(covers.filter(Boolean));
    const signedCoverById = new Map(signedCovers.map(photo => [photo.id, photo]));

    sessionsCache = sessionsCache.map((s, index) => {
      const cover = covers[index];
      const signedCover = cover ? signedCoverById.get(cover.id) : null;
      return { ...s, cover_url: signedCover?.url || null };
    });
  }

  renderSessions();
}

function renderSessions() {
  renderSessionsUI({
    $,
    sessions: sessionsCache,
    esc,
    attr,
    statusLabel,
    openSessionModal,
    deleteSession: excluirSession,
    withOperationLock
  });
}

function openSessionForm() {
  $('session-form-wrap').hidden = false;
  $('session-form-title').textContent = 'Novo ensaio';
  $('session-form').reset();
  msg($('session-form-msg'), '');
  $('session-titulo').focus();
}

function closeSessionForm() {
  $('session-form-wrap').hidden = true;
  $('session-form').reset();
  msg($('session-form-msg'), '');
}

async function saveSession(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!beginFormBusy(form)) return;
  const msgEl = $('session-form-msg');

  try {
    const titulo = safeText($('session-titulo').value, 160);
    const clienteEmail = safeText($('session-email').value, 254).toLowerCase();
    const telefoneRaw = safeText($('session-telefone').value, 20);
    const telefone = telefoneRaw.replace(/\D/g, '');
    const login = slugify(safeText($('session-login').value, 80)).slice(0,80);
    const codigo = safeText($('session-codigo').value,64);

    if (!titulo || !login || !codigo) {
      msg(msgEl, 'Título, login e senha precisam conter caracteres válidos.', 'erro');
      return;
    }
    if (!emailValido(clienteEmail)) {
      msg(msgEl, 'Informe um e-mail válido para a cliente.', 'erro');
      $('session-email').focus();
      return;
    }
    if (telefoneRaw && (telefone.length < 7 || telefone.length > 15)) {
      msg(msgEl, 'O WhatsApp deve conter entre 7 e 15 dígitos.', 'erro');
      $('session-telefone').focus();
      return;
    }

    const p = {
      titulo,
      cliente_nome: safeText($('session-cliente').value,160),
      cliente_telefone: telefone,
      cliente_email: clienteEmail,
      categoria: safeText($('session-categoria').value,80),
      codigo_acesso: codigo,
      slug: login
    };

    const { error } = await createSession(p);
    if (error) {
      msgEl.textContent = (error.message.includes('duplicate') || error.message.includes('unique'))
        ? `O login "${p.slug}" já está em uso por outro ensaio. Escolha outro.`
        : 'Erro ao criar: ' + error.message;
      msgEl.className = 'msg erro';
      return;
    }

    msg(msgEl, 'Ensaio criado!', 'sucesso');
    form.reset();
    $('session-form-wrap').hidden = true;
    await loadSessions();
  } finally { endFormBusy(form); }
}

async function openSessionModal(id) {
  const s = sessionsCache.find(x => x.id === id);
  if (!s) return;

  currentSession = s;

  sessionStageOpen.provas = false;
  sessionStageOpen.finais = false;

  $('session-editor-modal').hidden = false;
  syncSessionStageAccordions();

  await loadSessionPhotos();
}

function closeSessionModal() {
  $('session-editor-modal').hidden = true;

  sessionStageOpen.provas = false;
  sessionStageOpen.finais = false;

  currentSession = null;
  currentSessionPhotos = [];
}

async function loadSessionPhotos() {
  if (!currentSession) return;
  const { data, error } = await listSessionPhotos(currentSession.id);
  if (error) {
    msg($('session-msg'), error.message, 'erro');
    return;
  }
  currentSessionPhotos = await signSessionPhotoUrls(data || []);
  renderSessionDetail();
}

async function signSessionPhotoUrls(photos) {
  return Promise.all((photos || []).map(async photo => {
    const originalUrl = photo.storage_url || photo.url || '';
    const path = storagePathForBucket(originalUrl, SESSIONS_BUCKET);
    if (!path) return { ...photo, storage_url: originalUrl };
    const { data, error } = await createSignedUrlFromBucket(SESSIONS_BUCKET, path, 3600);
    if (error || !data?.signedUrl) {
      dwarn('Não foi possível assinar uma fotografia privada:', error?.message || path);
      return { ...photo, storage_url: originalUrl };
    }
    return { ...photo, storage_url: originalUrl, url: data.signedUrl };
  }));
}


function sessionStatusNormalizado(status) {
  return normalizeSessionStatus(status);
}

function renderSessionProgress(s) {
  const el = $('session-progress');
  if (!el) return;

  const status = sessionStatusNormalizado(s.status);
  const rank = {
    preparando: 0,
    aguardando_selecao: 0,
    selecao_finalizada: 1,
    em_edicao: 2,
    fotos_disponiveis: 3
  }[status] ?? 0;

  const steps = [
    { key: 'selecao', label: 'Seleção', detail: status === 'aguardando_selecao' ? 'Aguardando cliente' : 'Recebida' },
    { key: 'edicao', label: 'Edição', detail: status === 'em_edicao' ? 'Em andamento' : 'Tratamento' },
    { key: 'entrega', label: 'Entrega', detail: 'Fotos finais' }
  ];

  el.innerHTML = steps.map((step, index) => {
    const stepRank = index + 1;
    let state = 'pending';
    if (rank > stepRank) state = 'done';
    else if (rank === stepRank) state = 'active';

    if (index === 0) {
      state = ['selecao_finalizada', 'em_edicao', 'fotos_disponiveis'].includes(status)
        ? 'done'
        : 'active';
    }
    if (index === 1) {
      if (status === 'fotos_disponiveis') state = 'done';
      else if (status === 'em_edicao') state = 'active';
      else state = 'pending';
    }
    if (index === 2) {
      state = status === 'fotos_disponiveis' ? 'done' : 'pending';
    }

    return `
      <div class="session-progress-step ${state}">
        <span class="session-progress-dot">${state === 'done' ? '✓' : index + 1}</span>
        <span class="session-progress-text">
          <strong>${step.label}</strong>
          <small>${step.detail}</small>
        </span>
      </div>`;
  }).join('<span class="session-progress-line" aria-hidden="true"></span>');
}

function renderSessionEmailState(s) {
  const el = $('session-email-state');
  if (!el) return;

  const items = [];
  if (s.email_selecao_cliente_enviado_em) items.push('Cliente: seleção ✓');
  if (s.email_selecao_fotografo_enviado_em) items.push('Fotógrafo: seleção ✓');
  if (s.email_entrega_cliente_enviado_em) items.push('Cliente: entrega ✓');

  el.innerHTML = items.length
    ? items.map(t => `<span class="status-pill published">${esc(t)}</span>`).join('')
    : '<span class="status-pill draft">E-mails ainda não enviados</span>';
}

async function salvarEmailClienteEnsaio() {
  if (!currentSession) return;
  const input = $('session-client-email');
  const email = input.value.trim().toLowerCase();
  if (!emailValido(email)) {
    flash('Informe um e-mail válido para a cliente.', 'erro');
    input.focus();
    return;
  }

  const { data, error } = await updateSessionAndReturn(currentSession.id, { cliente_email: email });

  if (error) {
    flash(`Erro ao salvar e-mail: ${error.message}`, 'erro');
    return;
  }

  currentSession = data || { ...currentSession, cliente_email: email };
  const cacheIndex = sessionsCache.findIndex(s => s.id === currentSession.id);
  if (cacheIndex >= 0) sessionsCache[cacheIndex] = { ...sessionsCache[cacheIndex], ...currentSession };
  flash('E-mail da cliente atualizado.', 'sucesso');
  renderSessionDetail();
}

async function invocarNotificacaoEnsaio(action, extra = {}) {
  return notifySession(action, {
    sessionId: currentSession?.id,
    ...extra
  });
}

async function iniciarEdicao() {
  if (!currentSession) return;
  const provas = currentSessionPhotos.filter(photo => photo.tipo === 'prova');
  const selecionadas = provas.filter(photo => photo.selecionada);
  const liveNumbers = selecionadas.map(photo => numero(provas.indexOf(photo)));
  const storedNumbers = Array.isArray(currentSession.selected_photo_numbers)
    ? currentSession.selected_photo_numbers.map(value => String(value).padStart(4, '0'))
    : [];
  // A lista já gravada no momento da seleção é o histórico definitivo. Uma
  // leitura parcial das provas jamais pode encurtá-la.
  const numbers = storedNumbers.length >= liveNumbers.length ? storedNumbers : liveNumbers;

  if (!numbers.length) {
    flash('Não foi possível iniciar a edição porque nenhuma seleção guardada foi encontrada.', 'erro');
    return;
  }

  const divergence = storedNumbers.length && liveNumbers.length !== storedNumbers.length
    ? `\n\nA lista histórica possui ${storedNumbers.length} fotos e será preservada; ${liveNumbers.length} ainda aparecem marcadas entre as provas atuais.`
    : '';
  if (!confirm(`Iniciar edição e liberar armazenamento?\n\nOs ${numbers.length} números selecionados serão guardados, e ${provas.length} provas serão apagadas definitivamente.${divergence}`)) return;

  // Primeiro protege a lista histórica, sem mudar o estado do ensaio nem
  // afirmar que a limpeza terminou.
  const snapshot = await updateSessionAndReturn(currentSession.id, {
    selected_photo_numbers: numbers,
    selection_completed_at: currentSession.selection_completed_at || new Date().toISOString()
  });

  if (snapshot.error) {
    flash(`Erro ao guardar a seleção antes da limpeza: ${snapshot.error.message}`, 'erro');
    return;
  }

  currentSession = snapshot.data || { ...currentSession, selected_photo_numbers: numbers };
  flash(`Seleção protegida (${numbers.length} números). Removendo ${provas.length} provas...`, 'sucesso');

  const cleanup = await deleteSessionProofsWithAssets({
    photos: provas,
    session: currentSession,
    bucket: SESSIONS_BUCKET
  });
  if (cleanup.error) {
    flash(`A lista com ${numbers.length} fotos foi preservada, mas a limpeza não terminou (${cleanup.stage}): ${cleanup.error.message}. Você pode tentar novamente sem perder os números.`, 'erro');
    await loadSessionPhotos();
    renderSessionDetail();
    return;
  }

  const finalPayload = {
    status: 'em_edicao',
    selected_photo_numbers: numbers,
    selection_cleaned_at: new Date().toISOString()
  };
  if (cleanup.data.coverCleared) finalPayload.capa_foto_id = null;
  const finalized = await updateSessionAndReturn(currentSession.id, finalPayload);
  if (finalized.error) {
    flash(`As provas foram removidas e os ${numbers.length} números continuam guardados, mas o estado “Em edição” não pôde ser salvo: ${finalized.error.message}`, 'erro');
    return;
  }
  currentSession = finalized.data || { ...currentSession, ...finalPayload };
  await logAdminActivity('session_editing_started', `Edição iniciada para “${currentSession.titulo || currentSession.nome_cliente || 'ensaio'}”`, { detail: `${numbers.length} foto(s) escolhida(s); provas removidas do armazenamento.`, entityType: 'session', entityId: currentSession.id }).catch(() => {});
  flash(`Edição iniciada. ${cleanup.data.removedRecords} provas foram removidas e os ${numbers.length} números escolhidos ficaram guardados.`, 'sucesso');
  await loadSessionPhotos();
  await loadSessions();
  renderSessionDetail();
}

async function reenviarNotificacoesSelecao() {
  if (!currentSession) return;
  try {
    flash('Verificando notificações da seleção...', 'sucesso');
    const result = await invocarNotificacaoEnsaio('selection_finalized', {
      codigo: currentSession.codigo_acesso
    });
    if (result.ensaio) currentSession = { ...currentSession, ...result.ensaio };
    flash(result.message || 'Notificações verificadas.', 'sucesso');
    await loadSessions();
    renderSessionDetail();
  } catch (error) {
    flash(`Não foi possível enviar as notificações: ${error.message}`, 'erro');
  }
}


function setSessionStageOpen(stage, open) {
  if (!(stage in sessionStageOpen)) return;

  sessionStageOpen[stage] = Boolean(open);

  const section = document.querySelector(
    `.session-stage-accordion[data-session-stage="${stage}"]`
  );

  if (!section) return;

  const toggle = section.querySelector('.session-stage-toggle');
  const body = section.querySelector('.session-stage-body');

  section.classList.toggle('is-open', Boolean(open));

  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (body) {
    body.hidden = !open;
  }
}

function toggleSessionStage(stage) {
  setSessionStageOpen(stage, !sessionStageOpen[stage]);
}

function syncSessionStageAccordions() {
  setSessionStageOpen('provas', sessionStageOpen.provas);
  setSessionStageOpen('finais', sessionStageOpen.finais);
}

document.querySelectorAll('.session-stage-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const section = toggle.closest('[data-session-stage]');
    const stage = section?.dataset.sessionStage;

    if (stage) toggleSessionStage(stage);
  });
});


function renderSessionDetail() {
  if (!currentSession) return;
  renderSessionDetailUI({
    $, session: currentSession, photos: currentSessionPhotos,
    attr, esc, numero, msg, location,
    syncAccordions: syncSessionStageAccordions,
    configureOrdering: configurarOrdenacaoFotosEnsaio,
    withOperationLock,
    setCover: definirCapaEnsaio,
    deletePhoto: excluirFotoEnsaio,
    sendSelection: enviarParaSelecao,
    startEditing: iniciarEdicao,
    retrySelectionNotifications: reenviarNotificacoesSelecao,
    extendExpiry: estenderPrazoEnsaio
  });
  return;

}

async function estenderPrazoEnsaio(){if(!currentSession)return;const days=clampNumber(prompt('Quantos dias deseja acrescentar?', '30'),1,365,30);const base=currentSession.expires_at?new Date(currentSession.expires_at):new Date();base.setDate(base.getDate()+days);const {data,error}=await updateSessionAndReturn(currentSession.id,{expires_at:base.toISOString(),expired_at:null,deletion_scheduled_at:null});if(error)return flash(error.message,'erro');currentSession=data||{...currentSession,expires_at:base.toISOString()};flash(`Prazo estendido por ${days} dias.`,'sucesso');renderSessionDetail()}


function configurarOrdenacaoFotosEnsaio(grid) {
  if (!grid) return;

  let dragging = null;

  grid.querySelectorAll('.session-photo[data-session-photo-id]').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (
        e.target.closest('button') ||
        e.target.closest('a')
      ) {
        e.preventDefault();
        return;
      }

      dragging = card;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.sessionPhotoId);
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging || dragging === card) return;

      const rect = card.getBoundingClientRect();
      const after =
        e.clientY > rect.top + rect.height / 2 ||
        (
          Math.abs(e.clientY - (rect.top + rect.height / 2)) < rect.height * .35 &&
          e.clientX > rect.left + rect.width / 2
        );

      grid.insertBefore(dragging, after ? card.nextSibling : card);
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
    });

    card.addEventListener('dragend', async () => {
      card.classList.remove('is-dragging');
      grid.querySelectorAll('.session-photo').forEach(el => el.classList.remove('drag-over'));
      dragging = null;
      await salvarOrdemFotosEnsaio(grid);
    });
  });
}

async function salvarOrdemFotosEnsaio(grid) {
  if (!currentSession || !grid) return;

  const ids = [...grid.querySelectorAll('.session-photo[data-session-photo-id]')]
    .map(el => el.dataset.sessionPhotoId);

  if (!ids.length) return;

  const results = await Promise.all(
    ids.map((id, index) =>
      updateSessionPhoto(id, { ordem: index }, currentSession.id)
    )
  );

  const failed = results.find(r => r.error);

  if (failed) {
    flash(`Erro ao salvar a nova ordem: ${failed.error.message}`, 'erro');
    await loadSessionPhotos();
    return;
  }

  // Atualiza os números sem recarregar o modal inteiro.
  grid.querySelectorAll('.session-photo[data-session-photo-id]').forEach((el, index) => {
    const order = el.querySelector('.photo-order');
    if (order) order.textContent = numero(index);
  });

  await loadSessionPhotos();
  await loadSessions();
  flash('Ordem das fotografias atualizada.', 'sucesso');
}

async function definirCapaEnsaio(id) {
  if (!currentSession) return;

  const foto = currentSessionPhotos.find(f => f.id === id);
  if (!foto) {
    flash('Fotografia não encontrada.', 'erro');
    return;
  }

  const { data, error } = await updateSessionAndReturn(currentSession.id, { capa_foto_id: id });

  if (error) {
    const columnMissing =
      /capa_foto_id|column .* does not exist|schema cache/i.test(error.message || '');

    if (columnMissing) {
      flash('Falta ativar a coluna de capa dos ensaios no Supabase. Execute o arquivo SQL incluído neste pacote.', 'erro');
      return;
    }

    flash(`Erro ao definir capa: ${error.message}`, 'erro');
    return;
  }

  currentSession = data || { ...currentSession, capa_foto_id: id };

  flash('Capa do ensaio atualizada.', 'sucesso');
  renderSessionDetail();
  await loadSessions();
}

async function excluirFotoEnsaio(id) {
  if (!currentSession) return;
  const photo = currentSessionPhotos.find(item => item.id === id);
  if (!photo) {
    flash('Fotografia não encontrada.', 'erro');
    return;
  }
  if (!confirm('Excluir esta prova?\n\nEsta ação remove a fotografia do ensaio e não pode ser desfeita.')) return;

  flash('Excluindo fotografia...', 'erro');
  const result = await deleteSessionPhotoWithAsset({
    photo,
    session: currentSession,
    bucket: SESSIONS_BUCKET
  });
  if (result.error) {
    flash(`Erro ao excluir ${result.stage === 'storage' ? 'arquivo' : 'registro'}: ${result.error.message}`, 'erro');
    return;
  }
  if (result.data.coverCleared) currentSession.capa_foto_id = null;
  flash('Fotografia excluída.', 'sucesso');
  await loadSessionPhotos();
}

async function uploadSessionPhotos(files, tipo) {
  if (!currentSession) return;

  const msgEl = $('session-msg');
  const { validos, rejeitados } = validarImagens(files);

  if (rejeitados.length) {
    msg(msgEl, rejeitados.join(' · '), 'erro');
  }

  if (!validos.length) return;

  return withOperationLock(
    `session-upload:${currentSession.id}:${tipo}`,
    async () => {
      msg(
        msgEl,
        `Enviando ${validos.length} foto(s) e numerando automaticamente...`
      );

      const existentes = currentSessionPhotos
        .filter(f => f.tipo === tipo)
        .slice()
        .sort(
          (a, b) =>
            Number(a.ordem ?? 999999) -
            Number(b.ordem ?? 999999)
        );

      // O número exibido independe completamente do nome original do arquivo.
      // Pedro.jpg, IMG_1234.jpg ou qualquer outro nome vira 0001, 0002...
      let nextOrder = existentes.length
        ? Math.max(
            ...existentes.map(
              (foto, index) =>
                Number.isFinite(Number(foto.ordem))
                  ? Number(foto.ordem)
                  : index
            )
          ) + 1
        : 0;

      let enviados = 0;

      for (const file of validos) {
        const ext =
          file.type === 'image/png'
            ? 'png'
            : file.type === 'image/webp'
              ? 'webp'
              : 'jpg';

        const displayNumber =
          String(nextOrder + 1).padStart(4, '0');

        // Até o nome interno no Storage passa a começar pelo número lógico.
        // O UUID evita colisões caso uma fotografia seja excluída e reenviada.
        const path =
          `${currentSession.id}/${tipo}/${displayNumber}-${crypto.randomUUID()}.${ext}`;

        const result = await uploadSessionPhoto({
          bucket: SESSIONS_BUCKET,
          path,
          file,
          sessionId: currentSession.id,
          type: tipo,
          sortOrder: nextOrder
        });

        if (result.error) {
          msg(
            msgEl,
            `${result.stage === 'upload' ? 'Erro ao enviar' : 'Erro ao registrar'} ${displayNumber}: ${result.error.message}`,
            'erro'
          );
          continue;
        }

        nextOrder += 1;
        enviados += 1;
      }

      if (enviados) {
        msg(
          msgEl,
          `${enviados} foto(s) enviada(s). Numeração automática aplicada.`,
          'sucesso'
        );
      }

      await loadSessionPhotos();
    }
  );
}

async function enviarParaSelecao() {
  if (!currentSession) return;
  const msgEl = $('session-msg');
  const { error } = await updateSession(currentSession.id, { status: 'aguardando_selecao' });
  if (error) {
    msgEl.textContent = 'Erro: ' + error.message;
    msgEl.className = 'msg erro';
    return;
  }
  currentSession.status = 'aguardando_selecao';
  msgEl.textContent = 'Fotos enviadas para seleção! A cliente já pode acessar.';
  msgEl.className = 'msg sucesso';
  await loadSessions();
  renderSessionDetail();
}

async function marcarEntregue() {
  if (!currentSession) return;
  const msgEl = $('session-msg');
  const statusAtual = sessionStatusNormalizado(currentSession.status);

  if (statusAtual !== 'em_edicao' && statusAtual !== 'fotos_disponiveis') {
    msgEl.textContent = 'Primeiro marque o ensaio como “Em edição”.';
    msgEl.className = 'msg erro';
    return;
  }

  try {
    msgEl.textContent = statusAtual === 'fotos_disponiveis'
      ? 'Reenviando e-mail de entrega...'
      : 'Publicando fotos finais e notificando a cliente...';
    msgEl.className = 'msg';

    const result = await invocarNotificacaoEnsaio('publish_final');

    if (result.ensaio) currentSession = { ...currentSession, ...result.ensaio };
    else currentSession.status = 'fotos_disponiveis';

    await logAdminActivity('session_delivered', `Ensaio “${currentSession.titulo || currentSession.nome_cliente || 'ensaio'}” entregue`, { detail: 'Prazo de 30 dias iniciado.', entityType: 'session', entityId: currentSession.id }).catch(() => {});

    msgEl.textContent = result.email_sent === false
      ? (result.message || 'Fotos publicadas. O e-mail não foi enviado; verifique o e-mail da cliente e a configuração do serviço.')
      : (result.message || 'Fotos publicadas e cliente notificada por e-mail!');
    msgEl.className = result.email_sent === false ? 'msg erro' : 'msg sucesso';

    await loadSessions();
    renderSessionDetail();
  } catch (error) {
    msgEl.textContent = 'Não foi possível publicar: ' + error.message;
    msgEl.className = 'msg erro';
  }
}

async function excluirSession(id) {
  const session = sessionsCache.find(item => item.id === id);
  if (!session) return;
  if (!confirm(`Tem certeza que quer excluir "${session.titulo}"?\n\nIsso apaga TODAS as fotos e dados desse ensaio para sempre. Não tem como desfazer.`)) return;

  flash('Excluindo...', 'erro');
  const result = await deleteSessionWithAssets({ sessionId: id, bucket: SESSIONS_BUCKET });
  if (result.error) {
    flash(`Erro ao excluir: ${result.error.message}`, 'erro');
    return;
  }
  flash('Ensaio excluído.', 'sucesso');
  closeSessionModal();
  await loadSessions();
}

function copySession() {
  if (!currentSession) return;
  const texto = `Acesse em: ${location.origin}/area-cliente\nLogin: ${currentSession.slug}\nSenha: ${currentSession.codigo_acesso}`;
  const btn = $('btn-copy-session');
  navigator.clipboard.writeText(texto).then(() => {
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar tudo'; }, 1500);
  }).catch(() => {
    flash('Não foi possível copiar automaticamente. Selecione login e senha manualmente.', 'erro');
  });
}

$('new-session-btn').addEventListener('click', openSessionForm);
$('close-session-form').addEventListener('click', closeSessionForm);
$('cancel-session-form').addEventListener('click', closeSessionForm);
$('session-form').addEventListener('submit', saveSession);
$('btn-gerar-login').addEventListener('click', () => { $('session-login').value = 'cliente-' + Math.random().toString(36).slice(2, 8); });
$('btn-gerar-codigo').addEventListener('click', () => { $('session-codigo').value = Math.random().toString(36).slice(2, 8).toUpperCase(); });
$('btn-copy-session').addEventListener('click', copySession);
$('btn-save-session-email').addEventListener('click', () => withOperationLock('save-session-email:' + (currentSession?.id || ''), salvarEmailClienteEnsaio));
$('btn-entregar').addEventListener('click', () => withOperationLock('entregar:' + (currentSession?.id || ''), marcarEntregue));
$('btn-excluir-session').addEventListener('click', () => withOperationLock('delete-session:' + (currentSession?.id || ''), () => excluirSession(currentSession && currentSession.id)));
$('upload-prova').addEventListener('change', async e => {
  const f = [...e.target.files];
  if (f.length && currentSession) await uploadSessionPhotos(f, 'prova');
  e.target.value = '';
});
$('upload-final').addEventListener('change', async e => {
  const f = [...e.target.files];
  if (f.length && currentSession) await uploadSessionPhotos(f, 'final');
  e.target.value = '';
});
document.querySelectorAll('[data-close-session-modal]').forEach(e => e.addEventListener('click', closeSessionModal));


/* =========================================================
   DESIGN STUDIO — PREVIA FIEL (BUILD V24)
   O iframe usa um viewport real de 1920x1080 ou 390x844 e é
   apenas escalado visualmente para caber no painel do CMS.
   ========================================================= */
let designDraftSaved = null;
let designPublishedSaved = null;
let designDraftUpdatedAt = null;
let designPublishedUpdatedAt = null;
let designPersistenceLoaded = false;
let designPersistenceLoading = null;

let designPreviewDevice = 'desktop';
let designPreviewResizeObserver = null;

const DESIGN_VIEWPORTS = {
  desktop: { width: 1920, height: 1080, label: 'Computador · 1920 × 1080' },
  mobile: { width: 390, height: 844, label: 'Celular · 390 × 844' }
};


const DESIGN_DEFAULTS = Object.freeze({
  nav_style: 'auto',
  nav_position: 'fixed',
  nav_density: 'normal',
  logo_scale: 100,
  nav_cta: 'outline',
  nav_blur: 0,
  page_animation: 'none',
  section_animation: 'none',
  image_hover: 'site',
  motion_speed: 'normal',
  type_scale: 100,
  whatsapp_enabled: true,
  whatsapp_number: '',
  whatsapp_message: 'Olá, Rangel. Vim pelo seu site e gostaria de saber mais sobre uma sessão fotográfica.',
  whatsapp_position: 'right',
  whatsapp_style: 'editorial',
  whatsapp_pages: ['inicio','galeria','sobre','contato'],
  inline_styles: {},
  content_width: 1200,
  section_space: 120,
  hero_overlay: 40,
  gallery_gap: 2,
  image_radius: 0,
  client_layout: 'editorial-split',
  client_gallery_style: 'editorial',
  client_photo_size: 'large',
  client_typography: 'classic',
  client_border: 'fine',
  client_access_image: '',
  client_focus_x: 50,
  client_focus_y: 50,
  client_text_visual: 'Retratos guardados com cuidado.\nUm espaço reservado só para você.',
  client_text_eyebrow: 'Área privada',
  client_text_title: 'Sua sessão,',
  client_text_title_emphasis: 'em um espaço só seu.',
  client_text_description: 'Acesse sua galeria para selecionar fotografias, acompanhar a edição e receber seus arquivos finais.',
  client_text_login: 'Login',
  client_text_password: 'Senha',
  client_text_button: 'Acessar minha galeria',
  client_text_secure: 'Acesso privado e protegido',
  client_text_gallery_eyebrow: 'Sua experiência',
  client_stage_selection: 'Seleção',
  client_stage_selection_sub: 'Escolha',
  client_stage_editing: 'Edição',
  client_stage_editing_sub: 'Tratamento',
  client_stage_delivery: 'Entrega',
  client_stage_delivery_sub: 'Final',
  client_status_preparing: 'Suas fotos estão sendo preparadas',
  client_status_awaiting: 'Escolha suas fotos favoritas',
  client_status_selected: 'Seleção enviada — aguardando edição',
  client_status_editing: 'Suas fotografias estão em edição',
  client_status_ready: 'Suas fotos estão prontas!',
  content: null
});

function repairPersistedHeroTitle(content) {
  if (
    !content ||
    typeof content !== 'object'
  ) {
    return content;
  }

  const cloned =
    JSON.parse(
      JSON.stringify(content)
    );

  const title =
    cloned?.inicio?.hero?.title;

  if (
    typeof title === 'string' &&
    /\bcomosempre\b/i.test(title)
  ) {
    cloned.inicio.hero.title =
      title.replace(
        /\bcomosempre\b/gi,
        'como sempre'
      );

    dwarn(
      '[admin-v2] rascunho antigo: “comosempre” reparado para “como sempre”.'
    );
  }

  return cloned;
}

function normalizeDesignConfig(config = {}) {
  const c = { ...DESIGN_DEFAULTS, ...(config || {}) };

  const repairedContent =
    repairPersistedHeroTitle(
      c.content
    );

  return {
    nav_style: ['auto','transparent','solid'].includes(c.nav_style) ? c.nav_style : 'auto',
    nav_position: ['fixed','static'].includes(c.nav_position) ? c.nav_position : 'fixed',
    nav_density: ['compact','normal','airy'].includes(c.nav_density) ? c.nav_density : 'normal',
    logo_scale: clampNumber(c.logo_scale, 85, 120, 100),
    nav_cta: ['outline','filled','hidden'].includes(c.nav_cta) ? c.nav_cta : 'outline',
    nav_blur: clampNumber(c.nav_blur, 0, 18, 0),
    page_animation: ['none','fade','fade-up','soft'].includes(c.page_animation) ? c.page_animation : 'none',
    section_animation: ['none','fade','fade-up'].includes(c.section_animation) ? c.section_animation : 'none',
    image_hover: ['site','none','zoom','lift'].includes(c.image_hover) ? c.image_hover : 'site',
    motion_speed: ['fast','normal','slow'].includes(c.motion_speed) ? c.motion_speed : 'normal',
    type_scale: clampNumber(c.type_scale, 90, 115, 100),
    content_width: clampNumber(c.content_width, 1040, 1500, 1200),
    section_space: clampNumber(c.section_space, 72, 160, 120),
    hero_overlay: clampNumber(c.hero_overlay, 0, 70, 40),
    gallery_gap: clampNumber(c.gallery_gap, 0, 16, 2),
    image_radius: clampNumber(c.image_radius, 0, 18, 0),
    client_layout: ['editorial-split','centered','fullscreen'].includes(c.client_layout) ? c.client_layout : 'editorial-split',
    client_gallery_style: ['editorial','clean','masonry'].includes(c.client_gallery_style) ? c.client_gallery_style : 'editorial',
    client_photo_size: ['compact','medium','large'].includes(c.client_photo_size) ? c.client_photo_size : 'large',
    client_typography: ['classic','editorial','minimal'].includes(c.client_typography) ? c.client_typography : 'classic',
    client_border: ['fine','none','soft'].includes(c.client_border) ? c.client_border : 'fine',
    client_access_image: safeHttpUrl(c.client_access_image || '', { allowRelative: true }),
    client_focus_x: clampNumber(c.client_focus_x, 0, 100, 50),
    client_focus_y: clampNumber(c.client_focus_y, 0, 100, 50),
    client_text_visual: safeText(c.client_text_visual, 240) || DESIGN_DEFAULTS.client_text_visual,
    client_text_eyebrow: safeText(c.client_text_eyebrow, 80) || DESIGN_DEFAULTS.client_text_eyebrow,
    client_text_title: safeText(c.client_text_title, 120) || DESIGN_DEFAULTS.client_text_title,
    client_text_title_emphasis: safeText(c.client_text_title_emphasis, 120) || DESIGN_DEFAULTS.client_text_title_emphasis,
    client_text_description: safeText(c.client_text_description, 600) || DESIGN_DEFAULTS.client_text_description,
    client_text_login: safeText(c.client_text_login, 60) || DESIGN_DEFAULTS.client_text_login,
    client_text_password: safeText(c.client_text_password, 60) || DESIGN_DEFAULTS.client_text_password,
    client_text_button: safeText(c.client_text_button, 80) || DESIGN_DEFAULTS.client_text_button,
    client_text_secure: safeText(c.client_text_secure, 120) || DESIGN_DEFAULTS.client_text_secure,
    client_text_gallery_eyebrow: safeText(c.client_text_gallery_eyebrow, 100) || DESIGN_DEFAULTS.client_text_gallery_eyebrow,
    client_stage_selection: safeText(c.client_stage_selection, 60) || DESIGN_DEFAULTS.client_stage_selection,
    client_stage_selection_sub: safeText(c.client_stage_selection_sub, 60) || DESIGN_DEFAULTS.client_stage_selection_sub,
    client_stage_editing: safeText(c.client_stage_editing, 60) || DESIGN_DEFAULTS.client_stage_editing,
    client_stage_editing_sub: safeText(c.client_stage_editing_sub, 60) || DESIGN_DEFAULTS.client_stage_editing_sub,
    client_stage_delivery: safeText(c.client_stage_delivery, 60) || DESIGN_DEFAULTS.client_stage_delivery,
    client_stage_delivery_sub: safeText(c.client_stage_delivery_sub, 60) || DESIGN_DEFAULTS.client_stage_delivery_sub,
    client_status_preparing: safeText(c.client_status_preparing, 140) || DESIGN_DEFAULTS.client_status_preparing,
    client_status_awaiting: safeText(c.client_status_awaiting, 140) || DESIGN_DEFAULTS.client_status_awaiting,
    client_status_selected: safeText(c.client_status_selected, 160) || DESIGN_DEFAULTS.client_status_selected,
    client_status_editing: safeText(c.client_status_editing, 140) || DESIGN_DEFAULTS.client_status_editing,
    client_status_ready: safeText(c.client_status_ready, 140) || DESIGN_DEFAULTS.client_status_ready,
    whatsapp_enabled: c.whatsapp_enabled !== false,
    whatsapp_number: safeText(c.whatsapp_number, 20).replace(/\D/g,''),
    whatsapp_message: safeText(c.whatsapp_message, 500) || 'Olá, Rangel. Vim pelo seu site e gostaria de saber mais sobre uma sessão fotográfica.',
    whatsapp_position: c.whatsapp_position === 'left' ? 'left' : 'right',
    whatsapp_style: ['editorial','minimal','classic'].includes(c.whatsapp_style) ? c.whatsapp_style : 'editorial',
    whatsapp_pages: Array.isArray(c.whatsapp_pages) ? c.whatsapp_pages.filter(x => ['inicio','galeria','sobre','contato'].includes(x)) : ['inicio','galeria','sobre','contato'],
    inline_styles: c.inline_styles && typeof c.inline_styles === 'object' ? JSON.parse(JSON.stringify(c.inline_styles)) : {},
    content:
      repairedContent &&
      typeof repairedContent === 'object'
        ? repairedContent
        : null
  };
}


function collectHeroContentPayload(){
  const mode=document.querySelector('input[name="hero-mode"]:checked')?.value||'static';
  const desktopRaw=safeText($('hero-desktop-image')?.value,2048), mobileRaw=safeText($('hero-mobile-image')?.value,2048);
  const meta=($('hero-meta')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12).map(line=>{const i=line.indexOf('|');return i<0?{label:safeText(line,80),value:''}:{label:safeText(line.slice(0,i),80),value:safeText(line.slice(i+1),160)}});
  /*
    Eyebrow, título e descrição vêm do motor genérico (cmsFieldGet),
    não de reler $('id').value diretamente — ver o bloco "MOTOR
    GENÉRICO DE CAMPOS DO CMS" no topo do arquivo. safeText() faz
    apenas trim() nas pontas, então a quebra de linha interna (\n)
    criada pelo editor visual do título é preservada.
  */
  return {eyebrow:safeText(cmsFieldGet('inicio.hero.eyebrow',$('hero-eyebrow')?.value??''),120),title:safeText(cmsFieldGet('inicio.hero.title',$('hero-title')?.value??''),180),description:safeText(cmsFieldGet('inicio.hero.description',$('hero-description')?.value??''),1000),desktop_image:desktopRaw?safeHttpUrl(desktopRaw,{allowRelative:true}):'',mobile_image:mobileRaw?safeHttpUrl(mobileRaw,{allowRelative:true}):'',image_alt:safeText($('hero-image-alt')?.value,240),mode,static_focus_x:clampNumber($('hero-static-focus-x')?.value,0,100,50),static_focus_y:clampNumber($('hero-static-focus-y')?.value,0,100,50),static_mobile_focus_x:clampNumber($('hero-static-mobile-focus-x')?.value,0,100,50),static_mobile_focus_y:clampNumber($('hero-static-mobile-focus-y')?.value,0,100,50),slide_interval:clampNumber($('hero-slide-interval')?.value,2,30,5),slide_transition:clampNumber($('hero-slide-transition')?.value,.3,5,1.2),slide_width:$('hero-slide-width')?.value||HERO_SLIDESHOW_DEFAULTS.width,slide_fit:$('hero-slide-fit')?.value||HERO_SLIDESHOW_DEFAULTS.fit,slide_ratio:$('hero-slide-ratio')?.value||HERO_SLIDESHOW_DEFAULTS.ratio,slide_animation:$('hero-slide-animation')?.value||HERO_SLIDESHOW_DEFAULTS.animation,slide_order:$('hero-slide-order')?.value||HERO_SLIDESHOW_DEFAULTS.order,slide_behind_menu:$('hero-slide-behind-menu')?.value!=='no',slides:heroSlidesDraft.slice(0,30).map((s,index)=>({id:safeText(s.id,120),url:safeHttpUrl(s.url,{allowRelative:true}),alt:safeText(s.alt,240),focus_x:clampNumber(s.focus_x,0,100,50),focus_y:clampNumber(s.focus_y,0,100,50),published:s.published!==false,sort_order:index})).filter(s=>s.url),primary_button:{text:safeText($('hero-primary-text')?.value,80),url:safeHttpUrl($('hero-primary-url')?.value)||'/galeria'},secondary_button:{text:safeText($('hero-secondary-text')?.value,80),url:safeHttpUrl($('hero-secondary-url')?.value)||'/contato'},meta};
}
function collectRecentContentPayload(){return {eyebrow:safeText($('recent-eyebrow')?.value,120),title:safeText($('recent-title')?.value,180),gallery_limit:clampNumber($('recent-limit')?.value,1,24,6),button:{text:safeText($('recent-btn-text')?.value,80),url:safeHttpUrl($('recent-btn-url')?.value)||'/galeria'}}}
function collectSobreContentPayload(){return {eyebrow:safeText($('sobre-eyebrow')?.value,120),paragraphs:($('sobre-paragraphs')?.value||'').split('\n').map(x=>safeText(x,1000)).filter(Boolean).slice(0,20),specs:collectSpecs().slice(0,20).map(s=>({label:safeText(s.label,80),value:safeText(s.value,160)})),portrait_url:safeHttpUrl($('sobre-portrait-url')?.value||''),portrait_alt:safeText($('sobre-portrait-alt')?.value,240),cta_text:safeText($('sobre-cta-text')?.value,80),cta_url:safeHttpUrl($('sobre-cta-url')?.value)||'/contato'}}
function collectContatoContentPayload(){return {eyebrow:safeText($('contato-eyebrow')?.value,120),title:safeText($('contato-title')?.value,180),submit_label:safeText($('contato-submit-label')?.value,80),tipos:($('contato-tipos')?.value||'').split('\n').map(x=>safeText(x,160)).filter(Boolean).slice(0,30),atendimento:safeText($('contato-atendimento')?.value,1000)}}
function collectDesignContentSnapshot(){return {inicio:{hero:collectHeroContentPayload(),recent_work:collectRecentContentPayload()},sobre:{conteudo:collectSobreContentPayload()},contato:{conteudo:collectContatoContentPayload()},galeria:{trail_edits:JSON.parse(JSON.stringify(trailDraftEdits))}}}
function applyDesignContentSnapshotToControls(s){if(!s)return;trailDraftEdits=s.galeria?.trail_edits&&typeof s.galeria.trail_edits==='object'?JSON.parse(JSON.stringify(s.galeria.trail_edits)):{};const h=s.inicio?.hero;if(h){cmsFieldSet('inicio.hero.eyebrow',h.eyebrow||'');cmsFieldSet('inicio.hero.title',h.title||'');cmsFieldSet('inicio.hero.description',h.description||'');$('hero-desktop-image').value=h.desktop_image||'';$('hero-mobile-image').value=h.mobile_image||'';$('hero-image-alt').value=h.image_alt||'';const mode=h.mode==='slideshow'?'slideshow':'static';$('hero-mode-static').checked=mode==='static';$('hero-mode-slideshow').checked=mode==='slideshow';$('hero-static-focus-x').value=Number(h.static_focus_x??50);$('hero-static-focus-y').value=Number(h.static_focus_y??50);$('hero-static-mobile-focus-x').value=Number(h.static_mobile_focus_x??h.static_focus_x??50);$('hero-static-mobile-focus-y').value=Number(h.static_mobile_focus_y??h.static_focus_y??50);$('hero-slide-interval').value=Number(h.slide_interval??5);$('hero-slide-transition').value=Number(h.slide_transition??1.2);$('hero-slide-width').value=h.slide_width||HERO_SLIDESHOW_DEFAULTS.width;$('hero-slide-fit').value=h.slide_fit||HERO_SLIDESHOW_DEFAULTS.fit;$('hero-slide-ratio').value=h.slide_ratio||HERO_SLIDESHOW_DEFAULTS.ratio;$('hero-slide-animation').value=h.slide_animation||HERO_SLIDESHOW_DEFAULTS.animation;$('hero-slide-order').value=h.slide_order||HERO_SLIDESHOW_DEFAULTS.order;$('hero-slide-behind-menu').value=h.slide_behind_menu===false?'no':'yes';heroSlidesDraft=Array.isArray(h.slides)?h.slides.map((x,i)=>({id:x.id||`slide-${Date.now()}-${i}`,url:x.url||'',alt:x.alt||'',focus_x:Number(x.focus_x??50),focus_y:Number(x.focus_y??50),published:x.published!==false})).filter(x=>x.url):[];$('hero-primary-text').value=h.primary_button?.text||'';$('hero-primary-url').value=h.primary_button?.url||'';$('hero-secondary-text').value=h.secondary_button?.text||'';$('hero-secondary-url').value=h.secondary_button?.url||'';$('hero-meta').value=(h.meta||[]).map(x=>`${x.label} | ${x.value}`).join('\n');updateHeroModeUI();updateStaticFocalPreview();renderHeroSlidesAdmin();renderHeroSlideshowOverview()}
  const r=s.inicio?.recent_work;if(r){$('recent-eyebrow').value=r.eyebrow||'';$('recent-title').value=r.title||'';$('recent-limit').value=r.gallery_limit??6;$('recent-btn-text').value=r.button?.text||'';$('recent-btn-url').value=r.button?.url||''}
  const so=s.sobre?.conteudo;if(so){$('sobre-eyebrow').value=so.eyebrow||'';$('sobre-paragraphs').value=(so.paragraphs||[]).join('\n');$('sobre-portrait-url').value=so.portrait_url||'';$('sobre-portrait-alt').value=so.portrait_alt||'';$('sobre-cta-text').value=so.cta_text||'';$('sobre-cta-url').value=so.cta_url||'';renderSpecsEditor(so.specs||[])}
  const ct=s.contato?.conteudo;if(ct){$('contato-eyebrow').value=ct.eyebrow||'';$('contato-title').value=ct.title||'';$('contato-submit-label').value=ct.submit_label||'';$('contato-tipos').value=(ct.tipos||[]).join('\n');$('contato-atendimento').value=ct.atendimento||''}}
function collectDesignConfig() {
  return normalizeDesignConfig({
    nav_style: $('design-nav-style')?.value,
    nav_position: $('design-nav-position')?.value,
    nav_density: $('design-nav-density')?.value,
    logo_scale: $('design-logo-scale')?.value,
    nav_cta: $('design-nav-cta')?.value,
    nav_blur: $('design-nav-blur')?.value,
    page_animation: $('design-page-animation')?.value,
    section_animation: $('design-section-animation')?.value,
    image_hover: $('design-image-hover')?.value,
    motion_speed: $('design-motion-speed')?.value,
    type_scale: $('design-type-scale')?.value,
    content_width: $('design-content-width')?.value,
    section_space: $('design-section-space')?.value,
    hero_overlay: $('design-hero-overlay')?.value,
    gallery_gap: $('design-gallery-gap')?.value,
    image_radius: $('design-image-radius')?.value,
    client_layout: $('design-client-layout')?.value,
    client_gallery_style: $('design-client-gallery-style')?.value,
    client_photo_size: $('design-client-photo-size')?.value,
    client_typography: $('design-client-typography')?.value,
    client_border: $('design-client-border')?.value,
    client_access_image: $('design-client-access-image')?.value,
    client_focus_x: $('design-client-focus-x')?.value,
    client_focus_y: $('design-client-focus-y')?.value,
    client_text_visual: $('design-client-text-visual')?.value,
    client_text_eyebrow: $('design-client-text-eyebrow')?.value,
    client_text_title: $('design-client-text-title')?.value,
    client_text_title_emphasis: $('design-client-text-title-emphasis')?.value,
    client_text_description: $('design-client-text-description')?.value,
    client_text_login: $('design-client-text-login')?.value,
    client_text_password: $('design-client-text-password')?.value,
    client_text_button: $('design-client-text-button')?.value,
    client_text_secure: $('design-client-text-secure')?.value,
    client_text_gallery_eyebrow: $('design-client-text-gallery-eyebrow')?.value,
    client_stage_selection: $('design-client-stage-selection')?.value,
    client_stage_selection_sub: $('design-client-stage-selection-sub')?.value,
    client_stage_editing: $('design-client-stage-editing')?.value,
    client_stage_editing_sub: $('design-client-stage-editing-sub')?.value,
    client_stage_delivery: $('design-client-stage-delivery')?.value,
    client_stage_delivery_sub: $('design-client-stage-delivery-sub')?.value,
    client_status_preparing: $('design-client-status-preparing')?.value,
    client_status_awaiting: $('design-client-status-awaiting')?.value,
    client_status_selected: $('design-client-status-selected')?.value,
    client_status_editing: $('design-client-status-editing')?.value,
    client_status_ready: $('design-client-status-ready')?.value,
    /*
      Campos de texto/seleção do WhatsApp migrados para o motor
      genérico (cmsFieldGet) — mesma lógica usada no hero-title,
      com fallback pro DOM caso o campo ainda não esteja ligado.
      As 4 caixas de "mostrar nas páginas" continuam lidas direto
      do DOM: são checkboxes simples, sem o problema de perda de
      valor que o motor foi criado para resolver.
    */
    whatsapp_enabled: cmsFieldGet('design.whatsapp.enabled', $('design-whatsapp-enabled')?.checked) !== false,
    whatsapp_number: (cmsFieldGet('design.whatsapp.number', $('design-whatsapp-number')?.value || '') || '').replace(/\D/g,''),
    whatsapp_message: cmsFieldGet('design.whatsapp.message', $('design-whatsapp-message')?.value || ''),
    whatsapp_position: cmsFieldGet('design.whatsapp.position', $('design-whatsapp-position')?.value || 'right'),
    whatsapp_style: cmsFieldGet('design.whatsapp.style', $('design-whatsapp-style')?.value || 'editorial'),
    whatsapp_pages: ['inicio','galeria','sobre','contato'].filter(p => $('design-whatsapp-page-' + p)?.checked),
    inline_styles: window.__designInlineStyles || {},
    content: collectDesignContentSnapshot()
  });
}

function designFingerprint(config) {
  return JSON.stringify(normalizeDesignConfig(config));
}

function applyDesignConfigToControls(config) {
  const c = normalizeDesignConfig(config);
  const map = {
    'design-nav-style': c.nav_style,
    'design-nav-position': c.nav_position,
    'design-nav-density': c.nav_density,
    'design-logo-scale': c.logo_scale,
    'design-nav-cta': c.nav_cta,
    'design-nav-blur': c.nav_blur,
    'design-page-animation': c.page_animation,
    'design-section-animation': c.section_animation,
    'design-image-hover': c.image_hover,
    'design-motion-speed': c.motion_speed,
    'design-type-scale': c.type_scale,
    'design-content-width': c.content_width,
    'design-section-space': c.section_space,
    'design-hero-overlay': c.hero_overlay,
    'design-gallery-gap': c.gallery_gap,
    'design-image-radius': c.image_radius,
    'design-client-layout': c.client_layout,
    'design-client-gallery-style': c.client_gallery_style,
    'design-client-photo-size': c.client_photo_size,
    'design-client-typography': c.client_typography,
    'design-client-border': c.client_border,
    'design-client-access-image': c.client_access_image,
    'design-client-focus-x': c.client_focus_x,
    'design-client-focus-y': c.client_focus_y,
    'design-client-text-visual': c.client_text_visual,
    'design-client-text-eyebrow': c.client_text_eyebrow,
    'design-client-text-title': c.client_text_title,
    'design-client-text-title-emphasis': c.client_text_title_emphasis,
    'design-client-text-description': c.client_text_description,
    'design-client-text-login': c.client_text_login,
    'design-client-text-password': c.client_text_password,
    'design-client-text-button': c.client_text_button,
    'design-client-text-secure': c.client_text_secure,
    'design-client-text-gallery-eyebrow': c.client_text_gallery_eyebrow,
    'design-client-stage-selection': c.client_stage_selection,
    'design-client-stage-selection-sub': c.client_stage_selection_sub,
    'design-client-stage-editing': c.client_stage_editing,
    'design-client-stage-editing-sub': c.client_stage_editing_sub,
    'design-client-stage-delivery': c.client_stage_delivery,
    'design-client-stage-delivery-sub': c.client_stage_delivery_sub,
    'design-client-status-preparing': c.client_status_preparing,
    'design-client-status-awaiting': c.client_status_awaiting,
    'design-client-status-selected': c.client_status_selected,
    'design-client-status-editing': c.client_status_editing,
    'design-client-status-ready': c.client_status_ready
  };
  Object.entries(map).forEach(([id, value]) => {
    if ($(id)) $(id).value = String(value);
  });
  cmsFieldSet('design.whatsapp.enabled', c.whatsapp_enabled !== false);
  cmsFieldSet('design.whatsapp.number', c.whatsapp_number || '');
  cmsFieldSet('design.whatsapp.message', c.whatsapp_message || '');
  cmsFieldSet('design.whatsapp.position', c.whatsapp_position || 'right');
  cmsFieldSet('design.whatsapp.style', c.whatsapp_style || 'editorial');
  ['inicio','galeria','sobre','contato'].forEach(p => { const el=$('design-whatsapp-page-'+p); if(el) el.checked=(c.whatsapp_pages||[]).includes(p); });
  window.__designInlineStyles = JSON.parse(JSON.stringify(c.inline_styles || {}));
  if (c.content) applyDesignContentSnapshotToControls(c.content);
  updateDesignClientImagePreview();
  applyDesignPreview();
  applyDesignContentPreview();

      requestAnimationFrame(() => {
        applyDesignContentPreview();
      });
  updateDesignPublicationState();
}

function formatDesignTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function updateDesignPublicationState() {
  const current = collectDesignConfig();
  const currentFp = designFingerprint(current);
  const publishedFp = designFingerprint(designPublishedSaved || DESIGN_DEFAULTS);
  const draftFp = designDraftSaved ? designFingerprint(designDraftSaved) : '';

  let state = 'published';
  let label = 'PUBLICADO';
  let copy = 'A prévia corresponde à versão que está atualmente no site.';

  if (currentFp !== publishedFp) {
    if (draftFp && currentFp === draftFp) {
      state = 'draft';
      label = 'RASCUNHO SALVO';
      copy = 'Este rascunho está salvo, mas ainda não foi publicado no site.';
    } else {
      state = 'dirty';
      label = 'ALTERAÇÕES NÃO PUBLICADAS';
      copy = 'Existem alterações na prévia que ainda não foram salvas nem publicadas.';
    }
  }

  const status = $('design-publication-status');
  if (status) status.dataset.state = state;
  if ($('design-publication-status-text')) $('design-publication-status-text').textContent = label;
  if ($('design-publication-copy')) $('design-publication-copy').textContent = copy;
  if ($('design-draft-time')) $('design-draft-time').textContent = formatDesignTimestamp(designDraftUpdatedAt);
  if ($('design-published-time')) $('design-published-time').textContent = formatDesignTimestamp(designPublishedUpdatedAt);

  const publishBtn = $('design-publish');
  if (publishBtn) {
    publishBtn.disabled =
      !designPersistenceLoaded ||
      currentFp === publishedFp ||
      publishBtn.dataset.busy === '1';
  }

  const restoreBtn = $('design-restore-published');
  if (restoreBtn) {
    restoreBtn.disabled =
      !designPersistenceLoaded ||
      currentFp === publishedFp;
  }
}

async function fetchDesignPersistence() {
  const { data, error } = await listSiteContentBySlug(
    'design',
    ['draft', 'published']
  );

  if (error) throw error;

  let draft = null;
  let published = null;

  (data || []).forEach(row => {
    let content = row.content || {};
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch (_) { content = {}; }
    }

    if (row.section_key === 'draft') {
      draft = normalizeDesignConfig(content);
      designDraftUpdatedAt = row.updated_at || null;
    }
    if (row.section_key === 'published') {
      published = normalizeDesignConfig(content);
      designPublishedUpdatedAt = row.updated_at || null;
    }
  });

  if (!contentCache) { const currentMap = await fetchContent(); contentCache = mergeContent(currentMap); }
  const publicContent = JSON.parse(JSON.stringify(contentCache || CONTENT_DEFAULTS));
  designPublishedSaved = published || normalizeDesignConfig({ ...DESIGN_DEFAULTS, content: publicContent });
  if (!designPublishedSaved.content) designPublishedSaved.content = JSON.parse(JSON.stringify(publicContent));
  designDraftSaved = draft;
  if (designDraftSaved && !designDraftSaved.content) designDraftSaved.content = JSON.parse(JSON.stringify(publicContent));
  designPersistenceLoaded = true;

  const initial =
    draft && designFingerprint(draft) !== designFingerprint(designPublishedSaved)
      ? draft
      : designPublishedSaved;

  dlog(
    '[admin-v2] Design inicial:',
    {
      source:
        initial === draft
          ? 'draft'
          : 'published',
      heroTitle:
        initial?.content
          ?.inicio
          ?.hero
          ?.title || ''
    }
  );

  try {
    applyDesignConfigToControls(initial);
  } catch (error) {
    /*
      No primeiro F5 o iframe pode ainda estar sem <head>/<body>. O rascunho
      continua carregado e a aplicação visual é repetida assim que a prévia
      terminar de montar, sem transformar essa condição transitória em erro.
    */
    console.warn('[admin-v2] Design aguardando a prévia ficar pronta:', error);
    setTimeout(() => {
      try {
        applyDesignConfigToControls(initial);
        applyDesignPreview();
        applyDesignContentPreview();
      } catch (retryError) {
        console.warn('[admin-v2] Prévia ainda indisponível:', retryError);
      }
    }, 350);
  }
  updateDesignPublicationState();
  maybeShowDesignDraftReminder();
}

/*
  Lembrete de rascunho pendente.
  Mostra um aviso destacado no topo da aba Design sempre que existe
  um rascunho salvo e diferente do que está publicado no site — não
  só na primeira vez que os dados carregam, mas toda vez que a
  pessoa volta para esta aba (ver chamadas em setView/initDesignStudio).
  Objetivo: nunca deixar dúvida entre "isto que vejo é o rascunho ou
  o que já está no ar?", mesmo voltando dias depois.
*/
function maybeShowDesignDraftReminder() {
  const banner = $('design-draft-reminder');
  if (banner) banner.hidden = true;
}

if (!window.__designDraftReminderBound) {
  window.__designDraftReminderBound = true;
  document.addEventListener('DOMContentLoaded', () => {
    $('design-draft-reminder-dismiss')?.addEventListener('click', () => {
      const banner = $('design-draft-reminder');
      if (banner) banner.hidden = true;
    });
    $('design-draft-reminder-publish')?.addEventListener('click', () => {
      const banner = $('design-draft-reminder');
      if (banner) banner.hidden = true;
      $('design-publish')?.click();
    });
  });
}

async function ensureDesignPersistenceLoaded() {
  if (designPersistenceLoaded) return;
  if (!designPersistenceLoading) {
    designPersistenceLoading = fetchDesignPersistence()
      .catch(error => {
        console.error('[admin-v2] Falha ao carregar Design:', error);
        flash(`Erro ao carregar configurações de Design: ${error.message}`, 'erro');
        throw error;
      })
      .finally(() => {
        designPersistenceLoading = null;
      });
  }
  return designPersistenceLoading;
}

async function upsertDesignRow(sectionKey, config) {
  const normalized = normalizeDesignConfig(config);

  const result = await upsertSiteContentSection(
    'design',
    sectionKey,
    normalized
  );

  if (result.error) throw result.error;
  return normalized;
}

async function saveDesignDraft(configOverride = null) {
  if (!designPersistenceLoaded) await ensureDesignPersistenceLoaded();

  const button = $('design-save-draft');
  if (button?.dataset.busy === '1') return;

  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'Salvando…';
  }

  try {
    const configToSave =
      configOverride
        ? normalizeDesignConfig(
            configOverride
          )
        : collectDesignConfig();

    designDraftSaved = await upsertDesignRow(
      'draft',
      configToSave
    );

    designDraftUpdatedAt =
      new Date().toISOString();

    flash(
      'Rascunho de Design salvo.',
      'sucesso'
    );

    return true;
  } catch (error) {
    console.error(
      '[admin-v2] saveDesignDraft:',
      error
    );

    flash(
      `Erro ao salvar rascunho: ${error.message}`,
      'erro'
    );

    throw error;
  } finally {
    if (button) {
      button.dataset.busy = '0';
      button.disabled = false;
      button.textContent = 'Salvar rascunho';
    }
    updateDesignPublicationState();
  }
}

function restorePublishedDesign() {
  if (!designPersistenceLoaded || !designPublishedSaved) return;
  if (designInlineActive) finishDesignInline(false);

  const currentFp = designFingerprint(collectDesignConfig());
  const publishedFp = designFingerprint(designPublishedSaved);

  if (
    currentFp !== publishedFp &&
    !confirm('Descartar todas as alterações feitas na prévia?')
  ) return;

  applyDesignConfigToControls(designPublishedSaved);
  const previewFrame=$('design-preview-frame');if(previewFrame){setDesignPreviewLoading(true);const previewUrl=new URL(previewFrame.src||'/inicio',location.origin);previewUrl.searchParams.set('_discard',Date.now());previewFrame.src=previewUrl.href}
  flash('Alterações descartadas.', 'sucesso');
  updateDesignPublicationState();
  maybeShowDesignDraftReminder();
}


async function publishDesignContent(snapshot){if(!snapshot)return;for(const [slug,key,payload] of [['inicio','hero',snapshot.inicio?.hero],['inicio','recent_work',snapshot.inicio?.recent_work],['sobre','conteudo',snapshot.sobre?.conteudo],['contato','conteudo',snapshot.contato?.conteudo]]){if(!payload)continue;const ok=await upsertContent(slug,key,payload,null);if(!ok)throw new Error(`Falha ao publicar ${slug}/${key}.`)}contentCache=JSON.parse(JSON.stringify(snapshot))}

async function publishTrailDrafts(){
  for(const [index,trail] of trailsCache.entries()){
    const draft=trailDraftEdits[trail.id];
    const payload={sort_order:index*10};
    if(draft){payload.name=safeText(draft.name,100);payload.slug=slugify(draft.name||draft.slug).slice(0,120);payload.description=safeText(draft.description,240)||null}
    const result=await updateTrail(trail.id,payload);
    if(result.error)throw result.error;
  }
}

async function publishDesign() {
  if (!designPersistenceLoaded) await ensureDesignPersistenceLoaded();
  if (designInlineActive) await saveDesignInline();

  const current = collectDesignConfig();
  const currentFp = designFingerprint(current);
  const publishedFp = designFingerprint(designPublishedSaved || DESIGN_DEFAULTS);

  if (currentFp === publishedFp) {
    updateDesignPublicationState();
    flash('O Design já está publicado. Nenhuma alteração necessária.', '');
    return;
  }

  if (!confirm('Salvar estas alterações no site agora?')) return;

  const button = $('design-publish');
  if (button?.dataset.busy === '1') return;

  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'Salvando…';
  }

  try {
    designDraftSaved = await upsertDesignRow('draft', current);
    designDraftUpdatedAt = new Date().toISOString();

    await publishTrailDrafts();
    await publishDesignContent(current.content);

    designPublishedSaved = await upsertDesignRow('published', current);
    designPublishedUpdatedAt = new Date().toISOString();

    flash('Alterações salvas com sucesso.', 'sucesso');
    updateDesignPublicationState();
    maybeShowDesignDraftReminder();

    const frame = $('design-preview-frame');
    if (frame) {
      const url = new URL(frame.src || '/inicio', location.origin);
      url.searchParams.set('_design', Date.now());
      setDesignPreviewLoading(true);
      frame.src = url.href;
    }
  } catch (error) {
    console.error('[admin-v2] publishDesign:', error);
    flash(`Erro ao publicar Design: ${error.message}`, 'erro');
  } finally {
    if (button) {
      button.dataset.busy = '0';
      button.textContent = 'Publicar alterações no site';
    }
    updateDesignPublicationState();
  }
}

function getDesignPreviewDocument() {
  const frame = $('design-preview-frame');
  try { return frame?.contentDocument || frame?.contentWindow?.document || null; }
  catch (_) { return null; }
}

function setDesignPreviewLoading(loading = true) {
  document
    .querySelector('#design-preview-stage .design-browser-frame')
    ?.classList.toggle('is-loading', Boolean(loading));
}

function refreshDesignPreviewStylesheet(doc) {
  if (!doc?.head) return;

  const refresh = targetDoc => {
    if (!targetDoc?.head) return;

    targetDoc
      .querySelectorAll('link[rel="stylesheet"]')
      .forEach(link => {
        let url;

        try {
          url = new URL(link.href, targetDoc.location.href);
        } catch (_) {
          return;
        }

        if (!/\/(?:legacy\/)?css\/style\.css$/i.test(url.pathname)) return;
        if (link.dataset.designPreviewCssFresh === '1') return;

        link.dataset.designPreviewCssFresh = '1';
        url.searchParams.set('_preview_css', String(Date.now()));
        link.href = url.href;
      });
  };

  refresh(doc);

  const nestedFrame = doc.querySelector('iframe.legacy-frame');
  try { refresh(nestedFrame?.contentDocument); } catch (_) {}
}

async function waitForDesignPreviewHydration(frame, timeout = 1200) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      const doc = frame?.contentDocument;

      if (
        doc?.documentElement?.dataset?.reactHydrated === '1'
      ) {
        return;
      }
    } catch (_) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function getDesignPreviewViewport() {
  return DESIGN_VIEWPORTS[designPreviewDevice] || DESIGN_VIEWPORTS.desktop;
}

function sizeDesignPreview() {
  const stage = $('design-preview-stage');
  const browser = stage?.querySelector('.design-browser-frame');
  const frame = $('design-preview-frame');

  if (!stage || !browser || !frame) return;

  const viewport = getDesignPreviewViewport();
  const browserBar = browser.querySelector('.design-browser-bar');
  const barHeight = browserBar?.offsetHeight || 34;

  const styles = getComputedStyle(stage);

  const availableWidth = Math.max(
    260,
    stage.clientWidth -
      (parseFloat(styles.paddingLeft) || 0) -
      (parseFloat(styles.paddingRight) || 0)
  );

  /*
    V27: volta ao comportamento visual anterior.
    O viewport continua real (1920×1080 / 390×844), mas a prévia
    é dimensionada pela largura do painel e pode ser rolada verticalmente.
    Isso mantém o site grande e legível dentro do Design Studio.
  */
  const scale = Math.min(
    1,
    availableWidth / viewport.width
  );

  browser.style.width = `${viewport.width}px`;
  browser.style.height = `${viewport.height + barHeight}px`;
  browser.style.transform = `scale(${scale})`;
  browser.style.transformOrigin = 'top center';

  frame.style.width = `${viewport.width}px`;
  frame.style.height = `${viewport.height}px`;

  stage.style.height =
    `${Math.ceil((viewport.height + barHeight) * scale + 36)}px`;

  stage.style.minHeight = '0';

  if ($('design-preview-label')) {
    $('design-preview-label').innerHTML = `<strong>Prévia responsiva</strong><small>${viewport.label}</small>`;
  }
}

function applyDesignPreview() {
  const doc = getDesignPreviewDocument();
  if (!doc?.head || !doc?.body) return;

  const typeScale = clampNumber($('design-type-scale')?.value, 90, 115, 100);
  const contentWidth = clampNumber($('design-content-width')?.value, 1040, 1500, 1200);
  const sectionSpace = clampNumber($('design-section-space')?.value, 72, 160, 120);
  const galleryGap = clampNumber($('design-gallery-gap')?.value, 0, 16, 2);

  const density = $('design-nav-density')?.value || 'normal';
  const navStyle = $('design-nav-style')?.value || 'auto';
  const navPosition = $('design-nav-position')?.value || 'fixed';
  const navCta = $('design-nav-cta')?.value || 'outline';
  const navBlur = clampNumber($('design-nav-blur')?.value, 0, 18, 0);
  const logoScale = clampNumber($('design-logo-scale')?.value, 85, 120, 100);

  const pageAnimation = $('design-page-animation')?.value || 'none';
  const sectionAnimation = $('design-section-animation')?.value || 'none';
  const imageHover = $('design-image-hover')?.value || 'site';
  const motionSpeed = $('design-motion-speed')?.value || 'normal';

  const heroOverlay = clampNumber($('design-hero-overlay')?.value, 0, 70, 40);
  const imageRadius = clampNumber($('design-image-radius')?.value, 0, 18, 0);
  const clientLayout = $('design-client-layout')?.value || 'editorial-split';
  const clientGalleryStyle = $('design-client-gallery-style')?.value || 'editorial';
  const clientPhotoSize = $('design-client-photo-size')?.value || 'large';
  const clientTypography = $('design-client-typography')?.value || 'classic';
  const clientBorder = $('design-client-border')?.value || 'fine';
  const clientAccessImage = safeHttpUrl(
    $('design-client-access-image')?.value || '',
    { allowRelative: true }
  );

  const clientFocusX = clampNumber(
    $('design-client-focus-x')?.value,
    0,
    100,
    50
  );

  const clientFocusY = clampNumber(
    $('design-client-focus-y')?.value,
    0,
    100,
    50
  );

  const navPadding = density === 'compact' ? 14 : density === 'airy' ? 30 : 22;
  const navSolidPadding = density === 'compact' ? 10 : density === 'airy' ? 22 : 16;
  const scale = typeScale / 100;
  const logoScaleFactor = logoScale / 100;

  const motionMs =
    motionSpeed === 'fast'
      ? 280
      : motionSpeed === 'slow'
        ? 900
        : 520;

  let style = doc.getElementById('admin-design-preview-overrides');

  if (!style) {
    style = doc.createElement('style');
    style.id = 'admin-design-preview-overrides';
    doc.head.appendChild(style);
  }

  const titleRules = typeScale === 100
    ? ''
    : `
      .hero-title{
        font-size:clamp(${(2.6 * scale).toFixed(3)}rem,${(7 * scale).toFixed(3)}vw,${(6 * scale).toFixed(3)}rem) !important
      }

      .section-title{
        font-size:clamp(${(2.6 * scale).toFixed(3)}rem,${(10 * scale).toFixed(3)}vw,${(4.4 * scale).toFixed(3)}rem) !important
      }
    `;

  const containerRule =
    contentWidth === 1200
      ? ''
      : `.container{
          max-width:${contentWidth}px !important;
          margin-left:auto !important;
          margin-right:auto !important;
        }`;

  const navStyleRules =
    navStyle === 'transparent'
      ? `
        .nav{
          background:transparent !important;
          border-color:transparent !important;
        }
      `
      : navStyle === 'solid'
        ? `
          .nav{
            background:rgba(8,8,7,.94) !important;
            border-color:rgba(255,255,255,.10) !important;
          }
        `
        : '';

  const navPositionRules =
    navPosition === 'static'
      ? `
        .nav{
          position:absolute !important;
        }
        .nav.is-hidden{
          transform:none !important;
          opacity:1 !important;
          pointer-events:auto !important;
        }
      `
      : '';

  const ctaRules =
    navCta === 'filled'
      ? `
        .nav-cta{
          background:#f3f0e9 !important;
          color:#0b0b0a !important;
          border-color:#f3f0e9 !important;
        }
      `
      : navCta === 'hidden'
        ? `.nav-cta{display:none !important}`
        : '';

  const imageHoverRules =
    imageHover === 'none'
      ? `
        .frame:hover img{
          transform:none !important;
          filter:none !important;
        }
        .frame:hover{
          transform:none !important;
        }
      `
      : imageHover === 'zoom'
        ? `
          .frame img{
            transition:transform ${motionMs}ms ease !important;
          }
          .frame:hover img{
            transform:scale(1.07) !important;
          }
        `
        : imageHover === 'lift'
          ? `
            .frame{
              transition:transform ${motionMs}ms ease, box-shadow ${motionMs}ms ease !important;
            }
            .frame:hover{
              transform:translateY(-8px) !important;
              box-shadow:0 18px 42px rgba(0,0,0,.35) !important;
            }
            .frame:hover img{
              transform:none !important;
            }
          `
          : '';

  const pageAnimationRules = '';

  const sectionAnimationRules =
    sectionAnimation === 'fade'
      ? `
        @keyframes adminDesignSectionIn{
          from{opacity:0}
          to{opacity:1}
        }
        body.design-preview-animate-sections .section{
          animation:adminDesignSectionIn ${motionMs}ms ease both !important;
        }
      `
      : sectionAnimation === 'fade-up'
        ? `
          @keyframes adminDesignSectionIn{
            from{opacity:0;transform:translateY(24px)}
            to{opacity:1;transform:none}
          }
          body.design-preview-animate-sections .section{
            animation:adminDesignSectionIn ${motionMs}ms cubic-bezier(.22,.61,.36,1) both !important;
          }
        `
        : '';

  const clientBorderRule =
    clientBorder === 'none'
      ? 'border-color:transparent !important;'
      : clientBorder === 'soft'
        ? 'border-color:rgba(255,255,255,.16) !important;border-radius:14px !important;'
        : 'border-color:rgba(255,255,255,.10) !important;';

  const clientColumns =
    clientPhotoSize === 'compact'
      ? 'repeat(auto-fill,minmax(180px,1fr))'
      : clientPhotoSize === 'medium'
        ? 'repeat(auto-fill,minmax(230px,1fr))'
        : 'repeat(auto-fill,minmax(290px,1fr))';

  const clientTypographyRule =
    clientTypography === 'editorial'
      ? '.client-area-premium .section-title,.client-area-premium .client-access-title{font-style:italic !important;letter-spacing:-.035em !important;}'
      : clientTypography === 'minimal'
        ? '.client-area-premium .section-title,.client-area-premium .client-access-title{font-family:Arial,Helvetica,sans-serif !important;font-style:normal !important;font-weight:400 !important;letter-spacing:-.025em !important;}'
        : '';

  const clientLayoutRule =
    clientLayout === 'centered'
      ? '.client-access-shell{grid-template-columns:1fr !important;max-width:650px !important}.client-access-visual{display:none !important}.client-access-panel{min-height:70vh !important;}'
      : clientLayout === 'fullscreen'
        ? `.client-access-shell{grid-template-columns:1fr !important;max-width:none !important}.client-access-visual{display:block !important;position:absolute !important;inset:0 !important;opacity:.36 !important}.client-access-panel{position:relative !important;z-index:2 !important;max-width:620px !important;margin:auto !important;background:rgba(11,11,10,.78) !important;backdrop-filter:blur(14px) !important;}`
        : '';

  const clientGalleryRule =
    clientGalleryStyle === 'masonry'
      ? '.client-gallery-grid{display:block !important;columns:3 260px !important;column-gap:10px !important}.client-gallery-grid .frame{break-inside:avoid !important;margin:0 0 10px !important;}'
      : `.client-gallery-grid{display:grid !important;grid-template-columns:${clientColumns} !important;gap:${clientGalleryStyle === 'clean' ? 16 : 8}px !important;}`;

  style.textContent = `
    ${containerRule}
    ${titleRules}
    ${navStyleRules}
    ${navPositionRules}
    ${ctaRules}
    ${imageHoverRules}
    ${pageAnimationRules}
    ${sectionAnimationRules}

    .section{
      padding-top:${sectionSpace}px !important;
      padding-bottom:${sectionSpace}px !important;
    }

    .grid{
      gap:${galleryGap}px !important;
    }

    .frame{
      border-radius:${imageRadius}px !important;
    }

    .frame img{
      border-radius:${imageRadius}px !important;
    }

    .nav{
      padding-top:${navPadding}px !important;
      padding-bottom:${navPadding}px !important;
      backdrop-filter:blur(${navBlur}px) !important;
      -webkit-backdrop-filter:blur(${navBlur}px) !important;
    }

    .nav.is-solid{
      padding-top:${navSolidPadding}px !important;
      padding-bottom:${navSolidPadding}px !important;
    }

    .nav-logo{
      transform:scale(${logoScaleFactor.toFixed(3)}) !important;
      transform-origin:left center !important;
    }

    .hero-overlay{
      opacity:${(heroOverlay / 100).toFixed(2)} !important;
    }


    .client-area-premium .client-access-shell,
    .client-area-premium .client-access-panel,
    .client-area-premium .client-access-visual,
    .client-area-premium .client-stage-card,
    .client-area-premium .frame{
      ${clientBorderRule}
    }

    ${clientTypographyRule}
    ${clientLayoutRule}
    ${clientGalleryRule}

    .client-access-visual{
      ${clientAccessImage ? `background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34)),url("${clientAccessImage}") !important;` : ''}
      background-position:${clientFocusX}% ${clientFocusY}% !important;
    }

    @media (prefers-reduced-motion: reduce){
      body.design-preview-animate-page,
      body.design-preview-animate-sections .section{
        animation:none !important;
      }
    }
  `;

  doc.body.classList.remove('design-preview-animate-page');

  doc.body.classList.toggle(
    'design-preview-animate-sections',
    sectionAnimation !== 'none'
  );

  if ($('design-type-scale-out')) {
    $('design-type-scale-out').textContent = `${typeScale}%`;
  }

  if ($('design-content-width-out')) {
    $('design-content-width-out').textContent =
      contentWidth === 1200
        ? 'Padrão do site'
        : `${contentWidth} px`;
  }

  if ($('design-section-space-out')) {
    $('design-section-space-out').textContent = `${sectionSpace} px`;
  }

  if ($('design-gallery-gap-out')) {
    $('design-gallery-gap-out').textContent = `${galleryGap} px`;
  }

  if ($('design-logo-scale-out')) {
    $('design-logo-scale-out').textContent = `${logoScale}%`;
  }

  if ($('design-nav-blur-out')) {
    $('design-nav-blur-out').textContent = `${navBlur} px`;
  }

  if ($('design-hero-overlay-out')) {
    $('design-hero-overlay-out').textContent =
      heroOverlay === 40
        ? 'Padrão'
        : `${heroOverlay}%`;
  }

  if ($('design-image-radius-out')) {
    $('design-image-radius-out').textContent = `${imageRadius} px`;
  }

  updateDesignClientFocalUI();
  applyDesignClientTextPreview(doc);
  sizeDesignPreview();
}

function runDesignPageTransition() {
  const browser = document.querySelector(
    '#design-preview-stage .design-browser-frame'
  );

  if (!browser) return;

  const mode = $('design-page-animation')?.value || 'none';
  const speed = $('design-motion-speed')?.value || 'normal';

  if (mode === 'none') {
    browser.style.opacity = '1';
    browser.style.transform = browser.style.transform || '';
    browser.style.filter = '';
    return;
  }

  const duration =
    speed === 'fast'
      ? 260
      : speed === 'slow'
        ? 820
        : 480;

  let keyframes;

  if (mode === 'fade-up') {
    keyframes = [
      { opacity: 0, transform: `${browser.style.transform} translateY(10px)` },
      { opacity: 1, transform: browser.style.transform }
    ];
  } else if (mode === 'soft') {
    keyframes = [
      { opacity: 0, filter: 'blur(3px)' },
      { opacity: 1, filter: 'blur(0px)' }
    ];
  } else {
    keyframes = [
      { opacity: 0 },
      { opacity: 1 }
    ];
  }

  browser.getAnimations?.().forEach(animation => {
    if (animation.id === 'design-page-entry') {
      animation.cancel();
    }
  });

  const animation = browser.animate(
    keyframes,
    {
      duration,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'both'
    }
  );

  animation.id = 'design-page-entry';
}

function replayDesignAnimations() {
  const doc = getDesignPreviewDocument();

  if (doc?.body) {
    const sectionAnimation =
      $('design-section-animation')?.value || 'none';

    doc.body.classList.remove(
      'design-preview-animate-sections'
    );

    void doc.body.offsetWidth;

    if (sectionAnimation !== 'none') {
      doc.body.classList.add(
        'design-preview-animate-sections'
      );
    }
  }

  runDesignPageTransition();

  try {
    $('design-preview-frame')?.contentWindow?.scrollTo(0, 0);
  } catch (_) {}
}

function runDesignTransitionAfterRoute(doc, pathname) {
  const startedAt = Date.now();
  const waitForRoute = () => {
    let currentPath = '';
    try { currentPath = doc.location.pathname; } catch (_) { return; }
    if (currentPath === pathname) {
      requestAnimationFrame(() => requestAnimationFrame(runDesignPageTransition));
      return;
    }
    if (Date.now() - startedAt < 1500) setTimeout(waitForRoute, 25);
  };
  setTimeout(waitForRoute, 0);
}

function installDesignPreviewNavigationGuard() {
  const doc = getDesignPreviewDocument();
  const frame = $('design-preview-frame');

  if (!doc || !frame) return;

  if (!doc.__designNavigationGuardInstalled) {
    doc.__designNavigationGuardInstalled = true;

    doc.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');

    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    let url;

    try {
      url = new URL(link.href, doc.location.href);
    } catch (_) {
      return;
    }

    if (url.origin !== doc.location.origin) return;

    setTimeout(installDesignPreviewNavigationGuard, 500);
    setTimeout(applyDesignContentPreview, 500);

    const mode = $('design-page-animation')?.value || 'none';

    if (mode === 'none') return;
    runDesignTransitionAfterRoute(doc, url.pathname);
    });
  }

  const nestedFrame = doc.querySelector('iframe.legacy-frame');
  const bindNestedNavigation = () => {
    let nestedDoc;
    try { nestedDoc = nestedFrame?.contentDocument; } catch (_) { return; }
    if (!nestedDoc || nestedDoc.__designOuterNavigationInstalled) return;
    decorateDesignInlinePreview(nestedDoc);
    nestedDoc.__designOuterNavigationInstalled = true;
    nestedDoc.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      let url;
      try { url = new URL(link.href, nestedDoc.location.href); } catch (_) { return; }
      if (url.origin !== nestedDoc.location.origin) return;
      event.preventDefault();
      setDesignPreviewLoading(true);
      frame.src = url.href;
    });
  };
  nestedFrame?.addEventListener('load', bindNestedNavigation);
  bindNestedNavigation();
}

function setDesignDevice(device) {
  designPreviewDevice = device === 'mobile' ? 'mobile' : 'desktop';
  const mobile = designPreviewDevice === 'mobile';
  try{localStorage.setItem('rangel-design-preview-device',designPreviewDevice)}catch(_){}

  $('design-preview-stage')?.classList.toggle('is-mobile', mobile);
  $('design-preview-stage')?.classList.toggle('is-desktop', !mobile);
  $('design-device-desktop')?.classList.toggle('active', !mobile);
  $('design-device-mobile')?.classList.toggle('active', mobile);
  $('design-device-desktop')?.setAttribute('aria-pressed', String(!mobile));
  $('design-device-mobile')?.setAttribute('aria-pressed', String(mobile));

  const frame = $('design-preview-frame');

  try {
    const doc=frame?.contentDocument;
    const nextPending=doc?.querySelector('script[src*="/_next/"]')&&doc.documentElement?.dataset?.reactHydrated!=='1';
    if(doc&&!nextPending)decorateDesignInlinePreview(doc);
  } catch (_) {}

  try {
    frame?.contentWindow?.scrollTo(0, 0);
  } catch (_) {}

  sizeDesignPreview();

  /* A troca de viewport também troca o bloco de estilos (desktop/mobile). */
  applyDesignContentPreview();
  setTimeout(()=>{try{applyDesignContentPreview()}catch(_){}},80);
  setTimeout(()=>{try{applyDesignContentPreview()}catch(_){}},260);

  setTimeout(() => {
    try {
      frame?.contentWindow?.scrollTo(0, 0);
    } catch (_) {}

    sizeDesignPreview();
  }, 60);
}

function resetDesignPreview() {
  applyDesignConfigToControls(DESIGN_DEFAULTS);

  flash(
    'Prévia restaurada para os valores padrão. Use “Restaurar publicado” para voltar ao Design que está no site.',
    'sucesso'
  );
}


function setDesignAccordionOpen(section, open) {
  if (!section) return;

  const toggle = section.querySelector('.design-accordion-toggle');
  const body = section.querySelector('.design-accordion-body');

  section.classList.toggle('is-open', Boolean(open));

  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (body) {
    body.hidden = !open;
  }
}

function initDesignAccordions() {
  document.querySelectorAll('.design-accordion').forEach(section => {
    const toggle = section.querySelector('.design-accordion-toggle');

    if (!toggle || toggle.dataset.bound === '1') return;

    toggle.dataset.bound = '1';

    toggle.addEventListener('click', () => {
      const isOpen = section.classList.contains('is-open');
      setDesignAccordionOpen(section, !isOpen);
    });
  });
}



function setContentNavExpanded(expanded) {
  const toggle = $('content-nav-toggle');
  const submenu = $('content-nav-submenu');

  if (!toggle || !submenu) return;

  toggle.setAttribute(
    'aria-expanded',
    expanded ? 'true' : 'false'
  );

  submenu.hidden = !expanded;

  toggle
    .closest('.content-nav-group')
    ?.classList.toggle(
      'is-open',
      Boolean(expanded)
    );
}

function openContentSection(sectionName = 'home') {
  setView?.('content');

  const panelMap = {
    home: 'inicio',
    about: 'sobre',
    contact: 'contato'
  };

  const panelName =
    panelMap[sectionName] || 'inicio';

  /*
    O menu lateral passa a ser o seletor real das páginas.
    Os antigos botões Início / Sobre / Contato da área direita
    foram removidos para não existir navegação duplicada.
  */
  ['inicio', 'sobre', 'contato'].forEach(name => {
    const panel = $(`content-panel-${name}`);

    if (panel) {
      panel.hidden = name !== panelName;
    }
  });

  document
    .querySelectorAll('[data-content-jump]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.contentJump === sectionName
      );
    });

  const titles = {
    home: ['Página inicial', 'Início'],
    about: ['Página Sobre', 'Sobre'],
    contact: ['Página Contato', 'Contato']
  };

  const [eyebrow, title] =
    titles[sectionName] || titles.home;

  $('view-eyebrow').textContent = eyebrow;
  $('view-title').textContent = title;

  const target =
    $(`content-panel-${panelName}`);

  if (target) {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      target.classList.add(
        'content-nav-focus'
      );

      setTimeout(
        () => target.classList.remove('content-nav-focus'),
        700
      );
    });
  }
}

function initContentSidebarNavigation() {
  const toggle = $('content-nav-toggle');

  if (toggle && toggle.dataset.bound !== '1') {
    toggle.dataset.bound = '1';

    toggle.addEventListener('click', () => {
      const expanded =
        toggle.getAttribute('aria-expanded') === 'true';

      setContentNavExpanded(!expanded);

      if (!expanded) {
        openContentSection('home');
      }
    });
  }

  document
    .querySelectorAll('[data-content-jump]')
    .forEach(button => {
      if (button.dataset.bound === '1') return;

      button.dataset.bound = '1';

      button.addEventListener('click', event => {
        event.stopPropagation();

        openContentSection(
          button.dataset.contentJump
        );
      });
    });
}


function setDesignContentExpanded(expanded){const t=$('design-content-toggle'),s=$('design-content-submenu');if(!t||!s)return;t.setAttribute('aria-expanded',expanded?'true':'false');s.hidden=!expanded;t.closest('.design-content-nav-group')?.classList.toggle('is-open',!!expanded)}

function portalHeroContentModals() {
  [
    'hero-slideshow-settings-modal',
    'hero-slides-manager-modal'
  ].forEach(id => {
    const modal = $(id);

    if (
      modal &&
      modal.parentElement !== document.body
    ) {
      document.body.appendChild(modal);
    }
  });
}

function initDesignContentMigration(){const host=$('design-content-host');if(!host)return;['content-panel-inicio','content-panel-sobre','content-panel-contato'].forEach(id=>{const panel=$(id);if(!panel)return;panel.hidden=true;if(panel.parentElement!==host)host.appendChild(panel)})}
function routeDesignPreview(path){const frame=$('design-preview-frame');if(!frame)return;let current='';try{current=new URL(frame.src,location.origin).pathname}catch(_){}if(current!==path&&current!==`${path}.html`)frame.src=path;else setTimeout(applyDesignContentPreview,40)}
function formatPreviewTitle(el,text){
  if(!el)return;

  const value=String(text||'')
    .replace(/\r\n/g,'\n')
    .replace(/\r/g,'\n')
    .trim();

  if(!value){
    el.textContent='';
    return;
  }

  const hasManualBreak=value.includes('\n');

  if(!hasManualBreak){
    const words=value.split(/\s+/).filter(Boolean);

    if(words.length<2){
      el.textContent=words.join(' ');
      return;
    }

    const last=words.pop();

    el.innerHTML=
      `${esc(words.join(' '))} <br><em>${esc(last)}</em>`;

    return;
  }

  const lines=value.split('\n');

  const lastContentLine=(()=>{
    for(let i=lines.length-1;i>=0;i--){
      if(lines[i].trim())return i;
    }
    return lines.length-1;
  })();

  el.innerHTML=lines
    .map((line,index)=>{
      const clean=line.trim();

      if(index!==lastContentLine){
        return esc(clean);
      }

      const words=clean.split(/\s+/).filter(Boolean);

      if(!words.length)return '';

      const last=words.pop();
      const prefix=words.length
        ? `${esc(words.join(' '))} `
        : '';

      return `${prefix}<em>${esc(last)}</em>`;
    })
    .join('<br>');
}
function stopDesignHeroPreviewTimer(doc) {
  try {
    const win = doc?.defaultView;

    if (
      win &&
      win.__adminHeroPreviewTimer
    ) {
      win.clearInterval(
        win.__adminHeroPreviewTimer
      );

      win.__adminHeroPreviewTimer = null;
    }
  } catch (_) {}
}

function startDesignHeroPreviewSlideshow(
  doc,
  slideshow,
  slides,
  hero
) {
  stopDesignHeroPreviewTimer(doc);

  if (
    !slideshow ||
    slides.length === 0
  ) {
    return;
  }

  let current = 0;

  const animation =
    hero.slide_animation || 'fade';

  slideshow.dataset.animation =
    animation;

  slideshow.dataset.fit =
    hero.slide_fit || 'cover';

  slideshow.style.setProperty(
    '--hero-slide-transition',
    `${Number(hero.slide_transition || 1.2) * 1000}ms`
  );

  slideshow.style.setProperty(
    '--hero-slide-interval',
    `${Number(hero.slide_interval || 5) * 1000}ms`
  );

  const nodes = [
    ...slideshow.querySelectorAll(
      '.hero-slide'
    )
  ];

  const show = index => {
    nodes.forEach((node, i) => {
      node.classList.toggle(
        'is-visible',
        i === index
      );

      node.classList.toggle(
        'is-prev',
        i === (
          index - 1 + nodes.length
        ) % nodes.length
      );
    });
  };

  show(0);

  if (nodes.length < 2) {
    return;
  }

  try {
    const win = doc.defaultView;

    win.__adminHeroPreviewTimer =
      win.setInterval(
        () => {
          current =
            (current + 1) %
            nodes.length;

          show(current);
        },
        Math.max(
          2000,
          Number(
            hero.slide_interval || 5
          ) * 1000
        )
      );
  } catch (_) {}
}

function applyInicioDesignPreview(doc, snapshot) {
  const hero =
    snapshot.inicio?.hero || {};

  const recent =
    snapshot.inicio?.recent_work || {};

  const eyebrow =
    doc.getElementById(
      'hero-eyebrow'
    );

  if (eyebrow) {
    eyebrow.textContent =
      hero.eyebrow || '';
  }

  formatPreviewTitle(
    doc.getElementById('hero-title'),
    hero.title
  );

  const description =
    doc.getElementById(
      'hero-description'
    );

  if (description) {
    description.textContent =
      hero.description || '';
  }

  const heroMedia=doc.querySelector('.hero-media');
  let desktop = doc.getElementById('hero-desktop-image') || doc.querySelector('.hero-photo');

  let mobile = doc.getElementById('hero-mobile-image') || doc.querySelector('.hero-media source[media]');

  let picture = desktop?.closest('picture') || doc.querySelector('.hero-media picture');

  let slideshow = doc.getElementById('hero-slideshow') || doc.querySelector('.hero-slideshow');

  if(heroMedia&&!picture){
    picture=doc.createElement('picture');
    mobile=doc.createElement('source');mobile.setAttribute('media','(max-width: 899px)');
    desktop=doc.createElement('img');desktop.className='hero-photo';
    picture.append(mobile,desktop);heroMedia.insertBefore(picture,heroMedia.firstChild);
  }
  if(heroMedia&&!slideshow){
    slideshow=doc.createElement('div');slideshow.className='hero-slideshow';slideshow.setAttribute('aria-hidden','true');
    heroMedia.insertBefore(slideshow,picture?.nextSibling||heroMedia.firstChild);
  }

  if (
    desktop &&
    hero.desktop_image
  ) {
    desktop.src = resolvePreviewMediaUrl(hero.desktop_image);

    desktop.alt =
      hero.image_alt || '';

    const mobileViewport=(doc.defaultView?.innerWidth||1920)<=899;
    const focusX=mobileViewport?Number(hero.static_mobile_focus_x??hero.static_focus_x??50):Number(hero.static_focus_x??50);
    const focusY=mobileViewport?Number(hero.static_mobile_focus_y??hero.static_focus_y??50):Number(hero.static_focus_y??50);
    desktop.style.objectPosition=`${focusX}% ${focusY}%`;
  }

  if (mobile) {
    mobile.srcset = resolvePreviewMediaUrl(hero.mobile_image || '');
  }

  const visibleSlides =
    (hero.slides || [])
      .filter(
        slide =>
          slide.url &&
          slide.published !== false
      );

  const slideshowMode = hero.mode === 'slideshow' && visibleSlides.length > 0;

  if (slideshow) {
    stopDesignHeroPreviewTimer(doc);

    slideshow.innerHTML =
      visibleSlides
        .map(
          (slide, index) => `
            <div
              class="hero-slide ${index === 0 ? 'is-visible' : ''}"
              style="
                background-image:url('${esc(resolvePreviewMediaUrl(slide.url))}');
                background-position:${Number(slide.focus_x ?? 50)}% ${Number(slide.focus_y ?? 50)}%;
              "
              aria-hidden="${index === 0 ? 'false' : 'true'}"
            ></div>
          `
        )
        .join('');

    slideshow.classList.toggle(
      'is-active',
      slideshowMode
    );

    slideshow.classList.toggle(
      'is-ready',
      slideshowMode
    );

    slideshow.setAttribute(
      'aria-hidden',
      slideshowMode
        ? 'false'
        : 'true'
    );

    slideshow.style.display =
      slideshowMode
        ? ''
        : 'none';

    if (slideshowMode) {
      startDesignHeroPreviewSlideshow(
        doc,
        slideshow,
        visibleSlides,
        hero
      );
    }
  }

  if (picture) {
    picture.style.display =
      slideshowMode
        ? 'none'
        : '';
  }

  const primary =
    doc.getElementById(
      'hero-primary-button'
    );

  if (primary) {
    primary.textContent =
      hero.primary_button?.text ||
      '';

    primary.href =
      hero.primary_button?.url ||
      '/galeria';
  }

  const secondary =
    doc.getElementById(
      'hero-secondary-button'
    );

  if (secondary) {
    secondary.textContent =
      hero.secondary_button?.text ||
      '';

    secondary.href =
      hero.secondary_button?.url ||
      '/contato';
  }

  const recentEyebrow =
    doc.getElementById(
      'recent-work-eyebrow'
    );

  if (recentEyebrow) {
    recentEyebrow.textContent =
      recent.eyebrow || '';
  }

  const recentTitle =
    doc.getElementById(
      'recent-work-title'
    );

  if (recentTitle) {
    recentTitle.textContent =
      recent.title || '';
  }

  const recentButton =
    doc.getElementById(
      'recent-work-button'
    );

  if (recentButton) {
    recentButton.textContent =
      recent.button?.text || '';

    recentButton.href =
      recent.button?.url ||
      '/galeria';
  }
}

function applySobreDesignPreview(doc,s){
  const d=s.sobre?.conteudo||{},text=doc.querySelector('.about-text');
  if(text){
    const eb=text.querySelector('.section-eyebrow');if(eb)eb.textContent=d.eyebrow||eb.textContent||'Sobre mim';
    text.querySelectorAll(':scope > p:not(.section-eyebrow)').forEach(p=>p.remove());
    const specs=text.querySelector('.specs');
    (d.paragraphs||[]).forEach(x=>{const p=doc.createElement('p');p.textContent=x;text.insertBefore(p,specs||null)});
    if(specs){
      const defaults=[
        {label:'Baseado em',value:'Vale de Cambra, Portugal'},
        {label:'Especialidade',value:'Retrato Feminino & Autoestima'},
        {label:'Prazo de entrega',value:'05–10 dias úteis'},
        {label:'Atende',value:'Vale de Cambra e arredores'}
      ];
      const normalize=value=>String(value||'').toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      const existing=[...specs.querySelectorAll(':scope > div')].map(row=>({label:row.querySelector('dt')?.textContent?.trim()||'',value:row.querySelector('dd')?.textContent?.trim()||''})).filter(x=>x.label&&x.value);
      const merged=new Map(defaults.map(x=>[normalize(x.label),x]));
      existing.forEach(x=>merged.set(normalize(x.label),x));
      (Array.isArray(d.specs)?d.specs:[]).filter(x=>x?.label&&x?.value).forEach(x=>merged.set(normalize(x.label),x));
      specs.innerHTML=[...merged.values()].map(x=>`<div><dt>${esc(x.label||'')}</dt><dd>${esc(x.value||'')}</dd></div>`).join('');
    }
    const cta=text.querySelector('.btn.btn-accent');if(cta){cta.textContent=d.cta_text||cta.textContent||'Vamos conversar';cta.href=d.cta_url||'/contato'}
  }
  const portrait=doc.querySelector('.about-portrait img');if(portrait&&d.portrait_url){portrait.src=d.portrait_url;portrait.alt=d.portrait_alt||''}
}
function applyContatoDesignPreview(doc,s){
  const d=s.contato?.conteudo||{},eb=doc.querySelector('.section-head .section-eyebrow'),title=doc.querySelector('.section-head .section-title');
  if(eb&&d.eyebrow)eb.textContent=d.eyebrow;if(title&&d.title)title.textContent=d.title;
  const form=doc.querySelector('.contact-grid form');
  if(form){const btn=form.querySelector('button[type="submit"]');if(btn)btn.textContent=d.submit_label||'Enviar mensagem';const sel=form.querySelector('select[name="tipo"],#tipo');if(sel&&Array.isArray(d.tipos)&&d.tipos.length)sel.innerHTML=d.tipos.map(x=>`<option>${esc(x)}</option>`).join('')}
  const info=doc.querySelector('.contact-info');
  if(info){const normalize=value=>String(value||'').toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();const dt=[...info.querySelectorAll('dt')].find(n=>normalize(n.textContent)==='atendimento');if(dt?.nextElementSibling)dt.nextElementSibling.textContent=d.atendimento||dt.nextElementSibling.textContent||'Vale de Cambra e arredores — sessões sob agendamento'}
}

const DESIGN_INLINE_FIELDS = {
  'hero-eyebrow': {input:'hero-eyebrow', label:'Texto acima do título'},
  'hero-title': {input:'hero-title', label:'Título principal'},
  'hero-description': {input:'hero-description', label:'Descrição principal'},
  'hero-primary-button': {input:'hero-primary-text', label:'Botão principal'},
  'hero-secondary-button': {input:'hero-secondary-text', label:'Botão secundário'},
  'recent-work-eyebrow': {input:'recent-eyebrow', label:'Texto de Trabalhos recentes'},
  'recent-work-title': {input:'recent-title', label:'Título de Trabalhos recentes'},
  'recent-work-button': {input:'recent-btn-text', label:'Botão da galeria'},
  'gallery-eyebrow': {visual:true, label:'Texto acima da Galeria'},
  'gallery-title': {visual:true, label:'Título da Galeria'},
  'footer-text-preview': {visual:true, label:'Texto do rodapé'},
  'footer-link-0': {visual:true, label:'Primeiro link do rodapé'},
  'footer-link-1': {visual:true, label:'Segundo link do rodapé'},
  'footer-link-2': {visual:true, label:'Terceiro link do rodapé'},
  'sobre-eyebrow-preview': {input:'sobre-eyebrow', label:'Texto acima da página Sobre'},
  'sobre-cta-preview': {input:'sobre-cta-text', label:'Botão da página Sobre'},
  'contato-eyebrow-preview': {input:'contato-eyebrow', label:'Texto acima de Contato'},
  'contato-title-preview': {input:'contato-title', label:'Título de Contato'},
  'contato-submit-preview': {input:'contato-submit-label', label:'Botão do formulário'},
  'contato-atendimento-preview': {input:'contato-atendimento', label:'Informação de atendimento'},
  'client-visual-text': {visual:true, label:'Texto visual da Área do Cliente'},
  'client-access-eyebrow': {input:'design-client-text-eyebrow', label:'Texto acima do acesso'},
  'client-access-title-main': {input:'design-client-text-title', label:'Título da Área do Cliente'},
  'client-access-title-emphasis': {input:'design-client-text-title-emphasis', label:'Destaque do título'},
  'client-access-description': {input:'design-client-text-description', label:'Descrição do acesso'},
  'client-login-label': {input:'design-client-text-login', label:'Campo de login'},
  'client-password-label': {input:'design-client-text-password', label:'Campo de senha'},
  'client-access-submit': {input:'design-client-text-button', label:'Botão de acesso'},
  'client-access-secure-text': {input:'design-client-text-secure', label:'Aviso de segurança'},
  'client-gallery-eyebrow': {input:'design-client-text-gallery-eyebrow', label:'Texto da galeria privada'},
  'client-stage-selection': {input:'design-client-stage-selection', label:'Etapa Seleção'},
  'client-stage-selection-sub': {input:'design-client-stage-selection-sub', label:'Descrição da Seleção'},
  'client-stage-editing': {input:'design-client-stage-editing', label:'Etapa Edição'},
  'client-stage-editing-sub': {input:'design-client-stage-editing-sub', label:'Descrição da Edição'},
  'client-stage-delivery': {input:'design-client-stage-delivery', label:'Etapa Entrega'},
  'client-stage-delivery-sub': {input:'design-client-stage-delivery-sub', label:'Descrição da Entrega'}
};
let designInlineActive=null;
function getInlineStyleForDevice(key){
  const base=(window.__designInlineStyles||{})[key]||{};
  return designPreviewDevice==='mobile'?{...base,...(base.mobile||{})}:base;
}
function getInlineBaseFontSize(el){
  const device=designPreviewDevice==='mobile'?'mobile':'desktop';
  el.__designInlineBaseFontSizes=el.__designInlineBaseFontSizes||{};
  if(!el.__designInlineBaseFontSizes[device]){
    const previous=el.style.fontSize;
    el.style.removeProperty('font-size');
    const view=el.ownerDocument?.defaultView;
    el.__designInlineBaseFontSizes[device]=parseFloat(view?.getComputedStyle(el).fontSize||'')||16;
    el.style.fontSize=previous;
  }
  return el.__designInlineBaseFontSizes[device];
}
function getInlineSizeScale(st,key=''){
  const legacy=st.size==='small'?86:st.size==='large'?114:100;
  const value=Number(st.size_scale??legacy);
  const maximum=designPreviewDevice==='mobile'&&key==='hero-title'?160:250;
  return Number.isFinite(value)?Math.max(50,Math.min(maximum,value)):100;
}
function applyInlineStyleToElement(el,key){
  const st=getInlineStyleForDevice(key);
  if(typeof st.text==='string'&&el.textContent!==st.text&&el.contentEditable!=='true')el.textContent=st.text;
  el.style.fontWeight=st.bold?'700':'';
  el.style.fontStyle=st.italic?'italic':'';
  el.style.textAlign=st.align||'';
  const sizeScale=getInlineSizeScale(st,key);
  el.style.fontSize=sizeScale===100?'':`${getInlineBaseFontSize(el)*sizeScale/100}px`;
  const x=Number(st.x||0),y=Number(st.y||0);
  el.style.translate=x||y?`${x}px ${y}px`:'';
}

function ensureDesignPreviewRenderObserver(doc) {
  if (
    !doc ||
    doc.__designPreviewObserverInstalled
  ) {
    return;
  }

  if (!doc.documentElement) return;

  doc.__designPreviewObserverInstalled = true;

  let scheduled = false;

  const observer =
    new MutationObserver(() => {
      if (
        activeView !== 'design' ||
        scheduled ||
        designInlineActive
      ) {
        return;
      }

      scheduled = true;

      setTimeout(
        () => {
          scheduled = false;

          if (
            activeView === 'design'
          ) {
            applyDesignContentPreview();
          }
        },
        30
      );
    });

  observer.observe(
    doc.body || doc.documentElement,
    {
      childList: true,
      subtree: true
    }
  );
}

function decorateDesignInlinePreview(doc){
  if(!doc||activeView!=='design')return;
  const mobilePreview=designPreviewDevice==='mobile';
  doc.querySelectorAll('.filters .filter-btn').forEach(el=>{
    if(el.id?.startsWith('gallery-filter-'))el.removeAttribute('id');
    delete el.dataset.designEditable;
    delete el.dataset.designInlineEditable;
    delete el.dataset.designInlineKey;
    el.removeAttribute('title');
  });
  Object.entries(DESIGN_INLINE_FIELDS).forEach(([id,cfg])=>{
    const el=doc.getElementById(id); if(!el)return;
    el.dataset.designInlineEditable='1'; el.dataset.designInlineKey=id;
    el.title='Clique para editar este texto';
    applyInlineStyleToElement(el,id);
    if(el.dataset.designInlineBound==='1')return;
    el.dataset.designInlineBound='1';

    el.addEventListener(
      'click',
      ev => {
        ev.preventDefault();
        ev.stopPropagation();

        const initialOffset =
          getDesignEditableOffsetFromPoint(
            el,
            ev.clientX,
            ev.clientY
          );

        openDesignInlineEditor(
          el,
          cfg,
          id,
          initialOffset
        );
      }
    );
  });
  doc.querySelectorAll('[data-design-editable="1"][id]').forEach(el=>{
    if(el.closest('.nav')){
      delete el.dataset.designInlineEditable;
      delete el.dataset.designInlineKey;
      el.removeAttribute('title');
      return;
    }
    const key=el.id;if(DESIGN_INLINE_FIELDS[key]||el.dataset.designInlineBound==='1')return;
    const cfg={visual:true,label:'Elemento da página'};
    el.dataset.designInlineEditable='1';el.dataset.designInlineKey=key;el.dataset.designInlineBound='1';
    el.title='Clique para editar este elemento';applyInlineStyleToElement(el,key);
    el.addEventListener('click',ev=>{if(el.closest('.nav'))return;ev.preventDefault();ev.stopPropagation();openDesignInlineEditor(el,cfg,key,getDesignEditableOffsetFromPoint(el,ev.clientX,ev.clientY))});
  });
}

function getDesignEditableOffsetFromPoint(
  root,
  clientX,
  clientY
) {
  if (!root) return 0;

  const doc =
    root.ownerDocument;

  let node = null;
  let offset = 0;

  try {
    /*
      Chrome/Brave é mais consistente com caretRangeFromPoint
      quando o texto AINDA não está em contenteditable.
    */
    if (
      typeof doc.caretRangeFromPoint ===
      'function'
    ) {
      const range =
        doc.caretRangeFromPoint(
          clientX,
          clientY
        );

      node =
        range?.startContainer ||
        null;

      offset =
        Number(
          range?.startOffset || 0
        );
    } else if (
      typeof doc.caretPositionFromPoint ===
      'function'
    ) {
      const position =
        doc.caretPositionFromPoint(
          clientX,
          clientY
        );

      node =
        position?.offsetNode ||
        null;

      offset =
        Number(
          position?.offset || 0
        );
    }
  } catch (_) {}

  if (
    !node ||
    (
      node !== root &&
      !root.contains(node)
    )
  ) {
    return 0;
  }

  const range =
    doc.createRange();

  try {
    range.setStart(
      root,
      0
    );

    range.setEnd(
      node,
      offset
    );
  } catch (_) {
    return 0;
  }

  const fragment =
    range.cloneContents();

  const holder =
    doc.createElement('div');

  holder.appendChild(
    fragment
  );

  return serializeDesignEditableText(
    holder
  ).length;
}

function serializeDesignEditableText(root) {
  if (!root) return '';

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    if (node.tagName === 'BR') {
      return '\n';
    }

    const text =
      [...node.childNodes]
        .map(walk)
        .join('');

    if (
      node !== root &&
      /^(DIV|P)$/.test(node.tagName)
    ) {
      return `${text}\n`;
    }

    return text;
  };

  return walk(root)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function getDesignEditableCaretOffset(root) {
  if (!root) return 0;

  const doc = root.ownerDocument;
  const view = doc?.defaultView;
  const sel = view?.getSelection?.();

  if (!sel || !sel.rangeCount) {
    return serializeDesignEditableText(root).length;
  }

  const range = sel.getRangeAt(0);

  if (
    !root.contains(range.startContainer) &&
    range.startContainer !== root
  ) {
    return serializeDesignEditableText(root).length;
  }

  let total = 0;
  let found = false;

  function lengthOf(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.nodeValue || '').length;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return 0;
    if (node.tagName === 'BR') return 1;
    return [...node.childNodes].reduce((n, child) => n + lengthOf(child), 0);
  }

  function walk(node) {
    if (found) return;

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        total += Math.min(range.startOffset, (node.nodeValue || '').length);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const children = [...node.childNodes];
        for (let i = 0; i < Math.min(range.startOffset, children.length); i += 1) {
          total += lengthOf(children[i]);
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      total += (node.nodeValue || '').length;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.tagName === 'BR') {
      total += 1;
      return;
    }

    [...node.childNodes].forEach(walk);
  }

  walk(root);
  return total;
}

function setDesignEditableCaretOffset(root, wantedOffset) {
  if (!root) return;

  const doc = root.ownerDocument;
  const view = doc?.defaultView;
  const sel = view?.getSelection?.();
  if (!sel) return;

  let remaining = Math.max(0, Number(wantedOffset) || 0);
  let targetNode = root;
  let targetOffset = root.childNodes.length;
  let found = false;

  function visit(node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.nodeValue || '').length;
      if (remaining <= len) {
        targetNode = node;
        targetOffset = remaining;
        found = true;
      } else {
        remaining -= len;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.tagName === 'BR') {
      if (remaining <= 1) {
        targetNode = node.parentNode;
        targetOffset = [...node.parentNode.childNodes].indexOf(node) + 1;
        found = true;
      } else {
        remaining -= 1;
      }
      return;
    }

    [...node.childNodes].forEach(visit);
  }

  visit(root);

  try {
    const range = doc.createRange();
    range.setStart(targetNode, targetOffset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {}
}

function renderHeroTitleForEditing(el, text) {
  if (!el) return;

  const value = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = value.split('\n');
  let lastContentLine = lines.length - 1;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) {
      lastContentLine = i;
      break;
    }
  }

  el.innerHTML = lines
    .map((line, index) => {
      const clean = line;

      if (index !== lastContentLine) {
        return esc(clean);
      }

      const match = clean.match(/^(.*?)(\S+)\s*$/);
      if (!match) return esc(clean);

      const prefix = match[1] || '';
      const last = match[2] || '';

      return `${esc(prefix)}<em>${esc(last)}</em>`;
    })
    .join('<br>');
}

function syncHeroTitleSourceFromEditable(active = designInlineActive) {
  if (!active || active.key !== 'hero-title') return '';

  const input = $(active.cfg.input);
  if (!input) return '';

  const text = serializeDesignEditableText(active.el)
    .replace(/\n{3,}/g, '\n\n');

  input.value = text;
  active.textBuffer = text;
  return text;
}

function openDesignInlineEditor(el,cfg,key,initialOffset=null){
  if(designInlineActive&&designInlineActive.el!==el) finishDesignInline(false);

  const input = $(cfg.input);

  let sourceValue =
    input
      ? String(
          input.value || ''
        )
      : String(
          el.innerText ||
          el.textContent ||
          ''
        );

  /*
    Builds anteriores podiam unir exatamente “como” + “sempre”
    ao tentar inserir a quebra. Corrigimos somente esse caso conhecido
    para não obrigar o usuário a reparar manualmente o rascunho.
  */
  if (
    key === 'hero-title' &&
    /\bcomosempre\b/i.test(
      sourceValue
    )
  ) {
    sourceValue =
      sourceValue.replace(
        /\bcomosempre\b/gi,
        match => {
          const lower =
            match.toLowerCase();

          return lower === 'comosempre'
            ? 'como sempre'
            : 'como sempre';
        }
      );

    if (input) {
      input.value =
        sourceValue;
    }

    if (key === 'hero-title') {
      cmsFieldSet('inicio.hero.title', sourceValue);
    }
  }

  designInlineActive={
    el,
    cfg,
    key,
    originalText:(el.innerText||el.textContent||''),
    originalHTML:el.innerHTML,
    originalInputValue:sourceValue,
    textBuffer:sourceValue,
    explicitText:null,
    hasExplicitBreak:false,
    suppressInputSync:false,
    originalStyle:JSON.parse(JSON.stringify((window.__designInlineStyles||{})[key]||{}))
  };

  const isHeroTitle = key === 'hero-title';

  el.contentEditable='true';
  el.spellcheck=false;
  el.style.whiteSpace='pre-wrap';
  el.classList.add('design-inline-editing');

  /*
    Foca primeiro. Só depois o bloco do hero-title restaura
    a posição calculada a partir do clique.
  */
  el.focus({
    preventScroll:true
  });

  if (isHeroTitle) {
    /*
      IMPORTANTE:
      no primeiro clique NÃO reconstruímos o innerHTML.
      Mantemos exatamente o título que já está na prévia e apenas
      ativamos contenteditable. Isso preserva a geometria usada
      para calcular o ponto clicado.

      O HTML editorial só é reconstruído depois da primeira quebra
      ou ao salvar/atualizar a prévia.
    */
    const wantedOffset =
      Number(
        initialOffset
      );

    if (
      Number.isFinite(
        wantedOffset
      )
    ) {
      const restoreCaret =
        () => {
          setDesignEditableCaretOffset(
            el,
            wantedOffset
          );
        };

      /*
        Uma aplicação imediata + dois ciclos evita o browser
        sobrescrever a seleção no fim do evento de clique.
      */
      restoreCaret();

      requestAnimationFrame(
        restoreCaret
      );

      setTimeout(
        restoreCaret,
        0
      );

      setTimeout(
        restoreCaret,
        35
      );
    }
  }

  el.onkeydown=event=>{
    if(event.key!=='Enter') return;

    event.preventDefault();

    if (isHeroTitle) {
      const current =
        String(
          designInlineActive?.textBuffer ??
          input?.value ??
          ''
        );

      const offset =
        getDesignEditableCaretOffset(
          el
        );

      const safeOffset =
        Math.max(
          0,
          Math.min(
            offset,
            current.length
          )
        );

      const next =
        `${current.slice(
          0,
          safeOffset
        )}\n${current.slice(
          safeOffset
        )}`;

      if (input) {
        input.value =
          next;
      }

      designInlineActive.textBuffer =
        next;

      /*
        Guardamos separadamente o texto produzido pelo Enter.
        Algumas versões do Chromium podem emitir um input tardio
        depois da reconstrução visual do título. Esse evento não
        pode substituir a quebra que o usuário acabou de criar.
      */
      designInlineActive.explicitText =
        next;

      designInlineActive.hasExplicitBreak =
        true;

      designInlineActive.suppressInputSync =
        true;

      renderHeroTitleForEditing(
        el,
        next
      );

      requestAnimationFrame(
        () => {
          setDesignEditableCaretOffset(
            el,
            safeOffset + 1
          );

          if (
            designInlineActive
          ) {
            designInlineActive.suppressInputSync =
              false;
          }
        }
      );

      updateDesignPublicationState();

      dlog(
        '[admin-v2] editor visual: quebra manual criada',
        {
          offset:
            safeOffset,
          text:
            next,
          lines:
            next.split('\n')
        }
      );

      return;
    }

    const doc=el.ownerDocument||document;
    const view=doc.defaultView||window;
    const sel=view.getSelection?.();
    if(!sel||!sel.rangeCount)return;
    const range=sel.getRangeAt(0);
    range.deleteContents();
    const br=doc.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  el.oninput=()=>{
    if (isHeroTitle) {
      if (
        designInlineActive
          ?.suppressInputSync
      ) {
        return;
      }

      const liveText =
        serializeDesignEditableText(
          el
        )
          .replace(
            /\n{3,}/g,
            '\n\n'
          );

      if (
        designInlineActive
      ) {
        designInlineActive.textBuffer =
          liveText;

        /*
          Depois que o usuário continua digitando após um Enter,
          atualizamos também o texto explícito para manter a edição
          inteira coerente.
        */
        if (
          designInlineActive
            .hasExplicitBreak
        ) {
          designInlineActive.explicitText =
            liveText;
        }
      }

      if (input) {
        input.value =
          liveText;
      }
    }

    updateDesignPublicationState();
  };

  const box=$('design-inline-editor'); if(box)box.hidden=false;
  if($('design-inline-editor-label'))$('design-inline-editor-label').textContent=`${cfg.label} · Enter cria nova linha`;
  const st=getInlineStyleForDevice(key);
  const sizeScale=getInlineSizeScale(st,key);
  if($('design-inline-size'))$('design-inline-size').value=String(sizeScale);
  if($('design-inline-size-out'))$('design-inline-size-out').textContent=`${sizeScale}%`;
  if($('design-inline-x'))$('design-inline-x').value=String(Number(st.x||0));
  if($('design-inline-y'))$('design-inline-y').value=String(Number(st.y||0));
  document.querySelectorAll('[data-inline-command]').forEach(b=>b.classList.toggle('active',!!st[b.dataset.inlineCommand]));
  document.querySelectorAll('[data-inline-align]').forEach(b=>b.addEventListener ? b.classList.toggle('active',(st.align||'left')===b.dataset.inlineAlign) : null);
}
function previewInlineStyle(patch){
  if(!designInlineActive)return;
  window.__designInlineStyles=window.__designInlineStyles||{};
  const cur=window.__designInlineStyles[designInlineActive.key]||{};
  window.__designInlineStyles[designInlineActive.key]=designPreviewDevice==='mobile'
    ? {...cur,mobile:{...(cur.mobile||{}),...patch}}
    : {...cur,...patch};
  applyInlineStyleToElement(designInlineActive.el,designInlineActive.key);
  updateDesignPublicationState();
}
function finishDesignInline(save){
  const a=designInlineActive;if(!a)return;
  const input=$(a.cfg.input);

  if(save){
    if(input){
      input.value = a.key === 'hero-title'
        ? (a.textBuffer || input.value || '')
        : (a.el.textContent||'').trim();
      if (a.key === 'hero-title') cmsFieldSet('inicio.hero.title', input.value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }else{
    if (input && 'originalInputValue' in a) {
      input.value = a.originalInputValue;
      if (a.key === 'hero-title') cmsFieldSet('inicio.hero.title', a.originalInputValue);
    }
    a.el.innerHTML=a.originalHTML;
    window.__designInlineStyles=window.__designInlineStyles||{};
    window.__designInlineStyles[a.key]=a.originalStyle;
    applyInlineStyleToElement(a.el,a.key);
  }

  a.el.contentEditable='false';a.el.onkeydown=null;a.el.oninput=null;a.el.removeAttribute('spellcheck');a.el.style.removeProperty('white-space');a.el.classList.remove('design-inline-editing');designInlineActive=null;
  if($('design-inline-editor'))$('design-inline-editor').hidden=true;
  applyDesignContentPreview();updateDesignPublicationState();
}
async function saveDesignInline() {
  if (!designInlineActive) return;

  const active =
    designInlineActive;
  /*
    Os listeners dos campos podem reconstruir a prévia enquanto o botão
    Aplicar está sendo processado. Guardamos primeiro uma cópia imutável
    dos estilos (incluindo o bloco mobile) para que nenhum render intermédio
    consiga apagar o ajuste recém-feito.
  */
  const inlineStylesSnapshot=JSON.parse(JSON.stringify(window.__designInlineStyles||{}));

  const serializeInlineText=root=>{
    const walk=node=>{
      if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
      if(node.nodeType!==Node.ELEMENT_NODE)return '';
      if(node.tagName==='BR')return '\n';
      const text=[...node.childNodes].map(walk).join('');
      if(node!==root&&/^(DIV|P)$/.test(node.tagName))return `${text}\n`;
      return text;
    };
    return walk(root);
  };

  const heroSource =
    active.key === 'hero-title'
      ? (
          active.hasExplicitBreak &&
          typeof active.explicitText ===
            'string'
            ? active.explicitText
            : (
                active.textBuffer ||
                $(active.cfg.input)?.value ||
                ''
              )
        )
      : '';

  const newText =
    (
      active.key === 'hero-title'
        ? heroSource
        : serializeInlineText(active.el)
    )
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const input =
    $(active.cfg.input);

  if (!input) {
    if (active.cfg.visual) {
      window.__designInlineStyles=window.__designInlineStyles||{};
      window.__designInlineStyles[active.key]={...(window.__designInlineStyles[active.key]||{}),text:newText};
      const visualStylesSnapshot=JSON.parse(JSON.stringify(window.__designInlineStyles));
      active.el.textContent=newText;
      active.el.contentEditable='false';
      active.el.onkeydown=null;active.el.oninput=null;active.el.classList.remove('design-inline-editing');
      designInlineActive=null;
      if($('design-inline-editor'))$('design-inline-editor').hidden=true;
      try{
        const visualConfig=collectDesignConfig();
        visualConfig.inline_styles=visualStylesSnapshot;
        await saveDesignDraft(visualConfig);
        if(designDraftSaved)applyDesignConfigToControls(designDraftSaved);
        applyDesignContentPreview();
        requestAnimationFrame(()=>applyDesignContentPreview());
        setTimeout(()=>applyDesignContentPreview(),100);
        flash('Texto salvo no rascunho e aplicado à prévia.','sucesso');
      }catch(error){
        console.error('[admin-v2] editor visual: erro ao salvar elemento visual',error);
        flash(`Erro ao salvar o texto: ${error.message}`,'erro');
      }
      return;
    }
    console.error(
      '[admin-v2] editor visual: campo de origem não encontrado',
      active.cfg.input
    );

    flash(
      'Não foi possível localizar o campo deste texto.',
      'erro'
    );

    return;
  }

  /*
    Fixa a fonte única da verdade ANTES de qualquer outra coisa.
    A partir daqui, collectHeroContentPayload() (usado tanto por
    collectDesignConfig() quanto por collectDesignContentSnapshot(),
    ou seja, tanto o salvamento quanto a prévia) vai usar este valor
    em memória em vez de reler $('hero-title').value — eliminando o
    ponto onde a quebra de linha se perdia.
  */
  if (active.key === 'hero-title') {
    cmsFieldSet('inicio.hero.title', newText);
  }

  /*
    O input do CMS é a fonte do rascunho.
    É importante atualizá-lo ANTES de fechar a edição e
    antes de coletar collectDesignConfig().
  */
  input.value =
    newText;

  /*
    Verificação defensiva: se por qualquer motivo o próprio campo do
    DOM não preservar o valor exatamente como foi escrito (ex.: alguma
    normalização do navegador ou de outro listener), reforçamos a
    escrita uma segunda vez. O cmsState (já fixado acima via
    cmsFieldSet) continua correto de qualquer forma — é ele quem
    collectHeroContentPayload() realmente usa — mas isto mantém o
    campo visível coerente com o que o utilizador digitou.
  */
  if (
    active.key === 'hero-title' &&
    input.value !== newText
  ) {
    dwarn(
      '[admin-v2] editor visual: campo hero-title divergiu após escrita, reforçando valor.',
      { esperado: newText, obtido: input.value }
    );
    input.value = newText;
  }

  /*
    Para o hero-title não disparámos os listeners genéricos aqui.
    O valor já está no textarea, e saveDesignDraft() coleta esse
    textarea diretamente. Isso evita qualquer rotina antiga de input
    reprocessar o título antes do rascunho ser persistido.
  */
  if (
    active.key !== 'hero-title'
  ) {
    input.dispatchEvent(
      new Event(
        'input',
        { bubbles: true }
      )
    );

    input.dispatchEvent(
      new Event(
        'change',
        { bubbles: true }
      )
    );
  }

  const editedKey =
    active.key;

  active.el.contentEditable =
    'false';

  active.el.onkeydown =
    null;

  active.el.oninput =
    null;

  active.el.removeAttribute(
    'spellcheck'
  );

  active.el.style.removeProperty(
    'white-space'
  );

  active.el.classList.remove(
    'design-inline-editing'
  );

  designInlineActive =
    null;

  if ($('design-inline-editor')) {
    $('design-inline-editor').hidden =
      true;
  }

  dlog(
    '[admin-v2] editor visual: salvando',
    {
      key: editedKey,
      input: active.cfg.input,
      text: newText,
      lines: newText.split('\n'),
      sourceField: input.value,
      usedExplicitBreak:
        active.key === 'hero-title'
          ? !!active.hasExplicitBreak
          : false
    }
  );

  try {
    let forcedConfig =collectDesignConfig();
    forcedConfig.inline_styles=inlineStylesSnapshot;

    if (
      editedKey === 'hero-title'
    ) {
      forcedConfig.content =
        forcedConfig.content &&
        typeof forcedConfig.content === 'object'
          ? JSON.parse(
              JSON.stringify(
                forcedConfig.content
              )
            )
          : {
              inicio: {
                hero: {}
              }
            };

      forcedConfig.content.inicio =
        forcedConfig.content.inicio ||
        {};

      forcedConfig.content.inicio.hero =
        forcedConfig.content.inicio.hero ||
        {};

      /*
        Fonte de verdade absoluta:
        o texto exato criado pelo editor visual.
        Não importa se o textarea foi alterado por algum listener antigo.
      */
      forcedConfig.content.inicio.hero.title =
        newText;

      input.value =
        newText;

      dlog(
        '[admin-v2] editor visual: config forçado antes do save',
        {
          title:
            forcedConfig
              .content
              .inicio
              .hero
              .title,
          lines:
            forcedConfig
              .content
              .inicio
              .hero
              .title
              .split('\n'),
          textarea:
            input.value
        }
      );
    }

    await saveDesignDraft(
      forcedConfig
    );

    if (
      editedKey === 'hero-title'
    ) {
      const persistedDraftTitle =
        designDraftSaved
          ?.content
          ?.inicio
          ?.hero
          ?.title;

      dlog(
        '[admin-v2] editor visual: título gravado no draft',
        {
          title:
            persistedDraftTitle || '',
          lines:
            String(
              persistedDraftTitle || ''
            ).split('\n')
        }
      );

      /*
        O draft recém-salvo volta para os controles.
        Isso elimina qualquer valor antigo que algum listener tenha
        deixado no textarea antes do save.
      */
    }

    /* Recarrega sempre o rascunho confirmado, inclusive no modo celular. */
    if (designDraftSaved) {
      applyDesignConfigToControls(
        designDraftSaved
      );
    }

    /*
      A página /inicio possui o próprio carregador CMS.
      Em algumas condições ele pode terminar um render logo
      depois do clique. Reaplicamos o rascunho em alguns
      frames curtos para garantir que a prévia do Designer
      permaneça como fonte visual.
    */
    applyDesignContentPreview();

    requestAnimationFrame(
      () => {
        applyDesignContentPreview();
      }
    );

    setTimeout(
      () => {
        applyDesignContentPreview();
      },
      80
    );

    setTimeout(
      () => {
        applyDesignContentPreview();

        const doc =
          getDesignPreviewDocument();

        const target =
          doc?.getElementById(
            editedKey
          );

        dlog(
          '[admin-v2] editor visual: prévia confirmada',
          {
            key: editedKey,
            renderedText:
              target?.innerText?.trim() ||
              target?.textContent?.trim() ||
              '',
            sourceField:
              editedKey === 'hero-title'
                ? $('hero-title')?.value
                : undefined,
            draftTitle:
              editedKey === 'hero-title'
                ? designDraftSaved
                    ?.content
                    ?.inicio
                    ?.hero
                    ?.title
                : undefined
          }
        );
      },
      260
    );

    flash(
      'Texto salvo no rascunho. A prévia foi atualizada; o site público ainda não foi alterado.',
      'sucesso'
    );
  } catch (error) {
    console.error(
      '[admin-v2] editor visual: erro ao salvar',
      error
    );

    flash(
      `Erro ao salvar o texto: ${error.message}`,
      'erro'
    );
  }
}
function bindDesignInlineToolbar(){
  if(document.body.dataset.inlineToolbarBound==='1')return;document.body.dataset.inlineToolbarBound='1';
  $('design-inline-discard')?.addEventListener('click',()=>finishDesignInline(false));
  $('design-inline-save')?.addEventListener('click',saveDesignInline);
  $('design-inline-size')?.addEventListener('input',e=>{
    const maximum=designPreviewDevice==='mobile'&&designInlineActive?.key==='hero-title'?160:250;
    const sizeScale=Math.max(50,Math.min(maximum,Number(e.target.value||100)));
    e.target.value=String(sizeScale);
    if($('design-inline-size-out'))$('design-inline-size-out').textContent=`${sizeScale}%`;
    previewInlineStyle({size_scale:sizeScale});
  });
  $('design-inline-x')?.addEventListener('input',e=>previewInlineStyle({x:Number(e.target.value||0)}));
  $('design-inline-y')?.addEventListener('input',e=>previewInlineStyle({y:Number(e.target.value||0)}));
  document.querySelectorAll('[data-inline-command]').forEach(b=>b.addEventListener('click',()=>{if(!designInlineActive)return;const k=b.dataset.inlineCommand,cur=getInlineStyleForDevice(designInlineActive.key);previewInlineStyle({[k]:!cur[k]});b.classList.toggle('active',!cur[k]);}));
  document.querySelectorAll('[data-inline-align]').forEach(b=>b.addEventListener('click',()=>{previewInlineStyle({align:b.dataset.inlineAlign});document.querySelectorAll('[data-inline-align]').forEach(x=>x.classList.toggle('active',x===b));}));
}
function applyDesignWhatsappPreview(doc){
  if(!doc)return; let btn=doc.getElementById('rs-whatsapp-float-preview');
  const enabled=cmsFieldGet('design.whatsapp.enabled',$('design-whatsapp-enabled')?.checked)!==false, num=(cmsFieldGet('design.whatsapp.number',$('design-whatsapp-number')?.value||'')||'').replace(/\D/g,''), msg=encodeURIComponent(cmsFieldGet('design.whatsapp.message',$('design-whatsapp-message')?.value||'')||''), pos=cmsFieldGet('design.whatsapp.position',$('design-whatsapp-position')?.value||'right'), style=cmsFieldGet('design.whatsapp.style',$('design-whatsapp-style')?.value||'editorial');
  let path='inicio';try{const p=doc.location.pathname;if(p.includes('galeria'))path='galeria';else if(p.includes('sobre'))path='sobre';else if(p.includes('contato'))path='contato';}catch(_){}
  const allowed=$('design-whatsapp-page-'+path)?.checked!==false;
  if(!enabled||!num||!allowed){btn?.remove();return;}
  if(!btn){btn=doc.createElement('a');btn.id='rs-whatsapp-float-preview';btn.target='_blank';btn.rel='noopener';btn.setAttribute('aria-label','Fale comigo pelo WhatsApp');btn.innerHTML='<span class="rs-wa-icon" aria-hidden="true"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.04 3.2A12.73 12.73 0 0 0 5.1 22.43L3.4 28.8l6.52-1.7A12.8 12.8 0 1 0 16.04 3.2Zm0 23.32c-2.04 0-4.03-.55-5.77-1.58l-.41-.24-3.87 1.01 1.03-3.76-.27-.43a10.5 10.5 0 1 1 9.29 5Zm5.76-7.87c-.32-.16-1.87-.92-2.16-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.33-.49-2.54-1.57a9.5 9.5 0 0 1-1.76-2.19c-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.71-.97-2.35-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.67.76.24 1.44.21 1.99.13.61-.09 1.87-.77 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.14-.29-.21-.61-.37Z"/></svg></span><b>Fale comigo</b>';doc.body.appendChild(btn);}
  btn.href='https://wa.me/'+num+(msg?'?text='+msg:'');btn.className='rs-whatsapp-float is-'+style+(pos==='left'?' is-left':'');
}
function applyDesignContentPreview(){
  if(activeView!=='design')return;
  const doc=getDesignPreviewDocument();if(!doc)return;
  const isNextPage=Boolean(doc.querySelector('script[src*="/_next/"]'));
  if(isNextPage&&doc.documentElement?.dataset?.reactHydrated!=='1'){
    if(!doc.__designHydrationWaitBound){
      doc.__designHydrationWaitBound=true;
      doc.defaultView?.addEventListener('rangel:hydrated',()=>{doc.__designHydrationWaitBound=false;applyDesignContentPreview()},{once:true});
    }
    return;
  }
  /*
    A página Next também possui o aplicador dos estilos publicados.
    Dentro do Designer ele não pode competir com o rascunho, senão a
    atualização publicada desfaz a edição logo após o clique em Aplicar.
    A marca só é adicionada depois da hidratação, portanto não cria mismatch.
  */
  if(doc.documentElement)doc.documentElement.dataset.designPreviewActive='1';
  ensureDesignPreviewRenderObserver(doc);
  const s=collectDesignContentSnapshot();let path='';try{path=doc.location.pathname}catch(_){return}
  if(path==='/'||path==='/inicio'||path.endsWith('/inicio.html'))applyInicioDesignPreview(doc,s);
  if(path==='/sobre'||path.endsWith('/sobre.html'))applySobreDesignPreview(doc,s);
  if(path==='/contato'||path.endsWith('/contato.html'))applyContatoDesignPreview(doc,s);
  if(path==='/galeria'||path.endsWith('/galeria.html'))applyTrailDraftPreview(doc);
  decorateDesignInlinePreview(doc);applyTrailDraftPreview(doc);
  const nested=doc.querySelector('iframe.legacy-frame');
  try{if(nested?.contentDocument){ensureDesignPreviewRenderObserver(nested.contentDocument);decorateDesignInlinePreview(nested.contentDocument);applyTrailDraftPreview(nested.contentDocument)}}catch(_){}
  applyDesignWhatsappPreview(doc);
}
function openDesignContentSection(page, trigger) {
  if (page === 'client_area') {
    openDesignDrawer(
      'client_area',
      trigger
    );
    return;
  }
  const drawer = $('design-controls-drawer');
  const host = $('design-content-host');
  const controls =
    drawer?.querySelector('.design-controls');

  if (!drawer || !host) return;

  setView('design');
  portalHeroContentModals();

  drawer.hidden = false;
  drawer.classList.add(
    'is-open',
    'is-content-editor'
  );

  /*
    O Conteúdo é um editor grande, não um flyout compacto.
    Removemos qualquer posição inline deixada pelos painéis
    Cabeçalho / Animações / etc.
  */
  [
    'width',
    'left',
    'right',
    'top',
    'bottom',
    'max-height'
  ].forEach(prop =>
    drawer.style.removeProperty(prop)
  );

  if (controls) {
    controls.hidden = true;
  }

  host.hidden = false;

  ['inicio', 'sobre', 'contato']
    .forEach(name => {
      const panel =
        $(`content-panel-${name}`);

      if (panel) {
        panel.hidden =
          name !== page;
      }
    });

  document
    .querySelectorAll(
      '[data-design-content]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.designContent === page
      );
    });

  const titles = {
    inicio: 'Conteúdo · Início',
    sobre: 'Conteúdo · Sobre',
    contato: 'Conteúdo · Contato'
  };

  if ($('design-controls-drawer-title')) {
    $('design-controls-drawer-title').textContent =
      titles[page] || 'Conteúdo';
  }

  drawer.scrollTop = 0;

  routeDesignPreview(
    page === 'inicio'
      ? '/inicio'
      : `/${page}`
  );

  setTimeout(
    applyDesignContentPreview,
    180
  );
}

function initDesignContentNavigation(){const t=$('design-content-toggle');if(t&&t.dataset.bound!=='1'){t.dataset.bound='1';t.addEventListener('click',e=>{e.stopPropagation();setDesignContentExpanded(t.getAttribute('aria-expanded')!=='true')})}document.querySelectorAll('[data-design-content]').forEach(b=>{if(b.dataset.bound==='1')return;b.dataset.bound='1';b.addEventListener('click',e=>{e.stopPropagation();openDesignContentSection(b.dataset.designContent,b)})})}

function setDesignNavExpanded(expanded) {
  const toggle = $('design-nav-toggle');
  const submenu = $('design-nav-submenu');

  if (!toggle || !submenu) return;

  toggle.setAttribute(
    'aria-expanded',
    expanded ? 'true' : 'false'
  );

  submenu.hidden = !expanded;

  toggle
    .closest('.design-nav-group')
    ?.classList.toggle(
      'is-open',
      Boolean(expanded)
    );

  portalHeroContentModals();
}

function positionDesignDrawerNearTrigger(drawer, trigger) {
  if (!drawer || !trigger) return;

  const sidebar =
    document.querySelector('.admin-sidebar');

  const sidebarRect =
    sidebar?.getBoundingClientRect();

  const triggerRect =
    trigger.getBoundingClientRect();

  const gap = 10;
  const margin = 10;

  const drawerWidth =
    Math.min(
      390,
      Math.max(
        300,
        window.innerWidth -
          (sidebarRect?.right || triggerRect.right) -
          gap -
          margin
      )
    );

  drawer.style.width =
    `${drawerWidth}px`;

  const left =
    Math.min(
      window.innerWidth -
        drawerWidth -
        margin,
      (sidebarRect?.right || triggerRect.right) + gap
    );

  drawer.style.left =
    `${Math.max(margin, left)}px`;

  drawer.style.right = 'auto';
  drawer.style.bottom = 'auto';

  /*
    O topo acompanha exatamente o subitem clicado,
    criando a sensação de que o painel "nasce" à direita do nome.
  */
  const desiredTop =
    triggerRect.top - 4;

  requestAnimationFrame(() => {
    const drawerHeight =
      Math.min(
        drawer.scrollHeight,
        window.innerHeight - margin * 2
      );

    const maxTop =
      Math.max(
        margin,
        window.innerHeight -
          drawerHeight -
          margin
      );

    drawer.style.top =
      `${Math.max(
        margin,
        Math.min(
          desiredTop,
          maxTop
        )
      )}px`;

    drawer.style.maxHeight =
      `${window.innerHeight - margin * 2}px`;
  });
}

function openDesignDrawer(sectionName, trigger = null) {
  const drawer = $('design-controls-drawer');
  if (!drawer) return;

  setView?.('design');

  if (sectionName === 'client_area') {
    const frame = $('design-preview-frame');
    if (frame) {
      const currentPath = (() => {
        try { return new URL(frame.src, location.origin).pathname; }
        catch (_) { return ''; }
      })();

      if (currentPath !== '/area-cliente' && currentPath !== '/area-cliente.html') {
        frame.src = '/area-cliente';
      }
    }
  }

  drawer.hidden = false;
  drawer.classList.remove(
    'is-content-editor',
    'is-client-area-editor'
  );

  drawer.classList.toggle(
    'is-client-area-editor',
    sectionName === 'client_area'
  );

  const contentHost = $('design-content-host');
  const designControls = drawer.querySelector('.design-controls');
  if (contentHost) contentHost.hidden = true;
  if (designControls) designControls.hidden = false;

  document
    .querySelectorAll('.design-accordion')
    .forEach(section => {
      const selected =
        section.dataset.designSection === sectionName;

      section.classList.toggle(
        'is-selected',
        selected
      );

      setDesignAccordionOpen(
        section,
        selected
      );
    });

  const selected =
    document.querySelector(
      `.design-accordion[data-design-section="${sectionName}"]`
    );

  const title =
    selected
      ?.querySelector('.design-accordion-toggle span')
      ?.textContent
      ?.trim();

  if ($('design-controls-drawer-title')) {
    $('design-controls-drawer-title').textContent =
      title || 'Configurações';
  }

  drawer.classList.add('is-open');

  const source =
    trigger ||
    document.querySelector(
      `[data-design-jump="${sectionName}"]`
    );

  positionDesignDrawerNearTrigger(
    drawer,
    source
  );

  drawer.scrollTop = 0;
}

function closeDesignDrawer() {
  const drawer = $('design-controls-drawer');
  if (!drawer) return;

  drawer.classList.remove(
    'is-open',
    'is-content-editor',
    'is-client-area-editor'
  );

  drawer.style.removeProperty('width');
  drawer.style.removeProperty('left');
  drawer.style.removeProperty('right');
  drawer.style.removeProperty('top');
  drawer.style.removeProperty('bottom');
  drawer.style.removeProperty('max-height');

  setTimeout(() => {
    if (!drawer.classList.contains('is-open')) {
      drawer.hidden = true;
    }
  }, 180);
}

function initDesignSidebarNavigation() {
  const toggle = $('design-nav-toggle');

  if (toggle && toggle.dataset.bound !== '1') {
    toggle.dataset.bound = '1';

    toggle.addEventListener('click', () => {
      setDesignNavExpanded(false);
      setView?.('design');
      setTimeout(()=>document.querySelector('.design-preview-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
    });
  }

  document
    .querySelectorAll('[data-design-jump]')
    .forEach(button => {
      if (button.dataset.bound === '1') return;

      button.dataset.bound = '1';

      button.addEventListener('click', event => {
        event.stopPropagation();

        openDesignDrawer(
          button.dataset.designJump,
          button
        );
      });
    });

  const close = $('design-controls-close');

  if (close && close.dataset.bound !== '1') {
    close.dataset.bound = '1';
    close.addEventListener('click', closeDesignDrawer);
  }
}



function updateDesignClientFocalUI() {
  const x =
    clampNumber(
      $('design-client-focus-x')?.value,
      0,
      100,
      50
    );

  const y =
    clampNumber(
      $('design-client-focus-y')?.value,
      0,
      100,
      50
    );

  const marker =
    $('design-client-focal-marker');

  if (marker) {
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
  }

  const summary =
    $('design-client-focal-summary');

  if (summary) {
    summary.textContent =
      `Ponto focal: ${Math.round(x)}% × ${Math.round(y)}% — clique na foto para alterar.`;
  }

  const preview =
    $('design-client-access-image-preview');

  if (preview) {
    preview.style.backgroundPosition =
      focalStyle(x, y);
  }
}

function setDesignClientFocalFromPointer(event) {
  const preview =
    $('design-client-access-image-preview');

  if (
    !preview ||
    preview.classList.contains('empty')
  ) {
    return;
  }

  setFocalFromClick(
    preview,
    event,
    (x, y) => {
      $('design-client-focus-x').value =
        String(x);

      $('design-client-focus-y').value =
        String(y);

      updateDesignClientFocalUI();
      applyDesignPreview();
      updateDesignPublicationState();
    }
  );
}

function applyDesignClientTextPreview(doc = getDesignPreviewDocument()) {
  if (!doc) return;

  const setText =
    (selector, value) => {
      const el =
        doc.querySelector(selector);

      if (el) {
        el.textContent =
          value ?? '';
      }
    };

  setText(
    '#client-visual-text',
    $('design-client-text-visual')?.value ||
    DESIGN_DEFAULTS.client_text_visual
  );

  setText(
    '#client-access-eyebrow',
    $('design-client-text-eyebrow')?.value ||
    DESIGN_DEFAULTS.client_text_eyebrow
  );

  setText(
    '#client-access-title-main',
    $('design-client-text-title')?.value ||
    DESIGN_DEFAULTS.client_text_title
  );

  setText(
    '#client-access-title-emphasis',
    $('design-client-text-title-emphasis')?.value ||
    DESIGN_DEFAULTS.client_text_title_emphasis
  );

  setText(
    '#client-access-description',
    $('design-client-text-description')?.value ||
    DESIGN_DEFAULTS.client_text_description
  );

  setText(
    '#client-login-label',
    $('design-client-text-login')?.value ||
    DESIGN_DEFAULTS.client_text_login
  );

  setText(
    '#client-password-label',
    $('design-client-text-password')?.value ||
    DESIGN_DEFAULTS.client_text_password
  );

  setText(
    '#client-access-submit',
    $('design-client-text-button')?.value ||
    DESIGN_DEFAULTS.client_text_button
  );

  setText(
    '#client-access-secure-text',
    $('design-client-text-secure')?.value ||
    DESIGN_DEFAULTS.client_text_secure
  );

  setText(
    '#client-gallery-eyebrow',
    $('design-client-text-gallery-eyebrow')?.value ||
    DESIGN_DEFAULTS.client_text_gallery_eyebrow
  );

  setText(
    '#client-stage-selection',
    $('design-client-stage-selection')?.value ||
    DESIGN_DEFAULTS.client_stage_selection
  );

  setText(
    '#client-stage-selection-sub',
    $('design-client-stage-selection-sub')?.value ||
    DESIGN_DEFAULTS.client_stage_selection_sub
  );

  setText(
    '#client-stage-editing',
    $('design-client-stage-editing')?.value ||
    DESIGN_DEFAULTS.client_stage_editing
  );

  setText(
    '#client-stage-editing-sub',
    $('design-client-stage-editing-sub')?.value ||
    DESIGN_DEFAULTS.client_stage_editing_sub
  );

  setText(
    '#client-stage-delivery',
    $('design-client-stage-delivery')?.value ||
    DESIGN_DEFAULTS.client_stage_delivery
  );

  setText(
    '#client-stage-delivery-sub',
    $('design-client-stage-delivery-sub')?.value ||
    DESIGN_DEFAULTS.client_stage_delivery_sub
  );
}

function updateDesignClientImagePreview() {
  const preview =
    $('design-client-access-image-preview');

  if (!preview) return;

  const url =
    safeText(
      $('design-client-access-image')?.value,
      2048
    );

  preview.style.backgroundImage =
    url
      ? `url("${url.replace(/"/g, '%22')}")`
      : '';

  preview.classList.toggle(
    'empty',
    !url
  );

  const emptyLabel =
    preview.querySelector(
      '.design-client-image-empty'
    );

  if (emptyLabel) {
    emptyLabel.textContent =
      url
        ? ''
        : 'Nenhuma imagem adicionada';
  }

  if (!url) {
    preview.style.removeProperty(
      'aspect-ratio'
    );

    updateDesignClientFocalUI();
    return;
  }

  const img =
    new Image();

  img.onload = () => {
    const width =
      Number(
        img.naturalWidth || 0
      );

    const height =
      Number(
        img.naturalHeight || 0
      );

    if (
      width > 0 &&
      height > 0 &&
      $('design-client-access-image')?.value === url
    ) {
      preview.style.aspectRatio =
        `${width} / ${height}`;
    }

    updateDesignClientFocalUI();
  };

  img.onerror = () => {
    preview.style.removeProperty(
      'aspect-ratio'
    );

    updateDesignClientFocalUI();
  };

  img.src = url;
}

async function uploadDesignClientImage(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`client-area/${Date.now()}-${Math.random().toString(36).slice(2,9)}.${ext}`;const {error}=await uploadToBucket(BUCKET,path,file,{cacheControl:'3600',upsert:false});if(error)throw error;return getPublicUrlFromBucket(BUCKET,path).data?.publicUrl||''}

function updateDesignPageSwitcher(pathname='/inicio'){
  const normalized=pathname==='/'?'/inicio':pathname.replace(/\/$/,'')||'/inicio';
  document.querySelectorAll('[data-design-page]').forEach(button=>{
    button.classList.toggle('active',button.dataset.designPage===normalized);
  });
  const openLink=document.querySelector('.design-preview-toolbar a');
  if(openLink)openLink.href=normalized;
  const address=document.querySelector('.design-browser-bar span');
  if(address)address.textContent=`photosrangel.pt${normalized}`;
}

function initDesignPageSwitcher(){
  const frame=$('design-preview-frame');
  if(!frame||frame.dataset.pageSwitcherBound==='1')return;
  frame.dataset.pageSwitcherBound='1';
  document.querySelectorAll('[data-design-page]').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(designInlineActive)await saveDesignInline();
      const path=button.dataset.designPage||'/inicio';
      updateDesignPageSwitcher(path);setDesignPreviewLoading(true);frame.src=path;
    });
  });
  frame.addEventListener('load',()=>{
    try{updateDesignPageSwitcher(frame.contentWindow?.location?.pathname||'/inicio')}catch(_){ }
  });
  updateDesignPageSwitcher('/inicio');
}

const designPanelSnapshots=new WeakMap();
function designPanelFields(panel){
  const selector='input,select,textarea';
  const fields=[...panel.querySelectorAll(selector)];
  if(panel.dataset.inlinePanel==='hero')document.querySelectorAll('[id^="hero-"]').forEach(field=>{if(field.matches?.(selector)&&!fields.includes(field))fields.push(field)});
  return fields;
}
function captureDesignPanelSnapshot(panel,force=false){
  if(!force&&designPanelSnapshots.has(panel))return;
  designPanelSnapshots.set(panel,designPanelFields(panel).map(field=>({field,value:field.value,checked:field.checked})));
}
function discardDesignPanel(panel){
  const snapshot=designPanelSnapshots.get(panel)||[];
  snapshot.forEach(({field,value,checked})=>{field.value=value;if('checked'in field)field.checked=checked;field.dispatchEvent(new Event('change',{bubbles:true}))});
  updateHeroModeUI();updateStaticFocalPreview();renderHeroSlideshowOverview();applyDesignPreview();applyDesignContentPreview();updateDesignPublicationState();
  flash('Alterações deste painel descartadas.','sucesso');
}
function initDesignPanelsReorder(){
  const stack=$('design-inline-panels'),button=$('design-panels-reorder');if(!stack||!button||button.dataset.bound==='1')return;button.dataset.bound='1';
  try{const order=JSON.parse(localStorage.getItem('rangel-design-panel-order')||'[]');const map=new Map([...stack.querySelectorAll(':scope>.design-stack-panel')].map(x=>[x.dataset.inlinePanel,x]));order.forEach(key=>{const panel=map.get(key);if(panel)stack.appendChild(panel)})}catch(_){}
  let active=false,dragged=null;const panels=()=>[...stack.querySelectorAll(':scope>.design-stack-panel')];
  const mode=value=>{active=value;stack.classList.toggle('is-reordering',value);button.setAttribute('aria-pressed',String(value));button.textContent=value?'Concluir reordenação':'Reordenar painéis';panels().forEach(p=>p.draggable=value)};
  stack.addEventListener('dragstart',event=>{const panel=event.target.closest('.design-stack-panel');if(!active||!panel)return event.preventDefault();dragged=panel;panel.classList.add('is-panel-dragging')});
  stack.addEventListener('dragover',event=>{const target=event.target.closest('.design-stack-panel');if(!active||!dragged||!target||target===dragged)return;event.preventDefault();const rect=target.getBoundingClientRect();stack.insertBefore(dragged,event.clientY<rect.top+rect.height/2?target:target.nextSibling)});
  stack.addEventListener('dragend',()=>{dragged?.classList.remove('is-panel-dragging');dragged=null});
  button.addEventListener('click',()=>{if(active){try{localStorage.setItem('rangel-design-panel-order',JSON.stringify(panels().map(p=>p.dataset.inlinePanel)))}catch(_){}mode(false);flash('Ordem dos painéis guardada.','sucesso')}else mode(true)});mode(false);
}

function initDesignInlinePanels(){
  const stack=$('design-inline-panels');
  if(!stack||stack.dataset.bound==='1')return;
  stack.dataset.bound='1';

  const preview=document.querySelector('.design-preview-panel');
  const pageSwitcher=document.querySelector('.design-page-switcher');
  const previewStage=$('design-preview-stage');
  if(preview&&pageSwitcher&&previewStage)preview.insertBefore(pageSwitcher,previewStage);

  const previewToggle=$('design-preview-collapse');
  previewToggle?.addEventListener('click',()=>{
    const collapsed=preview.classList.toggle('is-collapsed');
    previewToggle.setAttribute('aria-expanded',String(!collapsed));
    previewToggle.setAttribute('aria-label',collapsed?'Expandir prévia':'Recolher prévia');
    if(!collapsed)setTimeout(sizeDesignPreview,40);
  });

  const heroForm=$('form-hero');
  const heroPanel=heroForm?.closest('.panel');
  const heroHost=$('design-inline-hero');
  if(heroPanel&&heroHost){
    heroHost.appendChild(heroPanel);
    const submit=heroForm.querySelector('button[type="submit"]');
    if(submit)submit.textContent='Aplicar na prévia';
  }

  ['menu','animations','general','whatsapp','galleries','client_area'].forEach(name=>{
    const section=document.querySelector(`.design-accordion[data-design-section="${name}"]`);
    const host=$(`design-inline-${name}`);
    if(!section||!host)return;
    host.appendChild(section);section.classList.add('is-open');
    const body=section.querySelector('.design-accordion-body');
    if(body)body.hidden=false;
  });

  document.querySelectorAll('.design-stack-panel').forEach(panel=>{
    const toggle=panel.querySelector('.design-stack-toggle');
    const body=panel.querySelector('.design-stack-body');
    toggle?.addEventListener('click',()=>{
      const open=!panel.classList.contains('is-open');
      panel.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
      if(body)body.hidden=!open;
      if(open){
        captureDesignPanelSnapshot(panel);
        if(panel.dataset.inlinePanel==='hero'){
          updateHeroModeUI();updateStaticFocalPreview();renderHeroSlideshowOverview();
        }
        setTimeout(()=>{sizeDesignPreview();panel.scrollIntoView({behavior:'smooth',block:'start'});},40);
      }
    });
    if(body&&!body.querySelector('.design-panel-actions')){
      const actions=document.createElement('div');actions.className='design-panel-actions';
      actions.innerHTML='<button type="button" class="btn" data-panel-discard>Descartar painel</button><button type="button" class="btn btn-accent" data-panel-save>Salvar painel</button>';
      body.appendChild(actions);
      actions.querySelector('[data-panel-discard]')?.addEventListener('click',()=>discardDesignPanel(panel));
      actions.querySelector('[data-panel-save]')?.addEventListener('click',async()=>{applyDesignPreview();applyDesignContentPreview();await saveDesignDraft();captureDesignPanelSnapshot(panel,true);flash('Painel salvo. Use “Publicar alterações no site” para atualizar o site real.','sucesso')});
    }
  });

  const publication=document.querySelector('.design-publication-panel');
  const designView=$('view-design');
  if(publication&&designView)designView.insertBefore(publication,designView.firstElementChild);
  const deviceSwitch=document.querySelector('.design-device-switch');
  if(pageSwitcher&&deviceSwitch)pageSwitcher.appendChild(deviceSwitch);
  if($('design-preview-label'))$('design-preview-label').innerHTML='<strong>Prévia responsiva</strong><small>Computador · 1920 × 1080</small>';
  const reorder=$('design-panels-reorder');
  const publicationActions=document.querySelector('.design-publication-actions');
  if(reorder&&publicationActions)publicationActions.insertBefore(reorder,publicationActions.firstChild);
  initDesignPanelsReorder();
  const drawer=$('design-controls-drawer');
  if(drawer){drawer.classList.remove('is-open');drawer.hidden=true;}
}

function initDesignStudio() {
  bindDesignInlineToolbar();
  initDesignAccordions();
  initDesignSidebarNavigation();
  initDesignContentMigration();
  initDesignInlinePanels();
  initDesignContentNavigation();
  initDesignContentOrderDnD();
  initDesignPageSwitcher();

  if (designStudioReady) {
    ensureDesignPersistenceLoaded().catch(() => {});

    setTimeout(() => {
      applyDesignPreview();
      sizeDesignPreview();
      updateDesignPublicationState();
      maybeShowDesignDraftReminder();
    }, 50);
    return;
  }

  designStudioReady = true;

  let initialDesignDevice='desktop';
  try{initialDesignDevice=localStorage.getItem('rangel-design-preview-device')==='mobile'?'mobile':'desktop'}catch(_){}
  setDesignDevice(initialDesignDevice);

  $('design-device-desktop')?.addEventListener('click', () => setDesignDevice('desktop'));
  $('design-device-mobile')?.addEventListener('click', () => setDesignDevice('mobile'));

  let designAnimationReplayTimer = null;

  [
    'design-nav-style',
    'design-nav-position',
    'design-nav-density',
    'design-logo-scale',
    'design-nav-cta',
    'design-nav-blur',
    'design-page-animation',
    'design-section-animation',
    'design-image-hover',
    'design-motion-speed',
    'design-type-scale',
    'design-content-width',
    'design-section-space',
    'design-hero-overlay',
    'design-gallery-gap',
    'design-image-radius',
    'design-client-layout',
    'design-client-gallery-style',
    'design-client-photo-size',
    'design-client-typography',
    'design-client-border',
    'design-client-access-image',
    'design-client-focus-x',
    'design-client-focus-y',
    'design-client-text-visual',
    'design-client-text-eyebrow',
    'design-client-text-title',
    'design-client-text-title-emphasis',
    'design-client-text-description',
    'design-client-text-login',
    'design-client-text-password',
    'design-client-text-button',
    'design-client-text-secure',
    'design-client-text-gallery-eyebrow',
    'design-client-stage-selection',
    'design-client-stage-selection-sub',
    'design-client-stage-editing',
    'design-client-stage-editing-sub',
    'design-client-stage-delivery',
    'design-client-stage-delivery-sub',
    'design-client-status-preparing',
    'design-client-status-awaiting',
    'design-client-status-selected',
    'design-client-status-editing',
    'design-client-status-ready'
  ].forEach(id => {
    const handler = () => {
      applyDesignPreview();
      updateDesignPublicationState();
      if (['design-page-animation','design-section-animation','design-motion-speed'].includes(id)) {
        clearTimeout(designAnimationReplayTimer);
        designAnimationReplayTimer = setTimeout(replayDesignAnimations, 90);
      }
    };

    $(id)?.addEventListener('input', handler);
    $(id)?.addEventListener('change', handler);
  });

  $('design-replay-animation')?.addEventListener(
    'click',
    replayDesignAnimations
  );

  $('design-reset')?.addEventListener('click', resetDesignPreview);

  $('design-save-draft')?.addEventListener('click', saveDesignDraft);
  $('design-restore-published')?.addEventListener('click', restorePublishedDesign);
  $('design-publish')?.addEventListener('click', publishDesign);
  $('design-client-access-image-preview')?.addEventListener(
    'pointerdown',
    setDesignClientFocalFromPointer
  );

  $('design-client-access-image-file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const {validos,rejeitados}=validarImagens([file]);if(rejeitados.length){$('design-client-access-image-msg').textContent=rejeitados.join(' · ');e.target.value='';return}try{$('design-client-access-image-msg').textContent='Enviando fotografia...';const url=await withOperationLock('design-client-image-upload',()=>uploadDesignClientImage(validos[0]));if(url?.skipped)return;$('design-client-access-image').value=url||'';updateDesignClientImagePreview();applyDesignPreview();updateDesignPublicationState();$('design-client-access-image-msg').textContent='Fotografia adicionada ao rascunho.'}catch(error){$('design-client-access-image-msg').textContent=`Erro no upload: ${error.message}`}finally{e.target.value=''}});
  $('design-client-access-image-remove')?.addEventListener('click',()=>{$('design-client-access-image').value='';updateDesignClientImagePreview();applyDesignPreview();updateDesignPublicationState();$('design-client-access-image-msg').textContent='Imagem removida do rascunho.'});
  updateDesignClientImagePreview();
  if(document.body.dataset.designContentLiveBound!=='1'){document.body.dataset.designContentLiveBound='1';const live=e=>{if(activeView!=='design'||!e.target.closest('.content-panel,#design-inline-hero,.design-stack-body'))return;applyDesignPreview();applyDesignContentPreview();updateDesignPublicationState()};document.addEventListener('input',live);document.addEventListener('change',live)}
  loadContent().then(()=>ensureDesignPersistenceLoaded()).catch(()=>{});

  const designPreviewFrame = $('design-preview-frame');
  let lastDesignPreviewLoadUrl = '';
  let lastDesignPreviewLoadAt = 0;

  const handleDesignPreviewLoad = async () => {
    let currentUrl = '';
    try { currentUrl = designPreviewFrame?.contentWindow?.location?.href || designPreviewFrame?.src || ''; }
    catch (_) { currentUrl = designPreviewFrame?.src || ''; }

    const now = Date.now();
    if (currentUrl === lastDesignPreviewLoadUrl && now - lastDesignPreviewLoadAt < 750) return;
    lastDesignPreviewLoadUrl = currentUrl;
    lastDesignPreviewLoadAt = now;

    setDesignPreviewLoading(true);

    const loadingFallback = setTimeout(
      () => setDesignPreviewLoading(false),
      4200
    );

    await waitForDesignPreviewHydration(designPreviewFrame);

    /*
      No primeiro F5 a hidratação da página costuma terminar antes da
      consulta do rascunho. A prévia só pode ser marcada como preparada
      depois que as duas etapas estiverem concluídas; assim ela já nasce
      com o mesmo estado visto ao navegar e voltar para Início.
    */
    try {
      await ensureDesignPersistenceLoaded();
    } catch (error) {
      console.warn('[admin-v2] prévia sem rascunho carregado:',error);
    }

    const hydratedDoc = designPreviewFrame?.contentDocument;
    refreshDesignPreviewStylesheet(hydratedDoc);
    if (hydratedDoc?.documentElement?.dataset?.designPreviewPrepared === '1') {
      clearTimeout(loadingFallback);
      setDesignPreviewLoading(false);
      return;
    }
    if (hydratedDoc?.documentElement) {
      hydratedDoc.documentElement.dataset.designPreviewPrepared = '1';
    }

    setTimeout(() => {
      try {
        designPreviewFrame?.contentWindow?.scrollTo(0, 0);
        applyDesignPreview();
        applyDesignContentPreview();
        setTimeout(() => { try { applyDesignContentPreview(); } catch (_) {} }, 180);
        setTimeout(() => { try { applyDesignContentPreview(); } catch (_) {} }, 420);
        sizeDesignPreview();
        installDesignPreviewNavigationGuard();
        runDesignPageTransition();
      } catch (error) {
        console.warn('[admin-v2] preview parcial:', error);
      } finally {
        clearTimeout(loadingFallback);
        setTimeout(() => setDesignPreviewLoading(false), 180);
      }
    }, 0);
  };

  designPreviewFrame?.addEventListener('load', handleDesignPreviewLoad);

  if (designPreviewFrame?.contentDocument?.readyState === 'complete') {
    handleDesignPreviewLoad();
  }

  setTimeout(() => {
    try {
      if (designPreviewFrame?.contentDocument?.readyState === 'complete') {
        setDesignPreviewLoading(false);
      }
    } catch (_) {}
  }, 1800);

  const stage = $('design-preview-stage');
  if (stage && 'ResizeObserver' in window) {
    designPreviewResizeObserver = new ResizeObserver(() => sizeDesignPreview());
    designPreviewResizeObserver.observe(stage);
  }

  window.addEventListener('resize', () => {
    sizeDesignPreview();

    const drawer =
      $('design-controls-drawer');

    if (
      drawer &&
      !drawer.hidden &&
      drawer.classList.contains('is-open')
    ) {
      const selected =
        drawer.querySelector(
          '.design-accordion.is-selected'
        );

      const name =
        selected?.dataset.designSection;

      const trigger =
        name
          ? document.querySelector(
              `[data-design-jump="${name}"]`
            )
          : null;

      if (trigger) {
        positionDesignDrawerNearTrigger(
          drawer,
          trigger
        );
      }
    }
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(sizeDesignPreview, 120);
  });

  setDesignDevice(initialDesignDevice);
  setTimeout(() => {
    applyDesignPreview();
    sizeDesignPreview();
  }, 140);
  updateDesignClientFocalUI();
}
