/* ==========================================================
   reset-password.js — Password reset handler
   True Jiu Jitsu Online

   Supabase sends the user here after they click the reset
   link in their email. The URL contains a recovery token
   that Supabase automatically exchanges for a session.

   We listen for the PASSWORD_RECOVERY auth event, then
   show the new password form and call updateUser on submit.
   ========================================================== */

const formPanel    = document.getElementById('panel-form');
const successPanel = document.getElementById('panel-success');
const invalidPanel = document.getElementById('panel-invalid');
const resetForm    = document.getElementById('reset-form');
const resetError   = document.getElementById('reset-error');
const resetBtn     = document.getElementById('reset-btn');

/* ----------------------------------------------------------
   Show the invalid/expired state if something goes wrong
   ---------------------------------------------------------- */
function showInvalid() {
  formPanel.style.display    = 'none';
  successPanel.style.display = 'none';
  invalidPanel.style.display = '';
}

/* ----------------------------------------------------------
   Show the success state after password is updated
   ---------------------------------------------------------- */
function showSuccess() {
  formPanel.style.display    = 'none';
  invalidPanel.style.display = 'none';
  successPanel.style.display = '';
}

/* ----------------------------------------------------------
   Listen for the PASSWORD_RECOVERY event from Supabase.
   This fires automatically when the user arrives from the
   reset email link — Supabase processes the token from the
   URL hash and establishes a temporary session.
   ---------------------------------------------------------- */
if (!window.supabaseClient) {
  showInvalid();
} else {
  // Handle the auth state change — PASSWORD_RECOVERY means
  // the token was valid and a session is now active
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Token is valid — show the form (already visible by default)
      formPanel.style.display = '';
    }
  });

  // If no recovery event fires within 3 seconds, the link
  // is likely invalid or expired
  const invalidTimer = setTimeout(() => {
    // Check if we have a session from the recovery token
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (!session) showInvalid();
    });
  }, 3000);

  /* ----------------------------------------------------------
     Handle form submission — update the password
     ---------------------------------------------------------- */
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetError.textContent = '';

    const newPassword     = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validate
    if (newPassword.length < 8) {
      resetError.textContent = 'Password must be at least 8 characters.';
      return;
    }

    if (newPassword !== confirmPassword) {
      resetError.textContent = 'Passwords do not match.';
      return;
    }

    // Loading state
    resetBtn.disabled    = true;
    resetBtn.textContent = 'Updating…';

    // Cancel the invalid timer since the user is actively submitting
    clearTimeout(invalidTimer);

    const { error } = await window.supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      resetError.textContent  = 'Failed to update password. Your link may have expired.';
      resetBtn.disabled       = false;
      resetBtn.textContent    = 'Update Password';
      return;
    }

    // Sign out the recovery session so they log in fresh
    await window.supabaseClient.auth.signOut();

    showSuccess();
  });
}
