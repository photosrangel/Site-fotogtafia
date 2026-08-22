/** Controlador visual do modal de fotografias de uma galeria. */
export function renderGalleryPhotosUI({
  $, photos, gallery, attr, withOperationLock,
  setCover, togglePhotoPublished, deletePhoto, savePhotoOrder
}) {
  $('photo-count').textContent = `${photos.length} fotografia${photos.length === 1 ? '' : 's'}`;

  if (!photos.length) {
    $('photo-grid').innerHTML = '<p class="panel-copy" style="grid-column:1/-1;padding:20px;">Nenhuma fotografia nesta galeria.</p>';
    return;
  }

  const grid = $('photo-grid');
  grid.innerHTML = photos.map((photo, index) => `
    <div class="admin-photo ${gallery.cover_url === photo.image_url ? 'admin-photo-cover' : ''} ${photo.published ? 'photo-is-published' : 'photo-is-hidden'}"
      data-photo-id="${attr(photo.id)}" draggable="true"
      title="Arraste para reorganizar ou clique na fotografia para definir como capa">
      <img src="${attr(photo.image_url)}" alt="${attr(photo.alt_text || gallery.title || '')}" loading="lazy"
        onerror="this.parentElement.classList.add('photo-load-error')">
      <span class="photo-order">${index + 1}</span>
      ${gallery.cover_url === photo.image_url ? '<span class="photo-cover-label">CAPA</span>' : ''}
      <button class="photo-status ${photo.published ? 'published' : 'hidden'}"
        data-toggle-photo="${attr(photo.id)}"
        title="${photo.published ? 'Ocultar fotografia do site' : 'Publicar fotografia no site'}" type="button">
        ${photo.published ? '✓ PUBLICADA' : '○ OCULTA'}
      </button>
      <button class="photo-delete" data-delete-photo="${attr(photo.id)}" title="Excluir fotografia" type="button">×</button>
    </div>`).join('');

  grid.querySelectorAll('.admin-photo').forEach(card => {
    const photo = photos.find(item => item.id === card.dataset.photoId);
    card.addEventListener('click', event => {
      if (event.target.closest('.photo-delete') || event.target.closest('.photo-status')) return;
      if (photo) withOperationLock('cover-gallery:' + gallery.id, () => setCover(photo));
    });
    card.addEventListener('dragstart', event => {
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.photoId);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      grid.querySelectorAll('.admin-photo').forEach(item => item.classList.remove('drag-over'));
      savePhotoOrder();
    });
    card.addEventListener('dragover', event => {
      event.preventDefault();
      const dragging = grid.querySelector('.is-dragging');
      if (!dragging || dragging === card) return;
      const rect = card.getBoundingClientRect();
      grid.insertBefore(dragging, event.clientY > rect.top + rect.height / 2 ? card.nextSibling : card);
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', event => {
      event.preventDefault();
      card.classList.remove('drag-over');
    });
  });

  grid.querySelectorAll('[data-toggle-photo]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock('toggle-photo:' + button.dataset.togglePhoto,
        () => togglePhotoPublished(button.dataset.togglePhoto));
    });
  });
  grid.querySelectorAll('[data-delete-photo]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      withOperationLock('delete-photo:' + button.dataset.deletePhoto,
        () => deletePhoto(button.dataset.deletePhoto));
    });
  });
}
