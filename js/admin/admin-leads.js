/* ==========================================================
   admin-leads.js — Leads pipeline (Kanban board)
   True Jiu Jitsu Online

   Displays leads in three draggable columns:
     New → Contacted → Trial Scheduled

   Leads come from two sources:
     - contact_form: submitted via truebjj.academy contact form
     - manual: added directly by the admin here

   When a lead converts (signs a waiver), submit-waiver.js
   links their gym_member_id onto this record automatically
   via email match, and the stage is set to 'converted'.
   Converted and archived leads are hidden from the board.
   ========================================================== */

let allLeads = [];


/* ----------------------------------------------------------
   Stage config — single source of truth for column order,
   labels, and colors used throughout the board.
   ---------------------------------------------------------- */
const STAGES = [
  { id: 'new',              label: 'New',              color: '#60a5fa' },
  { id: 'contacted',        label: 'Contacted',        color: '#f59e0b' },
  { id: 'trial_scheduled',  label: 'Trial Scheduled',  color: '#a78bfa' },
];

const SOURCE_LABELS = {
  contact_form: 'Contact Form',
  manual:       'Manual Entry',
};


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

function stageConfig(stageId) {
  return STAGES.find(s => s.id === stageId) || STAGES[0];
}

// How long ago a lead came in, as a short human string
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return mins  + 'm ago';
  if (hours < 24)  return hours + 'h ago';
  if (days  < 30)  return days  + 'd ago';
  return formatDate(iso);
}


/* ----------------------------------------------------------
   Render the full Kanban board
   ---------------------------------------------------------- */
function renderBoard(leads) {
  STAGES.forEach(stage => {
    const column = document.getElementById('col-' + stage.id);
    if (!column) return;

    const stageLeads = leads.filter(l => l.stage === stage.id && !l.archived_at);

    // Update the count badge on the column header
    const countEl = document.getElementById('count-' + stage.id);
    if (countEl) countEl.textContent = stageLeads.length;

    // Clear and repopulate cards
    const cardsWrap = column.querySelector('.leads-col__cards');
    if (!cardsWrap) return;
    cardsWrap.innerHTML = '';

    if (!stageLeads.length) {
      cardsWrap.innerHTML = `<div class="leads-col__empty">No leads here yet</div>`;
      return;
    }

    stageLeads.forEach(lead => {
      cardsWrap.appendChild(buildCard(lead));
    });
  });
}


/* ----------------------------------------------------------
   Build a single lead card element
   ---------------------------------------------------------- */
function buildCard(lead) {
  const card = document.createElement('div');
  card.className  = 'lead-card';
  card.dataset.id = lead.id;
  card.draggable  = true;

  const source = SOURCE_LABELS[lead.source] || lead.source;

  card.innerHTML = `
    <div class="lead-card__header">
      <p class="lead-card__name">${lead.name}</p>
      <div class="row-overflow" data-id="${lead.id}">
        <button class="row-overflow__trigger" aria-label="More options" title="More options">
          &bull;&bull;&bull;
        </button>
        <div class="row-overflow__menu">
          <button class="row-overflow__item js-edit-lead" data-id="${lead.id}">Edit details</button>
          ${lead.gym_member_id
            ? `<button class="row-overflow__item js-view-member" data-id="${lead.gym_member_id}">View member record</button>`
            : ''
          }
          <button class="row-overflow__item row-overflow__item--danger js-archive-lead" data-id="${lead.id}">Archive lead</button>
        </div>
      </div>
    </div>

    ${lead.email ? `<p class="lead-card__detail"><a href="mailto:${lead.email}">${lead.email}</a></p>` : ''}
    ${lead.phone ? `<p class="lead-card__detail">${lead.phone}</p>` : ''}
    ${lead.interest ? `<p class="lead-card__interest">${lead.interest}</p>` : ''}

    <!-- Notes — shows current note or a placeholder, with an edit button -->
    <div class="lead-card__notes-wrap">
      <div class="lead-card__notes-display js-notes-display">
        ${lead.notes
          ? `<p class="lead-card__notes">${lead.notes}</p>`
          : `<p class="lead-card__notes lead-card__notes--empty">No notes yet</p>`
        }
        <button class="lead-card__notes-edit-btn js-edit-notes" title="Edit note" aria-label="Edit note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
      <!-- Inline note editor — hidden until pencil is clicked -->
      <div class="lead-card__notes-editor js-notes-editor" style="display:none;">
        <textarea class="lead-card__notes-textarea js-notes-textarea" rows="3" placeholder="Add a note…">${lead.notes || ''}</textarea>
        <div class="lead-card__notes-editor-actions">
          <button class="btn btn--primary btn--sm js-notes-save">Save</button>
          <button class="btn btn--ghost btn--sm js-notes-cancel">Cancel</button>
        </div>
      </div>
    </div>

    <div class="lead-card__footer">
      <span class="lead-card__source">${source}</span>
      <span class="lead-card__age">${timeAgo(lead.created_at)}</span>
    </div>

    <!-- Card action buttons -->
    <div class="lead-card__actions">
      ${buildMoveButtons(lead)}
      ${lead.gym_member_id
        ? `<span class="badge badge--active" style="font-size:10px;">Converted</span>`
        : (lead.email
            ? `<button class="btn btn--ghost btn--sm js-send-onboarding" data-id="${lead.id}" title="Send onboarding link to ${lead.email}">
                 &#x2197; Send Onboarding Link
               </button>`
            : ''
          )
      }
    </div>
  `;

  // Overflow menu toggle
  const trigger = card.querySelector('.row-overflow__trigger');
  const menu    = card.querySelector('.row-overflow__menu');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.row-overflow__menu.is-open').forEach(m => {
      if (m !== menu) m.classList.remove('is-open');
    });
    menu.classList.toggle('is-open');
  });

  // Edit details
  card.querySelector('.js-edit-lead')?.addEventListener('click', () => {
    menu.classList.remove('is-open');
    openEditModal(lead.id);
  });

  // View member record
  card.querySelector('.js-view-member')?.addEventListener('click', () => {
    window.location.href = '/pages/admin/gym-members.html';
  });

  // Archive
  card.querySelector('.js-archive-lead')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.remove('is-open');
    confirmAction(trigger, 'Archive ' + lead.name + '?', () => archiveLead(lead.id));
  });

  // Send onboarding link
  card.querySelector('.js-send-onboarding')?.addEventListener('click', (btn) => {
    sendOnboardingLink(lead, card.querySelector('.js-send-onboarding'));
  });

  // Inline note editing
  wireNoteEditor(card, lead);

  // Drag and drop
  wireDrag(card, lead.id);

  return card;
}


/* ----------------------------------------------------------
   Inline note editor
   Clicking the pencil icon shows a textarea in-place.
   Saving updates Supabase and refreshes the display text
   without a full board re-render so the card stays in place.
   ---------------------------------------------------------- */
function wireNoteEditor(card, lead) {
  const display  = card.querySelector('.js-notes-display');
  const editor   = card.querySelector('.js-notes-editor');
  const textarea = card.querySelector('.js-notes-textarea');
  const editBtn  = card.querySelector('.js-edit-notes');
  const saveBtn  = card.querySelector('.js-notes-save');
  const cancelBtn = card.querySelector('.js-notes-cancel');

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
    saveBtn.textContent = 'Saving\u2026';

    const { error } = await window.supabaseClient
      .from('leads')
      .update({ notes: newNote })
      .eq('id', lead.id);

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';

    if (error) { showToast('Failed to save note', 'error'); return; }

    // Update local state
    lead.notes = newNote;

    // Update the display text in-place — no full re-render needed
    const notesEl = display.querySelector('.lead-card__notes');
    if (notesEl) {
      notesEl.textContent = newNote || 'No notes yet';
      notesEl.classList.toggle('lead-card__notes--empty', !newNote);
    }

    closeEditor();
    showToast('Note saved');
  }

  editBtn.addEventListener('click',  (e) => { e.stopPropagation(); openEditor(); });
  cancelBtn.addEventListener('click', closeEditor);
  saveBtn.addEventListener('click',  saveNote);

  // Ctrl/Cmd+Enter to save quickly
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
    if (e.key === 'Escape') closeEditor();
  });
}


/* ----------------------------------------------------------
   Send onboarding link to a lead's email address
   ---------------------------------------------------------- */
async function sendOnboardingLink(lead, btn) {
  if (!lead.email) {
    showToast('No email address on file for this lead', 'error');
    return;
  }

  const originalText  = btn.textContent.trim();
  btn.disabled        = true;
  btn.textContent     = 'Sending\u2026';

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
    showToast('Onboarding link sent to ' + lead.email);
  } else {
    showToast('Failed to send email \u2014 please try again', 'error');
  }
}


/* ----------------------------------------------------------
   Build prev/next stage move buttons for a card
   ---------------------------------------------------------- */
function buildMoveButtons(lead) {
  const currentIndex = STAGES.findIndex(s => s.id === lead.stage);
  const parts = [];

  if (currentIndex > 0) {
    const prev = STAGES[currentIndex - 1];
    parts.push(`
      <button class="btn btn--ghost btn--sm js-move-stage"
        data-id="${lead.id}" data-stage="${prev.id}"
        title="Move back to ${prev.label}">
        &larr; ${prev.label}
      </button>
    `);
  }

  if (currentIndex < STAGES.length - 1) {
    const next = STAGES[currentIndex + 1];
    parts.push(`
      <button class="btn btn--secondary btn--sm js-move-stage"
        data-id="${lead.id}" data-stage="${next.id}"
        title="Move to ${next.label}">
        ${next.label} &rarr;
      </button>
    `);
  }

  return parts.join('');
}


/* ----------------------------------------------------------
   Wire drag-and-drop on a card
   ---------------------------------------------------------- */
function wireDrag(card, leadId) {
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', leadId);
    card.classList.add('is-dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    document.querySelectorAll('.leads-col__cards').forEach(c => c.classList.remove('drag-over'));
  });
}


/* ----------------------------------------------------------
   Wire drop zones on each column
   ---------------------------------------------------------- */
function wireDropZones() {
  document.querySelectorAll('.leads-col__cards').forEach(zone => {
    const stageId = zone.closest('.leads-col').dataset.stage;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const leadId = e.dataTransfer.getData('text/plain');
      if (!leadId) return;
      await moveLeadToStage(leadId, stageId);
    });
  });
}


/* ----------------------------------------------------------
   Move a lead to a new stage — update Supabase + re-render
   ---------------------------------------------------------- */
async function moveLeadToStage(leadId, newStage) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead || lead.stage === newStage) return;

  const { error } = await window.supabaseClient
    .from('leads')
    .update({ stage: newStage })
    .eq('id', leadId);

  if (error) { showToast('Failed to move lead', 'error'); return; }

  lead.stage = newStage;
  renderBoard(allLeads);
  wireCardButtons();
}


/* ----------------------------------------------------------
   Re-wire move buttons after every render
   (cards are rebuilt on render so listeners need rewiring)
   ---------------------------------------------------------- */
function wireCardButtons() {
  document.querySelectorAll('.js-move-stage').forEach(btn => {
    btn.addEventListener('click', () => {
      moveLeadToStage(btn.dataset.id, btn.dataset.stage);
    });
  });
}


/* ----------------------------------------------------------
   Archive a lead
   ---------------------------------------------------------- */
async function archiveLead(leadId) {
  const { error } = await window.supabaseClient
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) { showToast('Failed to archive lead', 'error'); return; }

  const lead = allLeads.find(l => l.id === leadId);
  showToast((lead?.name || 'Lead') + ' archived');
  lead.archived_at = new Date().toISOString();
  renderBoard(allLeads);
  wireCardButtons();
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
  btn.textContent = 'Saving\u2026';

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
  renderBoard(allLeads);
  wireCardButtons();
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
  btn.textContent = 'Saving\u2026';

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

  // Update local state and re-render so the card reflects the new details
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
  renderBoard(allLeads);
  wireCardButtons();
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

  const columnsHTML = STAGES.map(stage => `
    <div class="leads-col" data-stage="${stage.id}" id="col-${stage.id}">
      <div class="leads-col__header">
        <span class="leads-col__dot" style="background:${stage.color};"></span>
        <h3 class="leads-col__title">${stage.label}</h3>
        <span class="leads-col__count" id="count-${stage.id}">0</span>
      </div>
      <div class="leads-col__cards"></div>
    </div>
  `).join('');

  content.innerHTML = `

    <!-- Kanban board -->
    <div class="leads-board">
      ${columnsHTML}
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
              placeholder="Anything worth remembering about this person&hellip;"></textarea>
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
  renderBoard(allLeads);
  wireDropZones();
  wireCardButtons();

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
