/* ==========================================================
   admin-leads.js — Leads table
   True Jiu Jitsu Online

   Shows all active leads in a sortable table. Leads come
   from two sources:
     - contact_form: submitted via truebjj.academy
     - manual: added directly by the admin

   Key features per row:
     - Stage dropdown (change stage inline)
     - Inline note editor (pencil icon)
     - Send onboarding link button
     - Overflow menu (edit details / archive)

   When a lead converts (signs a waiver), submit-waiver.js
   links their gym_member_id and sets stage to 'converted'
   automatically. Converted and archived leads are hidden
   from the default view but accessible via toggle.
   ========================================================== */

let allLeads       = [];
let showingArchived = false;
let stageFilter     = '';


/* ----------------------------------------------------------
   Stage config
   ---------------------------------------------------------- */
const STAGES = [
  { id: 'new',             label: 'New',             color: '#60a5fa' },
  { id: 'contacted',       label: 'Contacted',       color: '#f59e0b' },
  { id: 'trial_scheduled', label: 'Trial Scheduled', color: '#a78bfa' },
  { id: 'converted',       label: 'Converted',       color: '#2a9d5c' },
];

const SOURCE_LABELS = {
  contact_form: 'Contact Form',
  manual:       'Manual Entry',
};


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

function stageLabel(stageId) {
  return STAGES.find(s => s.id === stageId)?.label || stageId;
}

function stageColor(stageId) {
  return STAGES.find(s => s.id === stageId)?.color || 'var(--color-gray)';
}

// Human-readable time since a lead came in
function timeAgo(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  60) return mins  + 'm ago';
  if (hours <  24) return hours + 'h ago';
  if (days  <  30) return days  + 'd ago';
  return formatDate(iso);
}


/* ----------------------------------------------------------
   Apply filters and re-render the table
   ---------------------------------------------------------- */
function applyFilters() {
  const query = (document.getElementById('lead-search')?.value || '').toLowerCase().trim();

  const filtered = allLeads.filter(lead => {
    // Archived / active gate
    if (showingArchived !== !!lead.archived_at) return false;

    // In the active view, hide converted leads unless the stage
    // filter is explicitly set to 'converted'
    if (!showingArchived && lead.stage === 'converted' && stageFilter !== 'converted') return false;

    // Stage filter
    if (stageFilter && lead.stage !== stageFilter) return false;

    // Search
    if (query) {
      const haystack = [lead.name, lead.email, lead.phone, lead.notes].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  renderTable(filtered);
}


/* ----------------------------------------------------------
   Render the leads table
   ---------------------------------------------------------- */
function renderTable(leads) {
  const container = document.getElementById('leads-table-wrap');
  if (!container) return;

  if (!leads.length) {
    const msg = showingArchived ? 'No archived leads.' : 'No leads yet.';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#x1F3AF;</div>
        <h3>${msg}</h3>
        <p>Leads from the contact form appear here automatically. You can also add them manually.</p>
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
            <th>Stage</th>
            <th>Notes</th>
            <th>Source</th>
            <th>Received</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="leads-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('leads-tbody');
  leads.forEach(lead => tbody.appendChild(buildRow(lead)));
}


/* ----------------------------------------------------------
   Build a single table row for a lead
   ---------------------------------------------------------- */
function buildRow(lead) {
  const tr = document.createElement('tr');
  if (!!lead.archived_at) tr.style.opacity = '0.6';

  const source  = SOURCE_LABELS[lead.source] || lead.source || '';
  const isActive = !lead.archived_at;

  // Build stage options for the inline dropdown
  const stageOptions = STAGES.map(s =>
    `<option value="${s.id}" ${lead.stage === s.id ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <p style="margin:0;font-weight:500;color:var(--color-white);">${lead.name}</p>
      ${lead.email ? `<p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);">${lead.email}</p>` : ''}
      ${lead.phone ? `<p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);">${lead.phone}</p>` : ''}
      ${lead.interest ? `<p style="margin:0;font-size:10px;color:var(--color-gray);text-transform:capitalize;">${lead.interest}</p>` : ''}
    </td>
    <td>
      ${isActive
        ? `<select class="leads-stage-select js-stage-select" data-id="${lead.id}"
             style="border-color:${stageColor(lead.stage)}20;color:${stageColor(lead.stage)};">
             ${stageOptions}
           </select>`
        : `<span style="font-size:var(--text-sm);color:${stageColor(lead.stage)};">${stageLabel(lead.stage)}</span>`
      }
    </td>
    <td class="leads-notes-cell">
      <!-- Notes display + inline editor -->
      <div class="leads-notes-wrap">
        <div class="leads-notes-display js-notes-display">
          <span class="leads-notes-text js-notes-text">${lead.notes
            ? `<span style="color:var(--color-light-gray);">${lead.notes}</span>`
            : `<span style="color:var(--color-mid-gray);font-style:italic;">No notes</span>`
          }</span>
          ${isActive
            ? `<button class="leads-notes-edit-btn js-edit-notes" title="Edit note" aria-label="Edit note">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>`
            : ''
          }
        </div>
        <div class="leads-notes-editor js-notes-editor" style="display:none;">
          <textarea class="leads-notes-textarea js-notes-textarea" rows="2"
            placeholder="Add a note...">${lead.notes || ''}</textarea>
          <div class="leads-notes-editor-actions">
            <button class="btn btn--primary btn--sm js-notes-save">Save</button>
            <button class="btn btn--ghost btn--sm js-notes-cancel">Cancel</button>
          </div>
        </div>
      </div>
    </td>
    <td style="font-size:var(--text-xs);color:var(--color-gray);">${source}</td>
    <td style="font-size:var(--text-xs);color:var(--color-gray);white-space:nowrap;">${timeAgo(lead.created_at)}</td>
    <td>
      <div class="data-table__actions">
        ${isActive && lead.email && !lead.gym_member_id
          ? `<button class="btn btn--secondary btn--sm js-send-onboarding" data-id="${lead.id}"
               title="Send onboarding link to ${lead.email}">
               &#x2197; Send Link
             </button>`
          : ''
        }
        ${lead.gym_member_id
          ? `<span class="badge badge--active" style="font-size:10px;">Converted</span>`
          : ''
        }
        <!-- Overflow menu -->
        <div class="row-overflow" data-id="${lead.id}">
          <button class="row-overflow__trigger" aria-label="More options">&bull;&bull;&bull;</button>
          <div class="row-overflow__menu">
            ${isActive ? `<button class="row-overflow__item js-edit-lead" data-id="${lead.id}">Edit details</button>` : ''}
            ${lead.gym_member_id ? `<button class="row-overflow__item js-view-member" data-id="${lead.id}">View member record</button>` : ''}
            ${isActive
              ? `<button class="row-overflow__item row-overflow__item--danger js-archive-lead" data-id="${lead.id}">Archive lead</button>`
              : `<button class="row-overflow__item js-unarchive-lead" data-id="${lead.id}">Unarchive lead</button>`
            }
          </div>
        </div>
      </div>
    </td>
  `;

  // Stage dropdown change
  tr.querySelector('.js-stage-select')?.addEventListener('change', (e) => {
    moveLeadToStage(lead.id, e.target.value);
  });

  // Overflow menu
  const trigger = tr.querySelector('.row-overflow__trigger');
  const menu    = tr.querySelector('.row-overflow__menu');
  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.row-overflow__menu.is-open').forEach(m => {
      if (m !== menu) m.classList.remove('is-open');
    });
    menu.classList.toggle('is-open');
  });

  // Edit
  tr.querySelector('.js-edit-lead')?.addEventListener('click', () => {
    menu.classList.remove('is-open');
    openEditModal(lead.id);
  });

  // View member record
  tr.querySelector('.js-view-member')?.addEventListener('click', () => {
    window.location.href = '/pages/admin/gym-members.html';
  });

  // Archive
  tr.querySelector('.js-archive-lead')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.remove('is-open');
    confirmAction(trigger, 'Archive ' + lead.name + '?', () => archiveLead(lead.id));
  });

  // Unarchive
  tr.querySelector('.js-unarchive-lead')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.classList.remove('is-open');
    await unarchiveLead(lead.id);
  });

  // Send onboarding link
  tr.querySelector('.js-send-onboarding')?.addEventListener('click', (e) => {
    sendOnboardingLink(lead, e.currentTarget);
  });

  // Inline note editor
  wireNoteEditor(tr, lead);

  return tr;
}


/* ----------------------------------------------------------
   Inline note editor — works the same as before but
   attached to a table row instead of a card.
   ---------------------------------------------------------- */
function wireNoteEditor(row, lead) {
  const display   = row.querySelector('.js-notes-display');
  const editor    = row.querySelector('.js-notes-editor');
  const textarea  = row.querySelector('.js-notes-textarea');
  const editBtn   = row.querySelector('.js-edit-notes');
  const saveBtn   = row.querySelector('.js-notes-save');
  const cancelBtn = row.querySelector('.js-notes-cancel');

  if (!editBtn) return; // archived rows have no edit button

  function openEditor() {
    display.style.display = 'none';
    editor.style.display  = '';
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  function closeEditor() {
    editor.style.display  = 'none';
    display.style.display = '';
  }

  async function saveNote() {
    const newNote = textarea.value.trim() || null;

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';

    const { error } = await window.supabaseClient
      .from('leads')
      .update({ notes: newNote })
      .eq('id', lead.id);

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';

    if (error) { showToast('Failed to save note', 'error'); return; }

    // Update local state and refresh the display text in-place
    lead.notes = newNote;
    const notesText = row.querySelector('.js-notes-text');
    if (notesText) {
      notesText.innerHTML = newNote
        ? `<span style="color:var(--color-light-gray);">${newNote}</span>`
        : `<span style="color:var(--color-mid-gray);font-style:italic;">No notes</span>`;
    }

    closeEditor();
    showToast('Note saved');
  }

  editBtn.addEventListener('click',   (e) => { e.stopPropagation(); openEditor(); });
  cancelBtn.addEventListener('click', closeEditor);
  saveBtn.addEventListener('click',   saveNote);

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
    if (e.key === 'Escape') closeEditor();
  });
}


/* ----------------------------------------------------------
   Move a lead to a new stage
   ---------------------------------------------------------- */
async function moveLeadToStage(leadId, newStage) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead || lead.stage === newStage) return;

  const { error } = await window.supabaseClient
    .from('leads')
    .update({ stage: newStage })
    .eq('id', leadId);

  if (error) { showToast('Failed to update stage', 'error'); return; }

  lead.stage = newStage;
  // Update the select color in-place without a full re-render
  const select = document.querySelector(`.js-stage-select[data-id="${leadId}"]`);
  if (select) {
    select.style.borderColor = stageColor(newStage) + '20';
    select.style.color       = stageColor(newStage);
  }
}


/* ----------------------------------------------------------
   Archive / unarchive
   ---------------------------------------------------------- */
async function archiveLead(leadId) {
  const { error } = await window.supabaseClient
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) { showToast('Failed to archive lead', 'error'); return; }

  const lead = allLeads.find(l => l.id === leadId);
  if (lead) lead.archived_at = new Date().toISOString();
  showToast((lead?.name || 'Lead') + ' archived');
  applyFilters();
}

async function unarchiveLead(leadId) {
  const { error } = await window.supabaseClient
    .from('leads')
    .update({ archived_at: null })
    .eq('id', leadId);

  if (error) { showToast('Failed to unarchive lead', 'error'); return; }

  const lead = allLeads.find(l => l.id === leadId);
  if (lead) lead.archived_at = null;
  showToast((lead?.name || 'Lead') + ' unarchived');
  applyFilters();
}


/* ----------------------------------------------------------
   Send onboarding link
   ---------------------------------------------------------- */
async function sendOnboardingLink(lead, btn) {
  if (!lead.email) {
    showToast('No email address on file for this lead', 'error');
    return;
  }

  if (!emailThrottle.check('onboarding-link', lead.email)) {
    const secs = emailThrottle.secondsRemaining('onboarding-link', lead.email);
    showToast('Already sent -- wait ' + secs + 's before resending', 'error');
    return;
  }

  const originalText  = btn.textContent.trim();
  btn.disabled        = true;
  btn.textContent     = 'Sending...';

  const res = await fetch('/.netlify/functions/send-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      type: 'gym-onboarding-invite',
      to:   lead.email,
      name: lead.name,
    }),
  });

  btn.disabled    = false;
  btn.textContent = originalText;

  if (res.ok) {
    emailThrottle.record('onboarding-link', lead.email);
    showToast('Onboarding link sent to ' + lead.email);
  } else {
    showToast('Failed to send email -- please try again', 'error');
  }
}


/* ----------------------------------------------------------
   Add lead modal
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('lead-add-overlay').classList.add('is-open');
  document.getElementById('lead-add-form').reset();
}

function closeAddModal() {
  document.getElementById('lead-add-overlay').classList.remove('is-open');
}

async function saveNewLead(e) {
  e.preventDefault();

  const name     = document.getElementById('lead-add-name').value.trim();
  const email    = document.getElementById('lead-add-email').value.trim();
  const phone    = document.getElementById('lead-add-phone').value.trim();
  const interest = document.getElementById('lead-add-interest').value;
  const notes    = document.getElementById('lead-add-notes').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }

  const btn       = document.getElementById('lead-add-save');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  const { data, error } = await window.supabaseClient
    .from('leads')
    .insert({
      name,
      email:    email    || null,
      phone:    phone    || null,
      interest: interest || null,
      notes:    notes    || null,
      source:   'manual',
      stage:    'new',
    })
    .select()
    .single();

  btn.disabled    = false;
  btn.textContent = 'Add Lead';

  if (error) { showToast('Failed to add lead', 'error'); return; }

  showToast(name + ' added');
  allLeads.unshift(data);
  closeAddModal();
  applyFilters();
}


/* ----------------------------------------------------------
   Edit lead modal
   ---------------------------------------------------------- */
function openEditModal(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('lead-edit-id').value       = lead.id;
  document.getElementById('lead-edit-name').value     = lead.name     || '';
  document.getElementById('lead-edit-email').value    = lead.email    || '';
  document.getElementById('lead-edit-phone').value    = lead.phone    || '';
  document.getElementById('lead-edit-interest').value = lead.interest || '';
  document.getElementById('lead-edit-notes').value    = lead.notes    || '';
  document.getElementById('lead-edit-overlay').classList.add('is-open');
}

function closeEditModal() {
  document.getElementById('lead-edit-overlay').classList.remove('is-open');
}

async function saveEditedLead(e) {
  e.preventDefault();

  const id       = document.getElementById('lead-edit-id').value;
  const name     = document.getElementById('lead-edit-name').value.trim();
  const email    = document.getElementById('lead-edit-email').value.trim();
  const phone    = document.getElementById('lead-edit-phone').value.trim();
  const interest = document.getElementById('lead-edit-interest').value;
  const notes    = document.getElementById('lead-edit-notes').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }

  const btn       = document.getElementById('lead-edit-save');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  const { error } = await window.supabaseClient
    .from('leads')
    .update({
      name,
      email:    email    || null,
      phone:    phone    || null,
      interest: interest || null,
      notes:    notes    || null,
    })
    .eq('id', id);

  btn.disabled    = false;
  btn.textContent = 'Save Changes';

  if (error) { showToast('Failed to save changes', 'error'); return; }

  const lead = allLeads.find(l => l.id === id);
  if (lead) {
    lead.name     = name;
    lead.email    = email    || null;
    lead.phone    = phone    || null;
    lead.interest = interest || null;
    lead.notes    = notes    || null;
  }

  showToast('Changes saved');
  closeEditModal();
  applyFilters();
}


/* ----------------------------------------------------------
   Setup filter bar listeners
   ---------------------------------------------------------- */
function setupFilters() {
  document.getElementById('lead-search')?.addEventListener('input', applyFilters);

  document.getElementById('lead-stage-filter')?.addEventListener('change', (e) => {
    stageFilter = e.target.value;
    applyFilters();
  });

  document.getElementById('lead-archive-toggle')?.addEventListener('click', () => {
    showingArchived = !showingArchived;
    stageFilter     = ''; // reset stage filter when switching views
    document.getElementById('lead-stage-filter').value = '';

    const btn = document.getElementById('lead-archive-toggle');
    btn.textContent = showingArchived ? 'Show Active' : 'Show Archived';
    btn.classList.toggle('btn--ghost',     showingArchived);
    btn.classList.toggle('btn--secondary', !showingArchived);

    // Stage filter irrelevant in archived view
    const stageSelect = document.getElementById('lead-stage-filter');
    if (stageSelect) stageSelect.disabled = showingArchived;

    applyFilters();
  });
}


/* ----------------------------------------------------------
   Load leads from Supabase
   ---------------------------------------------------------- */
async function loadLeads() {
  const { data, error } = await window.supabaseClient
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showToast('Failed to load leads', 'error'); return; }
  allLeads = data || [];
}


/* ----------------------------------------------------------
   Build the page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  const actions = getAdminActions();
  if (actions) {
    const addBtn       = document.createElement('button');
    addBtn.className   = 'btn btn--primary btn--sm';
    addBtn.textContent = '+ Add Lead';
    addBtn.addEventListener('click', openAddModal);
    actions.appendChild(addBtn);
  }

  // Build stage filter options
  const stageFilterOptions = STAGES
    .filter(s => s.id !== 'converted') // converted shown via its own filter option
    .map(s => `<option value="${s.id}">${s.label}</option>`)
    .join('');

  content.innerHTML = `

    <!-- Filter bar -->
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-bottom:var(--space-lg);" class="admin-filter-bar">
      <input class="form__input" type="text" id="lead-search"
        placeholder="Search by name, email, phone..." style="max-width:240px;flex-shrink:0;">
      <select class="form__select" id="lead-stage-filter" style="max-width:160px;">
        <option value="">All Stages</option>
        ${stageFilterOptions}
        <option value="converted">Converted</option>
      </select>
      <button class="btn btn--secondary btn--sm" id="lead-archive-toggle" style="margin-left:auto;">
        Show Archived
      </button>
    </div>

    <!-- Leads table -->
    <div id="leads-table-wrap">
      <div class="spinner" style="margin:var(--space-2xl) auto;"></div>
    </div>


    <!-- ====================================================
         ADD LEAD MODAL
         ==================================================== -->
    <div class="modal-overlay" id="lead-add-overlay">
      <div class="modal" style="max-width:460px;">
        <div class="modal__header">
          <h2 class="modal__title">Add Lead</h2>
          <button class="modal__close" id="lead-add-close" aria-label="Close">&times;</button>
        </div>
        <form class="form" id="lead-add-form">
          <div class="form__group">
            <label class="form__label" for="lead-add-name">Full Name *</label>
            <input class="form__input" type="text" id="lead-add-name" placeholder="e.g. John Smith" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);" class="form__2col">
            <div class="form__group">
              <label class="form__label" for="lead-add-email">Email</label>
              <input class="form__input" type="email" id="lead-add-email" placeholder="john@example.com">
            </div>
            <div class="form__group">
              <label class="form__label" for="lead-add-phone">Phone</label>
              <input class="form__input" type="tel" id="lead-add-phone" placeholder="(555) 000-0000">
            </div>
          </div>
          <div class="form__group">
            <label class="form__label" for="lead-add-interest">Interested In</label>
            <select class="form__select" id="lead-add-interest">
              <option value="">Not specified</option>
              <option value="jiu-jitsu">Jiu-Jitsu</option>
              <option value="striking">Striking</option>
              <option value="fitness">Personal Fitness</option>
              <option value="not-sure">Not Sure Yet</option>
            </select>
          </div>
          <div class="form__group">
            <label class="form__label" for="lead-add-notes">Notes</label>
            <textarea class="form__textarea" id="lead-add-notes" rows="2"
              placeholder="Anything worth remembering..."></textarea>
          </div>
          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="lead-add-cancel">Cancel</button>
            <button type="submit" class="btn btn--primary" id="lead-add-save">Add Lead</button>
          </div>
        </form>
      </div>
    </div>


    <!-- ====================================================
         EDIT LEAD MODAL
         ==================================================== -->
    <div class="modal-overlay" id="lead-edit-overlay">
      <div class="modal" style="max-width:460px;">
        <div class="modal__header">
          <h2 class="modal__title">Edit Lead</h2>
          <button class="modal__close" id="lead-edit-close" aria-label="Close">&times;</button>
        </div>
        <form class="form" id="lead-edit-form">
          <input type="hidden" id="lead-edit-id">
          <div class="form__group">
            <label class="form__label" for="lead-edit-name">Full Name *</label>
            <input class="form__input" type="text" id="lead-edit-name" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);" class="form__2col">
            <div class="form__group">
              <label class="form__label" for="lead-edit-email">Email</label>
              <input class="form__input" type="email" id="lead-edit-email">
            </div>
            <div class="form__group">
              <label class="form__label" for="lead-edit-phone">Phone</label>
              <input class="form__input" type="tel" id="lead-edit-phone">
            </div>
          </div>
          <div class="form__group">
            <label class="form__label" for="lead-edit-interest">Interested In</label>
            <select class="form__select" id="lead-edit-interest">
              <option value="">Not specified</option>
              <option value="jiu-jitsu">Jiu-Jitsu</option>
              <option value="striking">Striking</option>
              <option value="fitness">Personal Fitness</option>
              <option value="not-sure">Not Sure Yet</option>
            </select>
          </div>
          <div class="form__group">
            <label class="form__label" for="lead-edit-notes">Notes</label>
            <textarea class="form__textarea" id="lead-edit-notes" rows="3"></textarea>
          </div>
          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="button" class="btn btn--secondary" id="lead-edit-cancel">Cancel</button>
            <button type="submit" class="btn btn--primary" id="lead-edit-save">Save Changes</button>
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

  const content = renderAdminShell('leads', 'Leads');
  buildPage(content);

  await loadLeads();
  applyFilters();
  setupFilters();

  // Close overflow menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.row-overflow__menu.is-open')
      .forEach(m => m.classList.remove('is-open'));
  });

  // Add lead modal
  document.getElementById('lead-add-close')?.addEventListener('click', closeAddModal);
  document.getElementById('lead-add-cancel')?.addEventListener('click', closeAddModal);
  document.getElementById('lead-add-form')?.addEventListener('submit', saveNewLead);
  safeModalClose('lead-add-overlay', closeAddModal);

  // Edit lead modal
  document.getElementById('lead-edit-close')?.addEventListener('click', closeEditModal);
  document.getElementById('lead-edit-cancel')?.addEventListener('click', closeEditModal);
  document.getElementById('lead-edit-form')?.addEventListener('submit', saveEditedLead);
  safeModalClose('lead-edit-overlay', closeEditModal);

})();
