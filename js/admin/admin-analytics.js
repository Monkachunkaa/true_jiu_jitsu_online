/* ==========================================================
   admin-analytics.js — Platform analytics dashboard
   True Jiu Jitsu Online

   Pulls data from Supabase and renders charts using Chart.js.
   Covers the full platform model:
     - Gym memberships (gym_members + membership_plans)
     - Online video subscriptions (members)
     - Content engagement (video_progress)
   ========================================================== */


/* ----------------------------------------------------------
   Chart.js global defaults — dark theme
   ---------------------------------------------------------- */
function setChartDefaults() {
  Chart.defaults.color                   = '#888888';
  Chart.defaults.borderColor             = '#2a2a2a';
  Chart.defaults.font.family             = "'Barlow', sans-serif";
  Chart.defaults.font.size               = 12;
  Chart.defaults.plugins.legend.display  = false;
}

/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function groupByMonth(dates) {
  const counts = {};
  (dates || []).forEach(iso => {
    if (!iso) return;
    const month = iso.slice(0, 7);
    counts[month] = (counts[month] || 0) + 1;
  });
  return counts;
}

function lastNMonths(n) {
  const months = [];
  const now    = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100);
}


/* ----------------------------------------------------------
   Stat cards — reflects both gym and online revenue
   ---------------------------------------------------------- */
function renderStatCards(container, stats) {
  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-card__label">Total Active Members</p>
        <p class="stat-card__value">${stats.totalActive}</p>
        <p class="stat-card__delta">${stats.activeGym} gym · ${stats.activeOnline} online</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Est. Monthly Revenue</p>
        <p class="stat-card__value">${formatCurrency(stats.totalMRR)}</p>
        <p class="stat-card__delta">${formatCurrency(stats.gymMRR)} gym · ${formatCurrency(stats.onlineMRR)} online</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Published Videos</p>
        <p class="stat-card__value">${stats.publishedVideos}</p>
        <p class="stat-card__delta">${stats.videoCount} total</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Published Playlists</p>
        <p class="stat-card__value">${stats.publishedPlaylists}</p>
        <p class="stat-card__delta">${stats.playlistCount} total</p>
      </div>
    </div>
  `;
}


/* ----------------------------------------------------------
   Members Over Time — two lines: gym vs online
   ---------------------------------------------------------- */
function renderMembersOverTime(canvas, gymMembers, onlineMembers) {
  const months = lastNMonths(6);

  const gymMap    = groupByMonth(gymMembers.map(m => m.joined_at));
  const onlineMap = groupByMonth(onlineMembers.map(m => m.subscribed_at));

  let gymCumulative    = 0;
  let onlineCumulative = 0;

  const gymData    = months.map(m => { gymCumulative    += gymMap[m]    || 0; return gymCumulative; });
  const onlineData = months.map(m => { onlineCumulative += onlineMap[m] || 0; return onlineCumulative; });

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: months.map(formatMonth),
      datasets: [
        {
          label:               'Gym',
          data:                gymData,
          borderColor:         '#c41e2a',
          backgroundColor:     'rgba(196,30,42,0.08)',
          borderWidth:         2,
          fill:                true,
          tension:             0.4,
          pointBackgroundColor: '#c41e2a',
          pointRadius:         4,
        },
        {
          label:               'Online',
          data:                onlineData,
          borderColor:         '#2a9d5c',
          backgroundColor:     'rgba(42,157,92,0.08)',
          borderWidth:         2,
          fill:                true,
          tension:             0.4,
          pointBackgroundColor: '#2a9d5c',
          pointRadius:         4,
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
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#2a2a2a' } },
        x: { grid: { display: false } },
      },
    },
  });
}


/* ----------------------------------------------------------
   New vs Churned — combined gym + online per month
   ---------------------------------------------------------- */
function renderNewVsChurned(canvas, gymMembers, onlineMembers) {
  const months = lastNMonths(6);

  const newGymMap      = groupByMonth(gymMembers.map(m => m.joined_at));
  const newOnlineMap   = groupByMonth(onlineMembers.map(m => m.subscribed_at));
  const churnedGymMap  = groupByMonth(gymMembers.filter(m => m.cancelled_at).map(m => m.cancelled_at));
  const churnedOnlineMap = groupByMonth(onlineMembers.filter(m => m.cancelled_at).map(m => m.cancelled_at));

  const newData     = months.map(m => (newGymMap[m] || 0) + (newOnlineMap[m] || 0));
  const churnedData = months.map(m => (churnedGymMap[m] || 0) + (churnedOnlineMap[m] || 0));

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(formatMonth),
      datasets: [
        { label: 'New',     data: newData,     backgroundColor: '#2a9d5c', borderRadius: 3 },
        { label: 'Churned', data: churnedData, backgroundColor: '#c41e2a', borderRadius: 3 },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#888', boxWidth: 12 } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#2a2a2a' } },
        x: { grid: { display: false } },
      },
    },
  });
}


/* ----------------------------------------------------------
   Revenue by Plan — horizontal bar chart
   Shows actual MRR contribution per membership plan
   ---------------------------------------------------------- */
function renderRevenueByPlan(canvas, gymMembers, plans) {
  if (!plans.length) {
    canvas.parentElement.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-xl);text-align:center;">
        No plans yet.
      </p>
    `;
    return;
  }

  // Calculate MRR per plan
  const planRevenue = plans.map(plan => {
    const mrrCents = gymMembers
      .filter(m => m.plan_id === plan.id && m.subscription_status === 'active')
      .reduce((sum, m) => {
        const disc = m.discount_percent || 0;
        return sum + Math.round(plan.price_cents * (1 - disc / 100));
      }, 0);

    const memberCount = gymMembers.filter(
      m => m.plan_id === plan.id && m.subscription_status === 'active'
    ).length;

    return { name: plan.name, mrrCents, memberCount };
  }).filter(p => p.mrrCents > 0);

  // Add online as its own "plan"
  const onlineActive = gymMembers.length; // placeholder — replaced in MAIN
  // Note: onlineActive passed in as extra via canvas.dataset

  if (!planRevenue.length) {
    canvas.parentElement.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-xl);text-align:center;">
        No active members with plans yet.
      </p>
    `;
    return;
  }

  const labels = planRevenue.map(p => `${p.name} (${p.memberCount})`);
  const data   = planRevenue.map(p => p.mrrCents / 100);

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
          ticks: { callback: v => `$${v}` },
          grid:  { color: '#2a2a2a' },
        },
        y: { grid: { display: false } },
      },
      plugins: { tooltip: { callbacks: {
        label: ctx => `$${ctx.parsed.x.toFixed(0)}/mo`,
      }}},
    },
  });
}


/* ----------------------------------------------------------
   Most Watched Videos — horizontal bar chart
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
  const labels = top.map(v => v.title || 'Unknown');
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
        x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#2a2a2a' } },
        y: {
          grid: { display: false },
          ticks: {
            callback: (val, i) => {
              const label = labels[i];
              return label.length > 28 ? label.slice(0, 28) + '…' : label;
            },
          },
        },
      },
      plugins: { tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} views` } } },
    },
  });
}


/* ----------------------------------------------------------
   Playlist Completion — bar chart
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

  const completedIds = new Set(videoProgress.filter(p => p.completed).map(p => p.video_id));
  const labels = [], data = [];

  playlists.forEach(playlist => {
    const items = playlistItems.filter(i => i.playlist_id === playlist.id);
    if (!items.length) return;
    const pct = Math.round(
      (items.filter(i => i.video_id && completedIds.has(i.video_id)).length / items.length) * 100
    );
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
        backgroundColor: data.map(v => v === 100 ? '#2a9d5c' : 'rgba(196,30,42,0.7)'),
        borderRadius: 3,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true, max: 100,
          ticks: { callback: v => `${v}%` },
          grid:  { color: '#2a2a2a' },
        },
        x: { grid: { display: false } },
      },
      plugins: { tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}% avg completion` } } },
    },
  });
}


/* ----------------------------------------------------------
   Page HTML skeleton
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

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

    <!-- Row 1: Members over time + New vs Churned -->
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

    <!-- Row 2: Revenue by plan + Most watched -->
    <div class="chart-grid" style="margin-top:var(--space-xl);">
      <div class="chart-card">
        <p class="chart-card__title">Monthly Revenue by Plan</p>
        <div style="position:relative;height:280px;">
          <canvas id="chart-revenue-by-plan"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <p class="chart-card__title">Most Watched Videos</p>
        <div style="position:relative;height:280px;">
          <canvas id="chart-most-watched"></canvas>
        </div>
      </div>
    </div>

    <!-- Row 3: Playlist completion (full width) -->
    <div class="chart-grid" style="margin-top:var(--space-xl);">
      <div class="chart-card">
        <p class="chart-card__title">Avg Playlist Completion</p>
        <div style="position:relative;height:240px;">
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

  /* Fetch all data in parallel */
  const [
    { data: gymMembers },
    { data: onlineMembers },
    { data: plans },
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
      .from('gym_members')
      .select('id, subscription_status, plan_id, discount_percent, joined_at, cancelled_at')
      .order('joined_at'),

    window.supabaseClient
      .from('members')
      .select('id, subscription_status, subscribed_at, cancelled_at')
      .order('subscribed_at'),

    window.supabaseClient
      .from('membership_plans')
      .select('id, name, price_cents')
      .order('display_order'),

    window.supabaseClient.from('videos').select('*', { count: 'exact', head: true }),
    window.supabaseClient.from('videos').select('*', { count: 'exact', head: true }).eq('published', true),
    window.supabaseClient.from('playlists').select('*', { count: 'exact', head: true }),
    window.supabaseClient.from('playlists').select('*', { count: 'exact', head: true }).eq('published', true),

    window.supabaseClient.from('video_progress').select('video_id, videos(title)'),
    window.supabaseClient.from('playlists').select('id, title').eq('published', true),
    window.supabaseClient.from('playlist_items').select('playlist_id, video_id'),
    window.supabaseClient.from('video_progress').select('video_id, completed'),
  ]);

  /* Calculate MRR */
  const planMap = Object.fromEntries((plans || []).map(p => [p.id, p]));

  const activeGym    = (gymMembers || []).filter(m => m.subscription_status === 'active').length;
  const activeOnline = (onlineMembers || []).filter(m => m.subscription_status === 'active').length;

  const gymMRR = (gymMembers || [])
    .filter(m => m.subscription_status === 'active' && m.plan_id)
    .reduce((sum, m) => {
      const plan = planMap[m.plan_id];
      return sum + Math.round((plan?.price_cents || 0) * (1 - (m.discount_percent || 0) / 100));
    }, 0);

  const onlineMRR = activeOnline * 899;
  const totalMRR  = gymMRR + onlineMRR;

  /* Aggregate watch data */
  const watchMap = {};
  (watchRaw || []).forEach(row => {
    if (!row.video_id) return;
    if (!watchMap[row.video_id]) watchMap[row.video_id] = { title: row.videos?.title || 'Unknown', watch_count: 0 };
    watchMap[row.video_id].watch_count++;
  });
  const watchData = Object.values(watchMap).sort((a, b) => b.watch_count - a.watch_count);

  /* Render */
  renderStatCards(document.getElementById('stat-cards'), {
    totalActive: activeGym + activeOnline,
    activeGym, activeOnline,
    gymMRR, onlineMRR, totalMRR,
    videoCount:        videoCount        || 0,
    publishedVideos:   publishedVideos   || 0,
    playlistCount:     playlistCount     || 0,
    publishedPlaylists: publishedPlaylists || 0,
  });

  renderMembersOverTime(
    document.getElementById('chart-members-over-time'),
    gymMembers    || [],
    onlineMembers || []
  );

  renderNewVsChurned(
    document.getElementById('chart-new-vs-churned'),
    gymMembers    || [],
    onlineMembers || []
  );

  renderRevenueByPlan(
    document.getElementById('chart-revenue-by-plan'),
    gymMembers || [],
    plans      || []
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
