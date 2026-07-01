/* ==========================================================
   admin-playlists.js — Playlist builder
   True Jiu Jitsu Online

   Handles:
     - Listing all playlists with status
     - Create / edit playlist with drag-and-drop item ordering
     - Search and add videos and articles to a playlist
     - Publish / unpublish toggle
     - Delete playlist
   ========================================================== */

let allPlaylists   = [];
let allVideos      = [];
let allArticles    = [];
let allVideoTagMap = {};  // { video_id: [{ id, name, category }] }
let editingId      = null;
let playlistItems  = [];   // items currently in the playlist being edited


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

// formatDate and showToast are defined in admin-auth.js,
// which is loaded before this file on every admin page.


/* ----------------------------------------------------------
   Render playlist list
   ---------------------------------------------------------- */
function renderPlaylistList() {
  const list = document.getElementById('playlist-list');
  if (!list) return;

  if (!allPlaylists.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <h3>No playlists yet</h3>
        <p>Create a playlist and add videos to it.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  allPlaylists.forEach(playlist => {
    const item = document.createElement('div');
    item.className  = 'content-list-item';
    item.dataset.id = playlist.id;

    item.innerHTML = `
      ${playlist.thumbnail_url
        ? `<img src="${playlist.thumbnail_url}" class="content-list-item__thumbnail" alt="${playlist.title}" loading="lazy">`
        : `<div class="content-list-item__thumbnail" style="background:var(--color-dark-gray);border-radius:var(--border-radius);"></div>`
      }
      <div class="content-list-item__info">
        <p class="content-list-item__title">${playlist.title}</p>
        <div class="content-list-item__meta">
          <span>${playlist.item_count || 0} items</span>
          <span>${formatDate(playlist.created_at)}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <label class="toggle">
          <input type="checkbox" class="toggle__input js-publish-toggle" data-id="${playlist.id}" ${playlist.published ? 'checked' : ''}>
          <div class="toggle__track"><div class="toggle__thumb"></div></div>
          <span class="toggle__label">${playlist.published ? 'Live' : 'Draft'}</span>
        </label>
        <button class="btn btn--ghost btn--sm js-edit-playlist" data-id="${playlist.id}">Edit</button>
        <button class="btn btn--danger btn--sm js-delete-playlist" data-id="${playlist.id}">Delete</button>
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
        .from('playlists').update({ published }).eq('id', id);

      if (error) {
        showToast('Failed to update status', 'error');
        e.target.checked = !published;
      } else {
        const p = allPlaylists.find(p => p.id === id);
        if (p) p.published = published;
        showToast(published ? 'Playlist published' : 'Playlist set to draft');
      }
    });
  });

  list.querySelectorAll('.js-edit-playlist').forEach(btn => {
    btn.addEventListener('click', () => openBuilder(btn.dataset.id));
  });

  list.querySelectorAll('.js-delete-playlist').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Open the playlist builder
   ---------------------------------------------------------- */
async function openBuilder(playlistId = null) {
  editingId    = playlistId;
  playlistItems = [];

  const titleEl = document.getElementById('builder-modal-title');
  titleEl.textContent = playlistId ? 'Edit Playlist' : 'New Playlist';

  if (playlistId) {
    const playlist = allPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    document.getElementById('playlist-title').value        = playlist.title || '';
    document.getElementById('playlist-description').value  = playlist.description || '';
    document.getElementById('playlist-published').checked  = playlist.published || false;

    if (window._playlistUploader) {
      window._playlistUploader.setUrl(playlist.thumbnail_url || null);
    }

    // Load existing items
    const { data: items } = await window.supabaseClient
      .from('playlist_items')
      .select(`
        id, position, video_id, article_id,
        videos ( id, title, thumbnail_url, cloudflare_video_id ),
        articles ( id, title, thumbnail_url )
      `)
      .eq('playlist_id', playlistId)
      .order('position');

    playlistItems = (items || []).map(item => ({
      tempId:       item.id,
      videoId:      item.video_id,
      articleId:    item.article_id,
      title:        item.videos?.title || item.articles?.title || 'Unknown',
      thumbnailUrl: item.videos?.thumbnail_url || item.articles?.thumbnail_url || null,
      cfVideoId:    item.videos?.cloudflare_video_id || null,
      type:         item.video_id ? 'video' : 'article',
    }));

    // Fetch signed thumbnails for video items that have no custom thumbnail
    const needsThumbnail = playlistItems.filter(i => i.type === 'video' && !i.thumbnailUrl && i.cfVideoId);
    if (needsThumbnail.length) {
      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await fetch('/.netlify/functions/admin-get-thumbnails', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
          body:    JSON.stringify({ videoIds: needsThumbnail.map(i => i.cfVideoId) }),
        });
        if (res.ok) {
          const { thumbnails } = await res.json();
          playlistItems.forEach(i => {
            if (!i.thumbnailUrl && i.cfVideoId && thumbnails[i.cfVideoId]) {
              i.thumbnailUrl = thumbnails[i.cfVideoId];
            }
          });
        }
      } catch (err) {
        // Non-fatal — items render without thumbnails
        console.error('Playlist builder thumbnail fetch failed:', err);
      }
    }
  } else {
    document.getElementById('playlist-title').value       = '';
    document.getElementById('playlist-description').value = '';
    // Reset the thumbnail uploader (it replaced the old #playlist-thumbnail input)
    if (window._playlistUploader) window._playlistUploader.setUrl(null);
    document.getElementById('playlist-published').checked = false;
  }

  renderBuilderItems();
  document.getElementById('builder-overlay').classList.add('is-open');
}

function closeBuilder() {
  document.getElementById('builder-overlay').classList.remove('is-open');
  const saveBtn = document.getElementById('save-playlist-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Playlist'; }
  editingId    = null;
  playlistItems = [];
  document.getElementById('content-search-input').value = '';
  document.getElementById('content-search-results').innerHTML = '';
}


/* ----------------------------------------------------------
   Render the items currently in the playlist builder
   ---------------------------------------------------------- */
function renderBuilderItems() {
  const container = document.getElementById('builder-items');
  if (!container) return;

  if (!playlistItems.length) {
    container.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);text-align:center;padding:var(--space-lg);">
        No items yet — search below to add videos and articles.
      </p>
    `;
    return;
  }

  container.innerHTML = '';
  playlistItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className          = 'playlist-builder-item';
    row.draggable          = true;
    row.dataset.index      = index;

    row.innerHTML = `
      <span class="playlist-builder-item__drag" title="Drag to reorder">⋮⋮</span>
      ${item.thumbnailUrl
        ? `<img src="${item.thumbnailUrl}" class="playlist-builder-item__thumb" alt="${item.title}">`
        : `<div class="playlist-builder-item__thumb playlist-builder-item__thumb--placeholder"></div>`
      }
      <div class="playlist-builder-item__info">
        <p class="playlist-builder-item__title">${item.title}</p>
        <p class="playlist-builder-item__type">${item.type === 'video' ? 'Video' : 'Article'}</p>
      </div>
      <button class="btn btn--ghost btn--sm js-remove-item" data-index="${index}" aria-label="Remove">✕</button>
    `;

    // Drag and drop reordering
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex   = index;
      if (fromIndex === toIndex) return;

      // Reorder the items array
      const moved = playlistItems.splice(fromIndex, 1)[0];
      playlistItems.splice(toIndex, 0, moved);
      renderBuilderItems();
    });

    container.appendChild(row);
  });

  // Remove buttons
  container.querySelectorAll('.js-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      playlistItems.splice(parseInt(btn.dataset.index), 1);
      renderBuilderItems();
    });
  });
}


/* ----------------------------------------------------------
   Content search — find videos and articles to add.
   Videos can be filtered by tag using a dropdown.
   ---------------------------------------------------------- */
function setupContentSearch() {
  const input      = document.getElementById('content-search-input');
  const results    = document.getElementById('content-search-results');
  const tagFilter  = document.getElementById('content-tag-filter');

  // Populate the tag filter dropdown with all unique tags from loaded videos
  function populateTagFilter() {
    const seen = new Map(); // id -> name
    Object.values(allVideoTagMap).forEach(tags => {
      tags.forEach(t => { if (!seen.has(t.id)) seen.set(t.id, t.name); });
    });

    // Sort tags alphabetically by name
    const sorted = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    sorted.forEach(([id, name]) => {
      const opt       = document.createElement('option');
      opt.value       = id;
      opt.textContent = name;
      tagFilter.appendChild(opt);
    });
  }

  populateTagFilter();

  function runSearch() {
    const query      = input.value.toLowerCase().trim();
    const filterTag  = tagFilter.value; // tag UUID or ''
    results.innerHTML = '';

    // Filter videos — must match search query AND selected tag
    const matchingVideos = allVideos
      .filter(v => {
        const matchesText = !query || v.title.toLowerCase().includes(query);
        const matchesTag  = !filterTag || (allVideoTagMap[v.id] || []).some(t => t.id === filterTag);
        return matchesText && matchesTag;
      })
      .slice(0, 8);

    // Articles are text-only — no tag filter applied
    const matchingArticles = !filterTag
      ? allArticles.filter(a => !query || a.title.toLowerCase().includes(query)).slice(0, 5)
      : [];

    const allMatches = [
      ...matchingVideos.map(v => ({ ...v, type: 'video' })),
      ...matchingArticles.map(a => ({ ...a, type: 'article' })),
    ];

    if (!allMatches.length) {
      results.innerHTML = `<p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-sm);">No results</p>`;
      return;
    }

    allMatches.forEach(item => {
      const row = document.createElement('button');
      row.className = 'content-search-result';
      row.type      = 'button';

      // Show tags on video results so it's easy to confirm the right video
      const tagPills = item.type === 'video' && allVideoTagMap[item.id]?.length
        ? allVideoTagMap[item.id].map(t =>
            `<span style="font-size:10px;background:rgba(255,255,255,0.07);border-radius:999px;padding:1px 7px;color:var(--color-gray);">${t.name}</span>`
          ).join('')
        : '';

      row.innerHTML = `
        <span class="content-search-result__type">${item.type === 'video' ? '🎬' : '📝'}</span>
        <span class="content-search-result__title">
          ${item.title}
          ${tagPills ? `<span style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">${tagPills}</span>` : ''}
        </span>
        <span class="content-search-result__add">+ Add</span>
      `;
      row.addEventListener('click', () => {
        playlistItems.push({
          videoId:      item.type === 'video'   ? item.id : null,
          articleId:    item.type === 'article' ? item.id : null,
          title:        item.title,
          thumbnailUrl: item.thumbnail_url || null,
          cfVideoId:    item.type === 'video' ? (item.cloudflare_video_id || null) : null,
          type:         item.type,
        });
        renderBuilderItems();
        input.value       = '';
        tagFilter.value   = '';
        results.innerHTML = '';
      });
      results.appendChild(row);
    });
  }

  input.addEventListener('input', runSearch);
  tagFilter.addEventListener('change', runSearch);
}


/* ----------------------------------------------------------
   Save playlist
   ---------------------------------------------------------- */
async function savePlaylist(e) {
  e.preventDefault();

  const title        = document.getElementById('playlist-title').value.trim();
  const description  = document.getElementById('playlist-description').value.trim();
  const thumbnailUrl = window._playlistUploader?.getUrl() || null;
  const published    = document.getElementById('playlist-published').checked;

  if (!title) { showToast('Title is required', 'error'); return; }

  const saveBtn = document.getElementById('save-playlist-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  let playlistId = editingId;

  if (editingId) {
    const { error } = await window.supabaseClient
      .from('playlists')
      .update({ title, description: description || null, thumbnail_url: thumbnailUrl, published })
      .eq('id', editingId);

    if (error) {
      showToast('Failed to save playlist', 'error');
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Playlist';
      return;
    }
  } else {
    const { data, error } = await window.supabaseClient
      .from('playlists')
      .insert({ title, description: description || null, thumbnail_url: thumbnailUrl, published })
      .select('id')
      .single();

    if (error || !data) {
      showToast('Failed to create playlist', 'error');
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Playlist';
      return;
    }

    playlistId = data.id;
  }

  // Delete existing items and re-insert in new order
  await window.supabaseClient
    .from('playlist_items')
    .delete()
    .eq('playlist_id', playlistId);

  if (playlistItems.length) {
    const itemsToInsert = playlistItems.map((item, index) => ({
      playlist_id: playlistId,
      video_id:   item.videoId   || null,
      article_id: item.articleId || null,
      position:   index + 1,
    }));

    const { error: itemsError } = await window.supabaseClient
      .from('playlist_items')
      .insert(itemsToInsert);

    if (itemsError) {
      showToast('Playlist saved but items failed to save', 'error');
    }
  }

  showToast(editingId ? 'Playlist updated' : 'Playlist created!');
  closeBuilder();
  await loadPlaylists();
  renderPlaylistList();
}


/* ----------------------------------------------------------
   Delete playlist
   ---------------------------------------------------------- */
async function confirmDelete(playlistId) {
  const playlist = allPlaylists.find(p => p.id === playlistId);
  if (!playlist) return;

  // Use inline confirmation instead of browser confirm()
  const btn = document.querySelector(`.js-delete-playlist[data-id="${playlistId}"]`);
  if (!btn) return;

  confirmAction(btn, `Delete "${playlist.title}"?`, async () => {
    const { error } = await window.supabaseClient
      .from('playlists').delete().eq('id', playlistId);
    if (error) { showToast('Failed to delete playlist', 'error'); return; }
    showToast('Playlist deleted');
    allPlaylists = allPlaylists.filter(p => p.id !== playlistId);
    renderPlaylistList();
  });
}


/* ----------------------------------------------------------
   Load data
   ---------------------------------------------------------- */
async function loadPlaylists() {
  const { data } = await window.supabaseClient
    .from('playlists')
    .select('*, playlist_items(count)')
    .order('created_at', { ascending: false });

  allPlaylists = (data || []).map(p => ({
    ...p,
    item_count: p.playlist_items?.[0]?.count || 0,
  }));
}

async function loadContent() {
  const [{ data: videos, error: vErr }, { data: articles, error: aErr }, { data: videoTagRows }] = await Promise.all([
    window.supabaseClient.from('videos').select('id, title, thumbnail_url, cloudflare_video_id').eq('published', true).order('title'),
    window.supabaseClient.from('articles').select('id, title, thumbnail_url').eq('published', true).order('title'),
    // Fetch video_tags so we can filter videos by tag in the playlist builder
    window.supabaseClient.from('video_tags').select('video_id, tags(id, name, category)'),
  ]);
  if (vErr || aErr) showToast('Failed to load content library', 'error');

  allVideos   = videos   || [];
  allArticles = articles || [];

  // Build a map of video_id -> tag array for fast lookup
  allVideoTagMap = {};
  (videoTagRows || []).forEach(row => {
    if (!row.video_id || !row.tags) return;
    if (!allVideoTagMap[row.video_id]) allVideoTagMap[row.video_id] = [];
    allVideoTagMap[row.video_id].push(row.tags);
  });
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const btn = document.createElement('button');
    btn.className   = 'btn btn--primary btn--sm';
    btn.textContent = '+ New Playlist';
    btn.addEventListener('click', () => openBuilder());
    actions.appendChild(btn);
  }

  content.innerHTML = `

    <div class="content-list" id="playlist-list">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>

    <!-- Playlist builder modal -->
    <div class="modal-overlay" id="builder-overlay" style="align-items:flex-start;padding-top:var(--nav-height);">
      <div class="modal" style="max-width:680px;width:100%;max-height:calc(100vh - var(--nav-height) - 40px);overflow-y:auto;">

        <div class="modal__header">
          <h2 class="modal__title" id="builder-modal-title">New Playlist</h2>
          <button class="modal__close" id="close-builder-btn" aria-label="Close">✕</button>
        </div>

        <form class="form" id="playlist-form">

          <div class="form__group">
            <label class="form__label" for="playlist-title">Title *</label>
            <input class="form__input" type="text" id="playlist-title" placeholder="e.g. Beginner Fundamentals Series" required>
          </div>

          <div class="form__group">
            <label class="form__label" for="playlist-description">Description</label>
            <textarea class="form__textarea" id="playlist-description" rows="2" placeholder="Optional description…"></textarea>
          </div>

          <div class="form__group">
            <label class="form__label">Thumbnail</label>
            <div id="playlist-thumbnail-wrap"></div>
          </div>

          <!-- Current items -->
          <div class="form__group">
            <label class="form__label">Playlist Items</label>
            <div id="builder-items" class="playlist-builder-items"></div>
          </div>

          <!-- Content search -->
          <div class="form__group">
            <label class="form__label" for="content-search-input">Add Videos or Articles</label>
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);">
              <select class="form__select" id="content-tag-filter" style="max-width:180px;flex-shrink:0;">
                <option value="">All Tags</option>
              </select>
              <input class="form__input" type="text" id="content-search-input" placeholder="Search by title…" autocomplete="off">
            </div>
            <div id="content-search-results" class="content-search-results"></div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label class="toggle">
              <input type="checkbox" class="toggle__input" id="playlist-published">
              <div class="toggle__track"><div class="toggle__thumb"></div></div>
              <span class="toggle__label" style="margin-left:var(--space-sm);font-size:var(--text-sm);color:var(--color-gray);">Publish immediately</span>
            </label>
            <div style="display:flex;gap:var(--space-md);">
              <button type="button" class="btn btn--secondary" id="cancel-playlist-btn">Cancel</button>
              <button type="submit" class="btn btn--primary" id="save-playlist-btn">Save Playlist</button>
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

  const content = renderAdminShell('playlists', 'Playlists');
  buildPage(content);

  await Promise.all([loadPlaylists(), loadContent()]);
  renderPlaylistList();
  setupContentSearch();

  // Initialize thumbnail uploader
  const thumbWrap = document.getElementById('playlist-thumbnail-wrap');
  if (thumbWrap) window._playlistUploader = createThumbnailUploader(thumbWrap);

  // Wire events
  document.getElementById('close-builder-btn')?.addEventListener('click', closeBuilder);
  document.getElementById('cancel-playlist-btn')?.addEventListener('click', closeBuilder);
  document.getElementById('playlist-form')?.addEventListener('submit', savePlaylist);
  safeModalClose('builder-overlay', closeBuilder);

})();
