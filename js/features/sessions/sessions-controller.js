/** Renderização dos cartões de Ensaios/Clientes sem alterar a UI atual. */
export function renderSessionsUI({
  $,
  sessions,
  esc,
  attr,
  statusLabel,
  openSessionModal,
  deleteSession,
  withOperationLock
}) {
  const container = $('sessions-list');
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Ainda vazio</p>
        <h2 style="font-family:var(--font-display);font-weight:400;">Nenhum ensaio criado.</h2>
        <p class="panel-copy" style="margin-top:8px;">Comece criando a primeira sessão de cliente.</p>
      </div>`;
    return;
  }

  container.innerHTML = sessions.map(session => `
    <article
      class="gallery-admin-card session-admin-card"
      data-session-id="${attr(session.id)}"
      title="Clique para abrir o ensaio"
    >
      <div class="gallery-drag-handle session-drag-placeholder" title="Ensaio" aria-hidden="true">⋮⋮</div>

      <div class="gallery-thumb-wrap">
        ${session.cover_url
          ? `<img class="gallery-thumb" src="${attr(session.cover_url)}" alt="Capa do ensaio ${attr(session.titulo)}" loading="lazy"><span class="gallery-cover-label">CAPA</span>`
          : `<div class="gallery-thumb empty">SEM CAPA</div>`}
      </div>

      <div class="gallery-card-content">
        <div class="gallery-card-title">${esc(session.titulo)}</div>
        <div class="gallery-meta">${esc(session.cliente_nome || '—')} · /${esc(session.slug)}</div>
      </div>

      <div class="gallery-card-controls">
        <span class="status-pill ${session.status === 'preparando' ? 'draft' : 'published'}">
          ${esc(statusLabel(session.status))}
        </span>

        <div class="card-actions gallery-card-actions">
          <button class="small-btn" data-open-session="${attr(session.id)}" type="button">Abrir</button>
          <button class="small-btn danger-btn" data-delete-session="${attr(session.id)}" type="button">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.session-admin-card').forEach(card => {
    card.addEventListener('click', () => openSessionModal(card.dataset.sessionId));
  });

  container.querySelectorAll('[data-open-session]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openSessionModal(button.dataset.openSession);
    });
  });

  container.querySelectorAll('[data-delete-session]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock(
        'delete-session:' + button.dataset.deleteSession,
        () => deleteSession(button.dataset.deleteSession)
      );
    });
  });
}
