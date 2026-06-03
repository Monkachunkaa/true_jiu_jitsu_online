/* ==========================================================
   catalogue.js — Content browse page
   True Jiu Jitsu Online

   Authenticates the member, fetches the catalogue from the
   Netlify function, and renders playlists with progress rings,
   continue watching row, and category filter pills.
   ========================================================== */


/* ----------------------------------------------------------
   Helper: format seconds as "Xm" or "Xh Ym"
   ---------------------------------------------------------- */
function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ----------------------------------------------------------
   Helper: format seconds watched as a percentage bar width
   ---------------------------------------------------------- */
function watchPercent(secondsWatched, durationSecs) {
  if (!durationSecs || !secondsWatched) return 0;
  return Math.min(100, Math.round((secondsWatched / durationSecs) * 100));
}

/* ----------------------------------------------------------
   Helper: build an SVG progress ring
   r=18, circumference≈113.1, cx=cy=20 in a 40×40 viewBox
   ---------------------------------------------------------- */
function progressRingSVG(percent) {
  const r     = 18;
  const circ  = 2 * Math.PI * r;
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
   Build a playlist card element
   ---------------------------------------------------------- */
function buildPlaylistCard(playlist) {
  const { id, title, thumbnail_url, categories, item_count, progress } = playlist;
  const categoryName = categories?.name || '';
  const percent      = progress?.percent || 0;
  const completed    = progress?.completed || 0;
  const total        = progress?.total || 0;
  const hasProgress  = completed > 0;
  const isComplete   = percent === 100;

  const card = document.createElement('a');
  card.className = 'content-card';
  card.href      = `/pages/playlist.html?id=${id}`;
  card.setAttribute('data-category', categories?.slug || '');

  card.innerHTML = `
    <!-- Thumbnail -->
    <div class="content-card__thumbnail-wrap" style="position:relative;">
      ${thumbnail_url
        ? `<img
             src="${thumbnail_url}"
             alt="${title}"
             class="content-card__thumbnail"
             loading="lazy"
           >`
        : `<div class="content-card__thumbnail content-card__thumbnail--placeholder"></div>`
      }

      <!-- Play overlay -->
      <div class="content-card__play" aria-hidden="true">
        <div class="content-card__play-icon">
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>

      <!-- Progress ring (only shown if started) -->
      ${hasProgress ? `
        <div class="content-card__ring" aria-label="${percent}% complete">
          ${progressRingSVG(percent)}
        </div>
      ` : ''}

      <!-- Completed checkmark -->
      ${isComplete ? `
        <div class="content-card__complete-badge" aria-label="Completed">
          <div class="check-icon">
            <svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Card body -->
    <div class="content-card__body">
      ${categoryName
        ? `<p class="content-card__type">${categoryName}</p>`
        : ''
      }
      <h3 class="content-card__title">${title}</h3>
      <div class="content-card__meta">
        <span>${total} ${total === 1 ? 'lesson' : 'lessons'}</span>
        ${hasProgress && !isComplete
          ? `<span>${completed} of ${total} done</span>`
          : ''
        }
        ${isComplete ? `<span style="color:var(--color-success)">Complete</span>` : ''}
      </div>
    </div>
  `;

  return card;
}

/* ----------------------------------------------------------
   Build a "continue watching" card element
   ---------------------------------------------------------- */
function buildContinueCard(item) {
  const pct   = watchPercent(item.secondsWatched, item.durationSecs);
  const href  = item.playlistId
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
      <!-- Watch progress bar -->
      <div class="content-card__watch-bar">
        <div class="content-card__watch-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="content-card__body">
      ${item.playlistTitle
        ? `<p class="content-card__type">${item.playlistTitle}</p>`
        : ''
      }
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
   Render category filter pills
   ---------------------------------------------------------- */
function renderFilters(categories, onFilter) {
  const container = document.getElementById('category-filters');
  if (!container) return;

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'filter-pill filter-pill--active';
  allPill.textContent = 'All';
  allPill.setAttribute('role', 'tab');
  allPill.setAttribute('aria-selected', 'true');
  allPill.dataset.slug = '';
  container.appendChild(allPill);

  categories.forEach(cat => {
    const pill = document.createElement('button');
    pill.className   = 'filter-pill';
    pill.textContent = cat.name;
    pill.setAttribute('role', 'tab');
    pill.setAttribute('aria-selected', 'false');
    pill.dataset.slug = cat.slug;
    container.appendChild(pill);
  });

  // Filter click handler
  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;

    container.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.remove('filter-pill--active');
      p.setAttribute('aria-selected', 'false');
    });
    pill.classList.add('filter-pill--active');
    pill.setAttribute('aria-selected', 'true');

    onFilter(pill.dataset.slug);
  });
}

/* ----------------------------------------------------------
   Filter the playlist grid by category slug
   ---------------------------------------------------------- */
function filterPlaylists(slug) {
  const cards = document.querySelectorAll('#playlists-grid .content-card');
  cards.forEach(card => {
    const show = !slug || card.dataset.category === slug;
    card.style.display = show ? '' : 'none';
  });

  // Update heading
  const heading = document.getElementById('catalogue-heading');
  if (heading) {
    heading.textContent = slug
      ? document.querySelector(`.filter-pill[data-slug="${slug}"]`)?.textContent + ' Playlists'
      : 'All Playlists';
  }
}

/* ----------------------------------------------------------
   MAIN — auth check, fetch, render
   ---------------------------------------------------------- */
(async function init() {
  // Auth guard — redirects to / if not logged in or not active
  const auth = await requireAuth();
  if (!auth) return;

  // Inject the nav
  renderNav();

  const loadingEl = document.getElementById('catalogue-loading');
  const emptyEl   = document.getElementById('catalogue-empty');

  // Fetch catalogue data from the Netlify function
  let data;
  try {
    const { session } = auth;
    const response = await fetch('/.netlify/functions/get-catalogue', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (err) {
    console.error('Failed to fetch catalogue:', err);
    loadingEl.style.display = 'none';
    emptyEl.style.display   = 'block';
    return;
  }

  loadingEl.style.display = 'none';

  const { playlists, continueWatching, categories } = data;

  /* ----------------------------------------------------------
     Render Continue Watching
     ---------------------------------------------------------- */
  if (continueWatching?.length > 0) {
    const section = document.getElementById('continue-watching');
    const grid    = document.getElementById('continue-watching-grid');

    continueWatching.forEach(item => {
      grid.appendChild(buildContinueCard(item));
    });

    section.style.display = '';
  }

  /* ----------------------------------------------------------
     Render Playlists
     ---------------------------------------------------------- */
  const grid = document.getElementById('playlists-grid');

  if (!playlists || playlists.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }

  playlists.forEach(playlist => {
    grid.appendChild(buildPlaylistCard(playlist));
  });

  /* ----------------------------------------------------------
     Render Category Filters (disabled for now — playlists
     don't have categories assigned yet. Revisit later.)
     ---------------------------------------------------------- */
  // if (categories?.length > 1) {
  //   renderFilters(categories, filterPlaylists);
  // }

})();
