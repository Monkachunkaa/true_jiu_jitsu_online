/* ==========================================================
   auth.js — Authentication logic
   True Jiu Jitsu Online

   Handles:
     - Tab switching (Sign In / Create Account)
     - Sign in with Supabase Auth
     - Sign up → Stripe Checkout redirect
     - Forgot password flow
     - Session check on page load (redirect if already logged in)

   Depends on: supabase-client.js loaded before this script.
   ========================================================== */


/* ----------------------------------------------------------
   1. DOM REFERENCES
   ---------------------------------------------------------- */
const tabBtns     = document.querySelectorAll('.auth-tab');
const signinPanel = document.getElementById('panel-signin');
const signupPanel = document.getElementById('panel-signup');
const signinForm  = document.getElementById('signin-form');
const signupForm  = document.getElementById('signup-form');
const signinError = document.getElementById('signin-error');
const signupError = document.getElementById('signup-error');
const signinBtn   = document.getElementById('signin-btn');
const signupBtn   = document.getElementById('signup-btn');
const forgotLink  = document.getElementById('forgot-password-link');


/* ----------------------------------------------------------
   2. TAB SWITCHING
   Set up immediately so the UI works regardless of whether
   Supabase initialized successfully.
   ---------------------------------------------------------- */
tabBtns.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabBtns.forEach(t => {
      t.classList.remove('auth-tab--active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('auth-tab--active');
    tab.setAttribute('aria-selected', 'true');

    if (target === 'signin') {
      signinPanel.classList.remove('auth-panel--hidden');
      signupPanel.classList.add('auth-panel--hidden');
    } else {
      signupPanel.classList.remove('auth-panel--hidden');
      signinPanel.classList.add('auth-panel--hidden');
    }

    signinError.textContent = '';
    signupError.textContent = '';
  });
});


/* ----------------------------------------------------------
   3. SESSION CHECK
   If the user is already logged in, skip the landing page
   and send them straight to the catalogue.
   ---------------------------------------------------------- */
(async function checkSession() {
  if (!window.supabaseClient) return;
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
      window.location.href = '/pages/catalogue.html';
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
})();


/* ----------------------------------------------------------
   4. HELPERS
   ---------------------------------------------------------- */

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('btn--loading', loading);
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText;
}

function showError(el, message) {
  el.textContent = message;
}

function friendlyError(message) {
  if (message.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (message.includes('Email not confirmed'))        return 'Please confirm your email before signing in.';
  if (message.includes('User already registered'))    return 'An account with this email already exists. Try signing in.';
  if (message.includes('Password should be'))        return 'Password must be at least 8 characters.';
  return 'Something went wrong. Please try again.';
}


/* ----------------------------------------------------------
   5. SIGN IN
   ---------------------------------------------------------- */
signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(signinError, '');

  if (!window.supabaseClient) {
    showError(signinError, 'Authentication unavailable. Please refresh and try again.');
    return;
  }

  setLoading(signinBtn, true);

  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showError(signinError, friendlyError(error.message));
    setLoading(signinBtn, false);
    return;
  }

  // Check subscription status before granting access
  const { data: member, error: memberError } = await window.supabaseClient
    .from('members')
    .select('subscription_status')
    .eq('auth_user_id', data.user.id)
    .single();

  if (memberError || !member) {
    // Auth account exists but checkout was never completed
    window.location.href = '/pages/subscribe.html';
    return;
  }

  if (member.subscription_status === 'active') {
    window.location.href = '/pages/catalogue.html';
  } else {
    window.location.href = '/pages/account.html';
  }
});


/* ----------------------------------------------------------
   6. SIGN UP
   Creates a Supabase auth account then redirects to
   Stripe Checkout. The member record is created by the
   stripe-webhook function after payment succeeds.
   ---------------------------------------------------------- */
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(signupError, '');

  if (!window.supabaseClient) {
    showError(signupError, 'Authentication unavailable. Please refresh and try again.');
    return;
  }

  setLoading(signupBtn, true);

  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  const { data, error } = await window.supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    showError(signupError, friendlyError(error.message));
    setLoading(signupBtn, false);
    return;
  }

  const response = await fetch('/.netlify/functions/create-checkout', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId: data.user.id, email, name }),
  });

  const result = await response.json();

  if (result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
  } else {
    showError(signupError, 'Could not start checkout. Please try again.');
    setLoading(signupBtn, false);
  }
});


/* ----------------------------------------------------------
   7. FORGOT PASSWORD
   ---------------------------------------------------------- */
forgotLink.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!window.supabaseClient) return;

  const email = document.getElementById('signin-email').value.trim();

  if (!email) {
    showError(signinError, 'Enter your email address above first.');
    return;
  }

  const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/pages/reset-password.html`,
  });

  if (error) {
    showError(signinError, 'Could not send reset email. Please try again.');
  } else {
    signinError.style.color = 'var(--color-success)';
    signinError.textContent = 'Check your email for a password reset link.';
  }
});
