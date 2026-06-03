/* ==========================================================
   article.js — Article reader
   True Jiu Jitsu Online

   Fetches the article content, renders it, handles
   "Mark as Read" completion, and shows the Up Next card
   if the article is part of a playlist.
   ========================================================== */


/* ----------------------------------------------------------
   Helper: estimate read time from HTML content
   Strips tags, counts words, assumes 200 words/minute.
   ---------------------------------------------------------- */
function estimateReadTime(html) {
  const text  = html.replace(/<[^>]*>/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

/* ----------------------------------------------------------
   Helper: format a date as "Month Day, Year"
   ---------------------------------------------------------- */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/* ----------------------------------------------------------
   Render the Up Next card below the article
   ---------------------------------------------------------- */
function renderUpNext(nextItem, container) {
  if (!nextItem) return;

  const typeLabel = nextItem.type === 'video' ? 'Video' : 'Article';

  container.innerHTML = `
    <div style="margin-top:var(--space-2xl);padding-top:var(--space-2xl);border-top:1px solid var(--color-mid-gray);">
      <p class="player-page__sidebar-title" style="margin-bottom:var(--space-lg);">Up Next</p>
      <a href="${nextItem.href}" class="up-next-card" style="max-width:340px;">
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
        </div>
      </a>
    </div>
  `;
}

/* ----------------------------------------------------------
   Save article as completed in Supabase
   ---------------------------------------------------------- */
async function markAsRead(articleId, accessToken) {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const { data: member }      = await window.supabaseClient
    .from('members').select('id').eq('auth_user_id', session.user.id).single();

  if (!member) return;

  await window.supabaseClient.from('article_progress').upsert({
    member_id:  member.id,
    article_id: articleId,
    completed:  true,
    read_at:    new Date().toISOString(),
  }, { onConflict: 'member_id,article_id' });
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAuth();
  if (!auth) return;

  renderNav();

  const { session } = auth;
  const params      = new URLSearchParams(window.location.search);
  const articleId   = params.get('id');
  const playlistId  = params.get('playlist');

  if (!articleId) {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  // Fetch article data
  const url      = `/.netlify/functions/get-article?articleId=${articleId}${playlistId ? `&playlistId=${playlistId}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  const { article, progress, nextItem, playlistTitle, playlistId: pid } = await response.json();

  // Hide loading, show content
  document.getElementById('article-loading').style.display = 'none';
  document.getElementById('article-content').style.display = '';

  // Page title
  document.title = `${article.title} — True Jiu Jitsu Online`;

  // Breadcrumb
  if (pid && playlistTitle) {
    const breadcrumb   = document.getElementById('article-breadcrumb');
    const playlistLink = document.getElementById('breadcrumb-playlist-link');
    breadcrumb.style.display  = '';
    playlistLink.textContent  = playlistTitle;
    playlistLink.href         = `/pages/playlist.html?id=${pid}`;
  }

  // Meta line: category · date · read time
  const metaParts = [];
  if (article.category)  metaParts.push(article.category);
  if (article.createdAt) metaParts.push(formatDate(article.createdAt));
  if (article.bodyHtml)  metaParts.push(estimateReadTime(article.bodyHtml));

  document.getElementById('article-meta').textContent  = metaParts.join(' · ');
  document.getElementById('article-title').textContent = article.title;

  // Body HTML from Quill — rendered directly
  const bodyEl = document.getElementById('article-body');
  bodyEl.innerHTML = article.bodyHtml || '<p>No content yet.</p>';

  // Completion state
  const markReadBtn   = document.getElementById('mark-read-btn');
  const completedEl   = document.getElementById('article-completed');

  if (progress.completed) {
    completedEl.style.display = 'flex';
  } else {
    markReadBtn.style.display = '';
    markReadBtn.addEventListener('click', async () => {
      markReadBtn.disabled    = true;
      markReadBtn.textContent = 'Saving…';
      await markAsRead(articleId, session.access_token);
      markReadBtn.style.display  = 'none';
      completedEl.style.display  = 'flex';
    });
  }

  // Up Next
  renderUpNext(nextItem, document.getElementById('article-up-next'));

})();
