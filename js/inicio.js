```javascript
// ============================================
// INÍCIO — CONTEÚDO VINDO DO CMS
// ============================================
//
// Este arquivo controla a página inicial.
// O conteúdo textual vem de:
// public.site_content
//
// As fotografias vêm de:
// public.gallery_photos
//
// IMPORTANTE:
// O Supabase precisa estar disponível globalmente
// através do seu arquivo de configuração.
//

// ============================================
// CARREGAR CONTEÚDO DA PÁGINA
// ============================================

async function carregarPaginaInicio() {

  console.log('CMS: carregando página inicial...');

  try {

    const { data, error } = await supabase
      .from('site_content')
      .select('section_key, content')
      .eq('slug', 'inicio');

    if (error) {
      console.error(
        'CMS: erro ao buscar site_content:',
        error
      );

      return;
    }

    if (!data || data.length === 0) {

      console.warn(
        'CMS: nenhum conteúdo encontrado para a página inicial.'
      );

      return;
    }

    console.log(
      'CMS: conteúdo encontrado:',
      data
    );

    const sections = {};

    data.forEach(section => {

      sections[section.section_key] =
        section.content;

    });

    // ========================================
    // HERO
    // ========================================

    carregarHero(
      sections.hero
    );

    // ========================================
    // TRABALHOS RECENTES
    // ========================================

    await carregarTrabalhosRecentes(
      sections.recent_work
    );

    console.log(
      'CMS: página inicial carregada com sucesso.'
    );

  } catch (error) {

    console.error(
      'CMS: erro ao carregar página inicial:',
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
      'CMS: conteúdo do Hero não encontrado.'
    );

    return;
  }


  // ========================================
  // EYEBROW
  // ========================================

  const eyebrow =
    document.getElementById(
      'hero-eyebrow'
    );

  if (eyebrow) {

    eyebrow.textContent =
      hero.eyebrow || '';

  }


  // ========================================
  // TÍTULO
  // ========================================

  const title =
    document.getElementById(
      'hero-title'
    );

  if (title) {

    const texto =
      (hero.title || '').trim();

    /*
      Mantém o visual:

      Você, como
      sempre foi.

      A última palavra fica em itálico.
    */

    const palavras =
      texto.split(/\s+/);

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


  // ========================================
  // DESCRIÇÃO
  // ========================================

  const description =
    document.getElementById(
      'hero-description'
    );

  if (description) {

    description.textContent =
      hero.description || '';

  }


  // ========================================
  // IMAGEM DESKTOP
  // ========================================

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


  // ========================================
  // IMAGEM MOBILE
  // ========================================

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


  // ========================================
  // BOTÃO PRINCIPAL
  // ========================================

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


  // ========================================
  // BOTÃO SECUNDÁRIO
  // ========================================

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


  // ========================================
  // META
  // ========================================

  const meta =
    document.getElementById(
      'hero-meta'
    );

  if (meta) {

    meta.innerHTML = '';

    const lista =
      Array.isArray(hero.meta)
        ? hero.meta
        : [];

    lista.forEach(item => {

      const div =
        document.createElement('div');

      const strong =
        document.createElement('strong');

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

    });

  }

}


// ============================================
// TRABALHOS RECENTES
// ============================================

async function carregarTrabalhosRecentes(config) {

  console.log(
    'CMS: carregando trabalhos recentes...'
  );


  if (!config) {

    console.warn(
      'CMS: configuração de trabalhos recentes não encontrada.'
    );

    return;

  }


  // ========================================
  // TÍTULOS
  // ========================================

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


  // ========================================
  // GRID
  // ========================================

  const grid =
    document.getElementById(
      'recent-work-grid'
    );

  if (!grid) {

    console.warn(
      'CMS: elemento #recent-work-grid não encontrado.'
    );

    return;

  }


  grid.innerHTML = '';


  // ========================================
  // QUANTIDADE
  // ========================================

  const limite =
    Number(
      config.gallery_limit || 6
    );


  // ========================================
  // PRIMEIRA CONSULTA
  //
  // Buscamos somente fotografias publicadas.
  //
  // NÃO usamos:
  //
  // .eq('galleries.published', true)
  //
  // porque esse filtro em relacionamento
  // estava provocando o erro HTTP 400.
  // ========================================

  const { data, error } =
    await supabase
      .from('gallery_photos')
      .select(`
        id,
        image_url,
        title,
        order_index,
        published,
        gallery_id
      `)
      .eq(
        'published',
        true
      )
      .order(
        'order_index',
        {
          ascending: true
        }
      )
      .limit(limite);


  if (error) {

    console.error(
      'CMS: erro ao buscar gallery_photos:',
      error
    );

    return;

  }


  if (!data || data.length === 0) {

    console.warn(
      'CMS: nenhuma fotografia publicada encontrada.'
    );

    return;

  }


  console.log(
    'CMS: fotografias encontradas:',
    data
  );


  // ========================================
  // BUSCAR GALERIAS
  //
  // Em vez de depender de JOIN no Supabase,
  // buscamos as galerias separadamente.
  // ========================================

  const galleryIds =
    [
      ...new Set(
        data
          .map(photo => photo.gallery_id)
          .filter(Boolean)
      )
    ];


  let galleriesMap = {};


  if (galleryIds.length > 0) {

    const {
      data: galleries,
      error: galleriesError
    } = await supabase
      .from('galleries')
      .select(`
        id,
        title,
        slug,
        published
      `)
      .in(
        'id',
        galleryIds
      );


    if (galleriesError) {

      console.error(
        'CMS: erro ao buscar galleries:',
        galleriesError
      );

    } else if (galleries) {

      galleries.forEach(gallery => {

        galleriesMap[
          gallery.id
        ] = gallery;

      });

    }

  }


  // ========================================
  // FILTRAR APENAS GALERIAS PUBLICADAS
  // ========================================

  const fotosPublicadas =
    data.filter(photo => {

      const gallery =
        galleriesMap[
          photo.gallery_id
        ];

      /*
        Se a fotografia não possuir galeria,
        não mostramos na página inicial.

        Se possuir galeria, ela precisa estar
        publicada.
      */

      if (!gallery) {
        return false;
      }

      return gallery.published === true;

    });


  // ========================================
  // SE NÃO HOUVER FOTOS
  // ========================================

  if (
    fotosPublicadas.length === 0
  ) {

    console.warn(
      'CMS: nenhuma fotografia pertence a uma galeria publicada.'
    );

    return;

  }


  // ========================================
  // RENDERIZAR FOTOGRAFIAS
  // ========================================

  fotosPublicadas
    .slice(0, limite)
    .forEach(
      (photo, index) => {

        const gallery =
          galleriesMap[
            photo.gallery_id
          ];


        // ------------------------------------
        // FRAME
        // ------------------------------------

        const frame =
          document.createElement(
            'div'
          );

        frame.className =
          'frame';


        frame.dataset.category =
          gallery?.slug || '';


        // ------------------------------------
        // IMAGEM
        // ------------------------------------

        const img =
          document.createElement(
            'img'
          );

        img.src =
          photo.image_url || '';

        img.alt =
          photo.title ||
          gallery?.title ||
          'Fotografia de retrato feminino';


        // Proteção básica contra arrastar
        img.draggable = false;


        // ------------------------------------
        // NÚMERO
        // ------------------------------------

        const number =
          document.createElement(
            'span'
          );

        number.className =
          'frame-num';

        number.textContent =
          String(index + 1)
            .padStart(2, '0');


        // ------------------------------------
        // LEGENDA
        // ------------------------------------

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
          photo.title ||
          gallery?.title ||
          '';


        caption.appendChild(
          name
        );


        // ------------------------------------
        // MONTAR FRAME
        // ------------------------------------

        frame.appendChild(
          img
        );

        frame.appendChild(
          number
        );

        frame.appendChild(
          caption
        );


        // ------------------------------------
        // ADICIONAR AO GRID
        // ------------------------------------

        grid.appendChild(
          frame
        );

      }
    );


  console.log(
    'CMS: trabalhos recentes renderizados:',
    fotosPublicadas.length
  );

}


// ============================================
// ESCAPAR HTML
// ============================================

function escapeHTML(value) {

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

document.addEventListener(
  'DOMContentLoaded',
  () => {

    if (
      typeof supabase ===
      'undefined'
    ) {

      console.error(
        'CMS: Supabase não foi encontrado.'
      );

      return;

    }


    carregarPaginaInicio();

  }
);
```
