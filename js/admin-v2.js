import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const ADMIN_ID = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a';
const BUCKET = 'site-gallery';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log('[admin-v2] Build v49 — editor visual: quebras de linha preservadas');

const $ = id => document.getElementById(id);

let currentGallery = null;
let categoriesCache = [];
let galleriesCache = [];
let sessionsCache = [];
let currentSession = null;
let currentSessionPhotos = [];
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
  const { count, error } = await supabase
    .from('mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('lida', false);

  if (error) {
    console.warn(
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

  const { count, error } = await supabase
    .from('ensaios')
    .select('id', { count: 'exact', head: true })
    .in('status', statuses);

  if (error) {
    console.warn(
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

  console.log('[admin-v2] Realtime mensagens:', event, row?.id || '');

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

  console.log(
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

  adminRealtimeChannel = supabase
    .channel('admin-v2-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mensagens'
      },
      payload => {
        handleRealtimeMessage(payload)
          .catch(error => console.error('[admin-v2] Realtime mensagens falhou:', error));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ensaios'
      },
      payload => {
        handleRealtimeEnsaio(payload)
          .catch(error => console.error('[admin-v2] Realtime ensaios falhou:', error));
      }
    )
    .subscribe(status => {
      console.log('[admin-v2] Realtime:', status);
    });
}

async function stopAdminRealtime() {
  if (!adminRealtimeChannel) return;

  const channel = adminRealtimeChannel;
  adminRealtimeChannel = null;

  try {
    await supabase.removeChannel(channel);
  } catch (error) {
    console.warn('[admin-v2] Falha ao encerrar Realtime:', error);
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

    const { data, error } = await supabase.functions.invoke(
      'contact-notifications',
      {
        body: {
          action: 'reply',
          message_id: messageId,
          reply_text: replyText,
          attachments
        }
      }
    );

    if (error) throw error;
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
  } = await supabase.auth.getSession();

  console.log(
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
    await supabase.auth.signOut().catch(() => {});

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
    await supabase.auth.signOut();

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
      console.log('[admin-v2] login: iniciando signInWithPassword', safeText($('login-email').value, 254));
      const resultado = await Promise.race([
        supabase.auth.signInWithPassword({
          email: safeText($('login-email').value, 254).toLowerCase(),
          password: $('login-password').value
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ]);

      console.log(
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
    await supabase.auth.signOut();
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

async function loadDashboard() {

  if (!document.body.dataset.adminUiBooted) {
    document.body.dataset.adminUiBooted = '1';
    loadAdminUiSettings();
  }

  console.log('[admin-v2] loadDashboard: iniciando');

  const consultar = async () => {
    const [
      a,
      b,
      c,
      m
    ] = await Promise.all([
      supabase
        .from('galleries')
        .select('id,published'),

      supabase
        .from('categories')
        .select('id'),

      supabase
        .from('gallery_photos')
        .select('id,published'),

      supabase
        .from('mensagens')
        .select('id')
        .eq('lida', false)
        .then(
          r => r,
          () => ({ data: [] })
        )
    ]);

    return { a, b, c, m };
  };


  let resultado =
    await consultar();


  let falhas = [
    resultado.a,
    resultado.b,
    resultado.c,
    resultado.m
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

    console.warn(
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
      resultado.m
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
}


/* =========================================================
   CATEGORIAS
========================================================= */

async function loadCategories() {

  const {
    data,
    error
  } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) {
    flash(
      `Erro ao carregar categorias: ${error.message}`,
      'erro'
    );

    return;
  }

  categoriesCache = data || [];

  renderCategorySelect();
  renderCategories();
}


function renderCategorySelect() {

  const s = $('gallery-category');
  const cur = s.value;

  s.innerHTML =
    '<option value="">Sem categoria</option>' +
    categoriesCache
      .map(
        c =>
          `<option value="${c.id}">
            ${esc(c.name)}
          </option>`
      )
      .join('');

  s.value = cur;
}


function renderCategories() {

  const c = $('categories-list');

  if (!categoriesCache.length) {

    c.innerHTML =
      '<p class="panel-copy">Nenhuma categoria cadastrada.</p>';

    return;
  }

  c.innerHTML =
    categoriesCache
      .map(
        x => `
          <div class="category-row">

            <div class="category-name">
              ${esc(x.name)}
            </div>

            <div class="category-slug">
              ${esc(x.slug)}
            </div>

            <div class="category-order">
              ${x.sort_order}
            </div>

            <div class="card-actions">

              <button
                class="small-btn"
                data-edit-category="${x.id}"
              >
                Editar
              </button>

              <button
                class="small-btn"
                data-delete-category="${x.id}"
              >
                Excluir
              </button>

            </div>

          </div>
        `
      )
      .join('');


  c
    .querySelectorAll('[data-edit-category]')
    .forEach(b => {

      b.addEventListener(
        'click',
        () => editCategory(
          b.dataset.editCategory
        )
      );

    });


  c
    .querySelectorAll('[data-delete-category]')
    .forEach(b => {

      b.addEventListener(
        'click',
        () => withOperationLock('delete-category:' + b.dataset.deleteCategory, () => deleteCategory(
          b.dataset.deleteCategory
        ))
      );

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
    };

    const r = id
      ? await supabase.from('categories').update(p).eq('id', id)
      : await supabase.from('categories').insert(p);

    if (r.error) {
      msg($('category-msg'), r.error.message, 'erro');
      return;
    }

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
  } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

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

  const {
    data: galleries,
    error: galleriesError
  } = await supabase
    .from('galleries')
    .select('*, categories(name)')
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    );

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
  } = await supabase
    .from('categories')
    .select('*')
    .eq('published', true)
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'name',
      {
        ascending: true
      }
    );

  if (categoriesError) {

    flash(
      `Erro ao carregar categorias: ${categoriesError.message}`,
      'erro'
    );

    return;
  }

  categoriesCache =
    categories || [];

  renderGalleries();
  renderCategorySelect();
}


function renderGalleries() {

  const c = $('galleries-list');

  if (!galleriesCache.length) {
    c.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Ainda vazio</p>
        <h2 style="font-family:var(--font-display);font-weight:400;">
          Nenhuma galeria criada.
        </h2>
        <p class="panel-copy" style="margin-top:8px;">
          Comece criando a primeira galeria do novo CMS.
        </p>
      </div>
    `;
    return;
  }

  c.innerHTML = galleriesCache.map(g => `
    <article
      class="gallery-admin-card"
      data-gallery-id="${attr(g.id)}"
      draggable="true"
      title="Arraste para mudar a posição da galeria"
    >
      <div class="gallery-drag-handle"
        title="Arraste para mudar a posição ou clique para usar como capa"
        aria-label="Arraste para mudar a posição"
      >⋮⋮</div>

      <div class="gallery-thumb-wrap">
        ${
          g.cover_url
            ? `<img class="gallery-thumb" src="${attr(g.cover_url)}" alt="Capa da galeria ${attr(g.title)}" loading="lazy"><span class="gallery-cover-label">CAPA</span>`
            : `<div class="gallery-thumb empty">SEM CAPA</div>`
        }
      </div>

      <div class="gallery-card-content">
        <div class="gallery-card-title">${esc(g.title)}</div>
        <div class="gallery-meta">
          /${esc(g.slug)}
          ${g.categories?.name ? ` · ${esc(g.categories.name)}` : ''}
        </div>
      </div>

      <div class="gallery-card-controls">
        <span class="status-pill ${g.published ? 'published' : 'draft'}">
          ${g.published ? 'PUBLICADA' : 'OCULTA'}
        </span>

        <div class="card-actions gallery-card-actions">
          <button class="small-btn" data-photos="${attr(g.id)}" type="button">Fotos</button>
          <button class="small-btn" data-edit-gallery="${attr(g.id)}" type="button">Editar</button>
          <button class="small-btn" data-toggle-gallery="${attr(g.id)}" type="button">
            ${g.published ? 'Ocultar' : 'Publicar'}
          </button>
          <button class="small-btn danger-btn" data-delete-gallery="${attr(g.id)}" type="button">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  // Abre a galeria ao clicar no cartão inteiro, como já acontece em Ensaios.
  c.querySelectorAll('.gallery-admin-card').forEach(card => {
    card.addEventListener('click', e => {
      if (
        e.target.closest('button') ||
        e.target.closest('a') ||
        e.target.closest('.gallery-drag-handle')
      ) {
        return;
      }
      openGalleryModal(card.dataset.galleryId);
    });
  });

  c.querySelectorAll('[data-photos]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      openGalleryModal(b.dataset.photos);
    });
  });

  c.querySelectorAll('[data-edit-gallery]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      editGallery(b.dataset.editGallery);
    });
  });

  c.querySelectorAll('[data-toggle-gallery]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      withOperationLock('toggle-gallery:' + b.dataset.toggleGallery, () => toggleGallery(b.dataset.toggleGallery));
    });
  });

  c.querySelectorAll('[data-delete-gallery]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      withOperationLock('delete-gallery:' + b.dataset.deleteGallery, () => deleteGallery(b.dataset.deleteGallery));
    });
  });

  configurarOrdenacaoGalerias();
}

/* =========================================================
   ORDENAÇÃO DAS GALERIAS
========================================================= */

function configurarOrdenacaoGalerias() {

  const container =
    $('galleries-list');

  if (!container) return;

  let draggedCard = null;

  const cards = [
    ...container.querySelectorAll(
      '.gallery-admin-card'
    )
  ];


  cards.forEach(card => {


    const handle = card.querySelector('.gallery-drag-handle');

    if (handle) {
      handle.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        card.dataset.dragArmed = '1';
        card.draggable = true;
      });
      handle.addEventListener('mousedown', () => {
        card.dataset.dragArmed = '1';
        card.draggable = true;
      });
    }

    card.addEventListener(
      'dragstart',
      event => {

        if (card.dataset.dragArmed !== '1') {
          event.preventDefault();
          card.draggable = false;
          return;
        }

        draggedCard = card;

        card.classList.add(
          'is-dragging'
        );

        event.dataTransfer.effectAllowed =
          'move';

        event.dataTransfer.setData(
          'text/plain',
          card.dataset.galleryId
        );

      }
    );


    card.addEventListener(
      'dragover',
      event => {

        event.preventDefault();

        if (
          !draggedCard ||
          draggedCard === card
        ) {
          return;
        }

        event.dataTransfer.dropEffect =
          'move';

        const rect =
          card.getBoundingClientRect();

        /*
          Grade responsiva: considera eixo Y e X.
          Assim o arrastar continua natural quando as galerias
          ficam lado a lado, e não apenas em uma lista vertical.
        */
        const centerY =
          rect.top + rect.height / 2;

        const centerX =
          rect.left + rect.width / 2;

        const sameRow =
          Math.abs(event.clientY - centerY) <
          rect.height * .38;

        const after =
          event.clientY > centerY ||
          (
            sameRow &&
            event.clientX > centerX
          );

        container.insertBefore(
          draggedCard,
          after ? card.nextSibling : card
        );

        container
          .querySelectorAll(
            '.gallery-admin-card'
          )
          .forEach(item => {

            item.classList.remove(
              'drag-over'
            );

          });

        card.classList.add(
          'drag-over'
        );

      }
    );


    card.addEventListener(
      'drop',
      event => {

        event.preventDefault();
        event.stopPropagation();

        card.classList.remove(
          'drag-over'
        );

      }
    );


    card.addEventListener(
      'dragend',
      async () => {

        if (!draggedCard) {
          return;
        }

        draggedCard.classList.remove(
          'is-dragging'
        );

        container
          .querySelectorAll(
            '.gallery-admin-card'
          )
          .forEach(item => {

            item.classList.remove(
              'drag-over'
            );

          });

        draggedCard = null;
        card.dataset.dragArmed = '0';
        card.draggable = false;

        await salvarOrdemGalerias();

      }
    );


    card.addEventListener(
      'dragleave',
      event => {

        if (
          !card.contains(
            event.relatedTarget
          )
        ) {

          card.classList.remove(
            'drag-over'
          );

        }

      }
    );

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

        return supabase
          .from('galleries')
          .update({
            sort_order: index + 1
          })
          .eq('id', id);

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

  $('gallery-category').value =
    g?.category_id || '';

  $('gallery-description').value =
    g?.description || '';

  $('gallery-cover').value =
    g?.cover_url || '';

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
      cover_url: coverUrl || null,
      sort_order: clampNumber($('gallery-order').value, 0, 9999, 0)
    };

    const r = id
      ? await supabase.from('galleries').update(p).eq('id', id).select().single()
      : await supabase.from('galleries').insert(p).select().single();

    if (r.error) {
      msg($('gallery-form-msg'), r.error.message, 'erro');
      return;
    }

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


function editGallery(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (g) {

    openGalleryForm(g);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }
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
  } = await supabase
    .from('galleries')
    .update({
      published: novoEstado
    })
    .eq('id', id);


  if (galleryError) {

    flash(
      `Erro ao alterar a galeria: ${galleryError.message}`,
      'erro'
    );

    return;
  }


  const {
    error: photosError
  } = await supabase
    .from('gallery_photos')
    .update({
      published: novoEstado
    })
    .eq('gallery_id', id);


  if (photosError) {

    await supabase
      .from('galleries')
      .update({
        published: g.published
      })
      .eq('id', id);


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

  const g =
    galleriesCache.find(
      x => x.id === id
    );


  if (
    !g ||
    !confirm(
      `Excluir "${g.title}" e todas as suas fotografias? Esta ação não pode ser desfeita.`
    )
  ) {
    return;
  }


  const {
    data: photos,
    error: qerr
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,image_url'
    )
    .eq(
      'gallery_id',
      id
    );


  if (qerr) {

    flash(
      `Erro ao localizar fotos: ${qerr.message}`,
      'erro'
    );

    return;
  }


  const paths =
    (photos || [])
      .map(
        p =>
          storagePath(
            p.image_url
          )
      )
      .filter(Boolean);


  if (paths.length) {

    const {
      error
    } = await supabase
      .storage
      .from(BUCKET)
      .remove(paths);


    if (error) {

      flash(
        `Não foi possível apagar os arquivos: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  const {
    error
  } = await supabase
    .from('galleries')
    .delete()
    .eq('id', id);


  if (error) {

    flash(
      `Erro ao excluir galeria: ${error.message}`,
      'erro'
    );

    return;
  }


  flash(
    'Galeria excluída.',
    'sucesso'
  );


  await loadGalleries();
  await loadDashboard();
}


/* =========================================================
   MODAL DA GALERIA
========================================================= */

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
  } = await supabase
    .from('galleries')
    .select('*')
    .eq(
      'id',
      currentGallery.id
    )
    .single();


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
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,gallery_id,image_url,alt_text,sort_order,published,created_at'
    )
    .eq(
      'gallery_id',
      currentGallery.id
    )
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'created_at',
      {
        ascending: true
      }
    );


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


  $('photo-count').textContent =
    `${photos.length} fotografia${
      photos.length === 1
        ? ''
        : 's'
    }`;


  if (!photos.length) {

    $('photo-grid').innerHTML =
      '<p class="panel-copy" style="grid-column:1/-1;padding:20px;">Nenhuma fotografia nesta galeria.</p>';

    return;
  }


  $('photo-grid').innerHTML =
    photos
      .map(
        (x, index) => `

          <div
            class="
              admin-photo
              ${
                currentGallery.cover_url ===
                x.image_url
                  ? 'admin-photo-cover'
                  : ''
              }
              ${
                x.published
                  ? 'photo-is-published'
                  : 'photo-is-hidden'
              }
            "
            data-photo-id="${attr(x.id)}"
            draggable="true"
            title="Arraste para reorganizar ou clique na fotografia para definir como capa"
          >

            <img
              src="${attr(x.image_url)}"
              alt="${attr(
                x.alt_text ||
                currentGallery.title ||
                ''
              )}"
              loading="lazy"
              onerror="this.parentElement.classList.add('photo-load-error')"
            >

            <span class="photo-order">
              ${index + 1}
            </span>

            ${
              currentGallery.cover_url ===
              x.image_url
                ? '<span class="photo-cover-label">CAPA</span>'
                : ''
            }

            <button
              class="photo-status ${
                x.published
                  ? 'published'
                  : 'hidden'
              }"
              data-toggle-photo="${attr(x.id)}"
              title="${
                x.published
                  ? 'Ocultar fotografia do site'
                  : 'Publicar fotografia no site'
              }"
              type="button"
            >
              ${
                x.published
                  ? '✓ PUBLICADA'
                  : '○ OCULTA'
              }
            </button>

            <button
              class="photo-delete"
              data-delete-photo="${attr(x.id)}"
              title="Excluir fotografia"
              type="button"
            >
              ×
            </button>

          </div>

        `
      )
      .join('');


  const grid =
    $('photo-grid');


  grid
    .querySelectorAll('.admin-photo')
    .forEach(el => {

      const pht =
        photos.find(
          x =>
            x.id ===
            el.dataset.photoId
        );


      el.addEventListener(
        'click',
        e => {

          if (
            e.target.closest(
              '.photo-delete'
            ) ||
            e.target.closest(
              '.photo-status'
            )
          ) {
            return;
          }


          if (pht) {
            withOperationLock('cover-gallery:' + (currentGallery?.id || ''), () => setCover(pht));
          }

        }
      );


      el.addEventListener(
        'dragstart',
        e => {

          el.classList.add(
            'is-dragging'
          );

          e.dataTransfer.effectAllowed =
            'move';

          e.dataTransfer.setData(
            'text/plain',
            el.dataset.photoId
          );

        }
      );


      el.addEventListener(
        'dragend',
        () => {

          el.classList.remove(
            'is-dragging'
          );

          grid
            .querySelectorAll(
              '.admin-photo'
            )
            .forEach(item =>
              item.classList.remove(
                'drag-over'
              )
            );

          savePhotoOrder();

        }
      );


      el.addEventListener(
        'dragover',
        e => {

          e.preventDefault();

          const dragging =
            grid.querySelector(
              '.is-dragging'
            );


          if (
            !dragging ||
            dragging === el
          ) {
            return;
          }


          const rect =
            el.getBoundingClientRect();


          const after =
            e.clientY >
            rect.top +
            rect.height / 2;


          grid.insertBefore(
            dragging,
            after
              ? el.nextSibling
              : el
          );


          el.classList.add(
            'drag-over'
          );

        }
      );


      el.addEventListener(
        'dragleave',
        () => {

          el.classList.remove(
            'drag-over'
          );

        }
      );


      el.addEventListener(
        'drop',
        e => {

          e.preventDefault();

          el.classList.remove(
            'drag-over'
          );

        }
      );

    });


  grid
    .querySelectorAll(
      '[data-toggle-photo]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          withOperationLock('toggle-photo:' + button.dataset.togglePhoto, () => togglePhotoPublished(
            button.dataset.togglePhoto
          ));

        }
      );

    });


  grid
    .querySelectorAll(
      '[data-delete-photo]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          withOperationLock('delete-photo:' + button.dataset.deletePhoto, () => deletePhoto(
            button.dataset.deletePhoto
          ));

        }
      );

    });

}


/* =========================================================
   PUBLICAR / OCULTAR FOTO
========================================================= */

async function togglePhotoPublished(id) {

  const {
    data: photo,
    error: findError
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,published'
    )
    .eq(
      'id',
      id
    )
    .single();


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
  } = await supabase
    .from('gallery_photos')
    .update({
      published:
        novoEstado
    })
    .eq(
      'id',
      id
    );


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
    } = await supabase
      .from('gallery_photos')
      .update({
        sort_order:
          item.sort_order
      })
      .eq(
        'id',
        item.id
      );


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


  const q =
    await supabase
      .from('gallery_photos')
      .select('sort_order')
      .eq(
        'gallery_id',
        g.id
      )
      .order(
        'sort_order',
        {
          ascending: false
        }
      )
      .limit(1);


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


    const up =
      await supabase
        .storage
        .from(BUCKET)
        .upload(
          path,
          file,
          {
            upsert: false
          }
        );


    if (up.error) {

      msg(
        $('upload-msg'),
        `Erro no upload de ${file.name}: ${up.error.message}`,
        'erro'
      );

      continue;
    }


    const {
      data: url
    } =
      supabase
        .storage
        .from(BUCKET)
        .getPublicUrl(path);


    order++;


    const ins =
      await supabase
        .from('gallery_photos')
        .insert({
          gallery_id:
            g.id,

          image_url:
            url.publicUrl,

          alt_text:
            g.title,

          sort_order:
            order,

          published:
            g.published === true
        });


    if (ins.error) {

      await supabase
        .storage
        .from(BUCKET)
        .remove([path]);


      msg(
        $('upload-msg'),
        `Erro ao registrar ${file.name}: ${ins.error.message}`,
        'erro'
      );

    }

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
  } = await supabase
    .from('galleries')
    .select('cover_url')
    .eq(
      'id',
      id
    )
    .single();


  if (g?.cover_url) {
    return;
  }


  const {
    data: p
  } =
    await supabase
      .from('gallery_photos')
      .select('image_url')
      .eq(
        'gallery_id',
        id
      )
      .order(
        'sort_order'
      )
      .limit(1)
      .maybeSingle();


  if (p?.image_url) {

    await supabase
      .from('galleries')
      .update({
        cover_url:
          p.image_url
      })
      .eq(
        'id',
        id
      );

  }
}


async function setCover(p) {

  if (!currentGallery) {
    return;
  }


  const {
    error
  } = await supabase
    .from('galleries')
    .update({
      cover_url:
        p.image_url
    })
    .eq(
      'id',
      currentGallery.id
    );


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

  const {
    data: p,
    error: q
  } = await supabase
    .from('gallery_photos')
    .select('*')
    .eq(
      'id',
      id
    )
    .single();


  if (
    q ||
    !p
  ) {

    flash(
      'Fotografia não encontrada.',
      'erro'
    );

    return;
  }


  if (
    !confirm(
      'Excluir esta fotografia?'
    )
  ) {
    return;
  }


  const path =
    storagePath(
      p.image_url
    );


  if (path) {

    const {
      error
    } = await supabase
      .storage
      .from(BUCKET)
      .remove([path]);


    if (error) {

      flash(
        `Erro ao excluir arquivo: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  const {
    error
  } = await supabase
    .from('gallery_photos')
    .delete()
    .eq(
      'id',
      id
    );


  if (error) {

    flash(
      `Erro ao excluir registro: ${error.message}`,
      'erro'
    );

    return;
  }


  if (
    currentGallery.cover_url ===
    p.image_url
  ) {

    await supabase
      .from('galleries')
      .update({
        cover_url:
          null
      })
      .eq(
        'id',
        currentGallery.id
      );


    await ensureCover(
      currentGallery.id
    );


    await refreshGalleryCache(
      currentGallery.id
    );

  }


  flash(
    'Fotografia excluída.',
    'sucesso'
  );


  await loadPhotos();
  await loadGalleries();
  await loadDashboard();
}


/* =========================================================
   CACHE
========================================================= */

async function refreshGalleryCache(id) {

  const {
    data
  } = await supabase
    .from('galleries')
    .select('*, categories(name)')
    .eq(
      'id',
      id
    )
    .single();


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

function storagePathForBucket(url, bucket) {
  const marker =
    `/storage/v1/object/public/${bucket}/`;

  const i =
    (url || '').indexOf(marker);

  if (i === -1) {
    return null;
  }

  return decodeURIComponent(
    url.slice(
      i + marker.length
    )
  );
}

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
        const { data: existing, error: selectError } =
          await supabase
            .from('site_content')
            .select('id')
            .eq('slug', 'admin')
            .eq('section_key', 'interface')
            .limit(1)
            .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        const row = {
          slug: 'admin',
          section_key: 'interface',
          content: normalizeAdminUiConfig(
            adminUiConfig
          ),
          updated_at:
            new Date().toISOString()
        };

        const result =
          existing?.id
            ? await supabase
                .from('site_content')
                .update(row)
                .eq('id', existing.id)
            : await supabase
                .from('site_content')
                .insert(row);

        if (result.error) {
          throw result.error;
        }
      } catch (error) {
        console.warn(
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
      await supabase
        .from('site_content')
        .select('content')
        .eq('slug', 'admin')
        .eq('section_key', 'interface')
        .limit(1)
        .maybeSingle();

    if (error) {
      console.warn(
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
    console.warn(
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

    const { data: existing, error: selectError } =
      await supabase
        .from('site_content')
        .select('id')
        .eq('slug', 'admin')
        .eq('section_key', 'interface')
        .limit(1)
        .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    const row = {
      slug: 'admin',
      section_key: 'interface',
      content: payload,
      updated_at:
        new Date().toISOString()
    };

    const result =
      existing?.id
        ? await supabase
            .from('site_content')
            .update(row)
            .eq('id', existing.id)
        : await supabase
            .from('site_content')
            .insert(row);

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
  } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();


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

    const { data: ex } = await supabase.from('site_settings').select('id').limit(1).maybeSingle();
    const r = ex?.id
      ? await supabase.from('site_settings').update(p).eq('id', ex.id)
      : await supabase.from('site_settings').insert(p);

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
  const { data } = await supabase
    .from('site_content')
    .select('slug, section_key, content');

  const map = { inicio: {}, sobre: {}, contato: {} };

  (data || []).forEach(row => {
    if (!map[row.slug]) return;

    let content = row.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); }
      catch (e) { content = {}; }
    }

    map[row.slug][row.section_key] = content || {};
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
  $('hero-eyebrow').value = h.eyebrow || '';
  $('hero-title').value = h.title || '';
  $('hero-description').value = h.description || '';
  $('hero-desktop-image').value = h.desktop_image || '';
  $('hero-mobile-image').value = h.mobile_image || '';
  $('hero-image-alt').value = h.image_alt || '';
  const heroMode = h.mode === 'slideshow' ? 'slideshow' : 'static';
  $('hero-mode-static').checked = heroMode === 'static';
  $('hero-mode-slideshow').checked = heroMode === 'slideshow';
  $('hero-static-focus-x').value = Number(h.static_focus_x ?? 50);
  $('hero-static-focus-y').value = Number(h.static_focus_y ?? 50);
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

  const { data: existing } = await supabase
    .from('site_content')
    .select('id')
    .eq('slug', slug)
    .eq('section_key', sectionKey)
    .maybeSingle();

  const row = {
    slug,
    section_key: sectionKey,
    content: payload,
    updated_at: new Date().toISOString()
  };

  const r = existing?.id
    ? await supabase.from('site_content').update(row).eq('id', existing.id)
    : await supabase.from('site_content').insert(row);

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


function updateStaticMobilePreview() {
  const preview = $('hero-static-mobile-preview');
  if (!preview) return;

  const desktopUrl = safeText($('hero-desktop-image')?.value, 2048);
  const mobileUrl = safeText($('hero-mobile-image')?.value, 2048);
  const activeUrl = mobileUrl || desktopUrl;

  preview.style.backgroundImage = activeUrl
    ? `url("${activeUrl.replace(/"/g, '%22')}")`
    : '';

  preview.style.backgroundPosition = focalStyle(
    Number($('hero-static-focus-x')?.value) || 50,
    Number($('hero-static-focus-y')?.value) || 50
  );

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
  const url = $('hero-desktop-image').value.trim();
  const x = Number($('hero-static-focus-x').value) || 50;
  const y = Number($('hero-static-focus-y').value) || 50;
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
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
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

$('hero-desktop-image').addEventListener('input', updateStaticFocalPreview);
$('hero-mobile-image').addEventListener('input', updateStaticMobilePreview);

$('hero-static-preview').addEventListener('click', e => {
  setFocalFromClick($('hero-static-preview'), e, (x, y) => {
    $('hero-static-focus-x').value = x;
    $('hero-static-focus-y').value = y;
    updateStaticFocalPreview();
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

  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .order('created_at', { ascending: false })
    .then(
      r => r,
      () => ({
        data: null,
        error: { message: 'tabela-inexistente' }
      })
    );

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

  if (!rows.length) {
    list.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Nenhuma mensagem</p>
        <p class="panel-copy">As mensagens enviadas pelo formulário da página de contato aparecerão aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = rows.map(m => `
    <article class="msg-card ${m.lida ? '' : 'nao-lida'}">
      <div class="msg-card-head">
        <div>
          <div class="msg-card-nome">${esc(m.nome)}</div>
          <div class="msg-card-meta">${esc(m.email || '')}${m.tipo ? ' · ' + esc(m.tipo) : ''}</div>
        </div>
        <span class="msg-card-meta">${new Date(m.created_at).toLocaleString('pt-PT')}</span>
      </div>

      <p class="msg-card-corpo">${esc(m.mensagem)}</p>

      <div class="card-actions">
        <button class="small-btn msg-reply-btn" data-reply-msg="${attr(m.id)}" type="button">Responder</button>
        ${m.lida ? '' : `<button class="small-btn" data-mark-read="${attr(m.id)}" type="button">Marcar como lida</button>`}
        <button class="small-btn danger-btn" data-del-msg="${attr(m.id)}" type="button">Excluir</button>
      </div>
    </article>`).join('');

  list.querySelectorAll('[data-reply-msg]').forEach(b =>
    b.addEventListener('click', () => openReplyMessage(b.dataset.replyMsg))
  );

  list.querySelectorAll('[data-mark-read]').forEach(b =>
    b.addEventListener('click', () =>
      withOperationLock('message-read:' + b.dataset.markRead, () => marcarLida(b.dataset.markRead))
    )
  );

  list.querySelectorAll('[data-del-msg]').forEach(b =>
    b.addEventListener('click', () =>
      withOperationLock('message-delete:' + b.dataset.delMsg, () => excluirMensagem(b.dataset.delMsg))
    )
  );
}

async function marcarLida(id) {
  const { error } = await supabase
    .from('mensagens')
    .update({ lida: true })
    .eq('id', id);

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

  const { error } = await supabase
    .from('mensagens')
    .delete()
    .eq('id', id);

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

const esc = v =>
  String(v ?? '')
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


const attr = esc;


/* =========================================================
   AUTH
========================================================= */

supabase.auth.onAuthStateChange(
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

const SESSIONS_BUCKET = 'fotos';
const numero = (i) => String(i + 1).padStart(4, '0');

function statusLabel(status) {
  if (status === 'fotos_disponiveis' || status === 'entregue') return 'Fotos disponíveis';
  if (status === 'em_edicao') return 'Em edição';
  if (status === 'selecao_finalizada' || status === 'selecionado') return 'Seleção finalizada';
  if (status === 'aguardando_selecao') return 'Aguardando seleção';
  return 'Preparando fotos';
}

async function loadSessions() {

  const { data, error } = await supabase
    .from('ensaios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    flash(`Erro ao carregar ensaios: ${error.message}`, 'erro');
    return;
  }

  sessionsCache = data || [];


  await refreshCompletedSelectionsCount();
  // Busca as fotografias apenas para obter a capa de cada ensaio.
  // Não altera a estrutura da tabela ensaios nem a lógica das sessões.
  if (sessionsCache.length) {
    const ids = sessionsCache.map(s => s.id);

    const { data: photos, error: photosError } = await supabase
      .from('fotos')
      .select('id, ensaio_id, url, tipo, ordem, created_at')
      .in('ensaio_id', ids)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (photosError) {
      console.warn('Não foi possível carregar as capas dos ensaios:', photosError.message);
    }

    const bySession = new Map();

    (photos || []).forEach(photo => {
      if (!bySession.has(photo.ensaio_id)) {
        bySession.set(photo.ensaio_id, []);
      }
      bySession.get(photo.ensaio_id).push(photo);
    });

    sessionsCache = sessionsCache.map(s => {
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

      const coverPhoto = explicitlySelectedCover || fallbackCover;

      return {
        ...s,
        cover_url: coverPhoto?.url || null
      };
    });
  }

  renderSessions();
}

function renderSessions() {

  const c = $('sessions-list');

  if (!sessionsCache.length) {
    c.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Ainda vazio</p>
        <h2 style="font-family:var(--font-display);font-weight:400;">
          Nenhum ensaio criado.
        </h2>
        <p class="panel-copy" style="margin-top:8px;">
          Comece criando a primeira sessão de cliente.
        </p>
      </div>`;
    return;
  }

  c.innerHTML = sessionsCache.map(s => `
    <article
      class="gallery-admin-card session-admin-card"
      data-session-id="${attr(s.id)}"
      title="Clique para abrir o ensaio"
    >
      <div class="gallery-drag-handle session-drag-placeholder"
        title="Ensaio"
        aria-hidden="true"
      >⋮⋮</div>

      <div class="gallery-thumb-wrap">
        ${
          s.cover_url
            ? `<img class="gallery-thumb" src="${attr(s.cover_url)}" alt="Capa do ensaio ${attr(s.titulo)}" loading="lazy"><span class="gallery-cover-label">CAPA</span>`
            : `<div class="gallery-thumb empty">SEM CAPA</div>`
        }
      </div>

      <div class="gallery-card-content">
        <div class="gallery-card-title">${esc(s.titulo)}</div>
        <div class="gallery-meta">
          ${esc(s.cliente_nome || '—')} · /${esc(s.slug)}
        </div>
      </div>

      <div class="gallery-card-controls">
        <span class="status-pill ${s.status === 'preparando' ? 'draft' : 'published'}">
          ${esc(statusLabel(s.status))}
        </span>

        <div class="card-actions gallery-card-actions">
          <button class="small-btn" data-open-session="${attr(s.id)}" type="button">Abrir</button>
          <button class="small-btn danger-btn" data-delete-session="${attr(s.id)}" type="button">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  c.querySelectorAll('.session-admin-card').forEach(card => {
    card.addEventListener('click', () => openSessionModal(card.dataset.sessionId));
  });

  c.querySelectorAll('[data-open-session]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      openSessionModal(b.dataset.openSession);
    });
  });

  c.querySelectorAll('[data-delete-session]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      withOperationLock('delete-session:' + b.dataset.deleteSession, () => excluirSession(b.dataset.deleteSession));
    });
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

    const { error } = await supabase.from('ensaios').insert(p);
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
  const { data, error } = await supabase.from('fotos').select('*').eq('ensaio_id', currentSession.id).order('ordem');
  if (error) {
    msg($('session-msg'), error.message, 'erro');
    return;
  }
  currentSessionPhotos = data || [];
  renderSessionDetail();
}


function sessionStatusNormalizado(status) {
  if (status === 'selecionado') return 'selecao_finalizada';
  if (status === 'entregue') return 'fotos_disponiveis';
  return status || 'preparando';
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

  const { data, error } = await supabase
    .from('ensaios')
    .update({ cliente_email: email })
    .eq('id', currentSession.id)
    .select('*')
    .single();

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
  const { data, error } = await supabase.functions.invoke('ensaio-notifications', {
    body: {
      action,
      ensaio_id: currentSession?.id,
      ...extra
    }
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || {};
}

async function iniciarEdicao() {
  if (!currentSession) return;
  const { data, error } = await supabase
    .from('ensaios')
    .update({ status: 'em_edicao' })
    .eq('id', currentSession.id)
    .select('*')
    .single();

  if (error) {
    flash(`Erro ao iniciar edição: ${error.message}`, 'erro');
    return;
  }

  currentSession = data || { ...currentSession, status: 'em_edicao' };
  flash('Ensaio marcado como “Em edição”.', 'sucesso');
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
  const s = currentSession;
  const linkCliente = `${location.origin}/area-cliente`;

  $('modal-session-title').textContent = s.titulo;
  $('session-link').textContent = linkCliente;
  $('session-login-box').textContent = s.slug;
  $('session-senha').textContent = s.codigo_acesso;
  $('session-client-email').value = s.cliente_email || '';
  renderSessionProgress(s);
  renderSessionEmailState(s);

  const provas = currentSessionPhotos.filter(f => f.tipo === 'prova');
  const finais = currentSessionPhotos.filter(f => f.tipo === 'final');
  const selecionadas = provas.filter(f => f.selecionada);

  $('prova-count').textContent = provas.length;
  $('final-count').textContent = finais.length;
  syncSessionStageAccordions();

  const fallbackCoverPhotoId = currentSessionPhotos
    .slice()
    .sort((a, b) => Number(a.ordem ?? 999999) - Number(b.ordem ?? 999999))[0]?.id || null;

  // A capa agora é independente da ordem das fotografias.
  // Se a coluna capa_foto_id ainda não existir, usamos a primeira foto como fallback visual.
  const coverPhotoId = currentSession.capa_foto_id || fallbackCoverPhotoId;

  $('prova-grid').innerHTML = provas.length
    ? provas.map((f, i) => `
        <div
          class="session-photo ${f.selecionada ? 'selecionada' : ''} ${f.id === coverPhotoId ? 'session-photo-cover' : ''}"
          data-session-photo-id="${attr(f.id)}"
          draggable="true"
          title="Arraste para mudar a posição ou clique para usar como capa"
        >
          <img src="${attr(f.url)}" alt="" loading="lazy">
          ${f.id === coverPhotoId ? '<span class="session-cover-label">CAPA</span>' : ''}
          <span class="photo-order">${numero(i)}</span>
          
          <button
            class="photo-delete session-photo-delete"
            data-delete-session-photo="${attr(f.id)}"
            title="Excluir esta prova"
            type="button"
          >×</button>
        </div>`).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma prova enviada ainda.</p>';

  $('prova-grid').querySelectorAll('[data-delete-session-photo]').forEach(button => {
    button.addEventListener('click', e => {
      e.stopPropagation();
      withOperationLock('delete-session-photo:' + button.dataset.deleteSessionPhoto, () => excluirFotoEnsaio(button.dataset.deleteSessionPhoto));
    });
  });

  configurarOrdenacaoFotosEnsaio($('prova-grid'));

  $('prova-grid').querySelectorAll('.session-photo[data-session-photo-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const id = card.dataset.sessionPhotoId;
      if (id && id !== coverPhotoId) withOperationLock('cover-session:' + currentSession.id, () => definirCapaEnsaio(id));
    });
  });

  const numerosSelecionados = selecionadas.map(f => numero(provas.indexOf(f))).join(', ');
  $('selecionadas-box').innerHTML = selecionadas.length
    ? `<div class="session-select-box"><p class="footer-mono" style="margin-bottom:4px;">Fotos que a cliente escolheu (${selecionadas.length}):</p><p style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);">${esc(numerosSelecionados.replaceAll(', ', '.cr3, ') + '.cr3')}</p></div>`
    : '';

  $('final-grid').innerHTML = finais.length
    ? finais.map((f, i) => `
        <div
          class="session-photo ${f.id === coverPhotoId ? 'session-photo-cover' : ''}"
          data-session-photo-id="${attr(f.id)}"
          draggable="true"
          title="Arraste para mudar a posição ou clique para usar como capa"
        >
          <img src="${attr(f.url)}" alt="" loading="lazy">
          ${f.id === coverPhotoId ? '<span class="session-cover-label">CAPA</span>' : ''}
          <span class="photo-order">${numero(i)}</span>
          
        </div>`).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma foto final enviada ainda.</p>';

  configurarOrdenacaoFotosEnsaio($('final-grid'));

  $('final-grid').querySelectorAll('.session-photo[data-session-photo-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const id = card.dataset.sessionPhotoId;
      if (id && id !== coverPhotoId) withOperationLock('cover-session:' + currentSession.id, () => definirCapaEnsaio(id));
    });
  });

  const statusAtual = sessionStatusNormalizado(s.status);

  const linkWhatsSelecao = s.cliente_telefone
    ? `https://wa.me/${s.cliente_telefone}?text=${encodeURIComponent(`Olá${s.cliente_nome ? ', ' + s.cliente_nome : ''}! Suas fotos já estão prontas para você escolher as favoritas! \n\nAcesse: ${linkCliente}\nLogin: ${s.slug}\nSenha: ${s.codigo_acesso}`)}`
    : null;

  const acoes = $('selecao-actions');
  if (statusAtual === 'preparando') {
    acoes.innerHTML = `<button class="btn btn-accent" id="btn-enviar-selecao" ${provas.length === 0 ? 'disabled' : ''}>Enviar fotos para seleção</button>`;
    $('btn-enviar-selecao').addEventListener('click', () => withOperationLock('selecao:' + (currentSession?.id || ''), enviarParaSelecao));
  } else if (statusAtual === 'aguardando_selecao') {
    acoes.innerHTML = `
      <span class="status-pill published">Aguardando seleção da cliente</span>
      ${linkWhatsSelecao ? `<a href="${attr(linkWhatsSelecao)}" target="_blank" rel="noopener" class="small-btn">Notificar por WhatsApp</a>` : ''}`;
  } else {
    const faltamEmailsSelecao = !s.email_selecao_cliente_enviado_em || !s.email_selecao_fotografo_enviado_em;
    acoes.innerHTML = `
      <span class="status-pill published">✓ Seleção finalizada</span>
      ${statusAtual === 'selecao_finalizada' ? '<button class="btn btn-accent" id="btn-iniciar-edicao" type="button">Iniciar edição</button>' : ''}
      ${faltamEmailsSelecao ? '<button class="small-btn" id="btn-reenviar-selecao" type="button">Tentar e-mails novamente</button>' : ''}`;

    if ($('btn-iniciar-edicao')) $('btn-iniciar-edicao').addEventListener('click', () => withOperationLock('start-edit:' + (currentSession?.id || ''), iniciarEdicao));
    if ($('btn-reenviar-selecao')) $('btn-reenviar-selecao').addEventListener('click', () => withOperationLock('retry-selection-mail:' + (currentSession?.id || ''), reenviarNotificacoesSelecao));
  }

  const btnEntregar = $('btn-entregar');
  const jaPublicado = statusAtual === 'fotos_disponiveis';
  const podePublicar = statusAtual === 'em_edicao' && finais.length > 0;

  if (jaPublicado) {
    btnEntregar.textContent = s.email_entrega_cliente_enviado_em
      ? 'Fotos publicadas ✓'
      : 'Reenviar e-mail de entrega';
    btnEntregar.className = s.email_entrega_cliente_enviado_em ? 'btn' : 'btn btn-accent';
    btnEntregar.disabled = Boolean(s.email_entrega_cliente_enviado_em);
  } else {
    btnEntregar.textContent = 'Publicar fotos finais';
    btnEntregar.className = 'btn btn-accent';
    btnEntregar.disabled = !podePublicar;
    btnEntregar.title = statusAtual !== 'em_edicao'
      ? 'Marque o ensaio como “Em edição” antes de publicar.'
      : (finais.length === 0 ? 'Adicione pelo menos uma foto final.' : 'Publicar e avisar a cliente por e-mail.');
  }

  const linkWhatsEntrega = s.cliente_telefone
    ? `https://wa.me/${s.cliente_telefone}?text=${encodeURIComponent(`Olá${s.cliente_nome ? ', ' + s.cliente_nome : ''}! Suas fotos finais já estão prontas para download! \n\nAcesse: ${linkCliente}\nLogin: ${s.slug}\nSenha: ${s.codigo_acesso}`)}`
    : null;
  const whatsEntrega = $('link-whats-entrega');
  if (jaPublicado && linkWhatsEntrega) {
    whatsEntrega.href = linkWhatsEntrega;
    whatsEntrega.style.display = '';
  } else {
    whatsEntrega.style.display = 'none';
  }

  msg($('session-msg'), '');
}


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
      supabase
        .from('fotos')
        .update({ ordem: index })
        .eq('id', id)
        .eq('ensaio_id', currentSession.id)
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

  const { data, error } = await supabase
    .from('ensaios')
    .update({ capa_foto_id: id })
    .eq('id', currentSession.id)
    .select('*')
    .single();

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

  const foto = currentSessionPhotos.find(f => f.id === id);
  if (!foto) {
    flash('Fotografia não encontrada.', 'erro');
    return;
  }

  const confirmado = confirm(
    'Excluir esta prova?\n\nEsta ação remove a fotografia do ensaio e não pode ser desfeita.'
  );
  if (!confirmado) return;

  flash('Excluindo fotografia...', 'erro');

  // Se a fotografia excluída for a capa escolhida, limpa a referência antes de removê-la.
  if (currentSession.capa_foto_id === id) {
    const { error: clearCoverError } = await supabase
      .from('ensaios')
      .update({ capa_foto_id: null })
      .eq('id', currentSession.id);

    if (!clearCoverError) {
      currentSession.capa_foto_id = null;
    }
  }

  const path = storagePathForBucket(foto.url, SESSIONS_BUCKET);

  if (path) {
    const { error: storageError } = await supabase
      .storage
      .from(SESSIONS_BUCKET)
      .remove([path]);

    if (storageError) {
      flash(`Erro ao excluir arquivo: ${storageError.message}`, 'erro');
      return;
    }
  }

  const { error } = await supabase
    .from('fotos')
    .delete()
    .eq('id', id);

  if (error) {
    flash(`Erro ao excluir registro: ${error.message}`, 'erro');
    return;
  }

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

        const { error: upErr } = await supabase
          .storage
          .from(SESSIONS_BUCKET)
          .upload(
            path,
            file,
            { upsert: false }
          );

        if (upErr) {
          msg(
            msgEl,
            `Erro ao enviar ${displayNumber}: ${upErr.message}`,
            'erro'
          );
          continue;
        }

        const { data: urlData } = supabase
          .storage
          .from(SESSIONS_BUCKET)
          .getPublicUrl(path);

        const { error: dbErr } = await supabase
          .from('fotos')
          .insert({
            ensaio_id: currentSession.id,
            url: urlData.publicUrl,
            tipo,
            ordem: nextOrder
          });

        if (dbErr) {
          await supabase
            .storage
            .from(SESSIONS_BUCKET)
            .remove([path])
            .catch(() => {});

          msg(
            msgEl,
            `Erro ao registrar ${displayNumber}: ${dbErr.message}`,
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
  const { error } = await supabase.from('ensaios').update({ status: 'aguardando_selecao' }).eq('id', currentSession.id);
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
  const s = sessionsCache.find(x => x.id === id);
  if (!s) return;
  const confirmado = confirm(`Tem certeza que quer excluir "${s.titulo}"?\n\nIsso apaga TODAS as fotos e dados desse ensaio para sempre. Não tem como desfazer.`);
  if (!confirmado) return;

  flash('Excluindo...', 'erro');

  for (const subpasta of ['prova', 'final']) {
    const { data: arquivos } = await supabase.storage.from(SESSIONS_BUCKET).list(`${id}/${subpasta}`);
    if (arquivos && arquivos.length) {
      const caminhos = arquivos.map(a => `${id}/${subpasta}/${a.name}`);
      await supabase.storage.from(SESSIONS_BUCKET).remove(caminhos);
    }
  }

  const { error } = await supabase.from('ensaios').delete().eq('id', id);
  if (error) {
    flash(`Erro ao excluir: ${error.message}`, 'erro');
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
let designStudioReady = false;
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

function normalizeDesignConfig(config = {}) {
  const c = { ...DESIGN_DEFAULTS, ...(config || {}) };
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
    whatsapp_pages: Array.isArray(c.whatsapp_pages) ? c.whatsapp_pages.filter(x => ['inicio','galeria','sobre','contato'].includes(x)) : ['inicio','galeria','sobre','contato'],
    inline_styles: c.inline_styles && typeof c.inline_styles === 'object' ? JSON.parse(JSON.stringify(c.inline_styles)) : {},
    content: c.content && typeof c.content === 'object' ? JSON.parse(JSON.stringify(c.content)) : null
  };
}


function collectHeroContentPayload(){
  const mode=document.querySelector('input[name="hero-mode"]:checked')?.value||'static';
  const desktopRaw=safeText($('hero-desktop-image')?.value,2048), mobileRaw=safeText($('hero-mobile-image')?.value,2048);
  const meta=($('hero-meta')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12).map(line=>{const i=line.indexOf('|');return i<0?{label:safeText(line,80),value:''}:{label:safeText(line.slice(0,i),80),value:safeText(line.slice(i+1),160)}});
  return {eyebrow:safeText($('hero-eyebrow')?.value,120),title:safeText($('hero-title')?.value,180),description:safeText($('hero-description')?.value,1000),desktop_image:desktopRaw?safeHttpUrl(desktopRaw,{allowRelative:true}):'',mobile_image:mobileRaw?safeHttpUrl(mobileRaw,{allowRelative:true}):'',image_alt:safeText($('hero-image-alt')?.value,240),mode,static_focus_x:clampNumber($('hero-static-focus-x')?.value,0,100,50),static_focus_y:clampNumber($('hero-static-focus-y')?.value,0,100,50),slide_interval:clampNumber($('hero-slide-interval')?.value,2,30,5),slide_transition:clampNumber($('hero-slide-transition')?.value,.3,5,1.2),slide_width:$('hero-slide-width')?.value||HERO_SLIDESHOW_DEFAULTS.width,slide_fit:$('hero-slide-fit')?.value||HERO_SLIDESHOW_DEFAULTS.fit,slide_ratio:$('hero-slide-ratio')?.value||HERO_SLIDESHOW_DEFAULTS.ratio,slide_animation:$('hero-slide-animation')?.value||HERO_SLIDESHOW_DEFAULTS.animation,slide_order:$('hero-slide-order')?.value||HERO_SLIDESHOW_DEFAULTS.order,slide_behind_menu:$('hero-slide-behind-menu')?.value!=='no',slides:heroSlidesDraft.slice(0,30).map((s,index)=>({id:safeText(s.id,120),url:safeHttpUrl(s.url,{allowRelative:true}),alt:safeText(s.alt,240),focus_x:clampNumber(s.focus_x,0,100,50),focus_y:clampNumber(s.focus_y,0,100,50),published:s.published!==false,sort_order:index})).filter(s=>s.url),primary_button:{text:safeText($('hero-primary-text')?.value,80),url:safeHttpUrl($('hero-primary-url')?.value)||'/galeria'},secondary_button:{text:safeText($('hero-secondary-text')?.value,80),url:safeHttpUrl($('hero-secondary-url')?.value)||'/contato'},meta};
}
function collectRecentContentPayload(){return {eyebrow:safeText($('recent-eyebrow')?.value,120),title:safeText($('recent-title')?.value,180),gallery_limit:clampNumber($('recent-limit')?.value,1,24,6),button:{text:safeText($('recent-btn-text')?.value,80),url:safeHttpUrl($('recent-btn-url')?.value)||'/galeria'}}}
function collectSobreContentPayload(){return {eyebrow:safeText($('sobre-eyebrow')?.value,120),paragraphs:($('sobre-paragraphs')?.value||'').split('\n').map(x=>safeText(x,1000)).filter(Boolean).slice(0,20),specs:collectSpecs().slice(0,20).map(s=>({label:safeText(s.label,80),value:safeText(s.value,160)})),portrait_url:safeHttpUrl($('sobre-portrait-url')?.value||''),portrait_alt:safeText($('sobre-portrait-alt')?.value,240),cta_text:safeText($('sobre-cta-text')?.value,80),cta_url:safeHttpUrl($('sobre-cta-url')?.value)||'/contato'}}
function collectContatoContentPayload(){return {eyebrow:safeText($('contato-eyebrow')?.value,120),title:safeText($('contato-title')?.value,180),submit_label:safeText($('contato-submit-label')?.value,80),tipos:($('contato-tipos')?.value||'').split('\n').map(x=>safeText(x,160)).filter(Boolean).slice(0,30),atendimento:safeText($('contato-atendimento')?.value,1000)}}
function collectDesignContentSnapshot(){return {inicio:{hero:collectHeroContentPayload(),recent_work:collectRecentContentPayload()},sobre:{conteudo:collectSobreContentPayload()},contato:{conteudo:collectContatoContentPayload()}}}
function applyDesignContentSnapshotToControls(s){if(!s)return;const h=s.inicio?.hero;if(h){$('hero-eyebrow').value=h.eyebrow||'';$('hero-title').value=h.title||'';$('hero-description').value=h.description||'';$('hero-desktop-image').value=h.desktop_image||'';$('hero-mobile-image').value=h.mobile_image||'';$('hero-image-alt').value=h.image_alt||'';const mode=h.mode==='slideshow'?'slideshow':'static';$('hero-mode-static').checked=mode==='static';$('hero-mode-slideshow').checked=mode==='slideshow';$('hero-static-focus-x').value=Number(h.static_focus_x??50);$('hero-static-focus-y').value=Number(h.static_focus_y??50);$('hero-slide-interval').value=Number(h.slide_interval??5);$('hero-slide-transition').value=Number(h.slide_transition??1.2);$('hero-slide-width').value=h.slide_width||HERO_SLIDESHOW_DEFAULTS.width;$('hero-slide-fit').value=h.slide_fit||HERO_SLIDESHOW_DEFAULTS.fit;$('hero-slide-ratio').value=h.slide_ratio||HERO_SLIDESHOW_DEFAULTS.ratio;$('hero-slide-animation').value=h.slide_animation||HERO_SLIDESHOW_DEFAULTS.animation;$('hero-slide-order').value=h.slide_order||HERO_SLIDESHOW_DEFAULTS.order;$('hero-slide-behind-menu').value=h.slide_behind_menu===false?'no':'yes';heroSlidesDraft=Array.isArray(h.slides)?h.slides.map((x,i)=>({id:x.id||`slide-${Date.now()}-${i}`,url:x.url||'',alt:x.alt||'',focus_x:Number(x.focus_x??50),focus_y:Number(x.focus_y??50),published:x.published!==false})).filter(x=>x.url):[];$('hero-primary-text').value=h.primary_button?.text||'';$('hero-primary-url').value=h.primary_button?.url||'';$('hero-secondary-text').value=h.secondary_button?.text||'';$('hero-secondary-url').value=h.secondary_button?.url||'';$('hero-meta').value=(h.meta||[]).map(x=>`${x.label} | ${x.value}`).join('\n');updateHeroModeUI();updateStaticFocalPreview();renderHeroSlidesAdmin();renderHeroSlideshowOverview()}
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
    whatsapp_enabled: $('design-whatsapp-enabled')?.checked !== false,
    whatsapp_number: ($('design-whatsapp-number')?.value || '').replace(/\D/g,''),
    whatsapp_message: $('design-whatsapp-message')?.value,
    whatsapp_position: $('design-whatsapp-position')?.value,
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
  if ($('design-whatsapp-enabled')) $('design-whatsapp-enabled').checked = c.whatsapp_enabled !== false;
  if ($('design-whatsapp-number')) $('design-whatsapp-number').value = c.whatsapp_number || '';
  if ($('design-whatsapp-message')) $('design-whatsapp-message').value = c.whatsapp_message || '';
  if ($('design-whatsapp-position')) $('design-whatsapp-position').value = c.whatsapp_position || 'right';
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
  const { data, error } = await supabase
    .from('site_content')
    .select('id,section_key,content,updated_at')
    .eq('slug', 'design')
    .in('section_key', ['draft', 'published']);

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

  applyDesignConfigToControls(initial);
  updateDesignPublicationState();
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

  const { data: existing, error: selectError } = await supabase
    .from('site_content')
    .select('id')
    .eq('slug', 'design')
    .eq('section_key', sectionKey)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;

  const row = {
    slug: 'design',
    section_key: sectionKey,
    content: normalized,
    updated_at: new Date().toISOString()
  };

  const result = existing?.id
    ? await supabase.from('site_content').update(row).eq('id', existing.id)
    : await supabase.from('site_content').insert(row);

  if (result.error) throw result.error;
  return normalized;
}

async function saveDesignDraft() {
  if (!designPersistenceLoaded) await ensureDesignPersistenceLoaded();

  const button = $('design-save-draft');
  if (button?.dataset.busy === '1') return;

  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'Salvando…';
  }

  try {
    designDraftSaved = await upsertDesignRow(
      'draft',
      collectDesignConfig()
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

  const currentFp = designFingerprint(collectDesignConfig());
  const publishedFp = designFingerprint(designPublishedSaved);

  if (
    currentFp !== publishedFp &&
    !confirm('Restaurar a versão publicada? As alterações atuais da prévia serão descartadas.')
  ) return;

  applyDesignConfigToControls(designPublishedSaved);
  flash('Prévia restaurada para a versão publicada.', 'sucesso');
}


async function publishDesignContent(snapshot){if(!snapshot)return;for(const [slug,key,payload] of [['inicio','hero',snapshot.inicio?.hero],['inicio','recent_work',snapshot.inicio?.recent_work],['sobre','conteudo',snapshot.sobre?.conteudo],['contato','conteudo',snapshot.contato?.conteudo]]){if(!payload)continue;const ok=await upsertContent(slug,key,payload,null);if(!ok)throw new Error(`Falha ao publicar ${slug}/${key}.`)}contentCache=JSON.parse(JSON.stringify(snapshot))}

async function publishDesign() {
  if (!designPersistenceLoaded) await ensureDesignPersistenceLoaded();

  const current = collectDesignConfig();
  const currentFp = designFingerprint(current);
  const publishedFp = designFingerprint(designPublishedSaved || DESIGN_DEFAULTS);

  if (currentFp === publishedFp) {
    updateDesignPublicationState();
    flash('O Design já está publicado. Nenhuma alteração necessária.', '');
    return;
  }

  if (!confirm('Publicar estas alterações de Design no site agora?')) return;

  const button = $('design-publish');
  if (button?.dataset.busy === '1') return;

  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'Publicando…';
  }

  try {
    designDraftSaved = await upsertDesignRow('draft', current);
    designDraftUpdatedAt = new Date().toISOString();

    await publishDesignContent(current.content);

    designPublishedSaved = await upsertDesignRow('published', current);
    designPublishedUpdatedAt = new Date().toISOString();

    flash('Design publicado no site com sucesso.', 'sucesso');
    updateDesignPublicationState();

    const frame = $('design-preview-frame');
    if (frame) {
      const url = new URL(frame.src || '/inicio', location.origin);
      url.searchParams.set('_design', Date.now());
      frame.src = url.href;
    }
  } catch (error) {
    console.error('[admin-v2] publishDesign:', error);
    flash(`Erro ao publicar Design: ${error.message}`, 'erro');
  } finally {
    if (button) {
      button.dataset.busy = '0';
      button.textContent = 'Publicar no site';
    }
    updateDesignPublicationState();
  }
}

function getDesignPreviewDocument() {
  const frame = $('design-preview-frame');
  try { return frame?.contentDocument || frame?.contentWindow?.document || null; }
  catch (_) { return null; }
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
    $('design-preview-label').textContent = viewport.label;
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

function installDesignPreviewNavigationGuard() {
  const doc = getDesignPreviewDocument();
  const frame = $('design-preview-frame');

  if (!doc || !frame || doc.__designNavigationGuardInstalled) return;

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

    const mode = $('design-page-animation')?.value || 'none';

    if (mode === 'none') return;

    event.preventDefault();

    const browser = document.querySelector(
      '#design-preview-stage .design-browser-frame'
    );

    if (!browser) {
      frame.src = url.href;
      return;
    }

    const speed = $('design-motion-speed')?.value || 'normal';

    const duration =
      speed === 'fast'
        ? 120
        : speed === 'slow'
          ? 220
          : 160;

    browser
      .animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration,
          easing: 'ease-out',
          fill: 'forwards'
        }
      )
      .finished
      .catch(() => {})
      .finally(() => {
        frame.src = url.href;
      });
  });
}

function setDesignDevice(device) {
  designPreviewDevice = device === 'mobile' ? 'mobile' : 'desktop';
  const mobile = designPreviewDevice === 'mobile';

  $('design-preview-stage')?.classList.toggle('is-mobile', mobile);
  $('design-preview-stage')?.classList.toggle('is-desktop', !mobile);
  $('design-device-desktop')?.classList.toggle('active', !mobile);
  $('design-device-mobile')?.classList.toggle('active', mobile);
  $('design-device-desktop')?.setAttribute('aria-pressed', String(!mobile));
  $('design-device-mobile')?.setAttribute('aria-pressed', String(mobile));

  const frame = $('design-preview-frame');

  try {
    frame?.contentWindow?.scrollTo(0, 0);
  } catch (_) {}

  sizeDesignPreview();

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

  const desktop =
    doc.getElementById(
      'hero-desktop-image'
    );

  const mobile =
    doc.getElementById(
      'hero-mobile-image'
    );

  const picture =
    desktop?.closest('picture');

  const slideshow =
    doc.getElementById(
      'hero-slideshow'
    );

  if (
    desktop &&
    hero.desktop_image
  ) {
    desktop.src =
      hero.desktop_image;

    desktop.alt =
      hero.image_alt || '';

    desktop.style.objectPosition =
      `${Number(hero.static_focus_x ?? 50)}% ${Number(hero.static_focus_y ?? 50)}%`;
  }

  if (mobile) {
    mobile.srcset =
      hero.mobile_image || '';
  }

  const visibleSlides =
    (hero.slides || [])
      .filter(
        slide =>
          slide.url &&
          slide.published !== false
      );

  const slideshowMode =
    hero.mode === 'slideshow' &&
    visibleSlides.length > 0;

  if (slideshow) {
    stopDesignHeroPreviewTimer(doc);

    slideshow.innerHTML =
      visibleSlides
        .map(
          (slide, index) => `
            <div
              class="hero-slide ${index === 0 ? 'is-visible' : ''}"
              style="
                background-image:url('${esc(slide.url)}');
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

function applySobreDesignPreview(doc,s){const d=s.sobre?.conteudo||{},text=doc.querySelector('.about-text');if(text){const eb=text.querySelector('.section-eyebrow');if(eb)eb.textContent=d.eyebrow||'';text.querySelectorAll(':scope > p:not(.section-eyebrow)').forEach(p=>p.remove());const specs=text.querySelector('.specs');(d.paragraphs||[]).forEach(x=>{const p=doc.createElement('p');p.textContent=x;text.insertBefore(p,specs||null)});if(specs)specs.innerHTML=(d.specs||[]).map(x=>`<div><dt>${esc(x.label||'')}</dt><dd>${esc(x.value||'')}</dd></div>`).join('');const cta=text.querySelector('.btn.btn-accent');if(cta){cta.textContent=d.cta_text||'';cta.href=d.cta_url||'/contato'}}const portrait=doc.querySelector('.about-portrait img');if(portrait&&d.portrait_url){portrait.src=d.portrait_url;portrait.alt=d.portrait_alt||''}}
function applyContatoDesignPreview(doc,s){const d=s.contato?.conteudo||{},eb=doc.querySelector('.section-head .section-eyebrow'),title=doc.querySelector('.section-head .section-title');if(eb)eb.textContent=d.eyebrow||'';if(title)title.textContent=d.title||'';const form=doc.querySelector('.contact-grid form');if(form){const btn=form.querySelector('button[type="submit"]');if(btn)btn.textContent=d.submit_label||'Enviar mensagem';const sel=form.querySelector('select[name="tipo"],#tipo');if(sel)sel.innerHTML=(d.tipos||[]).map(x=>`<option>${esc(x)}</option>`).join('')}const info=doc.querySelector('.contact-info');if(info){const dt=[...info.querySelectorAll('dt')].find(n=>n.textContent.trim().toLowerCase()==='atendimento');if(dt?.nextElementSibling)dt.nextElementSibling.textContent=d.atendimento||''}}

const DESIGN_INLINE_FIELDS = {
  'hero-eyebrow': {input:'hero-eyebrow', label:'Texto acima do título'},
  'hero-title': {input:'hero-title', label:'Título principal'},
  'hero-description': {input:'hero-description', label:'Descrição principal'},
  'hero-primary-button': {input:'hero-primary-text', label:'Botão principal'},
  'hero-secondary-button': {input:'hero-secondary-text', label:'Botão secundário'},
  'recent-work-eyebrow': {input:'recent-eyebrow', label:'Texto de Trabalhos recentes'},
  'recent-work-title': {input:'recent-title', label:'Título de Trabalhos recentes'},
  'recent-work-button': {input:'recent-btn-text', label:'Botão da galeria'}
};
let designInlineActive=null;
function applyInlineStyleToElement(el,key){
  const st=(window.__designInlineStyles||{})[key]||{};
  el.style.fontWeight=st.bold?'700':'';
  el.style.fontStyle=st.italic?'italic':'';
  el.style.textAlign=st.align||'';
  el.style.fontSize=st.size==='small'?'.86em':st.size==='large'?'1.14em':'';
}

function ensureDesignPreviewRenderObserver(doc) {
  if (
    !doc ||
    doc.documentElement?.dataset
      ?.designPreviewObserver === '1'
  ) {
    return;
  }

  if (!doc.documentElement) return;

  doc.documentElement.dataset
    .designPreviewObserver = '1';

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
  Object.entries(DESIGN_INLINE_FIELDS).forEach(([id,cfg])=>{
    const el=doc.getElementById(id); if(!el)return;
    el.dataset.designInlineEditable='1'; el.dataset.designInlineKey=id;
    el.title='Clique para editar este texto';
    applyInlineStyleToElement(el,id);
    if(el.dataset.designInlineBound==='1')return;
    el.dataset.designInlineBound='1';
    el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();openDesignInlineEditor(el,cfg,id);});
  });
}
function openDesignInlineEditor(el,cfg,key){
  if(designInlineActive&&designInlineActive.el!==el) finishDesignInline(false);
  designInlineActive={el,cfg,key,originalText:(el.innerText||el.textContent||''),originalHTML:el.innerHTML,originalStyle:JSON.parse(JSON.stringify((window.__designInlineStyles||{})[key]||{}))};
  el.contentEditable='true'; el.style.whiteSpace='pre-line'; el.classList.add('design-inline-editing'); el.focus();
  const box=$('design-inline-editor'); if(box)box.hidden=false;
  if($('design-inline-editor-label'))$('design-inline-editor-label').textContent=cfg.label;
  const st=(window.__designInlineStyles||{})[key]||{};
  if($('design-inline-size'))$('design-inline-size').value=st.size||'inherit';
  document.querySelectorAll('[data-inline-command]').forEach(b=>b.classList.toggle('active',!!st[b.dataset.inlineCommand]));
  document.querySelectorAll('[data-inline-align]').forEach(b=>b.classList.toggle('active',(st.align||'left')===b.dataset.inlineAlign));
}
function previewInlineStyle(patch){
  if(!designInlineActive)return;
  window.__designInlineStyles=window.__designInlineStyles||{};
  const cur=window.__designInlineStyles[designInlineActive.key]||{};
  window.__designInlineStyles[designInlineActive.key]={...cur,...patch};
  applyInlineStyleToElement(designInlineActive.el,designInlineActive.key);
  updateDesignPublicationState();
}
function finishDesignInline(save){
  const a=designInlineActive;if(!a)return;
  if(save){
    const input=$(a.cfg.input); if(input){input.value=(a.el.textContent||'').trim(); input.dispatchEvent(new Event('input',{bubbles:true}));}
  }else{
    a.el.innerHTML=a.originalHTML;
    window.__designInlineStyles=window.__designInlineStyles||{};
    window.__designInlineStyles[a.key]=a.originalStyle;
    applyInlineStyleToElement(a.el,a.key);
  }
  a.el.contentEditable='false';a.el.style.removeProperty('white-space');a.el.classList.remove('design-inline-editing');designInlineActive=null;
  if($('design-inline-editor'))$('design-inline-editor').hidden=true;
  applyDesignContentPreview();updateDesignPublicationState();
}
async function saveDesignInline() {
  if (!designInlineActive) return;

  const active =
    designInlineActive;

  const newText =
    (
      active.el.innerText ||
      active.el.textContent ||
      ''
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
    O input do CMS é a fonte do rascunho.
    É importante atualizá-lo ANTES de fechar a edição e
    antes de coletar collectDesignConfig().
  */
  input.value =
    newText;

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

  const editedKey =
    active.key;

  active.el.contentEditable =
    'false';

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

  /*
    Atualiza primeiro a prévia local. Dessa forma o usuário
    vê o resultado mesmo enquanto o rascunho está sendo salvo.
  */
  applyDesignContentPreview();

  console.log(
    '[admin-v2] editor visual: salvando',
    {
      key: editedKey,
      input: active.cfg.input,
      text: newText,
      lines: newText.split('\n')
    }
  );

  try {
    await saveDesignDraft();

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

        console.log(
          '[admin-v2] editor visual: prévia confirmada',
          {
            key: editedKey,
            renderedText:
              target?.textContent?.trim() || ''
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
  $('design-inline-size')?.addEventListener('change',e=>previewInlineStyle({size:e.target.value}));
  document.querySelectorAll('[data-inline-command]').forEach(b=>b.addEventListener('click',()=>{if(!designInlineActive)return;const k=b.dataset.inlineCommand,cur=(window.__designInlineStyles||{})[designInlineActive.key]||{};previewInlineStyle({[k]:!cur[k]});b.classList.toggle('active',!cur[k]);}));
  document.querySelectorAll('[data-inline-align]').forEach(b=>b.addEventListener('click',()=>{previewInlineStyle({align:b.dataset.inlineAlign});document.querySelectorAll('[data-inline-align]').forEach(x=>x.classList.toggle('active',x===b));}));
}
function applyDesignWhatsappPreview(doc){
  if(!doc)return; let btn=doc.getElementById('rs-whatsapp-float-preview');
  const enabled=$('design-whatsapp-enabled')?.checked!==false, num=($('design-whatsapp-number')?.value||'').replace(/\D/g,''), msg=encodeURIComponent($('design-whatsapp-message')?.value||''), pos=$('design-whatsapp-position')?.value||'right';
  let path='inicio';try{const p=doc.location.pathname;if(p.includes('galeria'))path='galeria';else if(p.includes('sobre'))path='sobre';else if(p.includes('contato'))path='contato';}catch(_){}
  const allowed=$('design-whatsapp-page-'+path)?.checked!==false;
  if(!enabled||!num||!allowed){btn?.remove();return;}
  if(!btn){btn=doc.createElement('a');btn.id='rs-whatsapp-float-preview';btn.className='rs-whatsapp-float';btn.target='_blank';btn.rel='noopener';btn.setAttribute('aria-label','Conversar pelo WhatsApp');btn.innerHTML='<span aria-hidden="true">◔</span><b>WhatsApp</b>';doc.body.appendChild(btn);}
  btn.href='https://wa.me/'+num+(msg?'?text='+msg:'');btn.classList.toggle('is-left',pos==='left');
}
function applyDesignContentPreview(){if(activeView!=='design')return;const doc=getDesignPreviewDocument();if(!doc)return;const s=collectDesignContentSnapshot();let path='';try{path=doc.location.pathname}catch(_){return}if(path==='/'||path==='/inicio'||path.endsWith('/inicio.html'))applyInicioDesignPreview(doc,s);if(path==='/sobre'||path.endsWith('/sobre.html'))applySobreDesignPreview(doc,s);if(path==='/contato'||path.endsWith('/contato.html'))applyContatoDesignPreview(doc,s);ensureDesignPreviewRenderObserver(doc);decorateDesignInlinePreview(doc);applyDesignWhatsappPreview(doc)}
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
      const expanded =
        toggle.getAttribute('aria-expanded') === 'true';

      setDesignNavExpanded(!expanded);

      if (!expanded) {
        setView?.('design');
      }
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

async function uploadDesignClientImage(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`client-area/${Date.now()}-${Math.random().toString(36).slice(2,9)}.${ext}`;const {error}=await supabase.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false});if(error)throw error;return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl||''}

function initDesignStudio() {
  bindDesignInlineToolbar();
  initDesignAccordions();
  initDesignSidebarNavigation();
  initDesignContentMigration();
  initDesignContentNavigation();
  initDesignContentOrderDnD();

  if (designStudioReady) {
    ensureDesignPersistenceLoaded().catch(() => {});

    setTimeout(() => {
      applyDesignPreview();
      sizeDesignPreview();
      updateDesignPublicationState();
    }, 50);
    return;
  }

  designStudioReady = true;

  $('design-device-desktop')?.addEventListener('click', () => setDesignDevice('desktop'));
  $('design-device-mobile')?.addEventListener('click', () => setDesignDevice('mobile'));

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
  if(document.body.dataset.designContentLiveBound!=='1'){document.body.dataset.designContentLiveBound='1';const live=e=>{if(activeView!=='design'||!e.target.closest('.content-panel'))return;applyDesignContentPreview();updateDesignPublicationState()};document.addEventListener('input',live);document.addEventListener('change',live)}
  loadContent().then(()=>ensureDesignPersistenceLoaded()).catch(()=>{});

  $('design-preview-frame')?.addEventListener('load', () => {
    setTimeout(() => {
      try {
        $('design-preview-frame')?.contentWindow?.scrollTo(0, 0);
      } catch (_) {}

      applyDesignPreview();
      applyDesignContentPreview();

      setTimeout(
        applyDesignContentPreview,
        180
      );

      setTimeout(
        applyDesignContentPreview,
        420
      );

      sizeDesignPreview();
      installDesignPreviewNavigationGuard();
      runDesignPageTransition();
    }, 100);
  });

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

  setDesignDevice('desktop');
  setTimeout(() => {
    applyDesignPreview();
    sizeDesignPreview();
  }, 140);
  updateDesignClientFocalUI();
}
