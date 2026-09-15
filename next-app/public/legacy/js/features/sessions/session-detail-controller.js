export function normalizeSessionStatus(status) {
  if (status === 'selecionado') return 'selecao_finalizada';
  if (status === 'entregue') return 'fotos_disponiveis';
  return status || 'preparando';
}

function formatDeadline(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function remainingDays(value) {
  return value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) : 0;
}

function renderProgress({ $, session, provas, finais }) {
  const el = $('session-progress');
  if (!el) return;
  const status = normalizeSessionStatus(session.status);
  const deleteProofs=$('btn-excluir-provas');
  const deleteFinals=$('btn-excluir-finais');
  if(deleteProofs){deleteProofs.hidden=provas.length===0;deleteProofs.textContent='Excluir todas as provas, mantendo a capa'}
  if(deleteFinals)deleteFinals.hidden=finais.length===0;
  const steps = [
    ['Seleção', status === 'aguardando_selecao' ? 'Aguardando cliente' : 'Recebida'],
    ['Edição', status === 'em_edicao' ? 'Em andamento' : 'Tratamento'],
    ['Entrega', 'Fotos finais']
  ];
  const states = [
    ['selecao_finalizada', 'em_edicao', 'fotos_disponiveis'].includes(status) ? 'done' : 'active',
    status === 'fotos_disponiveis' ? 'done' : status === 'em_edicao' ? 'active' : 'pending',
    status === 'fotos_disponiveis' ? 'done' : 'pending'
  ];
  el.innerHTML = steps.map((step, index) => `
    <div class="session-progress-step ${states[index]}">
      <span class="session-progress-dot">${states[index] === 'done' ? '✓' : index + 1}</span>
      <span class="session-progress-text"><strong>${step[0]}</strong><small>${step[1]}</small></span>
    </div>`).join('<span class="session-progress-line" aria-hidden="true"></span>');
}

function renderEmailState({ $, session, esc }) {
  const el = $('session-email-state');
  if (!el) return;
  const items = [];
  if (session.email_selecao_cliente_enviado_em) items.push('Cliente: seleção ✓');
  if (session.email_selecao_fotografo_enviado_em) items.push('Fotógrafo: seleção ✓');
  if (session.email_entrega_cliente_enviado_em) items.push('Cliente: entrega ✓');
  el.innerHTML = items.length
    ? items.map(text => `<span class="status-pill published">${esc(text)}</span>`).join('')
    : '<span class="status-pill draft">E-mails ainda não enviados</span>';
}

export function renderSessionDetailUI({
  $, session, photos, attr, esc, numero, msg, location,
  syncAccordions, configureOrdering, withOperationLock,
  setCover, deletePhoto, sendSelection, startEditing, retrySelectionNotifications, remindClient, extendExpiry
}) {
  const linkCliente = `${location.origin}/area-cliente`;
  const provas = photos.filter(photo => photo.tipo === 'prova');
  const finais = photos.filter(photo => photo.tipo === 'final');
  const selecionadas = provas.filter(photo => photo.selecionada);
  const fallbackCover = photos.slice().sort((a, b) => Number(a.ordem ?? 999999) - Number(b.ordem ?? 999999))[0]?.id || null;
  const coverId = session.capa_foto_id || fallbackCover;

  $('modal-session-title').textContent = session.titulo;
  $('session-link').textContent = linkCliente;
  $('session-login-box').textContent = session.slug;
  $('session-senha').textContent = session.codigo_acesso;
  $('session-client-email').value = session.cliente_email || '';
  $('prova-count').textContent = provas.length;
  $('final-count').textContent = finais.length;
  renderProgress({ $, session, provas, finais });
  renderEmailState({ $, session, esc });
  syncAccordions();

  const renderPhoto = (photo, index, allowDelete) => `
    <div class="session-photo ${photo.selecionada ? 'selecionada' : ''} ${photo.id === coverId ? 'session-photo-cover' : ''}"
      data-session-photo-id="${attr(photo.id)}" draggable="true"
      title="Arraste para mudar a posição ou clique para usar como capa">
      <img src="${attr(photo.url)}" alt="" loading="lazy">
      ${photo.id === coverId ? '<span class="session-cover-label">CAPA</span>' : ''}
      <span class="photo-order">${numero(index)}</span>
      ${allowDelete ? `<button class="photo-delete session-photo-delete" data-delete-session-photo="${attr(photo.id)}" title="Excluir esta prova" type="button">×</button>` : ''}
    </div>`;

  $('prova-grid').innerHTML = provas.length
    ? provas.map((photo, index) => renderPhoto(photo, index, true)).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma prova enviada ainda.</p>';
  $('final-grid').innerHTML = finais.length
    ? finais.map((photo, index) => renderPhoto(photo, index, false)).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma foto final enviada ainda.</p>';

  $('prova-grid').querySelectorAll('[data-delete-session-photo]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock('delete-session-photo:' + button.dataset.deleteSessionPhoto,
        () => deletePhoto(button.dataset.deleteSessionPhoto));
    });
  });
  [$('prova-grid'), $('final-grid')].forEach(grid => {
    configureOrdering(grid);
    grid.querySelectorAll('.session-photo[data-session-photo-id]').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        const id = card.dataset.sessionPhotoId;
        if (id && id !== coverId) withOperationLock('cover-session:' + session.id, () => setCover(id));
      });
    });
  });

  const storedNumbers = Array.isArray(session.selected_photo_numbers) ? session.selected_photo_numbers : [];
  const liveNumbers = selecionadas.map(photo => numero(provas.indexOf(photo)));
  // A seleção persistida não pode ser substituída por uma leitura parcial das
  // provas durante ou depois da limpeza do armazenamento.
  const numberList = storedNumbers.length >= liveNumbers.length ? storedNumbers : liveNumbers;
  const selectedNumbers = numberList.join(', ');
  $('selecionadas-box').innerHTML = numberList.length
    ? `<div class="session-select-box"><p class="footer-mono" style="margin-bottom:4px;">Fotos que a cliente escolheu (${numberList.length}):</p><p style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);">${esc(selectedNumbers.replaceAll(', ', '.cr3, ') + '.cr3')}</p></div>`
    : '';

  const status = normalizeSessionStatus(session.status);
  const selectionWhatsApp = session.cliente_telefone
    ? `https://wa.me/${session.cliente_telefone}?text=${encodeURIComponent(`Olá${session.cliente_nome ? ', ' + session.cliente_nome : ''}! Suas fotos já estão prontas para você escolher as favoritas! \n\nAcesse: ${linkCliente}\nLogin: ${session.slug}\nSenha: ${session.codigo_acesso}`)}`
    : null;
  const actions = $('selecao-actions');
  if (status === 'preparando') {
    actions.innerHTML = `<button class="btn btn-accent" id="btn-enviar-selecao" ${provas.length ? '' : 'disabled'}>Enviar fotos para seleção</button>`;
    $('btn-enviar-selecao').addEventListener('click', () => withOperationLock('selecao:' + session.id, sendSelection));
  } else if (status === 'aguardando_selecao') {
    actions.innerHTML = `<span class="status-pill published">Aguardando seleção da cliente</span><button class="small-btn" id="btn-lembrar-cliente" type="button">Lembrar cliente agora</button>${selectionWhatsApp ? `<a href="${attr(selectionWhatsApp)}" target="_blank" rel="noopener" class="small-btn">Notificar por WhatsApp</a>` : ''}`;
    $('btn-lembrar-cliente').addEventListener('click', () => withOperationLock('lembrete:' + session.id, remindClient));
  } else {
    const missingEmails = !session.email_selecao_cliente_enviado_em || !session.email_selecao_fotografo_enviado_em;
    actions.innerHTML = `<span class="status-pill published">✓ Seleção finalizada</span>
      ${status === 'selecao_finalizada' ? '<button class="btn btn-accent" id="btn-iniciar-edicao" type="button">Iniciar edição</button>' : ''}
      ${missingEmails ? '<button class="small-btn" id="btn-reenviar-selecao" type="button">Tentar e-mails novamente</button>' : ''}`;
    $('btn-iniciar-edicao')?.addEventListener('click', () => withOperationLock('start-edit:' + session.id, startEditing));
    $('btn-reenviar-selecao')?.addEventListener('click', () => withOperationLock('retry-selection-mail:' + session.id, retrySelectionNotifications));
  }

  const published = status === 'fotos_disponiveis';
  const deadline = $('session-delivery-deadline');
  if (deadline) {
    if (session.expires_at) {
      const days = remainingDays(session.expires_at);
      const expired = new Date(session.expires_at).getTime() <= Date.now();
      deadline.innerHTML = `<div class="session-select-box"><p class="section-eyebrow">Prazo de acesso e download</p><p style="margin:8px 0 4px;"><strong>${expired ? 'Prazo encerrado' : `${days} dia${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'}`}</strong></p><p class="panel-copy" style="margin:0;">Publicado em ${formatDeadline(session.delivered_at || session.publicado_em)} · Disponível até ${formatDeadline(session.expires_at)}</p><button class="small-btn" id="btn-estender-prazo" type="button" style="margin-top:12px;">Estender prazo</button></div>`;
      $('btn-estender-prazo')?.addEventListener('click', extendExpiry);
    } else {
      deadline.innerHTML = '<div class="session-select-box"><p class="section-eyebrow">Prazo de acesso e download</p><p class="panel-copy" style="margin:8px 0 0;">O prazo ainda não começou. Ele será iniciado somente depois de publicar as fotos finais e confirmar o envio do e-mail.</p></div>';
    }
  }
  const deliver = $('btn-entregar');
  if (published) {
    deliver.textContent = session.email_entrega_cliente_enviado_em ? 'Fotos publicadas ✓' : 'Reenviar e-mail de entrega';
    deliver.className = session.email_entrega_cliente_enviado_em ? 'btn' : 'btn btn-accent';
    deliver.disabled = Boolean(session.email_entrega_cliente_enviado_em);
  } else {
    deliver.textContent = 'Publicar fotos finais';
    deliver.className = 'btn btn-accent';
    deliver.disabled = finais.length === 0;
    deliver.title = finais.length
      ? 'Publicar as fotos finais, avisar a cliente por e-mail e iniciar o prazo de acesso.'
      : 'Adicione pelo menos uma foto final.';
  }
  const deliveryWhatsApp = session.cliente_telefone
    ? `https://wa.me/${session.cliente_telefone}?text=${encodeURIComponent(`Olá${session.cliente_nome ? ', ' + session.cliente_nome : ''}! Suas fotos finais já estão prontas para download! \n\nAcesse: ${linkCliente}\nLogin: ${session.slug}\nSenha: ${session.codigo_acesso}`)}` : null;
  const deliveryLink = $('link-whats-entrega');
  if (published && deliveryWhatsApp) {
    deliveryLink.href = deliveryWhatsApp;
    deliveryLink.style.display = '';
  } else deliveryLink.style.display = 'none';
  msg($('session-msg'), '');
}
