/**
 * Controlador visual de Categorias.
 * Mantém exatamente o HTML e os eventos do Admin V2 atual, mas tira
 * a manipulação de DOM do arquivo principal admin-v2.js.
 */
export function renderCategorySelectUI({ $, categories, esc }) {
  const select = $('gallery-category');
  if (!select) return;

  const current = select.value;
  select.innerHTML =
    '<option value="">Sem categoria</option>' +
    categories
      .map(category => `<option value="${category.id}">${esc(category.name)}</option>`)
      .join('');
  select.value = current;
}

export function renderCategoriesUI({
  $,
  categories,
  esc,
  onEdit,
  onDelete,
  withOperationLock
}) {
  const container = $('categories-list');
  if (!container) return;

  if (!categories.length) {
    container.innerHTML = '<p class="panel-copy">Nenhuma categoria cadastrada.</p>';
    return;
  }

  container.innerHTML = categories
    .map(category => `
      <div class="category-row">
        <div class="category-name">${esc(category.name)}</div>
        <div class="category-slug">${esc(category.slug)}</div>
        <div class="category-order">${category.sort_order}</div>
        <div class="card-actions">
          <button class="small-btn" data-edit-category="${category.id}">Editar</button>
          <button class="small-btn" data-delete-category="${category.id}">Excluir</button>
        </div>
      </div>
    `)
    .join('');

  container.querySelectorAll('[data-edit-category]').forEach(button => {
    button.addEventListener('click', () => onEdit(button.dataset.editCategory));
  });

  container.querySelectorAll('[data-delete-category]').forEach(button => {
    button.addEventListener('click', () =>
      withOperationLock(
        'delete-category:' + button.dataset.deleteCategory,
        () => onDelete(button.dataset.deleteCategory)
      )
    );
  });
}
