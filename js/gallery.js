// ============================================
// CÓPIA LIMPA E SEGURA DOS DADOS
// ============================================

const ENSAIOS_ANTIGOS = (
  typeof ENSAIOS !== 'undefined' &&
  Array.isArray(ENSAIOS)
)
  ? ENSAIOS.map(ensaio => ({
      ...ensaio,
      photos: Array.isArray(ensaio.photos)
        ? [...ensaio.photos]
        : []
    }))
  : [];

// Restauramos a lista pura sem filtros destrutivos no topo
let ENSAIOS_SITE = [...ENSAIOS_ANTIGOS];
  return Array.isArray(ensaio.photos) && ensaio.photos.length > 0;
});

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
// SEGURANÇA PARA TEXTOS
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
        ensaio.categoria || ''
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
// RENDERIZA GALERIA (CORRIGIDA)
// ============================================

function renderGrid(filter = 'todas') {

  if (!grid) {
    return;
  }

  const visiveis =
    ENSAIOS_SITE
      .map((ensaio, index) => ({
        ensaio,
        index
      }))
      .filter(({ ensaio }) => {

        // Se marcámos o ensaio como oculto, ele não entra na lista
        if (ensaio && ensaio.oculto === true) {
          return false;
        }

        if (filter === 'todas') {
          return true;
        }

        return (
          ensaio.categoria === filter
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
        () => {
          const idx = Number(frame.dataset.ensaioIndex);
          if (!isNaN(idx) && ENSAIOS_SITE[idx]) {
            openLightbox(idx);
          }
        };

      frame.addEventListener('click', abrir);

      frame.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrir();
        }
      });

    });

}
// ============================================
// FILTROS EXISTENTES
// ============================================

function configurarFiltros() {

  document
    .querySelectorAll('.filter-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.filter-btn'
            )
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

// ============================================
// LIGHTBOX (CORRIGIDA COM PROTEÇÃO CONTRA TRAVAMENTOS)
// ============================================

function openLightbox(
  ensaioIndex
) {

  // Se o índice não existir ou for inválido, interrompe imediatamente antes de travar
  if (ensaioIndex === undefined || ensaioIndex === null || !ENSAIOS_SITE[ensaioIndex]) {
    return;
  }

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
// ============================================
// EVENTOS DO LIGHTBOX
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
// INICIALIZAÇÃO
// ============================================

// Primeiro configura o sistema antigo.
configurarFiltros();

// Primeiro mostra as galerias antigas.
renderGrid();


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


    if (!galleries.length) {

      return;

    }


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
        );


    if (categoriesResult.error) {

      throw categoriesResult.error;

    }


    const categories =
      categoriesResult.data || [];


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


    // ----------------------------------------
    // Categorias
    // ----------------------------------------

    const categoryMap =
      new Map();


    categories.forEach(
      category => {

        categoryMap.set(
          category.id,
          category
        );

      }
    );


    // ----------------------------------------
    // Fotos por galeria
    // ----------------------------------------

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

            id: photo.id,

            src:
              photo.image_url,

            placeholder: '',

            alt:
              photo.alt_text || '',

            ordem:
              photo.sort_order || 0

          });

      }
    );


    // ----------------------------------------
    // Converte para formato do site
    // ----------------------------------------

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
              category?.slug ||
              'sem-categoria',

            categoriaNome:
              category?.name ||
              'Sem categoria',

            lente: '',

            cover:
              gallery.cover_url ||
              fotos[0]?.src ||
              null,

            photos:
              fotos

          };

        })

        // Só adicionamos galerias
        // que realmente possuem fotos.
        .filter(
          gallery =>
            gallery.photos.length > 0
        );


    // ----------------------------------------
    // Evita duplicar uma galeria antiga
    // ----------------------------------------

    const slugsExistentes =
      new Set(
        ENSAIOS_SITE
          .map(
            ensaio =>
              ensaio.slug ||
              ensaio.id
          )
      );


    const novas =
      novasGalerias.filter(
        gallery => {

          const chave =
            gallery.slug ||
            gallery.id;


          return !slugsExistentes.has(
            chave
          );

        }
      );


    // ----------------------------------------
    // Acrescenta CMS
    // ----------------------------------------

    ENSAIOS_SITE =
      [
        ...ENSAIOS_SITE,
        ...novas
      ];


    // ----------------------------------------
    // Disponível no console
    // ----------------------------------------

    window.ENSAIOS_SITE =
      ENSAIOS_SITE;


    // ----------------------------------------
    // Redesenha
    // ----------------------------------------

    renderGrid();


    console.log(
      'Galerias antigas:',
      ENSAIOS_ANTIGOS
    );


    console.log(
      'Galerias CMS:',
      novas
    );


    console.log(
      'Total:',
      ENSAIOS_SITE.length
    );


  } catch (error) {

    // O CMS nunca deve impedir
    // o funcionamento da galeria antiga.

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
// CARREGA CMS DEPOIS DO SITE ANTIGO
// ============================================

carregarGaleriasCMS();
