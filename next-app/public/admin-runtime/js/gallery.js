// ============================================
// GALERIA POR ENSAIO + CMS SUPABASE
// INTEGRAÇÃO HÍBRIDA
// ============================================

const grid = document.getElementById('gallery-grid');
const filtersContainer = document.getElementById('gallery-filters');
const trailsContainer = document.getElementById('gallery-trails');
const allTrailsButton = document.getElementById('gallery-all-trails');

let currentEnsaio = null;
let currentPhoto = 0;
let currentTrailId = null;
let currentFilter = 'todas';


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
let TRILHAS_SITE = [];

const normalizeName = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const PORTRAIT_CATEGORIES = ['estudio', 'externo', 'corporativo', 'retratos', 'retrato'];
const SELF_ESTEEM_CATEGORIES = ['autoestima', 'sensual', 'boudoir'];

function knownTrailCategories(trail) {
  if (!trail) return null;
  const identity = normalizeName(`${trail.slug || ''} ${trail.name || ''}`);
  if (identity.includes('autoestima') && (identity.includes('sensual') || identity.includes('boudoir'))) return SELF_ESTEEM_CATEGORIES;
  if (identity.includes('retrato') && identity.includes('corporativo')) return PORTRAIT_CATEGORIES;
  return null;
}

function belongsToTrail(categorySlug, trailId) {
  if (!currentTrailId) return true;
  const selected = TRILHAS_SITE.find(item => item.id === currentTrailId);
  const semantic = knownTrailCategories(selected);
  if (semantic) return semantic.includes(normalizeName(categorySlug));
  return trailId === currentTrailId;
}


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
          style="object-position:${Number(ensaio.coverFocusX ?? 50)}% ${Number(ensaio.coverFocusY ?? 50)}%"
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


  const categorias = CATEGORIAS_SITE.filter(category =>
    belongsToTrail(category.slug, category.trail_id)
  );


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

function renderTrilhas() {
  if (!trailsContainer) return;

  allTrailsButton?.classList.toggle('active', currentTrailId === null);

  trailsContainer.innerHTML = TRILHAS_SITE.map(trail => {
    const semantic = knownTrailCategories(trail);
    const first = ENSAIOS_SITE.find(ensaio => ensaio.trailId === trail.id) ||
      ENSAIOS_SITE.find(ensaio => semantic?.includes(normalizeName(ensaio.categoria)));
    const cover = trail.cover_url || first?.cover || first?.photos?.[0]?.src || '';
    const x = Number(trail.cover_focus_x ?? 50);
    const y = Number(trail.cover_focus_y ?? 50);

    return `
      <button
        type="button"
        class="gallery-trail-card${currentTrailId === trail.id ? ' active' : ''}"
        data-gallery-trail-id="${esc(trail.id)}"
        style="background-image:linear-gradient(180deg,transparent,rgba(8,8,7,.92)),url('${esc(cover)}');background-position:${x}% ${y}%"
      >
        <span><strong>${esc(trail.name)}</strong><small>${esc(trail.description || 'Ver ensaios →')}</small></span>
      </button>
    `;
  }).join('');

  trailsContainer.querySelectorAll('[data-gallery-trail-id]').forEach(button => {
    button.addEventListener('click', () => {
      currentTrailId = button.dataset.galleryTrailId;
      currentFilter = 'todas';
      renderTrilhas();
      renderFiltros();
      renderGrid();
      window.setTimeout(() => {
        filtersContainer?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });
      }, 40);
    });
  });
}

allTrailsButton?.addEventListener('click', () => {
  currentTrailId = null;
  currentFilter = 'todas';
  renderTrilhas();
  renderFiltros();
  renderGrid();
});


// ============================================
// RENDERIZA GALERIA
// ============================================

function renderGrid(filter = currentFilter) {

  if (!grid) {
    return;
  }


  const filtro =
    String(filter || 'todas')
      .toLowerCase();

  currentFilter = filtro;
  grid.classList.toggle('gallery-all-selected-grid', currentTrailId === null && filtro === 'todas');


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

        if (!belongsToTrail(ensaio.categoria, ensaio.trailId)) {
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


          currentFilter = button.dataset.filter;
          renderGrid(currentFilter);

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


function indiceCircular(index) {

  const total =
    currentEnsaio?.photos?.length || 0;

  if (!total) return 0;

  return (
    (index % total) + total
  ) % total;

}


function slideHTML(index, position) {

  const photo =
    currentEnsaio.photos[
      indiceCircular(index)
    ];

  if (!photo) return '';

  const realIndex =
    indiceCircular(index);

  const alt =
    photo.alt ||
    `${currentEnsaio.titulo} — foto ${realIndex + 1}`;

  return `
    <button
      class="lightbox-slide lightbox-slide-${position}"
      type="button"
      data-carousel-position="${position}"
      aria-label="${
        position === 'current'
          ? 'Foto atual'
          : position === 'prev'
            ? 'Ver foto anterior'
            : 'Ver próxima foto'
      }"
    >
      ${
        photo.src
          ? `<img src="${esc(photo.src)}" alt="${esc(alt)}" draggable="false">`
          : `<span class="lightbox-placeholder">SUBSTITUA POR SUA FOTO<br>${esc(photo.placeholder || '')}</span>`
      }
    </button>
  `;

}


function showPhoto(direction = 0) {

  if (!currentEnsaio) {
    return;
  }

  const total =
    currentEnsaio.photos.length;

  if (!total) return;

  currentPhoto =
    indiceCircular(currentPhoto);

  if (lightboxStage) {

    lightboxStage.innerHTML = `
      <div
        class="lightbox-carousel ${direction > 0 ? 'is-next' : direction < 0 ? 'is-prev' : ''}"
        role="group"
        aria-label="Visualizador de fotografias"
      >
        ${slideHTML(currentPhoto - 1, 'prev')}
        ${slideHTML(currentPhoto, 'current')}
        ${slideHTML(currentPhoto + 1, 'next')}
      </div>
    `;

    lightboxStage
      .querySelector('[data-carousel-position="prev"]')
      ?.addEventListener('click', prevPhoto);

    lightboxStage
      .querySelector('[data-carousel-position="next"]')
      ?.addEventListener('click', nextPhoto);
  }

  if (lightboxCounter) {

    lightboxCounter.textContent =
      `${currentPhoto + 1} / ${total}`;

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


  showPhoto(1);

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


  showPhoto(-1);

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


// ============================================
// SWIPE NO CELULAR / TABLET
// ============================================

let lightboxTouchStartX = null;
let lightboxTouchStartY = null;

lightboxStage?.addEventListener(
  'touchstart',
  event => {

    const touch = event.touches?.[0];
    if (!touch) return;

    lightboxTouchStartX = touch.clientX;
    lightboxTouchStartY = touch.clientY;

  },
  { passive: true }
);

lightboxStage?.addEventListener(
  'touchend',
  event => {

    if (
      lightboxTouchStartX === null ||
      lightboxTouchStartY === null
    ) {
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const dx =
      touch.clientX - lightboxTouchStartX;

    const dy =
      touch.clientY - lightboxTouchStartY;

    lightboxTouchStartX = null;
    lightboxTouchStartY = null;

    // Ignora movimentos verticais e toques muito curtos.
    if (
      Math.abs(dx) < 42 ||
      Math.abs(dx) <= Math.abs(dy)
    ) {
      return;
    }

    if (dx < 0) {
      nextPhoto();
    } else {
      prevPhoto();
    }

  },
  { passive: true }
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
          trail_id,
          cover_url,
          cover_focus_x,
          cover_focus_y,
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
          trail_id,
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
    // TRILHAS
    // ========================================

    let trailsResult = await supabase
      .from('gallery_trails')
      .select('id,name,slug,description,cover_url,cover_focus_x,cover_focus_y,sort_order,published')
      .eq('published', true)
      .order('sort_order', { ascending: true });

    if (trailsResult.error?.message?.includes('cover_focus_')) {
      trailsResult = await supabase
        .from('gallery_trails')
        .select('id,name,slug,description,cover_url,sort_order,published')
        .eq('published', true)
        .order('sort_order', { ascending: true });
    }

    if (trailsResult.error) throw trailsResult.error;
    TRILHAS_SITE = trailsResult.data || [];

    const portraitTrail = TRILHAS_SITE.find(trail => {
      const identity = normalizeName(`${trail.slug || ''} ${trail.name || ''}`);
      return identity.includes('retrato') && identity.includes('corporativo');
    })?.id;

    const selfEsteemTrail = TRILHAS_SITE.find(trail => {
      const identity = normalizeName(`${trail.slug || ''} ${trail.name || ''}`);
      return identity.includes('autoestima') && (identity.includes('sensual') || identity.includes('boudoir'));
    })?.id;

    CATEGORIAS_SITE = CATEGORIAS_SITE.map(category => {
      const identity = normalizeName(`${category.slug || ''} ${category.name || ''}`);
      if (portraitTrail && PORTRAIT_CATEGORIES.some(value => identity.includes(value))) return { ...category, trail_id: portraitTrail };
      if (selfEsteemTrail && SELF_ESTEEM_CATEGORIES.some(value => identity.includes(value))) return { ...category, trail_id: selfEsteemTrail };
      return category;
    });

    if (portraitTrail && !CATEGORIAS_SITE.some(category => normalizeName(category.slug) === 'corporativo')) {
      CATEGORIAS_SITE.push({
        id: 'virtual-corporativo',
        name: 'Corporativo',
        slug: 'corporativo',
        sort_order: 30,
        trail_id: portraitTrail
      });
    }


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

          const inferredCorporate = !category && /corporativ/i.test(`${gallery.slug || ''} ${gallery.title || ''}`);


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
                category?.slug || (inferredCorporate ? 'corporativo' : null) ||
                'sem-categoria'
              )
                .toLowerCase(),

            categoriaNome:
              category?.name || (inferredCorporate ? 'Corporativo' : null) ||
              'Sem categoria',

            trailId:
              category?.trail_id ||
              (inferredCorporate ? portraitTrail : null) ||
              gallery.trail_id ||
              null,

            coverFocusX:
              gallery.cover_focus_x ?? 50,

            coverFocusY:
              gallery.cover_focus_y ?? 50,

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

    window.TRILHAS_SITE =
      TRILHAS_SITE;


    // ========================================
    // ATUALIZA FILTROS
    // ========================================

    renderTrilhas();
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
