/* ==========================================================
   admin-upload-image.js — Shared thumbnail uploader
   True Jiu Jitsu Online

   Provides a reusable drag-and-drop image upload component
   backed by Supabase Storage. Used across videos, articles,
   and playlists admin pages.

   Usage:
     const uploader = createThumbnailUploader(containerEl, existingUrl);
     const url = await uploader.getUrl(); // returns current URL or null
   ========================================================== */


/* ----------------------------------------------------------
   Upload an image file to Supabase Storage → thumbnails bucket.
   Returns the public URL of the uploaded image.
   ---------------------------------------------------------- */
async function uploadThumbnailToSupabase(file) {
  // Generate a unique filename using timestamp + random string
  const ext      = file.name.split('.').pop().toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await window.supabaseClient.storage
    .from('thumbnails')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert:       false,
      contentType:  file.type,
    });

  if (error) {
    console.error('Thumbnail upload error:', error);
    throw new Error('Upload failed');
  }

  // Get the public URL
  const { data: { publicUrl } } = window.supabaseClient.storage
    .from('thumbnails')
    .getPublicUrl(data.path);

  return publicUrl;
}


/* ----------------------------------------------------------
   createThumbnailUploader
   Renders a drag-and-drop image uploader into the given container.

   Parameters:
     container   — DOM element to render the uploader into
     existingUrl — optional existing thumbnail URL to preview

   Returns an object with:
     getUrl()    — returns the current thumbnail URL (or null)
     setUrl(url) — programmatically set the URL and show preview
   ---------------------------------------------------------- */
function createThumbnailUploader(container, existingUrl = null) {
  let currentUrl = existingUrl || null;

  container.innerHTML = `
    <div class="thumb-uploader">

      <!-- Preview — shown when a thumbnail is set -->
      <div class="thumb-uploader__preview" id="thumb-preview" style="${currentUrl ? '' : 'display:none;'}">
        <img
          src="${currentUrl || ''}"
          alt="Thumbnail preview"
          class="thumb-uploader__img"
          id="thumb-preview-img"
        >
        <button
          type="button"
          class="thumb-uploader__remove"
          id="thumb-remove-btn"
          aria-label="Remove thumbnail"
        >✕ Remove</button>
      </div>

      <!-- Drop zone — shown when no thumbnail is set -->
      <div class="thumb-uploader__zone ${currentUrl ? 'is-hidden' : ''}" id="thumb-drop-zone">
        <svg class="thumb-uploader__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21,15 16,10 5,21"/>
        </svg>
        <p class="thumb-uploader__label">
          <strong>Click to upload</strong> or drag and drop
        </p>
        <p class="thumb-uploader__hint">JPG, PNG, WebP — recommended 16:9</p>
        <input
          type="file"
          class="thumb-uploader__input"
          id="thumb-file-input"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style="display:none;"
        >
      </div>

      <!-- Upload state -->
      <div class="thumb-uploader__uploading" id="thumb-uploading" style="display:none;">
        <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
        <span>Uploading…</span>
      </div>

      <!-- Error -->
      <p class="thumb-uploader__error" id="thumb-error"></p>

    </div>
  `;

  const zone       = container.querySelector('#thumb-drop-zone');
  const input      = container.querySelector('#thumb-file-input');
  const preview    = container.querySelector('#thumb-preview');
  const previewImg = container.querySelector('#thumb-preview-img');
  const removeBtn  = container.querySelector('#thumb-remove-btn');
  const uploading  = container.querySelector('#thumb-uploading');
  const errorEl    = container.querySelector('#thumb-error');

  /* ----------------------------------------------------------
     Show the preview state
     ---------------------------------------------------------- */
  function showPreview(url) {
    currentUrl          = url;
    previewImg.src      = url;
    preview.style.display = '';
    zone.classList.add('is-hidden');
    errorEl.textContent = '';
  }

  /* ----------------------------------------------------------
     Show the drop zone state
     ---------------------------------------------------------- */
  function showDropZone() {
    currentUrl            = null;
    preview.style.display = 'none';
    zone.classList.remove('is-hidden');
    previewImg.src        = '';
  }

  /* ----------------------------------------------------------
     Handle file selection / drop
     ---------------------------------------------------------- */
  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      errorEl.textContent = 'Please upload an image file.';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      errorEl.textContent = 'Image must be under 10MB.';
      return;
    }

    // Show uploading state
    zone.classList.add('is-hidden');
    preview.style.display = 'none';
    uploading.style.display = 'flex';
    errorEl.textContent    = '';

    try {
      const url = await uploadThumbnailToSupabase(file);
      uploading.style.display = 'none';
      showPreview(url);
    } catch (err) {
      uploading.style.display = 'none';
      zone.classList.remove('is-hidden');
      errorEl.textContent = 'Upload failed. Please try again.';
    }
  }

  /* ----------------------------------------------------------
     Wire up events
     ---------------------------------------------------------- */

  // Click to browse
  zone.addEventListener('click', () => input.click());

  // File input change
  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

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
    if (file) handleFile(file);
  });

  // Remove thumbnail
  removeBtn.addEventListener('click', () => {
    input.value = '';
    showDropZone();
  });

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */
  return {
    getUrl: () => currentUrl,
    setUrl: (url) => {
      if (url) showPreview(url);
      else showDropZone();
    },
  };
}
