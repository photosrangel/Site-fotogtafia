// ============================================================
// ADMIN V2 — RANGEL SANTOS FOTOGRAFIA
// CMS + ÁREA DE CLIENTES
// ============================================================

import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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


// ============================================================
// ESTADO
// ============================================================

let currentUser = null;
let currentGallery = null;
let openClientDetail = null;


// ============================================================
// UTILITÁRIOS
// ============================================================

function el(id) {
  return document.getElementById(id);
}


function msg(element, text, type = '') {

  if (!element) return;

  element.textContent = text;

  element.className =
    type
      ? `msg ${type}`
      : 'msg';
}


function escapeHTML(value) {

  const div =
    document.createElement('div');

  div.textContent =
    value ?? '';

  return div.innerHTML;
}


function slugify(text) {

  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


function safeFileName(name) {

  return String(name || 'foto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}


function randomLogin() {

  return (
    'cliente-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );

}


function randomPassword() {

  return Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

}


// ============================================================
// LOGIN
// ============================================================

async function login(event) {

  event.preventDefault();

  const message =
    el('login-msg');

  msg(
    message,
    'Entrando...'
  );

  const email =
    el('login-email')
      ?.value
      .trim();

  const password =
    el('login-password')
      ?.value;

  if (!email || !password) {

    msg(
      message,
      'Preencha o e-mail e a senha.',
      'erro'
    );

    return;

  }


  const {
    data,
    error
  } =
    await supabase.auth.signInWithPassword({

      email,

      password

    });


  if (error) {

    console.error(
      'Erro no login:',
      error
    );

    msg(
      message,
      'E-mail ou senha incorretos.',
      'erro'
    );

    return;

  }


  currentUser =
    data.user;

  await showApp();

}


// ============================================================
// VERIFICAR SESSÃO
// ============================================================

async function checkSession() {

  const {
    data,
    error
  } =
    await supabase.auth.getSession();


  if (error) {

    console.error(
      'Erro ao verificar sessão:',
      error
    );

    return;

  }


  if (data?.session) {

    currentUser =
      data.session.user;

    await showApp();

  }

}


// ============================================================
// MOSTRAR PAINEL
// ============================================================

async function showApp() {

  el('login-screen').style.display =
    'none';

  el('app').hidden =
    false;


  if (currentUser?.email) {

    el('user-email').textContent =
      currentUser.email;

  }


  showView('dashboard');

  await loadDashboard();

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

  await supabase.auth.signOut();

  window.location.reload();

}


// ============================================================
// NAVEGAÇÃO
// ============================================================

function showView(view) {

  document
    .querySelectorAll('.admin-view')
    .forEach(section => {

      section.hidden =
        section.id !== `view-${view}`;

    });


  document
    .querySelectorAll('.sidebar-link[data-view]')
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.view === view
      );

    });


  const titles = {

    dashboard: [
      'Painel',
      'Dashboard'
    ],

    galleries: [
      'Conteúdo',
      'Galerias'
    ],

    clients: [
      'Clientes',
      'Clientes / Ensaios'
    ],

    categories: [
      'Organização',
      'Categorias'
    ],

    settings: [
      'Site',
      'Configurações'
    ]

  };


  const title =
    titles[view] ||
    titles.dashboard;


  el('view-eyebrow').textContent =
    title[0];

  el('view-title').textContent =
    title[1];


  if (view === 'galleries') {

    loadCategoriesForGallery();

    loadGalleries();

  }


  if (view === 'clients') {

    loadClients();

  }


  if (view === 'categories') {

    loadCategories();

  }


  if (view === 'dashboard') {

    loadDashboard();

  }

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

  const [
    galleriesResult,
    clientsResult,
    categoriesResult,
    photosResult
  ] =
    await Promise.all([

      supabase
        .from('galleries')
        .select('id,published', {
          count: 'exact'
        }),

      supabase
        .from('ensaios')
        .select('id', {
          count: 'exact'
        }),

      supabase
        .from('categories')
        .select('id', {
          count: 'exact'
        }),

      supabase
        .from('gallery_photos')
        .select('id', {
          count: 'exact'
        })

    ]);


  if (galleriesResult.error) {

    console.error(
      galleriesResult.error
    );

  }


  const galleries =
    galleriesResult.data || [];


  el('stat-galleries').textContent =
    galleriesResult.count ??
    galleries.length;


  el('stat-published').textContent =
    galleries.filter(
      item => item.published
    ).length;


  el('stat-clients').textContent =
    clientsResult.count ?? 0;


  el('stat-photos').textContent =
    photosResult.count ?? 0;


  el('stat-categories').textContent =
    categoriesResult.count ?? 0;

}


// ============================================================
// CATEGORIAS
// ============================================================

async function loadCategories() {

  const list =
    el('categories-list');

  if (!list) return;


  list.innerHTML =
    '<p class="msg">Carregando...</p>';


  const {
    data,
    error
  } =
    await supabase
      .from('categories')
      .select('*')
      .order(
        'sort_order',
        {
          ascending: true
        }
      );


  if (error) {

    list.innerHTML =
      `<p class="msg erro">
        ${escapeHTML(error.message)}
      </p>`;

    return;

  }


  if (!data?.length) {

    list.innerHTML =
      '<p class="msg">Nenhuma categoria cadastrada.</p>';

    return;

  }


  list.innerHTML =
    data
      .map(category => `

        <div
          class="category-item"
          style="
            display:flex;
            justify-content:space-between;
            gap:15px;
            align-items:center;
            padding:15px 0;
            border-bottom:1px solid var(--hairline);
          "
        >

          <div>

            <strong>
              ${escapeHTML(category.name)}
            </strong>

            <p class="footer-mono">
              ${escapeHTML(category.slug)}
            </p>

          </div>


          <div
            style="
              display:flex;
              gap:8px;
              flex-wrap:wrap;
            "
          >

            <button
              class="small-btn"
              data-edit-category="${category.id}"
            >
              Editar
            </button>

            <button
              class="small-btn"
              data-delete-category="${category.id}"
            >
              Excluir
            </button>

          </div>

        </div>

      `)
      .join('');


  list
    .querySelectorAll('[data-edit-category]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          editCategory(
            data.find(
              item =>
                item.id ===
                button.dataset.editCategory
            )
          )
      );

    });


  list
    .querySelectorAll('[data-delete-category]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          deleteCategory(
            button.dataset.deleteCategory
          )
      );

    });

}


async function loadCategoriesForGallery() {

  const select =
    el('gallery-category');

  if (!select) return;


  const {
    data,
    error
  } =
    await supabase
      .from('categories')
      .select(
        'id,name'
      )
      .eq(
        'published',
        true
      )
      .order(
        'sort_order'
      );


  if (error) {

    console.error(
      error
    );

    return;

  }


  select.innerHTML =
    '<option value="">Sem categoria</option>';


  (data || [])
    .forEach(category => {

      const option =
        document.createElement('option');

      option.value =
        category.id;

      option.textContent =
        category.name;

      select.appendChild(
        option
      );

    });

}


async function saveCategory(event) {

  event.preventDefault();


  const id =
    el('category-id').value;


  const payload = {

    name:
      el('category-name').value.trim(),

    slug:
      slugify(
        el('category-slug').value
      ),

    description:
      el('category-description').value.trim() ||
      null,

    sort_order:
      Number(
        el('category-order').value || 0
      )

  };


  const operation =
    id
      ? supabase
          .from('categories')
          .update(payload)
          .eq('id', id)

      : supabase
          .from('categories')
          .insert(payload);


  const {
    error
  } =
    await operation;


  if (error) {

    msg(
      el('category-msg'),
      error.message,
      'erro'
    );

    return;

  }


  msg(
    el('category-msg'),
    'Categoria salva.',
    'sucesso'
  );


  resetCategoryForm();

  await loadCategories();

  await loadCategoriesForGallery();

}


function editCategory(category) {

  if (!category) return;

  el('category-id').value =
    category.id;

  el('category-name').value =
    category.name;

  el('category-slug').value =
    category.slug;

  el('category-description').value =
    category.description || '';

  el('category-order').value =
    category.sort_order || 0;

  el('cancel-category').hidden =
    false;

}


function resetCategoryForm() {

  el('category-form').reset();

  el('category-id').value =
    '';

  el('category-order').value =
    0;

  el('cancel-category').hidden =
    true;

}


async function deleteCategory(id) {

  if (
    !confirm(
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

    alert(
      'Erro ao excluir: ' +
      error.message
    );

    return;

  }


  await loadCategories();

  await loadCategoriesForGallery();

}


// ============================================================
// GALERIAS
// ============================================================

async function loadGalleries() {

  const list =
    el('galleries-list');

  if (!list) return;


  list.innerHTML =
    '<p class="msg">Carregando galerias...</p>';


  const {
    data,
    error
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
      );


  if (error) {

    list.innerHTML =
      `<p class="msg erro">
        ${escapeHTML(error.message)}
      </p>`;

    return;

  }


  if (!data?.length) {

    list.innerHTML =
      `
        <div class="empty-state">
          <p class="msg">
            Nenhuma galeria criada ainda.
          </p>
        </div>
      `;

    return;

  }


  list.innerHTML =
    data
      .map(gallery => `

        <article
          class="panel"
          style="margin-bottom:15px;"
        >

          <div class="panel-head">

            <div>

              <p class="section-eyebrow">
                ${gallery.published ? 'Publicada' : 'Rascunho'}
              </p>

              <h2>
                ${escapeHTML(gallery.title)}
              </h2>

              <p class="footer-mono">
                /${escapeHTML(gallery.slug)}
              </p>

            </div>


            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
              "
            >

              <button
                class="small-btn"
                data-gallery-photos="${gallery.id}"
              >
                Fotos
              </button>

              <button
                class="small-btn"
                data-gallery-edit="${gallery.id}"
              >
                Editar
              </button>

              <button
                class="small-btn"
                data-gallery-publish="${gallery.id}"
              >
                ${gallery.published ? 'Despublicar' : 'Publicar'}
              </button>

              <button
                class="small-btn"
                data-gallery-delete="${gallery.id}"
              >
                Excluir
              </button>

            </div>

          </div>

        </article>

      `)
      .join('');


  list
    .querySelectorAll('[data-gallery-photos]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          openGalleryPhotos(
            data.find(
              item =>
                item.id ===
                button.dataset.galleryPhotos
            )
          )
      );

    });


  list
    .querySelectorAll('[data-gallery-edit]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          editGallery(
            data.find(
              item =>
                item.id ===
                button.dataset.galleryEdit
            )
          )
      );

    });


  list
    .querySelectorAll('[data-gallery-publish]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          toggleGalleryPublished(
            data.find(
              item =>
                item.id ===
                button.dataset.galleryPublish
            )
          )
      );

    });


  list
    .querySelectorAll('[data-gallery-delete]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          deleteGallery(
            button.dataset.galleryDelete
          )
      );

    });

}


function openGalleryForm() {

  el('gallery-form-wrap').hidden =
    false;

  el('gallery-form-title').textContent =
    'Nova galeria';

  el('gallery-form').reset();

  el('gallery-id').value =
    '';

  el('gallery-order').value =
    0;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

}


function closeGalleryForm() {

  el('gallery-form-wrap').hidden =
    true;

}


function editGallery(gallery) {

  el('gallery-form-wrap').hidden =
    false;

  el('gallery-form-title').textContent =
    'Editar galeria';

  el('gallery-id').value =
    gallery.id;

  el('gallery-title').value =
    gallery.title;

  el('gallery-slug').value =
    gallery.slug;

  el('gallery-category').value =
    gallery.category_id || '';

  el('gallery-order').value =
    gallery.sort_order || 0;

  el('gallery-description').value =
    gallery.description || '';

  el('gallery-cover').value =
    gallery.cover_url || '';

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

}


async function saveGallery(event) {

  event.preventDefault();


  const id =
    el('gallery-id').value;


  const payload = {

    title:
      el('gallery-title')
        .value
        .trim(),

    slug:
      slugify(
        el('gallery-slug').value
      ),

    description:
      el('gallery-description')
        .value
        .trim() ||
      null,

    category_id:
      el('gallery-category').value ||
      null,

    cover_url:
      el('gallery-cover')
        .value
        .trim() ||
      null,

    sort_order:
      Number(
        el('gallery-order').value || 0
      )

  };


  if (!payload.title) {

    msg(
      el('gallery-form-msg'),
      'Digite o título.',
      'erro'
    );

    return;

  }


  const operation =
    id

      ? supabase
          .from('galleries')
          .update(payload)
          .eq('id', id)

      : supabase
          .from('galleries')
          .insert(payload);


  const {
    error
  } =
    await operation;


  if (error) {

    msg(
      el('gallery-form-msg'),
      error.message,
      'erro'
    );

    return;

  }


  msg(
    el('gallery-form-msg'),
    'Galeria salva.',
    'sucesso'
  );


  closeGalleryForm();

  await loadGalleries();

  await loadDashboard();

}


async function toggleGalleryPublished(gallery) {

  const {
    error
  } =
    await supabase
      .from('galleries')
      .update({
        published:
          !gallery.published
      })
      .eq(
        'id',
        gallery.id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await loadGalleries();

  await loadDashboard();

}


async function deleteGallery(id) {

  if (
    !confirm(
      'Excluir esta galeria e todas as suas fotos?'
    )
  ) return;


  const {
    error: photosError
  } =
    await supabase
      .from('gallery_photos')
      .delete()
      .eq(
        'gallery_id',
        id
      );


  if (photosError) {

    alert(
      'Erro ao excluir fotos: ' +
      photosError.message
    );

    return;

  }


  const {
    error
  } =
    await supabase
      .from('galleries')
      .delete()
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      'Erro ao excluir galeria: ' +
      error.message
    );

    return;

  }


  await loadGalleries();

  await loadDashboard();

}


// ============================================================
// FOTOS DAS GALERIAS PÚBLICAS
// ============================================================

async function openGalleryPhotos(gallery) {

  currentGallery =
    gallery;


  el('modal-gallery-title')
    .textContent =
      gallery.title;


  el('gallery-editor-modal')
    .hidden =
      false;


  await loadGalleryPhotos();

}


function closeGalleryModal() {

  el('gallery-editor-modal')
    .hidden =
      true;

  currentGallery =
    null;

}


async function loadGalleryPhotos() {

  if (!currentGallery) return;


  const grid =
    el('photo-grid');


  grid.innerHTML =
    '<p class="msg">Carregando fotos...</p>';


  const {
    data,
    error
  } =
    await supabase
      .from('gallery_photos')
      .select('*')
      .eq(
        'gallery_id',
        currentGallery.id
      )
      .order(
        'sort_order',
        {
          ascending: true
        }
      );


  if (error) {

    grid.innerHTML =
      `<p class="msg erro">
        ${escapeHTML(error.message)}
      </p>`;

    return;

  }


  const photos =
    data || [];


  el('photo-count')
    .textContent =
      `${photos.length} fotografia(s)`;


  if (!photos.length) {

    grid.innerHTML =
      '<p class="msg">Nenhuma foto nesta galeria.</p>';

    return;

  }


  grid.innerHTML =
    photos
      .map(photo => `

        <div
          class="admin-photo ${
            currentGallery.cover_url === photo.image_url
              ? 'cover'
              : ''
          }"
          data-photo-id="${photo.id}"
        >

          <img
            src="${escapeHTML(photo.image_url)}"
            alt="${escapeHTML(photo.alt_text || '')}"
            loading="lazy"
          >

          ${
            currentGallery.cover_url === photo.image_url
              ? `
                <span class="admin-photo-cover">
                  CAPA
                </span>
              `
              : ''
          }


          <button
            class="admin-photo-delete"
            type="button"
            data-delete-photo="${photo.id}"
          >
            ×
          </button>

        </div>

      `)
      .join('');


  grid
    .querySelectorAll('[data-photo-id]')
    .forEach(item => {

      item.addEventListener(
        'click',
        event => {

          if (
            event.target.closest(
              '[data-delete-photo]'
            )
          ) return;

          setGalleryCover(
            item.dataset.photoId,
            photos
          );

        }
      );

    });


  grid
    .querySelectorAll('[data-delete-photo]')
    .forEach(button => {

      button.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          deleteGalleryPhoto(
            button.dataset.deletePhoto
          );

        }
      );

    });

}


async function uploadGalleryPhotos(event) {

  if (!currentGallery) return;


  const files =
    Array.from(
      event.target.files || []
    );


  if (!files.length) return;


  msg(
    el('upload-msg'),
    `Enviando ${files.length} foto(s)...`
  );


  let uploaded =
    0;

  let errors =
    0;


  for (const file of files) {

    try {

      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}-${safeFileName(file.name)}`;


      const path =
        `galerias/${currentGallery.id}/${fileName}`;


      const {
        error: uploadError
      } =
        await supabase
          .storage
          .from('fotos')
          .upload(
            path,
            file,
            {
              upsert: false
            }
          );


      if (uploadError) {

        console.error(
          uploadError
        );

        errors++;

        continue;

      }


      const {
        data: urlData
      } =
        supabase
          .storage
          .from('fotos')
          .getPublicUrl(path);


      const {
        error: insertError
      } =
        await supabase
          .from('gallery_photos')
          .insert({

            gallery_id:
              currentGallery.id,

            image_url:
              urlData.publicUrl,

            alt_text:
              currentGallery.title,

            sort_order:
              uploaded,

            published:
              true

          });


      if (insertError) {

        console.error(
          insertError
        );

        errors++;

        continue;

      }


      uploaded++;

    } catch (error) {

      console.error(
        error
      );

      errors++;

    }

  }


  event.target.value =
    '';


  msg(
    el('upload-msg'),
    errors
      ? `${uploaded} enviada(s), ${errors} com erro.`
      : `${uploaded} foto(s) enviada(s) com sucesso!`,
    errors ? 'erro' : 'sucesso'
  );


  await loadGalleryPhotos();

  await loadDashboard();

}


async function setGalleryCover(
  photoId,
  photos
) {

  const photo =
    photos.find(
      item =>
        item.id === photoId
    );


  if (!photo) return;


  const {
    error
  } =
    await supabase
      .from('galleries')
      .update({
        cover_url:
          photo.image_url
      })
      .eq(
        'id',
        currentGallery.id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  currentGallery.cover_url =
    photo.image_url;


  await loadGalleryPhotos();

}


async function deleteGalleryPhoto(id) {

  if (
    !confirm(
      'Excluir esta fotografia?'
    )
  ) return;


  const {
    data: photo,
    error: findError
  } =
    await supabase
      .from('gallery_photos')
      .select('*')
      .eq(
        'id',
        id
      )
      .single();


  if (findError) {

    alert(
      findError.message
    );

    return;

  }


  const {
    error
  } =
    await supabase
      .from('gallery_photos')
      .delete()
      .eq(
        'id',
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  if (
    currentGallery.cover_url ===
    photo.image_url
  ) {

    await supabase
      .from('galleries')
      .update({
        cover_url:
          null
      })
      .eq(
        'id',
        currentGallery.id
      );

    currentGallery.cover_url =
      null;

  }


  await loadGalleryPhotos();

}


// ============================================================
// CLIENTES / ENSAIOS
// ============================================================

async function loadClients() {

  const list =
    el('clients-list');

  if (!list) return;


  list.innerHTML =
    '<p class="msg">Carregando ensaios...</p>';


  const {
    data,
    error
  } =
    await supabase
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

    list.innerHTML =
      `<p class="msg erro">
        ${escapeHTML(error.message)}
      </p>`;

    return;

  }


  if (!data?.length) {

    list.innerHTML =
      `
        <div class="empty-state">

          <p class="msg">
            Nenhum ensaio cadastrado ainda.
          </p>

        </div>
      `;

    return;

  }


  list.innerHTML =
    data
      .map(clientCardHTML)
      .join('');


  data.forEach(ensaio => {

    const header =
      document.getElementById(
        `client-head-${ensaio.id}`
      );


    if (header) {

      header.addEventListener(
        'click',
        () =>
          toggleClientDetail(
            ensaio
          )
      );

    }

  });

}


function clientCardHTML(ensaio) {

  const status =
    normalizeClientStatus(
      ensaio.status
    );


  return `

    <article class="client-card">

      <div
        class="client-card-head"
        id="client-head-${ensaio.id}"
      >

        <div class="client-card-info">

          <strong>
            ${escapeHTML(ensaio.titulo)}
          </strong>

          <p class="footer-mono">
            ${escapeHTML(
              ensaio.cliente_nome || ''
            )}
          </p>

        </div>


        <span
          class="client-status ${status}"
        >
          ${clientStatusLabel(status)}
        </span>

      </div>


      <div
        class="client-detail"
        id="client-detail-${ensaio.id}"
      ></div>

    </article>

  `;

}


function normalizeClientStatus(status) {

  if (
    status === 'entregue'
  ) return 'entregue';


  if (
    status === 'selecionado'
  ) return 'selecionado';


  if (
    status === 'aguardando' ||
    status === 'aguardando_selecao'
  ) {

    return 'aguardando_selecao';

  }


  return 'aguardando_selecao';

}


function clientStatusLabel(status) {

  if (
    status === 'entregue'
  ) {

    return 'Entregue';

  }


  if (
    status === 'selecionado'
  ) {

    return 'Cliente escolheu';

  }


  return 'Aguardando seleção';

}


// ============================================================
// DETALHES DO CLIENTE
// ============================================================

async function toggleClientDetail(ensaio) {

  const detail =
    el(
      `client-detail-${ensaio.id}`
    );


  if (!detail) return;


  const wasOpen =
    detail.classList.contains(
      'is-open'
    );


  if (
    openClientDetail &&
    openClientDetail !== detail
  ) {

    openClientDetail.classList.remove(
      'is-open'
    );

  }


  if (wasOpen) {

    detail.classList.remove(
      'is-open'
    );

    openClientDetail =
      null;

    return;

  }


  detail.classList.add(
    'is-open'
  );

  openClientDetail =
    detail;


  detail.innerHTML =
    '<p class="msg">Carregando...</p>';


  const {
    data: photos,
    error
  } =
    await supabase
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

    detail.innerHTML =
      `<p class="msg erro">
        ${escapeHTML(error.message)}
      </p>`;

    return;

  }


  const provas =
    (photos || [])
      .filter(
        photo =>
          photo.tipo === 'prova'
      );


  const finais =
    (photos || [])
      .filter(
        photo =>
          photo.tipo === 'final'
      );


  const selecionadas =
    provas.filter(
      photo =>
        photo.selecionada === true
    );


  detail.innerHTML =
    clientDetailHTML(
      ensaio,
      provas,
      finais,
      selecionadas
    );


  configureClientDetail(
    ensaio
  );

}


function clientDetailHTML(
  ensaio,
  provas,
  finais,
  selecionadas
) {

  const link =
    `${location.origin}/area-cliente`;


  return `

    <p class="footer-mono">
      Dados de acesso da cliente
    </p>


    <div class="client-access-grid">

      <div class="client-access-item">

        <label>
          Área do Cliente
        </label>

        <div class="client-access-value">
          ${escapeHTML(link)}
        </div>

      </div>


      <div class="client-access-item">

        <label>
          Login
        </label>

        <div class="client-access-value">
          ${escapeHTML(ensaio.slug)}
        </div>

      </div>


      <div class="client-access-item">

        <label>
          Senha
        </label>

        <div class="client-access-value">
          ${escapeHTML(ensaio.codigo_acesso)}
        </div>

      </div>

    </div>


    <button
      type="button"
      class="small-btn"
      id="copy-client-${ensaio.id}"
    >
      Copiar dados de acesso
    </button>


    <!-- PROVAS -->

    <div class="client-photo-section">

      <p class="footer-mono">

        Fotos para a cliente escolher —
        ${provas.length}
        enviadas,
        ${selecionadas.length}
        selecionadas

      </p>


      <div class="client-upload">

        <input
          type="file"
          id="upload-proof-${ensaio.id}"
          multiple
          accept="image/jpeg,image/png,image/webp"
        >

        <p class="footer-mono">
          Selecione uma ou várias fotografias.
        </p>

      </div>


      <div
        class="client-photo-grid"
        id="proof-grid-${ensaio.id}"
      >

        ${
          provas.length
            ? provas
                .map(clientPhotoHTML)
                .join('')
            : `
              <p class="msg">
                Nenhuma prova enviada ainda.
              </p>
            `
        }

      </div>

    </div>


    <!-- FINAIS -->

    <div class="client-photo-section">

      <p class="footer-mono">

        Fotos finais —
        ${finais.length}
        enviadas

      </p>


      <div class="client-upload">

        <input
          type="file"
          id="upload-final-${ensaio.id}"
          multiple
          accept="image/jpeg,image/png,image/webp"
        >

        <p class="footer-mono">
          Fotografias finais para entrega.
        </p>

      </div>


      <div
        class="client-photo-grid"
        id="final-grid-${ensaio.id}"
      >

        ${
          finais.length
            ? finais
                .map(clientPhotoHTML)
                .join('')
            : `
              <p class="msg">
                Nenhuma foto final enviada ainda.
              </p>
            `
        }

      </div>

    </div>


    <!-- AÇÕES -->

    <div class="client-actions">

      <button
        type="button"
        class="btn ${
          ensaio.status === 'entregue'
            ? ''
            : 'btn-accent'
        }"
        id="deliver-${ensaio.id}"
        ${
          ensaio.status === 'entregue'
            ? 'disabled'
            : ''
        }
      >

        ${
          ensaio.status === 'entregue'
            ? 'Já entregue ✓'
            : 'Marcar como entregue'
        }

      </button>


      <button
        type="button"
        class="btn danger-btn"
        id="delete-client-${ensaio.id}"
      >
        Excluir permanentemente
      </button>

    </div>


    <p
      class="msg"
      id="client-msg-${ensaio.id}"
    ></p>

  `;

}


function clientPhotoHTML(photo) {

  return `

    <div
      class="client-photo ${
        photo.selecionada
          ? 'selected'
          : ''
      }"
    >

      <img
        src="${escapeHTML(photo.url)}"
        alt="Fotografia"
        loading="lazy"
      >

      <span class="client-photo-type">
        ${escapeHTML(photo.tipo)}
      </span>

    </div>

  `;

}


// ============================================================
// CONFIGURAR DETALHES CLIENTE
// ============================================================

function configureClientDetail(
  ensaio
) {

  const proofUpload =
    el(
      `upload-proof-${ensaio.id}`
    );


  const finalUpload =
    el(
      `upload-final-${ensaio.id}`
    );


  const copyButton =
    el(
      `copy-client-${ensaio.id}`
    );


  const deliverButton =
    el(
      `deliver-${ensaio.id}`
    );


  const deleteButton =
    el(
      `delete-client-${ensaio.id}`
    );


  if (proofUpload) {

    proofUpload.addEventListener(
      'change',
      event =>
        uploadClientPhotos(
          event,
          ensaio,
          'prova'
        )
    );

  }


  if (finalUpload) {

    finalUpload.addEventListener(
      'change',
      event =>
        uploadClientPhotos(
          event,
          ensaio,
          'final'
        )
    );

  }


  if (copyButton) {

    copyButton.addEventListener(
      'click',
      () =>
        copyClientAccess(
          ensaio,
          copyButton
        )
    );

  }


  if (deliverButton) {

    deliverButton.addEventListener(
      'click',
      () =>
        deliverClient(
          ensaio
        )
    );

  }


  if (deleteButton) {

    deleteButton.addEventListener(
      'click',
      () =>
        deleteClient(
          ensaio
        )
    );

  }

}


// ============================================================
// CRIAR ENSAIO
// ============================================================

async function saveClient(event) {

  event.preventDefault();


  const message =
    el('client-form-msg');


  const titulo =
    el('client-title')
      .value
      .trim();


  const clienteNome =
    el('client-name')
      .value
      .trim();


  const categoria =
    el('client-category')
      .value;


  const login =
    slugify(
      el('client-login')
        .value
    );


  const password =
    el('client-password')
      .value
      .trim();


  if (!titulo) {

    msg(
      message,
      'Digite o título do ensaio.',
      'erro'
    );

    return;

  }


  if (!login) {

    msg(
      message,
      'Digite um login válido.',
      'erro'
    );

    return;

  }


  if (!password) {

    msg(
      message,
      'Digite uma senha.',
      'erro'
    );

    return;

  }


  msg(
    message,
    'Criando ensaio...'
  );


  const {
    error
  } =
    await supabase
      .from('ensaios')
      .insert({

        slug:
          login,

        titulo:
          titulo,

        cliente_nome:
          clienteNome ||
          null,

        codigo_acesso:
          password,

        categoria:
          categoria ||
          null,

        status:
          'aguardando_selecao'

      });


  if (error) {

    console.error(
      error
    );


    if (
      error.message
        ?.toLowerCase()
        .includes('duplicate')
      ||
      error.message
        ?.toLowerCase()
        .includes('unique')
    ) {

      msg(
        message,
        `O login "${login}" já está em uso.`,
        'erro'
      );

    } else {

      msg(
        message,
        'Erro ao criar ensaio: ' +
        error.message,
        'erro'
      );

    }

    return;

  }


  msg(
    message,
    'Ensaio criado com sucesso!',
    'sucesso'
  );


  el('client-form').reset();

  el('client-form-wrap').hidden =
    true;


  await loadClients();

  await loadDashboard();

}


// ============================================================
// UPLOAD CLIENTE
// ============================================================

async function uploadClientPhotos(
  event,
  ensaio,
  tipo
) {

  const files =
    Array.from(
      event.target.files || []
    );


  if (!files.length) return;


  const message =
    el(
      `client-msg-${ensaio.id}`
    );


  msg(
    message,
    `Enviando ${files.length} foto(s)...`
  );


  let success =
    0;

  let errors =
    0;


  for (const file of files) {

    try {

      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}-${safeFileName(file.name)}`;


      const path =
        `${ensaio.id}/${tipo}/${fileName}`;


      const {
        error: uploadError
      } =
        await supabase
          .storage
          .from('fotos')
          .upload(
            path,
            file,
            {
              upsert: false
            }
          );


      if (uploadError) {

        console.error(
          uploadError
        );

        errors++;

        continue;

      }


      const {
        data: urlData
      } =
        supabase
          .storage
          .from('fotos')
          .getPublicUrl(
            path
          );


      if (
        !urlData?.publicUrl
      ) {

        errors++;

        continue;

      }


      const {
        error: insertError
      } =
        await supabase
          .from('fotos')
          .insert({

            ensaio_id:
              ensaio.id,

            url:
              urlData.publicUrl,

            tipo:
              tipo,

            selecionada:
              false,

            ordem:
              Date.now()

          });


      if (insertError) {

        console.error(
          insertError
        );

        errors++;

        continue;

      }


      success++;


      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            5
          )
      );

    } catch (error) {

      console.error(
        error
      );

      errors++;

    }

  }


  event.target.value =
    '';


  msg(
    message,
    errors
      ? `${success} enviada(s), ${errors} com erro.`
      : `${success} foto(s) enviada(s) com sucesso!`,
    errors
      ? 'erro'
      : 'sucesso'
  );


  await loadClients();

}


// ============================================================
// COPIAR ACESSO
// ============================================================

async function copyClientAccess(
  ensaio,
  button
) {

  const text =
`Acesse em: ${location.origin}/area-cliente
Login: ${ensaio.slug}
Senha: ${ensaio.codigo_acesso}`;


  try {

    await navigator.clipboard.writeText(
      text
    );


    const original =
      button.textContent;


    button.textContent =
      'Copiado!';


    setTimeout(
      () => {

        button.textContent =
          original;

      },
      2000
    );

  } catch (error) {

    console.error(
      error
    );

  }

}


// ============================================================
// ENTREGAR
// ============================================================

async function deliverClient(
  ensaio
) {

  if (
    ensaio.status ===
    'entregue'
  ) {

    return;

  }


  if (
    !confirm(
      `Marcar "${ensaio.titulo}" como entregue?`
    )
  ) {

    return;

  }


  const message =
    el(
      `client-msg-${ensaio.id}`
    );


  msg(
    message,
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

    msg(
      message,
      error.message,
      'erro'
    );

    return;

  }


  msg(
    message,
    'Ensaio marcado como entregue.',
    'sucesso'
  );


  await loadClients();

}


// ============================================================
// APAGAR STORAGE DO CLIENTE
// ============================================================

async function deleteClientStorage(
  ensaioId
) {

  for (
    const type
    of ['prova', 'final']
  ) {

    const folder =
      `${ensaioId}/${type}`;


    const {
      data: files,
      error
    } =
      await supabase
        .storage
        .from('fotos')
        .list(
          folder,
          {
            limit: 1000
          }
        );


    if (error) {

      console.error(
        error
      );

      continue;

    }


    if (
      !files?.length
    ) {

      continue;

    }


    const paths =
      files
        .filter(
          file =>
            file.name
        )
        .map(
          file =>
            `${folder}/${file.name}`
        );


    if (!paths.length) continue;


    const {
      error: removeError
    } =
      await supabase
        .storage
        .from('fotos')
        .remove(
          paths
        );


    if (removeError) {

      console.error(
        removeError
      );

    }

  }

}


// ============================================================
// EXCLUIR CLIENTE
// ============================================================

async function deleteClient(
  ensaio
) {

  const confirmDelete =
    confirm(
      `Tem certeza que deseja excluir "${ensaio.titulo}"?\n\n` +
      `Isso apagará o ensaio, as provas e as fotos finais.\n\n` +
      `Esta ação não pode ser desfeita.`
    );


  if (!confirmDelete) return;


  const message =
    el(
      `client-msg-${ensaio.id}`
    );


  msg(
    message,
    'Excluindo ensaio...'
  );


  // STORAGE

  await deleteClientStorage(
    ensaio.id
  );


  // FOTOS

  const {
    error: photosError
  } =
    await supabase
      .from('fotos')
      .delete()
      .eq(
        'ensaio_id',
        ensaio.id
      );


  if (photosError) {

    msg(
      message,
      'Erro ao apagar fotos: ' +
      photosError.message,
      'erro'
    );

    return;

  }


  // ENSAIO

  const {
    error: ensaioError
  } =
    await supabase
      .from('ensaios')
      .delete()
      .eq(
        'id',
        ensaio.id
      );


  if (ensaioError) {

    msg(
      message,
      'Erro ao apagar ensaio: ' +
      ensaioError.message,
      'erro'
    );

    return;

  }


  await loadClients();

  await loadDashboard();

}


// ============================================================
// FORMULÁRIOS
// ============================================================

function openClientForm() {

  el('client-form-wrap').hidden =
    false;

  el('client-form').reset();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

}


function closeClientForm() {

  el('client-form-wrap').hidden =
    true;

}


function configureForms() {

  // GALERIA

  el('new-gallery-btn')
    ?.addEventListener(
      'click',
      openGalleryForm
    );


  el('close-gallery-form')
    ?.addEventListener(
      'click',
      closeGalleryForm
    );


  el('cancel-gallery-form')
    ?.addEventListener(
      'click',
      closeGalleryForm
    );


  el('gallery-form')
    ?.addEventListener(
      'submit',
      saveGallery
    );


  // CLIENTE

  el('new-client-btn')
    ?.addEventListener(
      'click',
      openClientForm
    );


  el('close-client-form')
    ?.addEventListener(
      'click',
      closeClientForm
    );


  el('cancel-client-form')
    ?.addEventListener(
      'click',
      closeClientForm
    );


  el('client-form')
    ?.addEventListener(
      'submit',
      saveClient
    );


  // LOGIN

  el('login-form')
    ?.addEventListener(
      'submit',
      login
    );


  // LOGOUT

  el('logout-btn')
    ?.addEventListener(
      'click',
      logout
    );


  // CATEGORIA

  el('category-form')
    ?.addEventListener(
      'submit',
      saveCategory
    );


  el('cancel-category')
    ?.addEventListener(
      'click',
      resetCategoryForm
    );


  // GERADORES

  el('generate-client-login')
    ?.addEventListener(
      'click',
      () => {

        el('client-login').value =
          randomLogin();

      }
    );


  el('generate-client-password')
    ?.addEventListener(
      'click',
      () => {

        el('client-password').value =
          randomPassword();

      }
    );


  // FOTO GALERIA

  el('photo-upload')
    ?.addEventListener(
      'change',
      uploadGalleryPhotos
    );


  // MODAL

  document
    .querySelectorAll('[data-close-modal]')
    .forEach(element => {

      element.addEventListener(
        'click',
        closeGalleryModal
      );

    });


  // SLUG AUTOMÁTICO

  el('gallery-title')
    ?.addEventListener(
      'input',
      event => {

        const slug =
          el('gallery-slug');

        if (
          !el('gallery-id').value &&
          slug
        ) {

          slug.value =
            slugify(
              event.target.value
            );

        }

      }
    );


  el('category-name')
    ?.addEventListener(
      'input',
      event => {

        const slug =
          el('category-slug');

        if (
          !el('category-id').value &&
          slug
        ) {

          slug.value =
            slugify(
              event.target.value
            );

        }

      }
    );

}


// ============================================================
// NAVEGAÇÃO
// ============================================================

function configureNavigation() {

  document
    .querySelectorAll('[data-view]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const view =
            button.dataset.view;

          if (view) {

            showView(view);

          }

        }
      );

    });

}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function init() {

  console.log(
    'ADMIN V2 iniciado'
  );


  configureForms();

  configureNavigation();

  await checkSession();

}


document.addEventListener(
  'DOMContentLoaded',
  init
);
