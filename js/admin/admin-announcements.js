/* ==========================================================
   admin-announcements.js — Broadcast email announcements
   True Jiu Jitsu Online

   Lets Daniel compose and send a custom email to all active
   gym members. Uses a two-step flow:
     1. Compose — write subject + message, manage recipient list
     2. Confirm — review before sending

   The recipient row is clickable and expands into a checklist
   so individual members can be excluded from the blast.
   Members who have opted out or have no email are excluded
   automatically regardless.
   ========================================================== */


/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let allRecipients     = [];  // all eligible members
let excludedIds       = new Set();  // IDs of manually unchecked members
let recipientsLoaded  = false;


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */

// showToast is defined in admin-auth.js, loaded before this
// file on every admin page.

function activeCount() {
  return allRecipients.filter(m => !excludedIds.has(m.id)).length;
}


/* ----------------------------------------------------------
   Load eligible recipients — active, has email, not opted out
   ---------------------------------------------------------- */
async function loadRecipients() {
  const { data } = await window.supabaseClient
    .from('gym_members')
    .select('id, name, email')
    .eq('subscription_status', 'active')
    .eq('marketing_opt_out', false)
    .not('email', 'is', null)
    .order('name');

  allRecipients    = data || [];
  recipientsLoaded = true;
  return allRecipients;
}


/* ----------------------------------------------------------
   Update the recipient count label
   ---------------------------------------------------------- */
function updateRecipientCount() {
  const count   = activeCount();
  const countEl = document.getElementById('recipient-count');
  if (countEl) countEl.textContent = count;
}


/* ----------------------------------------------------------
   Render the expandable checklist
   ---------------------------------------------------------- */
function renderRecipientList() {
  const listEl = document.getElementById('recipient-list');
  if (!listEl) return;

  if (!allRecipients.length) {
    listEl.innerHTML = `
      <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-md);max-width:none;">
        No eligible recipients found.
      </p>
    `;
    return;
  }

  // Select all / Deselect all bar
  listEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:var(--space-sm) var(--space-md);
                border-bottom:1px solid var(--color-mid-gray);
                position:sticky;top:0;background:var(--color-dark-gray);z-index:1;">
      <span style="font-size:var(--text-xs);color:var(--color-gray);">
        ${allRecipients.length} eligible
      </span>
      <div style="display:flex;gap:var(--space-md);">
        <button type="button" id="select-all-btn"
          style="font-size:var(--text-xs);color:var(--color-gray);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
          Select all
        </button>
        <button type="button" id="deselect-all-btn"
          style="font-size:var(--text-xs);color:var(--color-gray);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
          Deselect all
        </button>
      </div>
    </div>

    <div id="recipient-checkboxes"></div>
  `;

  renderCheckboxes();

  document.getElementById('select-all-btn')?.addEventListener('click', () => {
    excludedIds.clear();
    renderCheckboxes();
    updateRecipientCount();
  });

  document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
    allRecipients.forEach(m => excludedIds.add(m.id));
    renderCheckboxes();
    updateRecipientCount();
  });
}


/* ----------------------------------------------------------
   Render just the checkbox rows (called on toggle changes too)
   ---------------------------------------------------------- */
function renderCheckboxes() {
  const wrap = document.getElementById('recipient-checkboxes');
  if (!wrap) return;

  wrap.innerHTML = allRecipients.map(member => `
    <label style="display:flex;align-items:center;gap:var(--space-md);
                  padding:var(--space-sm) var(--space-md);
                  cursor:pointer;
                  border-bottom:1px solid rgba(255,255,255,0.04);
                  transition:background var(--transition-fast);"
           onmouseover="this.style.background='rgba(255,255,255,0.03)'"
           onmouseout="this.style.background='transparent'">
      <input type="checkbox"
             class="recipient-checkbox"
             data-id="${member.id}"
             ${excludedIds.has(member.id) ? '' : 'checked'}
             style="width:16px;height:16px;accent-color:var(--color-red);flex-shrink:0;cursor:pointer;">
      <div style="min-width:0;">
        <p style="margin:0;font-size:var(--text-sm);color:var(--color-white);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:none;">
          ${member.name}
        </p>
        <p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:none;">
          ${member.email}
        </p>
      </div>
    </label>
  `).join('');

  wrap.querySelectorAll('.recipient-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) excludedIds.delete(cb.dataset.id);
      else            excludedIds.add(cb.dataset.id);
      updateRecipientCount();
    });
  });
}


/* ----------------------------------------------------------
   Toggle the recipient checklist open / closed
   ---------------------------------------------------------- */
function toggleRecipientList() {
  const listWrap  = document.getElementById('recipient-list-wrap');
  const chevron   = document.getElementById('recipient-chevron');
  const isOpen    = listWrap.style.display !== 'none';

  listWrap.style.display = isOpen ? 'none' : '';
  chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';

  // Render list on first open
  if (!isOpen && !recipientsLoaded) {
    document.getElementById('recipient-list').innerHTML =
      '<div class="spinner" style="margin:var(--space-lg) auto;"></div>';
  }
  if (!isOpen) renderRecipientList();
}


/* ----------------------------------------------------------
   Step 1 → Step 2: show confirmation panel
   ---------------------------------------------------------- */
function showConfirmation(subject, message) {
  const count = activeCount();

  if (count === 0) {
    showToast('No recipients selected — please check at least one member.', 'error');
    return;
  }

  document.getElementById('confirm-subject').textContent = subject;
  document.getElementById('confirm-count').textContent   =
    `${count} member${count === 1 ? '' : 's'}`;

  const preview = message.length > 200 ? message.slice(0, 200) + '…' : message;
  document.getElementById('confirm-preview').textContent = preview;

  document.getElementById('compose-panel').style.display = 'none';
  document.getElementById('confirm-panel').style.display = '';
}


/* ----------------------------------------------------------
   Back to compose panel
   ---------------------------------------------------------- */
function showCompose() {
  document.getElementById('compose-panel').style.display = '';
  document.getElementById('confirm-panel').style.display = 'none';
}


/* ----------------------------------------------------------
   Send the announcement
   ---------------------------------------------------------- */
async function sendAnnouncement(subject, message) {
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled    = true;
  sendBtn.textContent = 'Sending…';

  const { data: { session } } = await window.supabaseClient.auth.getSession();

  const response = await fetch('/.netlify/functions/send-announcement', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      subject,
      message,
      excludeIds: Array.from(excludedIds),  // IDs to skip
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    showToast(result.error || 'Failed to send announcement', 'error');
    sendBtn.disabled    = false;
    sendBtn.textContent = 'Send Now';
    return;
  }

  document.getElementById('confirm-panel').style.display = 'none';
  document.getElementById('success-panel').style.display = '';
  document.getElementById('success-sent').textContent    = result.sent;

  if (result.failed > 0) {
    document.getElementById('success-failed').textContent  = `${result.failed} failed to send.`;
    document.getElementById('success-failed').style.display = '';
  }
}


/* ----------------------------------------------------------
   Build the page HTML
   ---------------------------------------------------------- */
function buildPage(content) {
  content.innerHTML = `

    <div style="max-width:680px;">

      <!-- ================================================
           STEP 1: Compose
           ================================================ -->
      <div id="compose-panel">

        <p style="color:var(--color-light-gray);font-size:var(--text-sm);margin-bottom:var(--space-xl);max-width:none;">
          Send an email to all active gym members. Members without an email address
          or who have opted out will be skipped automatically.
        </p>

        <!-- Recipient row — click to expand checklist -->
        <div style="margin-bottom:var(--space-xl);">
          <button type="button" id="recipient-toggle"
            style="width:100%;background:var(--color-dark-gray);border:1px solid var(--color-mid-gray);
                   border-radius:var(--border-radius);padding:var(--space-md) var(--space-lg);
                   display:flex;align-items:center;gap:var(--space-md);cursor:pointer;
                   text-align:left;transition:border-color var(--transition-fast);"
            onmouseover="this.style.borderColor='var(--color-gray)'"
            onmouseout="this.style.borderColor='var(--color-mid-gray)'">
            <span style="font-size:var(--text-lg);">📬</span>
            <div style="flex:1;">
              <p style="margin:0;font-size:var(--text-sm);color:var(--color-white);font-weight:500;max-width:none;">
                Will send to
                <span id="recipient-count" style="color:var(--color-red-accessible);">—</span>
                members
              </p>
              <p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);max-width:none;">
                Click to manage recipients
              </p>
            </div>
            <span id="recipient-chevron"
              style="color:var(--color-gray);font-size:var(--text-sm);
                     transition:transform var(--transition-fast);flex-shrink:0;">▼</span>
          </button>

          <!-- Expandable checklist -->
          <div id="recipient-list-wrap" style="display:none;">
            <div id="recipient-list"
              style="background:var(--color-dark-gray);
                     border:1px solid var(--color-mid-gray);border-top:none;
                     border-radius:0 0 var(--border-radius) var(--border-radius);
                     max-height:260px;overflow-y:auto;">
            </div>
          </div>
        </div>

        <form class="form" id="compose-form">

          <div class="form__group">
            <label class="form__label" for="announce-subject">Subject Line *</label>
            <input class="form__input" type="text" id="announce-subject"
              placeholder="e.g. Gym closed this Saturday" required maxlength="100">
          </div>

          <div class="form__group">
            <label class="form__label" for="announce-message">Message *</label>
            <textarea class="form__textarea" id="announce-message" rows="10"
              placeholder="Write your message here…&#10;&#10;Keep it clear and concise. Each member will be addressed by their first name." required></textarea>
            <span class="form__hint">Plain text only. Line breaks will be preserved in the email.</span>
          </div>

          <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
            <button type="submit" class="btn btn--primary" id="preview-btn">
              Review &amp; Send →
            </button>
          </div>

        </form>
      </div>


      <!-- ================================================
           STEP 2: Confirm
           ================================================ -->
      <div id="confirm-panel" style="display:none;">

        <div style="background:var(--color-dark-gray);border:1px solid var(--color-mid-gray);
                    border-radius:var(--border-radius-lg);padding:var(--space-xl);margin-bottom:var(--space-xl);">
          <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin-bottom:var(--space-sm);max-width:none;">Subject</p>
          <p style="font-size:var(--text-lg);font-family:var(--font-heading);color:var(--color-white);margin-bottom:var(--space-lg);max-width:none;" id="confirm-subject"></p>

          <p style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray);margin-bottom:var(--space-sm);max-width:none;">Message Preview</p>
          <p style="font-size:var(--text-sm);color:var(--color-light-gray);line-height:1.7;margin-bottom:var(--space-lg);max-width:none;" id="confirm-preview"></p>

          <div style="border-top:1px solid var(--color-mid-gray);padding-top:var(--space-lg);">
            <p style="font-size:var(--text-sm);color:var(--color-gray);margin:0;max-width:none;">
              This will be sent to
              <strong style="color:var(--color-white);" id="confirm-count">—</strong>.
              This cannot be undone.
            </p>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-md);justify-content:flex-end;">
          <button type="button" class="btn btn--secondary" id="back-btn">← Back to Edit</button>
          <button type="button" class="btn btn--primary" id="send-btn">Send Now</button>
        </div>

      </div>


      <!-- ================================================
           STEP 3: Success
           ================================================ -->
      <div id="success-panel" style="display:none;text-align:center;padding:var(--space-3xl) 0;">
        <p style="font-size:3rem;margin-bottom:var(--space-lg);">✅</p>
        <h2 style="font-size:var(--text-2xl);text-transform:none;letter-spacing:0;margin-bottom:var(--space-sm);">
          Announcement sent
        </h2>
        <p style="color:var(--color-gray);font-size:var(--text-base);margin-bottom:var(--space-xs);max-width:none;">
          Delivered to <strong id="success-sent" style="color:var(--color-white);"></strong> members.
        </p>
        <p id="success-failed" style="display:none;color:var(--color-red-accessible);font-size:var(--text-sm);margin-bottom:var(--space-xl);max-width:none;"></p>
        <button type="button" class="btn btn--secondary" id="send-another-btn" style="margin-top:var(--space-xl);">
          Send Another
        </button>
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

  const content = renderAdminShell('announcements', 'Announcements');
  buildPage(content);

  // Load recipients and show count
  await loadRecipients();
  updateRecipientCount();

  // Toggle checklist open/closed
  document.getElementById('recipient-toggle')
    ?.addEventListener('click', toggleRecipientList);

  // Step 1 → Step 2
  document.getElementById('compose-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = document.getElementById('announce-subject').value.trim();
    const message = document.getElementById('announce-message').value.trim();
    if (!subject || !message) return;
    showConfirmation(subject, message);
  });

  // Step 2 → back
  document.getElementById('back-btn')?.addEventListener('click', showCompose);

  // Step 2 → send
  document.getElementById('send-btn')?.addEventListener('click', async () => {
    const subject = document.getElementById('announce-subject').value.trim();
    const message = document.getElementById('announce-message').value.trim();
    await sendAnnouncement(subject, message);
  });

  // Step 3 → reset
  document.getElementById('send-another-btn')?.addEventListener('click', () => {
    document.getElementById('announce-subject').value   = '';
    document.getElementById('announce-message').value   = '';
    document.getElementById('success-panel').style.display  = 'none';
    document.getElementById('success-failed').style.display = 'none';
    document.getElementById('success-failed').textContent   = '';
    excludedIds.clear();

    // Close the checklist and reset chevron
    document.getElementById('recipient-list-wrap').style.display = 'none';
    document.getElementById('recipient-chevron').style.transform = 'rotate(0deg)';

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send Now'; }

    renderCheckboxes();
    updateRecipientCount();
    showCompose();
  });

})();
