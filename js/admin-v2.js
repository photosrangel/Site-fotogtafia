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
let sessionsCache = [];
let currentSession = null;
let currentSessionPhotos = [];

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
    content: ['Páginas', 'Conteúdo'],
    galleries: ['Conteúdo', 'Galerias'],
    categories: ['Organização', 'Categorias'],
    sessions: ['Clientes', 'Ensaios'],
    messages: ['Site', 'Mensagens'],
    settings: ['Site', 'Configurações']
  }[v];

  $('view-eyebrow').textContent = l[0];
  $('view-title').textContent = l[1];

  if (v === 'dashboard') loadDashboard();
  if (v === 'content') loadContent();
  if (v === 'galleries') loadGalleries();
  if (v === 'categories') loadCategories();
  if (v === 'sessions') loadSessions();
  if (v === 'messages') loadMessages();
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

    try {
      const resultado = await Promise.race([
        supabase.auth.signInWithPassword({
          email: $('login-email').value.trim(),
          password: $('login-password').value
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 20000)
        )
      ]);

      if (resultado.error) {
        msg(
          $('login-msg'),
          'E-mail ou senha incorretos.',
          'erro'
        );

        return;
      }

      await requireAdmin();
    } catch (err) {
      if (err && err.message === 'timeout') {
        msg(
          $('login-msg'),
          'Demorou demais para conectar ao servidor. Verifique sua internet e tente novamente.',
          'erro'
        );
      } else {
        console.error('Erro no login:', err);
        msg(
          $('login-msg'),
          'Erro inesperado ao entrar. Veja o console do navegador (F12).',
          'erro'
        );
      }
    }
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
    c,
    m
  ] = await Promise.all([

    supabase
      .from('galleries')
      .select('id,published'),

    supabase
      .from('categories')
      .select('id'),

    supabase
      .from('gallery_photos')
      .select('id,published'),

    supabase
      .from('mensagens')
      .select('id')
      .eq('lida', false)
      .then(
        r => r,
        () => ({ data: [] })
      )

  ]);

  const g = a.data || [];
  const k = b.data || [];
  const p = c.data || [];
  const msg = m.data || [];

  $('stat-galleries').textContent =
    g.length;

  $('stat-published').textContent =
    g.filter(x => x.published).length;

  $('stat-categories').textContent =
    k.length;

  $('stat-photos').textContent =
    p.filter(x => x.published).length;

  const msgEl = $('stat-messages');
  msgEl.textContent = msg.length;
  msgEl.style.color = msg.length ? 'var(--accent)' : '';
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

        <div
          class="gallery-drag-handle"
          title="Arraste para mudar a posição"
          aria-label="Arraste para mudar a posição"
        >
          ⋮⋮
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
   CONTEÚDO DAS PÁGINAS (site_content)
========================================================= */

const CONTENT_DEFAULTS = {
  inicio: {
    hero: {
      eyebrow: '',
      title: '',
      description: '',
      desktop_image: '',
      mobile_image: '',
      image_alt: 'Rangel Santos, fotógrafo',
      primary_button: { text: 'Ver galeria', url: '/galeria' },
      secondary_button: { text: 'Agendar sessão', url: '/contato' },
      meta: []
    },
    recent_work: {
      eyebrow: '',
      title: '',
      gallery_limit: 6,
      button: { text: 'Galeria completa →', url: '/galeria' }
    }
  },
  sobre: {
    conteudo: {
      eyebrow: 'Sobre mim',
      paragraphs: [],
      specs: [],
      portrait_url: '',
      portrait_alt: 'Retrato de Rangel Santos, fotógrafo',
      cta_text: 'Vamos conversar',
      cta_url: '/contato'
    }
  },
  contato: {
    conteudo: {
      eyebrow: 'Renove sua autoestima',
      title: 'Contato',
      submit_label: 'Enviar mensagem',
      tipos: [],
      atendimento: ''
    }
  }
};

let contentCache = null;

async function fetchContent() {
  const { data } = await supabase
    .from('site_content')
    .select('slug, section_key, content');

  const map = { inicio: {}, sobre: {}, contato: {} };

  (data || []).forEach(row => {
    if (!map[row.slug]) return;

    let content = row.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); }
      catch (e) { content = {}; }
    }

    map[row.slug][row.section_key] = content || {};
  });

  return map;
}

function mergeContent(map) {
  const out = JSON.parse(JSON.stringify(CONTENT_DEFAULTS));

  ['inicio', 'sobre', 'contato'].forEach(page => {
    Object.keys(out[page]).forEach(key => {
      if (map[page][key]) {
        Object.assign(out[page][key], map[page][key]);
      }
    });
  });

  return out;
}

async function loadContent() {
  const map = await fetchContent();
  contentCache = mergeContent(map);

  const h = contentCache.inicio.hero;
  $('hero-eyebrow').value = h.eyebrow || '';
  $('hero-title').value = h.title || '';
  $('hero-description').value = h.description || '';
  $('hero-desktop-image').value = h.desktop_image || '';
  $('hero-mobile-image').value = h.mobile_image || '';
  $('hero-image-alt').value = h.image_alt || '';
  $('hero-primary-text').value = h.primary_button?.text || '';
  $('hero-primary-url').value = h.primary_button?.url || '';
  $('hero-secondary-text').value = h.secondary_button?.text || '';
  $('hero-secondary-url').value = h.secondary_button?.url || '';
  $('hero-meta').value = (h.meta || [])
    .map(m => `${m.label} | ${m.value}`)
    .join('\n');

  const r = contentCache.inicio.recent_work;
  $('recent-eyebrow').value = r.eyebrow || '';
  $('recent-title').value = r.title || '';
  $('recent-limit').value = r.gallery_limit ?? 6;
  $('recent-btn-text').value = r.button?.text || '';
  $('recent-btn-url').value = r.button?.url || '';

  const s = contentCache.sobre.conteudo;
  $('sobre-eyebrow').value = s.eyebrow || '';
  $('sobre-paragraphs').value = (s.paragraphs || []).join('\n');
  $('sobre-portrait-url').value = s.portrait_url || '';
  $('sobre-portrait-alt').value = s.portrait_alt || '';
  $('sobre-cta-text').value = s.cta_text || '';
  $('sobre-cta-url').value = s.cta_url || '';
  renderSpecsEditor(s.specs || []);

  const ct = contentCache.contato.conteudo;
  $('contato-eyebrow').value = ct.eyebrow || '';
  $('contato-title').value = ct.title || '';
  $('contato-submit-label').value = ct.submit_label || '';
  $('contato-tipos').value = (ct.tipos || []).join('\n');
  $('contato-atendimento').value = ct.atendimento || '';

  ['hero-msg', 'recent-msg', 'sobre-msg', 'contato-msg']
    .forEach(id => msg($(id), ''));
}

function renderSpecsEditor(specs) {
  const c = $('sobre-specs-editor');
  const lista = specs.length
    ? specs
    : [{ label: 'Baseado em', value: 'Vale de Cambra, Portugal' }];

  c.innerHTML = lista.map((s, i) => `
    <div class="inline-form" style="margin-bottom:10px;align-items:flex-end;" data-spec-row>
      <div class="field" style="flex:1;margin-bottom:0;"><label>Rótulo</label><input class="spec-label" value="${esc(s.label)}"></div>
      <div class="field" style="flex:1;margin-bottom:0;"><label>Valor</label><input class="spec-value" value="${esc(s.value)}"></div>
      <button type="button" class="small-btn" data-remove-spec>Remover</button>
    </div>`).join('');

  c.querySelectorAll('[data-remove-spec]').forEach(b =>
    b.addEventListener('click', () => b.closest('[data-spec-row]').remove())
  );
}

function collectSpecs() {
  return [...document.querySelectorAll('#sobre-specs-editor [data-spec-row]')]
    .map(row => ({
      label: row.querySelector('.spec-label').value.trim(),
      value: row.querySelector('.spec-value').value.trim()
    }))
    .filter(s => s.label || s.value);
}

async function upsertContent(slug, sectionKey, payload, msgId) {
  msg($(msgId), 'Salvando...');

  const { data: existing } = await supabase
    .from('site_content')
    .select('id')
    .eq('slug', slug)
    .eq('section_key', sectionKey)
    .maybeSingle();

  const row = {
    slug,
    section_key: sectionKey,
    content: payload,
    updated_at: new Date().toISOString()
  };

  const r = existing?.id
    ? await supabase.from('site_content').update(row).eq('id', existing.id)
    : await supabase.from('site_content').insert(row);

  if (r.error) {
    msg($(msgId), 'Erro ao salvar: ' + r.error.message, 'erro');
    return;
  }

  msg($(msgId), 'Salvo!', 'sucesso');
  contentCache = null;
}

$('form-hero').addEventListener('submit', async e => {
  e.preventDefault();

  const meta = $('hero-meta').value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const i = l.indexOf('|');
      if (i === -1) return { label: l, value: '' };
      return { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    });

  await upsertContent('inicio', 'hero', {
    eyebrow: $('hero-eyebrow').value.trim(),
    title: $('hero-title').value.trim(),
    description: $('hero-description').value.trim(),
    desktop_image: $('hero-desktop-image').value.trim(),
    mobile_image: $('hero-mobile-image').value.trim(),
    image_alt: $('hero-image-alt').value.trim(),
    primary_button: {
      text: $('hero-primary-text').value.trim(),
      url: $('hero-primary-url').value.trim()
    },
    secondary_button: {
      text: $('hero-secondary-text').value.trim(),
      url: $('hero-secondary-url').value.trim()
    },
    meta
  }, 'hero-msg');
});

$('form-recent').addEventListener('submit', async e => {
  e.preventDefault();

  await upsertContent('inicio', 'recent_work', {
    eyebrow: $('recent-eyebrow').value.trim(),
    title: $('recent-title').value.trim(),
    gallery_limit: Number($('recent-limit').value) || 6,
    button: {
      text: $('recent-btn-text').value.trim(),
      url: $('recent-btn-url').value.trim()
    }
  }, 'recent-msg');
});

$('form-sobre').addEventListener('submit', async e => {
  e.preventDefault();

  await upsertContent('sobre', 'conteudo', {
    eyebrow: $('sobre-eyebrow').value.trim(),
    paragraphs: $('sobre-paragraphs').value
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
    specs: collectSpecs(),
    portrait_url: $('sobre-portrait-url').value.trim(),
    portrait_alt: $('sobre-portrait-alt').value.trim(),
    cta_text: $('sobre-cta-text').value.trim(),
    cta_url: $('sobre-cta-url').value.trim()
  }, 'sobre-msg');
});

$('form-contato').addEventListener('submit', async e => {
  e.preventDefault();

  await upsertContent('contato', 'conteudo', {
    eyebrow: $('contato-eyebrow').value.trim(),
    title: $('contato-title').value.trim(),
    submit_label: $('contato-submit-label').value.trim(),
    tipos: $('contato-tipos').value
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
    atendimento: $('contato-atendimento').value.trim()
  }, 'contato-msg');
});

$('btn-add-spec').addEventListener('click', () => {
  const c = $('sobre-specs-editor');
  const div = document.createElement('div');
  div.className = 'inline-form';
  div.style.cssText = 'margin-bottom:10px;align-items:flex-end;';
  div.dataset.specRow = '';
  div.innerHTML = `
    <div class="field" style="flex:1;margin-bottom:0;"><label>Rótulo</label><input class="spec-label"></div>
    <div class="field" style="flex:1;margin-bottom:0;"><label>Valor</label><input class="spec-value"></div>
    <button type="button" class="small-btn" data-remove-spec>Remover</button>`;
  div.querySelector('[data-remove-spec]')
    .addEventListener('click', () => div.remove());
  c.appendChild(div);
});

document.querySelectorAll('#content-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#content-tabs .tab').forEach(t =>
      t.classList.toggle('active', t === tab)
    );
    ['inicio', 'sobre', 'contato'].forEach(p =>
      $('content-panel-' + p).hidden = p !== tab.dataset.tab
    );
  });
});

/* =========================================================
   MENSAGENS
========================================================= */

async function loadMessages() {
  const list = $('messages-list');
  list.innerHTML = '';

  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .order('created_at', { ascending: false })
    .then(
      r => r,
      () => ({
        data: null,
        error: { message: 'tabela-inexistente' }
      })
    );

  if (error) {
    list.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Tabela ainda não criada</p>
        <p class="panel-copy">Rode o script SQL de "mensagens" no Supabase para começar a receber mensagens do formulário de contato.</p>
      </div>`;
    return;
  }

  const rows = data || [];

  if (!rows.length) {
    list.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Nenhuma mensagem</p>
        <p class="panel-copy">As mensagens enviadas pelo formulário da página de contato aparecerão aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = rows.map(m => `
    <article class="msg-card ${m.lida ? '' : 'nao-lida'}">
      <div class="msg-card-head">
        <div>
          <div class="msg-card-nome">${esc(m.nome)}</div>
          <div class="msg-card-meta">${esc(m.email || '')}${m.tipo ? ' · ' + esc(m.tipo) : ''}</div>
        </div>
        <span class="msg-card-meta">${new Date(m.created_at).toLocaleString('pt-BR')}</span>
      </div>
      <p class="msg-card-corpo">${esc(m.mensagem)}</p>
      <div class="card-actions">
        ${m.lida ? '' : `<button class="small-btn" data-mark-read="${esc(m.id)}">Marcar como lida</button>`}
        <button class="small-btn" data-del-msg="${esc(m.id)}">Excluir</button>
      </div>
    </article>`).join('');

  list.querySelectorAll('[data-mark-read]').forEach(b =>
    b.addEventListener('click', () => marcarLida(b.dataset.markRead))
  );
  list.querySelectorAll('[data-del-msg]').forEach(b =>
    b.addEventListener('click', () => excluirMensagem(b.dataset.delMsg))
  );
}

async function marcarLida(id) {
  const { error } = await supabase
    .from('mensagens')
    .update({ lida: true })
    .eq('id', id);

  if (error) {
    flash('Erro: ' + error.message, 'erro');
    return;
  }

  await loadMessages();
}

async function excluirMensagem(id) {
  if (!confirm('Excluir esta mensagem?')) return;

  const { error } = await supabase
    .from('mensagens')
    .delete()
    .eq('id', id);

  if (error) {
    flash('Erro: ' + error.message, 'erro');
    return;
  }

  flash('Mensagem excluída.', 'sucesso');
  await loadMessages();
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


requireAdmin().catch(err => {
  console.error('Erro ao verificar sessão:', err);
  $('login-screen').hidden = false;
  $('app').hidden = true;
});


/* =========================================================
   ENSAIOS (SESSÕES DE CLIENTES)
   ========================================================= */

const SESSIONS_BUCKET = 'fotos';
const numero = (i) => String(i + 1).padStart(4, '0');

function statusLabel(status) {
  if (status === 'entregue') return 'Entregue';
  if (status === 'selecionado') return 'Cliente escolheu';
  if (status === 'aguardando_selecao') return 'Aguardando seleção';
  return 'Preparando fotos';
}

async function loadSessions() {
  const { data, error } = await supabase.from('ensaios').select('*').order('created_at', { ascending: false });
  if (error) {
    flash(`Erro ao carregar ensaios: ${error.message}`, 'erro');
    return;
  }
  sessionsCache = data || [];
  renderSessions();
}

function renderSessions() {
  const c = $('sessions-list');
  if (!sessionsCache.length) {
    c.innerHTML = `
      <div class="panel">
        <p class="section-eyebrow">Ainda vazio</p>
        <h2 style="font-family:var(--font-display);font-weight:400;">Nenhum ensaio criado.</h2>
        <p class="panel-copy" style="margin-top:8px;">Comece criando a primeira sessão de cliente.</p>
      </div>`;
    return;
  }
  c.innerHTML = sessionsCache.map(s => `
    <article class="gallery-admin-card" data-session-id="${attr(s.id)}" title="Clique para abrir o ensaio">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
        <div>
          <div class="gallery-card-title">${esc(s.titulo)}</div>
          <div class="gallery-meta">${esc(s.cliente_nome || '—')} · /${esc(s.slug)}</div>
        </div>
        <span class="status-pill ${s.status === 'preparando' ? 'draft' : 'published'}">${esc(statusLabel(s.status))}</span>
      </div>
      <div class="card-actions" style="margin-top:14px;justify-content:flex-start;">
        <button class="small-btn" data-open-session="${attr(s.id)}" type="button">Abrir</button>
        <button class="small-btn" data-delete-session="${attr(s.id)}" type="button">Excluir</button>
      </div>
    </article>`).join('');

  c.querySelectorAll('.gallery-admin-card').forEach(card => card.addEventListener('click', () => openSessionModal(card.dataset.sessionId)));
  c.querySelectorAll('[data-open-session]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openSessionModal(b.dataset.openSession); }));
  c.querySelectorAll('[data-delete-session]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); excluirSession(b.dataset.deleteSession); }));
}

function openSessionForm() {
  $('session-form-wrap').hidden = false;
  $('session-form-title').textContent = 'Novo ensaio';
  $('session-form').reset();
  msg($('session-form-msg'), '');
  $('session-titulo').focus();
}

function closeSessionForm() {
  $('session-form-wrap').hidden = true;
  $('session-form').reset();
  msg($('session-form-msg'), '');
}

async function saveSession(e) {
  e.preventDefault();
  const msgEl = $('session-form-msg');
  const p = {
    titulo: $('session-titulo').value.trim(),
    cliente_nome: $('session-cliente').value.trim(),
    cliente_telefone: $('session-telefone').value.replace(/\D/g, ''),
    categoria: $('session-categoria').value,
    codigo_acesso: $('session-codigo').value,
    slug: slugify($('session-login').value)
  };
  const { error } = await supabase.from('ensaios').insert(p);
  if (error) {
    msgEl.textContent = (error.message.includes('duplicate') || error.message.includes('unique'))
      ? `O login "${p.slug}" já está em uso por outro ensaio. Escolha outro.`
      : 'Erro ao criar: ' + error.message;
    msgEl.className = 'msg erro';
    return;
  }
  msgEl.textContent = 'Ensaio criado!';
  msgEl.className = 'msg sucesso';
  $('session-form').reset();
  $('session-form-wrap').hidden = true;
  await loadSessions();
}

async function openSessionModal(id) {
  const s = sessionsCache.find(x => x.id === id);
  if (!s) return;
  currentSession = s;
  $('session-editor-modal').hidden = false;
  await loadSessionPhotos();
}

function closeSessionModal() {
  $('session-editor-modal').hidden = true;
  currentSession = null;
  currentSessionPhotos = [];
}

async function loadSessionPhotos() {
  if (!currentSession) return;
  const { data, error } = await supabase.from('fotos').select('*').eq('ensaio_id', currentSession.id).order('ordem');
  if (error) {
    msg($('session-msg'), error.message, 'erro');
    return;
  }
  currentSessionPhotos = data || [];
  renderSessionDetail();
}

function renderSessionDetail() {
  if (!currentSession) return;
  const s = currentSession;
  const linkCliente = `${location.origin}/area-cliente`;

  $('modal-session-title').textContent = s.titulo;
  $('session-link').textContent = linkCliente;
  $('session-login-box').textContent = s.slug;
  $('session-senha').textContent = s.codigo_acesso;

  const provas = currentSessionPhotos.filter(f => f.tipo === 'prova');
  const finais = currentSessionPhotos.filter(f => f.tipo === 'final');
  const selecionadas = provas.filter(f => f.selecionada);

  $('prova-count').textContent = provas.length;
  $('final-count').textContent = finais.length;

  $('prova-grid').innerHTML = provas.length
    ? provas.map((f, i) => `
        <div class="session-photo ${f.selecionada ? 'selecionada' : ''}">
          <img src="${attr(f.url)}" alt="" loading="lazy">
          <span class="photo-order">${numero(i)}</span>
        </div>`).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma prova enviada ainda.</p>';

  const numerosSelecionados = selecionadas.map(f => numero(provas.indexOf(f))).join(', ');
  $('selecionadas-box').innerHTML = selecionadas.length
    ? `<div class="session-select-box"><p class="footer-mono" style="margin-bottom:4px;">Fotos que a cliente escolheu (${selecionadas.length}):</p><p style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);">${esc(numerosSelecionados.replaceAll(', ', '.cr3, ') + '.cr3')}</p></div>`
    : '';

  $('final-grid').innerHTML = finais.length
    ? finais.map(f => `<div class="session-photo"><img src="${attr(f.url)}" alt="" loading="lazy"></div>`).join('')
    : '<p class="panel-copy" style="grid-column:1/-1;padding:10px;">Nenhuma foto final enviada ainda.</p>';

  const linkWhatsSelecao = s.cliente_telefone
    ? `https://wa.me/${s.cliente_telefone}?text=${encodeURIComponent(`Olá${s.cliente_nome ? ', ' + s.cliente_nome : ''}! Suas fotos já estão prontas para você escolher as favoritas! \n\nAcesse: ${linkCliente}\nLogin: ${s.slug}\nSenha: ${s.codigo_acesso}`)}`
    : null;

  const acoes = $('selecao-actions');
  if (s.status === 'preparando') {
    acoes.innerHTML = `<button class="btn btn-accent" id="btn-enviar-selecao" ${provas.length === 0 ? 'disabled' : ''}>Enviar fotos para seleção</button>`;
    $('btn-enviar-selecao').addEventListener('click', enviarParaSelecao);
  } else {
    acoes.innerHTML = `<span class="status-pill published">✓ Já enviado para seleção</span>` + (linkWhatsSelecao ? `<a href="${attr(linkWhatsSelecao)}" target="_blank" rel="noopener" class="small-btn">Notificar por WhatsApp</a>` : '');
  }

  const btnEntregar = $('btn-entregar');
  btnEntregar.textContent = s.status === 'entregue' ? 'Já entregue ✓' : 'Marcar como entregue';
  btnEntregar.className = s.status === 'entregue' ? 'btn' : 'btn btn-accent';
  btnEntregar.disabled = s.status === 'entregue' || finais.length === 0;

  const linkWhatsEntrega = s.cliente_telefone
    ? `https://wa.me/${s.cliente_telefone}?text=${encodeURIComponent(`Olá${s.cliente_nome ? ', ' + s.cliente_nome : ''}! Suas fotos finais já estão prontas para download! \n\nAcesse: ${linkCliente}\nLogin: ${s.slug}\nSenha: ${s.codigo_acesso}`)}`
    : null;
  const whatsEntrega = $('link-whats-entrega');
  if (s.status === 'entregue' && linkWhatsEntrega) {
    whatsEntrega.href = linkWhatsEntrega;
    whatsEntrega.style.display = '';
  } else {
    whatsEntrega.style.display = 'none';
  }

  msg($('session-msg'), '');
}

async function uploadSessionPhotos(files, tipo) {
  if (!currentSession) return;
  const msgEl = $('session-msg');
  msgEl.textContent = `Enviando ${files.length} foto(s)...`;
  msgEl.className = 'msg';

  for (const file of files) {
    const path = `${currentSession.id}/${tipo}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(SESSIONS_BUCKET).upload(path, file);
    if (upErr) {
      msgEl.textContent = 'Erro ao enviar: ' + upErr.message;
      msgEl.className = 'msg erro';
      continue;
    }
    const { data: urlData } = supabase.storage.from(SESSIONS_BUCKET).getPublicUrl(path);
    await supabase.from('fotos').insert({ ensaio_id: currentSession.id, url: urlData.publicUrl, tipo });
  }

  msgEl.textContent = 'Fotos enviadas!';
  msgEl.className = 'msg sucesso';
  await loadSessionPhotos();
}

async function enviarParaSelecao() {
  if (!currentSession) return;
  const msgEl = $('session-msg');
  const { error } = await supabase.from('ensaios').update({ status: 'aguardando_selecao' }).eq('id', currentSession.id);
  if (error) {
    msgEl.textContent = 'Erro: ' + error.message;
    msgEl.className = 'msg erro';
    return;
  }
  currentSession.status = 'aguardando_selecao';
  msgEl.textContent = 'Fotos enviadas para seleção! A cliente já pode acessar.';
  msgEl.className = 'msg sucesso';
  await loadSessions();
  renderSessionDetail();
}

async function marcarEntregue() {
  if (!currentSession) return;
  const msgEl = $('session-msg');
  const { error } = await supabase.from('ensaios').update({ status: 'entregue' }).eq('id', currentSession.id);
  if (error) {
    msgEl.textContent = 'Erro: ' + error.message;
    msgEl.className = 'msg erro';
    return;
  }
  currentSession.status = 'entregue';
  msgEl.textContent = 'Marcado como entregue!';
  msgEl.className = 'msg sucesso';
  await loadSessions();
  renderSessionDetail();
}

async function excluirSession(id) {
  const s = sessionsCache.find(x => x.id === id);
  if (!s) return;
  const confirmado = confirm(`Tem certeza que quer excluir "${s.titulo}"?\n\nIsso apaga TODAS as fotos e dados desse ensaio para sempre. Não tem como desfazer.`);
  if (!confirmado) return;

  flash('Excluindo...', 'erro');

  for (const subpasta of ['prova', 'final']) {
    const { data: arquivos } = await supabase.storage.from(SESSIONS_BUCKET).list(`${id}/${subpasta}`);
    if (arquivos && arquivos.length) {
      const caminhos = arquivos.map(a => `${id}/${subpasta}/${a.name}`);
      await supabase.storage.from(SESSIONS_BUCKET).remove(caminhos);
    }
  }

  const { error } = await supabase.from('ensaios').delete().eq('id', id);
  if (error) {
    flash(`Erro ao excluir: ${error.message}`, 'erro');
    return;
  }
  flash('Ensaio excluído.', 'sucesso');
  closeSessionModal();
  await loadSessions();
}

function copySession() {
  if (!currentSession) return;
  const texto = `Acesse em: ${location.origin}/area-cliente\nLogin: ${currentSession.slug}\nSenha: ${currentSession.codigo_acesso}`;
  navigator.clipboard.writeText(texto);
  const btn = $('btn-copy-session');
  btn.textContent = 'Copiado!';
  setTimeout(() => { btn.textContent = 'Copiar tudo'; }, 1500);
}

$('new-session-btn').addEventListener('click', openSessionForm);
$('close-session-form').addEventListener('click', closeSessionForm);
$('cancel-session-form').addEventListener('click', closeSessionForm);
$('session-form').addEventListener('submit', saveSession);
$('btn-gerar-login').addEventListener('click', () => { $('session-login').value = 'cliente-' + Math.random().toString(36).slice(2, 8); });
$('btn-gerar-codigo').addEventListener('click', () => { $('session-codigo').value = Math.random().toString(36).slice(2, 8).toUpperCase(); });
$('btn-copy-session').addEventListener('click', copySession);
$('btn-entregar').addEventListener('click', marcarEntregue);
$('btn-excluir-session').addEventListener('click', () => excluirSession(currentSession && currentSession.id));
$('upload-prova').addEventListener('change', async e => {
  const f = [...e.target.files];
  if (f.length && currentSession) await uploadSessionPhotos(f, 'prova');
  e.target.value = '';
});
$('upload-final').addEventListener('change', async e => {
  const f = [...e.target.files];
  if (f.length && currentSession) await uploadSessionPhotos(f, 'final');
  e.target.value = '';
});
document.querySelectorAll('[data-close-session-modal]').forEach(e => e.addEventListener('click', closeSessionModal));
