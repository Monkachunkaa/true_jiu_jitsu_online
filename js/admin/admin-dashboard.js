/* ==========================================================
   admin-dashboard.js — Admin dashboard
   True Jiu Jitsu Online

   Shows key stats: active members, total videos/articles/
   playlists, and recently published content.
   ========================================================== */

(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('dashboard', 'Dashboard');

  content.innerHTML = `
    <!-- Stat cards -->
    <div class="stat-grid" id="stat-grid">
      <div class="stat-card">
        <p class="stat-card__label">Active Members</p>
        <p class="stat-card__value" id="stat-members">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Published Videos</p>
        <p class="stat-card__value" id="stat-videos">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Published Articles</p>
        <p class="stat-card__value" id="stat-articles">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Playlists</p>
        <p class="stat-card__value" id="stat-playlists">—</p>
      </div>
    </div>

    <!-- Recent content -->
    <div class="admin-section-header" style="margin-top:var(--space-2xl);">
      <h2>Recently Added</h2>
      <a href="/pages/admin/videos.html" class="btn btn--secondary btn--sm">Add Video</a>
    </div>
    <div id="recent-content">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>
  `;

  // Fetch all stats in parallel
  const [
    { count: memberCount },
    { count: videoCount },
    { count: articleCount },
    { count: playlistCount },
    { data: recentVideos },
  ] = await Promise.all([
    window.supabaseClient.from('members').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    window.supabaseClient.from('videos').select('*', { count: 'exact', head: true }).eq('published', true),
    window.supabaseClient.from('articles').select('*', { count: 'exact', head: true }).eq('published', true),
    window.supabaseClient.from('playlists').select('*', { count: 'exact', head: true }).eq('published', true),
    window.supabaseClient.from('videos').select('id, title, thumbnail_url, created_at, published').order('created_at', { ascending: false }).limit(5),
  ]);

  document.getElementById('stat-members').textContent   = memberCount  ?? '—';
  document.getElementById('stat-videos').textContent    = videoCount   ?? '—';
  document.getElementById('stat-articles').textContent  = articleCount ?? '—';
  document.getElementById('stat-playlists').textContent = playlistCount ?? '—';

  // Render recent videos list
  const recentEl = document.getElementById('recent-content');

  if (!recentVideos?.length) {
    recentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎬</div>
        <p>No videos yet. <a href="/pages/admin/videos.html">Upload your first video.</a></p>
      </div>
    `;
    return;
  }

  recentEl.innerHTML = `
    <div class="content-list" id="recent-list"></div>
  `;

  const list = document.getElementById('recent-list');
  recentVideos.forEach(video => {
    const date = new Date(video.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    const item = document.createElement('div');
    item.className = 'content-list-item';
    item.innerHTML = `
      ${video.thumbnail_url
        ? `<img src="${video.thumbnail_url}" class="content-list-item__thumbnail" alt="${video.title}">`
        : `<div class="content-list-item__thumbnail" style="background:var(--color-dark-gray);"></div>`
      }
      <div class="content-list-item__info">
        <p class="content-list-item__title">${video.title}</p>
        <div class="content-list-item__meta">
          <span>${date}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <span class="badge ${video.published ? 'badge--published' : 'badge--draft'}">
          ${video.published ? 'Published' : 'Draft'}
        </span>
        <a href="/pages/admin/videos.html?edit=${video.id}" class="btn btn--ghost btn--sm">Edit</a>
      </div>
    `;
    list.appendChild(item);
  });

})();
