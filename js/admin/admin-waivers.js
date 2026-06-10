/* ==========================================================
   admin-waivers.js — Waiver submissions view
   True Jiu Jitsu Online

   Shows all submitted waivers with search filter.
   Admins can view full submission details or delete a record.
   ========================================================== */

let allWaivers = [];


/* ----------------------------------------------------------
   Helpers

   showToast, formatDate, and confirmAction are defined in
   admin-auth.js, loaded before this file on every admin page.

   For waivers we need the time shown, so we call
   formatDate(iso, true) to include hours and minutes.
   ---------------------------------------------------------- */


/* ----------------------------------------------------------
   Render waiver table
   ---------------------------------------------------------- */
function renderWaivers(waivers) {
  const container = document.getElementById('waivers-table-wrap');
  if (!container) return;

  if (!waivers.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#x1F4CB;</div>
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
            <th class="dt-hide-md">Email</th>
            <th class="dt-hide-md">Photo Release</th>
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
      <td class="dt-hide-md" style="font-size:var(--text-sm);color:var(--color-gray);">${waiver.email || '&mdash;'}</td>
      <td class="dt-hide-md" style="font-size:var(--text-sm);">
        ${waiver.photo_release
          ? `<span style="color:var(--color-success);">&#x2713; Yes</span>`
          : `<span style="color:var(--color-gray);">No</span>`
        }
      </td>
      <td style="font-size:var(--text-xs);color:var(--color-gray);">${formatDate(waiver.signed_at, true)}</td>
      <td>
        <div class="data-table__actions">
          <button class="btn btn--ghost btn--sm js-view-waiver" data-id="${waiver.id}">View</button>
          <button class="btn btn--danger btn--sm js-delete-waiver" data-id="${waiver.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // View button — opens the detail modal
  tbody.querySelectorAll('.js-view-waiver').forEach(btn => {
    btn.addEventListener('click', () => openWaiverModal(btn.dataset.id));
  });

  // Delete button — inline confirmation before removing the record
  tbody.querySelectorAll('.js-delete-waiver').forEach(btn => {
    btn.addEventListener('click', () => {
      const waiver = allWaivers.find(w => w.id === btn.dataset.id);
      if (!waiver) return;
      const name = waiver.first_name + ' ' + waiver.last_name;
      confirmAction(btn, 'Delete ' + name + '\'s waiver?', () => deleteWaiver(waiver.id));
    });
  });
}


/* ----------------------------------------------------------
   Delete a waiver record
   ---------------------------------------------------------- */
async function deleteWaiver(waiverId) {
  const { error } = await window.supabaseClient
    .from('waiver_submissions')
    .delete()
    .eq('id', waiverId);

  if (error) {
    showToast('Failed to delete waiver', 'error');
    return;
  }

  showToast('Waiver deleted');
  allWaivers = allWaivers.filter(w => w.id !== waiverId);
  // Re-apply the current search filter so the displayed list stays consistent
  applyCurrentFilters();
}


/* ----------------------------------------------------------
   Waiver detail modal
   ---------------------------------------------------------- */
function openWaiverModal(waiverId) {
  const waiver = allWaivers.find(w => w.id === waiverId);
  if (!waiver) return;

  const body = document.getElementById('waiver-detail-body');

  // Helper: renders a single label/value row, or nothing if value is empty
  const row = (label, value) => value
    ? `<div style="display:flex;gap:var(--space-md);padding:var(--space-sm) 0;border-bottom:1px solid var(--color-mid-gray);">
        <p style="min-width:180px;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.08em;color:var(--color-gray);margin:0;flex-shrink:0;">${label}</p>
        <p style="font-size:var(--text-sm);color:var(--color-light-gray);margin:0;max-width:none;">${value}</p>
      </div>`
    : '';

  const check = (val) => val ? '&#x2713; Agreed' : '&#x2717; Not agreed';

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Full Name',         waiver.first_name + ' ' + waiver.last_name)}
      ${row('Date of Birth',     waiver.date_of_birth)}
      ${row('Minor',             waiver.is_minor ? 'Yes' : 'No')}
      ${row('Phone',             waiver.phone)}
      ${row('Email',             waiver.email)}
      ${row('Emergency Contact', waiver.emergency_contact_name)}
      ${row('Emergency Phone',   waiver.emergency_contact_phone)}
    </div>

    <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin:var(--space-lg) 0 var(--space-sm);max-width:none;">Agreements</p>
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Assumption of Risk',       check(waiver.agreed_assumption_of_risk))}
      ${row('Medical Responsibility',   check(waiver.agreed_medical_responsibility))}
      ${row('Liability Waiver',         check(waiver.agreed_liability_waiver))}
      ${row('Hold Harmless',            check(waiver.agreed_hold_harmless))}
      ${row('Gym Rules',                check(waiver.agreed_gym_rules))}
      ${row('Photo Release',            waiver.photo_release ? 'Yes' : 'No')}
    </div>

    <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin:var(--space-lg) 0 var(--space-sm);max-width:none;">Signature &amp; Audit Trail</p>
    <div style="display:flex;flex-direction:column;gap:0;">
      ${row('Signature Name', '<em style="font-family:Georgia,serif;font-size:var(--text-lg);">' + waiver.signature_name + '</em>')}
      ${waiver.guardian_name ? row('Guardian Name', waiver.guardian_name) : ''}
      ${row('Type',       waiver.submission_type)}
      ${row('Signed At',  formatDate(waiver.signed_at, true))}
      ${row('IP Address', waiver.ip_address || '&mdash;')}
    </div>
  `;

  document.getElementById('waiver-detail-overlay').classList.add('is-open');
}

function closeWaiverModal() {
  document.getElementById('waiver-detail-overlay').classList.remove('is-open');
}


/* ----------------------------------------------------------
   Search filter
   Stored at module scope so deleteWaiver can re-apply it
   after removing a record from allWaivers.
   ---------------------------------------------------------- */
let _currentSearchQuery = '';

function applyCurrentFilters() {
  const filtered = allWaivers.filter(w => {
    if (!_currentSearchQuery) return true;
    const name = (w.first_name + ' ' + w.last_name).toLowerCase();
    return name.includes(_currentSearchQuery)
        || (w.email || '').toLowerCase().includes(_currentSearchQuery);
  });
  renderWaivers(filtered);
}

function setupFilters() {
  const input = document.getElementById('waiver-search');
  if (!input) return;

  input.addEventListener('input', () => {
    _currentSearchQuery = input.value.toLowerCase().trim();
    applyCurrentFilters();
  });
}


/* ----------------------------------------------------------
   Load waivers from Supabase
   ---------------------------------------------------------- */
async function loadWaivers() {
  const { data, error } = await window.supabaseClient
    .from('waiver_submissions')
    .select('*')
    .order('signed_at', { ascending: false });

  if (error) showToast('Failed to load waivers', 'error');
  allWaivers = data || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

    <!-- Controls row -->
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-bottom:var(--space-xl);" class="admin-filter-bar">
      <input class="form__input" type="text" id="waiver-search"
        placeholder="Search by name or email&hellip;" style="max-width:240px;">

      <!-- Quick links for sharing the public waiver forms -->
      <div style="margin-left:auto;display:flex;gap:var(--space-sm);flex-shrink:0;">
        <a href="/waiver" target="_blank" class="btn btn--ghost btn--sm">&#x2197; Drop-in Waiver</a>
        <a href="/join"   target="_blank" class="btn btn--ghost btn--sm">&#x2197; Member Onboarding</a>
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
          <button class="modal__close" id="close-waiver-modal" aria-label="Close">&times;</button>
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

  document.getElementById('close-waiver-modal')?.addEventListener('click', closeWaiverModal);
  safeModalClose('waiver-detail-overlay', closeWaiverModal);

})();
