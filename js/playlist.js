/* ==========================================================
   playlist.js — Playlist detail page
   True Jiu Jitsu Online

   Fetches playlist data and member progress, renders the
   ordered item list with completion states, progress bar,
   and a Start / Continue / Watch Again CTA.
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
   Render the playlist header (thumbnail, title, progress, CTA)
   ---------------------------------------------------------- */
function renderHeader(playlist, progress, nextItem) {
  // Page title
  document.title = `${playlist.title} — True Jiu Jitsu Online`;

  // Title and description
  document.getElementById('playlist-title').textContent = playlist.title;

  const descEl = document.getElementById('playlist-description');
  if (playlist.description) {
    descEl.textContent = playlist.description;
  } else {
    descEl.style.display = 'none';
  }

  // Thumbnail
  const thumbWrap = document.getElementById('playlist-thumbnail-wrap');
  if (playlist.thumbnail_url) {
    thumbWrap.innerHTML = `
      <img
        src="${playlist.thumbnail_url}"
        alt="${playlist.title}"
        class="playlist-page__thumbnail"
      >
    `;
  } else {
    thumbWrap.innerHTML = `
      <div class="playlist-page__thumbnail playlist-page__thumbnail--placeholder"></div>
    `;
  }

  // Progress bar and text
  const progressText = document.getElementById('playlist-progress-text');
  const progressBar  = document.getElementById('playlist-progress-bar');

  if (progress.total > 0) {
    progressText.textContent   = `${progress.completed} of ${progress.total} lessons complete`;
    progressBar.style.width    = `${progress.percent}%`;
  } else {
    document.getElementById('playlist-progress-wrap').style.display = 'none';
  }

  // CTA button — label depends on progress state
  const cta = document.getElementById('playlist-cta');
  if (progress.completed === 0) {
    cta.textContent = 'Start Playlist';
  } else if (progress.completed === progress.total) {
    cta.textContent = 'Watch Again';
  } else {
    cta.textContent = 'Continue';
  }

  if (nextItem?.href) {
    cta.href = nextItem.href;
  } else {
    cta.style.display = 'none';
  }
}


/* ----------------------------------------------------------
   Render the ordered list of playlist items
   ---------------------------------------------------------- */
function renderItems(items, playlistId) {
  const container = document.getElementById('playlist-items');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>This playlist has no items yet.</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const el = document.createElement('a');
    el.href      = item.href;
    el.className = `playlist-item ${item.completed ? 'playlist-item--completed' : ''}`;

    el.innerHTML = `
      <!-- Position number or checkmark -->
      <div class="playlist-item__position">
        ${item.completed
          ? `<div class="check-icon" aria-label="Completed">
               <svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
             </div>`
          : `<span>${item.position}</span>`
        }
      </div>

      <!-- Thumbnail -->
      <div class="playlist-item__thumbnail-wrap">
        ${item.thumbnailUrl
          ? `<img src="${item.thumbnailUrl}" alt="${item.title}" class="playlist-item__thumbnail" loading="lazy">`
          : `<div class="playlist-item__thumbnail playlist-item__thumbnail--placeholder"></div>`
        }
      </div>

      <!-- Info -->
      <div class="playlist-item__info">
        <p class="playlist-item__title">${item.title}</p>
        <p class="playlist-item__meta">
          <span>${item.type === 'video' ? 'Video' : 'Article'}</span>
          ${item.durationSecs ? `<span>${formatDuration(item.durationSecs)}</span>` : ''}
          ${item.completed ? `<span style="color:var(--color-success);">Completed</span>` : ''}
          ${!item.completed && item.secondsWatched > 30
            ? `<span style="color:var(--color-gray);">${formatDuration(item.secondsWatched)} watched</span>`
            : ''
          }
        </p>
      </div>

      <!-- Arrow indicator -->
      <svg class="playlist-item__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9,18 15,12 9,6"/>
      </svg>
    `;

    container.appendChild(el);
  });
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  // Auth guard
  const auth = await requireAuth();
  if (!auth) return;

  renderNav();

  const playlistId = new URLSearchParams(window.location.search).get('id');
  if (!playlistId) {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  const { session } = auth;

  // Fetch playlist data
  const response = await fetch(
    `/.netlify/functions/get-playlist?playlistId=${playlistId}`,
    { headers: { 'Authorization': `Bearer ${session.access_token}` } }
  );

  if (!response.ok) {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  const { playlist, items, progress, nextItem } = await response.json();

  // Hide loading, show content
  document.getElementById('playlist-loading').style.display = 'none';
  document.getElementById('playlist-content').style.display = '';

  renderHeader(playlist, progress, nextItem);
  renderItems(items, playlistId);

})();
