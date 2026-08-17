// ============================================
// INÍCIO — CMS
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from './supabase-config.js';


// ============================================
// CONEXÃO SUPABASE
// ============================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ============================================
// CARREGAR PÁGINA INICIAL
// ============================================

async function carregarPaginaInicio() {

  try {

    console.log('CMS: carregando página inicial...');


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
        'CMS: nenhum conteúdo encontrado para slug "inicio".'
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


    // HERO

    carregarHero(
      sections.hero
    );


    // TRABALHOS RECENTES

    carregarTrabalhosRecentes(
      sections.recent_work
    );


    console.log(
      'CMS: página inicial carregada com sucesso.'
    );


  } catch (error) {

    console.error(
      'CMS: erro inesperado:',
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

    const texto =
      hero.title || '';


    /*
      Mantém a última palavra em itálico.
    */

    const palavras =
      texto.trim().split(/\s+/);


    if (palavras.length > 1) {

      const ultima =
        palavras.pop();


      title.innerHTML =
        `${escapeHTML(
          palavras.join(' ')
        )}<br><em>${escapeHTML(
          ultima
        )}</em>`;

    } else {

      title.textContent =
        texto;

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


  if (desktopImage && hero.desktop_image) {

    desktopImage.src =
      hero.desktop_image;


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


  if (mobileImage && hero.mobile_image) {

    mobileImage.srcset =
      hero.mobile_image;

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


    const items =
      Array.isArray(hero.meta)
        ? hero.meta
        : [];


    items.forEach(item => {

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

  if (!config) {
    console.warn(
      'CMS: seção recent_work não encontrada.'
    );
    return;
  }

  // ============================================
  // TEXTOS
  // ============================================

  const eyebrow =
    document.getElementById('recent-work-eyebrow');

  const title =
    document.getElementById('recent-work-title');

  const button =
    document.getElementById('recent-work-button');

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
      config.button?.url || '/galeria';

    button.textContent =
      config.button?.text ||
      'Galeria completa →';
  }


  // ============================================
  // GRID
  // ============================================

  const grid =
    document.getElementById('recent-work-grid');

  if (!grid) {

    console.warn(
      'CMS: #recent-work-grid não encontrado.'
    );

    return;
  }


  // ============================================
  // QUANTIDADE
  // ============================================

  const limit =
    Number(config.gallery_limit || 6);


  // ============================================
  // BUSCAR FOTOGRAFIAS
  // SEM RELACIONAMENTO COM GALLERIES
  // ============================================

  const {
    data: photos,
    error: photosError
  } = await supabase

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

    .limit(limit);


  if (photosError) {

    console.error(
      'CMS: erro ao buscar gallery_photos:',
      photosError
    );

    return;
  }


  console.log(
    'CMS: fotografias encontradas:',
    photos
  );


  if (!photos || photos.length === 0) {

    console.warn(
      'CMS: nenhuma fotografia publicada encontrada.'
    );

    return;
  }


  // ============================================
  // LIMPAR GRID
  // ============================================

  grid.innerHTML = '';


  // ============================================
  // CRIAR FOTOS
  // ============================================

  photos.forEach(
    (photo, index) => {

      const frame =
        document.createElement('div');

      frame.className =
        'frame';


      // ========================================
      // IMAGEM
      // ========================================

      const img =
        document.createElement('img');

      img.src =
        photo.image_url;

      img.alt =
        photo.title ||
        'Fotografia de retrato feminino';

      img.loading =
        'lazy';

      img.draggable =
        false;


      // ========================================
      // NÚMERO
      // ========================================

      const number =
        document.createElement('span');

      number.className =
        'frame-num';

      number.textContent =
        String(index + 1)
          .padStart(2, '0');


      // ========================================
      // LEGENDA
      // ========================================

      const caption =
        document.createElement('div');

      caption.className =
        'frame-caption';


      const name =
        document.createElement('span');

      name.textContent =
        photo.title || '';


      caption.appendChild(
        name
      );


      // ========================================
      // MONTAR
      // ========================================

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

    carregarPaginaInicio();

  }
);
