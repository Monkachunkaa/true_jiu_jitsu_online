/* ==========================================================
   admin-announcements.js — Broadcast email announcements
   True Jiu Jitsu Online

   Lets Daniel compose and send a custom email to all active
   gym members in one step. Uses a two-step flow:
     1. Compose — write subject + message, see recipient count
     2. Confirm — review and confirm before sending

   Members who have opted out or have no email are excluded.
   ========================================================== */


/* ----------------------------------------------------------
   Helpers
   ---------------------------------------------------------- */
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
  setTimeout(() => toast.remove(), type === 'success' ? 4000 : 6000);
}


/* ----------------------------------------------------------
   Load recipient count — active members with email, not opted out
   ---------------------------------------------------------- */
async function loadRecipientCount() {
  const { count } = await window.supabaseClient
    .from('gym_members')
    .select('id', { count: 'exact', head: true })
    .eq('subscription_status', 'active')
    .eq('marketing_opt_out', false)
    .not('email', 'is', null);

  return count || 0;
}


/* ----------------------------------------------------------
   Step 1 → Step 2: show confirmation panel
   ---------------------------------------------------------- */
function showConfirmation(subject, message, recipientCount) {
  const composePanel = document.getElementById('compose-panel');
  const confirmPanel = document.getElementById('confirm-panel');

  // Fill in the summary
  document.getElementById('confirm-subject').textContent  = subject;
  document.getElementById('confirm-count').textContent    =
    `${recipientCount} active member${recipientCount === 1 ? '' : 's'}`;

  // Preview first 200 chars of message
  const preview = message.length > 200 ? message.slice(0, 200) + '…' : message;
  document.getElementById('confirm-preview').textContent = preview;

  composePanel.style.display = 'none';
  confirmPanel.style.display = '';
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
    body: JSON.stringify({ subject, message }),
  });

  const result = await response.json();

  if (!response.ok) {
    showToast(result.error || 'Failed to send announcement', 'error');
    sendBtn.disabled    = false;
    sendBtn.textContent = 'Send Now';
    return;
  }

  // Show success state
  document.getElementById('confirm-panel').style.display = 'none';
  document.getElementById('success-panel').style.display = '';
  document.getElementById('success-sent').textContent    = result.sent;

  if (result.failed > 0) {
    document.getElementById('success-failed').textContent = `${result.failed} failed to send.`;
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
          or who have opted out will be skipped.
        </p>

        <!-- Recipient preview -->
        <div style="background:var(--color-dark-gray);border:1px solid var(--color-mid-gray);border-radius:var(--border-radius);padding:var(--space-md) var(--space-lg);margin-bottom:var(--space-xl);display:flex;align-items:center;gap:var(--space-md);">
          <span style="font-size:var(--text-xl);">📬</span>
          <div>
            <p style="margin:0;font-size:var(--text-sm);color:var(--color-white);font-weight:500;max-width:none;">
              Will send to <span id="recipient-count" style="color:var(--color-red-accessible);">—</span> members
            </p>
            <p style="margin:0;font-size:var(--text-xs);color:var(--color-gray);max-width:none;">
              Active members with an email address and announcements enabled
            </p>
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
            <span class="form__hint">
              Plain text only. Line breaks will be preserved in the email.
            </span>
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

        <div style="background:var(--color-dark-gray);border:1px solid var(--color-mid-gray);border-radius:var(--border-radius-lg);padding:var(--space-xl);margin-bottom:var(--space-xl);">
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

  // Load and display recipient count
  const count = await loadRecipientCount();
  const countEl = document.getElementById('recipient-count');
  if (countEl) countEl.textContent = count;

  // Step 1 → Step 2: review
  document.getElementById('compose-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('announce-subject').value.trim();
    const message = document.getElementById('announce-message').value.trim();
    if (!subject || !message) return;
    showConfirmation(subject, message, count);
  });

  // Step 2 → Step 1: back
  document.getElementById('back-btn')?.addEventListener('click', showCompose);

  // Step 2 → Send
  document.getElementById('send-btn')?.addEventListener('click', async () => {
    const subject = document.getElementById('announce-subject').value.trim();
    const message = document.getElementById('announce-message').value.trim();
    await sendAnnouncement(subject, message);
  });

  // Step 3 → Reset
  document.getElementById('send-another-btn')?.addEventListener('click', () => {
    document.getElementById('announce-subject').value = '';
    document.getElementById('announce-message').value = '';
    document.getElementById('success-panel').style.display  = 'none';
    document.getElementById('success-failed').style.display = 'none';
    document.getElementById('success-failed').textContent   = '';

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send Now'; }

    showCompose();
  });

})();
