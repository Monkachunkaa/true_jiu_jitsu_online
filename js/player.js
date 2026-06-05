/* ==========================================================
   player.js — Video player logic and progress tracking
   True Jiu Jitsu Online

   Handles:
     - Fetching the signed Cloudflare Stream URL
     - Fetching video metadata and next playlist item
     - Rendering the Cloudflare iframe player
     - Saving watch progress every 30 seconds
     - Marking video as complete
     - Showing the "Up Next" card
   ========================================================== */


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

/** Read a query param from the current URL */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Format seconds as "Xm Ys" for display */
function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


/* ----------------------------------------------------------
   Render the "Up Next" sidebar card
   ---------------------------------------------------------- */
function renderUpNext(nextItem, sidebar) {
  if (!nextItem) {
    sidebar.innerHTML = `
      <p class="player-page__sidebar-title">Up Next</p>
      <p style="color:var(--color-gray); font-size:var(--text-sm);">
        You've reached the end of this playlist.
      </p>
      <a href="/pages/catalogue.html" class="btn btn--secondary btn--sm" style="margin-top:var(--space-md);">
        Back to Catalogue
      </a>
    `;
    return;
  }

  const typeLabel = nextItem.type === 'article' ? 'Article' : 'Video';

  sidebar.innerHTML = `
    <p class="player-page__sidebar-title">Up Next</p>
    <a href="${nextItem.href}" class="up-next-card">
      <div class="up-next-card__thumbnail-wrap">
        ${nextItem.thumbnailUrl
          ? `<img src="${nextItem.thumbnailUrl}" alt="${nextItem.title}" class="up-next-card__thumbnail" loading="lazy">`
          : `<div class="up-next-card__thumbnail up-next-card__thumbnail--placeholder"></div>`
        }
        <div class="up-next-card__play" aria-hidden="true">
          <div class="content-card__play-icon">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
      </div>
      <div class="up-next-card__body">
        <p class="up-next-card__type">${typeLabel}</p>
        <h4 class="up-next-card__title">${nextItem.title}</h4>
        ${nextItem.duration
          ? `<p class="up-next-card__meta">${formatDuration(nextItem.duration)}</p>`
          : ''
        }
      </div>
    </a>
  `;
}


/* ----------------------------------------------------------
   Progress tracking
   Saves watch progress every 30 seconds and on completion.
   ---------------------------------------------------------- */
let progressInterval = null;
let currentSeconds   = 0;
let playerIframe     = null;

function startProgressTracking(videoId, accessToken) {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(async () => {
    // Try to read currentTime from the Cloudflare player via postMessage
    // For now, increment our local counter as an approximation
    currentSeconds += 30;

    await saveProgress(videoId, accessToken, currentSeconds, false);
  }, 30000);
}

async function saveProgress(videoId, accessToken, secondsWatched, completed) {
  try {
    await fetch('/.netlify/functions/save-progress', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ videoId, secondsWatched, completed }),
    });
  } catch (err) {
    console.error('Progress save failed:', err);
  }
}


/* ----------------------------------------------------------
   Mark as complete
   ---------------------------------------------------------- */
function setupCompleteButton(videoId, accessToken, durationSeconds) {
  const btn       = document.getElementById('complete-btn');
  const completed = document.getElementById('player-completed');

  if (!btn) return;
  btn.style.display = '';

  btn.addEventListener('click', async () => {
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    await saveProgress(videoId, accessToken, durationSeconds || currentSeconds, true);

    // Stop the progress interval — no need to keep tracking
    if (progressInterval) clearInterval(progressInterval);

    btn.style.display       = 'none';
    completed.style.display = 'flex';
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

  const { session } = auth;
  const accessToken = session.access_token;

  const videoId    = getParam('id');
  const playlistId = getParam('playlist');

  if (!videoId) {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  /* ----------------------------------------------------------
     Fetch video metadata and next item in parallel
     ---------------------------------------------------------- */
  const [signedRes, metaRes] = await Promise.all([
    fetch(`/.netlify/functions/get-signed-url?videoId=${videoId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }),
    fetch(`/.netlify/functions/get-video?videoId=${videoId}${playlistId ? `&playlistId=${playlistId}` : ''}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }),
  ]);

  if (!signedRes.ok || !metaRes.ok) {
    console.error('Failed to load video');
    window.location.href = '/pages/catalogue.html';
    return;
  }

  const { signedUrl, video: videoData, progress } = await signedRes.json();
  const { video, nextItem, playlistTitle, playlistId: pid } = await metaRes.json();

  /* ----------------------------------------------------------
     Update page title and meta
     ---------------------------------------------------------- */
  document.title = `${video.title} — True Jiu Jitsu Online`;

  const titleEl = document.getElementById('player-title');
  const descEl  = document.getElementById('player-description');
  if (titleEl) titleEl.textContent = video.title;
  if (descEl && video.description) descEl.textContent = video.description;

  /* ----------------------------------------------------------
     Render tag pills — each links to catalogue filtered by
     that tag so members can explore related content
     ---------------------------------------------------------- */
  if (videoData.tags?.length) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'player-tags';
    tagsEl.setAttribute('aria-label', 'Video tags');

    videoData.tags.forEach(tag => {
      const pill = document.createElement('a');
      pill.className   = 'player-tag-pill';
      pill.href        = `/pages/catalogue.html?tags=${tag.slug}`;
      pill.textContent = tag.name;
      tagsEl.appendChild(pill);
    });

    // Insert after the title
    const metaEl = document.getElementById('player-meta');
    if (metaEl && titleEl) {
      titleEl.insertAdjacentElement('afterend', tagsEl);
    }
  }

  /* ----------------------------------------------------------
     Breadcrumb — show playlist link if we came from one
     ---------------------------------------------------------- */
  if (pid && playlistTitle) {
    const breadcrumb     = document.getElementById('player-breadcrumb');
    const playlistLink   = document.getElementById('breadcrumb-playlist-link');
    if (breadcrumb && playlistLink) {
      breadcrumb.style.display  = '';
      playlistLink.textContent  = playlistTitle;
      playlistLink.href         = `/pages/playlist.html?id=${pid}`;
    }
  }

  /* ----------------------------------------------------------
     Inject the Cloudflare iframe player
     ---------------------------------------------------------- */
  const embedEl      = document.getElementById('player-embed');
  const placeholder  = document.getElementById('player-placeholder');

  if (placeholder) placeholder.remove();

  const iframe = document.createElement('iframe');
  iframe.src             = signedUrl;
  iframe.className       = 'player-iframe';
  iframe.allow           = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;';
  iframe.allowFullscreen = true;
  iframe.setAttribute('aria-label', video.title);

  embedEl.appendChild(iframe);
  playerIframe = iframe;

  /* ----------------------------------------------------------
     Restore watch position (resume from where they left off)
     The Cloudflare player doesn't expose a JS API over iframe,
     so we show a "Resume from Xm" hint instead.
     ---------------------------------------------------------- */
  if (progress?.seconds_watched > 30) {
    const resumeHint = document.createElement('p');
    resumeHint.className   = 'player-resume-hint';
    resumeHint.textContent = `Last watched to ${formatDuration(progress.seconds_watched)} — use the progress bar to resume.`;
    document.getElementById('player-meta')?.appendChild(resumeHint);
  }

  /* ----------------------------------------------------------
     Completed state — if already marked complete, show badge
     ---------------------------------------------------------- */
  if (progress?.completed) {
    const completedEl = document.getElementById('player-completed');
    if (completedEl) completedEl.style.display = 'flex';
  } else {
    setupCompleteButton(videoId, accessToken, video.durationSeconds);
  }

  /* ----------------------------------------------------------
     Start progress tracking
     ---------------------------------------------------------- */
  currentSeconds = progress?.seconds_watched || 0;
  startProgressTracking(videoId, accessToken);

  /* ----------------------------------------------------------
     Render Up Next card
     ---------------------------------------------------------- */
  const sidebar = document.getElementById('player-sidebar');
  if (sidebar && pid) {
    renderUpNext(nextItem, sidebar);
  }

})();

/* Stop progress tracking when the user leaves the page */
window.addEventListener('beforeunload', () => {
  if (progressInterval) clearInterval(progressInterval);
});
