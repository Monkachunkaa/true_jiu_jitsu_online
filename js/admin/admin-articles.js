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
let editingId   = null;
let quillEditor = null;


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

// formatDate and showToast are defined in admin-auth.js,
// which is loaded before this file on every admin page.

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
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
          <span>${formatDate(article.created_at)}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <label class="toggle">
          <input type="checkbox" class="toggle__input js-publish-toggle"
            data-id="${article.id}" ${article.published ? 'checked' : ''}>
          <div class="toggle__track"><div class="toggle__thumb"></div></div>
          <span class="toggle__label">${article.published ? 'Live' : 'Draft'}</span>
        </label>
        <button class="btn btn--ghost btn--sm js-edit-article" data-id="${article.id}">Edit</button>
        <button class="btn btn--danger btn--sm js-delete-article" data-id="${article.id}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

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
   async so we can await the tag fetch when editing.
   ---------------------------------------------------------- */
async function openEditor(articleId = null) {
  editingId = articleId;

  const titleEl = document.getElementById('editor-modal-title');
  titleEl.textContent = articleId ? 'Edit Article' : 'New Article';

  if (articleId) {
    const article = allArticles.find(a => a.id === articleId);
    if (!article) return;

    document.getElementById('article-title').value        = article.title     || '';
    document.getElementById('article-published').checked  = article.published || false;

    if (window._articleUploader) {
      window._articleUploader.setUrl(article.thumbnail_url || null);
    }

    // Load existing tags
    const articleTagWrap = document.getElementById('article-tag-picker');
    if (articleTagWrap) {
      const { data: existingTags } = await window.supabaseClient
        .from('article_tags').select('tag_id').eq('article_id', articleId);
      const selectedTagIds = (existingTags || []).map(t => t.tag_id);
      createTagPicker(articleTagWrap, selectedTagIds).then(p => { window._articleTagPicker = p; });
    }

    if (quillEditor) quillEditor.root.innerHTML = article.body_html || '';

  } else {
    // Clear form for new article
    document.getElementById('article-title').value       = '';
    document.getElementById('article-published').checked = false;
    if (window._articleUploader) window._articleUploader.setUrl(null);
    if (quillEditor) quillEditor.setText('');
  }

  document.getElementById('editor-overlay').classList.add('is-open');
}

function closeEditor() {
  document.getElementById('editor-overlay').classList.remove('is-open');
  const saveBtn = document.getElementById('save-article-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Article'; }
  editingId = null;
}


/* ----------------------------------------------------------
   Save article
   ---------------------------------------------------------- */
async function saveArticle(e) {
  e.preventDefault();

  const title        = document.getElementById('article-title').value.trim();
  const thumbnailUrl = window._articleUploader?.getUrl() || null;
  const published    = document.getElementById('article-published').checked;
  const bodyHtml     = quillEditor ? quillEditor.root.innerHTML : '';

  if (!title) { showToast('Title is required', 'error'); return; }

  const saveBtn       = document.getElementById('save-article-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    title,
    body_html:     bodyHtml,
    thumbnail_url: thumbnailUrl,
    published,
    updated_at:    new Date().toISOString(),
  };

  let error;

  if (editingId) {
    ({ error } = await window.supabaseClient
      .from('articles').update(payload).eq('id', editingId));

    if (!error) {
      await window.supabaseClient.from('article_tags').delete().eq('article_id', editingId);
      const tagIds = window._articleTagPicker?.getSelectedIds() || [];
      if (tagIds.length) {
        await window.supabaseClient.from('article_tags').insert(
          tagIds.map(tag_id => ({ article_id: editingId, tag_id }))
        );
      }
    }
  } else {
    payload.slug = `${slugify(title)}-${Date.now()}`;
    const { data: newArticle, error: insertError } = await window.supabaseClient
      .from('articles').insert(payload).select('id').single();
    error = insertError;

    if (!error && newArticle) {
      const tagIds = window._articleTagPicker?.getSelectedIds() || [];
      if (tagIds.length) {
        await window.supabaseClient.from('article_tags').insert(
          tagIds.map(tag_id => ({ article_id: newArticle.id, tag_id }))
        );
      }
    }
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

  // Use inline confirmation instead of browser confirm()
  const btn = document.querySelector(`.js-delete-article[data-id="${articleId}"]`);
  if (!btn) return;

  confirmAction(btn, `Delete "${article.title}"?`, async () => {
    const { error } = await window.supabaseClient
      .from('articles').delete().eq('id', articleId);
    if (error) { showToast('Failed to delete article', 'error'); return; }
    showToast('Article deleted');
    allArticles = allArticles.filter(a => a.id !== articleId);
    renderArticleList();
  });
}


/* ----------------------------------------------------------
   Load articles
   ---------------------------------------------------------- */
async function loadArticles() {
  const { data } = await window.supabaseClient
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });
  allArticles = data || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const btn       = document.createElement('button');
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
    <div class="modal-overlay" id="editor-overlay"
         style="align-items:flex-start;padding-top:var(--nav-height);">
      <div class="modal"
           style="max-width:760px;width:100%;max-height:calc(100vh - var(--nav-height) - 40px);overflow-y:auto;">

        <div class="modal__header">
          <h2 class="modal__title" id="editor-modal-title">New Article</h2>
          <button class="modal__close" id="close-editor-btn" aria-label="Close">✕</button>
        </div>

        <form class="form" id="article-form">

          <div class="form__group">
            <label class="form__label" for="article-title">Title *</label>
            <input class="form__input" type="text" id="article-title"
              placeholder="e.g. The Basics of Guard Retention" required>
          </div>

          <div class="form__group">
            <label class="form__label">Thumbnail</label>
            <div id="article-thumbnail-wrap"></div>
          </div>

          <div class="form__group">
            <label class="form__label">Content</label>
            <div id="quill-editor-container"></div>
          </div>

          <div class="form__group">
            <label class="form__label">Tags</label>
            <div id="article-tag-picker"></div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label class="toggle">
              <input type="checkbox" class="toggle__input" id="article-published">
              <div class="toggle__track"><div class="toggle__thumb"></div></div>
              <span style="margin-left:var(--space-sm);font-size:var(--text-sm);color:var(--color-gray);">
                Publish immediately
              </span>
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

  await loadArticles();
  renderArticleList();

  // Initialize Quill rich text editor
  quillEditor = new Quill('#quill-editor-container', {
    theme:       'snow',
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

  // Initialize thumbnail uploader
  const thumbWrap = document.getElementById('article-thumbnail-wrap');
  if (thumbWrap) window._articleUploader = createThumbnailUploader(thumbWrap);

  // Initialize tag picker
  const tagWrap = document.getElementById('article-tag-picker');
  if (tagWrap) createTagPicker(tagWrap, []).then(p => { window._articleTagPicker = p; });

  // Wire events
  document.getElementById('close-editor-btn')?.addEventListener('click', closeEditor);
  document.getElementById('cancel-article-btn')?.addEventListener('click', closeEditor);
  document.getElementById('article-form')?.addEventListener('submit', saveArticle);
  safeModalClose('editor-overlay', closeEditor);

})();
