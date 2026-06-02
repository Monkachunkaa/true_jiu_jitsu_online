/* ==========================================================
   admin-members.js — Member management
   True Jiu Jitsu Online

   Shows a searchable list of all members with subscription
   status, join date, and quick access controls.
   ========================================================== */

let allMembers = [];


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id        = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className   = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function statusBadge(status) {
  const map = {
    active:    'badge--active',
    past_due:  'badge--past-due',
    cancelled: 'badge--cancelled',
    inactive:  'badge--cancelled',
  };
  return `<span class="badge ${map[status] || 'badge--cancelled'}">${status || 'inactive'}</span>`;
}


/* ----------------------------------------------------------
   Render members table
   ---------------------------------------------------------- */
function renderMembers(members) {
  const container = document.getElementById('members-table-wrap');
  if (!container) return;

  if (!members.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👥</div>
        <h3>No members yet</h3>
        <p>Members will appear here once they subscribe.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="members-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('members-tbody');
  members.forEach(member => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${member.name || '—'}</td>
      <td>${member.email}</td>
      <td>${statusBadge(member.subscription_status)}</td>
      <td>${formatDate(member.subscribed_at)}</td>
      <td>
        <div class="data-table__actions">
          ${member.subscription_status === 'active'
            ? `<button class="btn btn--danger btn--sm js-revoke" data-id="${member.id}">Revoke</button>`
            : `<button class="btn btn--secondary btn--sm js-grant" data-id="${member.id}">Grant Access</button>`
          }
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Revoke access
  tbody.querySelectorAll('.js-revoke').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revoke this member\'s access?')) return;
      const { error } = await window.supabaseClient
        .from('members')
        .update({ subscription_status: 'cancelled' })
        .eq('id', btn.dataset.id);

      if (error) { showToast('Failed to revoke access', 'error'); return; }
      showToast('Access revoked');
      await loadMembers();
      renderMembers(allMembers);
    });
  });

  // Grant access
  tbody.querySelectorAll('.js-grant').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await window.supabaseClient
        .from('members')
        .update({ subscription_status: 'active' })
        .eq('id', btn.dataset.id);

      if (error) { showToast('Failed to grant access', 'error'); return; }
      showToast('Access granted');
      await loadMembers();
      renderMembers(allMembers);
    });
  });
}


/* ----------------------------------------------------------
   Search filter
   ---------------------------------------------------------- */
function setupSearch() {
  const input = document.getElementById('member-search');
  if (!input) return;

  input.addEventListener('input', () => {
    const query   = input.value.toLowerCase().trim();
    const filtered = query
      ? allMembers.filter(m =>
          (m.name  || '').toLowerCase().includes(query) ||
          (m.email || '').toLowerCase().includes(query)
        )
      : allMembers;
    renderMembers(filtered);
  });
}


/* ----------------------------------------------------------
   Load members
   ---------------------------------------------------------- */
async function loadMembers() {
  const { data, error } = await window.supabaseClient
    .from('members')
    .select('id, name, email, subscription_status, subscribed_at, cancelled_at')
    .order('subscribed_at', { ascending: false });

  if (error) {
    showToast('Failed to load members', 'error');
    return;
  }

  allMembers = data || [];
}


/* ----------------------------------------------------------
   Build page
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

    <!-- Stats row -->
    <div class="stat-grid" style="margin-bottom:var(--space-2xl);">
      <div class="stat-card">
        <p class="stat-card__label">Active Members</p>
        <p class="stat-card__value" id="stat-active">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Total Members</p>
        <p class="stat-card__value" id="stat-total">—</p>
      </div>
    </div>

    <!-- Search -->
    <div class="admin-section-header">
      <h2>All Members</h2>
      <input
        class="form__input"
        type="text"
        id="member-search"
        placeholder="Search by name or email…"
        style="max-width:280px;"
      >
    </div>

    <div id="members-table-wrap" style="margin-top:var(--space-lg);">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>
  `;
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('members', 'Members');
  buildPage(content);

  await loadMembers();

  // Update stat cards
  const active = allMembers.filter(m => m.subscription_status === 'active').length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-total').textContent  = allMembers.length;

  renderMembers(allMembers);
  setupSearch();

})();
