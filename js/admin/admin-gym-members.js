/* ==========================================================
   admin-gym-members.js — Unified member management
   True Jiu Jitsu Online

   Shows all gym members in one table with an Online Access
   column indicating whether they also have an active video
   subscription. Filter pills let Daniel slice by status
   and online access quickly.
   ========================================================== */

let allGymMembers  = [];
let allOnlineMembers = [];   // members table (video subscribers)
let allPlans       = [];
let editingId      = null;

let activeStatusFilter = '';  // '', 'active', 'past_due', 'pending', 'cancelled'
let activeOnlineFilter = '';  // '', 'yes', 'no'

const BELT_RANKS = ['Unknown', 'White', 'Blue', 'Purple', 'Brown', 'Black'];


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(0)}`;
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
    pending:   'badge--draft',
  };
  return `<span class="badge ${map[status] || 'badge--draft'}">${status || 'pending'}</span>`;
}

function beltBadge(belt) {
  const colors = {
    unknown: '#444444', white: '#ffffff', blue: '#1a73e8',
    purple: '#8b5cf6', brown: '#92400e', black: '#1a1a1a',
  };
  const color    = colors[(belt || 'unknown').toLowerCase()] || '#444444';
  const text     = (belt || 'Unknown').charAt(0).toUpperCase() + (belt || 'Unknown').slice(1);
  const darkText = ['white'].includes((belt || '').toLowerCase());
  return `<span style="display:inline-block;padding:2px 10px;border-radius:100px;font-size:10px;font-weight:600;background:${color};color:${darkText ? '#111' : '#fff'};border:1px solid rgba(255,255,255,0.1);">${text}</span>`;
}

function discountLabel(member) {
  if (!member.discount_percent) return '';
  const duration = member.discount_months ? `${member.discount_months}mo` : 'forever';
  return `<span class="badge badge--draft" style="margin-left:4px;font-size:10px;">-${member.discount_percent}% (${duration})</span>`;
}

function onlineBadge(hasOnline) {
  return hasOnline
    ? `<span class="badge badge--active" style="font-size:10px;">✓ Active</span>`
    : `<span style="color:var(--color-gray);font-size:var(--text-sm);">—</span>`;
}

/* ----------------------------------------------------------
   Determine if a gym member has an active online subscription.
   Checks online_member_id first, then falls back to email match.
   ---------------------------------------------------------- */
function getOnlineAccess(gymMember) {
  if (!gymMember.email) return false;
  const emailLower = gymMember.email.toLowerCase();
  return allOnlineMembers.some(om =>
    (om.id === gymMember.online_member_id || om.email?.toLowerCase() === emailLower)
    && om.subscription_status === 'active'
  );
}


/* ----------------------------------------------------------
   Discount section HTML
   ---------------------------------------------------------- */
function wireDiscountSection(prefix) {
  const sel  = document.getElementById(`${prefix}-discount-duration`);
  const wrap = document.getElementById(`${prefix}-discount-months-wrap`);
  if (!sel || !wrap) return;
  sel.addEventListener('change', () => {
    wrap.style.display = sel.value === 'months' ? '' : 'none';
  });
}

function readDiscountFields(prefix) {
  const pct  = parseInt(document.getElementById(`${prefix}-discount-percent`)?.value) || 0;
  if (!pct) return { discountPercent: null, discountMonths: null };
  const sel    = document.getElementById(`${prefix}-discount-duration`);
  const months = sel?.value === 'months'
    ? (parseInt(document.getElementById(`${prefix}-discount-months`)?.value) || null)
    : null;
  return { discountPercent: pct, discountMonths: months };
}

function discountSectionHTML(prefix, existingPercent = '', existingMonths = null) {
  const hasDuration = !!existingMonths;
  return `
    <div class="form__group">
      <label class="form__label">Discount <span style="color:var(--color-gray);font-weight:400;">(optional)</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div>
          <label class="form__hint" style="display:block;margin-bottom:4px;">Percentage Off</label>
          <input class="form__input" type="number" id="${prefix}-discount-percent"
            placeholder="e.g. 20" min="0" max="100" step="1" value="${existingPercent || ''}">
        </div>
        <div>
          <label class="form__hint" style="display:block;margin-bottom:4px;">Duration</label>
          <select class="form__select" id="${prefix}-discount-duration">
            <option value="forever" ${!hasDuration ? 'selected' : ''}>Indefinite</option>
            <option value="months"  ${hasDuration  ? 'selected' : ''}>Set duration</option>
          </select>
        </div>
      </div>
      <div id="${prefix}-discount-months-wrap" style="${hasDuration ? '' : 'display:none;'}margin-top:var(--space-sm);">
        <input class="form__input" type="number" id="${prefix}-discount-months"
          placeholder="Number of months" min="1" step="1" value="${existingMonths || ''}">
      </div>
      <span class="form__hint">Leave percentage blank for no discount</span>
    </div>
  `;
}


/* ----------------------------------------------------------
   Apply all active filters and re-render
   ---------------------------------------------------------- */
function applyFilters() {
  const query = (document.getElementById('member-search')?.value || '').toLowerCase().trim();

  const filtered = allGymMembers.filter(m => {
    const hasOnline = getOnlineAccess(m);

    const matchesSearch = !query
      || (m.name  || '').toLowerCase().includes(query)
      || (m.email || '').toLowerCase().includes(query)
      || (m.phone || '').toLowerCase().includes(query);

    const matchesStatus = !activeStatusFilter
      || m.subscription_status === activeStatusFilter;

    const matchesOnline = !activeOnlineFilter
      || (activeOnlineFilter === 'yes' &&  hasOnline)
      || (activeOnlineFilter === 'no'  && !hasOnline);

    return matchesSearch && matchesStatus && matchesOnline;
  });

  renderMembers(filtered);
}


/* ----------------------------------------------------------
   Render the members table
   ---------------------------------------------------------- */
function renderMembers(members) {
  const container = document.getElementById('members-table-wrap');
  if (!container) return;

  if (!members.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🥋</div>
        <h3>No members match your filters</h3>
        <p>Try adjusting the search or filter options above.</p>
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
            <th>Belt</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Online Access</th>
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
    const plan      = allPlans.find(p => p.id === member.plan_id);
    const hasOnline = getOnlineAccess(member);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div>
          <p style="margin:0;font-weight:500;color:var(--color-white);">${member.name}</p>
          ${member.email ? `<p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);">${member.email}</p>` : ''}
          ${member.phone ? `<p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);">${member.phone}</p>` : ''}
        </div>
      </td>
      <td>${beltBadge(member.belt_rank)}</td>
      <td style="font-size:var(--text-sm);">
        ${plan
          ? `${plan.name} <span style="color:var(--color-gray);">(${formatPrice(plan.price_cents)}/mo)</span>${discountLabel(member)}`
          : '<span style="color:var(--color-gray);">No plan</span>'
        }
      </td>
      <td>${statusBadge(member.subscription_status)}</td>
      <td>${onlineBadge(hasOnline)}</td>
      <td style="font-size:var(--text-sm);color:var(--color-gray);">${formatDate(member.joined_at)}</td>
      <td>
        <div class="data-table__actions">
          <button class="btn btn--ghost btn--sm js-edit-member" data-id="${member.id}">Edit</button>
          ${member.subscription_status === 'pending' || !member.stripe_subscription_id
            ? `<button class="btn btn--secondary btn--sm js-send-billing" data-id="${member.id}">Send Billing Link</button>`
            : ''
          }
          ${member.subscription_status === 'active'
            ? `<button class="btn btn--danger btn--sm js-cancel-member" data-id="${member.id}">Cancel</button>`
            : ''
          }
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.js-edit-member').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.js-send-billing').forEach(btn => {
    btn.addEventListener('click', () => sendBillingLink(btn.dataset.id, btn));
  });
  tbody.querySelectorAll('.js-cancel-member').forEach(btn => {
    btn.addEventListener('click', () => cancelMembership(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Set up filter pills
   ---------------------------------------------------------- */
function setupFilters() {
  document.getElementById('status-filter')?.addEventListener('change', (e) => {
    activeStatusFilter = e.target.value;
    applyFilters();
  });

  document.getElementById('online-filter')?.addEventListener('change', (e) => {
    activeOnlineFilter = e.target.value;
    applyFilters();
  });

  document.getElementById('member-search')?.addEventListener('input', applyFilters);
}


/* ----------------------------------------------------------
   Add member modal
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('add-member-overlay').classList.add('is-open');
  document.getElementById('add-member-form').reset();
  const monthsWrap = document.getElementById('add-member-discount-months-wrap');
  if (monthsWrap) monthsWrap.style.display = 'none';
  populatePlanDropdown('add-member-plan');
}

function closeAddModal() {
  document.getElementById('add-member-overlay').classList.remove('is-open');
  const saveBtn = document.getElementById('save-member-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Add Member'; }
}

async function saveMember(e) {
  e.preventDefault();
  const name   = document.getElementById('add-member-name').value.trim();
  const email  = document.getElementById('add-member-email').value.trim();
  const phone  = document.getElementById('add-member-phone').value.trim();
  const belt   = document.getElementById('add-member-belt').value;
  const planId = document.getElementById('add-member-plan').value || null;
  const notes  = document.getElementById('add-member-notes').value.trim();
  const { discountPercent, discountMonths } = readDiscountFields('add-member');

  if (!name) { showToast('Name is required', 'error'); return; }

  const saveBtn = document.getElementById('save-member-btn');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

  const { error } = await window.supabaseClient.from('gym_members').insert({
    name, email: email || null, phone: phone || null,
    belt_rank: belt || 'unknown', plan_id: planId,
    notes: notes || null, discount_percent: discountPercent,
    discount_months: discountMonths, subscription_status: 'pending',
  });

  if (error) {
    showToast('Failed to add member', 'error');
    saveBtn.disabled = false; saveBtn.textContent = 'Add Member';
    return;
  }

  showToast('Member added!');
  closeAddModal();
  await loadData();
  updateStats();
  applyFilters();
}


/* ----------------------------------------------------------
   Edit member modal
   ---------------------------------------------------------- */
function openEditModal(memberId) {
  editingId = memberId;
  const member = allGymMembers.find(m => m.id === memberId);
  if (!member) return;

  document.getElementById('edit-member-name').value  = member.name      || '';
  document.getElementById('edit-member-email').value = member.email     || '';
  document.getElementById('edit-member-phone').value = member.phone     || '';
  document.getElementById('edit-member-belt').value  = member.belt_rank || 'unknown';
  document.getElementById('edit-member-notes').value = member.notes     || '';

  const pctInput    = document.getElementById('edit-member-discount-percent');
  const durSelect   = document.getElementById('edit-member-discount-duration');
  const monthsInput = document.getElementById('edit-member-discount-months');
  const monthsWrap  = document.getElementById('edit-member-discount-months-wrap');
  if (pctInput)    pctInput.value    = member.discount_percent || '';
  if (durSelect)   durSelect.value   = member.discount_months ? 'months' : 'forever';
  if (monthsInput) monthsInput.value = member.discount_months || '';
  if (monthsWrap)  monthsWrap.style.display = member.discount_months ? '' : 'none';

  populatePlanDropdown('edit-member-plan', member.plan_id);
  document.getElementById('edit-member-overlay').classList.add('is-open');
}

function closeEditModal() {
  document.getElementById('edit-member-overlay').classList.remove('is-open');
  const saveBtn = document.getElementById('save-edit-member-btn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
  editingId = null;
}

async function saveEditedMember(e) {
  e.preventDefault();
  if (!editingId) return;

  const name   = document.getElementById('edit-member-name').value.trim();
  const email  = document.getElementById('edit-member-email').value.trim();
  const phone  = document.getElementById('edit-member-phone').value.trim();
  const belt   = document.getElementById('edit-member-belt').value;
  const planId = document.getElementById('edit-member-plan').value || null;
  const notes  = document.getElementById('edit-member-notes').value.trim();
  const { discountPercent, discountMonths } = readDiscountFields('edit-member');

  if (!name) { showToast('Name is required', 'error'); return; }

  const saveBtn = document.getElementById('save-edit-member-btn');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

  const currentMember   = allGymMembers.find(m => m.id === editingId);
  const discountChanged = discountPercent !== (currentMember?.discount_percent || null)
                       || discountMonths  !== (currentMember?.discount_months  || null);

  const { error } = await window.supabaseClient
    .from('gym_members')
    .update({
      name, email: email || null, phone: phone || null,
      belt_rank: belt || 'unknown', plan_id: planId,
      notes: notes || null, updated_at: new Date().toISOString(),
    })
    .eq('id', editingId);

  if (error) {
    showToast('Failed to save changes', 'error');
    saveBtn.disabled = false; saveBtn.textContent = 'Save Changes';
    return;
  }

  if (discountChanged) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch('/.netlify/functions/admin-apply-gym-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ gymMemberId: editingId, discountPercent, discountMonths }),
    });
    if (!res.ok) showToast('Saved, but discount update failed — check Stripe manually', 'error');
  }

  showToast('Changes saved');
  closeEditModal();
  await loadData();
  updateStats();
  applyFilters();
}


/* ----------------------------------------------------------
   Send billing invite
   ---------------------------------------------------------- */
async function sendBillingLink(memberId, btn) {
  const member = allGymMembers.find(m => m.id === memberId);
  if (!member) return;
  if (!member.email) { showToast('This member has no email — add one first', 'error'); return; }
  if (!member.plan_id) { showToast('No plan assigned — assign a plan first', 'error'); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Sending…';

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const checkoutRes = await fetch('/.netlify/functions/create-gym-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ gymMemberId: memberId }),
  });
  const { checkoutUrl, error: checkoutError } = await checkoutRes.json();

  if (checkoutError || !checkoutUrl) {
    showToast('Failed to create billing link', 'error');
    btn.disabled = false; btn.textContent = originalText;
    return;
  }

  const plan     = allPlans.find(p => p.id === member.plan_id);
  const priceStr = plan ? `$${(plan.price_cents / 100).toFixed(0)}` : '';

  const emailRes = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'gym-billing-invite', to: member.email, name: member.name,
      extra: { checkoutUrl, planName: plan?.name || 'Membership', priceStr },
    }),
  });

  showToast(emailRes.ok ? `Billing link sent to ${member.email}` : 'Link created but email failed', emailRes.ok ? 'success' : 'error');
  btn.disabled = false; btn.textContent = originalText;
}


/* ----------------------------------------------------------
   Cancel membership
   ---------------------------------------------------------- */
async function cancelMembership(memberId) {
  const member = allGymMembers.find(m => m.id === memberId);
  if (!member || !confirm(`Cancel ${member.name}'s membership? This will stop future billing.`)) return;

  if (member.stripe_subscription_id) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch('/.netlify/functions/admin-revoke-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ gymMemberId: memberId }),
    });
    if (!res.ok) { showToast('Failed to cancel membership', 'error'); return; }
  } else {
    await window.supabaseClient.from('gym_members')
      .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', memberId);
  }

  showToast('Membership cancelled');
  await loadData();
  updateStats();
  applyFilters();
}


/* ----------------------------------------------------------
   Populate plan dropdown
   ---------------------------------------------------------- */
function populatePlanDropdown(selectId, selectedId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">No plan assigned</option>`;
  allPlans.filter(p => p.active).forEach(plan => {
    const opt = document.createElement('option');
    opt.value = plan.id;
    opt.textContent = `${plan.name} — ${formatPrice(plan.price_cents)}/mo`;
    if (plan.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}


/* ----------------------------------------------------------
   Update stat cards
   ---------------------------------------------------------- */
function updateStats() {
  const active   = allGymMembers.filter(m => m.subscription_status === 'active').length;
  const pastDue  = allGymMembers.filter(m => m.subscription_status === 'past_due').length;
  const pending  = allGymMembers.filter(m => m.subscription_status === 'pending').length;
  const withOnline = allGymMembers.filter(m => getOnlineAccess(m)).length;

  const mrr = allGymMembers
    .filter(m => m.subscription_status === 'active' && m.plan_id)
    .reduce((sum, m) => {
      const plan = allPlans.find(p => p.id === m.plan_id);
      return sum + Math.round((plan?.price_cents || 0) * (1 - (m.discount_percent || 0) / 100));
    }, 0);

  document.getElementById('stat-active-gym').textContent  = active;
  document.getElementById('stat-mrr').textContent         = `$${(mrr / 100).toFixed(0)}`;
  document.getElementById('stat-with-online').textContent = withOnline;
  document.getElementById('stat-past-due').textContent    = `${pastDue} past due · ${pending} pending`;
}


/* ----------------------------------------------------------
   Load data
   ---------------------------------------------------------- */
async function loadData() {
  const [{ data: gymData }, { data: onlineData }, { data: planData }] = await Promise.all([
    window.supabaseClient.from('gym_members').select('*').order('joined_at', { ascending: false }),
    window.supabaseClient.from('members').select('id, name, email, subscription_status'),
    window.supabaseClient.from('membership_plans').select('*').order('display_order'),
  ]);
  allGymMembers    = gymData   || [];
  allOnlineMembers = onlineData || [];
  allPlans         = planData  || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const plansLink     = document.createElement('a');
    plansLink.href      = '/pages/admin/gym-plans.html';
    plansLink.className = 'btn btn--ghost btn--sm';
    plansLink.textContent = 'Manage Plans';
    actions.appendChild(plansLink);

    const addBtn       = document.createElement('button');
    addBtn.className   = 'btn btn--primary btn--sm';
    addBtn.textContent = '+ Add Member';
    addBtn.addEventListener('click', openAddModal);
    actions.appendChild(addBtn);
  }

  content.innerHTML = `

    <!-- Stat cards -->
    <div class="stat-grid" style="margin-bottom:var(--space-2xl);">
      <div class="stat-card">
        <p class="stat-card__label">Active Members</p>
        <p class="stat-card__value" id="stat-active-gym">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Est. Monthly Revenue</p>
        <p class="stat-card__value" id="stat-mrr">—</p>
        <p class="stat-card__delta">after discounts</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">With Online Access</p>
        <p class="stat-card__value" id="stat-with-online">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Needs Attention</p>
        <p class="stat-card__value" id="stat-past-due" style="font-size:var(--text-lg);">—</p>
      </div>
    </div>

    <!-- Search + filter controls -->
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-bottom:var(--space-lg);">
      <input class="form__input" type="text" id="member-search"
        placeholder="Search by name, email, phone…" style="max-width:240px;flex-shrink:0;">

      <!-- Status filter dropdown -->
      <select class="form__select" id="status-filter" style="max-width:160px;" aria-label="Filter by status">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="past_due">Past Due</option>
        <option value="pending">Pending</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <!-- Online access filter dropdown -->
      <select class="form__select" id="online-filter" style="max-width:180px;" aria-label="Filter by online access">
        <option value="">All Members</option>
        <option value="yes">Has Online Access</option>
        <option value="no">No Online Access</option>
      </select>
    </div>

    <!-- Members table -->
    <div id="members-table-wrap">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>


    <!-- ====================================================
         ADD MEMBER MODAL
         ==================================================== -->
    <div class="modal-overlay" id="add-member-overlay">
      <div class="modal" style="max-width:520px;">
        <div class="modal__header">
          <h2 class="modal__title">Add Member</h2>
          <button class="modal__close" id="close-add-member" aria-label="Close">✕</button>
        </div>
        <form class="form" id="add-member-form">
          <div class="form__group">
            <label class="form__label" for="add-member-name">Full Name *</label>
            <input class="form__input" type="text" id="add-member-name" placeholder="e.g. John Smith" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="add-member-email">Email</label>
              <input class="form__input" type="email" id="add-member-email" placeholder="john@example.com">
            </div>
            <div class="form__group">
              <label class="form__label" for="add-member-phone">Phone</label>
              <input class="form__input" type="tel" id="add-member-phone" placeholder="(555) 000-0000">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="add-member-belt">Belt Rank</label>
              <select class="form__select" id="add-member-belt">
                ${BELT_RANKS.map(b => `<option value="${b.toLowerCase()}">${b}</option>`).join('')}
              </select>
            </div>
            <div class="form__group">
              <label class="form__label" for="add-member-plan">Membership Plan</label>
              <select class="form__select" id="add-member-plan"></select>
            </div>
          </div>
          ${discountSectionHTML('add-member')}
          <div class="form__group">
            <label class="form__label" for="add-member-notes">Notes</label>
            <textarea class="form__textarea" id="add-member-notes" rows="2"
              placeholder="Any notes about this member…"></textarea>
          </div>
          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="cancel-add-member">Cancel</button>
            <button type="submit" class="btn btn--primary" id="save-member-btn">Add Member</button>
          </div>
        </form>
      </div>
    </div>


    <!-- ====================================================
         EDIT MEMBER MODAL
         ==================================================== -->
    <div class="modal-overlay" id="edit-member-overlay">
      <div class="modal" style="max-width:520px;">
        <div class="modal__header">
          <h2 class="modal__title">Edit Member</h2>
          <button class="modal__close" id="close-edit-member" aria-label="Close">✕</button>
        </div>
        <form class="form" id="edit-member-form">
          <div class="form__group">
            <label class="form__label" for="edit-member-name">Full Name *</label>
            <input class="form__input" type="text" id="edit-member-name" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="edit-member-email">Email</label>
              <input class="form__input" type="email" id="edit-member-email">
            </div>
            <div class="form__group">
              <label class="form__label" for="edit-member-phone">Phone</label>
              <input class="form__input" type="tel" id="edit-member-phone">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="edit-member-belt">Belt Rank</label>
              <select class="form__select" id="edit-member-belt">
                ${BELT_RANKS.map(b => `<option value="${b.toLowerCase()}">${b}</option>`).join('')}
              </select>
            </div>
            <div class="form__group">
              <label class="form__label" for="edit-member-plan">Membership Plan</label>
              <select class="form__select" id="edit-member-plan"></select>
            </div>
          </div>
          ${discountSectionHTML('edit-member')}
          <div class="form__group">
            <label class="form__label" for="edit-member-notes">Notes</label>
            <textarea class="form__textarea" id="edit-member-notes" rows="3"></textarea>
          </div>
          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="cancel-edit-member">Cancel</button>
            <button type="submit" class="btn btn--primary" id="save-edit-member-btn">Save Changes</button>
          </div>
        </form>
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

  const content = renderAdminShell('members', 'Members');
  buildPage(content);

  const params = new URLSearchParams(window.location.search);
  if (params.get('billing') === 'success') {
    showToast('Billing setup complete — member is now active');
    window.history.replaceState({}, '', window.location.pathname);
  }

  await loadData();
  updateStats();
  applyFilters();
  setupFilters();

  wireDiscountSection('add-member');
  wireDiscountSection('edit-member');

  document.getElementById('close-add-member')?.addEventListener('click', closeAddModal);
  document.getElementById('cancel-add-member')?.addEventListener('click', closeAddModal);
  document.getElementById('add-member-form')?.addEventListener('submit', saveMember);
  safeModalClose('add-member-overlay', closeAddModal);

  document.getElementById('close-edit-member')?.addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit-member')?.addEventListener('click', closeEditModal);
  document.getElementById('edit-member-form')?.addEventListener('submit', saveEditedMember);
  safeModalClose('edit-member-overlay', closeEditModal);

})();
