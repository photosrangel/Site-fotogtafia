import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const ADMIN_ID = 'e0a315bb-3614-4dbb-b020-3e8175a67e8a';
const BUCKET = 'site-gallery';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let currentGallery = null;
let categoriesCache = [];
let galleriesCache = [];

const slugify = v =>
  String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function msg(el, t, c = '') {
  el.textContent = t || '';
  el.className = c ? `msg ${c}` : 'msg';
}

function flash(t, c = '') {
  const e = $('flash');

  e.textContent = t;
  e.className = `flash ${c}`;
  e.hidden = false;

  clearTimeout(flash.timer);

  flash.timer = setTimeout(() => {
    e.hidden = true;
  }, 3500);
}

function setView(v) {
  document
    .querySelectorAll('.admin-view')
    .forEach(e => {
      e.hidden = e.id !== `view-${v}`;
    });

  document
    .querySelectorAll('.sidebar-link[data-view]')
    .forEach(b => {
      b.classList.toggle(
        'active',
        b.dataset.view === v
      );
    });

  const l = {
    dashboard: ['Painel', 'Dashboard'],
    galleries: ['Conteúdo', 'Galerias'],
    categories: ['Organização', 'Categorias'],
    settings: ['Site', 'Configurações']
  }[v];

  $('view-eyebrow').textContent = l[0];
  $('view-title').textContent = l[1];

  if (v === 'dashboard') loadDashboard();
  if (v === 'galleries') loadGalleries();
  if (v === 'categories') loadCategories();
  if (v === 'settings') loadSettings();
}

async function requireAdmin() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    $('login-screen').hidden = false;
    $('app').hidden = true;
    return false;
  }

  if (session.user.id !== ADMIN_ID) {
    await supabase.auth.signOut();

    $('login-screen').hidden = false;
    $('app').hidden = true;

    msg(
      $('login-msg'),
      'Este usuário não possui permissão de administrador.',
      'erro'
    );

    return false;
  }

  $('user-email').textContent =
    session.user.email || '';

  $('login-screen').hidden = true;
  $('app').hidden = false;

  setView('dashboard');

  return true;
}


/* =========================================================
   LOGIN
========================================================= */

$('login-form').addEventListener(
  'submit',
  async e => {
    e.preventDefault();

    msg(
      $('login-msg'),
      'Entrando...'
    );

    const {
      error
    } = await supabase.auth.signInWithPassword({
      email: $('login-email').value.trim(),
      password: $('login-password').value
    });

    if (error) {
      msg(
        $('login-msg'),
        'E-mail ou senha incorretos.',
        'erro'
      );

      return;
    }

    await requireAdmin();
  }
);


$('logout-btn').addEventListener(
  'click',
  async () => {
    await supabase.auth.signOut();
    location.reload();
  }
);


/* =========================================================
   NAVEGAÇÃO
========================================================= */

document
  .querySelectorAll('[data-view]')
  .forEach(b => {
    b.addEventListener(
      'click',
      () => setView(b.dataset.view)
    );
  });


$('dashboard-new-gallery').addEventListener(
  'click',
  () => {
    setView('galleries');
    openGalleryForm();
  }
);


$('new-gallery-btn').addEventListener(
  'click',
  openGalleryForm
);


$('close-gallery-form').addEventListener(
  'click',
  closeGalleryForm
);


$('cancel-gallery-form').addEventListener(
  'click',
  closeGalleryForm
);


$('gallery-title').addEventListener(
  'input',
  () => {
    if (!$('gallery-id').value) {
      $('gallery-slug').value =
        slugify($('gallery-title').value);
    }
  }
);


$('gallery-form').addEventListener(
  'submit',
  saveGallery
);


$('category-form').addEventListener(
  'submit',
  saveCategory
);


$('cancel-category').addEventListener(
  'click',
  resetCategoryForm
);


$('settings-form').addEventListener(
  'submit',
  saveSettings
);


$('photo-upload').addEventListener(
  'change',
  async e => {
    const f = [...e.target.files];

    if (f.length && currentGallery) {
      await uploadPhotos(
        f,
        currentGallery
      );
    }

    e.target.value = '';
  }
);


document
  .querySelectorAll('[data-close-modal]')
  .forEach(e => {
    e.addEventListener(
      'click',
      closeGalleryModal
    );
  });


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

  const [
    a,
    b,
    c
  ] = await Promise.all([

    supabase
      .from('galleries')
      .select('id,published'),

    supabase
      .from('categories')
      .select('id'),

    supabase
      .from('gallery_photos')
      .select('id,published')

  ]);

  const g = a.data || [];
  const k = b.data || [];
  const p = c.data || [];

  $('stat-galleries').textContent =
    g.length;

  $('stat-published').textContent =
    g.filter(x => x.published).length;

  $('stat-categories').textContent =
    k.length;

  $('stat-photos').textContent =
    p.filter(x => x.published).length;
}


/* =========================================================
   CATEGORIAS
========================================================= */

async function loadCategories() {

  const {
    data,
    error
  } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) {
    flash(
      `Erro ao carregar categorias: ${error.message}`,
      'erro'
    );

    return;
  }

  categoriesCache = data || [];

  renderCategorySelect();
  renderCategories();
}


function renderCategorySelect() {

  const s = $('gallery-category');
  const cur = s.value;

  s.innerHTML =
    '<option value="">Sem categoria</option>' +
    categoriesCache
      .map(
        c =>
          `<option value="${c.id}">
            ${esc(c.name)}
          </option>`
      )
      .join('');

  s.value = cur;
}


function renderCategories() {

  const c = $('categories-list');

  if (!categoriesCache.length) {

    c.innerHTML =
      '<p class="panel-copy">Nenhuma categoria cadastrada.</p>';

    return;
  }

  c.innerHTML =
    categoriesCache
      .map(
        x => `
          <div class="category-row">

            <div class="category-name">
              ${esc(x.name)}
            </div>

            <div class="category-slug">
              ${esc(x.slug)}
            </div>

            <div class="category-order">
              ${x.sort_order}
            </div>

            <div class="card-actions">

              <button
                class="small-btn"
                data-edit-category="${x.id}"
              >
                Editar
              </button>

              <button
                class="small-btn"
                data-delete-category="${x.id}"
              >
                Excluir
              </button>

            </div>

          </div>
        `
      )
      .join('');


  c
    .querySelectorAll('[data-edit-category]')
    .forEach(b => {

      b.addEventListener(
        'click',
        () => editCategory(
          b.dataset.editCategory
        )
      );

    });


  c
    .querySelectorAll('[data-delete-category]')
    .forEach(b => {

      b.addEventListener(
        'click',
        () => deleteCategory(
          b.dataset.deleteCategory
        )
      );

    });

}


async function saveCategory(e) {

  e.preventDefault();

  const id =
    $('category-id').value;

  const p = {
    name: $('category-name').value.trim(),
    slug: slugify(
      $('category-slug').value.trim()
    ),
    sort_order:
      Number($('category-order').value) || 0,
    published: true
  };

  const r = id
    ? await supabase
        .from('categories')
        .update(p)
        .eq('id', id)
    : await supabase
        .from('categories')
        .insert(p);

  if (r.error) {

    msg(
      $('category-msg'),
      r.error.message,
      'erro'
    );

    return;
  }

  msg(
    $('category-msg'),
    'Categoria salva.',
    'sucesso'
  );

  resetCategoryForm();

  await loadCategories();
  await loadDashboard();
}


function editCategory(id) {

  const c =
    categoriesCache.find(
      x => x.id === id
    );

  if (!c) return;

  $('category-id').value = c.id;
  $('category-name').value = c.name;
  $('category-slug').value = c.slug;
  $('category-order').value =
    c.sort_order;

  $('cancel-category').hidden = false;

  $('category-name').focus();
}


async function deleteCategory(id) {

  const c =
    categoriesCache.find(
      x => x.id === id
    );

  if (
    !c ||
    !confirm(
      `Excluir a categoria "${c.name}"? Galerias vinculadas ficarão sem categoria.`
    )
  ) {
    return;
  }

  const {
    error
  } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {

    flash(
      `Não foi possível excluir: ${error.message}`,
      'erro'
    );

    return;
  }

  flash(
    'Categoria excluída.',
    'sucesso'
  );

  await loadCategories();
  await loadGalleries();
  await loadDashboard();
}


function resetCategoryForm() {

  $('category-form').reset();

  $('category-id').value = '';

  $('category-order').value = 0;

  $('cancel-category').hidden = true;
}


/* =========================================================
   GALERIAS
========================================================= */

async function loadGalleries() {

  const {
    data: galleries,
    error: galleriesError
  } = await supabase
    .from('galleries')
    .select('*, categories(name)')
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

  if (galleriesError) {

    flash(
      `Erro ao carregar galerias: ${galleriesError.message}`,
      'erro'
    );

    return;
  }

  galleriesCache =
    galleries || [];


  const {
    data: categories,
    error: categoriesError
  } = await supabase
    .from('categories')
    .select('*')
    .eq('published', true)
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'name',
      {
        ascending: true
      }
    );

  if (categoriesError) {

    flash(
      `Erro ao carregar categorias: ${categoriesError.message}`,
      'erro'
    );

    return;
  }

  categoriesCache =
    categories || [];

  renderGalleries();
  renderCategorySelect();
}


function renderGalleries() {

  const c =
    $('galleries-list');

  if (!galleriesCache.length) {

    c.innerHTML = `
      <div class="panel">

        <p class="section-eyebrow">
          Ainda vazio
        </p>

        <h2
          style="
            font-family:var(--font-display);
            font-weight:400;
          "
        >
          Nenhuma galeria criada.
        </h2>

        <p
          class="panel-copy"
          style="margin-top:8px;"
        >
          Comece criando a primeira galeria do novo CMS.
        </p>

      </div>
    `;

    return;
  }


  c.innerHTML =
    galleriesCache
      .map(
        g => `

          <article
            class="gallery-admin-card"
            data-gallery-id="${attr(g.id)}"
            draggable="true"
            title="Arraste para mudar a posição da galeria"
          >

            <div class="gallery-card-main">

              ${
                g.cover_url
                  ? `
                    <img
                      class="gallery-thumb"
                      src="${attr(g.cover_url)}"
                      alt=""
                    >
                  `
                  : `
                    <div class="gallery-thumb empty">
                      SEM CAPA
                    </div>
                  `
              }

              <div class="gallery-card-content">

                <div class="gallery-card-title">
                  ${esc(g.title)}
                </div>

                <div class="gallery-meta">

                  /${esc(g.slug)}

                  ${
                    g.categories?.name
                      ? ` · ${esc(g.categories.name)}`
                      : ''
                  }

                </div>

                <div style="margin-top:9px">

                  <span
                    class="status-pill ${
                      g.published
                        ? 'published'
                        : 'draft'
                    }"
                  >
                    ${
                      g.published
                        ? 'PUBLICADA'
                        : 'RASCUNHO'
                    }
                  </span>

                </div>

                <div
                  class="card-actions gallery-card-actions"
                >

                  <button
                    class="small-btn"
                    data-photos="${attr(g.id)}"
                    type="button"
                  >
                    Fotos
                  </button>

                  <button
                    class="small-btn"
                    data-edit-gallery="${attr(g.id)}"
                    type="button"
                  >
                    Editar
                  </button>

                  <button
                    class="small-btn"
                    data-toggle-gallery="${attr(g.id)}"
                    type="button"
                  >
                    ${
                      g.published
                        ? 'Despublicar'
                        : 'Publicar'
                    }
                  </button>

                  <button
                    class="small-btn"
                    data-delete-gallery="${attr(g.id)}"
                    type="button"
                  >
                    Excluir
                  </button>

                </div>

              </div>

            </div>

          </article>

        `
      )
      .join('');


  /* BOTÃO FOTOS */

  c
    .querySelectorAll('[data-photos]')
    .forEach(b => {

      b.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          openGalleryModal(
            b.dataset.photos
          );

        }
      );

    });


  /* BOTÃO EDITAR */

  c
    .querySelectorAll('[data-edit-gallery]')
    .forEach(b => {

      b.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          editGallery(
            b.dataset.editGallery
          );

        }
      );

    });


  /* PUBLICAR / DESPUBLICAR */

  c
    .querySelectorAll('[data-toggle-gallery]')
    .forEach(b => {

      b.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          toggleGallery(
            b.dataset.toggleGallery
          );

        }
      );

    });


  /* EXCLUIR */

  c
    .querySelectorAll('[data-delete-gallery]')
    .forEach(b => {

      b.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          deleteGallery(
            b.dataset.deleteGallery
          );

        }
      );

    });


  /* DRAG & DROP */

  configurarOrdenacaoGalerias();
}


/* =========================================================
   ORDENAÇÃO DAS GALERIAS
========================================================= */

function configurarOrdenacaoGalerias() {

  const container =
    $('galleries-list');

  if (!container) return;

  let draggedCard = null;

  const cards = [
    ...container.querySelectorAll(
      '.gallery-admin-card'
    )
  ];


  cards.forEach(card => {


    card.addEventListener(
      'dragstart',
      event => {

        if (
          event.target.closest('button')
        ) {

          event.preventDefault();

          return;
        }

        draggedCard = card;

        card.classList.add(
          'is-dragging'
        );

        event.dataTransfer.effectAllowed =
          'move';

        event.dataTransfer.setData(
          'text/plain',
          card.dataset.galleryId
        );

      }
    );


    card.addEventListener(
      'dragover',
      event => {

        event.preventDefault();

        if (
          !draggedCard ||
          draggedCard === card
        ) {
          return;
        }

        event.dataTransfer.dropEffect =
          'move';

        const rect =
          card.getBoundingClientRect();

        const mouseY =
          event.clientY;

        const middle =
          rect.top +
          rect.height / 2;

        if (mouseY < middle) {

          container.insertBefore(
            draggedCard,
            card
          );

        } else {

          container.insertBefore(
            draggedCard,
            card.nextSibling
          );

        }

        container
          .querySelectorAll(
            '.gallery-admin-card'
          )
          .forEach(item => {

            item.classList.remove(
              'drag-over'
            );

          });

        card.classList.add(
          'drag-over'
        );

      }
    );


    card.addEventListener(
      'drop',
      event => {

        event.preventDefault();
        event.stopPropagation();

        card.classList.remove(
          'drag-over'
        );

      }
    );


    card.addEventListener(
      'dragend',
      async () => {

        if (!draggedCard) {
          return;
        }

        draggedCard.classList.remove(
          'is-dragging'
        );

        container
          .querySelectorAll(
            '.gallery-admin-card'
          )
          .forEach(item => {

            item.classList.remove(
              'drag-over'
            );

          });

        draggedCard = null;

        await salvarOrdemGalerias();

      }
    );


    card.addEventListener(
      'dragleave',
      event => {

        if (
          !card.contains(
            event.relatedTarget
          )
        ) {

          card.classList.remove(
            'drag-over'
          );

        }

      }
    );

  });

}


/* =========================================================
   SALVAR ORDEM DAS GALERIAS
   ESTA É A ÚNICA DECLARAÇÃO
========================================================= */

async function salvarOrdemGalerias() {

  const cards = [
    ...$('galleries-list')
      .querySelectorAll(
        '.gallery-admin-card'
      )
  ];

  if (!cards.length) return;

  const atualizacoes =
    cards.map(
      (card, index) => {

        const id =
          card.dataset.galleryId;

        return supabase
          .from('galleries')
          .update({
            sort_order: index + 1
          })
          .eq('id', id);

      }
    );


  const resultados =
    await Promise.all(
      atualizacoes
    );


  const erro =
    resultados.find(
      resultado => resultado.error
    );


  if (erro) {

    flash(
      `Erro ao salvar a ordem: ${erro.error.message}`,
      'erro'
    );

    return;
  }


  cards.forEach(
    (card, index) => {

      const gallery =
        galleriesCache.find(
          g =>
            g.id ===
            card.dataset.galleryId
        );

      if (gallery) {
        gallery.sort_order =
          index + 1;
      }

    }
  );


  galleriesCache.sort(
    (a, b) =>
      (a.sort_order ?? 0) -
      (b.sort_order ?? 0)
  );


  flash(
    'Ordem das galerias atualizada.',
    'sucesso'
  );

}


/* =========================================================
   FORMULÁRIO DE GALERIA
========================================================= */

function openGalleryForm(g = null) {

  $('gallery-form-wrap').hidden =
    false;

  $('gallery-form-title').textContent =
    g
      ? 'Editar galeria'
      : 'Nova galeria';

  $('gallery-id').value =
    g?.id || '';

  $('gallery-title').value =
    g?.title || '';

  $('gallery-slug').value =
    g?.slug || '';

  $('gallery-category').value =
    g?.category_id || '';

  $('gallery-description').value =
    g?.description || '';

  $('gallery-cover').value =
    g?.cover_url || '';

  $('gallery-order').value =
    g?.sort_order ?? 0;

  $('gallery-title').focus();
}


function closeGalleryForm() {

  $('gallery-form-wrap').hidden =
    true;

  $('gallery-form').reset();

  $('gallery-id').value =
    '';

  $('gallery-order').value =
    0;

  msg(
    $('gallery-form-msg'),
    ''
  );
}


async function saveGallery(e) {

  e.preventDefault();

  const id =
    $('gallery-id').value;

  const p = {

    title:
      $('gallery-title')
        .value
        .trim(),

    slug:
      slugify(
        $('gallery-slug')
          .value
          .trim()
      ),

    description:
      $('gallery-description')
        .value
        .trim() || null,

    category_id:
      $('gallery-category')
        .value || null,

    cover_url:
      $('gallery-cover')
        .value
        .trim() || null,

    sort_order:
      Number(
        $('gallery-order').value
      ) || 0

  };


  const r =
    id

      ? await supabase
          .from('galleries')
          .update(p)
          .eq('id', id)
          .select()
          .single()

      : await supabase
          .from('galleries')
          .insert(p)
          .select()
          .single();


  if (r.error) {

    msg(
      $('gallery-form-msg'),
      r.error.message,
      'erro'
    );

    return;
  }


  msg(
    $('gallery-form-msg'),
    'Galeria salva.',
    'sucesso'
  );


  await loadGalleries();
  await loadDashboard();


  if (!id && r.data) {

    setTimeout(
      () =>
        openGalleryModal(
          r.data.id
        ),
      250
    );

  }

}


function editGallery(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (g) {

    openGalleryForm(g);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }
}


async function toggleGallery(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (!g) return;

  const {
    error
  } = await supabase
    .from('galleries')
    .update({
      published:
        !g.published
    })
    .eq('id', id);


  if (error) {

    flash(
      `Erro: ${error.message}`,
      'erro'
    );

    return;
  }


  flash(
    g.published
      ? 'Galeria despublicada.'
      : 'Galeria publicada.',
    'sucesso'
  );


  await loadGalleries();
  await loadDashboard();
}


async function deleteGallery(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );


  if (
    !g ||
    !confirm(
      `Excluir "${g.title}" e todas as suas fotografias? Esta ação não pode ser desfeita.`
    )
  ) {
    return;
  }


  const {
    data: photos,
    error: qerr
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,image_url'
    )
    .eq(
      'gallery_id',
      id
    );


  if (qerr) {

    flash(
      `Erro ao localizar fotos: ${qerr.message}`,
      'erro'
    );

    return;
  }


  const paths =
    (photos || [])
      .map(
        p =>
          storagePath(
            p.image_url
          )
      )
      .filter(Boolean);


  if (paths.length) {

    const {
      error
    } = await supabase
      .storage
      .from(BUCKET)
      .remove(paths);


    if (error) {

      flash(
        `Não foi possível apagar os arquivos: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  const {
    error
  } = await supabase
    .from('galleries')
    .delete()
    .eq('id', id);


  if (error) {

    flash(
      `Erro ao excluir galeria: ${error.message}`,
      'erro'
    );

    return;
  }


  flash(
    'Galeria excluída.',
    'sucesso'
  );


  await loadGalleries();
  await loadDashboard();
}


/* =========================================================
   MODAL DA GALERIA
========================================================= */

async function openGalleryModal(id) {

  const g =
    galleriesCache.find(
      x => x.id === id
    );

  if (!g) return;

  currentGallery = g;

  $('modal-gallery-title').textContent =
    g.title;

  $('gallery-editor-modal').hidden =
    false;

  await loadPhotos();
}


function closeGalleryModal() {

  $('gallery-editor-modal').hidden =
    true;

  currentGallery = null;

  $('photo-grid').innerHTML =
    '';
}


/* =========================================================
   FOTOGRAFIAS
========================================================= */

async function loadPhotos() {

  if (!currentGallery) return;


  const {
    data: freshGallery,
    error: ge
  } = await supabase
    .from('galleries')
    .select('*')
    .eq(
      'id',
      currentGallery.id
    )
    .single();


  if (ge) {

    msg(
      $('upload-msg'),
      ge.message,
      'erro'
    );

    return;
  }


  currentGallery =
    freshGallery;


  const {
    data,
    error
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,gallery_id,image_url,alt_text,sort_order,published,created_at'
    )
    .eq(
      'gallery_id',
      currentGallery.id
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

    msg(
      $('upload-msg'),
      error.message,
      'erro'
    );

    return;
  }


  const photos =
    data || [];


  $('photo-count').textContent =
    `${photos.length} fotografia${
      photos.length === 1
        ? ''
        : 's'
    }`;


  if (!photos.length) {

    $('photo-grid').innerHTML =
      '<p class="panel-copy" style="grid-column:1/-1;padding:20px;">Nenhuma fotografia nesta galeria.</p>';

    return;
  }


  $('photo-grid').innerHTML =
    photos
      .map(
        (x, index) => `

          <div
            class="
              admin-photo
              ${
                currentGallery.cover_url ===
                x.image_url
                  ? 'admin-photo-cover'
                  : ''
              }
              ${
                x.published
                  ? 'photo-is-published'
                  : 'photo-is-hidden'
              }
            "
            data-photo-id="${attr(x.id)}"
            draggable="true"
            title="Arraste para reorganizar ou clique na fotografia para definir como capa"
          >

            <img
              src="${attr(x.image_url)}"
              alt="${attr(
                x.alt_text ||
                currentGallery.title ||
                ''
              )}"
              loading="lazy"
              onerror="this.parentElement.classList.add('photo-load-error')"
            >

            <span class="photo-order">
              ${index + 1}
            </span>

            ${
              currentGallery.cover_url ===
              x.image_url
                ? '<span class="photo-cover-label">CAPA</span>'
                : ''
            }

            <button
              class="photo-status ${
                x.published
                  ? 'published'
                  : 'hidden'
              }"
              data-toggle-photo="${attr(x.id)}"
              title="${
                x.published
                  ? 'Ocultar fotografia do site'
                  : 'Publicar fotografia no site'
              }"
              type="button"
            >
              ${
                x.published
                  ? '✓ PUBLICADA'
                  : '○ OCULTA'
              }
            </button>

            <button
              class="photo-delete"
              data-delete-photo="${attr(x.id)}"
              title="Excluir fotografia"
              type="button"
            >
              ×
            </button>

          </div>

        `
      )
      .join('');


  const grid =
    $('photo-grid');


  grid
    .querySelectorAll('.admin-photo')
    .forEach(el => {

      const pht =
        photos.find(
          x =>
            x.id ===
            el.dataset.photoId
        );


      el.addEventListener(
        'click',
        e => {

          if (
            e.target.closest(
              '.photo-delete'
            ) ||
            e.target.closest(
              '.photo-status'
            )
          ) {
            return;
          }


          if (pht) {
            setCover(pht);
          }

        }
      );


      el.addEventListener(
        'dragstart',
        e => {

          el.classList.add(
            'is-dragging'
          );

          e.dataTransfer.effectAllowed =
            'move';

          e.dataTransfer.setData(
            'text/plain',
            el.dataset.photoId
          );

        }
      );


      el.addEventListener(
        'dragend',
        () => {

          el.classList.remove(
            'is-dragging'
          );

          grid
            .querySelectorAll(
              '.admin-photo'
            )
            .forEach(item =>
              item.classList.remove(
                'drag-over'
              )
            );

          savePhotoOrder();

        }
      );


      el.addEventListener(
        'dragover',
        e => {

          e.preventDefault();

          const dragging =
            grid.querySelector(
              '.is-dragging'
            );


          if (
            !dragging ||
            dragging === el
          ) {
            return;
          }


          const rect =
            el.getBoundingClientRect();


          const after =
            e.clientY >
            rect.top +
            rect.height / 2;


          grid.insertBefore(
            dragging,
            after
              ? el.nextSibling
              : el
          );


          el.classList.add(
            'drag-over'
          );

        }
      );


      el.addEventListener(
        'dragleave',
        () => {

          el.classList.remove(
            'drag-over'
          );

        }
      );


      el.addEventListener(
        'drop',
        e => {

          e.preventDefault();

          el.classList.remove(
            'drag-over'
          );

        }
      );

    });


  grid
    .querySelectorAll(
      '[data-toggle-photo]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          togglePhotoPublished(
            button.dataset.togglePhoto
          );

        }
      );

    });


  grid
    .querySelectorAll(
      '[data-delete-photo]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        e => {

          e.stopPropagation();

          deletePhoto(
            button.dataset.deletePhoto
          );

        }
      );

    });

}


/* =========================================================
   PUBLICAR / OCULTAR FOTO
========================================================= */

async function togglePhotoPublished(id) {

  const {
    data: photo,
    error: findError
  } = await supabase
    .from('gallery_photos')
    .select(
      'id,published'
    )
    .eq(
      'id',
      id
    )
    .single();


  if (
    findError ||
    !photo
  ) {

    flash(
      'Fotografia não encontrada.',
      'erro'
    );

    return;
  }


  const novoEstado =
    !photo.published;


  const {
    error
  } = await supabase
    .from('gallery_photos')
    .update({
      published:
        novoEstado
    })
    .eq(
      'id',
      id
    );


  if (error) {

    flash(
      `Erro ao alterar publicação: ${error.message}`,
      'erro'
    );

    return;
  }


  flash(
    novoEstado
      ? 'Fotografia publicada no site.'
      : 'Fotografia ocultada do site.',
    'sucesso'
  );


  await loadPhotos();
  await loadDashboard();
}


/* =========================================================
   ORDEM DAS FOTOGRAFIAS
========================================================= */

async function savePhotoOrder() {

  const items = [
    ...$('photo-grid')
      .querySelectorAll(
        '.admin-photo'
      )
  ];


  if (!items.length) return;


  const updates =
    items.map(
      (el, index) => ({
        id:
          el.dataset.photoId,

        sort_order:
          index
      })
    );


  msg(
    $('upload-msg'),
    'Salvando nova ordem...'
  );


  for (const item of updates) {

    const {
      error
    } = await supabase
      .from('gallery_photos')
      .update({
        sort_order:
          item.sort_order
      })
      .eq(
        'id',
        item.id
      );


    if (error) {

      msg(
        $('upload-msg'),
        `Erro ao salvar a ordem: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  items.forEach(
    (el, index) => {

      const number =
        el.querySelector(
          '.photo-order'
        );

      if (number) {
        number.textContent =
          index + 1;
      }

    }
  );


  msg(
    $('upload-msg'),
    'Ordem das fotografias atualizada.',
    'sucesso'
  );


  await loadGalleries();
}


/* =========================================================
   UPLOAD DE FOTOGRAFIAS
========================================================= */

async function uploadPhotos(files, g) {

  msg(
    $('upload-msg'),
    `Enviando ${files.length} fotografia(s)...`
  );


  const q =
    await supabase
      .from('gallery_photos')
      .select('sort_order')
      .eq(
        'gallery_id',
        g.id
      )
      .order(
        'sort_order',
        {
          ascending: false
        }
      )
      .limit(1);


  let order =
    q.data?.[0]?.sort_order ??
    -1;


  for (const file of files) {

    const ext =
      (
        file.name
          .split('.')
          .pop() ||
        'jpg'
      ).toLowerCase();


    const safe =
      [
        'jpg',
        'jpeg',
        'png',
        'webp'
      ].includes(ext)
        ? ext
        : 'jpg';


    const path =
      `${g.id}/${Date.now()}-${crypto.randomUUID()}-${slugify(
        file.name.replace(
          /\.[^.]+$/,
          ''
        )
      )}.${safe}`;


    const up =
      await supabase
        .storage
        .from(BUCKET)
        .upload(
          path,
          file,
          {
            upsert: false
          }
        );


    if (up.error) {

      msg(
        $('upload-msg'),
        `Erro no upload de ${file.name}: ${up.error.message}`,
        'erro'
      );

      continue;
    }


    const {
      data: url
    } =
      supabase
        .storage
        .from(BUCKET)
        .getPublicUrl(path);


    order++;


    const ins =
      await supabase
        .from('gallery_photos')
        .insert({
          gallery_id:
            g.id,

          image_url:
            url.publicUrl,

          alt_text:
            g.title,

          sort_order:
            order,

          published:
            true
        });


    if (ins.error) {

      await supabase
        .storage
        .from(BUCKET)
        .remove([path]);


      msg(
        $('upload-msg'),
        `Erro ao registrar ${file.name}: ${ins.error.message}`,
        'erro'
      );

    }

  }


  await ensureCover(
    g.id
  );

  await refreshGalleryCache(
    g.id
  );

  await loadPhotos();
  await loadGalleries();
  await loadDashboard();


  msg(
    $('upload-msg'),
    'Upload concluído. As fotografias foram atualizadas na galeria.',
    'sucesso'
  );
}


/* =========================================================
   CAPA
========================================================= */

async function ensureCover(id) {

  const {
    data: g
  } = await supabase
    .from('galleries')
    .select('cover_url')
    .eq(
      'id',
      id
    )
    .single();


  if (g?.cover_url) {
    return;
  }


  const {
    data: p
  } =
    await supabase
      .from('gallery_photos')
      .select('image_url')
      .eq(
        'gallery_id',
        id
      )
      .order(
        'sort_order'
      )
      .limit(1)
      .maybeSingle();


  if (p?.image_url) {

    await supabase
      .from('galleries')
      .update({
        cover_url:
          p.image_url
      })
      .eq(
        'id',
        id
      );

  }
}


async function setCover(p) {

  if (!currentGallery) {
    return;
  }


  const {
    error
  } = await supabase
    .from('galleries')
    .update({
      cover_url:
        p.image_url
    })
    .eq(
      'id',
      currentGallery.id
    );


  if (error) {

    flash(
      `Erro ao definir capa: ${error.message}`,
      'erro'
    );

    return;
  }


  currentGallery.cover_url =
    p.image_url;


  flash(
    'Capa atualizada.',
    'sucesso'
  );


  await loadPhotos();
  await loadGalleries();
}


/* =========================================================
   EXCLUIR FOTO
========================================================= */

async function deletePhoto(id) {

  const {
    data: p,
    error: q
  } = await supabase
    .from('gallery_photos')
    .select('*')
    .eq(
      'id',
      id
    )
    .single();


  if (
    q ||
    !p
  ) {

    flash(
      'Fotografia não encontrada.',
      'erro'
    );

    return;
  }


  if (
    !confirm(
      'Excluir esta fotografia?'
    )
  ) {
    return;
  }


  const path =
    storagePath(
      p.image_url
    );


  if (path) {

    const {
      error
    } = await supabase
      .storage
      .from(BUCKET)
      .remove([path]);


    if (error) {

      flash(
        `Erro ao excluir arquivo: ${error.message}`,
        'erro'
      );

      return;
    }

  }


  const {
    error
  } = await supabase
    .from('gallery_photos')
    .delete()
    .eq(
      'id',
      id
    );


  if (error) {

    flash(
      `Erro ao excluir registro: ${error.message}`,
      'erro'
    );

    return;
  }


  if (
    currentGallery.cover_url ===
    p.image_url
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


    await ensureCover(
      currentGallery.id
    );


    await refreshGalleryCache(
      currentGallery.id
    );

  }


  flash(
    'Fotografia excluída.',
    'sucesso'
  );


  await loadPhotos();
  await loadGalleries();
  await loadDashboard();
}


/* =========================================================
   CACHE
========================================================= */

async function refreshGalleryCache(id) {

  const {
    data
  } = await supabase
    .from('galleries')
    .select('*, categories(name)')
    .eq(
      'id',
      id
    )
    .single();


  if (data) {

    galleriesCache =
      galleriesCache.map(
        g =>
          g.id === id
            ? data
            : g
      );

    currentGallery =
      data;
  }
}


/* =========================================================
   STORAGE
========================================================= */

function storagePath(url) {

  const marker =
    `/storage/v1/object/public/${BUCKET}/`;

  const i =
    (url || '').indexOf(
      marker
    );


  if (i === -1) {
    return null;
  }


  return decodeURIComponent(
    url.slice(
      i + marker.length
    )
  );
}


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

async function loadSettings() {

  const {
    data,
    error
  } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();


  if (error) {

    flash(
      `Erro ao carregar configurações: ${error.message}`,
      'erro'
    );

    return;
  }


  if (!data) {
    return;
  }


  $('settings-site-name').value =
    data.site_name || '';

  $('settings-email').value =
    data.email || '';

  $('settings-whatsapp').value =
    data.whatsapp || '';

  $('settings-instagram').value =
    data.instagram_url || '';

  $('settings-location').value =
    data.location || '';

  $('settings-specialty').value =
    data.specialty || '';

  $('settings-availability').value =
    data.availability || '';

  $('settings-footer').value =
    data.footer_text || '';
}


async function saveSettings(e) {

  e.preventDefault();


  const p = {

    site_name:
      $('settings-site-name')
        .value
        .trim(),

    email:
      $('settings-email')
        .value
        .trim() || null,

    whatsapp:
      $('settings-whatsapp')
        .value
        .trim() || null,

    instagram_url:
      $('settings-instagram')
        .value
        .trim() || null,

    location:
      $('settings-location')
        .value
        .trim() || null,

    specialty:
      $('settings-specialty')
        .value
        .trim() || null,

    availability:
      $('settings-availability')
        .value
        .trim() || null,

    footer_text:
      $('settings-footer')
        .value
        .trim() || null,

    updated_at:
      new Date().toISOString()

  };


  const {
    data: ex
  } = await supabase
    .from('site_settings')
    .select('id')
    .limit(1)
    .maybeSingle();


  const r =
    ex?.id

      ? await supabase
          .from('site_settings')
          .update(p)
          .eq(
            'id',
            ex.id
          )

      : await supabase
          .from('site_settings')
          .insert(p);


  if (r.error) {

    msg(
      $('settings-msg'),
      r.error.message,
      'erro'
    );

    return;
  }


  msg(
    $('settings-msg'),
    'Configurações salvas.',
    'sucesso'
  );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

const esc = v =>
  String(v ?? '')
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );


const attr = esc;


/* =========================================================
   AUTH
========================================================= */

supabase.auth.onAuthStateChange(
  (_e, s) => {

    if (!s) {

      $('login-screen').hidden =
        false;

      $('app').hidden =
        true;

    }

  }
);


requireAdmin();
