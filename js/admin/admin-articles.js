/* ==========================================================
   admin-articles.js — Article management + Quill editor
   True Jiu Jitsu Online

   Handles:
     - Listing all articles with status
     - Create new article with Quill rich text editor
     - Edit existing article
     - Publish / unpublish toggle
     - Delete article
   ========================================================== */

let allArticles = [];
let categories  = [];
let editingId   = null;
let quillEditor = null;


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id        = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className   = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}


/* ----------------------------------------------------------
   Render article list
   ---------------------------------------------------------- */
function renderArticleList() {
  const list = document.getElementById('article-list');
  if (!list) return;

  if (!allArticles.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📝</div>
        <h3>No articles yet</h3>
        <p>Write your first article to get started.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  allArticles.forEach(article => {
    const item = document.createElement('div');
    item.className  = 'content-list-item';
    item.dataset.id = article.id;

    item.innerHTML = `
      ${article.thumbnail_url
        ? `<img src="${article.thumbnail_url}" class="content-list-item__thumbnail" alt="${article.title}" loading="lazy">`
        : `<div class="content-list-item__thumbnail" style="background:var(--color-dark-gray);border-radius:var(--border-radius);"></div>`
      }
      <div class="content-list-item__info">
        <p class="content-list-item__title">${article.title}</p>
        <div class="content-list-item__meta">
          <span>${article.categories?.name || 'Uncategorized'}</span>
          <span>${formatDate(article.created_at)}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <label class="toggle" title="${article.published ? 'Click to unpublish' : 'Click to publish'}">
          <input type="checkbox" class="toggle__input js-publish-toggle" data-id="${article.id}" ${article.published ? 'checked' : ''}>
          <div class="toggle__track"><div class="toggle__thumb"></div></div>
          <span class="toggle__label">${article.published ? 'Live' : 'Draft'}</span>
        </label>
        <button class="btn btn--ghost btn--sm js-edit-article" data-id="${article.id}">Edit</button>
        <button class="btn btn--danger btn--sm js-delete-article" data-id="${article.id}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

  // Publish toggles
  list.querySelectorAll('.js-publish-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id        = e.target.dataset.id;
      const published = e.target.checked;
      const label     = e.target.closest('.toggle').querySelector('.toggle__label');
      if (label) label.textContent = published ? 'Live' : 'Draft';

      const { error } = await window.supabaseClient
        .from('articles').update({ published }).eq('id', id);

      if (error) {
        showToast('Failed to update status', 'error');
        e.target.checked = !published;
      } else {
        const a = allArticles.find(a => a.id === id);
        if (a) a.published = published;
        showToast(published ? 'Article published' : 'Article set to draft');
      }
    });
  });

  list.querySelectorAll('.js-edit-article').forEach(btn => {
    btn.addEventListener('click', () => openEditor(btn.dataset.id));
  });

  list.querySelectorAll('.js-delete-article').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Open the article editor
   Pass null to create a new article, or an ID to edit.
   ---------------------------------------------------------- */
function openEditor(articleId = null) {
  editingId = articleId;

  const overlay   = document.getElementById('editor-overlay');
  const titleEl   = document.getElementById('editor-modal-title');

  titleEl.textContent = articleId ? 'Edit Article' : 'New Article';

  if (articleId) {
    const article = allArticles.find(a => a.id === articleId);
    if (!article) return;

    document.getElementById('article-title').value       = article.title || '';
    document.getElementById('article-category').value   = article.category_id || '';
    document.getElementById('article-thumbnail').value  = article.thumbnail_url || '';
    document.getElementById('article-published').checked = article.published || false;

    // Load content into Quill
    if (quillEditor) {
      quillEditor.root.innerHTML = article.body_html || '';
    }
  } else {
    // Clear the form for a new article
    document.getElementById('article-title').value       = '';
    document.getElementById('article-category').value   = '';
    document.getElementById('article-thumbnail').value  = '';
    document.getElementById('article-published').checked = false;
    if (quillEditor) quillEditor.setText('');
  }

  overlay.classList.add('is-open');
}

function closeEditor() {
  document.getElementById('editor-overlay').classList.remove('is-open');
  editingId = null;
}


/* ----------------------------------------------------------
   Save article
   ---------------------------------------------------------- */
async function saveArticle(e) {
  e.preventDefault();

  const title        = document.getElementById('article-title').value.trim();
  const categoryId   = document.getElementById('article-category').value || null;
  const thumbnailUrl = document.getElementById('article-thumbnail').value.trim() || null;
  const published    = document.getElementById('article-published').checked;
  const bodyHtml     = quillEditor ? quillEditor.root.innerHTML : '';

  if (!title) { showToast('Title is required', 'error'); return; }

  const saveBtn = document.getElementById('save-article-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    title,
    body_html:    bodyHtml,
    category_id:  categoryId,
    thumbnail_url: thumbnailUrl,
    published,
    updated_at:   new Date().toISOString(),
  };

  let error;

  if (editingId) {
    ({ error } = await window.supabaseClient
      .from('articles').update(payload).eq('id', editingId));
  } else {
    // Generate a slug from the title — ensure uniqueness with a timestamp suffix
    payload.slug = `${slugify(title)}-${Date.now()}`;
    ({ error } = await window.supabaseClient.from('articles').insert(payload));
  }

  if (error) {
    console.error('Save error:', error);
    showToast('Failed to save article', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Article';
    return;
  }

  showToast(editingId ? 'Changes saved' : 'Article created!');
  closeEditor();
  await loadArticles();
  renderArticleList();
}


/* ----------------------------------------------------------
   Delete article
   ---------------------------------------------------------- */
async function confirmDelete(articleId) {
  const article = allArticles.find(a => a.id === articleId);
  if (!article) return;

  if (!confirm(`Delete "${article.title}"? This cannot be undone.`)) return;

  const { error } = await window.supabaseClient
    .from('articles').delete().eq('id', articleId);

  if (error) { showToast('Failed to delete article', 'error'); return; }

  showToast('Article deleted');
  allArticles = allArticles.filter(a => a.id !== articleId);
  renderArticleList();
}


/* ----------------------------------------------------------
   Populate category dropdown
   ---------------------------------------------------------- */
function populateCategoryDropdown() {
  const select = document.getElementById('article-category');
  if (!select) return;
  select.innerHTML = `<option value="">No category</option>`;
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}


/* ----------------------------------------------------------
   Load data
   ---------------------------------------------------------- */
async function loadArticles() {
  const { data } = await window.supabaseClient
    .from('articles')
    .select('*, categories(name)')
    .order('created_at', { ascending: false });
  allArticles = data || [];
}

async function loadCategories() {
  const { data } = await window.supabaseClient
    .from('categories').select('id, name').order('display_order');
  categories = data || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const btn = document.createElement('button');
    btn.className   = 'btn btn--primary btn--sm';
    btn.textContent = '+ New Article';
    btn.addEventListener('click', () => openEditor());
    actions.appendChild(btn);
  }

  content.innerHTML = `

    <div class="content-list" id="article-list">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>

    <!-- Article editor modal -->
    <div class="modal-overlay" id="editor-overlay" style="align-items:flex-start;padding-top:var(--nav-height);">
      <div class="modal" style="max-width:760px;width:100%;max-height:calc(100vh - var(--nav-height) - 40px);overflow-y:auto;">

        <div class="modal__header">
          <h2 class="modal__title" id="editor-modal-title">New Article</h2>
          <button class="modal__close" id="close-editor-btn" aria-label="Close">✕</button>
        </div>

        <form class="form" id="article-form">

          <div class="form__group">
            <label class="form__label" for="article-title">Title *</label>
            <input class="form__input" type="text" id="article-title" placeholder="e.g. The Basics of Guard Retention" required>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="article-category">Category</label>
              <select class="form__select" id="article-category"></select>
            </div>
            <div class="form__group">
              <label class="form__label" for="article-thumbnail">Thumbnail URL</label>
              <input class="form__input" type="url" id="article-thumbnail" placeholder="https://…">
            </div>
          </div>

          <!-- Quill editor -->
          <div class="form__group">
            <label class="form__label">Content</label>
            <div id="quill-editor-container"></div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label class="toggle">
              <input type="checkbox" class="toggle__input" id="article-published">
              <div class="toggle__track"><div class="toggle__thumb"></div></div>
              <span class="toggle__label" style="margin-left:var(--space-sm);font-size:var(--text-sm);color:var(--color-gray);">Publish immediately</span>
            </label>
            <div style="display:flex;gap:var(--space-md);">
              <button type="button" class="btn btn--secondary" id="cancel-article-btn">Cancel</button>
              <button type="submit" class="btn btn--primary" id="save-article-btn">Save Article</button>
            </div>
          </div>

        </form>
      </div>
    </div>
  `;
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('articles', 'Articles');
  buildPage(content);

  await Promise.all([loadArticles(), loadCategories()]);
  populateCategoryDropdown();
  renderArticleList();

  // Initialize Quill editor
  quillEditor = new Quill('#quill-editor-container', {
    theme:   'snow',
    placeholder: 'Write your article here…',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
      ],
    },
  });

  // Wire events
  document.getElementById('close-editor-btn')?.addEventListener('click', closeEditor);
  document.getElementById('cancel-article-btn')?.addEventListener('click', closeEditor);
  document.getElementById('article-form')?.addEventListener('submit', saveArticle);
  document.getElementById('editor-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('editor-overlay')) closeEditor();
  });

})();
