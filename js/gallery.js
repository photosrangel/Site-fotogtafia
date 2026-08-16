// ============================================
// GALERIA POR ENSAIO + CMS SUPABASE
// INTEGRAÇÃO HÍBRIDA
// ============================================

const grid = document.getElementById('gallery-grid');
const filterButtons = document.querySelectorAll('.filter-btn');

let currentEnsaio = null;
let currentPhoto = 0;

// Guarda uma cópia das galerias antigas
// carregadas por gallery-data.js.
const ENSAIOS_ANTIGOS = Array.isArray(window.ENSAIOS)
  ? window.ENSAIOS.map(ensaio => ({
      ...ensaio,
      photos: Array.isArray(ensaio.photos)
        ? [...ensaio.photos]
        : []
    }))
  : [];

let ENSAIOS_SITE = [...ENSAIOS_ANTIGOS];

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


// ============================================
// CARREGA GALERIAS DO SUPABASE
// ============================================

async function carregarGaleriasCMS() {

  try {

    const { createClient } =
      await import(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
      );

    const { SUPABASE_URL, SUPABASE_ANON_KEY } =
      await import('./supabase-config.js');

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );


    const [
      galleriesResult,
      categoriesResult,
      photosResult
    ] = await Promise.all([

      supabase
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
        .eq('published', true)
        .order('sort_order', {
          ascending: true
        })
        .order('created_at', {
          ascending: false
        }),

      supabase
        .from('categories')
        .select(`
          id,
          name,
          slug,
          description,
          published,
          sort_order
        `)
        .eq('published', true)
        .order('sort_order', {
          ascending: true
        })
        .order('name', {
          ascending: true
        }),

      supabase
        .from('gallery_photos')
        .select(`
          id,
          gallery_id,
          image_url,
          alt_text,
          sort_order,
          published
        `)
        .eq('published', true)
        .order('sort_order', {
          ascending: true
        })

    ]);


    if (galleriesResult.error) {
      throw galleriesResult.error;
    }

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    if (photosResult.error) {
      throw photosResult.error;
    }


    const galleries =
      galleriesResult.data || [];

    const categories =
      categoriesResult.data || [];

    const photos =
      photosResult.data || [];


    // ----------------------------------------
    // Mapa de categorias
    // ----------------------------------------

    const categoryMap = new Map();

    categories.forEach(category => {

      categoryMap.set(
        category.id,
        category
      );

    });


    // ----------------------------------------
    // Agrupa fotografias por galeria
    // ----------------------------------------

    const photosByGallery = new Map();

    photos.forEach(photo => {

      if (!photosByGallery.has(
        photo.gallery_id
      )) {

        photosByGallery.set(
          photo.gallery_id,
          []
        );

      }

      photosByGallery
        .get(photo.gallery_id)
        .push({
          id: photo.id,
          src: photo.image_url,
          placeholder: '',
          alt: photo.alt_text || '',
          ordem: photo.sort_order || 0
        });

    });


    // ----------------------------------------
    // Converte CMS para estrutura do site
    // ----------------------------------------

    const galeriasCMS = galleries
      .map(gallery => {

        const category =
          categoryMap.get(
            gallery.category_id
          );

        const fotos =
          photosByGallery.get(
            gallery.id
          ) || [];


        fotos.sort(
          (a, b) =>
            a.ordem - b.ordem
        );


        const capa =
          gallery.cover_url ||
          fotos[0]?.src ||
          '';


        return {

          id: `cms-${gallery.id}`,

          cmsId: gallery.id,

          slug: gallery.slug,

          titulo: gallery.title,

          descricao:
            gallery.description || '',

          categoria:
            category?.slug ||
            'sem-categoria',

          categoriaNome:
            category?.name ||
            'Sem categoria',

          cover: capa,

          photos: fotos

        };

      })

      // Não mostra galeria CMS publicada
      // que ainda não possui fotografias.
      .filter(
        gallery =>
          gallery.photos.length > 0
      );


    // ----------------------------------------
    // Evita duplicação
    // ----------------------------------------

    const slugsAntigos =
      new Set(
        ENSAIOS_ANTIGOS
          .map(e => e.slug)
          .filter(Boolean)
      );


    const cmsNovas =
      galeriasCMS.filter(
        gallery =>
          !gallery.slug ||
          !slugsAntigos.has(
            gallery.slug
          )
      );


    // ----------------------------------------
    // Junta conteúdo antigo + CMS
    // ----------------------------------------

    ENSAIOS_SITE = [

      ...ENSAIOS_ANTIGOS,

      ...cmsNovas

    ];


    // Disponível no console
    // para diagnóstico.
    window.ENSAIOS_SITE =
      ENSAIOS_SITE;


    // ----------------------------------------
    // Atualiza filtros
    // ----------------------------------------

    atualizarFiltros(
      categories
    );


    // ----------------------------------------
    // Redesenha a galeria
    // ----------------------------------------

    renderGrid();


    console.log(
      'CMS carregado:',
      galeriasCMS
    );

    console.log(
      'Galerias antigas:',
      ENSAIOS_ANTIGOS
    );

    console.log(
      'Novas galerias CMS:',
      cmsNovas
    );

    console.log(
      'Total de galerias:',
      ENSAIOS_SITE.length
    );


  } catch (error) {

    console.error(
      'CMS indisponível. Mantendo galerias antigas:',
      error
    );


    // Se o CMS falhar,
    // o site antigo continua funcionando.

    ENSAIOS_SITE =
      [...ENSAIOS_ANTIGOS];

    renderGrid();

  }

}


// ============================================
// FILTROS
// ============================================

function atualizarFiltros(
  categoriesCMS
) {

  const container =
    document.querySelector(
      '.filters'
    );

  if (!container) {
    return;
  }


  const filtros =
    new Map();


  // Mantém os filtros que já existem.
  container
    .querySelectorAll(
      '.filter-btn'
    )
    .forEach(button => {

      filtros.set(
        button.dataset.filter,
        button.textContent.trim()
      );

    });


  // Adiciona categorias CMS novas.
  categoriesCMS.forEach(
    category => {

      if (
        !filtros.has(
          category.slug
        )
      ) {

        filtros.set(
          category.slug,
          category.name
        );

      }

    }
  );


  container.innerHTML = '';


  filtros.forEach(
    (label, slug) => {

      const button =
        document.createElement(
          'button'
        );

      button.className =
        'filter-btn' +
        (
          slug === 'todas'
            ? ' active'
            : ''
        );

      button.dataset.filter =
        slug;

      button.textContent =
        label;

      container.appendChild(
        button
      );

    }
  );


  container
    .querySelectorAll(
      '.filter-btn'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          container
            .querySelectorAll(
              '.filter-btn'
            )
            .forEach(
              b =>
                b.classList.remove(
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
// CARD DA GALERIA
// ============================================

function frameHTML(
  ensaio,
  index
) {

  const capa =
    ensaio.cover ||
    ensaio.photos?.[0]?.src;

  const total =
    ensaio.photos.length;


  const imgOrPlaceholder =
    capa

      ? `<img
           src="${esc(capa)}"
           alt="Capa do ensaio: ${esc(ensaio.titulo)}"
           loading="lazy"
         >`

      : `<div class="frame-placeholder">
           SUBSTITUA POR SUA FOTO
         </div>`;


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
// GRADE
// ============================================

function renderGrid(
  filter = 'todas'
) {

  if (!grid) {
    return;
  }


  const visiveis =
    ENSAIOS_SITE

      .map(
        (ensaio, index) => ({
          ensaio,
          index
        })
      )

      .filter(
        ({ ensaio }) => {

          if (
            filter === 'todas'
          ) {
            return true;
          }

          return (
            ensaio.categoria ===
            filter
          );

        }
      );


  if (!visiveis.length) {

    grid.innerHTML = `

      <div
        class="frame-placeholder"
        style="
          grid-column:1/-1;
          padding:60px 20px;
        "
      >
        Nenhum ensaio encontrado.
      </div>

    `;

    return;
  }


  grid.innerHTML =
    visiveis

      .map(
        ({ ensaio, index }) =>
          frameHTML(
            ensaio,
            index
          )
      )

      .join('');


  grid
    .querySelectorAll(
      '.frame'
    )
    .forEach(el => {

      const openThis =
        () =>
          openLightbox(
            Number(
              el.dataset
                .ensaioIndex
            )
          );


      el.addEventListener(
        'click',
        openThis
      );


      el.addEventListener(
        'keydown',
        event => {

          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {

            event.preventDefault();

            openThis();

          }

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
    !currentEnsaio.photos.length
  ) {

    return;

  }


  lightboxTitle.textContent =
    currentEnsaio.titulo;


  showPhoto();


  lightbox.classList.add(
    'is-open'
  );


  document.body.style.overflow =
    'hidden';


  lightbox
    .querySelector(
      '.lightbox-close'
    )
    ?.focus();

}


function closeLightbox() {

  lightbox.classList.remove(
    'is-open'
  );

  document.body.style.overflow =
    '';

}


function showPhoto() {

  const photo =
    currentEnsaio.photos[
      currentPhoto
    ];


  lightboxStage.innerHTML =
    photo.src

      ? `<img
           src="${esc(photo.src)}"
           alt="${esc(
             currentEnsaio.titulo
           )} — foto ${
             currentPhoto + 1
           }"
         >`

      : `<div class="lightbox-placeholder">
           SUBSTITUA POR SUA FOTO
         </div>`;


  lightboxCounter.textContent =
    `${currentPhoto + 1} / ${
      currentEnsaio.photos.length
    }`;

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
      currentPhoto - 1 +
      currentEnsaio.photos.length
    ) %
    currentEnsaio.photos.length;


  showPhoto();

}


// ============================================
// CONTROLES
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


    if (
      event.key === 'Escape'
    ) {

      closeLightbox();

    }


    if (
      event.key === 'ArrowRight'
    ) {

      nextPhoto();

    }


    if (
      event.key === 'ArrowLeft'
    ) {

      prevPhoto();

    }

  }
);


// ============================================
// INICIALIZAÇÃO
// ============================================

// Primeiro mostra imediatamente
// as galerias antigas.
renderGrid();

// Depois acrescenta o CMS.
carregarGaleriasCMS();
