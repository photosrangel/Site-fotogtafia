// ============================================================
// ADMIN V2 — RANGEL SANTOS FOTOGRAFIA
// CMS + ÁREA DE CLIENTES
// VERSÃO COMPATÍVEL COM admin-v2.html
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from './supabase-config.js';


// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log('ADMIN V2: Supabase inicializado');


// ============================================================
// ESTADO
// ============================================================

let currentGalleryId = null;
let currentGallery = null;
let currentClientId = null;


// ============================================================
// UTILITÁRIOS
// ============================================================

function $(id) {
  return document.getElementById(id);
}


function escaparHTML(valor) {

  const div = document.createElement('div');

  div.textContent = valor ?? '';

  return div.innerHTML;
}


function mostrarMensagem(elemento, texto, tipo = '') {

  if (!elemento) return;

  elemento.textContent = texto;

  elemento.className = tipo
    ? `msg ${tipo}`
    : 'msg';
}


function flash(texto, tipo = 'sucesso') {

  const elemento = $('flash');

  if (!elemento) return;

  elemento.textContent = texto;

  elemento.className = `flash ${tipo}`;

  elemento.hidden = false;

  setTimeout(() => {

    elemento.hidden = true;

  }, 3500);
}


function slugify(valor) {

  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}


function gerarLogin() {

  return (
    'cliente-' +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );
}


function gerarSenha() {

  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}


function nomeArquivoSeguro(nome) {

  return String(nome || 'foto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}


// ============================================================
// LOGIN
// ============================================================

async function fazerLogin(event) {

  event.preventDefault();

  const msg = $('login-msg');

  const email =
    $('login-email')?.value.trim();

  const senha =
    $('login-password')?.value;

  if (!email || !senha) {

    mostrarMensagem(
      msg,
      'Preencha o e-mail e a senha.',
      'erro'
    );

    return;
  }

  mostrarMensagem(
    msg,
    'Entrando...'
  );

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

  if (error) {

    console.error(
      'ADMIN V2: erro login:',
      error
    );

    mostrarMensagem(
      msg,
      'E-mail ou senha incorretos.',
      'erro'
    );

    return;
  }

  await mostrarPainel();
}


async function verificarSessao() {

  const {
    data,
    error
  } = await supabase.auth.getSession();

  if (error) {

    console.error(
      'ADMIN V2: erro sessão:',
      error
    );

    return;
  }

  if (data?.session) {

    await mostrarPainel();

  } else {

    mostrarLogin();
  }
}


function mostrarLogin() {

  const login = $('login-screen');
  const app = $('app');

  if (login) {

    login.hidden = false;
    login.style.display = '';
  }

  if (app) {

    app.hidden = true;
  }
}


async function mostrarPainel() {

  const login = $('login-screen');
  const app = $('app');

  if (login) {

    login.hidden = true;
    login.style.display = 'none';
  }

  if (app) {

    app.hidden = false;
    app.style.display = '';
  }

  const {
    data
  } = await supabase.auth.getUser();

  if (data?.user && $('user-email')) {

    $('user-email').textContent =
      data.user.email || '';
  }

  await carregarDashboard();
  await carregarCategorias();
  await carregarGalerias();
  await carregarClientes();

  mostrarView('dashboard');
}


async function fazerLogout() {

  await supabase.auth.signOut();

  window.location.reload();
}


// ============================================================
// NAVEGAÇÃO
// ============================================================

const titulosViews = {

  dashboard: 'Dashboard',

  galleries: 'Galerias',

  clients: 'Clientes / Ensaios',

  categories: 'Categorias',

  settings: 'Configurações'

};


function mostrarView(view) {

  document
    .querySelectorAll('.admin-view')
    .forEach(secao => {

      secao.hidden =
        secao.id !== `view-${view}`;

    });


  document
    .querySelectorAll('.sidebar-link[data-view]')
    .forEach(botao => {

      botao.classList.toggle(
        'active',
        botao.dataset.view === view
      );

    });


  const titulo =
    $('view-title');

  const eyebrow =
    $('view-eyebrow');


  if (titulo) {

    titulo.textContent =
      titulosViews[view] || 'Painel';
  }

  if (eyebrow) {

    eyebrow.textContent =
      view === 'dashboard'
        ? 'Painel'
        : 'Administração';
  }
}


// ============================================================
// DASHBOARD
// ============================================================

async function carregarDashboard() {

  try {

    const [
      galerias,
      publicadas,
      ensaios,
      fotos
    ] = await Promise.all([

      supabase
        .from('galleries')
        .select('id', {
          count: 'exact',
          head: true
        }),

      supabase
        .from('galleries')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('published', true),

      supabase
        .from('ensaios')
        .select('id', {
          count: 'exact',
          head: true
        }),

      supabase
        .from('gallery_photos')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('published', true)

    ]);


    if (galerias.error)
      throw galerias.error;

    if (publicadas.error)
      throw publicadas.error;

    if (ensaios.error)
      throw ensaios.error;

    if (fotos.error)
      throw fotos.error;


    if ($('stat-galleries'))
      $('stat-galleries').textContent =
        galerias.count ?? 0;

    if ($('stat-published'))
      $('stat-published').textContent =
        publicadas.count ?? 0;

    if ($('stat-clients'))
      $('stat-clients').textContent =
        ensaios.count ?? 0;

    if ($('stat-photos'))
      $('stat-photos').textContent =
        fotos.count ?? 0;


  } catch (error) {

    console.error(
      'ADMIN V2: erro dashboard:',
      error
    );

    flash(
      'Não foi possível carregar o Dashboard.',
      'erro'
    );
  }
}


// ============================================================
// CATEGORIAS
// ============================================================

async function carregarCategorias() {

  const lista =
    $('categories-list');

  const selectGallery =
    $('gallery-category');

  const selectClient =
    $('client-category');


  const {
    data,
    error
  } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      published,
      sort_order
    `)
    .order(
      'sort_order',
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      'ADMIN V2: erro categorias:',
      error
    );

    if (lista) {

      lista.innerHTML = `
        <p class="msg erro">
          ${escaparHTML(error.message)}
        </p>
      `;
    }

    return;
  }


  if (selectGallery) {

    selectGallery.innerHTML = `
      <option value="">
        Sem categoria
      </option>
    `;

    (data || []).forEach(categoria => {

      const option =
        document.createElement('option');

      option.value =
        categoria.id;

      option.textContent =
        categoria.name;

      selectGallery.appendChild(
        option
      );
    });
  }


  if (lista) {

    if (!data?.length) {

      lista.innerHTML = `
        <div class="empty-state">
          <p>Nenhuma categoria cadastrada.</p>
        </div>
      `;

    } else {

      lista.innerHTML =
        data.map(categoria => `

          <div class="client-card">

            <div class="client-card-head">

              <div class="client-card-info">

                <strong>
                  ${escaparHTML(
                    categoria.name
                  )}
                </strong>

                <p class="footer-mono">
                  ${escaparHTML(
                    categoria.slug
                  )}
                </p>

              </div>

              <div>

                <button
                  class="small-btn"
                  data-edit-category="${categoria.id}"
                >
                  Editar
                </button>

                <button
                  class="small-btn danger-btn"
                  data-delete-category="${categoria.id}"
                >
                  Excluir
                </button>

              </div>

            </div>

          </div>

        `).join('');
    }
  }


  document
    .querySelectorAll('[data-edit-category]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          const categoria =
            data.find(
              item =>
                item.id ===
                btn.dataset.editCategory
            );

          if (!categoria) return;

          $('category-id').value =
            categoria.id;

          $('category-name').value =
            categoria.name;

          $('category-slug').value =
            categoria.slug;

          $('category-description').value =
            categoria.description || '';

          $('category-order').value =
            categoria.sort_order ?? 0;

          $('cancel-category').hidden =
            false;

          $('category-name').focus();
        }
      );
    });


  document
    .querySelectorAll('[data-delete-category]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          excluirCategoria(
            btn.dataset.deleteCategory
          )
      );
    });
}


async function salvarCategoria(event) {

  event.preventDefault();

  const id =
    $('category-id')?.value;

  const nome =
    $('category-name')?.value.trim();

  const slug =
    slugify(
      $('category-slug')?.value
    );

  const descricao =
    $('category-description')?.value.trim();

  const ordem =
    Number(
      $('category-order')?.value || 0
    );


  if (!nome || !slug) {

    mostrarMensagem(
      $('category-msg'),
      'Preencha nome e slug.',
      'erro'
    );

    return;
  }


  mostrarMensagem(
    $('category-msg'),
    'Salvando...'
  );


  const payload = {

    name: nome,

    slug,

    description:
      descricao || null,

    sort_order:
      ordem
  };


  let result;


  if (id) {

    result =
      await supabase
        .from('categories')
        .update(payload)
        .eq('id', id);

  } else {

    result =
      await supabase
        .from('categories')
        .insert(payload);
  }


  if (result.error) {

    console.error(
      'ADMIN V2: erro categoria:',
      result.error
    );

    mostrarMensagem(
      $('category-msg'),
      result.error.message,
      'erro'
    );

    return;
  }


  mostrarMensagem(
    $('category-msg'),
    'Categoria salva.',
    'sucesso'
  );


  limparFormularioCategoria();

  await carregarCategorias();

  await carregarGalerias();
}


function limparFormularioCategoria() {

  if ($('category-form'))
    $('category-form').reset();

  if ($('category-id'))
    $('category-id').value = '';

  if ($('category-order'))
    $('category-order').value = 0;

  if ($('cancel-category'))
    $('cancel-category').hidden = true;
}


async function excluirCategoria(id) {

  if (
    !window.confirm(
      'Excluir esta categoria?'
    )
  ) return;


  const {
    error
  } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);


  if (error) {

    console.error(
      'ADMIN V2: erro excluir categoria:',
      error
    );

    flash(
      'Não foi possível excluir a categoria.',
      'erro'
    );

    return;
  }


  flash(
    'Categoria excluída.'
  );

  await carregarCategorias();
}


// ============================================================
// GALERIAS
// ============================================================

async function carregarGalerias() {

  const lista =
    $('galleries-list');

  if (!lista) return;


  lista.innerHTML = `
    <p class="msg">
      Carregando galerias...
    </p>
  `;


  const {
    data,
    error
  } = await supabase
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


  if (error) {

    console.error(
      'ADMIN V2: erro galerias:',
      error
    );

    lista.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }


  if (!data?.length) {

    lista.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma galeria cadastrada.</p>
      </div>
    `;

    return;
  }


  lista.innerHTML =
    data.map(galeria => `

      <div class="client-card">

        <div class="client-card-head">

          <div class="client-card-info">

            <strong>
              ${escaparHTML(
                galeria.title
              )}
            </strong>

            <p class="footer-mono">
              ${escaparHTML(
                galeria.slug
              )}
            </p>

          </div>

          <div>

            <span class="client-status ${
              galeria.published
                ? 'entregue'
                : ''
            }">

              ${
                galeria.published
                  ? 'Publicada'
                  : 'Rascunho'
              }

            </span>

            <button
              class="small-btn"
              data-edit-gallery="${galeria.id}"
            >
              Editar
            </button>

            <button
              class="small-btn"
              data-gallery-photos="${galeria.id}"
            >
              Fotos
            </button>

            <button
              class="small-btn danger-btn"
              data-delete-gallery="${galeria.id}"
            >
              Excluir
            </button>

          </div>

        </div>

      </div>

    `).join('');


  document
    .querySelectorAll('[data-edit-gallery]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          const galeria =
            data.find(
              item =>
                item.id ===
                btn.dataset.editGallery
            );

          if (galeria)
            abrirFormularioGaleria(
              galeria
            );
        }
      );
    });


  document
    .querySelectorAll('[data-gallery-photos]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          const galeria =
            data.find(
              item =>
                item.id ===
                btn.dataset.galleryPhotos
            );

          if (galeria)
            abrirEditorFotos(
              galeria
            );
        }
      );
    });


  document
    .querySelectorAll('[data-delete-gallery]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          excluirGaleria(
            btn.dataset.deleteGallery
          )
      );
    });
}


function abrirFormularioGaleria(galeria = null) {

  $('gallery-form-wrap').hidden = false;

  $('gallery-form-title').textContent =
    galeria
      ? 'Editar galeria'
      : 'Nova galeria';


  $('gallery-id').value =
    galeria?.id || '';

  $('gallery-title').value =
    galeria?.title || '';

  $('gallery-slug').value =
    galeria?.slug || '';

  $('gallery-description').value =
    galeria?.description || '';

  $('gallery-category').value =
    galeria?.category_id || '';

  $('gallery-cover').value =
    galeria?.cover_url || '';

  $('gallery-order').value =
    galeria?.sort_order ?? 0;
}


function fecharFormularioGaleria() {

  if ($('gallery-form-wrap'))
    $('gallery-form-wrap').hidden = true;

  if ($('gallery-form'))
    $('gallery-form').reset();

  if ($('gallery-id'))
    $('gallery-id').value = '';
}


async function salvarGaleria(event) {

  event.preventDefault();


  const id =
    $('gallery-id')?.value;

  const titulo =
    $('gallery-title')?.value.trim();

  const slug =
    slugify(
      $('gallery-slug')?.value
    );

  const descricao =
    $('gallery-description')?.value.trim();

  const categoria =
    $('gallery-category')?.value || null;

  const capa =
    $('gallery-cover')?.value.trim() || null;

  const ordem =
    Number(
      $('gallery-order')?.value || 0
    );


  if (!titulo || !slug) {

    mostrarMensagem(
      $('gallery-form-msg'),
      'Preencha título e slug.',
      'erro'
    );

    return;
  }


  mostrarMensagem(
    $('gallery-form-msg'),
    'Salvando...'
  );


  const payload = {

    title: titulo,

    slug,

    description:
      descricao || null,

    category_id:
      categoria,

    cover_url:
      capa,

    sort_order:
      ordem
  };


  let result;


  if (id) {

    result =
      await supabase
        .from('galleries')
        .update(payload)
        .eq('id', id);

  } else {

    result =
      await supabase
        .from('galleries')
        .insert(payload);
  }


  if (result.error) {

    console.error(
      'ADMIN V2: erro salvar galeria:',
      result.error
    );

    mostrarMensagem(
      $('gallery-form-msg'),
      result.error.message,
      'erro'
    );

    return;
  }


  mostrarMensagem(
    $('gallery-form-msg'),
    'Galeria salva.',
    'sucesso'
  );


  fecharFormularioGaleria();

  await carregarGalerias();

  await carregarDashboard();
}


async function excluirGaleria(id) {

  if (
    !window.confirm(
      'Excluir esta galeria e todas as fotografias dela?'
    )
  ) return;


  const {
    data: fotos
  } = await supabase
    .from('gallery_photos')
    .select('id, image_url')
    .eq('gallery_id', id);


  if (fotos?.length) {

    for (const foto of fotos) {

      const caminho =
        obterCaminhoStorage(
          foto.image_url,
          'site-gallery'
        );

      if (caminho) {

        await supabase
          .storage
          .from('site-gallery')
          .remove([
            caminho
          ]);
      }
    }
  }


  const {
    error: fotosError
  } = await supabase
    .from('gallery_photos')
    .delete()
    .eq('gallery_id', id);


  if (fotosError) {

    console.error(
      fotosError
    );

    flash(
      'Erro ao excluir fotografias.',
      'erro'
    );

    return;
  }


  const {
    error
  } = await supabase
    .from('galleries')
    .delete()
    .eq('id', id);


  if (error) {

    console.error(
      'ADMIN V2: erro excluir galeria:',
      error
    );

    flash(
      'Erro ao excluir galeria.',
      'erro'
    );

    return;
  }


  flash(
    'Galeria excluída.'
  );


  await carregarGalerias();

  await carregarDashboard();
}


// ============================================================
// EDITOR DE FOTOS DA GALERIA
// ============================================================

async function abrirEditorFotos(galeria) {

  currentGalleryId =
    galeria.id;

  currentGallery =
    galeria;


  $('modal-gallery-title').textContent =
    galeria.title;


  $('gallery-editor-modal').hidden =
    false;


  await carregarFotosGaleria();
}


function fecharModalGaleria() {

  $('gallery-editor-modal').hidden =
    true;

  currentGalleryId = null;

  currentGallery = null;

  if ($('photo-upload'))
    $('photo-upload').value = '';
}


async function carregarFotosGaleria() {

  const grid =
    $('photo-grid');

  if (!grid) return;


  grid.innerHTML = `
    <p class="msg">
      Carregando fotografias...
    </p>
  `;


  const {
    data,
    error
  } = await supabase
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
      'gallery_id',
      currentGalleryId
    )
    .order(
      'sort_order',
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      'ADMIN V2: erro fotos galeria:',
      error
    );

    grid.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }


  if ($('photo-count')) {

    $('photo-count').textContent =
      `${data?.length || 0} fotografias`;
  }


  if (!data?.length) {

    grid.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma fotografia adicionada.</p>
      </div>
    `;

    return;
  }


  grid.innerHTML =
    data.map(foto => `

      <div
        class="admin-photo ${
          currentGallery.cover_url ===
          foto.image_url
            ? 'cover'
            : ''
        }"
        data-photo-id="${foto.id}"
      >

        <img
          src="${escaparHTML(
            foto.image_url
          )}"
          alt="${escaparHTML(
            foto.alt_text || ''
          )}"
          loading="lazy"
        >

        ${
          currentGallery.cover_url ===
          foto.image_url
            ? `
              <span class="admin-photo-cover">
                Capa
              </span>
            `
            : ''
        }

        <button
          type="button"
          class="admin-photo-delete"
          data-delete-photo="${foto.id}"
        >
          ×
        </button>

      </div>

    `).join('');


  document
    .querySelectorAll(
      '#photo-grid .admin-photo'
    )
    .forEach(element => {

      element.addEventListener(
        'click',
        event => {

          if (
            event.target.closest(
              '.admin-photo-delete'
            )
          ) return;

          definirCapa(
            element.dataset.photoId
          );
        }
      );
    });


  document
    .querySelectorAll(
      '[data-delete-photo]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          excluirFotoGaleria(
            btn.dataset.deletePhoto
          );
        }
      );
    });
}


async function uploadFotosGaleria(event) {

  const arquivos =
    Array.from(
      event.target.files || []
    );


  if (
    !arquivos.length ||
    !currentGalleryId
  ) return;


  const msg =
    $('upload-msg');


  let enviadas = 0;


  for (
    let i = 0;
    i < arquivos.length;
    i++
  ) {

    const arquivo =
      arquivos[i];


    try {

      mostrarMensagem(
        msg,
        `Enviando ${i + 1} de ${arquivos.length}...`
      );


      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );


      const caminho =
        `${currentGalleryId}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}`;


      const {
        error: uploadError
      } = await supabase
        .storage
        .from('site-gallery')
        .upload(
          caminho,
          arquivo,
          {
            cacheControl: '3600',
            upsert: false,
            contentType: arquivo.type
          }
        );


      if (uploadError)
        throw uploadError;


      const {
        data: urlData
      } = supabase
        .storage
        .from('site-gallery')
        .getPublicUrl(
          caminho
        );


      if (!urlData?.publicUrl)
        throw new Error(
          'URL pública não foi gerada.'
        );


      const {
        error: dbError
      } = await supabase
        .from('gallery_photos')
        .insert({

          gallery_id:
            currentGalleryId,

          image_url:
            urlData.publicUrl,

          alt_text:
            currentGallery?.title || '',

          sort_order:
            Date.now(),

          published:
            true

        });


      if (dbError) {

        await supabase
          .storage
          .from('site-gallery')
          .remove([
            caminho
          ]);

        throw dbError;
      }


      enviadas++;


    } catch (error) {

      console.error(
        'ADMIN V2: erro upload galeria:',
        error
      );

      mostrarMensagem(
        msg,
        `Erro em "${arquivo.name}": ${error.message}`,
        'erro'
      );
    }
  }


  event.target.value = '';


  if (enviadas) {

    mostrarMensagem(
      msg,
      `${enviadas} fotografia(s) enviada(s).`,
      'sucesso'
    );

  }


  await carregarFotosGaleria();

  await carregarGalerias();

  await carregarDashboard();
}


async function definirCapa(photoId) {

  const {
    data: foto,
    error
  } = await supabase
    .from('gallery_photos')
    .select('image_url')
    .eq('id', photoId)
    .single();


  if (error || !foto) {

    flash(
      'Não foi possível localizar a fotografia.',
      'erro'
    );

    return;
  }


  const {
    error: updateError
  } = await supabase
    .from('galleries')
    .update({
      cover_url:
        foto.image_url
    })
    .eq(
      'id',
      currentGalleryId
    );


  if (updateError) {

    console.error(
      updateError
    );

    flash(
      'Não foi possível definir a capa.',
      'erro'
    );

    return;
  }


  currentGallery.cover_url =
    foto.image_url;


  await carregarFotosGaleria();

  await carregarGalerias();
}


async function excluirFotoGaleria(id) {

  if (
    !window.confirm(
      'Excluir esta fotografia?'
    )
  ) return;


  const {
    data: foto,
    error: fotoError
  } = await supabase
    .from('gallery_photos')
    .select('image_url')
    .eq('id', id)
    .single();


  if (fotoError) {

    flash(
      'Erro ao localizar fotografia.',
      'erro'
    );

    return;
  }


  const {
    error
  } = await supabase
    .from('gallery_photos')
    .delete()
    .eq('id', id);


  if (error) {

    console.error(
      error
    );

    flash(
      'Erro ao excluir fotografia.',
      'erro'
    );

    return;
  }


  const caminho =
    obterCaminhoStorage(
      foto.image_url,
      'site-gallery'
    );


  if (caminho) {

    await supabase
      .storage
      .from('site-gallery')
      .remove([
        caminho
      ]);
  }


  if (
    currentGallery.cover_url ===
    foto.image_url
  ) {

    await supabase
      .from('galleries')
      .update({
        cover_url: null
      })
      .eq(
        'id',
        currentGalleryId
      );

    currentGallery.cover_url =
      null;
  }


  await carregarFotosGaleria();

  await carregarGalerias();

  await carregarDashboard();
}


function obterCaminhoStorage(
  url,
  bucket
) {

  if (!url) return null;


  const marcador =
    `/storage/v1/object/public/${bucket}/`;


  const index =
    url.indexOf(marcador);


  if (index === -1)
    return null;


  return decodeURIComponent(
    url.substring(
      index + marcador.length
    )
  );
}


// ============================================================
// CLIENTES / ENSAIOS
// ============================================================

async function carregarClientes() {

  const lista =
    $('clients-list');

  if (!lista) return;


  lista.innerHTML = `
    <p class="msg">
      Carregando ensaios...
    </p>
  `;


  const {
    data: ensaios,
    error
  } = await supabase
    .from('ensaios')
    .select(`
      id,
      slug,
      titulo,
      cliente_nome,
      codigo_acesso,
      categoria,
      status,
      created_at
    `)
    .order(
      'created_at',
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      'ADMIN V2: erro ensaios:',
      error
    );

    lista.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }


  if (!ensaios?.length) {

    lista.innerHTML = `
      <div class="empty-state">

        <p>
          Nenhum ensaio cadastrado ainda.
        </p>

        <button
          class="btn btn-accent"
          id="empty-new-client"
          type="button"
        >
          Criar primeiro ensaio
        </button>

      </div>
    `;


    $('empty-new-client')
      ?.addEventListener(
        'click',
        abrirFormularioCliente
      );


    return;
  }


  lista.innerHTML =
    ensaios
      .map(
        clienteCardHTML
      )
      .join('');


  ensaios.forEach(
    ensaio => {

      const head =
        document.getElementById(
          `client-head-${ensaio.id}`
        );

      if (head) {

        head.addEventListener(
          'click',
          () =>
            toggleCliente(
              ensaio
            )
        );
      }
    }
  );
}


function clienteCardHTML(ensaio) {

  return `

    <div class="client-card">

      <div
        class="client-card-head"
        id="client-head-${ensaio.id}"
      >

        <div class="client-card-info">

          <strong>
            ${escaparHTML(
              ensaio.titulo
            )}
          </strong>

          <p>
            ${escaparHTML(
              ensaio.cliente_nome || ''
            )}
          </p>

          <p class="footer-mono">
            Login: ${escaparHTML(
              ensaio.slug
            )}
          </p>

        </div>


        <span
          class="client-status ${
            escaparHTML(
              ensaio.status || ''
            )
          }"
        >
          ${statusLabel(
            ensaio.status
          )}
        </span>

      </div>


      <div
        id="client-detail-${ensaio.id}"
        class="client-detail"
      ></div>

    </div>

  `;
}


function statusLabel(status) {

  if (status === 'entregue')
    return 'Entregue';

  if (
    status === 'selecionado' ||
    status === 'aguardando_final'
  )
    return 'Cliente escolheu';

  return 'Aguardando seleção';
}


async function toggleCliente(ensaio) {

  const detalhe =
    $(`client-detail-${ensaio.id}`);

  if (!detalhe) return;


  const aberto =
    detalhe.classList.contains(
      'is-open'
    );


  document
    .querySelectorAll('.client-detail.is-open')
    .forEach(item => {

      item.classList.remove(
        'is-open'
      );
    });


  if (aberto) return;


  detalhe.classList.add(
    'is-open'
  );


  await carregarDetalheCliente(
    ensaio
  );
}


async function carregarDetalheCliente(
  ensaio
) {

  const detalhe =
    $(`client-detail-${ensaio.id}`);


  if (!detalhe) return;


  detalhe.innerHTML = `
    <p class="msg">
      Carregando...
    </p>
  `;


  const {
    data: fotos,
    error
  } = await supabase
    .from('fotos')
    .select(`
      id,
      ensaio_id,
      url,
      tipo,
      selecionada,
      ordem,
      created_at
    `)
    .eq(
      'ensaio_id',
      ensaio.id
    )
    .order(
      'ordem',
      {
        ascending: true
      }
    );


  if (error) {

    detalhe.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }


  const todas =
    fotos || [];


  const provas =
    todas.filter(
      foto =>
        foto.tipo === 'prova'
    );


  const finais =
    todas.filter(
      foto =>
        foto.tipo === 'final'
    );


  const selecionadas =
    provas.filter(
      foto =>
        foto.selecionada
    );


  detalhe.innerHTML = `

    <div class="client-access-grid">

      <div class="client-access-item">

        <label>
          Área do cliente
        </label>

        <div class="client-access-value">
          ${escaparHTML(
            `${location.origin}/area-cliente`
          )}
        </div>

      </div>


      <div class="client-access-item">

        <label>
          Login
        </label>

        <div class="client-access-value">
          ${escaparHTML(
            ensaio.slug
          )}
        </div>

      </div>


      <div class="client-access-item">

        <label>
          Senha
        </label>

        <div class="client-access-value">
          ${escaparHTML(
            ensaio.codigo_acesso
          )}
        </div>

      </div>

    </div>


    <button
      class="small-btn"
      id="copy-client-${ensaio.id}"
      type="button"
    >
      Copiar dados de acesso
    </button>


    <div class="client-photo-section">

      <p class="footer-mono">

        FOTOS PARA CLIENTE ESCOLHER

        —
        ${provas.length}
        enviadas

        /
        ${selecionadas.length}
        selecionadas

      </p>


      <div class="client-upload">

        <input
          id="client-upload-prova-${ensaio.id}"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
        >

        <p class="footer-mono">
          Selecione as fotos de prova.
        </p>

      </div>


      <div class="client-photo-grid">

        ${
          provas.length
            ? provas.map(
                foto =>
                  fotoHTML(
                    foto,
                    'prova'
                  )
              ).join('')
            : `
              <p class="msg">
                Nenhuma prova enviada.
              </p>
            `
        }

      </div>

    </div>


    <div class="client-photo-section">

      <p class="footer-mono">

        FOTOS FINAIS

        —
        ${finais.length}
        enviadas

      </p>


      <div class="client-upload">

        <input
          id="client-upload-final-${ensaio.id}"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
        >

        <p class="footer-mono">
          Fotos finais para entrega.
        </p>

      </div>


      <div class="client-photo-grid">

        ${
          finais.length
            ? finais.map(
                foto =>
                  fotoHTML(
                    foto,
                    'final'
                  )
              ).join('')
            : `
              <p class="msg">
                Nenhuma foto final enviada.
              </p>
            `
        }

      </div>

    </div>


    <div class="client-actions">

      <button
        class="btn btn-accent"
        id="deliver-client-${ensaio.id}"
        type="button"
      >
        ${
          ensaio.status === 'entregue'
            ? 'Já entregue ✓'
            : 'Marcar como entregue'
        }
      </button>


      <button
        class="btn danger-btn"
        id="delete-client-${ensaio.id}"
        type="button"
      >
        Excluir ensaio
      </button>

    </div>


    <p
      id="client-msg-${ensaio.id}"
      class="msg"
    ></p>

  `;


  $(`client-upload-prova-${ensaio.id}`)
    ?.addEventListener(
      'change',
      event =>
        uploadFotosCliente(
          event,
          ensaio,
          'prova'
        )
    );


  $(`client-upload-final-${ensaio.id}`)
    ?.addEventListener(
      'change',
      event =>
        uploadFotosCliente(
          event,
          ensaio,
          'final'
        )
    );


  $(`copy-client-${ensaio.id}`)
    ?.addEventListener(
      'click',
      event =>
        copiarAcessoCliente(
          ensaio,
          event.currentTarget
        )
    );


  $(`deliver-client-${ensaio.id}`)
    ?.addEventListener(
      'click',
      () =>
        marcarEntregue(
          ensaio
        )
    );


  $(`delete-client-${ensaio.id}`)
    ?.addEventListener(
      'click',
      () =>
        excluirEnsaio(
          ensaio
        )
    );
}


function fotoHTML(
  foto,
  tipo
) {

  return `

    <div class="client-photo ${
      foto.selecionada
        ? 'selected'
        : ''
    }">

      <img
        src="${escaparHTML(
          foto.url
        )}"
        alt="Fotografia"
        loading="lazy"
      >

      <span class="client-photo-type">
        ${tipo}
      </span>

    </div>

  `;
}


// ============================================================
// CRIAR ENSAIO
// ============================================================

async function criarCliente(event) {

  event.preventDefault();


  const msg =
    $('client-form-msg');


  const titulo =
    $('client-title')?.value.trim();


  const nome =
    $('client-name')?.value.trim();


  const categoria =
    $('client-category')?.value || null;


  const login =
    slugify(
      $('client-login')?.value
    );


  const senha =
    $('client-password')?.value.trim();


  if (!titulo) {

    mostrarMensagem(
      msg,
      'Digite o título do ensaio.',
      'erro'
    );

    return;
  }


  if (!login) {

    mostrarMensagem(
      msg,
      'Digite um login.',
      'erro'
    );

    return;
  }


  if (!senha) {

    mostrarMensagem(
      msg,
      'Digite uma senha.',
      'erro'
    );

    return;
  }


  mostrarMensagem(
    msg,
    'Criando ensaio...'
  );


  const {
    error
  } = await supabase
    .from('ensaios')
    .insert({

      titulo,

      cliente_nome:
        nome || null,

      categoria,

      codigo_acesso:
        senha,

      slug:
        login,

      status:
        'aguardando_selecao'

    });


  if (error) {

    console.error(
      'ADMIN V2: erro criar ensaio:',
      error
    );


    mostrarMensagem(
      msg,
      error.message,
      'erro'
    );

    return;
  }


  mostrarMensagem(
    msg,
    'Ensaio criado com sucesso!',
    'sucesso'
  );


  $('client-form')?.reset();


  await carregarClientes();

  await carregarDashboard();
}


function abrirFormularioCliente() {

  if ($('client-form-wrap'))
    $('client-form-wrap').hidden = false;
}


function fecharFormularioCliente() {

  if ($('client-form-wrap'))
    $('client-form-wrap').hidden = true;

  if ($('client-form'))
    $('client-form').reset();
}


// ============================================================
// UPLOAD DE FOTOS DO ENSAIO — VERSÃO CORRIGIDA
// ============================================================

async function uploadFotosCliente(event, ensaio, tipo = 'prova') {

  const arquivos = Array.from(
    event.target.files || []
  );

  if (!arquivos.length) {
    return;
  }

  const mensagem =
    document.getElementById(
      `msg-${ensaio.id}`
    );

  let enviadas = 0;
  let erros = 0;

  mostrarMensagem(
    mensagem,
    `Preparando ${arquivos.length} foto(s)...`
  );

  // ----------------------------------------------------------
  // CONFIRMAR SESSÃO
  // ----------------------------------------------------------

  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {

    console.error(
      'ADMIN V2: erro de sessão:',
      sessionError
    );

    mostrarMensagem(
      mensagem,
      'Erro ao verificar sua sessão.',
      'erro'
    );

    event.target.value = '';
    return;
  }

  if (!sessionData?.session) {

    mostrarMensagem(
      mensagem,
      'Sua sessão expirou. Faça login novamente.',
      'erro'
    );

    event.target.value = '';
    return;
  }

  // ----------------------------------------------------------
  // UPLOAD FOTO POR FOTO
  // ----------------------------------------------------------

  for (let i = 0; i < arquivos.length; i++) {

    const arquivo = arquivos[i];

    let caminho = null;

    try {

      console.log(
        '========================================'
      );

      console.log(
        'ADMIN V2 — UPLOAD FOTO'
      );

      console.log(
        'Ensaio:',
        ensaio.id
      );

      console.log(
        'Tipo:',
        tipo
      );

      console.log(
        'Arquivo:',
        arquivo.name
      );

      console.log(
        'Tamanho:',
        arquivo.size
      );

      console.log(
        'MIME:',
        arquivo.type
      );


      // ------------------------------------------------------
      // NOME SEGURO
      // ------------------------------------------------------

      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );

      const identificador =
        `${Date.now()}-${crypto.randomUUID()}`;

      caminho =
        `${ensaio.id}/${tipo}/${identificador}-${nomeSeguro}`;


      // ------------------------------------------------------
      // STORAGE
      // ------------------------------------------------------

      mostrarMensagem(
        mensagem,
        `Enviando foto ${i + 1} de ${arquivos.length}...`
      );

      const {
        data: uploadData,
        error: uploadError
      } = await supabase
        .storage
        .from('fotos')
        .upload(
          caminho,
          arquivo,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              arquivo.type
          }
        );

      console.log(
        'Storage:',
        uploadData
      );

      if (uploadError) {

        console.error(
          'ADMIN V2: erro Storage:',
          uploadError
        );

        throw new Error(
          `Erro no Storage: ${uploadError.message}`
        );
      }


      // ------------------------------------------------------
      // URL PÚBLICA
      // ------------------------------------------------------

      const {
        data: publicUrlData
      } = supabase
        .storage
        .from('fotos')
        .getPublicUrl(
          caminho
        );

      const publicUrl =
        publicUrlData?.publicUrl;

      console.log(
        'URL pública:',
        publicUrl
      );

      if (!publicUrl) {

        throw new Error(
          'Não foi possível obter a URL pública da foto.'
        );
      }


      // ------------------------------------------------------
      // BANCO — TABELA FOTOS
      //
      // IMPORTANTE:
      // Usamos SOMENTE as colunas existentes.
      // ------------------------------------------------------

      const registroFoto = {

        ensaio_id:
          ensaio.id,

        url:
          publicUrl,

        tipo:
          tipo,

        selecionada:
          false,

        ordem:
          i

      };

      console.log(
        'Inserindo em fotos:',
        registroFoto
      );


      const {
        data: fotoInserida,
        error: fotoError
      } = await supabase
        .from('fotos')
        .insert(
          registroFoto
        )
        .select(
          'id, ensaio_id, url, tipo, selecionada, ordem, created_at'
        )
        .single();


      // ------------------------------------------------------
      // ERRO NO BANCO
      // ------------------------------------------------------

      if (fotoError) {

        console.error(
          '========================================'
        );

        console.error(
          'ADMIN V2 — ERRO INSERT FOTOS'
        );

        console.error(
          'Código:',
          fotoError.code
        );

        console.error(
          'Mensagem:',
          fotoError.message
        );

        console.error(
          'Detalhes:',
          fotoError.details
        );

        console.error(
          'Hint:',
          fotoError.hint
        );

        console.error(
          'Registro enviado:',
          registroFoto
        );

        console.error(
          '========================================'
        );


        // ----------------------------------------------------
        // ROLLBACK STORAGE
        // ----------------------------------------------------

        if (caminho) {

          const {
            error: removeError
          } = await supabase
            .storage
            .from('fotos')
            .remove([
              caminho
            ]);

          if (removeError) {

            console.error(
              'Erro ao remover arquivo após falha:',
              removeError
            );
          }
        }

        throw new Error(
          `Banco de fotos: ${fotoError.message}`
        );
      }


      // ------------------------------------------------------
      // SUCESSO
      // ------------------------------------------------------

      console.log(
        'Foto registrada com sucesso:',
        fotoInserida
      );

      enviadas++;

    } catch (error) {

      erros++;

      console.error(
        'ADMIN V2: erro upload cliente:',
        error
      );

      mostrarMensagem(
        mensagem,
        `Erro na foto "${arquivo.name}": ${error.message}`,
        'erro'
      );
    }
  }


  // ----------------------------------------------------------
  // LIMPAR INPUT
  // ----------------------------------------------------------

  event.target.value = '';


  // ----------------------------------------------------------
  // RESULTADO
  // ----------------------------------------------------------

  if (erros === 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} foto(s) enviada(s) com sucesso!`,
      'sucesso'
    );

  } else if (enviadas > 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} foto(s) enviada(s) e ${erros} com erro.`,
      'erro'
    );

  } else {

    mostrarMensagem(
      mensagem,
      'Nenhuma foto foi registrada. Veja o Console para o erro.',
      'erro'
    );
  }


  // ----------------------------------------------------------
  // RECARREGAR O DETALHE DO ENSAIO
  // ----------------------------------------------------------

  if (
    typeof atualizarDetalheEnsaio ===
    'function'
  ) {

    await atualizarDetalheEnsaio(
      ensaio
    );

  } else if (
    typeof carregarClientes ===
    'function'
  ) {

    await carregarClientes();

  } else if (
    typeof carregarEnsaios ===
    'function'
  ) {

    await carregarEnsaios();
  }
}


// ============================================================
// ENTREGAR ENSAIO
// ============================================================

async function marcarEntregue(
  ensaio
) {

  if (
    ensaio.status ===
    'entregue'
  )
    return;


  if (
    !window.confirm(
      `Marcar "${ensaio.titulo}" como entregue?`
    )
  )
    return;


  const mensagem =
    $(`client-msg-${ensaio.id}`);


  mostrarMensagem(
    mensagem,
    'Atualizando...'
  );


  const {
    error
  } =
    await supabase
      .from('ensaios')
      .update({
        status:
          'entregue'
      })
      .eq(
        'id',
        ensaio.id
      );


  if (error) {

    mostrarMensagem(
      mensagem,
      error.message,
      'erro'
    );

    return;
  }


  mostrarMensagem(
    mensagem,
    'Ensaio marcado como entregue.',
    'sucesso'
  );


  await carregarClientes();
}


// ============================================================
// EXCLUIR ENSAIO
// ============================================================

async function excluirEnsaio(
  ensaio
) {

  if (
    !window.confirm(
      `Excluir "${ensaio.titulo}"?\n\n` +
      `Isso apagará o ensaio e todas as fotos associadas.`
    )
  )
    return;


  const mensagem =
    $(`client-msg-${ensaio.id}`);


  mostrarMensagem(
    mensagem,
    'Excluindo...'
  );


  const {
    data: fotos
  } =
    await supabase
      .from('fotos')
      .select(
        'id,url'
      )
      .eq(
        'ensaio_id',
        ensaio.id
      );


  if (fotos?.length) {

    const caminhos =
      fotos
        .map(
          foto =>
            obterCaminhoStorage(
              foto.url,
              'fotos'
            )
        )
        .filter(Boolean);


    if (caminhos.length) {

      await supabase
        .storage
        .from('fotos')
        .remove(
          caminhos
        );
    }
  }


  const {
    error: fotosError
  } =
    await supabase
      .from('fotos')
      .delete()
      .eq(
        'ensaio_id',
        ensaio.id
      );


  if (fotosError) {

    mostrarMensagem(
      mensagem,
      fotosError.message,
      'erro'
    );

    return;
  }


  const {
    error
  } =
    await supabase
      .from('ensaios')
      .delete()
      .eq(
        'id',
        ensaio.id
      );


  if (error) {

    mostrarMensagem(
      mensagem,
      error.message,
      'erro'
    );

    return;
  }


  flash(
    'Ensaio excluído.'
  );


  await carregarClientes();

  await carregarDashboard();
}


// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {


  // LOGIN

  $('login-form')
    ?.addEventListener(
      'submit',
      fazerLogin
    );


  // LOGOUT

  $('logout-btn')
    ?.addEventListener(
      'click',
      fazerLogout
    );


  // NAVEGAÇÃO

  document
    .querySelectorAll(
      '[data-view]'
    )
    .forEach(elemento => {

      elemento.addEventListener(
        'click',
        () => {

          const view =
            elemento.dataset.view;

          if (view)
            mostrarView(view);
        }
      );
    });


  // NOVO CLIENTE

  $('new-client-btn')
    ?.addEventListener(
      'click',
      abrirFormularioCliente
    );


  $('close-client-form')
    ?.addEventListener(
      'click',
      fecharFormularioCliente
    );


  $('cancel-client-form')
    ?.addEventListener(
      'click',
      fecharFormularioCliente
    );


  $('client-form')
    ?.addEventListener(
      'submit',
      criarCliente
    );


  // GERAR LOGIN

  $('generate-client-login')
    ?.addEventListener(
      'click',
      () => {

        $('client-login').value =
          gerarLogin();

      }
    );


  // GERAR SENHA

  $('generate-client-password')
    ?.addEventListener(
      'click',
      () => {

        $('client-password').value =
          gerarSenha();

      }
    );


  // GALERIA

  $('new-gallery-btn')
    ?.addEventListener(
      'click',
      () =>
        abrirFormularioGaleria()
    );


  $('close-gallery-form')
    ?.addEventListener(
      'click',
      fecharFormularioGaleria
    );


  $('cancel-gallery-form')
    ?.addEventListener(
      'click',
      fecharFormularioGaleria
    );


  $('gallery-form')
    ?.addEventListener(
      'submit',
      salvarGaleria
    );


  // UPLOAD GALERIA

  $('photo-upload')
    ?.addEventListener(
      'change',
      uploadFotosGaleria
    );


  // MODAL

  document
    .querySelectorAll(
      '[data-close-modal]'
    )
    .forEach(elemento => {

      elemento.addEventListener(
        'click',
        fecharModalGaleria
      );
    });


  // CATEGORIAS

  $('category-form')
    ?.addEventListener(
      'submit',
      salvarCategoria
    );


  $('cancel-category')
    ?.addEventListener(
      'click',
      limparFormularioCategoria
    );
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function iniciarAdmin() {

  console.log(
    '================================'
  );

  console.log(
    'ADMIN V2 — INICIALIZAÇÃO'
  );

  console.log(
    '================================'
  );


  try {

    configurarEventos();

    await verificarSessao();


  } catch (error) {

    console.error(
      'ADMIN V2: ERRO FATAL:',
      error
    );


    const flashElemento =
      $('flash');


    if (flashElemento) {

      flashElemento.hidden =
        false;

      flashElemento.className =
        'flash erro';

      flashElemento.textContent =
        'Erro ao inicializar o painel. Abra o Console do navegador para verificar.';
    }
  }
}


// ============================================================
// DOM READY
// ============================================================

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarAdmin
  );

} else {

  iniciarAdmin();

}
