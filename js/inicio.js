// ============================================
// INÍCIO — CMS
// ============================================

console.log('CMS: inicio.js carregado');


// ============================================
// CARREGAR CONTEÚDO DA PÁGINA
// ============================================

async function carregarPaginaInicio() {

  console.log('CMS: carregando página inicial...');

  try {

    const supabase = window.supabaseClient;

    if (!supabase) {

      console.error(
        'CMS: cliente Supabase não encontrado.'
      );

      return;

    }


    // ============================================
    // BUSCAR CONTEÚDO DO CMS
    // ============================================

    const {
      data,
      error
    } = await supabase

      .from('site_content')

      .select(
        'section_key, content'
      )

      .eq(
        'slug',
        'inicio'
      );


    if (error) {

      console.error(
        'CMS: erro ao buscar site_content:',
        error
      );

      return;

    }


    if (!data || data.length === 0) {

      console.warn(
        'CMS: nenhum conteúdo encontrado.'
      );

      return;

    }


    console.log(
      'CMS: conteúdo encontrado:',
      data
    );


    // ============================================
    // ORGANIZAR SEÇÕES
    // ============================================

    const sections = {};

    data.forEach(
      section => {

        let content =
          section.content;


        // Caso o JSON venha como texto
        if (
          typeof content ===
          'string'
        ) {

          try {

            content =
              JSON.parse(content);

          } catch (e) {

            console.warn(
              'CMS: conteúdo não é JSON válido:',
              section.section_key
            );

          }

        }


        sections[
          section.section_key
        ] = content;

      }
    );


    // ============================================
    // CARREGAR HERO
    // ============================================

    carregarHero(
      sections.hero
    );


    // ============================================
    // CARREGAR TRABALHOS RECENTES
    // ============================================

    await carregarTrabalhosRecentes(
      sections.recent_work
    );


    console.log(
      'CMS: página inicial carregada com sucesso.'
    );


  } catch (error) {

    console.error(
      'CMS: erro inesperado ao carregar página inicial:',
      error
    );

  }

}



// ============================================
// HERO
// ============================================

function carregarHero(hero) {

  if (!hero) {

    console.warn(
      'CMS: seção hero não encontrada.'
    );

    return;

  }


  // ============================================
  // EYEBROW
  // ============================================

  const eyebrow =
    document.getElementById(
      'hero-eyebrow'
    );

  if (eyebrow) {

    eyebrow.textContent =
      hero.eyebrow || '';

  }


  // ============================================
  // TÍTULO
  // ============================================

  const title =
    document.getElementById(
      'hero-title'
    );

  const fallback =
    document.getElementById(
      'hero-fallback'
    );

  if (fallback && hero.title) {
    fallback.style.display = 'none';
  }

  if (title) {

    const texto =
      hero.title || '';

    const palavras =
      texto.trim().split(/\s+/);


    if (palavras.length >= 2) {

      const ultima =
        palavras.pop();


      title.innerHTML =
        `${escapeHTML(
          palavras.join(' ')
        )} <br><em>${escapeHTML(
          ultima
        )}</em>`;

    } else {

      title.textContent =
        texto;

    }

  }


  // ============================================
  // DESCRIÇÃO
  // ============================================

  const description =
    document.getElementById(
      'hero-description'
    );

  if (description) {

    description.textContent =
      hero.description || '';

  }


  // ============================================
  // IMAGEM ESTÁTICA + SLIDESHOW
  // ============================================

  const desktopImage =
    document.getElementById('hero-desktop-image');

  const mobileImage =
    document.getElementById('hero-mobile-image');

  const slideshow =
    document.getElementById('hero-slideshow');

  const fallbackImage =
    hero.desktop_image || '';

  const fallbackMobile =
    hero.mobile_image || '';

  const staticX =
    Number(hero.static_focus_x ?? 50);

  const staticY =
    Number(hero.static_focus_y ?? 50);

  if (desktopImage && fallbackImage) {
    desktopImage.src = fallbackImage;
    desktopImage.alt =
      hero.image_alt ||
      'Rangel Santos, fotógrafo';
    desktopImage.style.objectPosition =
      `${staticX}% ${staticY}%`;
  }

  if (mobileImage) {
    mobileImage.srcset =
      fallbackMobile || fallbackImage || '';
  }

  // A foto estática permanece por baixo do slideshow.
  // Se o slide estiver vazio, falhar ou demorar, o hero não fica sem imagem.
  const slides =
    Array.isArray(hero.slides)
      ? hero.slides
          .filter(s => s && s.url && s.published !== false)
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      : [];

  const useSlideshow =
    hero.mode === 'slideshow' &&
    slides.length > 0 &&
    slideshow;

  if (slideshow) {
    slideshow.innerHTML = '';
    slideshow.classList.toggle(
      'is-active',
      Boolean(useSlideshow)
    );
  }

  if (useSlideshow) {
    const interval =
      Math.max(2000, (Number(hero.slide_interval) || 5) * 1000);

    const transition =
      Math.max(300, (Number(hero.slide_transition) || 1.2) * 1000);

    slideshow.style.setProperty(
      '--hero-slide-transition',
      `${transition}ms`
    );

    const nodes = slides.map((slide, index) => {
      const img = document.createElement('img');
      img.className =
        'hero-slide' + (index === 0 ? ' is-visible' : '');
      img.src = slide.url;
      img.alt = slide.alt || hero.image_alt || '';
      img.decoding = 'async';
      img.loading = index < 2 ? 'eager' : 'lazy';
      img.style.objectPosition =
        `${Number(slide.focus_x ?? 50)}% ${Number(slide.focus_y ?? 50)}%`;
      slideshow.appendChild(img);
      return img;
    });

    const first = nodes[0];
    const markReady = () => {
      slideshow.classList.add('is-ready');
    };

    if (first.complete && first.naturalWidth) {
      markReady();
    } else {
      first.addEventListener('load', markReady, { once: true });
      first.addEventListener('error', () => {
        slideshow.classList.remove('is-ready');
      }, { once: true });
    }

    if (nodes.length > 1) {
      let current = 0;
      window.clearInterval(window.__heroSlideTimer);
      window.__heroSlideTimer = window.setInterval(() => {
        const next = (current + 1) % nodes.length;
        nodes[next].classList.add('is-visible');
        nodes[current].classList.remove('is-visible');
        current = next;
      }, interval);
    }
  }


  // ============================================
  // BOTÃO PRINCIPAL
  // ============================================

  const primaryButton =
    document.getElementById(
      'hero-primary-button'
    );

  if (primaryButton) {

    primaryButton.href =
      hero.primary_button?.url ||
      '/galeria';

    primaryButton.textContent =
      hero.primary_button?.text ||
      'Ver galeria';

  }


  // ============================================
  // BOTÃO SECUNDÁRIO
  // ============================================

  const secondaryButton =
    document.getElementById(
      'hero-secondary-button'
    );

  if (secondaryButton) {

    secondaryButton.href =
      hero.secondary_button?.url ||
      '/contato';

    secondaryButton.textContent =
      hero.secondary_button?.text ||
      'Agendar sessão';

  }


  // ============================================
  // META
  // ============================================

  const meta =
    document.getElementById(
      'hero-meta'
    );

  if (meta) {

    meta.innerHTML = '';


    if (
      Array.isArray(hero.meta)
    ) {

      hero.meta.forEach(
        item => {

          const div =
            document.createElement(
              'div'
            );


          const strong =
            document.createElement(
              'strong'
            );


          strong.textContent =
            item.label || '';


          div.appendChild(
            strong
          );


          div.appendChild(
            document.createTextNode(
              item.value || ''
            )
          );


          meta.appendChild(
            div
          );

        }
      );

    }

  }

}



// ============================================
// TRABALHOS RECENTES
// ============================================

async function carregarTrabalhosRecentes(
  config
) {

  if (!config) {

    console.warn(
      'CMS: configuração recent_work não encontrada.'
    );

    return;

  }


  // ============================================
  // TÍTULO DA SEÇÃO
  // ============================================

  const eyebrow =
    document.getElementById(
      'recent-work-eyebrow'
    );

  const title =
    document.getElementById(
      'recent-work-title'
    );

  const button =
    document.getElementById(
      'recent-work-button'
    );


  if (eyebrow) {

    eyebrow.textContent =
      config.eyebrow || '';

  }


  if (title) {

    title.textContent =
      config.title || '';

  }


  if (button) {

    button.href =
      config.button?.url ||
      '/galeria';

    button.textContent =
      config.button?.text ||
      'Galeria completa →';

  }


  // ============================================
  // GRID
  // ============================================

  const grid =
    document.getElementById(
      'recent-work-grid'
    );


  if (!grid) {

    console.warn(
      'CMS: recent-work-grid não encontrado no HTML.'
    );

    return;

  }


  // ============================================
  // QUANTIDADE
  // ============================================

  const limit =
    Number(
      config.gallery_limit
    ) || 6;


  // ============================================
  // BUSCAR FOTOGRAFIAS
  // ============================================

  console.log(
    'CMS: buscando capas das galerias publicadas...'
  );


  const {
    data: photos,
    error: photosError
  } = await supabaseBuscarFotos(
    limit
  );


  // ============================================
  // ERRO
  // ============================================

  if (photosError) {

    console.error(
      'CMS: erro ao buscar capas das galerias:',
      photosError
    );

    return;

  }


  // ============================================
  // NENHUMA FOTO
  // ============================================

  if (
    !photos ||
    photos.length === 0
  ) {

    console.warn(
      'CMS: nenhuma galeria pública com capa encontrada.'
    );

    return;

  }


  console.log(
    'CMS: capas de galerias encontradas:',
    photos
  );


  // ============================================
  // LIMPAR GRID
  // ============================================

  grid.innerHTML = '';


  // ============================================
  // CRIAR FOTOGRAFIAS
  // ============================================

  photos.forEach(
    (photo, index) => {

      // ------------------------------------------
      // FRAME
      // ------------------------------------------

      const frame =
        document.createElement(
          'div'
        );

      frame.className =
        'frame';


      // ------------------------------------------
      // CATEGORIA
      // ------------------------------------------

      frame.dataset.category =
        photo.gallery_id || '';


      // ------------------------------------------
      // IMAGEM
      // ------------------------------------------

      const img =
        document.createElement(
          'img'
        );


      img.src =
        photo.image_url || '';


      img.alt =
        photo.alt_text ||
        'Fotografia de retrato feminino';


      img.loading =
        index < 3
          ? 'eager'
          : 'lazy';


      // ------------------------------------------
      // NÚMERO
      // ------------------------------------------

      const number =
        document.createElement(
          'span'
        );


      number.className =
        'frame-num';


      number.textContent =
        String(
          index + 1
        ).padStart(
          2,
          '0'
        );


      // ------------------------------------------
      // LEGENDA
      // ------------------------------------------

      const caption =
        document.createElement(
          'div'
        );


      caption.className =
        'frame-caption';


      const name =
        document.createElement(
          'span'
        );


      name.textContent =
        photo.alt_text || '';


      caption.appendChild(
        name
      );


      // ------------------------------------------
      // MONTAR
      // ------------------------------------------

      frame.appendChild(
        img
      );


      frame.appendChild(
        number
      );


      frame.appendChild(
        caption
      );


      grid.appendChild(
        frame
      );

    }
  );

}



// ============================================
// BUSCAR FOTOGRAFIAS NO SUPABASE
// ============================================

async function supabaseBuscarFotos(
  limit
) {

  const supabase =
    window.supabaseClient;


  if (!supabase) {

    return {
      data: null,
      error: new Error(
        'Cliente Supabase não encontrado.'
      )
    };

  }


  /*
    TRABALHOS RECENTES = CAPAS DAS GALERIAS

    Regra:
    - somente galerias PUBLICADAS;
    - uma única imagem por galeria;
    - usa cover_url da própria galeria;
    - galerias mais novas aparecem primeiro;
    - se uma galeria publicada não tiver cover_url,
      tenta usar a primeira fotografia publicada dela.

    Dessa forma, adicionar/publicar uma nova galeria já faz
    a capa dela entrar automaticamente em Trabalhos recentes
    no próximo carregamento da página.
  */

  const {
    data: galleries,
    error: galleriesError
  } = await supabase
    .from('galleries')
    .select(`
      id,
      title,
      slug,
      cover_url,
      sort_order,
      created_at,
      published
    `)
    .eq('published', true)
    .order('created_at', {
      ascending: false
    })
    .order('sort_order', {
      ascending: true
    });


  if (galleriesError) {
    return {
      data: null,
      error: galleriesError
    };
  }


  const publicGalleries =
    galleries || [];


  if (!publicGalleries.length) {
    return {
      data: [],
      error: null
    };
  }


  // Busca fotos apenas para servir de fallback em galerias
  // publicadas que ainda não tenham cover_url definida.
  const galleryIds =
    publicGalleries
      .map(g => g.id)
      .filter(Boolean);


  const {
    data: fallbackPhotos,
    error: fallbackError
  } = await supabase
    .from('gallery_photos')
    .select(`
      id,
      gallery_id,
      image_url,
      alt_text,
      sort_order,
      created_at,
      published
    `)
    .in('gallery_id', galleryIds)
    .eq('published', true)
    .order('sort_order', {
      ascending: true
    })
    .order('created_at', {
      ascending: true
    });


  if (fallbackError) {
    console.warn(
      'CMS: não foi possível carregar fotos de fallback das galerias:',
      fallbackError
    );
  }


  const primeiraFotoPorGaleria =
    new Map();


  (fallbackPhotos || []).forEach(photo => {

    if (
      photo.gallery_id &&
      !primeiraFotoPorGaleria.has(
        photo.gallery_id
      )
    ) {
      primeiraFotoPorGaleria.set(
        photo.gallery_id,
        photo
      );
    }

  });


  const covers =
    publicGalleries
      .map(gallery => {

        const fallback =
          primeiraFotoPorGaleria.get(
            gallery.id
          );

        const imageUrl =
          gallery.cover_url ||
          fallback?.image_url ||
          '';


        if (!imageUrl) {
          return null;
        }


        return {
          id:
            gallery.id,

          image_url:
            imageUrl,

          alt_text:
            gallery.title ||
            fallback?.alt_text ||
            'Galeria de Rangel Santos Fotografia',

          gallery_id:
            gallery.id,

          gallery_slug:
            gallery.slug || '',

          created_at:
            gallery.created_at,

          sort_order:
            gallery.sort_order ?? 0
        };

      })
      .filter(Boolean)
      .slice(
        0,
        Math.max(
          1,
          Number(limit) || 6
        )
      );


  return {
    data: covers,
    error: null
  };

}



// ============================================
// ESCAPAR HTML
// ============================================

function escapeHTML(
  value
) {

  const div =
    document.createElement(
      'div'
    );


  div.textContent =
    value || '';


  return div.innerHTML;

}



// ============================================
// INICIALIZAÇÃO
// ============================================

function iniciarCMS() {

  console.log(
    'CMS: DOM carregado.'
  );


  if (
    typeof window.supabaseClient ===
    'undefined'
  ) {

    console.error(
      'CMS: Supabase ainda não foi inicializado.'
    );

    return;

  }


  console.log(
    'CMS: cliente Supabase encontrado.'
  );


  carregarPaginaInicio();

}



// ============================================
// AGUARDAR DOM
// ============================================

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarCMS
  );

} else {

  iniciarCMS();

}
