// ============================================
// INÍCIO — CMS
// ============================================

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from './supabase-config.js';

const supabase = window.supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

console.log('CMS: Supabase inicializado');
console.log('CMS: inicio.js carregado');


// ============================================
// INÍCIO — CONTEÚDO VINDO DO CMS
// ============================================


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
      console.error('CMS: erro ao buscar site_content:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.warn('CMS: nenhum conteúdo encontrado.');
      return;
    }

    console.log('CMS: conteúdo encontrado:', data);

    const sections = {};

    data.forEach(section => {
      sections[section.section_key] = section.content;
    });

    // Carrega HERO
    carregarHero(sections.hero);

    // Carrega trabalhos recentes
    await carregarTrabalhosRecentes(sections.recent_work);

    console.log('CMS: página inicial carregada com sucesso.');

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
    console.warn('CMS: seção hero não encontrada.');
    return;
  }


  // --------------------------------------------
  // EYEBROW
  // --------------------------------------------

  const eyebrow =
    document.getElementById('hero-eyebrow');

  if (eyebrow) {
    eyebrow.textContent = hero.eyebrow || '';
  }


  // --------------------------------------------
  // TÍTULO
  // --------------------------------------------

  const title =
    document.getElementById('hero-title');

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

      title.textContent = texto;

    }

  }


  // --------------------------------------------
  // DESCRIÇÃO
  // --------------------------------------------

  const description =
    document.getElementById('hero-description');

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

  if (meta && Array.isArray(hero.meta)) {

    meta.innerHTML = '';

    hero.meta.forEach(item => {

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
      'CMS: configuração recent_work não encontrada.'
    );
    return;
  }


  // --------------------------------------------
  // TÍTULO DA SEÇÃO
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

  if (!grid) {

    console.warn(
      'CMS: recent-work-grid não encontrado no HTML.'
    );

    return;

  }


  // --------------------------------------------
  // QUANTIDADE
  // --------------------------------------------

  const limit =
    Number(config.gallery_limit) || 6;


  // --------------------------------------------
  // BUSCAR FOTOGRAFIAS
  // --------------------------------------------

  console.log(
    'CMS: buscando fotografias...'
  );


  /*
    IMPORTANTE:

    Não usamos mais:

    galleries (
      id,
      title,
      slug,
      published
    )

    porque essa relação estava causando
    o erro HTTP 400.

    Primeiro buscamos somente as fotografias.
  */

  const {
    data: photos,
    error: photosError
  } = await supabase

    .from('gallery_photos')

    .select(`
      id,
      image_url,
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

    /*
      MUITO IMPORTANTE:

      Não apagamos o conteúdo existente
      quando a consulta falha.

      Assim a página continua funcionando.
    */

    return;

  }


  if (!photos || photos.length === 0) {

    console.warn(
      'CMS: nenhuma fotografia publicada encontrada.'
    );

    return;

  }


  console.log(
    'CMS: fotografias encontradas:',
    photos
  );


  // --------------------------------------------
  // SÓ AGORA LIMPA O GRID
  // --------------------------------------------

  grid.innerHTML = '';


  // --------------------------------------------
  // CRIAR FOTOGRAFIAS
  // --------------------------------------------

  photos.forEach(
    (photo, index) => {

      const frame =
        document.createElement('div');

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
        document.createElement('img');

      img.src =
        photo.image_url || '';

      img.alt =
        'Fotografia de retrato feminino';

      img.loading =
        index < 3
          ? 'eager'
          : 'lazy';


      // ------------------------------------------
      // NÚMERO
      // ------------------------------------------

      const number =
        document.createElement('span');

      number.className =
        'frame-num';

      number.textContent =
        String(index + 1)
          .padStart(2, '0');


      // ------------------------------------------
      // LEGENDA
      // ------------------------------------------

      const caption =
        document.createElement('div');

      caption.className =
        'frame-caption';


      const name =
        document.createElement('span');

       name.textContent = '';

      caption.appendChild(name);


      // ------------------------------------------
      // MONTAR
      // ------------------------------------------

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
);
