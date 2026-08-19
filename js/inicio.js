// ============================================
// INÍCIO — CMS
// ============================================

console.log('CMS: inicio.js carregado');


// ============================================
// CARREGAR CONTEÚDO DA PÁGINA
// ============================================


function liberarPaginaInicio() {
  document.documentElement.classList.remove(
    'inicio-cms-loading'
  );

  document.documentElement.classList.add(
    'inicio-cms-ready'
  );
}

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

  } finally {

    liberarPaginaInicio();

  }

}



// ============================================
// HERO
// ============================================


let heroSlideshowTimer = null;

function normalizarHeroSlides(hero) {
  const slides =
    Array.isArray(hero?.slides)
      ? hero.slides
          .filter(
            slide =>
              slide &&
              slide.url &&
              slide.published !== false
          )
          .map(
            (slide, index) => ({
              ...slide,
              sort_order:
                Number.isFinite(
                  Number(
                    slide.sort_order
                  )
                )
                  ? Number(
                      slide.sort_order
                    )
                  : index
            })
          )
      : [];

  slides.sort(
    (a, b) =>
      a.sort_order -
      b.sort_order
  );

  if (
    hero?.slide_order ===
    'random'
  ) {
    for (
      let i = slides.length - 1;
      i > 0;
      i -= 1
    ) {
      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );

      [
        slides[i],
        slides[j]
      ] = [
        slides[j],
        slides[i]
      ];
    }
  }

  return slides;
}

function pararHeroSlideshow() {
  if (heroSlideshowTimer) {
    window.clearInterval(
      heroSlideshowTimer
    );

    heroSlideshowTimer =
      null;
  }
}

function ativarHeroSlideshow(hero) {
  const slideshow =
    document.getElementById(
      'hero-slideshow'
    );

  const desktop =
    document.getElementById(
      'hero-desktop-image'
    );

  const picture =
    desktop?.closest('picture');

  const media =
    document.querySelector(
      '.hero-media'
    );

  const heroEl =
    document.querySelector(
      '.hero'
    );

  pararHeroSlideshow();

  if (!slideshow) {
    if (picture) {
      picture.style.display = '';
    }
    return;
  }

  const slides =
    normalizarHeroSlides(
      hero
    );

  const useSlideshow =
    hero?.mode ===
      'slideshow' &&
    slides.length > 0;

  slideshow.dataset.animation =
    hero?.slide_animation ||
    'fade';

  slideshow.dataset.fit =
    hero?.slide_fit ||
    'cover';

  slideshow.style.setProperty(
    '--hero-slide-transition',
    `${Number(
      hero?.slide_transition ||
      1.2
    ) * 1000}ms`
  );

  slideshow.style.setProperty(
    '--hero-slide-interval',
    `${Number(
      hero?.slide_interval ||
      5
    ) * 1000}ms`
  );

  if (media) {
    media.dataset.slideFit =
      hero?.slide_fit ||
      'cover';

    media.dataset.slideWidth =
      hero?.slide_width ||
      'extended';
  }

  if (heroEl) {
    heroEl.dataset.slideRatio =
      hero?.slide_ratio ||
      '16-9';

    heroEl.classList.toggle(
      'hero-not-behind-menu',
      hero?.slide_behind_menu ===
        false
    );
  }

  if (!useSlideshow) {
    slideshow.innerHTML = '';

    slideshow.classList.remove(
      'is-active',
      'is-ready'
    );

    slideshow.setAttribute(
      'aria-hidden',
      'true'
    );

    slideshow.style.display =
      'none';

    if (picture) {
      picture.style.display = '';
    }

    return;
  }

  slideshow.innerHTML =
    slides
      .map(
        (slide, index) => `
          <div
            class="hero-slide ${index === 0 ? 'is-visible' : ''}"
            style="
              background-image:url('${escapeHTML(
                slide.url
              )}');
              background-position:${Number(
                slide.focus_x ?? 50
              )}% ${Number(
                slide.focus_y ?? 50
              )}%;
            "
            aria-hidden="${index === 0 ? 'false' : 'true'}"
          ></div>
        `
      )
      .join('');

  slideshow.style.display =
    '';

  slideshow.classList.add(
    'is-active',
    'is-ready'
  );

  slideshow.setAttribute(
    'aria-hidden',
    'false'
  );

  if (picture) {
    picture.style.display =
      'none';
  }

  const nodes =
    [
      ...slideshow.querySelectorAll(
        '.hero-slide'
      )
    ];

  if (nodes.length < 2) {
    return;
  }

  let current = 0;

  const show =
    index => {
      nodes.forEach(
        (node, i) => {
          node.classList.toggle(
            'is-visible',
            i === index
          );

          node.classList.toggle(
            'is-prev',
            i ===
              (
                index -
                1 +
                nodes.length
              ) %
              nodes.length
          );

          node.setAttribute(
            'aria-hidden',
            i === index
              ? 'false'
              : 'true'
          );
        }
      );
    };

  show(0);

  heroSlideshowTimer =
    window.setInterval(
      () => {
        current =
          (
            current + 1
          ) %
          nodes.length;

        show(
          current
        );
      },
      Math.max(
        2000,
        Number(
          hero?.slide_interval ||
          5
        ) *
        1000
      )
    );
}

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
      String(hero.title || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

    const temQuebraManual =
      texto.includes('\n');


    if (temQuebraManual) {

      const linhas =
        texto.split('\n');

      let ultimaLinhaComTexto =
        linhas.length - 1;

      for (
        let i = linhas.length - 1;
        i >= 0;
        i -= 1
      ) {

        if (linhas[i].trim()) {
          ultimaLinhaComTexto = i;
          break;
        }

      }


      title.innerHTML =
        linhas
          .map(
            (linha, index) => {

              const limpa =
                linha.trim();

              if (
                index !==
                ultimaLinhaComTexto
              ) {

                return escapeHTML(
                  limpa
                );

              }


              const palavras =
                limpa
                  .split(/\s+/)
                  .filter(Boolean);


              if (!palavras.length) {
                return '';
              }


              const ultima =
                palavras.pop();

              const prefixo =
                palavras.length
                  ? `${escapeHTML(
                      palavras.join(' ')
                    )} `
                  : '';


              return (
                `${prefixo}<em>${escapeHTML(
                  ultima
                )}</em>`
              );

            }
          )
          .join('<br>');

    } else {

      const palavras =
        texto
          .split(/\s+/)
          .filter(Boolean);


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
  // IMAGEM DESKTOP
  // ============================================

  const desktopImage =
    document.getElementById(
      'hero-desktop-image'
    );

  if (desktopImage) {

    if (hero.desktop_image) {

      desktopImage.src =
        hero.desktop_image;

    }

    desktopImage.alt =
      hero.image_alt ||
      'Rangel Santos, fotógrafo';

  }


  // ============================================
  // IMAGEM MOBILE
  // ============================================

  const mobileImage =
    document.getElementById(
      'hero-mobile-image'
    );

  if (
    mobileImage &&
    hero.mobile_image
  ) {

    mobileImage.srcset =
      hero.mobile_image;

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



  ativarHeroSlideshow(
    hero
  );

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
    'CMS: buscando fotografias...'
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
      'CMS: erro ao buscar gallery_photos:',
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
      'CMS: nenhuma fotografia publicada encontrada.'
    );

    return;

  }


  console.log(
    'CMS: fotografias encontradas:',
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


  return await supabase

    .from(
      'gallery_photos'
    )

    .select(`
      id,
      image_url,
      alt_text,
      sort_order,
      published,
      gallery_id
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

    .limit(
      limit
    );

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

    liberarPaginaInicio();

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
