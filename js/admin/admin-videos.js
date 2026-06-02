/* ==========================================================
   admin-videos.js — Video library management
   True Jiu Jitsu Online

   Handles:
     - Listing all videos with status
     - Upload modal: direct upload to Cloudflare Stream
     - Edit modal: update title, description, category, thumbnail
     - Publish / unpublish toggle
     - Delete video
   ========================================================== */


/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let allVideos    = [];
let categories   = [];
let editingId    = null;   // video ID currently being edited
let uploadVideoId = null;  // Cloudflare video ID from current upload


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
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
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}


/* ----------------------------------------------------------
   Render the video list
   ---------------------------------------------------------- */
function renderVideoList() {
  const list = document.getElementById('video-list');
  if (!list) return;

  if (!allVideos.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎬</div>
        <h3>No videos yet</h3>
        <p>Upload your first video to get started.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  allVideos.forEach(video => {
    const item = document.createElement('div');
    item.className      = 'content-list-item';
    item.dataset.id     = video.id;

    item.innerHTML = `
      ${video.thumbnail_url
        ? `<img src="${video.thumbnail_url}" class="content-list-item__thumbnail" alt="${video.title}" loading="lazy">`
        : `<div class="content-list-item__thumbnail" style="background:var(--color-dark-gray);border-radius:var(--border-radius);"></div>`
      }
      <div class="content-list-item__info">
        <p class="content-list-item__title">${video.title}</p>
        <div class="content-list-item__meta">
          <span>${video.categories?.name || 'Uncategorized'}</span>
          <span>${formatDuration(video.duration_seconds)}</span>
          <span>${formatDate(video.created_at)}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <!-- Published toggle -->
        <label class="toggle" title="${video.published ? 'Click to unpublish' : 'Click to publish'}">
          <input
            type="checkbox"
            class="toggle__input js-publish-toggle"
            data-id="${video.id}"
            ${video.published ? 'checked' : ''}
          >
          <div class="toggle__track"><div class="toggle__thumb"></div></div>
          <span class="toggle__label">${video.published ? 'Live' : 'Draft'}</span>
        </label>
        <button class="btn btn--ghost btn--sm js-edit-video" data-id="${video.id}">Edit</button>
        <button class="btn btn--danger btn--sm js-delete-video" data-id="${video.id}">Delete</button>
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
        .from('videos')
        .update({ published })
        .eq('id', id);

      if (error) {
        showToast('Failed to update status', 'error');
        e.target.checked = !published;
      } else {
        const v = allVideos.find(v => v.id === id);
        if (v) v.published = published;
        showToast(published ? 'Video published' : 'Video set to draft');
      }
    });
  });

  // Edit buttons
  list.querySelectorAll('.js-edit-video').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  // Delete buttons
  list.querySelectorAll('.js-delete-video').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Upload modal — Step 1: choose file and upload to Cloudflare
   ---------------------------------------------------------- */
function openUploadModal() {
  document.getElementById('upload-modal-overlay').classList.add('is-open');
  resetUploadModal();
}

function closeUploadModal() {
  document.getElementById('upload-modal-overlay').classList.remove('is-open');
  resetUploadModal();
  uploadVideoId = null;
}

function resetUploadModal() {
  document.getElementById('upload-step-1').style.display = '';
  document.getElementById('upload-step-2').style.display = 'none';
  document.getElementById('upload-zone').classList.remove('is-dragging');
  document.getElementById('upload-progress-wrap').style.display = 'none';
  document.getElementById('upload-progress-bar').style.width = '0%';
  document.getElementById('upload-file-input').value = '';
  uploadVideoId = null;
}

function showUploadStep2() {
  document.getElementById('upload-step-1').style.display = 'none';
  document.getElementById('upload-step-2').style.display = '';
}

async function uploadFileToClouflare(file) {
  const { data: { session } } = await window.supabaseClient.auth.getSession();

  // Get a direct upload URL from our Netlify function
  const res = await fetch('/.netlify/functions/admin-upload-video', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ fileName: file.name }),
  });

  if (!res.ok) {
    showToast('Failed to get upload URL', 'error');
    return;
  }

  const { uploadUrl, videoId } = await res.json();
  uploadVideoId = videoId;

  // Upload directly to Cloudflare using XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        document.getElementById('upload-progress-bar').style.width = `${pct}%`;
        document.getElementById('upload-progress-label').textContent = `Uploading… ${pct}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload error')));

    xhr.open('POST', uploadUrl);
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

function setupUploadZone() {
  const zone      = document.getElementById('upload-zone');
  const fileInput = document.getElementById('upload-file-input');
  const progressWrap = document.getElementById('upload-progress-wrap');

  // Click to browse
  zone.addEventListener('click', () => fileInput.click());

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-dragging');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
  });

  async function handleFileSelected(file) {
    // Show progress
    progressWrap.style.display = '';
    document.getElementById('upload-progress-label').textContent = 'Uploading…';
    document.getElementById('upload-progress-bar').style.width = '0%';

    try {
      await uploadFileToClouflare(file);
      document.getElementById('upload-progress-label').textContent = '✓ Upload complete — fill in the details below';
      document.getElementById('upload-progress-bar').style.width = '100%';
      document.getElementById('upload-progress-bar').style.background = 'var(--color-success)';

      // Move to step 2 after a short pause
      setTimeout(showUploadStep2, 600);
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Upload failed. Please try again.', 'error');
      resetUploadModal();
    }
  }
}


/* ----------------------------------------------------------
   Save new video (step 2 of upload)
   ---------------------------------------------------------- */
async function saveNewVideo(e) {
  e.preventDefault();

  if (!uploadVideoId) {
    showToast('No video uploaded yet', 'error');
    return;
  }

  const title       = document.getElementById('new-video-title').value.trim();
  const description = document.getElementById('new-video-description').value.trim();
  const categoryId  = document.getElementById('new-video-category').value || null;
  const thumbnailUrl = document.getElementById('new-video-thumbnail').value.trim() || null;
  const published   = document.getElementById('new-video-published').checked;

  if (!title) {
    showToast('Please enter a title', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-new-video-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await window.supabaseClient.from('videos').insert({
    title,
    description:        description || null,
    cloudflare_video_id: uploadVideoId,
    category_id:        categoryId,
    thumbnail_url:      thumbnailUrl,
    published,
  });

  if (error) {
    console.error('Save error:', error);
    showToast('Failed to save video', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Video';
    return;
  }

  showToast('Video saved successfully!');
  closeUploadModal();
  await loadVideos();
  renderVideoList();
}


/* ----------------------------------------------------------
   Edit modal — update existing video metadata
   ---------------------------------------------------------- */
function openEditModal(videoId) {
  editingId     = videoId;
  const video   = allVideos.find(v => v.id === videoId);
  if (!video) return;

  document.getElementById('edit-video-title').value       = video.title || '';
  document.getElementById('edit-video-description').value = video.description || '';
  document.getElementById('edit-video-category').value    = video.category_id || '';
  document.getElementById('edit-video-thumbnail').value   = video.thumbnail_url || '';
  document.getElementById('edit-video-published').checked = video.published || false;

  document.getElementById('edit-modal-overlay').classList.add('is-open');
}

function closeEditModal() {
  document.getElementById('edit-modal-overlay').classList.remove('is-open');
  editingId = null;
}

async function saveEditedVideo(e) {
  e.preventDefault();
  if (!editingId) return;

  const title        = document.getElementById('edit-video-title').value.trim();
  const description  = document.getElementById('edit-video-description').value.trim();
  const categoryId   = document.getElementById('edit-video-category').value || null;
  const thumbnailUrl = document.getElementById('edit-video-thumbnail').value.trim() || null;
  const published    = document.getElementById('edit-video-published').checked;

  if (!title) { showToast('Title is required', 'error'); return; }

  const saveBtn = document.getElementById('save-edit-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await window.supabaseClient
    .from('videos')
    .update({ title, description: description || null, category_id: categoryId, thumbnail_url: thumbnailUrl, published, updated_at: new Date().toISOString() })
    .eq('id', editingId);

  if (error) {
    showToast('Failed to save changes', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Changes';
    return;
  }

  showToast('Changes saved');
  closeEditModal();
  await loadVideos();
  renderVideoList();
}


/* ----------------------------------------------------------
   Delete video
   ---------------------------------------------------------- */
async function confirmDelete(videoId) {
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return;

  if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;

  const { error } = await window.supabaseClient
    .from('videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    showToast('Failed to delete video', 'error');
    return;
  }

  showToast('Video deleted');
  allVideos = allVideos.filter(v => v.id !== videoId);
  renderVideoList();
}


/* ----------------------------------------------------------
   Populate category dropdowns
   ---------------------------------------------------------- */
function populateCategoryDropdowns() {
  const selects = document.querySelectorAll('.js-category-select');
  selects.forEach(select => {
    select.innerHTML = `<option value="">No category</option>`;
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value       = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  });
}


/* ----------------------------------------------------------
   Load videos from Supabase
   ---------------------------------------------------------- */
async function loadVideos() {
  const { data, error } = await window.supabaseClient
    .from('videos')
    .select('*, categories(name)')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Failed to load videos', 'error');
    return;
  }

  allVideos = data || [];
}


/* ----------------------------------------------------------
   Load categories
   ---------------------------------------------------------- */
async function loadCategories() {
  const { data } = await window.supabaseClient
    .from('categories')
    .select('id, name')
    .order('display_order');

  categories = data || [];
}


/* ----------------------------------------------------------
   Build the page HTML
   ---------------------------------------------------------- */
function buildPage(content) {

  // Add "Upload Video" button to the topbar
  const actions = getAdminActions();
  if (actions) {
    const btn = document.createElement('button');
    btn.className   = 'btn btn--primary btn--sm';
    btn.textContent = '+ Upload Video';
    btn.addEventListener('click', openUploadModal);
    actions.appendChild(btn);
  }

  content.innerHTML = `

    <!-- Video list -->
    <div class="content-list" id="video-list">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>

    <!-- ============================================================
         UPLOAD MODAL
         Step 1: drag/drop or browse to upload video to Cloudflare
         Step 2: fill in title, description, category, thumbnail
         ============================================================ -->
    <div class="modal-overlay" id="upload-modal-overlay">
      <div class="modal" style="max-width:560px;">
        <div class="modal__header">
          <h2 class="modal__title">Upload Video</h2>
          <button class="modal__close" id="close-upload-modal" aria-label="Close">✕</button>
        </div>

        <!-- Step 1: Upload -->
        <div id="upload-step-1">
          <div class="upload-zone" id="upload-zone">
            <svg class="upload-zone__icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p class="upload-zone__label"><strong>Click to browse</strong> or drag and drop your video here</p>
            <p class="upload-zone__hint">MP4, MOV, MKV — up to 30GB</p>
            <input type="file" id="upload-file-input" accept="video/*" style="display:none;">
          </div>

          <!-- Upload progress -->
          <div id="upload-progress-wrap" style="display:none; margin-top:var(--space-lg);">
            <p id="upload-progress-label" style="font-size:var(--text-sm);color:var(--color-gray);margin-bottom:var(--space-sm);max-width:none;"></p>
            <div class="progress-bar">
              <div class="progress-bar__fill" id="upload-progress-bar" style="width:0%;"></div>
            </div>
          </div>
        </div>

        <!-- Step 2: Video details -->
        <div id="upload-step-2" style="display:none;">
          <form class="form" id="new-video-form">

            <div class="form__group">
              <label class="form__label" for="new-video-title">Title *</label>
              <input class="form__input" type="text" id="new-video-title" placeholder="e.g. Guard Passing Fundamentals" required>
            </div>

            <div class="form__group">
              <label class="form__label" for="new-video-description">Description</label>
              <textarea class="form__textarea" id="new-video-description" rows="3" placeholder="Optional description of this video…"></textarea>
            </div>

            <div class="form__group">
              <label class="form__label" for="new-video-category">Category</label>
              <select class="form__select js-category-select" id="new-video-category"></select>
            </div>

            <div class="form__group">
              <label class="form__label" for="new-video-thumbnail">Thumbnail URL</label>
              <input class="form__input" type="url" id="new-video-thumbnail" placeholder="https://…">
              <span class="form__hint">Paste a URL to an image. Leave blank to use no thumbnail.</span>
            </div>

            <div style="display:flex; align-items:center; gap:var(--space-md);">
              <label class="toggle">
                <input type="checkbox" class="toggle__input" id="new-video-published">
                <div class="toggle__track"><div class="toggle__thumb"></div></div>
              </label>
              <span style="font-size:var(--text-sm);color:var(--color-gray);">Publish immediately</span>
            </div>

            <div style="display:flex; gap:var(--space-md); justify-content:flex-end;">
              <button type="button" class="btn btn--secondary" id="back-to-upload-btn">Back</button>
              <button type="submit" class="btn btn--primary" id="save-new-video-btn">Save Video</button>
            </div>

          </form>
        </div>

      </div>
    </div>

    <!-- ============================================================
         EDIT MODAL
         ============================================================ -->
    <div class="modal-overlay" id="edit-modal-overlay">
      <div class="modal" style="max-width:500px;">
        <div class="modal__header">
          <h2 class="modal__title">Edit Video</h2>
          <button class="modal__close" id="close-edit-modal" aria-label="Close">✕</button>
        </div>

        <form class="form" id="edit-video-form">

          <div class="form__group">
            <label class="form__label" for="edit-video-title">Title *</label>
            <input class="form__input" type="text" id="edit-video-title" required>
          </div>

          <div class="form__group">
            <label class="form__label" for="edit-video-description">Description</label>
            <textarea class="form__textarea" id="edit-video-description" rows="3"></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="edit-video-category">Category</label>
            <select class="form__select js-category-select" id="edit-video-category"></select>
          </div>

          <div class="form__group">
            <label class="form__label" for="edit-video-thumbnail">Thumbnail URL</label>
            <input class="form__input" type="url" id="edit-video-thumbnail" placeholder="https://…">
          </div>

          <div style="display:flex; align-items:center; gap:var(--space-md);">
            <label class="toggle">
              <input type="checkbox" class="toggle__input" id="edit-video-published">
              <div class="toggle__track"><div class="toggle__thumb"></div></div>
            </label>
            <span style="font-size:var(--text-sm);color:var(--color-gray);">Published</span>
          </div>

          <div style="display:flex; gap:var(--space-md); justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="cancel-edit-btn">Cancel</button>
            <button type="submit" class="btn btn--primary" id="save-edit-btn">Save Changes</button>
          </div>

        </form>
      </div>
    </div>
  `;
}


/* ----------------------------------------------------------
   Wire up all event listeners
   ---------------------------------------------------------- */
function wireEvents() {
  // Upload modal
  document.getElementById('close-upload-modal')?.addEventListener('click', closeUploadModal);
  document.getElementById('back-to-upload-btn')?.addEventListener('click', () => {
    document.getElementById('upload-step-2').style.display = 'none';
    document.getElementById('upload-step-1').style.display = '';
  });
  document.getElementById('new-video-form')?.addEventListener('submit', saveNewVideo);

  // Close upload modal on overlay click
  document.getElementById('upload-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('upload-modal-overlay')) closeUploadModal();
  });

  // Edit modal
  document.getElementById('close-edit-modal')?.addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit-btn')?.addEventListener('click', closeEditModal);
  document.getElementById('edit-video-form')?.addEventListener('submit', saveEditedVideo);

  // Close edit modal on overlay click
  document.getElementById('edit-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('edit-modal-overlay')) closeEditModal();
  });

  // Check if a specific video ID was passed in the URL to auto-open edit
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) openEditModal(editId);

  setupUploadZone();
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('videos', 'Videos');
  buildPage(content);

  // Load data
  await Promise.all([loadVideos(), loadCategories()]);
  populateCategoryDropdowns();
  renderVideoList();
  wireEvents();

})();
