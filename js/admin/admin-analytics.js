/* ==========================================================
   admin-analytics.js — Platform analytics dashboard
   True Jiu Jitsu Online

   Pulls data directly from Supabase and renders charts
   using Chart.js. Shows:
     - Key stat cards (members, MRR, videos, playlists)
     - Members over time (line chart)
     - New vs churned per month (bar chart)
     - Most watched videos (horizontal bar chart)
     - Playlist completion rates (bar chart)
   ========================================================== */


/* ----------------------------------------------------------
   Chart.js global defaults — dark theme
   ---------------------------------------------------------- */
function setChartDefaults() {
  Chart.defaults.color            = '#888888';
  Chart.defaults.borderColor      = '#2a2a2a';
  Chart.defaults.font.family      = "'Barlow', sans-serif";
  Chart.defaults.font.size        = 12;
  Chart.defaults.plugins.legend.display = false;
}


/* ----------------------------------------------------------
   Helper: group an array of ISO date strings by month.
   Returns an object like { '2026-01': 5, '2026-02': 3 }
   ---------------------------------------------------------- */
function groupByMonth(dates) {
  const counts = {};
  dates.forEach(iso => {
    if (!iso) return;
    const month = iso.slice(0, 7); // 'YYYY-MM'
    counts[month] = (counts[month] || 0) + 1;
  });
  return counts;
}

/* ----------------------------------------------------------
   Helper: generate the last N months as 'YYYY-MM' labels
   ---------------------------------------------------------- */
function lastNMonths(n) {
  const months = [];
  const now    = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/* ----------------------------------------------------------
   Helper: format 'YYYY-MM' as 'Jan 2026'
   ---------------------------------------------------------- */
function formatMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ----------------------------------------------------------
   Helper: format currency
   ---------------------------------------------------------- */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/* ----------------------------------------------------------
   Render stat cards
   ---------------------------------------------------------- */
function renderStatCards(container, stats) {
  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-card__label">Active Members</p>
        <p class="stat-card__value">${stats.activeMembers}</p>
        <p class="stat-card__delta">${stats.newThisMonth} new this month</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Est. Monthly Revenue</p>
        <p class="stat-card__value">${formatCurrency(stats.activeMembers * 8.99)}</p>
        <p class="stat-card__delta">at $8.99/mo</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Total Videos</p>
        <p class="stat-card__value">${stats.videoCount}</p>
        <p class="stat-card__delta">${stats.publishedVideos} published</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Total Playlists</p>
        <p class="stat-card__value">${stats.playlistCount}</p>
        <p class="stat-card__delta">${stats.publishedPlaylists} published</p>
      </div>
    </div>
  `;
}

/* ----------------------------------------------------------
   Render Members Over Time — cumulative line chart
   ---------------------------------------------------------- */
function renderMembersOverTime(canvas, members) {
  const months      = lastNMonths(6);
  const joinedMap   = groupByMonth(members.map(m => m.subscribed_at));

  // Build cumulative totals
  let cumulative = 0;
  const data = months.map(month => {
    cumulative += joinedMap[month] || 0;
    return cumulative;
  });

  new Chart(canvas, {
    type: 'line',
    data: {
      labels:   months.map(formatMonth),
      datasets: [{
        data,
        borderColor:     '#c41e2a',
        backgroundColor: 'rgba(196,30,42,0.1)',
        borderWidth:     2,
        fill:            true,
        tension:         0.4,
        pointBackgroundColor: '#c41e2a',
        pointRadius:     4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid:  { color: '#2a2a2a' },
        },
        x: { grid: { display: false } },
      },
      plugins: { tooltip: { callbacks: {
        label: ctx => `${ctx.parsed.y} members`,
      }}},
    },
  });
}

/* ----------------------------------------------------------
   Render New vs Churned — grouped bar chart
   ---------------------------------------------------------- */
function renderNewVsChurned(canvas, members) {
  const months     = lastNMonths(6);
  const newMap     = groupByMonth(members.map(m => m.subscribed_at));
  const churnedMap = groupByMonth(
    members.filter(m => m.cancelled_at).map(m => m.cancelled_at)
  );

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(formatMonth),
      datasets: [
        {
          label:           'New',
          data:            months.map(m => newMap[m] || 0),
          backgroundColor: '#2a9d5c',
          borderRadius:    3,
        },
        {
          label:           'Churned',
          data:            months.map(m => churnedMap[m] || 0),
          backgroundColor: '#c41e2a',
          borderRadius:    3,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels:  { color: '#888', boxWidth: 12 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid:  { color: '#2a2a2a' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ----------------------------------------------------------
   Render Most Watched Videos — horizontal bar chart
   ---------------------------------------------------------- */
function renderMostWatched(canvas, watchData) {
  if (!watchData.length) {
    canvas.parentElement.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-xl);text-align:center;">
        No watch data yet.
      </p>
    `;
    return;
  }

  const top    = watchData.slice(0, 8);
  const labels = top.map(v => v.videos?.title || 'Unknown');
  const data   = top.map(v => v.watch_count);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(196,30,42,0.7)',
        borderColor:     '#c41e2a',
        borderWidth:     1,
        borderRadius:    3,
      }],
    },
    options: {
      indexAxis:           'y',
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid:  { color: '#2a2a2a' },
        },
        y: {
          grid: { display: false },
          ticks: {
            // Truncate long titles
            callback: (val, i) => {
              const label = labels[i];
              return label.length > 28 ? label.slice(0, 28) + '…' : label;
            },
          },
        },
      },
      plugins: { tooltip: { callbacks: {
        label: ctx => `${ctx.parsed.x} views`,
      }}},
    },
  });
}

/* ----------------------------------------------------------
   Render Playlist Completion — bar chart
   Shows average % completion per playlist across all members
   ---------------------------------------------------------- */
function renderPlaylistCompletion(canvas, playlists, playlistItems, videoProgress) {
  if (!playlists.length) {
    canvas.parentElement.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-xl);text-align:center;">
        No playlist data yet.
      </p>
    `;
    return;
  }

  // Build a set of completed video IDs
  const completedVideoIds = new Set(
    videoProgress.filter(p => p.completed).map(p => p.video_id)
  );

  const labels = [];
  const data   = [];

  playlists.forEach(playlist => {
    const items = playlistItems.filter(i => i.playlist_id === playlist.id);
    if (!items.length) return;

    const completedCount = items.filter(i =>
      i.video_id && completedVideoIds.has(i.video_id)
    ).length;

    const pct = Math.round((completedCount / items.length) * 100);
    labels.push(playlist.title);
    data.push(pct);
  });

  if (!labels.length) return;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v =>
          v === 100 ? '#2a9d5c' : 'rgba(196,30,42,0.7)'
        ),
        borderRadius: 3,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max:  100,
          ticks: { callback: v => `${v}%` },
          grid:  { color: '#2a2a2a' },
        },
        x: { grid: { display: false } },
      },
      plugins: { tooltip: { callbacks: {
        label: ctx => `${ctx.parsed.y}% avg completion`,
      }}},
    },
  });
}

/* ----------------------------------------------------------
   Build the page HTML skeleton
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

    <!-- Stat cards -->
    <div id="stat-cards">
      <div class="stat-grid">
        ${[1,2,3,4].map(() => `
          <div class="stat-card">
            <p class="stat-card__label">Loading…</p>
            <p class="stat-card__value">—</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Charts row 1: Members over time + New vs Churned -->
    <div class="chart-grid" style="margin-top:var(--space-2xl);">

      <div class="chart-card">
        <p class="chart-card__title">Members Over Time</p>
        <div style="position:relative;height:220px;">
          <canvas id="chart-members-over-time"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <p class="chart-card__title">New vs Churned (Last 6 Months)</p>
        <div style="position:relative;height:220px;">
          <canvas id="chart-new-vs-churned"></canvas>
        </div>
      </div>

    </div>

    <!-- Charts row 2: Most watched + Playlist completion -->
    <div class="chart-grid" style="margin-top:var(--space-xl);">

      <div class="chart-card">
        <p class="chart-card__title">Most Watched Videos</p>
        <div style="position:relative;height:280px;">
          <canvas id="chart-most-watched"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <p class="chart-card__title">Avg Playlist Completion</p>
        <div style="position:relative;height:280px;">
          <canvas id="chart-playlist-completion"></canvas>
        </div>
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

  const content = renderAdminShell('analytics', 'Analytics');
  buildPage(content);
  setChartDefaults();

  /* ----------------------------------------------------------
     Fetch all data in parallel
     ---------------------------------------------------------- */
  const [
    { data: members },
    { count: videoCount },
    { count: publishedVideos },
    { count: playlistCount },
    { count: publishedPlaylists },
    { data: watchRaw },
    { data: playlists },
    { data: playlistItems },
    { data: videoProgress },
  ] = await Promise.all([
    window.supabaseClient
      .from('members')
      .select('id, subscription_status, subscribed_at, cancelled_at')
      .order('subscribed_at'),

    window.supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true }),

    window.supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('published', true),

    window.supabaseClient
      .from('playlists')
      .select('*', { count: 'exact', head: true }),

    window.supabaseClient
      .from('playlists')
      .select('*', { count: 'exact', head: true })
      .eq('published', true),

    // Watch counts per video — Supabase doesn't support GROUP BY directly
    // so we fetch all progress records and aggregate in JS
    window.supabaseClient
      .from('video_progress')
      .select('video_id, videos(title)'),

    window.supabaseClient
      .from('playlists')
      .select('id, title')
      .eq('published', true),

    window.supabaseClient
      .from('playlist_items')
      .select('playlist_id, video_id'),

    window.supabaseClient
      .from('video_progress')
      .select('video_id, completed'),
  ]);

  const activeMembers = (members || []).filter(m => m.subscription_status === 'active').length;
  const thisMonth     = new Date().toISOString().slice(0, 7);
  const newThisMonth  = (members || []).filter(m => m.subscribed_at?.startsWith(thisMonth)).length;

  /* ----------------------------------------------------------
     Aggregate watch counts per video
     ---------------------------------------------------------- */
  const watchMap = {};
  (watchRaw || []).forEach(row => {
    if (!row.video_id) return;
    if (!watchMap[row.video_id]) {
      watchMap[row.video_id] = { videos: row.videos, watch_count: 0 };
    }
    watchMap[row.video_id].watch_count++;
  });

  const watchData = Object.values(watchMap)
    .sort((a, b) => b.watch_count - a.watch_count);

  /* ----------------------------------------------------------
     Render everything
     ---------------------------------------------------------- */
  renderStatCards(document.getElementById('stat-cards'), {
    activeMembers,
    newThisMonth,
    videoCount:        videoCount   || 0,
    publishedVideos:   publishedVideos || 0,
    playlistCount:     playlistCount || 0,
    publishedPlaylists: publishedPlaylists || 0,
  });

  renderMembersOverTime(
    document.getElementById('chart-members-over-time'),
    members || []
  );

  renderNewVsChurned(
    document.getElementById('chart-new-vs-churned'),
    members || []
  );

  renderMostWatched(
    document.getElementById('chart-most-watched'),
    watchData
  );

  renderPlaylistCompletion(
    document.getElementById('chart-playlist-completion'),
    playlists     || [],
    playlistItems || [],
    videoProgress || []
  );

})();
