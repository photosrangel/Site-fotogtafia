import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const ADMIN_ID = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a';
const BUCKET = 'site-gallery';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log('[admin-v2] Build v28 — design avançado seguro');

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

  if (v === 'dashboard') loadDashboard();
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


    card.addEventListener(
      'dragstart',
      event => {

        if (
          !event.target.closest('.gallery-drag-handle')
        ) {

          event.preventDefault();

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

        const mouseY =
          event.clientY;

        const middle =
          rect.top +
          rect.height / 2;

        if (mouseY < middle) {

          container.insertBefore(
            draggedCard,
            card
          );

        } else {

          container.insertBefore(
            draggedCard,
            card.nextSibling
          );

        }

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

async function loadSettings() {

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
  msg($(msgId), 'Salvando...');

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
    msg($(msgId), 'Erro ao salvar: ' + r.error.message, 'erro');
    return false;
  }

  msg($(msgId), 'Salvo!', 'sucesso');
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

  modal.hidden = false;
  renderHeroSlidesAdmin();
}

function closeHeroSlidesManager() {
  const modal = $('hero-slides-manager-modal');
  if (!modal) return;

  modal.hidden = true;
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

$('form-hero').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!beginFormBusy(form)) return;

  try {
    const mode = document.querySelector('input[name="hero-mode"]:checked')?.value || 'static';
    const desktopRaw = safeText($('hero-desktop-image').value, 2048);
    const mobileRaw = safeText($('hero-mobile-image').value, 2048);
    const desktop = desktopRaw ? safeHttpUrl(desktopRaw, { allowRelative: false }) : '';
    const mobile = mobileRaw ? safeHttpUrl(mobileRaw, { allowRelative: false }) : '';

    if (desktopRaw && !desktop) {
      msg($('hero-msg'), 'A URL da foto estática é inválida.', 'erro');
      return;
    }
    if (mobileRaw && !mobile) {
      msg($('hero-msg'), 'A URL alternativa de celular é inválida.', 'erro');
      return;
    }
    if (!desktop) {
      msg($('hero-msg'), 'Escolha uma foto estática. Ela também é a proteção/fallback do slideshow.', 'erro');
      return;
    }
    if (mode === 'slideshow' && !heroSlidesDraft.some(s => s.published !== false && s.url)) {
      msg($('hero-msg'), 'Para usar Slideshow, publique pelo menos uma foto.', 'erro');
      return;
    }

    const meta = $('hero-meta').value.split('\n')
      .map(l => l.trim()).filter(Boolean).slice(0, 12)
      .map(l => {
        const i = l.indexOf('|');
        if (i === -1) return { label: safeText(l, 80), value: '' };
        return { label: safeText(l.slice(0, i), 80), value: safeText(l.slice(i + 1), 160) };
      });

    await upsertContent('inicio', 'hero', {
      eyebrow: safeText($('hero-eyebrow').value, 120),
      title: safeText($('hero-title').value, 180),
      description: safeText($('hero-description').value, 1000),
      desktop_image: desktop,
      mobile_image: mobile,
      image_alt: safeText($('hero-image-alt').value, 240),
      mode,
      static_focus_x: clampNumber($('hero-static-focus-x').value, 0, 100, 50),
      static_focus_y: clampNumber($('hero-static-focus-y').value, 0, 100, 50),
      slide_interval: clampNumber($('hero-slide-interval').value, 2, 30, 5),
      slide_transition: clampNumber($('hero-slide-transition').value, .3, 5, 1.2),
      slide_width: $('hero-slide-width').value || HERO_SLIDESHOW_DEFAULTS.width,
      slide_fit: $('hero-slide-fit').value || HERO_SLIDESHOW_DEFAULTS.fit,
      slide_ratio: $('hero-slide-ratio').value || HERO_SLIDESHOW_DEFAULTS.ratio,
      slide_animation: $('hero-slide-animation').value || HERO_SLIDESHOW_DEFAULTS.animation,
      slide_order: $('hero-slide-order').value || HERO_SLIDESHOW_DEFAULTS.order,
      slide_behind_menu: $('hero-slide-behind-menu').value !== 'no',
      slides: heroSlidesDraft.slice(0, 30).map((s, index) => ({
        id: safeText(s.id, 120), url: safeHttpUrl(s.url, { allowRelative: false }),
        alt: safeText(s.alt, 240), focus_x: clampNumber(s.focus_x,0,100,50),
        focus_y: clampNumber(s.focus_y,0,100,50), published: s.published !== false, sort_order: index
      })).filter(s => s.url),
      primary_button: { text: safeText($('hero-primary-text').value,80), url: safeHttpUrl($('hero-primary-url').value) || '/galeria' },
      secondary_button: { text: safeText($('hero-secondary-text').value,80), url: safeHttpUrl($('hero-secondary-url').value) || '/contato' },
      meta
    }, 'hero-msg');
  } finally { endFormBusy(form); }
});

$('form-recent').addEventListener('submit', async e => {
  e.preventDefault();
  const form=e.currentTarget;
  if (!beginFormBusy(form)) return;
  try {
    await upsertContent('inicio','recent_work',{
      eyebrow:safeText($('recent-eyebrow').value,120), title:safeText($('recent-title').value,180),
      gallery_limit:clampNumber($('recent-limit').value,1,24,6),
      button:{text:safeText($('recent-btn-text').value,80),url:safeHttpUrl($('recent-btn-url').value)||'/galeria'}
    },'recent-msg');
  } finally { endFormBusy(form); }
});

$('form-sobre').addEventListener('submit', async e => {
  e.preventDefault();
  const form=e.currentTarget;
  if (!beginFormBusy(form)) return;
  try {
    await upsertContent('sobre','conteudo',{
      eyebrow:safeText($('sobre-eyebrow').value,120),
      paragraphs:$('sobre-paragraphs').value.split('\n').map(l=>safeText(l,1000)).filter(Boolean).slice(0,20),
      specs:collectSpecs().slice(0,20).map(s=>({label:safeText(s.label,80),value:safeText(s.value,160)})),
      portrait_url:safeHttpUrl($('sobre-portrait-url').value,{allowRelative:false}),
      portrait_alt:safeText($('sobre-portrait-alt').value,240),
      cta_text:safeText($('sobre-cta-text').value,80), cta_url:safeHttpUrl($('sobre-cta-url').value)||'/contato'
    },'sobre-msg');
  } finally { endFormBusy(form); }
});

$('form-contato').addEventListener('submit', async e => {
  e.preventDefault();
  const form=e.currentTarget;
  if (!beginFormBusy(form)) return;
  try {
    await upsertContent('contato','conteudo',{
      eyebrow:safeText($('contato-eyebrow').value,120), title:safeText($('contato-title').value,180),
      submit_label:safeText($('contato-submit-label').value,80),
      tipos:$('contato-tipos').value.split('\n').map(l=>safeText(l,120)).filter(Boolean).slice(0,30),
      atendimento:safeText($('contato-atendimento').value,1000)
    },'contato-msg');
  } finally { endFormBusy(form); }
});

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

document.querySelectorAll('#content-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#content-tabs .tab').forEach(t =>
      t.classList.toggle('active', t === tab)
    );
    ['inicio', 'sobre', 'contato'].forEach(p =>
      $('content-panel-' + p).hidden = p !== tab.dataset.tab
    );
  });
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
let designPreviewDevice = 'desktop';
let designPreviewResizeObserver = null;

const DESIGN_VIEWPORTS = {
  desktop: { width: 1920, height: 1080, label: 'Computador · 1920 × 1080' },
  mobile: { width: 390, height: 844, label: 'Celular · 390 × 844' }
};

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

  const pageAnimationRules =
    pageAnimation === 'fade'
      ? `
        @keyframes adminDesignPageIn{
          from{opacity:0}
          to{opacity:1}
        }
        body.design-preview-animate-page{
          animation:adminDesignPageIn ${motionMs}ms ease both !important;
        }
      `
      : pageAnimation === 'fade-up'
        ? `
          @keyframes adminDesignPageIn{
            from{opacity:0;transform:translateY(18px)}
            to{opacity:1;transform:none}
          }
          body.design-preview-animate-page{
            animation:adminDesignPageIn ${motionMs}ms cubic-bezier(.22,.61,.36,1) both !important;
          }
        `
        : pageAnimation === 'soft'
          ? `
          @keyframes adminDesignPageIn{
            from{opacity:0;filter:blur(4px);transform:scale(.992)}
            to{opacity:1;filter:none;transform:none}
          }
          body.design-preview-animate-page{
            animation:adminDesignPageIn ${Math.round(motionMs * 1.25)}ms ease both !important;
          }
        `
          : '';

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

    @media (prefers-reduced-motion: reduce){
      body.design-preview-animate-page,
      body.design-preview-animate-sections .section{
        animation:none !important;
      }
    }
  `;

  doc.body.classList.toggle(
    'design-preview-animate-page',
    pageAnimation !== 'none'
  );

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

  sizeDesignPreview();
}

function replayDesignAnimations() {
  const doc = getDesignPreviewDocument();
  if (!doc?.body) return;

  doc.body.classList.remove(
    'design-preview-animate-page',
    'design-preview-animate-sections'
  );

  // força reflow para reiniciar as keyframes
  void doc.body.offsetWidth;

  applyDesignPreview();

  try {
    $('design-preview-frame')?.contentWindow?.scrollTo(0, 0);
  } catch (_) {}
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
  if ($('design-nav-style')) $('design-nav-style').value = 'auto';
  if ($('design-nav-position')) $('design-nav-position').value = 'fixed';
  if ($('design-nav-density')) $('design-nav-density').value = 'normal';
  if ($('design-logo-scale')) $('design-logo-scale').value = '100';
  if ($('design-nav-cta')) $('design-nav-cta').value = 'outline';
  if ($('design-nav-blur')) $('design-nav-blur').value = '0';

  if ($('design-page-animation')) $('design-page-animation').value = 'none';
  if ($('design-section-animation')) $('design-section-animation').value = 'none';
  if ($('design-image-hover')) $('design-image-hover').value = 'site';
  if ($('design-motion-speed')) $('design-motion-speed').value = 'normal';

  if ($('design-type-scale')) $('design-type-scale').value = '100';
  if ($('design-content-width')) $('design-content-width').value = '1200';
  if ($('design-section-space')) $('design-section-space').value = '120';
  if ($('design-hero-overlay')) $('design-hero-overlay').value = '40';

  if ($('design-gallery-gap')) $('design-gallery-gap').value = '2';
  if ($('design-image-radius')) $('design-image-radius').value = '0';

  applyDesignPreview();

  flash(
    'Prévia restaurada. Nenhuma alteração foi publicada.',
    'sucesso'
  );
}

function initDesignStudio() {
  if (designStudioReady) {
    setTimeout(() => {
      applyDesignPreview();
      sizeDesignPreview();
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
    'design-image-radius'
  ].forEach(id => {
    $(id)?.addEventListener('input', applyDesignPreview);
    $(id)?.addEventListener('change', applyDesignPreview);
  });

  $('design-replay-animation')?.addEventListener(
    'click',
    replayDesignAnimations
  );

  $('design-reset')?.addEventListener('click', resetDesignPreview);
  $('design-preview-frame')?.addEventListener('load', () => {
    setTimeout(() => {
      try {
        $('design-preview-frame')?.contentWindow?.scrollTo(0, 0);
      } catch (_) {}

      applyDesignPreview();
      sizeDesignPreview();
    }, 100);
  });

  const stage = $('design-preview-stage');
  if (stage && 'ResizeObserver' in window) {
    designPreviewResizeObserver = new ResizeObserver(() => sizeDesignPreview());
    designPreviewResizeObserver.observe(stage);
  }

  window.addEventListener('resize', sizeDesignPreview);
  window.addEventListener('orientationchange', () => {
    setTimeout(sizeDesignPreview, 120);
  });

  setDesignDevice('desktop');
  setTimeout(() => {
    applyDesignPreview();
    sizeDesignPreview();
  }, 140);
}
