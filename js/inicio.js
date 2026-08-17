// ============================================
// INÍCIO — CONTEÚDO VINDO DO CMS
// ============================================


// ============================================
// CARREGAR CONTEÚDO DA PÁGINA
// ============================================

async function carregarPaginaInicio() {

  try {

    const { data, error } = await supabase
      .from('site_content')
      .select('section_key, content')
      .eq('slug', 'inicio');


    if (error) {
      throw error;
    }


    if (!data || data.length === 0) {

      console.warn(
        'Nenhum conteúdo encontrado para a página inicial.'
      );

      return;

    }


    const sections = {};


    data.forEach(section => {

      sections[section.section_key] =
        section.content;

    });


    // Carrega cada parte da página

    carregarHero(sections.hero);

    carregarTrabalhosRecentes(
      sections.recent_work
    );


  } catch (error) {

    console.error(
      'Erro ao carregar página inicial:',
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
      'Conteúdo do Hero não encontrado.'
    );

    return;

  }


  // --------------------------------------------
  // EYEBROW
  // --------------------------------------------

  const eyebrow =
    document.getElementById('hero-eyebrow');


  if (eyebrow) {

    eyebrow.textContent =
      hero.eyebrow || '';

  }



  // --------------------------------------------
  // TÍTULO
  // --------------------------------------------

  const title =
    document.getElementById('hero-title');


  if (title) {

    /*
      Mantemos o efeito visual do título:

      Você, como
      sempre foi.

      A última parte fica em itálico.
    */

    const palavras =
      (hero.title || '').trim().split(/\s+/);


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
        hero.title || '';

    }

  }



  // --------------------------------------------
  // DESCRIÇÃO
  // --------------------------------------------

  const description =
    document.getElementById(
      'hero-description'
    );


  if (description) {

    description.textContent =
      hero.description || '';

  }



  // --------------------------------------------
  // IMAGEM DESKTOP
  // --------------------------------------------

  const desktopImage =
    document.getElementById(
      'hero-desktop-image'
    );


  if (desktopImage) {

    desktopImage.src =
      hero.desktop_image || '';

    desktopImage.alt =
      hero.image_alt ||
      'Rangel Santos, fotógrafo';

  }



  // --------------------------------------------
  // IMAGEM MOBILE
  // --------------------------------------------

  const mobileImage =
    document.getElementById(
      'hero-mobile-image'
    );


  if (mobileImage) {

    mobileImage.srcset =
      hero.mobile_image || '';

  }



  // --------------------------------------------
  // BOTÃO PRINCIPAL
  // --------------------------------------------

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



  // --------------------------------------------
  // BOTÃO SECUNDÁRIO
  // --------------------------------------------

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



  // --------------------------------------------
  // META
  // --------------------------------------------

  const meta =
    document.getElementById(
      'hero-meta'
    );


  if (meta) {

    meta.innerHTML = '';


    (hero.meta || []).forEach(item => {

      const div =
        document.createElement('div');


      const strong =
        document.createElement('strong');


      strong.textContent =
        item.label || '';


      div.appendChild(strong);


      div.appendChild(
        document.createTextNode(
          item.value || ''
        )
      );


      meta.appendChild(div);

    });

  }

}



// ============================================
// TRABALHOS RECENTES
// ============================================

async function carregarTrabalhosRecentes(config) {

  if (!config) {

    console.warn(
      'Configuração de trabalhos recentes não encontrada.'
    );

    return;

  }


  // --------------------------------------------
  // TÍTULOS
  // --------------------------------------------

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



  // --------------------------------------------
  // GRID
  // --------------------------------------------

  const grid =
    document.getElementById(
      'recent-work-grid'
    );


  if (!grid) return;


  grid.innerHTML = '';



  // --------------------------------------------
  // QUANTIDADE
  // --------------------------------------------

  const limit =
    Number(
      config.gallery_limit || 6
    );



  // --------------------------------------------
  // BUSCAR FOTOGRAFIAS
  // --------------------------------------------

  const { data, error } =
    await supabase

      .from('gallery_photos')

      .select(`
        id,
        image_url,
        title,
        order_index,
        published,
        galleries (
          id,
          title,
          slug,
          published
        )
      `)

      .eq(
        'published',
        true
      )

      .eq(
        'galleries.published',
        true
      )

      .order(
        'order_index',
        {
          ascending: true
        }
      )

      .limit(limit);



  if (error) {

    console.error(
      'Erro ao carregar trabalhos recentes:',
      error
    );

    return;

  }



  // --------------------------------------------
  // NENHUMA FOTO
  // --------------------------------------------

  if (!data || data.length === 0) {

    console.warn(
      'Nenhuma fotografia publicada encontrada.'
    );

    return;

  }



  // --------------------------------------------
  // CRIAR FOTOS
  // --------------------------------------------

  data.forEach(
    (photo, index) => {

      const frame =
        document.createElement('div');


      frame.className =
        'frame';


      frame.dataset.category =
        photo.galleries?.slug || '';



      // IMAGEM

      const img =
        document.createElement('img');


      img.src =
        photo.image_url;


      img.alt =
        photo.title ||
        photo.galleries?.title ||
        'Fotografia de retrato feminino';



      // NÚMERO

      const number =
        document.createElement('span');


      number.className =
        'frame-num';


      number.textContent =
        String(index + 1)
          .padStart(2, '0');



      // LEGENDA

      const caption =
        document.createElement('div');


      caption.className =
        'frame-caption';



      const name =
        document.createElement('span');


      name.textContent =
        photo.title ||
        photo.galleries?.title ||
        '';



      caption.appendChild(name);


      // MONTAR FRAME

      frame.appendChild(img);

      frame.appendChild(number);

      frame.appendChild(caption);


      grid.appendChild(frame);

    }

  );

}



// ============================================
// ESCAPAR HTML
// ============================================

function escapeHTML(value) {

  const div =
    document.createElement('div');


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
        'Supabase não foi encontrado.'
      );

      return;

    }


    carregarPaginaInicio();

  }
);
