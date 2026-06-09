/* ==========================================================
   admin-waivers.js — Waiver submissions view
   True Jiu Jitsu Online

   Shows all submitted waivers with search and type filter.
   Admins can view submission details in a modal.
   ========================================================== */

let allWaivers = [];


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function typeBadge(type) {
  return type === 'onboarding'
    ? `<span class="badge badge--active" style="font-size:10px;">Member</span>`
    : `<span class="badge badge--draft" style="font-size:10px;">Drop-in</span>`;
}


/* ----------------------------------------------------------
   Render waiver table
   ---------------------------------------------------------- */
function renderWaivers(waivers) {
  const container = document.getElementById('waivers-table-wrap');
  if (!container) return;

  if (!waivers.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <h3>No waivers yet</h3>
        <p>Submitted waivers will appear here.</p>
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
            <th>Type</th>
            <th>Photo Release</th>
            <th>Signed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="waivers-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('waivers-tbody');
  waivers.forEach(waiver => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div>
          <p style="margin:0;font-weight:500;color:var(--color-white);">${waiver.first_name} ${waiver.last_name}</p>
          ${waiver.is_minor ? `<span style="font-size:10px;color:var(--color-gray);">Minor</span>` : ''}
        </div>
      </td>
      <td style="font-size:var(--text-sm);color:var(--color-gray);">${waiver.email || '—'}</td>
      <td>${typeBadge(waiver.submission_type)}</td>
      <td style="font-size:var(--text-sm);">
        ${waiver.photo_release
          ? `<span style="color:var(--color-success);">✓ Yes</span>`
          : `<span style="color:var(--color-gray);">No</span>`
        }
      </td>
      <td style="font-size:var(--text-xs);color:var(--color-gray);">${formatDate(waiver.signed_at)}</td>
      <td>
        <button class="btn btn--ghost btn--sm js-view-waiver" data-id="${waiver.id}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.js-view-waiver').forEach(btn => {
    btn.addEventListener('click', () => openWaiverModal(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Waiver detail modal
   ---------------------------------------------------------- */
function openWaiverModal(waiverId) {
  const waiver = allWaivers.find(w => w.id === waiverId);
  if (!waiver) return;

  const modal = document.getElementById('waiver-detail-overlay');
  const body  = document.getElementById('waiver-detail-body');

  const row = (label, value) => value
    ? `<div style="display:flex;gap:var(--space-md);padding:var(--space-sm) 0;border-bottom:1px solid var(--color-mid-gray);">
        <p style="min-width:180px;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.08em;color:var(--color-gray);margin:0;flex-shrink:0;">${label}</p>
        <p style="font-size:var(--text-sm);color:var(--color-light-gray);margin:0;max-width:none;">${value}</p>
      </div>`
    : '';

  const check = (val) => val ? '✓ Agreed' : '✗ Not agreed';

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Full Name',     `${waiver.first_name} ${waiver.last_name}`)}
      ${row('Date of Birth', waiver.date_of_birth)}
      ${row('Minor',         waiver.is_minor ? 'Yes' : 'No')}
      ${row('Phone',         waiver.phone)}
      ${row('Email',         waiver.email)}
      ${row('Emergency Contact', waiver.emergency_contact_name)}
      ${row('Emergency Phone', waiver.emergency_contact_phone)}
    </div>

    <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin:var(--space-lg) 0 var(--space-sm);max-width:none;">Agreements</p>
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Assumption of Risk',   check(waiver.agreed_assumption_of_risk))}
      ${row('Medical Responsibility', check(waiver.agreed_medical_responsibility))}
      ${row('Liability Waiver',     check(waiver.agreed_liability_waiver))}
      ${row('Hold Harmless',        check(waiver.agreed_hold_harmless))}
      ${row('Gym Rules',            check(waiver.agreed_gym_rules))}
      ${row('Photo Release',        waiver.photo_release ? 'Yes' : 'No')}
    </div>

    <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin:var(--space-lg) 0 var(--space-sm);max-width:none;">Signature & Audit Trail</p>
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Signature Name', `<em style="font-family:Georgia,serif;font-size:var(--text-lg);">${waiver.signature_name}</em>`)}
      ${waiver.guardian_name ? row('Guardian Name', waiver.guardian_name) : ''}
      ${row('Signed At',    formatDate(waiver.signed_at))}
      ${row('Type',         waiver.submission_type)}
      ${row('IP Address',   waiver.ip_address || '—')}
    </div>
  `;

  modal.classList.add('is-open');
}

function closeWaiverModal() {
  document.getElementById('waiver-detail-overlay').classList.remove('is-open');
}


/* ----------------------------------------------------------
   Search + filter
   ---------------------------------------------------------- */
function setupFilters() {
  let activeType = '';

  document.getElementById('waiver-search')?.addEventListener('input', () => applyFilters(activeType));

  document.getElementById('type-filter')?.addEventListener('change', (e) => {
    activeType = e.target.value;
    applyFilters(activeType);
  });

  function applyFilters(type) {
    const query = (document.getElementById('waiver-search')?.value || '').toLowerCase().trim();
    const filtered = allWaivers.filter(w => {
      const name = `${w.first_name} ${w.last_name}`.toLowerCase();
      const matchesSearch = !query || name.includes(query) || (w.email || '').toLowerCase().includes(query);
      const matchesType   = !type  || w.submission_type === type;
      return matchesSearch && matchesType;
    });
    renderWaivers(filtered);
  }
}


/* ----------------------------------------------------------
   Load waivers
   ---------------------------------------------------------- */
async function loadWaivers() {
  const { data } = await window.supabaseClient
    .from('waiver_submissions')
    .select('*')
    .order('signed_at', { ascending: false });
  allWaivers = data || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

    <!-- Controls row -->
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-bottom:var(--space-xl);">
      <input class="form__input" type="text" id="waiver-search"
        placeholder="Search by name or email…" style="max-width:240px;">
      <select class="form__select" id="type-filter" style="max-width:180px;">
        <option value="">All Types</option>
        <option value="drop-in">Drop-in only</option>
        <option value="onboarding">Members only</option>
      </select>

      <!-- Quick links for sharing -->
      <div style="margin-left:auto;display:flex;gap:var(--space-sm);">
        <a href="/waiver" target="_blank" class="btn btn--ghost btn--sm">↗ Drop-in Waiver</a>
        <a href="/join"   target="_blank" class="btn btn--ghost btn--sm">↗ Member Onboarding</a>
      </div>
    </div>

    <!-- Waivers table -->
    <div id="waivers-table-wrap">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>


    <!-- Waiver detail modal -->
    <div class="modal-overlay" id="waiver-detail-overlay">
      <div class="modal" style="max-width:560px;max-height:80vh;overflow-y:auto;">
        <div class="modal__header">
          <h2 class="modal__title">Waiver Submission</h2>
          <button class="modal__close" id="close-waiver-modal" aria-label="Close">✕</button>
        </div>
        <div style="padding:var(--space-lg);" id="waiver-detail-body"></div>
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

  const content = renderAdminShell('waivers', 'Waivers');
  buildPage(content);

  await loadWaivers();
  renderWaivers(allWaivers);
  setupFilters();

  // Modal
  document.getElementById('close-waiver-modal')?.addEventListener('click', closeWaiverModal);
  safeModalClose('waiver-detail-overlay', closeWaiverModal);

})();
