/* ==========================================================
   admin-gym-plans.js — Membership plan management
   True Jiu Jitsu Online

   Handles:
     - Listing all membership plans with member counts
     - Create new plan (creates Stripe Product + Price)
     - Toggle plan active/inactive
     - Edit plan name and description (not price — Stripe
       doesn't allow editing a live price)
   ========================================================== */

let allPlans = [];


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
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


/* ----------------------------------------------------------
   Render plans list
   ---------------------------------------------------------- */
function renderPlans() {
  const list = document.getElementById('plans-list');
  if (!list) return;

  if (!allPlans.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <h3>No plans yet</h3>
        <p>Create your first membership plan to start billing members.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  allPlans.forEach(plan => {
    const item = document.createElement('div');
    item.className = 'content-list-item';

    item.innerHTML = `
      <div class="content-list-item__info">
        <p class="content-list-item__title">
          ${plan.name}
          ${plan.includes_online_access
            ? `<span class="badge badge--active" style="margin-left:var(--space-sm);font-size:10px;">+ Online Access</span>`
            : ''}
        </p>
        <div class="content-list-item__meta">
          <span>${formatPrice(plan.price_cents)}/mo</span>
          ${plan.description ? `<span>${plan.description}</span>` : ''}
          <span>${plan.member_count || 0} active member${plan.member_count === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="content-list-item__actions">
        <label class="toggle">
          <input type="checkbox" class="toggle__input js-plan-toggle"
            data-id="${plan.id}" ${plan.active ? 'checked' : ''}>
          <div class="toggle__track"><div class="toggle__thumb"></div></div>
          <span class="toggle__label">${plan.active ? 'Active' : 'Inactive'}</span>
        </label>
        <button class="btn btn--ghost btn--sm js-edit-plan" data-id="${plan.id}">Edit</button>
      </div>
    `;

    list.appendChild(item);
  });

  // Active toggles
  list.querySelectorAll('.js-plan-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id     = e.target.dataset.id;
      const active = e.target.checked;
      const label  = e.target.closest('.toggle').querySelector('.toggle__label');
      if (label) label.textContent = active ? 'Active' : 'Inactive';

      const { error } = await window.supabaseClient
        .from('membership_plans').update({ active }).eq('id', id);

      if (error) {
        showToast('Failed to update plan', 'error');
        e.target.checked = !active;
      } else {
        const p = allPlans.find(p => p.id === id);
        if (p) p.active = active;
        showToast(active ? 'Plan activated' : 'Plan deactivated');
      }
    });
  });

  // Edit buttons
  list.querySelectorAll('.js-edit-plan').forEach(btn => {
    btn.addEventListener('click', () => openEditPlanModal(btn.dataset.id));
  });
}


/* ----------------------------------------------------------
   Create plan modal
   ---------------------------------------------------------- */
function openCreateModal() {
  document.getElementById('create-plan-overlay').classList.add('is-open');
}

function closeCreateModal() {
  document.getElementById('create-plan-overlay').classList.remove('is-open');
  document.getElementById('create-plan-form').reset();
}

async function createPlan(e) {
  e.preventDefault();

  const name                = document.getElementById('plan-name').value.trim();
  const description         = document.getElementById('plan-description').value.trim();
  const priceStr            = document.getElementById('plan-price').value.trim();
  const includesOnlineAccess = document.getElementById('plan-online-access').checked;

  if (!name || !priceStr) { showToast('Name and price are required', 'error'); return; }

  const priceCents = Math.round(parseFloat(priceStr) * 100);
  if (isNaN(priceCents) || priceCents <= 0) {
    showToast('Please enter a valid price', 'error'); return;
  }

  const saveBtn       = document.getElementById('create-plan-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Creating…';

  const { data: { session } } = await window.supabaseClient.auth.getSession();

  const response = await fetch('/.netlify/functions/admin-create-gym-plan', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ name, description: description || null, priceCents, includesOnlineAccess }),
  });

  const result = await response.json();

  if (!response.ok || !result.plan) {
    showToast('Failed to create plan', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Create Plan';
    return;
  }

  showToast('Plan created!');
  closeCreateModal();
  await loadPlans();
  renderPlans();
}


/* ----------------------------------------------------------
   Edit plan modal (name + description only)
   ---------------------------------------------------------- */
function openEditPlanModal(planId) {
  const plan = allPlans.find(p => p.id === planId);
  if (!plan) return;

  document.getElementById('edit-plan-id').value          = plan.id;
  document.getElementById('edit-plan-name').value        = plan.name || '';
  document.getElementById('edit-plan-description').value = plan.description || '';
  document.getElementById('edit-plan-price-display').textContent = formatPrice(plan.price_cents) + '/mo';

  document.getElementById('edit-plan-overlay').classList.add('is-open');
}

function closeEditPlanModal() {
  document.getElementById('edit-plan-overlay').classList.remove('is-open');
}

async function saveEditedPlan(e) {
  e.preventDefault();

  const id          = document.getElementById('edit-plan-id').value;
  const name        = document.getElementById('edit-plan-name').value.trim();
  const description = document.getElementById('edit-plan-description').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }

  const saveBtn       = document.getElementById('save-edit-plan-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await window.supabaseClient
    .from('membership_plans')
    .update({ name, description: description || null })
    .eq('id', id);

  if (error) {
    showToast('Failed to save changes', 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Changes';
    return;
  }

  showToast('Plan updated');
  closeEditPlanModal();
  await loadPlans();
  renderPlans();
}


/* ----------------------------------------------------------
   Load plans with active member counts
   ---------------------------------------------------------- */
async function loadPlans() {
  const { data } = await window.supabaseClient
    .from('membership_plans')
    .select('*')
    .order('display_order');

  if (!data) { allPlans = []; return; }

  // Count active gym members per plan
  const { data: counts } = await window.supabaseClient
    .from('gym_members')
    .select('plan_id')
    .eq('subscription_status', 'active');

  const countMap = {};
  (counts || []).forEach(row => {
    countMap[row.plan_id] = (countMap[row.plan_id] || 0) + 1;
  });

  allPlans = data.map(p => ({ ...p, member_count: countMap[p.id] || 0 }));
}


/* ----------------------------------------------------------
   Build page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const btn       = document.createElement('button');
    btn.className   = 'btn btn--primary btn--sm';
    btn.textContent = '+ New Plan';
    btn.addEventListener('click', openCreateModal);
    actions.appendChild(btn);
  }

  content.innerHTML = `

    <div class="content-list" id="plans-list">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>

    <!-- Create plan modal -->
    <div class="modal-overlay" id="create-plan-overlay">
      <div class="modal" style="max-width:460px;">
        <div class="modal__header">
          <h2 class="modal__title">New Membership Plan</h2>
          <button class="modal__close" id="close-create-plan" aria-label="Close">✕</button>
        </div>
        <form class="form" id="create-plan-form">

          <div class="form__group">
            <label class="form__label" for="plan-name">Plan Name *</label>
            <input class="form__input" type="text" id="plan-name"
              placeholder="e.g. Unlimited, 2x Per Week" required>
          </div>

          <div class="form__group">
            <label class="form__label" for="plan-description">Description</label>
            <input class="form__input" type="text" id="plan-description"
              placeholder="Optional — e.g. Train as much as you want">
          </div>

          <div class="form__group">
            <label class="form__label" for="plan-price">Monthly Price ($) *</label>
            <input class="form__input" type="number" id="plan-price"
              placeholder="e.g. 150.00" step="0.01" min="1" required>
            <span class="form__hint">Enter the dollar amount — e.g. 150 for $150/mo</span>
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-md);">
            <label class="toggle">
              <input type="checkbox" class="toggle__input" id="plan-online-access">
              <div class="toggle__track"><div class="toggle__thumb"></div></div>
            </label>
            <div>
              <p style="font-size:var(--text-sm);color:var(--color-light-gray);margin:0;max-width:none;">
                Includes online video access
              </p>
              <p style="font-size:var(--text-xs);color:var(--color-gray);margin:0;max-width:none;">
                Members on this plan can also access the video library
              </p>
            </div>
          </div>

          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="cancel-create-plan">Cancel</button>
            <button type="submit" class="btn btn--primary" id="create-plan-btn">Create Plan</button>
          </div>

        </form>
      </div>
    </div>

    <!-- Edit plan modal -->
    <div class="modal-overlay" id="edit-plan-overlay">
      <div class="modal" style="max-width:460px;">
        <div class="modal__header">
          <h2 class="modal__title">Edit Plan</h2>
          <button class="modal__close" id="close-edit-plan" aria-label="Close">✕</button>
        </div>
        <form class="form" id="edit-plan-form">
          <input type="hidden" id="edit-plan-id">

          <div class="form__group">
            <label class="form__label" for="edit-plan-name">Plan Name *</label>
            <input class="form__input" type="text" id="edit-plan-name" required>
          </div>

          <div class="form__group">
            <label class="form__label" for="edit-plan-description">Description</label>
            <input class="form__input" type="text" id="edit-plan-description">
          </div>

          <!-- Price is read-only after creation — Stripe doesn't allow editing live prices -->
          <div class="form__group">
            <label class="form__label">Price</label>
            <p id="edit-plan-price-display"
               style="font-size:var(--text-lg);font-family:var(--font-heading);color:var(--color-white);margin:0;max-width:none;"></p>
            <span class="form__hint">Price cannot be changed after creation. Create a new plan if you need a different price.</span>
          </div>

          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="cancel-edit-plan">Cancel</button>
            <button type="submit" class="btn btn--primary" id="save-edit-plan-btn">Save Changes</button>
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

  const content = renderAdminShell('gym-plans', 'Membership Plans');
  buildPage(content);

  await loadPlans();
  renderPlans();

  // Wire events
  document.getElementById('close-create-plan')?.addEventListener('click', closeCreateModal);
  document.getElementById('cancel-create-plan')?.addEventListener('click', closeCreateModal);
  document.getElementById('create-plan-form')?.addEventListener('submit', createPlan);
  document.getElementById('create-plan-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('create-plan-overlay')) closeCreateModal();
  });

  document.getElementById('close-edit-plan')?.addEventListener('click', closeEditPlanModal);
  document.getElementById('cancel-edit-plan')?.addEventListener('click', closeEditPlanModal);
  document.getElementById('edit-plan-form')?.addEventListener('submit', saveEditedPlan);
  document.getElementById('edit-plan-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('edit-plan-overlay')) closeEditPlanModal();
  });

})();
