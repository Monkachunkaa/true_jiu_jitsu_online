/* ==========================================================
   admin-dashboard.js — Home page
   True Jiu Jitsu Online

   Quick-access cards for the four most common admin actions,
   plus a stat summary at the top.
   ========================================================== */

(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('dashboard', 'Home');

  content.innerHTML = `

    <!-- Stat cards — compact row -->
    <div class="stat-grid" style="margin-bottom:var(--space-lg);">
      <div class="stat-card" style="padding:var(--space-md) var(--space-lg);">
        <p class="stat-card__label">Active Gym Members</p>
        <p class="stat-card__value" id="stat-gym-members" style="font-size:var(--text-2xl);">&#x2014;</p>
        <p class="stat-card__delta" id="stat-gym-delta"></p>
      </div>
      <div class="stat-card" style="padding:var(--space-md) var(--space-lg);">
        <p class="stat-card__label">Active Online Members</p>
        <p class="stat-card__value" id="stat-online-members" style="font-size:var(--text-2xl);">&#x2014;</p>
        <p class="stat-card__delta" id="stat-online-delta"></p>
      </div>
      <div class="stat-card" style="padding:var(--space-md) var(--space-lg);">
        <p class="stat-card__label">Est. Monthly Revenue</p>
        <p class="stat-card__value" id="stat-mrr" style="font-size:var(--text-2xl);">&#x2014;</p>
        <p class="stat-card__delta">gym + online, after discounts</p>
      </div>
      <div class="stat-card" style="padding:var(--space-md) var(--space-lg);">
        <p class="stat-card__label">Needs Attention</p>
        <p class="stat-card__value" id="stat-alerts" style="font-size:var(--text-2xl);">&#x2014;</p>
      </div>
    </div>

    <!-- Alerts row -->
    <div id="alert-row" style="display:none;margin-bottom:var(--space-2xl);"></div>

    <!-- Quick action cards -->
    <div class="admin-action-grid">

      <a href="/pages/admin/gym-members.html?action=add" class="quick-action-card">
        <div class="quick-action-card__icon">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="3" x2="12" y2="11" style="display:none"/><line x1="16" y1="11" x2="8" y2="11" style="display:none"/></svg>
        </div>
        <div class="quick-action-card__body">
          <h3 class="quick-action-card__title">Add Member</h3>
          <p class="quick-action-card__desc">Enroll a new gym member and send their billing link.</p>
        </div>
        <span class="quick-action-card__arrow">→</span>
      </a>

      <a href="/pages/admin/announcements.html" class="quick-action-card">
        <div class="quick-action-card__icon">
          <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
        </div>
        <div class="quick-action-card__body">
          <h3 class="quick-action-card__title">Send Announcement</h3>
          <p class="quick-action-card__desc">Broadcast an email to all active gym members.</p>
        </div>
        <span class="quick-action-card__arrow">→</span>
      </a>

      <a href="/pages/admin/videos.html?action=upload" class="quick-action-card">
        <div class="quick-action-card__icon">
          <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </div>
        <div class="quick-action-card__body">
          <h3 class="quick-action-card__title">Upload Video</h3>
          <p class="quick-action-card__desc">Add new instructional content to the library.</p>
        </div>
        <span class="quick-action-card__arrow">→</span>
      </a>

      <a href="/pages/admin/analytics.html" class="quick-action-card">
        <div class="quick-action-card__icon">
          <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <div class="quick-action-card__body">
          <h3 class="quick-action-card__title">View Analytics</h3>
          <p class="quick-action-card__desc">Revenue, membership trends, and content engagement.</p>
        </div>
        <span class="quick-action-card__arrow">→</span>
      </a>

    </div>
  `;

  /* ----------------------------------------------------------
     Fetch stats
     ---------------------------------------------------------- */
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [
    { data: gymMembers },
    { data: onlineMembers },
    { data: plans },
  ] = await Promise.all([
    window.supabaseClient
      .from('gym_members')
      .select('id, subscription_status, plan_id, discount_percent, joined_at'),
    window.supabaseClient
      .from('members')
      .select('id, subscription_status, subscribed_at'),
    window.supabaseClient
      .from('membership_plans')
      .select('id, price_cents'),
  ]);

  const planMap = Object.fromEntries((plans || []).map(p => [p.id, p]));

  const activeGym    = (gymMembers || []).filter(m => m.subscription_status === 'active').length;
  const pastDueGym   = (gymMembers || []).filter(m => m.subscription_status === 'past_due').length;
  const pendingGym   = (gymMembers || []).filter(m => m.subscription_status === 'pending').length;
  const newGymMonth  = (gymMembers || []).filter(m => m.joined_at?.startsWith(thisMonth)).length;
  const activeOnline = (onlineMembers || []).filter(m => m.subscription_status === 'active').length;
  const newOnlineMonth = (onlineMembers || []).filter(m => m.subscribed_at?.startsWith(thisMonth)).length;

  const gymMRR = (gymMembers || [])
    .filter(m => m.subscription_status === 'active' && m.plan_id)
    .reduce((sum, m) => {
      const plan = planMap[m.plan_id];
      return sum + Math.round((plan?.price_cents || 0) * (1 - (m.discount_percent || 0) / 100));
    }, 0);
  // Use shared price constant from admin-auth.js so it only needs updating in one place
  const totalMRR = gymMRR + activeOnline * ONLINE_SUBSCRIPTION_PRICE_CENTS;

  const mrrStr = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(totalMRR / 100);

  /* ----------------------------------------------------------
     Populate stat cards
     ---------------------------------------------------------- */
  document.getElementById('stat-gym-members').textContent = activeGym;
  document.getElementById('stat-gym-delta').textContent   = newGymMonth
    ? `+${newGymMonth} this month` : 'No new members this month';

  document.getElementById('stat-online-members').textContent = activeOnline;
  document.getElementById('stat-online-delta').textContent   = newOnlineMonth
    ? `+${newOnlineMonth} this month` : 'No new this month';

  document.getElementById('stat-mrr').textContent = mrrStr;

  const needsAttention = pastDueGym + pendingGym;
  document.getElementById('stat-alerts').textContent = needsAttention > 0
    ? `${needsAttention}`
    : 'All good';
  if (needsAttention > 0) {
    document.getElementById('stat-alerts').style.color = 'var(--color-red-accessible)';
  }

  /* ----------------------------------------------------------
     Alerts
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
    alertRow.style.display        = 'flex';
    alertRow.style.flexDirection  = 'column';
    alertRow.style.gap            = 'var(--space-sm)';
    alertRow.innerHTML            = alerts.join('');
  }

})();
