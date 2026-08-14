// ============================================
// GALERIA POR ENSAIO + VISUALIZADOR EM TELA CHEIA
// ============================================
// Lê os dados de ENSAIOS (js/gallery-data.js), desenha os cards de capa
// na grade, e controla a abertura/navegação do visualizador (lightbox).

const grid = document.getElementById('gallery-grid');
const filterButtons = document.querySelectorAll('.filter-btn');

let currentEnsaio = null;
let currentPhoto = 0;

// -------- Renderiza um card de capa por ensaio --------
function frameHTML(ensaio, index) {
  const capa = ensaio.photos[0];
  const total = ensaio.photos.length;
  const imgOrPlaceholder = capa.src
    ? `<img src="${capa.src}" alt="Capa do ensaio: ${ensaio.titulo}">`
    : `<div class="frame-placeholder">SUBSTITUA POR SUA FOTO<br>${capa.placeholder}</div>`;

  return `
    <div class="frame" data-category="${ensaio.categoria}" data-ensaio-index="${index}" tabindex="0" role="button" aria-label="Abrir ensaio ${ensaio.titulo}">
      ${imgOrPlaceholder}
      <span class="frame-count">${total} fotos</span>
      <div class="frame-title-bar">${ensaio.titulo}</div>
      <div class="frame-caption"><span>Ver ensaio completo →</div>
    </div>`;
}

function renderGrid(filter = 'todas') {
  const visiveis = ENSAIOS
    .map((e, i) => ({ ensaio: e, index: i }))
    .filter(({ ensaio }) => filter === 'todas' || ensaio.categoria === filter);

  grid.innerHTML = visiveis.map(({ ensaio, index }) => frameHTML(ensaio, index)).join('');

  grid.querySelectorAll('.frame').forEach((el) => {
    const openThis = () => openLightbox(Number(el.dataset.ensaioIndex));
    el.addEventListener('click', openThis);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThis(); }
    });
  });
}

// -------- Filtros --------
filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(btn.dataset.filter);
  });
});

// -------- Lightbox --------
const lightbox = document.getElementById('lightbox');
const lightboxStage = document.getElementById('lightbox-stage');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxCounter = document.getElementById('lightbox-counter');

function openLightbox(ensaioIndex) {
  currentEnsaio = ENSAIOS[ensaioIndex];
  currentPhoto = 0;
  lightboxTitle.textContent = currentEnsaio.titulo;
  showPhoto();
  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  lightbox.querySelector('.lightbox-close').focus();
}

function closeLightbox() {
  lightbox.classList.remove('is-open');
  document.body.style.overflow = '';
}

function showPhoto() {
  const photo = currentEnsaio.photos[currentPhoto];
  lightboxStage.innerHTML = photo.src
    ? `<img src="${photo.src}" alt="${currentEnsaio.titulo} — foto ${currentPhoto + 1}">`
    : `<div class="lightbox-placeholder">SUBSTITUA POR SUA FOTO<br>${photo.placeholder}</div>`;
  lightboxCounter.textContent = `${currentPhoto + 1} / ${currentEnsaio.photos.length}`;
}

function nextPhoto() {
  currentPhoto = (currentPhoto + 1) % currentEnsaio.photos.length;
  showPhoto();
}
function prevPhoto() {
  currentPhoto = (currentPhoto - 1 + currentEnsaio.photos.length) % currentEnsaio.photos.length;
  showPhoto();
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-next').addEventListener('click', nextPhoto);
document.getElementById('lightbox-prev').addEventListener('click', prevPhoto);

// Fecha ao clicar fora da imagem (no fundo escuro)
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Navegação por teclado
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') nextPhoto();
  if (e.key === 'ArrowLeft') prevPhoto();
});

// -------- Inicializa --------
renderGrid();
