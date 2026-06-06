/* ==========================================================
   admin-gym-members.js — In-person gym member management
   True Jiu Jitsu Online

   Handles:
     - Listing all gym members with status, plan, belt rank
     - Add new member with optional discount
     - Edit member details including discount changes
     - Send billing invite email with Stripe Checkout link
     - Apply / remove discounts on active subscriptions
     - Cancel membership
   ========================================================== */

let allGymMembers = [];
let allPlans      = [];
let editingId     = null;

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
    unknown: '#444444',
    white:   '#ffffff',
    blue:    '#1a73e8',
    purple:  '#8b5cf6',
    brown:   '#92400e',
    black:   '#1a1a1a',
  };
  const color = colors[(belt || 'unknown').toLowerCase()] || '#444444';
  const text  = (belt || 'unknown').charAt(0).toUpperCase() + (belt || 'unknown').slice(1);
  const darkText = ['white'].includes((belt || '').toLowerCase());
  return `<span style="display:inline-block;padding:2px 10px;border-radius:100px;font-size:10px;font-weight:600;background:${color};color:${darkText ? '#111' : '#fff'};border:1px solid rgba(255,255,255,0.1);">${text}</span>`;
}

function discountLabel(member) {
  if (!member.discount_percent) return '';
  const duration = member.discount_months
    ? `${member.discount_months}mo`
    : 'forever';
  return `<span class="badge badge--draft" style="margin-left:4px;font-size:10px;">-${member.discount_percent}% (${duration})</span>`;
}

/* ----------------------------------------------------------
   Wire up a discount section's show/hide logic.
   Called after the form HTML is injected into the DOM.
   ---------------------------------------------------------- */
function wireDiscountSection(prefix) {
  const durationSelect = document.getElementById(`${prefix}-discount-duration`);
  const monthsWrap     = document.getElementById(`${prefix}-discount-months-wrap`);
  if (!durationSelect || !monthsWrap) return;

  durationSelect.addEventListener('change', () => {
    monthsWrap.style.display = durationSelect.value === 'months' ? '' : 'none';
  });
}


/* ----------------------------------------------------------
   Read discount values from form fields.
   Returns { discountPercent, discountMonths } or nulls.
   ---------------------------------------------------------- */
function readDiscountFields(prefix) {
  const pctInput      = document.getElementById(`${prefix}-discount-percent`);
  const durationSel   = document.getElementById(`${prefix}-discount-duration`);
  const monthsInput   = document.getElementById(`${prefix}-discount-months`);

  const pct = parseInt(pctInput?.value) || 0;
  if (!pct) return { discountPercent: null, discountMonths: null };

  const months = durationSel?.value === 'months'
    ? (parseInt(monthsInput?.value) || null)
    : null;

  return { discountPercent: pct, discountMonths: months };
}


/* ----------------------------------------------------------
   Discount section HTML — reused in both add and edit forms
   ---------------------------------------------------------- */
function discountSectionHTML(prefix, existingPercent = '', existingMonths = null) {
  const hasDuration = !!existingMonths;
  return `
    <div class="form__group">
      <label class="form__label">Discount <span style="color:var(--color-gray);font-weight:400;">(optional)</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div>
          <label class="form__hint" style="display:block;margin-bottom:4px;">Percentage Off</label>
          <input class="form__input" type="number" id="${prefix}-discount-percent"
            placeholder="e.g. 20" min="0" max="100" step="1"
            value="${existingPercent || ''}">
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
          placeholder="Number of months" min="1" step="1"
          value="${existingMonths || ''}">
      </div>
      <span class="form__hint">Leave percentage blank for no discount</span>
    </div>
  `;
}


/* ----------------------------------------------------------
   Render members table
   ---------------------------------------------------------- */
function renderMembers(members) {
  const container = document.getElementById('gym-members-table');
  if (!container) return;

  if (!members.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🥋</div>
        <h3>No gym members yet</h3>
        <p>Add your first member to start managing memberships.</p>
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
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="gym-members-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('gym-members-tbody');
  members.forEach(member => {
    const plan = allPlans.find(p => p.id === member.plan_id);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div>
          <p style="margin:0;font-weight:500;color:var(--color-white);">${member.name}</p>
          ${member.email ? `<p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);">${member.email}</p>` : ''}
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
   Add member modal
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('add-member-overlay').classList.add('is-open');
  document.getElementById('add-member-form').reset();
  // Reset months wrap visibility
  const monthsWrap = document.getElementById('add-member-discount-months-wrap');
  if (monthsWrap) monthsWrap.style.display = 'none';
  populatePlanDropdown('add-member-plan');
}

function closeAddModal() {
  document.getElementById('add-member-overlay').classList.remove('is-open');
  // Re-enable the save button for the next add
  const saveBtn = document.getElementById('save-member-btn');
  if (saveBtn) {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Add Member';
  }
}

async function saveMember(e) {
  e.preventDefault();

  const name    = document.getElementById('add-member-name').value.trim();
  const email   = document.getElementById('add-member-email').value.trim();
  const phone   = document.getElementById('add-member-phone').value.trim();
  const belt    = document.getElementById('add-member-belt').value;
  const planId  = document.getElementById('add-member-plan').value || null;
  const notes   = document.getElementById('add-member-notes').value.trim();
  const { discountPercent, discountMonths } = readDiscountFields('add-member');

  if (!name) { showToast('Name is required', 'error'); return; }

  const saveBtn       = document.getElementById('save-member-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await window.supabaseClient.from('gym_members').insert({
    name,
    email:               email   || null,
    phone:               phone   || null,
    belt_rank:           belt    || 'white',
    plan_id:             planId,
    notes:               notes   || null,
    discount_percent:    discountPercent,
    discount_months:     discountMonths,
    subscription_status: 'pending',
  });

  if (error) {
    showToast('Failed to add member', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Add Member';
    return;
  }

  showToast('Member added!');
  closeAddModal();
  await loadGymMembers();
  renderMembers(allGymMembers);
  updateStats();
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
  document.getElementById('edit-member-belt').value  = member.belt_rank || 'white';
  document.getElementById('edit-member-notes').value = member.notes     || '';

  // Pre-fill discount fields
  const pctInput    = document.getElementById('edit-member-discount-percent');
  const durSelect   = document.getElementById('edit-member-discount-duration');
  const monthsInput = document.getElementById('edit-member-discount-months');
  const monthsWrap  = document.getElementById('edit-member-discount-months-wrap');

  if (pctInput)  pctInput.value  = member.discount_percent || '';
  if (durSelect) durSelect.value = member.discount_months ? 'months' : 'forever';
  if (monthsInput) monthsInput.value = member.discount_months || '';
  if (monthsWrap) monthsWrap.style.display = member.discount_months ? '' : 'none';

  populatePlanDropdown('edit-member-plan', member.plan_id);
  document.getElementById('edit-member-overlay').classList.add('is-open');
}

function closeEditModal() {
  document.getElementById('edit-member-overlay').classList.remove('is-open');
  // Re-enable the save button so it works for the next edit
  const saveBtn = document.getElementById('save-edit-member-btn');
  if (saveBtn) {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Changes';
  }
  editingId = null;
}

async function saveEditedMember(e) {
  e.preventDefault();
  if (!editingId) return;

  const name    = document.getElementById('edit-member-name').value.trim();
  const email   = document.getElementById('edit-member-email').value.trim();
  const phone   = document.getElementById('edit-member-phone').value.trim();
  const belt    = document.getElementById('edit-member-belt').value;
  const planId  = document.getElementById('edit-member-plan').value || null;
  const notes   = document.getElementById('edit-member-notes').value.trim();
  const { discountPercent, discountMonths } = readDiscountFields('edit-member');

  if (!name) { showToast('Name is required', 'error'); return; }

  const saveBtn       = document.getElementById('save-edit-member-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  // Check if discount has changed from current value
  const currentMember       = allGymMembers.find(m => m.id === editingId);
  const discountChanged     = discountPercent !== (currentMember?.discount_percent || null)
                           || discountMonths  !== (currentMember?.discount_months  || null);

  // Save member details to Supabase
  const { error } = await window.supabaseClient
    .from('gym_members')
    .update({
      name,
      email:     email  || null,
      phone:     phone  || null,
      belt_rank: belt   || 'white',
      plan_id:   planId,
      notes:     notes  || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editingId);

  if (error) {
    showToast('Failed to save changes', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Changes';
    return;
  }

  // If discount changed, apply/remove via the Netlify function
  // so Stripe is updated in sync
  if (discountChanged) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    const discountRes = await fetch('/.netlify/functions/admin-apply-gym-discount', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ gymMemberId: editingId, discountPercent, discountMonths }),
    });

    if (!discountRes.ok) {
      // Member details saved, but discount sync failed
      showToast('Saved, but discount update failed — check Stripe manually', 'error');
    }
  }

  showToast('Changes saved');
  closeEditModal();
  await loadGymMembers();
  renderMembers(allGymMembers);
  updateStats();
}


/* ----------------------------------------------------------
   Send billing invite link
   ---------------------------------------------------------- */
async function sendBillingLink(memberId, btn) {
  const member = allGymMembers.find(m => m.id === memberId);
  if (!member) return;

  if (!member.email) {
    showToast('This member has no email address — add one first', 'error');
    return;
  }

  if (!member.plan_id) {
    showToast('This member has no plan assigned — assign a plan first', 'error');
    return;
  }

  const originalText  = btn.textContent;
  btn.disabled        = true;
  btn.textContent     = 'Sending…';

  const { data: { session } } = await window.supabaseClient.auth.getSession();

  const checkoutRes = await fetch('/.netlify/functions/create-gym-checkout', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ gymMemberId: memberId }),
  });

  const { checkoutUrl, error: checkoutError } = await checkoutRes.json();

  if (checkoutError || !checkoutUrl) {
    showToast('Failed to create billing link', 'error');
    btn.disabled    = false;
    btn.textContent = originalText;
    return;
  }

  const plan     = allPlans.find(p => p.id === member.plan_id);
  const priceStr = plan ? `$${(plan.price_cents / 100).toFixed(0)}` : '';

  const emailRes = await fetch('/.netlify/functions/send-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type:  'gym-billing-invite',
      to:    member.email,
      name:  member.name,
      extra: { checkoutUrl, planName: plan?.name || 'Membership', priceStr },
    }),
  });

  if (!emailRes.ok) {
    showToast('Link created but email failed to send', 'error');
  } else {
    showToast(`Billing link sent to ${member.email}`);
  }

  btn.disabled    = false;
  btn.textContent = originalText;
}


/* ----------------------------------------------------------
   Cancel membership
   ---------------------------------------------------------- */
async function cancelMembership(memberId) {
  const member = allGymMembers.find(m => m.id === memberId);
  if (!member) return;

  if (!confirm(`Cancel ${member.name}'s membership? This will stop future billing.`)) return;

  if (member.stripe_subscription_id) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    const res = await fetch('/.netlify/functions/admin-revoke-member', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ gymMemberId: memberId }),
    });

    if (!res.ok) {
      showToast('Failed to cancel membership', 'error');
      return;
    }
  } else {
    await window.supabaseClient
      .from('gym_members')
      .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', memberId);
  }

  showToast('Membership cancelled');
  await loadGymMembers();
  renderMembers(allGymMembers);
  updateStats();
}


/* ----------------------------------------------------------
   Populate plan dropdown
   ---------------------------------------------------------- */
function populatePlanDropdown(selectId, selectedId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = `<option value="">No plan assigned</option>`;
  allPlans.filter(p => p.active).forEach(plan => {
    const opt       = document.createElement('option');
    opt.value       = plan.id;
    opt.textContent = `${plan.name} — ${formatPrice(plan.price_cents)}/mo`;
    if (plan.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}


/* ----------------------------------------------------------
   Search filter
   ---------------------------------------------------------- */
function setupSearch() {
  const input = document.getElementById('gym-member-search');
  if (!input) return;

  input.addEventListener('input', () => {
    const query   = input.value.toLowerCase().trim();
    const filtered = query
      ? allGymMembers.filter(m =>
          (m.name  || '').toLowerCase().includes(query) ||
          (m.email || '').toLowerCase().includes(query) ||
          (m.phone || '').toLowerCase().includes(query)
        )
      : allGymMembers;
    renderMembers(filtered);
  });
}


/* ----------------------------------------------------------
   Update stat cards
   MRR accounts for discounts so the number reflects actual
   expected revenue rather than full list price.
   ---------------------------------------------------------- */
function updateStats() {
  const active  = allGymMembers.filter(m => m.subscription_status === 'active').length;
  const pastDue = allGymMembers.filter(m => m.subscription_status === 'past_due').length;
  const pending = allGymMembers.filter(m => m.subscription_status === 'pending').length;

  const mrr = allGymMembers
    .filter(m => m.subscription_status === 'active' && m.plan_id)
    .reduce((sum, m) => {
      const plan       = allPlans.find(p => p.id === m.plan_id);
      const basePrice  = plan?.price_cents || 0;
      const discount   = m.discount_percent || 0;
      return sum + Math.round(basePrice * (1 - discount / 100));
    }, 0);

  document.getElementById('stat-active-gym').textContent = active;
  document.getElementById('stat-mrr').textContent        = `$${(mrr / 100).toFixed(0)}`;
  document.getElementById('stat-past-due').textContent   = pastDue;
  document.getElementById('stat-pending').textContent    = pending;
}


/* ----------------------------------------------------------
   Load data
   ---------------------------------------------------------- */
async function loadGymMembers() {
  const { data } = await window.supabaseClient
    .from('gym_members')
    .select('*')
    .order('joined_at', { ascending: false });
  allGymMembers = data || [];
}

async function loadPlans() {
  const { data } = await window.supabaseClient
    .from('membership_plans')
    .select('*')
    .order('display_order');
  allPlans = data || [];
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const btn       = document.createElement('button');
    btn.className   = 'btn btn--primary btn--sm';
    btn.textContent = '+ Add Member';
    btn.addEventListener('click', openAddModal);
    actions.appendChild(btn);
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
        <p class="stat-card__label">Past Due</p>
        <p class="stat-card__value" id="stat-past-due">—</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Pending Billing</p>
        <p class="stat-card__value" id="stat-pending">—</p>
      </div>
    </div>

    <div class="admin-section-header">
      <h2>All Members</h2>
      <div style="display:flex;gap:var(--space-md);align-items:center;">
        <input class="form__input" type="text" id="gym-member-search"
          placeholder="Search by name, email, phone…" style="max-width:260px;">
        <a href="/pages/admin/gym-plans.html" class="btn btn--ghost btn--sm">Manage Plans</a>
      </div>
    </div>

    <div id="gym-members-table" style="margin-top:var(--space-lg);">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>


    <!-- ====================================================
         ADD MEMBER MODAL
         ==================================================== -->
    <div class="modal-overlay" id="add-member-overlay">
      <div class="modal" style="max-width:520px;">
        <div class="modal__header">
          <h2 class="modal__title">Add Gym Member</h2>
          <button class="modal__close" id="close-add-member" aria-label="Close">✕</button>
        </div>
        <form class="form" id="add-member-form">

          <div class="form__group">
            <label class="form__label" for="add-member-name">Full Name *</label>
            <input class="form__input" type="text" id="add-member-name"
              placeholder="e.g. John Smith" required>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
            <div class="form__group">
              <label class="form__label" for="add-member-email">Email</label>
              <input class="form__input" type="email" id="add-member-email"
                placeholder="john@example.com">
            </div>
            <div class="form__group">
              <label class="form__label" for="add-member-phone">Phone</label>
              <input class="form__input" type="tel" id="add-member-phone"
                placeholder="(555) 000-0000">
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

          <!-- Discount section — pre-filled in openEditModal -->
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

  const content = renderAdminShell('gym-members', 'Gym Members');
  buildPage(content);

  const params = new URLSearchParams(window.location.search);
  if (params.get('billing') === 'success') {
    showToast('Billing setup complete — member is now active');
    window.history.replaceState({}, '', window.location.pathname);
  }

  await Promise.all([loadGymMembers(), loadPlans()]);
  renderMembers(allGymMembers);
  updateStats();
  setupSearch();

  // Wire discount show/hide for both forms
  wireDiscountSection('add-member');
  wireDiscountSection('edit-member');

  // Wire add member modal
  document.getElementById('close-add-member')?.addEventListener('click', closeAddModal);
  document.getElementById('cancel-add-member')?.addEventListener('click', closeAddModal);
  document.getElementById('add-member-form')?.addEventListener('submit', saveMember);
  safeModalClose('add-member-overlay', closeAddModal);

  // Wire edit member modal
  document.getElementById('close-edit-member')?.addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit-member')?.addEventListener('click', closeEditModal);
  document.getElementById('edit-member-form')?.addEventListener('submit', saveEditedMember);
  safeModalClose('edit-member-overlay', closeEditModal);

})();
