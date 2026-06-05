/* ==========================================================
   catalogue.js — Content browse page
   True Jiu Jitsu Online

   Handles:
     - Playlist grid (default view)
     - Continue Watching row
     - Text search across videos and articles
     - Tag filter dropdown (searchable, grouped by BJJ category)
     - Live search results view that replaces the playlist grid
   ========================================================== */


/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let _accessToken   = null;
let _allTags       = [];
let _activeTags    = new Set();   // currently selected tag slugs
let _searchTimeout = null;


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function watchPercent(secondsWatched, durationSecs) {
  if (!durationSecs || !secondsWatched) return 0;
  return Math.min(100, Math.round((secondsWatched / durationSecs) * 100));
}

function progressRingSVG(percent) {
  const r      = 18;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  return `
    <svg class="progress-ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle class="progress-ring__track" cx="20" cy="20" r="${r}" stroke-width="3"/>
      <circle class="progress-ring__fill"  cx="20" cy="20" r="${r}" stroke-width="3"
        stroke-dasharray="${circ.toFixed(1)}"
        stroke-dashoffset="${offset.toFixed(1)}"
      />
    </svg>
    <span class="progress-ring__label">${percent}%</span>
  `;
}


/* ----------------------------------------------------------
   Build a playlist card
   ---------------------------------------------------------- */
function buildPlaylistCard(playlist) {
  const { id, title, thumbnail_url, item_count, progress } = playlist;
  const percent     = progress?.percent  || 0;
  const completed   = progress?.completed || 0;
  const total       = progress?.total     || 0;
  const hasProgress = completed > 0;
  const isComplete  = percent === 100;

  const card = document.createElement('a');
  card.className = 'content-card';
  card.href      = `/pages/playlist.html?id=${id}`;

  card.innerHTML = `
    <div class="content-card__thumbnail-wrap" style="position:relative;">
      ${thumbnail_url
        ? `<img src="${thumbnail_url}" alt="${title}" class="content-card__thumbnail" loading="lazy">`
        : `<div class="content-card__thumbnail content-card__thumbnail--placeholder"></div>`
      }
      <div class="content-card__play" aria-hidden="true">
        <div class="content-card__play-icon">
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      ${hasProgress ? `
        <div class="content-card__ring" aria-label="${percent}% complete">
          ${progressRingSVG(percent)}
        </div>` : ''}
      ${isComplete ? `
        <div class="content-card__complete-badge" aria-label="Completed">
          <div class="check-icon">
            <svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
          </div>
        </div>` : ''}
    </div>
    <div class="content-card__body">
      <h3 class="content-card__title">${title}</h3>
      <div class="content-card__meta">
        <span>${total} ${total === 1 ? 'lesson' : 'lessons'}</span>
        ${hasProgress && !isComplete ? `<span>${completed} of ${total} done</span>` : ''}
        ${isComplete ? `<span style="color:var(--color-success)">Complete</span>` : ''}
      </div>
    </div>
  `;

  return card;
}


/* ----------------------------------------------------------
   Build a search result card (video or article)
   ---------------------------------------------------------- */
function buildResultCard(item) {
  const card      = document.createElement('a');
  card.className  = 'content-card';
  card.href       = item.href;

  const typeLabel = item.type === 'video' ? 'Video' : 'Article';
  const tagNames  = (item.tags || []).slice(0, 3).map(t => t.name).join(', ');

  card.innerHTML = `
    <div class="content-card__thumbnail-wrap" style="position:relative;">
      ${item.thumbnailUrl
        ? `<img src="${item.thumbnailUrl}" alt="${item.title}" class="content-card__thumbnail" loading="lazy">`
        : `<div class="content-card__thumbnail content-card__thumbnail--placeholder"></div>`
      }
      <div class="content-card__play" aria-hidden="true">
        <div class="content-card__play-icon">
          <svg viewBox="0 0 24 24">
            ${item.type === 'video'
              ? '<polygon points="5,3 19,12 5,21"/>'
              : '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>'
            }
          </svg>
        </div>
      </div>
    </div>
    <div class="content-card__body">
      <p class="content-card__type">
        ${typeLabel}
        ${item.playlist ? `· <span style="color:var(--color-gray)">${item.playlist.title}</span>` : ''}
      </p>
      <h3 class="content-card__title">${item.title}</h3>
      <div class="content-card__meta">
        ${item.durationSecs ? `<span>${formatDuration(item.durationSecs)}</span>` : ''}
        ${tagNames ? `<span style="color:var(--color-gray);font-size:var(--text-xs);">${tagNames}</span>` : ''}
      </div>
    </div>
  `;

  return card;
}


/* ----------------------------------------------------------
   Build a continue watching card
   ---------------------------------------------------------- */
function buildContinueCard(item) {
  const pct  = watchPercent(item.secondsWatched, item.durationSecs);
  const href = item.playlistId
    ? `/pages/video.html?id=${item.videoId}&playlist=${item.playlistId}`
    : `/pages/video.html?id=${item.videoId}`;

  const card = document.createElement('a');
  card.className = 'content-card content-card--continue';
  card.href      = href;

  card.innerHTML = `
    <div class="content-card__thumbnail-wrap" style="position:relative;">
      ${item.thumbnailUrl
        ? `<img src="${item.thumbnailUrl}" alt="${item.title}" class="content-card__thumbnail" loading="lazy">`
        : `<div class="content-card__thumbnail content-card__thumbnail--placeholder"></div>`
      }
      <div class="content-card__play" aria-hidden="true">
        <div class="content-card__play-icon">
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <div class="content-card__watch-bar">
        <div class="content-card__watch-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="content-card__body">
      ${item.playlistTitle ? `<p class="content-card__type">${item.playlistTitle}</p>` : ''}
      <h3 class="content-card__title">${item.title}</h3>
      <div class="content-card__meta">
        <span>${formatDuration(item.durationSecs)}</span>
        <span>${pct}% watched</span>
      </div>
    </div>
  `;

  return card;
}


/* ----------------------------------------------------------
   TAG FILTER DROPDOWN
   Searchable dropdown grouped by BJJ category
   ---------------------------------------------------------- */
function initTagFilter() {
  const input      = document.getElementById('tag-filter-input');
  const dropdown   = document.getElementById('tag-picker-dropdown');
  const activePillsEl = document.getElementById('active-tag-filters');
  if (!input || !dropdown || !_allTags.length) return;

  /* Group tags by category */
  function grouped(tags) {
    const g = {};
    tags.forEach(t => {
      if (!g[t.category]) g[t.category] = [];
      g[t.category].push(t);
    });
    return g;
  }

  /* Render the dropdown */
  function renderDropdown(query = '') {
    const q        = query.toLowerCase();
    const filtered = q ? _allTags.filter(t => t.name.toLowerCase().includes(q)) : _allTags;
    const groups   = grouped(filtered);

    if (!filtered.length) {
      dropdown.innerHTML = `<p style="padding:var(--space-md);color:var(--color-gray);font-size:var(--text-sm);">No tags found</p>`;
      return;
    }

    dropdown.innerHTML = Object.entries(groups).map(([cat, tags]) => `
      <p class="member-tag-picker__group-label">${cat}</p>
      ${tags.map(tag => `
        <div class="member-tag-picker__option ${_activeTags.has(tag.slug) ? 'member-tag-picker__option--selected' : ''}"
             data-slug="${tag.slug}" data-name="${tag.name}">
          <span>${tag.name}</span>
          ${_activeTags.has(tag.slug) ? '<span class="member-tag-picker__option-check">✓</span>' : ''}
        </div>
      `).join('')}
    `).join('');

    dropdown.querySelectorAll('.member-tag-picker__option').forEach(opt => {
      opt.addEventListener('click', () => {
        const slug = opt.dataset.slug;
        if (_activeTags.has(slug)) _activeTags.delete(slug);
        else _activeTags.add(slug);
        renderDropdown(input.value);
        renderActivePills();
        updateInputPlaceholder();
        triggerSearch();
      });
    });
  }

  /* Render active tag pills */
  function renderActivePills() {
    if (!_activeTags.size) {
      activePillsEl.style.display = 'none';
      activePillsEl.innerHTML     = '';
      return;
    }

    activePillsEl.style.display = 'flex';
    const active = _allTags.filter(t => _activeTags.has(t.slug));

    activePillsEl.innerHTML = `
      <span class="catalogue__tag-filter-label">Tags:</span>
      ${active.map(tag => `
        <button class="active-tag-pill" data-slug="${tag.slug}">
          ${tag.name} <span class="active-tag-pill__remove">✕</span>
        </button>
      `).join('')}
      <button class="catalogue__clear-tags">Clear all</button>
    `;

    activePillsEl.querySelectorAll('.active-tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        _activeTags.delete(pill.dataset.slug);
        renderActivePills();
        renderDropdown(input.value);
        updateInputPlaceholder();
        triggerSearch();
      });
    });

    activePillsEl.querySelector('.catalogue__clear-tags')?.addEventListener('click', () => {
      _activeTags.clear();
      renderActivePills();
      renderDropdown();
      updateInputPlaceholder();
      triggerSearch();
    });
  }

  /* Update placeholder to show selection count */
  function updateInputPlaceholder() {
    input.placeholder = _activeTags.size
      ? `${_activeTags.size} tag${_activeTags.size > 1 ? 's' : ''} selected`
      : 'Filter by tag…';
  }

  /* Open / close */
  input.addEventListener('click', () => {
    input.removeAttribute('readonly');
    dropdown.classList.add('is-open');
    renderDropdown(input.value);
  });

  input.addEventListener('input', () => renderDropdown(input.value));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tag-picker-wrap')) {
      dropdown.classList.remove('is-open');
      input.setAttribute('readonly', '');
      input.value = '';
    }
  });

  renderDropdown();
}


/* ----------------------------------------------------------
   SEARCH
   Debounced — fires after 350ms of no typing.
   Switches between playlist grid and individual results view.
   ---------------------------------------------------------- */
function initSearch() {
  const searchInput = document.getElementById('catalogue-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(triggerSearch, 350);
  });
}

async function triggerSearch() {
  const searchInput    = document.getElementById('catalogue-search');
  const resultsSection = document.getElementById('search-results-section');
  const resultsGrid    = document.getElementById('search-results-grid');
  const resultsCount   = document.getElementById('search-results-count');
  const playlistsGrid  = document.getElementById('playlists-grid');
  const continueSection = document.getElementById('continue-watching');

  const query    = searchInput?.value.trim() || '';
  const tagSlugs = Array.from(_activeTags);
  const isActive = query.length > 0 || tagSlugs.length > 0;

  if (!isActive) {
    // Back to normal playlist view
    resultsSection.style.display  = 'none';
    playlistsGrid.style.display   = '';
    if (continueSection.dataset.hasContent) continueSection.style.display = '';
    return;
  }

  // Switch to results view
  continueSection.style.display = 'none';
  playlistsGrid.style.display   = 'none';
  resultsSection.style.display  = '';
  resultsGrid.innerHTML         = '<div class="spinner" style="margin:var(--space-2xl) auto;"></div>';
  if (resultsCount) resultsCount.textContent = 'Searching…';

  try {
    const params = new URLSearchParams();
    if (query)           params.set('q',    query);
    if (tagSlugs.length) params.set('tags', tagSlugs.join(','));

    const response = await fetch(
      `/.netlify/functions/search-catalogue?${params.toString()}`,
      { headers: { 'Authorization': `Bearer ${_accessToken}` } }
    );

    const { results, total } = await response.json();

    resultsGrid.innerHTML = '';

    if (!total) {
      resultsCount.textContent = 'No results found';
      resultsGrid.innerHTML    = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state__icon">🥋</div>
          <p>No videos or articles match your search.</p>
        </div>
      `;
      return;
    }

    resultsCount.textContent = `${total} result${total === 1 ? '' : 's'}`;
    results.forEach(item => resultsGrid.appendChild(buildResultCard(item)));

  } catch (err) {
    console.error('Search error:', err);
    if (resultsCount) resultsCount.textContent = 'Search failed — please try again';
    resultsGrid.innerHTML = '';
  }
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAuth();
  if (!auth) return;

  renderNav();

  const { session } = auth;
  _accessToken = session.access_token;

  /* Welcome toast on checkout success */
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id        = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      const toast       = document.createElement('div');
      toast.className   = 'toast toast--success';
      toast.textContent = '🅷 Welcome! Your free trial has started — enjoy the library.';
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }, 600);
  }

  const loadingEl = document.getElementById('catalogue-loading');
  const emptyEl   = document.getElementById('catalogue-empty');

  /* Load tags for the filter */
  const { data: tagsData } = await window.supabaseClient
    .from('tags')
    .select('id, name, slug, category, display_order')
    .order('display_order');
  _allTags = tagsData || [];

  /* Fetch catalogue */
  let data;
  try {
    const res = await fetch('/.netlify/functions/get-catalogue', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('Failed to fetch catalogue:', err);
    loadingEl.style.display = 'none';
    emptyEl.style.display   = 'block';
    return;
  }

  loadingEl.style.display = 'none';

  const { playlists, continueWatching } = data;

  /* Continue Watching */
  const continueSection = document.getElementById('continue-watching');
  if (continueWatching?.length > 0) {
    const grid = document.getElementById('continue-watching-grid');
    continueWatching.forEach(item => grid.appendChild(buildContinueCard(item)));
    continueSection.style.display      = '';
    continueSection.dataset.hasContent = 'true';
  }

  /* Playlists */
  const grid = document.getElementById('playlists-grid');
  if (!playlists?.length) {
    emptyEl.style.display = 'block';
  } else {
    playlists.forEach(p => grid.appendChild(buildPlaylistCard(p)));
  }

  /* Initialize search and tag filter */
  initSearch();
  initTagFilter();

})();
