export function normalizeSessionStatus(status) {
  if (status === 'selecionado') return 'selecao_finalizada';
  if (status === 'entregue') return 'fotos_disponiveis';
  return status || 'preparando';
}

function renderProgress({ $, session }) {
  const el = $('session-progress');
  if (!el) return;
  const status = normalizeSessionStatus(session.status);
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
  setCover, deletePhoto, sendSelection, startEditing, retrySelectionNotifications, extendExpiry
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
  renderProgress({ $, session });
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
  const numberList = selecionadas.length ? selecionadas.map(photo => numero(provas.indexOf(photo))) : storedNumbers;
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
    actions.innerHTML = `<span class="status-pill published">Aguardando seleção da cliente</span>${selectionWhatsApp ? `<a href="${attr(selectionWhatsApp)}" target="_blank" rel="noopener" class="small-btn">Notificar por WhatsApp</a>` : ''}`;
  } else {
    const missingEmails = !session.email_selecao_cliente_enviado_em || !session.email_selecao_fotografo_enviado_em;
    actions.innerHTML = `<span class="status-pill published">✓ Seleção finalizada</span>
      ${status === 'selecao_finalizada' ? '<button class="btn btn-accent" id="btn-iniciar-edicao" type="button">Iniciar edição</button>' : ''}
      ${missingEmails ? '<button class="small-btn" id="btn-reenviar-selecao" type="button">Tentar e-mails novamente</button>' : ''}`;
    $('btn-iniciar-edicao')?.addEventListener('click', () => withOperationLock('start-edit:' + session.id, startEditing));
    $('btn-reenviar-selecao')?.addEventListener('click', () => withOperationLock('retry-selection-mail:' + session.id, retrySelectionNotifications));
  }

  const published = status === 'fotos_disponiveis';
  if(published&&session.expires_at){actions.insertAdjacentHTML('beforeend',`<span class="status-pill">Expira em ${new Date(session.expires_at).toLocaleDateString('pt-PT')}</span><button class="small-btn" id="btn-estender-prazo" type="button">Estender prazo</button>`);$('btn-estender-prazo')?.addEventListener('click',extendExpiry)}
  const deliver = $('btn-entregar');
  if (published) {
    deliver.textContent = session.email_entrega_cliente_enviado_em ? 'Fotos publicadas ✓' : 'Reenviar e-mail de entrega';
    deliver.className = session.email_entrega_cliente_enviado_em ? 'btn' : 'btn btn-accent';
    deliver.disabled = Boolean(session.email_entrega_cliente_enviado_em);
  } else {
    deliver.textContent = 'Publicar fotos finais';
    deliver.className = 'btn btn-accent';
    deliver.disabled = status !== 'em_edicao' || finais.length === 0;
    deliver.title = status !== 'em_edicao' ? 'Marque o ensaio como “Em edição” antes de publicar.' : finais.length ? 'Publicar e avisar a cliente por e-mail.' : 'Adicione pelo menos uma foto final.';
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
