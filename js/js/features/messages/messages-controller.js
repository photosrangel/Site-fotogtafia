/** Renderização da lista de mensagens, preservando o markup do Admin V2. */
export function renderMessagesUI({
  list,
  rows,
  esc,
  attr,
  openReplyMessage,
  markRead,
  deleteMessage,
  withOperationLock
}) {
  if (!rows.length) {
    list.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Nenhuma mensagem</p>
        <p class="panel-copy">As mensagens enviadas pelo formulário da página de contato aparecerão aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = rows.map(message => `
    <article class="msg-card ${message.lida ? '' : 'nao-lida'}">
      <div class="msg-card-head">
        <div>
          <div class="msg-card-nome">${esc(message.nome)}</div>
          <div class="msg-card-meta">${esc(message.email || '')}${message.tipo ? ' · ' + esc(message.tipo) : ''}</div>
        </div>
        <span class="msg-card-meta">${new Date(message.created_at).toLocaleString('pt-PT')}</span>
      </div>

      <p class="msg-card-corpo">${esc(message.mensagem)}</p>

      <div class="card-actions">
        <button class="small-btn msg-reply-btn" data-reply-msg="${attr(message.id)}" type="button">Responder</button>
        ${message.lida ? '' : `<button class="small-btn" data-mark-read="${attr(message.id)}" type="button">Marcar como lida</button>`}
        <button class="small-btn danger-btn" data-del-msg="${attr(message.id)}" type="button">Excluir</button>
      </div>
    </article>`).join('');

  list.querySelectorAll('[data-reply-msg]').forEach(button =>
    button.addEventListener('click', () => openReplyMessage(button.dataset.replyMsg))
  );

  list.querySelectorAll('[data-mark-read]').forEach(button =>
    button.addEventListener('click', () =>
      withOperationLock(
        'message-read:' + button.dataset.markRead,
        () => markRead(button.dataset.markRead)
      )
    )
  );

  list.querySelectorAll('[data-del-msg]').forEach(button =>
    button.addEventListener('click', () =>
      withOperationLock(
        'message-delete:' + button.dataset.delMsg,
        () => deleteMessage(button.dataset.delMsg)
      )
    )
  );
}
