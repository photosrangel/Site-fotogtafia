// ============================================
// GALERIA POR ENSAIO + CMS SUPABASE
// INTEGRAÇÃO HÍBRIDA
// ============================================

const grid = document.getElementById('gallery-grid');
const filtersContainer = document.getElementById('gallery-filters');

let currentEnsaio = null;
let currentPhoto = 0;


// ============================================
// GALERIAS ANTIGAS
// ============================================

const ENSAIOS_ANTIGOS = (
  typeof ENSAIOS !== 'undefined' &&
  Array.isArray(ENSAIOS)
)
  ? ENSAIOS.map(ensaio => ({
      ...ensaio,
      categoria: String(ensaio.categoria || '').toLowerCase(),
      photos: Array.isArray(ensaio.photos)
        ? [...ensaio.photos]
        : []
    }))
  : [];


// ============================================
// LISTA FINAL DO SITE
// ============================================

let ENSAIOS_SITE = [...ENSAIOS_ANTIGOS];


// ============================================
// CATEGORIAS
// ============================================

let CATEGORIAS_SITE = [];


// ============================================
// ELEMENTOS DO LIGHTBOX
// ============================================

const lightbox =
  document.getElementById('lightbox');

const lightboxStage =
  document.getElementById('lightbox-stage');

const lightboxTitle =
  document.getElementById('lightbox-title');

const lightboxCounter =
  document.getElementById('lightbox-counter');


// ============================================
// SEGURANÇA
// ============================================

function esc(value) {

  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


// ============================================
// VERIFICA FOTO REAL
// ============================================

function temFotoReal(ensaio) {

  if (ensaio.cover) {
    return true;
  }

  return (
    Array.isArray(ensaio.photos) &&
    ensaio.photos.some(photo => photo.src)
  );

}


// ============================================
// CARD DA GALERIA
// ============================================

function frameHTML(ensaio, index) {

  const capa =
    ensaio.cover ||
    (
      ensaio.photos &&
      ensaio.photos[0]
        ? ensaio.photos[0].src
        : null
    );

  const total =
    ensaio.photos.length;


  const imgOrPlaceholder =
    capa

      ? `
        <img
          src="${esc(capa)}"
          alt="Capa do ensaio: ${esc(ensaio.titulo)}"
          loading="lazy"
        >
      `

      : `
        <div class="frame-placeholder">
          SUBSTITUA POR SUA FOTO
          <br>
          ${
            ensaio.photos[0]?.placeholder || ''
          }
        </div>
      `;


  return `
    <div
      class="frame"
      data-category="${esc(
        String(ensaio.categoria || '').toLowerCase()
      )}"
      data-ensaio-index="${index}"
      tabindex="0"
      role="button"
      aria-label="Abrir ensaio ${esc(
        ensaio.titulo
      )}"
    >

      ${imgOrPlaceholder}

      <span class="frame-count">
        ${total}
        ${total === 1 ? 'foto' : 'fotos'}
      </span>

      <div class="frame-title-bar">
        ${esc(ensaio.titulo)}
      </div>

      <div class="frame-caption">
        <span>
          Ver ensaio completo →
        </span>
      </div>

    </div>
  `;

}


// ============================================
// RENDERIZA FILTROS
// ============================================

function renderFiltros() {

  if (!filtersContainer) {
    return;
  }


  const categorias = [...CATEGORIAS_SITE];


  filtersContainer.innerHTML = `
    <button
      class="filter-btn active"
      data-filter="todas"
    >
      Todas
    </button>
  `;


  categorias
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) -
        (b.sort_order ?? 0)
    )
    .forEach(category => {

      const slug =
        String(category.slug || '')
          .trim()
          .toLowerCase();


      if (!slug) {
        return;
      }


      const button =
        document.createElement('button');


      button.className =
        'filter-btn';


      button.dataset.filter =
        slug;


      button.textContent =
        category.name;


      filtersContainer.appendChild(
        button
      );

    });


  configurarFiltros();

}


// ============================================
// RENDERIZA GALERIA
// ============================================

function renderGrid(filter = 'todas') {

  if (!grid) {
    return;
  }


  const filtro =
    String(filter || 'todas')
      .toLowerCase();


  const visiveis =
    ENSAIOS_SITE
      .map((ensaio, index) => ({
        ensaio,
        index
      }))
      .filter(({ ensaio }) => {

        if (!temFotoReal(ensaio)) {
          return false;
        }


        if (filtro === 'todas') {
          return true;
        }


        return (
          String(ensaio.categoria || '')
            .toLowerCase() === filtro
        );

      });


  if (!visiveis.length) {

    grid.innerHTML = `
      <div
        class="frame-placeholder"
        style="
          grid-column: 1 / -1;
          padding: 60px 20px;
        "
      >
        Nenhum ensaio encontrado.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    visiveis
      .map(({ ensaio, index }) =>
        frameHTML(
          ensaio,
          index
        )
      )
      .join('');


  grid
    .querySelectorAll('.frame')
    .forEach(frame => {

      const abrir =
        () =>
          openLightbox(
            Number(
              frame.dataset.ensaioIndex
            )
          );


      frame.addEventListener(
        'click',
        abrir
      );


      frame.addEventListener(
        'keydown',
        event => {

          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {

            event.preventDefault();

            abrir();

          }

        }
      );

    });

}


// ============================================
// FILTROS
// ============================================

function configurarFiltros() {

  if (!filtersContainer) {
    return;
  }


  filtersContainer
    .querySelectorAll('.filter-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          filtersContainer
            .querySelectorAll('.filter-btn')
            .forEach(btn =>
              btn.classList.remove(
                'active'
              )
            );


          button.classList.add(
            'active'
          );


          renderGrid(
            button.dataset.filter
          );

        }
      );

    });

}


// ============================================
// LIGHTBOX
// ============================================

function openLightbox(
  ensaioIndex
) {

  currentEnsaio =
    ENSAIOS_SITE[
      ensaioIndex
    ];

  currentPhoto = 0;


  if (
    !currentEnsaio ||
    !currentEnsaio.photos ||
    !currentEnsaio.photos.length
  ) {

    return;

  }


  if (lightboxTitle) {

    lightboxTitle.textContent =
      currentEnsaio.titulo;

  }


  showPhoto();


  if (lightbox) {

    lightbox.classList.add(
      'is-open'
    );

  }


  document.body.style.overflow =
    'hidden';


  lightbox
    ?.querySelector(
      '.lightbox-close'
    )
    ?.focus();

}


function closeLightbox() {

  lightbox?.classList.remove(
    'is-open'
  );

  document.body.style.overflow =
    '';

}


function showPhoto() {

  if (!currentEnsaio) {
    return;
  }


  const photo =
    currentEnsaio.photos[
      currentPhoto
    ];


  if (!photo) {
    return;
  }


  if (lightboxStage) {

    lightboxStage.innerHTML =
      photo.src

        ? `
          <img
            src="${esc(photo.src)}"
            alt="${esc(
              currentEnsaio.titulo
            )} — foto ${
              currentPhoto + 1
            }"
          >
        `

        : `
          <div class="lightbox-placeholder">
            SUBSTITUA POR SUA FOTO
            <br>
            ${
              photo.placeholder || ''
            }
          </div>
        `;

  }


  if (lightboxCounter) {

    lightboxCounter.textContent =
      `${currentPhoto + 1} / ${
        currentEnsaio.photos.length
      }`;

  }

}


function nextPhoto() {

  if (!currentEnsaio) {
    return;
  }


  currentPhoto =
    (
      currentPhoto + 1
    ) %
    currentEnsaio.photos.length;


  showPhoto();

}


function prevPhoto() {

  if (!currentEnsaio) {
    return;
  }


  currentPhoto =
    (
      currentPhoto -
      1 +
      currentEnsaio.photos.length
    ) %
    currentEnsaio.photos.length;


  showPhoto();

}


// ============================================
// EVENTOS LIGHTBOX
// ============================================

document
  .getElementById(
    'lightbox-close'
  )
  ?.addEventListener(
    'click',
    closeLightbox
  );


document
  .getElementById(
    'lightbox-next'
  )
  ?.addEventListener(
    'click',
    nextPhoto
  );


document
  .getElementById(
    'lightbox-prev'
  )
  ?.addEventListener(
    'click',
    prevPhoto
  );


lightbox?.addEventListener(
  'click',
  event => {

    if (
      event.target === lightbox
    ) {

      closeLightbox();

    }

  }
);


document.addEventListener(
  'keydown',
  event => {

    if (
      !lightbox?.classList.contains(
        'is-open'
      )
    ) {

      return;

    }


    if (event.key === 'Escape') {
      closeLightbox();
    }


    if (event.key === 'ArrowRight') {
      nextPhoto();
    }


    if (event.key === 'ArrowLeft') {
      prevPhoto();
    }

  }
);


// ============================================
// CMS SUPABASE
// ============================================

async function carregarGaleriasCMS() {

  try {

    const { createClient } =
      await import(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
      );


    const {
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    } =
      await import(
        './supabase-config.js'
      );


    const supabase =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );


    // ========================================
    // GALERIAS
    // ========================================

    const galleriesResult =
      await supabase
        .from('galleries')
        .select(`
          id,
          title,
          slug,
          description,
          category_id,
          cover_url,
          published,
          sort_order,
          created_at
        `)
        .eq(
          'published',
          true
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
            ascending: false
          }
        );


    if (galleriesResult.error) {
      throw galleriesResult.error;
    }


    const galleries =
      galleriesResult.data || [];


    // ========================================
    // CATEGORIAS
    // ========================================

    const categoriesResult =
      await supabase
        .from('categories')
        .select(`
          id,
          name,
          slug,
          published,
          sort_order
        `)
        .eq(
          'published',
          true
        )
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


    if (categoriesResult.error) {
      throw categoriesResult.error;
    }


    const categories =
      categoriesResult.data || [];


    CATEGORIAS_SITE =
      categories.map(category => ({
        ...category,
        slug:
          String(
            category.slug || ''
          )
            .trim()
            .toLowerCase()
      }));


    // ========================================
    // FOTOS
    // ========================================

    const photosResult =
      await supabase
        .from('gallery_photos')
        .select(`
          id,
          gallery_id,
          image_url,
          alt_text,
          sort_order,
          published
        `)
        .eq(
          'published',
          true
        )
        .order(
          'sort_order',
          {
            ascending: true
          }
        );


    if (photosResult.error) {
      throw photosResult.error;
    }


    const photos =
      photosResult.data || [];


    // ========================================
    // MAPA DE CATEGORIAS
    // ========================================

    const categoryMap =
      new Map();


    CATEGORIAS_SITE.forEach(
      category => {

        categoryMap.set(
          category.id,
          category
        );

      }
    );


    // ========================================
    // MAPA DE FOTOS
    // ========================================

    const photosMap =
      new Map();


    photos.forEach(
      photo => {

        if (
          !photosMap.has(
            photo.gallery_id
          )
        ) {

          photosMap.set(
            photo.gallery_id,
            []
          );

        }


        photosMap
          .get(photo.gallery_id)
          .push({

            id:
              photo.id,

            src:
              photo.image_url,

            placeholder:
              '',

            alt:
              photo.alt_text || '',

            ordem:
              photo.sort_order || 0,

            publicada:
              photo.published === true

          });

      }
    );


    // ========================================
    // CONVERTE GALERIAS
    // ========================================

    const novasGalerias =
      galleries

        .map(gallery => {

          const category =
            categoryMap.get(
              gallery.category_id
            );


          const fotos =
            photosMap.get(
              gallery.id
            ) || [];


          fotos.sort(
            (a, b) =>
              a.ordem -
              b.ordem
          );


          return {

            id:
              `cms-${gallery.id}`,

            cmsId:
              gallery.id,

            slug:
              gallery.slug,

            titulo:
              gallery.title,

            categoria:
              String(
                category?.slug ||
                'sem-categoria'
              )
                .toLowerCase(),

            categoriaNome:
              category?.name ||
              'Sem categoria',

            lente:
              '',

            cover:
              gallery.cover_url ||
              fotos[0]?.src ||
              null,

            photos:
              fotos

          };

        })

        .filter(
          gallery =>
            gallery.photos.length > 0
        );


    // ========================================
    // EVITA DUPLICAÇÃO
    // ========================================

    const slugsExistentes =
      new Set(
        ENSAIOS_SITE
          .map(
            ensaio =>
              String(
                ensaio.slug ||
                ensaio.id ||
                ''
              )
                .toLowerCase()
          )
      );


    const novas =
      novasGalerias.filter(
        gallery => {

          const chave =
            String(
              gallery.slug ||
              gallery.id ||
              ''
            )
              .toLowerCase();


          return !slugsExistentes.has(
            chave
          );

        }
      );


    // ========================================
    // ADICIONA CMS
    // ========================================

    ENSAIOS_SITE =
      [
        ...ENSAIOS_SITE,
        ...novas
      ];


    // ========================================
    // DISPONÍVEL NO CONSOLE
    // ========================================

    window.ENSAIOS_SITE =
      ENSAIOS_SITE;

    window.CATEGORIAS_SITE =
      CATEGORIAS_SITE;


    // ========================================
    // ATUALIZA FILTROS
    // ========================================

    renderFiltros();


    // ========================================
    // ATUALIZA GALERIA
    // ========================================

    renderGrid();


    // ========================================
    // DEBUG
    // ========================================

    console.log(
      'Categorias CMS:',
      CATEGORIAS_SITE
    );


    console.log(
      'Galerias antigas:',
      ENSAIOS_ANTIGOS
    );


    console.log(
      'Galerias CMS:',
      novas
    );


    console.log(
      'Total de galerias:',
      ENSAIOS_SITE.length
    );


  } catch (error) {

    console.error(
      'Erro ao carregar CMS:',
      error
    );


    ENSAIOS_SITE =
      [...ENSAIOS_ANTIGOS];


    renderGrid();

  }

}


// ============================================
// INICIALIZAÇÃO
// ============================================

// Primeiro mostra o conteúdo antigo.
renderGrid();


// Depois carrega as categorias e galerias
// do Supabase.
carregarGaleriasCMS();
