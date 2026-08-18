// ============================================================
// ADMIN V2 — RANGEL SANTOS FOTOGRAFIA
// CMS + ÁREA DE CLIENTES
// ============================================================
// Compatível com:
// - admin-v2.html
// - Supabase V2
// - categories
// - galleries
// - gallery_photos
// - ensaios
// - fotos
//
// IMPORTANTE:
// - Galerias CMS usam o bucket: site-gallery
// - Fotos de clientes continuam usando o bucket: fotos
// - Não altera admin.html
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
// CONFIGURAÇÕES
// ============================================================

const STORAGE_BUCKET_GALLERY = 'site-gallery';
const STORAGE_BUCKET_CLIENT = 'fotos';


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

  clearTimeout(elemento._timer);

  elemento._timer = setTimeout(() => {

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


function obterExtensao(nome) {

  const partes =
    String(nome || '')
      .split('.');

  if (partes.length < 2) {
    return 'jpg';
  }

  return partes
    .pop()
    .toLowerCase();
}


function obterCaminhoStorage(url, bucket) {

  if (!url) return null;

  try {

    const texto = String(url);

    const marcador =
      `/storage/v1/object/public/${bucket}/`;

    const index =
      texto.indexOf(marcador);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      texto.substring(
        index + marcador.length
      )
    );

  } catch (error) {

    console.error(
      'Erro ao obter caminho Storage:',
      error
    );

    return null;
  }
}


function obterUrlPublica(bucket, caminho) {

  const {
    data
  } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(caminho);

  return data?.publicUrl || '';
}


function normalizarErro(error) {

  if (!error) {
    return 'Erro desconhecido.';
  }

  return (
    error.message ||
    error.error_description ||
    'Erro desconhecido.'
  );
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

  const {
    error
  } =
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
  } =
    await supabase.auth.getSession();

  if (error) {

    console.error(
      'ADMIN V2: erro sessão:',
      error
    );

    mostrarLogin();

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
    app.style.display = 'none';
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
  } =
    await supabase.auth.getUser();

  if (
    data?.user &&
    $('user-email')
  ) {

    $('user-email').textContent =
      data.user.email || '';
  }

  await carregarDashboard();
  await carregarCategorias();
  await carregarGalerias();

  if (
    typeof carregarClientes ===
    'function'
  ) {

    await carregarClientes();
  }

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
    .querySelectorAll(
      '.sidebar-link[data-view]'
    )
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

  const {
    data,
    error
  } =
    await supabase
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

    (data || []).forEach(
      categoria => {

        const option =
          document.createElement(
            'option'
          );

        option.value =
          categoria.id;

        option.textContent =
          categoria.name;

        selectGallery.appendChild(
          option
        );
      }
    );
  }


  if (!lista) return;


  if (!data?.length) {

    lista.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma categoria cadastrada.</p>
      </div>
    `;

    return;
  }


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
              type="button"
              class="small-btn"
              data-edit-category="${categoria.id}"
            >
              Editar
            </button>

            <button
              type="button"
              class="small-btn danger-btn"
              data-delete-category="${categoria.id}"
            >
              Excluir
            </button>

          </div>

        </div>

      </div>

    `).join('');


  document
    .querySelectorAll(
      '[data-edit-category]'
    )
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

          if ($('cancel-category')) {

            $('cancel-category').hidden =
              false;
          }

          $('category-name')?.focus();
        }
      );
    });


  document
    .querySelectorAll(
      '[data-delete-category]'
    )
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
      normalizarErro(result.error),
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

  await carregarDashboard();
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
  } =
    await supabase
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

  await carregarGalerias();
}


// ============================================================
// GALERIAS — CARREGAR
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
    data: galerias,
    error: galeriasError
  } =
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


  if (galeriasError) {

    console.error(
      'ADMIN V2: erro galerias:',
      galeriasError
    );

    lista.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(
          galeriasError.message
        )}
      </p>
    `;

    return;
  }


  if (!galerias?.length) {

    lista.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma galeria cadastrada.</p>
      </div>
    `;

    return;
  }


  const ids =
    galerias.map(
      galeria =>
        galeria.id
    );


  const {
    data: fotos,
    error: fotosError
  } =
    await supabase
      .from('gallery_photos')
      .select(`
        id,
        gallery_id,
        image_url,
        sort_order,
        published,
        created_at
      `)
      .in(
        'gallery_id',
        ids
      )
      .order(
        'sort_order',
        {
          ascending: true
        }
      );


  if (fotosError) {

    console.error(
      'ADMIN V2: erro fotos galerias:',
      fotosError
    );
  }


  const fotosPorGaleria = {};


  (fotos || []).forEach(foto => {

    if (
      !fotosPorGaleria[
        foto.gallery_id
      ]
    ) {

      fotosPorGaleria[
        foto.gallery_id
      ] = [];
    }

    fotosPorGaleria[
      foto.gallery_id
    ].push(foto);
  });


  lista.innerHTML =
    galerias.map(
      (galeria, index) => {

        const fotosGaleria =
          fotosPorGaleria[
            galeria.id
          ] || [];

        const miniatura =
          galeria.cover_url ||
          fotosGaleria[0]?.image_url ||
          '';

        const totalFotos =
          fotosGaleria.length;

        const primeira =
          index === 0;

        const ultima =
          index ===
          galerias.length - 1;

        return `

          <div
            class="client-card gallery-card"
            data-gallery-card="${galeria.id}"
          >

            <div
              class="client-card-head"
              style="
                align-items:center;
              "
            >

              <div
                class="gallery-thumbnail"
                style="
                  width:90px;
                  height:70px;
                  min-width:90px;
                  border-radius:8px;
                  overflow:hidden;
                  background:#151515;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  margin-right:16px;
                "
              >

                ${
                  miniatura
                    ? `
                      <img
                        src="${escaparHTML(miniatura)}"
                        alt="${escaparHTML(galeria.title)}"
                        style="
                          width:100%;
                          height:100%;
                          object-fit:cover;
                          display:block;
                        "
                        loading="lazy"
                      >
                    `
                    : `
                      <span
                        style="
                          font-size:11px;
                          opacity:.5;
                          text-align:center;
                          padding:5px;
                        "
                      >
                        Sem foto
                      </span>
                    `
                }

              </div>


              <div class="client-card-info">

                <strong>
                  ${escaparHTML(
                    galeria.title
                  )}
                </strong>

                <p>
                  ${totalFotos}
                  ${
                    totalFotos === 1
                      ? 'fotografia'
                      : 'fotografias'
                  }
                </p>

                <p class="footer-mono">
                  ${escaparHTML(
                    galeria.slug
                  )}
                </p>

              </div>


              <div
                style="
                  margin-left:auto;
                  display:flex;
                  align-items:center;
                  gap:6px;
                  flex-wrap:wrap;
                  justify-content:flex-end;
                "
              >

                <span
                  class="client-status ${
                    galeria.published
                      ? 'entregue'
                      : ''
                  }"
                >
                  ${
                    galeria.published
                      ? 'Publicada'
                      : 'Rascunho'
                  }
                </span>


                <button
                  type="button"
                  class="small-btn"
                  data-toggle-gallery="${galeria.id}"
                >
                  ${
                    galeria.published
                      ? 'Despublicar'
                      : 'Publicar'
                  }
                </button>


                <button
                  type="button"
                  class="small-btn"
                  data-move-gallery-up="${galeria.id}"
                  ${primeira ? 'disabled' : ''}
                >
                  ↑
                </button>


                <button
                  type="button"
                  class="small-btn"
                  data-move-gallery-down="${galeria.id}"
                  ${ultima ? 'disabled' : ''}
                >
                  ↓
                </button>


                <button
                  type="button"
                  class="small-btn"
                  data-edit-gallery="${galeria.id}"
                >
                  Editar
                </button>


                <button
                  type="button"
                  class="small-btn"
                  data-gallery-photos="${galeria.id}"
                >
                  Fotos (${totalFotos})
                </button>


                <button
                  type="button"
                  class="small-btn danger-btn"
                  data-delete-gallery="${galeria.id}"
                >
                  Excluir
                </button>

              </div>

            </div>

          </div>

        `;
      }
    ).join('');


  // ----------------------------------------------------------
  // EDITAR
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-edit-gallery]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          const galeria =
            galerias.find(
              item =>
                item.id ===
                btn.dataset.editGallery
            );

          if (!galeria) return;

          abrirFormularioGaleria(
            galeria
          );
        }
      );
    });


  // ----------------------------------------------------------
  // FOTOS
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-gallery-photos]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        async () => {

          const galeria =
            galerias.find(
              item =>
                item.id ===
                btn.dataset.galleryPhotos
            );

          if (!galeria) return;

          await abrirEditorFotos(
            galeria
          );
        }
      );
    });


  // ----------------------------------------------------------
  // PUBLICAR / DESPUBLICAR
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-toggle-gallery]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          alternarPublicacaoGaleria(
            btn.dataset.toggleGallery
          )
      );
    });


  // ----------------------------------------------------------
  // MOVER
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-move-gallery-up]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          moverGaleria(
            btn.dataset.moveGalleryUp,
            'up'
          )
      );
    });


  document
    .querySelectorAll(
      '[data-move-gallery-down]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          moverGaleria(
            btn.dataset.moveGalleryDown,
            'down'
          )
      );
    });


  // ----------------------------------------------------------
  // EXCLUIR
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-delete-gallery]'
    )
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


// ============================================================
// GALERIAS — FORMULÁRIO
// ============================================================

function abrirFormularioGaleria(
  galeria = null
) {

  currentGallery =
    galeria;

  currentGalleryId =
    galeria?.id || null;


  const form =
    $('gallery-form');

  if (!form) {

    console.warn(
      'ADMIN V2: gallery-form não encontrado.'
    );

    return;
  }


  if (galeria) {

    if ($('gallery-id'))
      $('gallery-id').value =
        galeria.id;

    if ($('gallery-title'))
      $('gallery-title').value =
        galeria.title || '';

    if ($('gallery-slug'))
      $('gallery-slug').value =
        galeria.slug || '';

    if ($('gallery-description'))
      $('gallery-description').value =
        galeria.description || '';

    if ($('gallery-category'))
      $('gallery-category').value =
        galeria.category_id || '';

    if ($('gallery-order'))
      $('gallery-order').value =
        galeria.sort_order ?? 0;

    if ($('gallery-cover'))
      $('gallery-cover').value =
        galeria.cover_url || '';

  } else {

    form.reset();

    if ($('gallery-id'))
      $('gallery-id').value = '';

    if ($('gallery-order'))
      $('gallery-order').value = 0;
  }


  const modal =
    $('gallery-form-modal') ||
    $('gallery-modal') ||
    $('gallery-form-container');


  if (modal) {

    modal.hidden = false;

    modal.style.display = '';
  }


  mostrarView('galleries');


  $('gallery-title')?.focus();
}


function fecharFormularioGaleria() {

  currentGallery =
    null;

  currentGalleryId =
    null;


  if ($('gallery-form'))
    $('gallery-form').reset();

  if ($('gallery-id'))
    $('gallery-id').value = '';

  if ($('gallery-order'))
    $('gallery-order').value = 0;


  const modal =
    $('gallery-form-modal') ||
    $('gallery-modal') ||
    $('gallery-form-container');


  if (modal) {

    modal.hidden = true;

    modal.style.display = 'none';
  }
}


// ============================================================
// GALERIAS — SALVAR
// ============================================================

async function salvarGaleria(event) {

  event.preventDefault();


  const mensagem =
    $('gallery-msg');


  const id =
    $('gallery-id')?.value.trim();


  const titulo =
    $('gallery-title')?.value.trim();


  const slugInformado =
    $('gallery-slug')?.value.trim();


  const slug =
    slugify(
      slugInformado ||
      titulo
    );


  const descricao =
    $('gallery-description')?.value.trim();


  const categoryId =
    $('gallery-category')?.value ||
    null;


  const ordem =
    Number(
      $('gallery-order')?.value || 0
    );


  if (!titulo) {

    mostrarMensagem(
      mensagem,
      'Informe o título da galeria.',
      'erro'
    );

    $('gallery-title')?.focus();

    return;
  }


  if (!slug) {

    mostrarMensagem(
      mensagem,
      'Informe um slug válido.',
      'erro'
    );

    $('gallery-slug')?.focus();

    return;
  }


  mostrarMensagem(
    mensagem,
    'Salvando galeria...'
  );


  const payload = {

    title:
      titulo,

    slug,

    description:
      descricao || null,

    category_id:
      categoryId,

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
        .insert({
          ...payload,
          published: false
        })
        .select()
        .single();
  }


  if (result.error) {

    console.error(
      'ADMIN V2: erro salvar galeria:',
      result.error
    );

    mostrarMensagem(
      mensagem,
      normalizarErro(result.error),
      'erro'
    );

    return;
  }


  if (!id && result.data?.id) {

    currentGalleryId =
      result.data.id;
  }


  mostrarMensagem(
    mensagem,
    'Galeria salva com sucesso.',
    'sucesso'
  );


  flash(
    'Galeria salva com sucesso.'
  );


  await carregarGalerias();

  await carregarDashboard();


  setTimeout(() => {

    fecharFormularioGaleria();

  }, 500);
}


// ============================================================
// GALERIAS — PUBLICAR
// ============================================================

async function alternarPublicacaoGaleria(id) {

  const {
    data: galeria,
    error: buscaError
  } =
    await supabase
      .from('galleries')
      .select(
        'id,published,title'
      )
      .eq(
        'id',
        id
      )
      .single();


  if (buscaError) {

    flash(
      normalizarErro(buscaError),
      'erro'
    );

    return;
  }


  const novoEstado =
    !galeria.published;


  const {
    error
  } =
    await supabase
      .from('galleries')
      .update({
        published:
          novoEstado
      })
      .eq(
        'id',
        id
      );


  if (error) {

    console.error(
      'Erro publicar galeria:',
      error
    );

    flash(
      normalizarErro(error),
      'erro'
    );

    return;
  }


  flash(
    novoEstado
      ? 'Galeria publicada.'
      : 'Galeria despublicada.'
  );


  await carregarGalerias();

  await carregarDashboard();
}


// ============================================================
// GALERIAS — ORDENAR
// ============================================================

async function moverGaleria(
  id,
  direcao
) {

  const {
    data: galerias,
    error
  } =
    await supabase
      .from('galleries')
      .select(
        'id,sort_order'
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
          ascending: true
        }
      );


  if (error) {

    flash(
      normalizarErro(error),
      'erro'
    );

    return;
  }


  const index =
    galerias.findIndex(
      item =>
        item.id === id
    );


  if (index === -1) return;


  const novoIndex =
    direcao === 'up'
      ? index - 1
      : index + 1;


  if (
    novoIndex < 0 ||
    novoIndex >= galerias.length
  ) {

    return;
  }


  const atual =
    galerias[index];

  const vizinha =
    galerias[novoIndex];


  // ----------------------------------------------------------
  // Troca temporariamente os valores
  // ----------------------------------------------------------

  const valorTemporario =
    -999999 -
    Math.floor(
      Math.random() * 100000
    );


  let result =
    await supabase
      .from('galleries')
      .update({
        sort_order:
          valorTemporario
      })
      .eq(
        'id',
        atual.id
      );


  if (result.error) {

    flash(
      normalizarErro(result.error),
      'erro'
    );

    return;
  }


  result =
    await supabase
      .from('galleries')
      .update({
        sort_order:
          vizinha.sort_order
      })
      .eq(
        'id',
        vizinha.id
      );


  if (result.error) {

    flash(
      normalizarErro(result.error),
      'erro'
    );

    return;
  }


  result =
    await supabase
      .from('galleries')
      .update({
        sort_order:
          atual.sort_order
      })
      .eq(
        'id',
        atual.id
      );


  if (result.error) {

    flash(
      normalizarErro(result.error),
      'erro'
    );

    return;
  }


  await carregarGalerias();
}


// ============================================================
// GALERIAS — EXCLUIR
// ============================================================

async function excluirGaleria(id) {

  const {
    data: galeria,
    error: buscaError
  } =
    await supabase
      .from('galleries')
      .select(
        'id,title,cover_url'
      )
      .eq(
        'id',
        id
      )
      .single();


  if (buscaError) {

    flash(
      normalizarErro(buscaError),
      'erro'
    );

    return;
  }


  if (
    !window.confirm(
      `Excluir a galeria "${galeria.title}"?\n\n` +
      `Todas as fotografias desta galeria também serão removidas.`
    )
  ) {

    return;
  }


  // ----------------------------------------------------------
  // Buscar fotos
  // ----------------------------------------------------------

  const {
    data: fotos,
    error: fotosError
  } =
    await supabase
      .from('gallery_photos')
      .select(
        'id,image_url'
      )
      .eq(
        'gallery_id',
        id
      );


  if (fotosError) {

    console.error(
      'Erro buscar fotos para exclusão:',
      fotosError
    );

    flash(
      normalizarErro(fotosError),
      'erro'
    );

    return;
  }


  // ----------------------------------------------------------
  // Remover arquivos do Storage
  // ----------------------------------------------------------

  const caminhos =
    (fotos || [])
      .map(
        foto =>
          obterCaminhoStorage(
            foto.image_url,
            STORAGE_BUCKET_GALLERY
          )
      )
      .filter(Boolean);


  if (
    galeria.cover_url
  ) {

    const caminhoCapa =
      obterCaminhoStorage(
        galeria.cover_url,
        STORAGE_BUCKET_GALLERY
      );

    if (
      caminhoCapa &&
      !caminhos.includes(caminhoCapa)
    ) {

      caminhos.push(
        caminhoCapa
      );
    }
  }


  if (caminhos.length) {

    const {
      error: storageError
    } =
      await supabase
        .storage
        .from(
          STORAGE_BUCKET_GALLERY
        )
        .remove(
          caminhos
        );


    if (storageError) {

      console.warn(
        'ADMIN V2: erro ao remover arquivos:',
        storageError
      );
    }
  }


  // ----------------------------------------------------------
  // Excluir registros das fotos
  // ----------------------------------------------------------

  const {
    error: deleteFotosError
  } =
    await supabase
      .from('gallery_photos')
      .delete()
      .eq(
        'gallery_id',
        id
      );


  if (deleteFotosError) {

    console.error(
      'Erro excluir gallery_photos:',
      deleteFotosError
    );

    flash(
      normalizarErro(
        deleteFotosError
      ),
      'erro'
    );

    return;
  }


  // ----------------------------------------------------------
  // Excluir galeria
  // ----------------------------------------------------------

  const {
    error: deleteGaleriaError
  } =
    await supabase
      .from('galleries')
      .delete()
      .eq(
        'id',
        id
      );


  if (deleteGaleriaError) {

    console.error(
      'Erro excluir galeria:',
      deleteGaleriaError
    );

    flash(
      normalizarErro(
        deleteGaleriaError
      ),
      'erro'
    );

    return;
  }


  flash(
    'Galeria excluída com sucesso.'
  );


  currentGalleryId =
    null;

  currentGallery =
    null;


  await carregarGalerias();

  await carregarDashboard();
}


// ============================================================
// EDITOR DE FOTOS DA GALERIA
// ============================================================

async function abrirEditorFotos(
  galeria
) {

  currentGallery =
    galeria;

  currentGalleryId =
    galeria.id;


  const modal =
    $('gallery-photos-modal') ||
    $('photos-modal') ||
    $('gallery-modal');


  const titulo =
    $('gallery-photos-title') ||
    $('photos-modal-title');


  if (titulo) {

    titulo.textContent =
      `Fotos — ${galeria.title}`;
  }


  if (modal) {

    modal.hidden = false;

    modal.style.display = '';
  }


  await carregarFotosGaleria(
    galeria.id
  );
}


// ============================================================
// CARREGAR FOTOS
// ============================================================

async function carregarFotosGaleria(
  galleryId
) {

  const lista =
    $('gallery-photos-list') ||
    $('photos-list');


  if (!lista) {

    console.warn(
      'ADMIN V2: lista de fotos da galeria não encontrada.'
    );

    return;
  }


  lista.innerHTML = `
    <p class="msg">
      Carregando fotografias...
    </p>
  `;


  const {
    data: fotos,
    error
  } =
    await supabase
      .from('gallery_photos')
      .select(`
        id,
        gallery_id,
        image_url,
        sort_order,
        published,
        created_at
      `)
      .eq(
        'gallery_id',
        galleryId
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
          ascending: true
        }
      );


  if (error) {

    console.error(
      'Erro carregar fotos:',
      error
    );

    lista.innerHTML = `
      <p class="msg erro">
        ${escaparHTML(
          error.message
        )}
      </p>
    `;

    return;
  }


  if (!fotos?.length) {

    lista.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma fotografia nesta galeria.</p>
      </div>
    `;

    return;
  }


  lista.innerHTML =
    fotos.map(
      (foto, index) => `

        <div
          class="gallery-photo-item"
          data-photo-id="${foto.id}"
          style="
            position:relative;
            border:1px solid rgba(255,255,255,.08);
            border-radius:10px;
            overflow:hidden;
            background:#111;
          "
        >

          <div
            style="
              aspect-ratio:1/1;
              overflow:hidden;
              background:#171717;
            "
          >

            <img
              src="${escaparHTML(foto.image_url)}"
              alt="Fotografia ${index + 1}"
              loading="lazy"
              style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
              "
            >

          </div>


          <div
            style="
              padding:8px;
              display:flex;
              gap:5px;
              flex-wrap:wrap;
            "
          >

            <button
              type="button"
              class="small-btn"
              data-set-cover="${foto.id}"
            >
              Capa
            </button>

            <button
              type="button"
              class="small-btn"
              data-move-photo-up="${foto.id}"
              ${index === 0 ? 'disabled' : ''}
            >
              ↑
            </button>

            <button
              type="button"
              class="small-btn"
              data-move-photo-down="${foto.id}"
              ${
                index === fotos.length - 1
                  ? 'disabled'
                  : ''
              }
            >
              ↓
            </button>

            <button
              type="button"
              class="small-btn danger-btn"
              data-delete-photo="${foto.id}"
            >
              Excluir
            </button>

          </div>

        </div>

      `
    ).join('');


  document
    .querySelectorAll(
      '[data-set-cover]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          definirFotoComoCapa(
            btn.dataset.setCover
          )
      );
    });


  document
    .querySelectorAll(
      '[data-delete-photo]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          excluirFotoGaleria(
            btn.dataset.deletePhoto
          )
      );
    });


  document
    .querySelectorAll(
      '[data-move-photo-up]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          moverFotoGaleria(
            btn.dataset.movePhotoUp,
            'up'
          )
      );
    });


  document
    .querySelectorAll(
      '[data-move-photo-down]'
    )
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () =>
          moverFotoGaleria(
            btn.dataset.movePhotoDown,
            'down'
          )
      );
    });
}


// ============================================================
// UPLOAD DE FOTOS DA GALERIA
// ============================================================

async function uploadFotosGaleria(
  event
) {

  const arquivos =
    Array.from(
      event.target.files || []
    );


  if (
    !arquivos.length
  ) {

    return;
  }


  const galleryId =
    currentGalleryId ||
    $('gallery-id')?.value;


  if (!galleryId) {

    flash(
      'Salve a galeria antes de adicionar fotografias.',
      'erro'
    );

    event.target.value = '';

    return;
  }


  const mensagem =
    $('gallery-upload-msg') ||
    $('gallery-msg');


  let enviadas = 0;
  let erros = 0;


  mostrarMensagem(
    mensagem,
    `Enviando ${arquivos.length} fotografia(s)...`
  );


  // ----------------------------------------------------------
  // Confirmar sessão
  // ----------------------------------------------------------

  const {
    data: sessionData
  } =
    await supabase.auth.getSession();


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
  // Buscar última ordem
  // ----------------------------------------------------------

  const {
    data: ultimaFoto
  } =
    await supabase
      .from('gallery_photos')
      .select(
        'sort_order'
      )
      .eq(
        'gallery_id',
        galleryId
      )
      .order(
        'sort_order',
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();


  let ordem =
    Number(
      ultimaFoto?.sort_order ?? -1
    ) + 1;


  // ----------------------------------------------------------
  // Upload individual
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < arquivos.length;
    i++
  ) {

    const arquivo =
      arquivos[i];

    let caminho =
      null;


    try {

      if (
        !arquivo.type.startsWith(
          'image/'
        )
      ) {

        throw new Error(
          'O arquivo não é uma imagem válida.'
        );
      }


      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );


      const identificador =
        `${Date.now()}-${crypto.randomUUID()}`;


      caminho =
        `${galleryId}/${identificador}-${nomeSeguro}`;


      mostrarMensagem(
        mensagem,
        `Enviando foto ${i + 1} de ${arquivos.length}...`
      );


      // ------------------------------------------------------
      // STORAGE
      // ------------------------------------------------------

      const {
        error: uploadError
      } =
        await supabase
          .storage
          .from(
            STORAGE_BUCKET_GALLERY
          )
          .upload(
            caminho,
            arquivo,
            {
              cacheControl: '31536000',
              upsert: false,
              contentType:
                arquivo.type ||
                'image/jpeg'
            }
          );


      if (uploadError) {

        throw new Error(
          `Storage: ${uploadError.message}`
        );
      }


      const publicUrl =
        obterUrlPublica(
          STORAGE_BUCKET_GALLERY,
          caminho
        );


      if (!publicUrl) {

        throw new Error(
          'Não foi possível obter a URL pública.'
        );
      }


      // ------------------------------------------------------
      // BANCO
      // ------------------------------------------------------

      const {
        error: insertError
      } =
        await supabase
          .from('gallery_photos')
          .insert({
            gallery_id:
              galleryId,

            image_url:
              publicUrl,

            sort_order:
              ordem,

            published:
              true
          });


      if (insertError) {

        // Rollback Storage

        await supabase
          .storage
          .from(
            STORAGE_BUCKET_GALLERY
          )
          .remove([
            caminho
          ]);


        throw new Error(
          `Banco: ${insertError.message}`
        );
      }


      ordem++;

      enviadas++;


    } catch (error) {

      erros++;

      console.error(
        'ADMIN V2: erro upload galeria:',
        error
      );

      mostrarMensagem(
        mensagem,
        `Erro em "${arquivo.name}": ${normalizarErro(error)}`,
        'erro'
      );
    }
  }


  event.target.value = '';


  if (erros === 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} fotografia(s) enviada(s) com sucesso.`,
      'sucesso'
    );

  } else if (enviadas > 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} enviada(s) e ${erros} com erro.`,
      'erro'
    );

  } else {

    mostrarMensagem(
      mensagem,
      'Nenhuma fotografia foi enviada.',
      'erro'
    );
  }


  await carregarFotosGaleria(
    galleryId
  );


  await carregarGalerias();

  await carregarDashboard();
}


// ============================================================
// DEFINIR FOTO COMO CAPA
// ============================================================

async function definirFotoComoCapa(
  fotoId
) {

  const {
    data: foto,
    error
  } =
    await supabase
      .from('gallery_photos')
      .select(
        'id,gallery_id,image_url'
      )
      .eq(
        'id',
        fotoId
      )
      .single();


  if (error) {

    flash(
      normalizarErro(error),
      'erro'
    );

    return;
  }


  const {
    error: updateError
  } =
    await supabase
      .from('galleries')
      .update({
        cover_url:
          foto.image_url
      })
      .eq(
        'id',
        foto.gallery_id
      );


  if (updateError) {

    flash(
      normalizarErro(updateError),
      'erro'
    );

    return;
  }


  flash(
    'Foto definida como capa.'
  );


  await carregarGalerias();

  await carregarFotosGaleria(
    foto.gallery_id
  );
}


// ============================================================
// EXCLUIR FOTO DA GALERIA
// ============================================================

async function excluirFotoGaleria(
  fotoId
) {

  const {
    data: foto,
    error: buscaError
  } =
    await supabase
      .from('gallery_photos')
      .select(`
        id,
        gallery_id,
        image_url
      `)
      .eq(
        'id',
        fotoId
      )
      .single();


  if (buscaError) {

    flash(
      normalizarErro(buscaError),
      'erro'
    );

    return;
  }


  if (
    !window.confirm(
      'Excluir esta fotografia da galeria?'
    )
  ) {

    return;
  }


  // ----------------------------------------------------------
  // Verificar se é capa
  // ----------------------------------------------------------

  const {
    data: galeria
  } =
    await supabase
      .from('galleries')
      .select(
        'id,cover_url'
      )
      .eq(
        'id',
        foto.gallery_id
      )
      .single();


  // ----------------------------------------------------------
  // Storage
  // ----------------------------------------------------------

  const caminho =
    obterCaminhoStorage(
      foto.image_url,
      STORAGE_BUCKET_GALLERY
    );


  if (caminho) {

    const {
      error: storageError
    } =
      await supabase
        .storage
        .from(
          STORAGE_BUCKET_GALLERY
        )
        .remove([
          caminho
        ]);


    if (storageError) {

      console.warn(
        'Erro remover arquivo Storage:',
        storageError
      );
    }
  }


  // ----------------------------------------------------------
  // Banco
  // ----------------------------------------------------------

  const {
    error: deleteError
  } =
    await supabase
      .from('gallery_photos')
      .delete()
      .eq(
        'id',
        fotoId
      );


  if (deleteError) {

    flash(
      normalizarErro(deleteError),
      'erro'
    );

    return;
  }


  // ----------------------------------------------------------
  // Se era capa, escolher outra
  // ----------------------------------------------------------

  if (
    galeria?.cover_url ===
    foto.image_url
  ) {

    const {
      data: novaCapa
    } =
      await supabase
        .from('gallery_photos')
        .select(
          'image_url'
        )
        .eq(
          'gallery_id',
          foto.gallery_id
        )
        .order(
          'sort_order',
          {
            ascending: true
          }
        )
        .limit(1)
        .maybeSingle();


    await supabase
      .from('galleries')
      .update({
        cover_url:
          novaCapa?.image_url ||
          null
      })
      .eq(
        'id',
        foto.gallery_id
      );
  }


  flash(
    'Fotografia excluída.'
  );


  await carregarFotosGaleria(
    foto.gallery_id
  );

  await carregarGalerias();

  await carregarDashboard();
}


// ============================================================
// MOVER FOTO
// ============================================================

async function moverFotoGaleria(
  fotoId,
  direcao
) {

  const {
    data: fotos,
    error
  } =
    await supabase
      .from('gallery_photos')
      .select(
        'id,gallery_id,sort_order'
      )
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

    flash(
      normalizarErro(error),
      'erro'
    );

    return;
  }


  const index =
    fotos.findIndex(
      foto =>
        foto.id ===
        fotoId
    );


  if (index === -1) return;


  const novoIndex =
    direcao === 'up'
      ? index - 1
      : index + 1;


  if (
    novoIndex < 0 ||
    novoIndex >= fotos.length
  ) {

    return;
  }


  const atual =
    fotos[index];

  const vizinha =
    fotos[novoIndex];


  const temporario =
    -999999 -
    Math.floor(
      Math.random() * 100000
    );


  let result =
    await supabase
      .from('gallery_photos')
      .update({
        sort_order:
          temporario
      })
      .eq(
        'id',
        atual.id
      );


  if (result.error) {

    flash(
      normalizarErro(
        result.error
      ),
      'erro'
    );

    return;
  }


  result =
    await supabase
      .from('gallery_photos')
      .update({
        sort_order:
          vizinha.sort_order
      })
      .eq(
        'id',
        vizinha.id
      );


  if (result.error) {

    flash(
      normalizarErro(
        result.error
      ),
      'erro'
    );

    return;
  }


  result =
    await supabase
      .from('gallery_photos')
      .update({
        sort_order:
          atual.sort_order
      })
      .eq(
        'id',
        atual.id
      );


  if (result.error) {

    flash(
      normalizarErro(
        result.error
      ),
      'erro'
    );

    return;
  }


  await carregarFotosGaleria(
    currentGalleryId
  );

  await carregarGalerias();
}


// ============================================================
// FECHAR MODAIS
// ============================================================

function fecharModalGaleria() {

  const modais = [
    'gallery-photos-modal',
    'photos-modal',
    'gallery-modal'
  ];


  modais.forEach(id => {

    const modal = $(id);

    if (!modal) return;

    modal.hidden = true;

    modal.style.display = 'none';
  });
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
      Carregando clientes...
    </p>
  `;


  const {
    data: ensaios,
    error
  } =
    await supabase
      .from('ensaios')
      .select('*')
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
        ${escaparHTML(
          error.message
        )}
      </p>
    `;

    return;
  }


  if (!ensaios?.length) {

    lista.innerHTML = `
      <div class="empty-state">
        <p>Nenhum cliente/ensaio cadastrado.</p>
      </div>
    `;

    return;
  }


  lista.innerHTML =
    ensaios.map(
      ensaio => {

        const titulo =
          ensaio.titulo ||
          ensaio.title ||
          'Ensaio sem título';


        const status =
          ensaio.status ||
          'ativo';


        return `

          <div
            class="client-card"
            data-client-card="${ensaio.id}"
          >

            <div class="client-card-head">

              <div class="client-card-info">

                <strong>
                  ${escaparHTML(
                    titulo
                  )}
                </strong>

                ${
                  ensaio.cliente
                    ? `
                      <p>
                        ${escaparHTML(
                          ensaio.cliente
                        )}
                      </p>
                    `
                    : ''
                }

                <p class="footer-mono">
                  ${escaparHTML(
                    ensaio.id
                  )}
                </p>

              </div>


              <div
                style="
                  margin-left:auto;
                  display:flex;
                  gap:6px;
                  flex-wrap:wrap;
                  justify-content:flex-end;
                "
              >

                <span class="client-status ${
                  status === 'entregue'
                    ? 'entregue'
                    : ''
                }">
                  ${escaparHTML(
                    status
                  )}
                </span>


                ${
                  status !== 'entregue'
                    ? `
                      <button
                        type="button"
                        class="small-btn"
                        data-entregar-ensaio="${ensaio.id}"
                      >
                        Marcar entregue
                      </button>
                    `
                    : ''
                }


                <button
                  type="button"
                  class="small-btn danger-btn"
                  data-delete-ensaio="${ensaio.id}"
                >
                  Excluir
                </button>

              </div>

            </div>

            <div
              id="client-msg-${ensaio.id}"
              class="msg"
            ></div>

          </div>

        `;
      }
    ).join('');


  document
    .querySelectorAll(
      '[data-entregar-ensaio]'
    )
    .forEach(btn => {

      const ensaio =
        ensaios.find(
          item =>
            item.id ===
            btn.dataset.entregarEnsaio
        );

      btn.addEventListener(
        'click',
        () => {

          if (ensaio) {

            marcarEntregue(
              ensaio
            );
          }
        }
      );
    });


  document
    .querySelectorAll(
      '[data-delete-ensaio]'
    )
    .forEach(btn => {

      const ensaio =
        ensaios.find(
          item =>
            item.id ===
            btn.dataset.deleteEnsaio
        );

      btn.addEventListener(
        'click',
        () => {

          if (ensaio) {

            excluirEnsaio(
              ensaio
            );
          }
        }
      );
    });
}


// ============================================================
// FORMULÁRIO CLIENTE
// ============================================================

function abrirFormularioCliente() {

  const modal =
    $('client-form-modal') ||
    $('client-modal');


  if (modal) {

    modal.hidden = false;

    modal.style.display = '';
  }


  $('client-name')?.focus();
}


function fecharFormularioCliente() {

  const modal =
    $('client-form-modal') ||
    $('client-modal');


  if (modal) {

    modal.hidden = true;

    modal.style.display = 'none';
  }


  if ($('client-form'))
    $('client-form').reset();

  if ($('client-id'))
    $('client-id').value = '';
}


// ============================================================
// CRIAR CLIENTE
// ============================================================

async function criarCliente(
  event
) {

  event.preventDefault();


  const mensagem =
    $('client-msg') ||
    $('client-form-msg');


  const titulo =
    $('client-title')?.value.trim() ||
    $('client-name')?.value.trim();


  const nome =
    $('client-name')?.value.trim();


  const login =
    $('client-login')?.value.trim();


  const senha =
    $('client-password')?.value;


  if (!titulo && !nome) {

    mostrarMensagem(
      mensagem,
      'Informe o nome do cliente/ensaio.',
      'erro'
    );

    return;
  }


  mostrarMensagem(
    mensagem,
    'Criando cliente...'
  );


  const payload = {};


  if ($('client-title'))
    payload.titulo =
      titulo || nome;


  if ($('client-name'))
    payload.cliente =
      nome || titulo;


  if ($('client-login'))
    payload.login =
      login || null;


  if ($('client-password'))
    payload.senha =
      senha || null;


  if ($('client-status'))
    payload.status =
      $('client-status').value ||
      'ativo';


  const {
    error
  } =
    await supabase
      .from('ensaios')
      .insert(payload);


  if (error) {

    console.error(
      'ADMIN V2: erro criar cliente:',
      error
    );

    mostrarMensagem(
      mensagem,
      normalizarErro(error),
      'erro'
    );

    return;
  }


  mostrarMensagem(
    mensagem,
    'Cliente criado com sucesso.',
    'sucesso'
  );


  flash(
    'Cliente criado.'
  );


  fecharFormularioCliente();

  await carregarClientes();

  await carregarDashboard();
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
  ) {

    return;
  }


  if (
    !window.confirm(
      `Marcar "${ensaio.titulo || ensaio.title}" como entregue?`
    )
  ) {

    return;
  }


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
      normalizarErro(error),
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

  await carregarDashboard();
}


// ============================================================
// EXCLUIR ENSAIO
// ============================================================

async function excluirEnsaio(
  ensaio
) {

  const titulo =
    ensaio.titulo ||
    ensaio.title ||
    'este ensaio';


  if (
    !window.confirm(
      `Excluir "${titulo}"?\n\n` +
      `Isso apagará o ensaio e todas as fotos associadas.`
    )
  ) {

    return;
  }


  const mensagem =
    $(`client-msg-${ensaio.id}`);


  mostrarMensagem(
    mensagem,
    'Excluindo...'
  );


  const {
    data: fotos,
    error: buscaError
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


  if (buscaError) {

    mostrarMensagem(
      mensagem,
      normalizarErro(buscaError),
      'erro'
    );

    return;
  }


  if (fotos?.length) {

    const caminhos =
      fotos
        .map(
          foto =>
            obterCaminhoStorage(
              foto.url,
              STORAGE_BUCKET_CLIENT
            )
        )
        .filter(Boolean);


    if (caminhos.length) {

      await supabase
        .storage
        .from(
          STORAGE_BUCKET_CLIENT
        )
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
      normalizarErro(
        fotosError
      ),
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
      normalizarErro(error),
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
// UPLOAD DE FOTOS DO ENSAIO
// ============================================================

async function uploadFotosCliente(
  event,
  ensaio,
  tipo = 'prova'
) {

  const arquivos =
    Array.from(
      event.target.files || []
    );


  if (!arquivos.length)
    return;


  const mensagem =
    document.getElementById(
      `msg-${ensaio.id}`
    );


  let enviadas = 0;
  let erros = 0;


  const {
    data: sessionData
  } =
    await supabase.auth.getSession();


  if (!sessionData?.session) {

    mostrarMensagem(
      mensagem,
      'Sua sessão expirou.',
      'erro'
    );

    event.target.value = '';

    return;
  }


  for (
    let i = 0;
    i < arquivos.length;
    i++
  ) {

    const arquivo =
      arquivos[i];

    let caminho =
      null;


    try {

      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );


      caminho =
        `${ensaio.id}/${tipo}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}`;


      mostrarMensagem(
        mensagem,
        `Enviando foto ${i + 1} de ${arquivos.length}...`
      );


      const {
        error: uploadError
      } =
      await supabase
        .storage
        .from(
          STORAGE_BUCKET_CLIENT
        )
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


      if (uploadError)
        throw uploadError;


      const publicUrl =
        obterUrlPublica(
          STORAGE_BUCKET_CLIENT,
          caminho
        );


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


      const {
        error: fotoError
      } =
        await supabase
          .from('fotos')
          .insert(
            registroFoto
          );


      if (fotoError) {

        await supabase
          .storage
          .from(
            STORAGE_BUCKET_CLIENT
          )
          .remove([
            caminho
          ]);

        throw fotoError;
      }


      enviadas++;


    } catch (error) {

      erros++;

      console.error(
        'Erro upload cliente:',
        error
      );
    }
  }


  event.target.value = '';


  if (erros === 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} foto(s) enviada(s) com sucesso.`,
      'sucesso'
    );

  } else {

    mostrarMensagem(
      mensagem,
      `${enviadas} enviada(s) e ${erros} com erro.`,
      'erro'
    );
  }


  await carregarClientes();

  await carregarDashboard();
}


// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {


  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  $('login-form')
    ?.addEventListener(
      'submit',
      fazerLogin
    );


  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  $('logout-btn')
    ?.addEventListener(
      'click',
      fazerLogout
    );


  // ----------------------------------------------------------
  // NAVEGAÇÃO
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // CLIENTE
  // ----------------------------------------------------------

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


  $('generate-client-login')
    ?.addEventListener(
      'click',
      () => {

        if ($('client-login')) {

          $('client-login').value =
            gerarLogin();
        }
      }
    );


  $('generate-client-password')
    ?.addEventListener(
      'click',
      () => {

        if ($('client-password')) {

          $('client-password').value =
            gerarSenha();
        }
      }
    );


  // ----------------------------------------------------------
  // GALERIA
  // ----------------------------------------------------------

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


  $('photo-upload')
    ?.addEventListener(
      'change',
      uploadFotosGaleria
    );


  // ----------------------------------------------------------
  // MODAIS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // CATEGORIAS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // AUTO SLUG
  // ----------------------------------------------------------

  $('category-name')
    ?.addEventListener(
      'input',
      () => {

        const slug =
          $('category-slug');

        if (!slug) return;

        if (
          !slug.dataset.manuallyEdited ||
          !slug.value
        ) {

          slug.value =
            slugify(
              $('category-name').value
            );
        }
      }
    );


  $('category-slug')
    ?.addEventListener(
      'input',
      event => {

        event.target.dataset.manuallyEdited =
          'true';
      }
    );


  $('gallery-title')
    ?.addEventListener(
      'input',
      () => {

        const slug =
          $('gallery-slug');

        if (!slug) return;

        if (
          !slug.dataset.manuallyEdited ||
          !slug.value
        ) {

          slug.value =
            slugify(
              $('gallery-title').value
            );
        }
      }
    );


  $('gallery-slug')
    ?.addEventListener(
      'input',
      event => {

        event.target.dataset.manuallyEdited =
          'true';
      }
    );
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function iniciarAdmin() {

  console.log(
    '========================================'
  );

  console.log(
    'ADMIN V2 — INICIALIZAÇÃO'
  );

  console.log(
    '========================================'
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
