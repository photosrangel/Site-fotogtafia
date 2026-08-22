/**
 * Controlador visual de Galerias.
 * Renderização, bindings e drag-and-drop foram isolados sem mudar o markup
 * atual, preparando a futura conversão deste domínio para componentes Next.js.
 */
export function renderGalleriesUI({
  $,
  galleries,
  esc,
  attr,
  openGalleryModal,
  editGallery,
  toggleGallery,
  deleteGallery,
  withOperationLock,
  onReorder
}) {
  const container = $('galleries-list');
  if (!container) return;

  if (!galleries.length) {
    container.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Ainda vazio</p>
        <h2 style="font-family:var(--font-display);font-weight:400;">Nenhuma galeria criada.</h2>
        <p class="panel-copy" style="margin-top:8px;">Comece criando a primeira galeria do novo CMS.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = galleries.map(gallery => `
    <article
      class="gallery-admin-card"
      data-gallery-id="${attr(gallery.id)}"
      draggable="true"
      title="Arraste para mudar a posição da galeria"
    >
      <div class="gallery-drag-handle"
        title="Arraste para mudar a posição ou clique para usar como capa"
        aria-label="Arraste para mudar a posição"
      >⋮⋮</div>

      <div class="gallery-thumb-wrap">
        ${gallery.cover_url
          ? `<img class="gallery-thumb" src="${attr(gallery.cover_url)}" alt="Capa da galeria ${attr(gallery.title)}" loading="lazy"><span class="gallery-cover-label">CAPA</span>`
          : `<div class="gallery-thumb empty">SEM CAPA</div>`}
      </div>

      <div class="gallery-card-content">
        <div class="gallery-card-title">${esc(gallery.title)}</div>
        <div class="gallery-meta">
          /${esc(gallery.slug)}
          ${gallery.categories?.name ? ` · ${esc(gallery.categories.name)}` : ''}
        </div>
      </div>

      <div class="gallery-card-controls">
        <span class="status-pill ${gallery.published ? 'published' : 'draft'}">
          ${gallery.published ? 'PUBLICADA' : 'OCULTA'}
        </span>

        <div class="card-actions gallery-card-actions">
          <button class="small-btn" data-photos="${attr(gallery.id)}" type="button">Fotos</button>
          <button class="small-btn" data-edit-gallery="${attr(gallery.id)}" type="button">Editar</button>
          <button class="small-btn" data-toggle-gallery="${attr(gallery.id)}" type="button">
            ${gallery.published ? 'Ocultar' : 'Publicar'}
          </button>
          <button class="small-btn danger-btn" data-delete-gallery="${attr(gallery.id)}" type="button">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.gallery-admin-card').forEach(card => {
    card.addEventListener('click', event => {
      if (
        event.target.closest('button') ||
        event.target.closest('a') ||
        event.target.closest('.gallery-drag-handle')
      ) return;
      openGalleryModal(card.dataset.galleryId);
    });
  });

  container.querySelectorAll('[data-photos]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openGalleryModal(button.dataset.photos);
    });
  });

  container.querySelectorAll('[data-edit-gallery]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      editGallery(button.dataset.editGallery);
    });
  });

  container.querySelectorAll('[data-toggle-gallery]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock(
        'toggle-gallery:' + button.dataset.toggleGallery,
        () => toggleGallery(button.dataset.toggleGallery)
      );
    });
  });

  container.querySelectorAll('[data-delete-gallery]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock(
        'delete-gallery:' + button.dataset.deleteGallery,
        () => deleteGallery(button.dataset.deleteGallery)
      );
    });
  });

  bindGalleryOrdering({ container, onReorder });
}

function bindGalleryOrdering({ container, onReorder }) {
  let draggedCard = null;
  const cards = [...container.querySelectorAll('.gallery-admin-card')];

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

    card.addEventListener('dragstart', event => {
      if (card.dataset.dragArmed !== '1') {
        event.preventDefault();
        card.draggable = false;
        return;
      }

      draggedCard = card;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.galleryId);
    });

    card.addEventListener('dragover', event => {
      event.preventDefault();
      if (!draggedCard || draggedCard === card) return;

      event.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const centerX = rect.left + rect.width / 2;
      const sameRow = Math.abs(event.clientY - centerY) < rect.height * .38;
      const after = event.clientY > centerY || (sameRow && event.clientX > centerX);

      container.insertBefore(draggedCard, after ? card.nextSibling : card);
      container.querySelectorAll('.gallery-admin-card').forEach(item => item.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    card.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      card.classList.remove('drag-over');
    });

    card.addEventListener('dragend', async () => {
      if (!draggedCard) return;

      draggedCard.classList.remove('is-dragging');
      container.querySelectorAll('.gallery-admin-card').forEach(item => item.classList.remove('drag-over'));
      draggedCard = null;
      card.dataset.dragArmed = '0';
      card.draggable = false;

      await onReorder();
    });

    card.addEventListener('dragleave', event => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('drag-over');
    });
  });
}
