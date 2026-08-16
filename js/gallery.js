// ============================================
// GALERIA POR ENSAIO + VISUALIZADOR EM TELA CHEIA
// VERSÃO CMS — SUBSTITUI gallery-data.js + gallery.js
// ============================================
// Mantém a estrutura visual existente:
// .grid / .frame / .filter-btn / #lightbox
//
// IMPORTANTE:
// Este arquivo continua sendo carregado como <script normal>.
// Ele carrega o Supabase dinamicamente, portanto NÃO exige
// alteração imediata no galeria.html.
//
// Depois de colocar este arquivo no lugar de js/gallery.js,
// o galeria.html antigo pode continuar contendo:
//   <script src="js/gallery-data.js"></script>
//   <script src="js/gallery.js"></script>
// O gallery-data.js ficará ignorado por esta versão.

const grid = document.getElementById('gallery-grid');
const filterContainer = document.querySelector('.filters');

let ENSAIOS = [];
let currentEnsaio = null;
let currentPhoto = 0;

const lightbox = document.getElementById('lightbox');
const lightboxStage = document.getElementById('lightbox-stage');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxCounter = document.getElementById('lightbox-counter');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function carregarCMS() {
  try {
    const { createClient } =
      await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

    const { SUPABASE_URL, SUPABASE_ANON_KEY } =
      await import('./supabase-config.js');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const [
      { data: galleries, error: galleriesError },
      { data: categories, error: categoriesError },
      { data: photos, error: photosError }
    ] = await Promise.all([
      supabase
        .from('galleries')
        .select('id,slug,title,description,cover_url,published,sort_order,created_at,category_id')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),

      supabase
        .from('categories')
        .select('id,name,slug,published,sort_order')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),

      supabase
        .from('gallery_photos')
        .select('id,gallery_id,image_url,alt_text,sort_order,published')
        .eq('published', true)
        .order('sort_order', { ascending: true })
    ]);

    if (galleriesError) throw new Error(`Galerias: ${galleriesError.message}`);
    if (categoriesError) throw new Error(`Categorias: ${categoriesError.message}`);
    if (photosError) throw new Error(`Fotografias: ${photosError.message}`);

    const categoryMap = new Map(
      (categories || []).map(category => [category.id, category])
    );

    const photosByGallery = new Map();

    (photos || []).forEach(photo => {
      if (!photosByGallery.has(photo.gallery_id)) {
        photosByGallery.set(photo.gallery_id, []);
      }

      photosByGallery.get(photo.gallery_id).push({
        id: photo.id,
        src: photo.image_url,
        alt: photo.alt_text || ''
      });
    });

    ENSAIOS = (galleries || [])
      .map(gallery => {
        const galleryPhotos = photosByGallery.get(gallery.id) || [];
        const category = categoryMap.get(gallery.category_id);

        return {
          id: gallery.id,
          slug: gallery.slug,
          titulo: gallery.title,
          descricao: gallery.description || '',
          categoria: category?.slug || '',
          categoriaNome: category?.name || '',
          cover: gallery.cover_url || galleryPhotos[0]?.src || '',
          photos: galleryPhotos
        };
      })
      .filter(ensaio => ensaio.photos.length > 0);

    window.ENSAIOS = ENSAIOS;

    renderFilters(categories || []);
    renderGrid();

  } catch (error) {
    console.error('Erro ao carregar a galeria do CMS:', error);

    if (grid) {
      grid.innerHTML = `
        <div class="frame-placeholder" style="grid-column:1/-1;padding:60px 20px;">
          Não foi possível carregar a galeria.
        </div>`;
    }
  }
}

function renderFilters(categories) {
  if (!filterContainer) return;

  filterContainer.innerHTML = `
    <button class="filter-btn active" data-filter="todas">Todas</button>
    ${(categories || []).map(category => `
      <button
        class="filter-btn"
        data-filter="${esc(category.slug)}">
        ${esc(category.name)}
      </button>
    `).join('')}
  `;

  filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterContainer.querySelectorAll('.filter-btn')
        .forEach(button => button.classList.remove('active'));

      btn.classList.add('active');
      renderGrid(btn.dataset.filter);
    });
  });
}

function frameHTML(ensaio, index) {
  const capa = ensaio.cover;
  const total = ensaio.photos.length;

  const imgOrPlaceholder = capa
    ? `<img src="${esc(capa)}" alt="Capa do ensaio: ${esc(ensaio.titulo)}" loading="lazy">`
    : `<div class="frame-placeholder">SEM CAPA</div>`;

  return `
    <div
      class="frame"
      data-category="${esc(ensaio.categoria)}"
      data-ensaio-index="${index}"
      tabindex="0"
      role="button"
      aria-label="Abrir ensaio ${esc(ensaio.titulo)}">
      ${imgOrPlaceholder}
      <span class="frame-count">${total} ${total === 1 ? 'foto' : 'fotos'}</span>
      <div class="frame-title-bar">${esc(ensaio.titulo)}</div>
      <div class="frame-caption">
        <span>Ver ensaio completo →</span>
      </div>
    </div>`;
}

function renderGrid(filter = 'todas') {
  if (!grid) return;

  const visiveis = ENSAIOS
    .map((ensaio, index) => ({ ensaio, index }))
    .filter(({ ensaio }) =>
      filter === 'todas' || ensaio.categoria === filter
    );

  if (!visiveis.length) {
    grid.innerHTML = `
      <div class="frame-placeholder" style="grid-column:1/-1;padding:60px 20px;">
        Nenhuma galeria publicada.
      </div>`;
    return;
  }

  grid.innerHTML = visiveis
    .map(({ ensaio, index }) => frameHTML(ensaio, index))
    .join('');

  grid.querySelectorAll('.frame').forEach(el => {
    const openThis = () =>
      openLightbox(Number(el.dataset.ensaioIndex));

    el.addEventListener('click', openThis);

    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openThis();
      }
    });
  });
}

function openLightbox(ensaioIndex) {
  currentEnsaio = ENSAIOS[ensaioIndex];
  currentPhoto = 0;

  if (!currentEnsaio || !currentEnsaio.photos.length) return;

  lightboxTitle.textContent = currentEnsaio.titulo;
  showPhoto();

  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  lightbox.querySelector('.lightbox-close')?.focus();
}

function closeLightbox() {
  lightbox.classList.remove('is-open');
  document.body.style.overflow = '';
}

function showPhoto() {
  if (!currentEnsaio) return;

  const photo = currentEnsaio.photos[currentPhoto];

  lightboxStage.innerHTML = `
    <img
      src="${esc(photo.src)}"
      alt="${esc(currentEnsaio.titulo)} — foto ${currentPhoto + 1}">
  `;

  lightboxCounter.textContent =
    `${currentPhoto + 1} / ${currentEnsaio.photos.length}`;
}

function nextPhoto() {
  if (!currentEnsaio) return;

  currentPhoto =
    (currentPhoto + 1) % currentEnsaio.photos.length;

  showPhoto();
}

function prevPhoto() {
  if (!currentEnsaio) return;

  currentPhoto =
    (currentPhoto - 1 + currentEnsaio.photos.length) %
    currentEnsaio.photos.length;

  showPhoto();
}

document.getElementById('lightbox-close')
  ?.addEventListener('click', closeLightbox);

document.getElementById('lightbox-next')
  ?.addEventListener('click', nextPhoto);

document.getElementById('lightbox-prev')
  ?.addEventListener('click', prevPhoto);

lightbox?.addEventListener('click', event => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', event => {
  if (!lightbox?.classList.contains('is-open')) return;

  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowRight') nextPhoto();
  if (event.key === 'ArrowLeft') prevPhoto();
});

carregarCMS();
