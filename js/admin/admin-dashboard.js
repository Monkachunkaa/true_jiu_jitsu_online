/* ==========================================================
   admin-dashboard.js — Admin dashboard
   True Jiu Jitsu Online

   At-a-glance overview of the full platform:
     - Gym members (active, pending, past due)
     - Online members (active video subscribers)
     - Estimated MRR (actual plan pricing + discounts)
     - Content library count
     - Alerts for members needing attention
     - Recent activity (new members + recent videos)
   ========================================================== */

(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('dashboard', 'Dashboard');

  content.innerHTML = `
    <!-- Stat cards -->
    <div class="stat-grid" id="stat-grid">
      <div class="stat-card">
        <p class="stat-card__label">Active Gym Members</p>
        <p class="stat-card__value" id="stat-gym-members">—</p>
        <p class="stat-card__delta" id="stat-gym-delta"></p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Active Online Members</p>
        <p class="stat-card__value" id="stat-online-members">—</p>
        <p class="stat-card__delta" id="stat-online-delta"></p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Est. Monthly Revenue</p>
        <p class="stat-card__value" id="stat-mrr">—</p>
        <p class="stat-card__delta">gym + online, after discounts</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Content Library</p>
        <p class="stat-card__value" id="stat-content">—</p>
        <p class="stat-card__delta" id="stat-content-delta"></p>
      </div>
    </div>

    <!-- Alerts — only shown when there are members needing attention -->
    <div id="alert-row" style="display:none;margin-top:var(--space-xl);"></div>

    <!-- Two-column activity section -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);margin-top:var(--space-2xl);">

      <!-- Recent members -->
      <div>
        <div class="admin-section-header">
          <h2>Recent Members</h2>
          <a href="/pages/admin/gym-members.html" class="btn btn--secondary btn--sm">All Members</a>
        </div>
        <div id="recent-members" style="margin-top:var(--space-md);">
          <div class="spinner" style="margin:var(--space-xl) auto;"></div>
        </div>
      </div>

      <!-- Recent videos -->
      <div>
        <div class="admin-section-header">
          <h2>Recent Videos</h2>
          <a href="/pages/admin/videos.html" class="btn btn--secondary btn--sm">Add Video</a>
        </div>
        <div id="recent-videos" style="margin-top:var(--space-md);">
          <div class="spinner" style="margin:var(--space-xl) auto;"></div>
        </div>
      </div>

    </div>
  `;

  /* ----------------------------------------------------------
     Fetch everything in parallel
     ---------------------------------------------------------- */
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [
    { data: gymMembers },
    { data: onlineMembers },
    { data: plans },
    { count: videoCount },
    { count: publishedVideos },
    { count: playlistCount },
    { data: recentGym },
    { data: recentVideos },
  ] = await Promise.all([
    window.supabaseClient
      .from('gym_members')
      .select('id, subscription_status, plan_id, discount_percent, joined_at'),

    window.supabaseClient
      .from('members')
      .select('id, subscription_status, subscribed_at'),

    window.supabaseClient
      .from('membership_plans')
      .select('id, name, price_cents'),

    window.supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true }),

    window.supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('published', true),

    window.supabaseClient
      .from('playlists')
      .select('*', { count: 'exact', head: true })
      .eq('published', true),

    window.supabaseClient
      .from('gym_members')
      .select('id, name, email, belt_rank, subscription_status, plan_id, joined_at')
      .order('joined_at', { ascending: false })
      .limit(5),

    window.supabaseClient
      .from('videos')
      .select('id, title, thumbnail_url, created_at, published')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  /* ----------------------------------------------------------
     Calculate stats
     ---------------------------------------------------------- */
  const planMap = Object.fromEntries((plans || []).map(p => [p.id, p]));

  const activeGym    = (gymMembers || []).filter(m => m.subscription_status === 'active').length;
  const pendingGym   = (gymMembers || []).filter(m => m.subscription_status === 'pending').length;
  const pastDueGym   = (gymMembers || []).filter(m => m.subscription_status === 'past_due').length;
  const newGymMonth  = (gymMembers || []).filter(m => m.joined_at?.startsWith(thisMonth)).length;

  const activeOnline   = (onlineMembers || []).filter(m => m.subscription_status === 'active').length;
  const newOnlineMonth = (onlineMembers || []).filter(m => m.subscribed_at?.startsWith(thisMonth)).length;

  // MRR — gym plans (actual price × discount) + online at $8.99
  const gymMRR = (gymMembers || [])
    .filter(m => m.subscription_status === 'active' && m.plan_id)
    .reduce((sum, m) => {
      const plan  = planMap[m.plan_id];
      const base  = plan?.price_cents || 0;
      const disc  = m.discount_percent || 0;
      return sum + Math.round(base * (1 - disc / 100));
    }, 0);

  const onlineMRR = activeOnline * 899;
  const totalMRR  = gymMRR + onlineMRR;

  const mrrStr = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(totalMRR / 100);

  /* ----------------------------------------------------------
     Populate stat cards
     ---------------------------------------------------------- */
  document.getElementById('stat-gym-members').textContent  = activeGym;
  document.getElementById('stat-gym-delta').textContent    = newGymMonth
    ? `+${newGymMonth} this month`
    : 'No new members this month';

  document.getElementById('stat-online-members').textContent = activeOnline;
  document.getElementById('stat-online-delta').textContent   = newOnlineMonth
    ? `+${newOnlineMonth} this month`
    : 'No new this month';

  document.getElementById('stat-mrr').textContent = mrrStr;

  document.getElementById('stat-content').textContent  = `${publishedVideos ?? 0} videos`;
  document.getElementById('stat-content-delta').textContent =
    `${playlistCount ?? 0} playlists · ${videoCount ?? 0} total videos`;

  /* ----------------------------------------------------------
     Alerts — past due and pending billing
     ---------------------------------------------------------- */
  const alertRow = document.getElementById('alert-row');
  const alerts   = [];

  if (pastDueGym > 0) {
    alerts.push(`
      <div style="background:rgba(196,30,42,0.1);border:1px solid var(--color-red);border-radius:var(--border-radius);padding:var(--space-md) var(--space-lg);display:flex;justify-content:space-between;align-items:center;">
        <p style="margin:0;font-size:var(--text-sm);color:var(--color-light-gray);max-width:none;">
          ⚠️ <strong>${pastDueGym} member${pastDueGym > 1 ? 's' : ''}</strong> with failed payments
        </p>
        <a href="/pages/admin/gym-members.html" class="btn btn--danger btn--sm">View</a>
      </div>
    `);
  }

  if (pendingGym > 0) {
    alerts.push(`
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--color-mid-gray);border-radius:var(--border-radius);padding:var(--space-md) var(--space-lg);display:flex;justify-content:space-between;align-items:center;">
        <p style="margin:0;font-size:var(--text-sm);color:var(--color-light-gray);max-width:none;">
          🕐 <strong>${pendingGym} member${pendingGym > 1 ? 's' : ''}</strong> haven't set up billing yet
        </p>
        <a href="/pages/admin/gym-members.html" class="btn btn--secondary btn--sm">View</a>
      </div>
    `);
  }

  if (alerts.length) {
    alertRow.style.display = 'flex';
    alertRow.style.flexDirection = 'column';
    alertRow.style.gap = 'var(--space-sm)';
    alertRow.innerHTML = alerts.join('');
  }

  /* ----------------------------------------------------------
     Recent gym members
     ---------------------------------------------------------- */
  const recentMembersEl = document.getElementById('recent-members');

  if (!recentGym?.length) {
    recentMembersEl.innerHTML = `
      <div class="empty-state" style="padding:var(--space-xl) 0;">
        <p>No members yet. <a href="/pages/admin/gym-members.html">Add your first member.</a></p>
      </div>
    `;
  } else {
    const beltColors = {
      unknown: '#444', white: '#fff', blue: '#1a73e8',
      purple: '#8b5cf6', brown: '#92400e', black: '#1a1a1a',
    };

    recentMembersEl.innerHTML = recentGym.map(m => {
      const plan     = planMap[m.plan_id];
      const belt     = (m.belt_rank || 'unknown').toLowerCase();
      const beltColor = beltColors[belt] || '#444';
      const beltText  = belt.charAt(0).toUpperCase() + belt.slice(1);
      const isDark    = belt === 'white';

      return `
        <div class="content-list-item" style="padding:var(--space-sm) 0;border-bottom:1px solid var(--color-mid-gray);">
          <div style="width:8px;height:8px;border-radius:50%;background:${m.subscription_status === 'active' ? '#2a9d5c' : m.subscription_status === 'pending' ? '#888' : '#c41e2a'};flex-shrink:0;"></div>
          <div class="content-list-item__info" style="padding:0;">
            <p class="content-list-item__title" style="font-size:var(--text-sm);">${m.name}</p>
            <div class="content-list-item__meta">
              <span style="display:inline-block;padding:1px 8px;border-radius:100px;font-size:10px;font-weight:600;background:${beltColor};color:${isDark ? '#111' : '#fff'};border:1px solid rgba(255,255,255,0.1);">${beltText}</span>
              ${plan ? `<span>${plan.name}</span>` : ''}
            </div>
          </div>
          <span style="font-size:var(--text-xs);color:var(--color-gray);">${new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      `;
    }).join('');
  }

  /* ----------------------------------------------------------
     Recent videos
     ---------------------------------------------------------- */
  const recentVideosEl = document.getElementById('recent-videos');

  if (!recentVideos?.length) {
    recentVideosEl.innerHTML = `
      <div class="empty-state" style="padding:var(--space-xl) 0;">
        <p>No videos yet. <a href="/pages/admin/videos.html">Upload your first video.</a></p>
      </div>
    `;
  } else {
    recentVideosEl.innerHTML = recentVideos.map(v => `
      <div class="content-list-item" style="padding:var(--space-sm) 0;border-bottom:1px solid var(--color-mid-gray);">
        ${v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" class="content-list-item__thumbnail" alt="${v.title}" style="width:56px;">`
          : `<div style="width:56px;aspect-ratio:16/9;background:var(--color-dark-gray);border-radius:var(--border-radius);flex-shrink:0;"></div>`
        }
        <div class="content-list-item__info" style="padding:0;">
          <p class="content-list-item__title" style="font-size:var(--text-sm);">${v.title}</p>
          <div class="content-list-item__meta">
            <span>${new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
        <span class="badge ${v.published ? 'badge--active' : 'badge--draft'}" style="font-size:10px;">
          ${v.published ? 'Live' : 'Draft'}
        </span>
      </div>
    `).join('');
  }

})();
