/* ==========================================================
   auth.js — Authentication logic
   True Jiu Jitsu Online

   Handles:
     - Tab switching (Sign In / Create Account)
     - Sign in with Supabase Auth
     - Sign up → Stripe Checkout redirect
     - Forgot password flow
     - Session check on page load (redirect if already logged in)

   Depends on: @supabase/supabase-js loaded via CDN in index.html
   ========================================================== */


/* ----------------------------------------------------------
   1. SUPABASE CLIENT
   The anon key is safe to expose in the browser.
   The service role key is never used client-side.
   ---------------------------------------------------------- */
const SUPABASE_URL      = 'https://rcmherydjpqgmpygwdic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbWhlcnlkanBxZ21weWd3ZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDY3NjgsImV4cCI6MjA5NTk4Mjc2OH0.xY-GvRr-PNtail8ZjI9gW4qWPAkGuRc84Tfo137nFak';

// Initialize Supabase client — wrapped in a try/catch so that if
// the CDN fails to load, tab switching and other UI still works.
let supabase = null;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Supabase failed to initialize:', err);
}


/* ----------------------------------------------------------
   2. DOM REFERENCES
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
   3. TAB SWITCHING
   Set up immediately and independently from Supabase so
   the UI works even if the CDN is slow to respond.
   ---------------------------------------------------------- */
tabBtns.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    // Update tab button states
    tabBtns.forEach(t => {
      t.classList.remove('auth-tab--active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('auth-tab--active');
    tab.setAttribute('aria-selected', 'true');

    // Show the correct panel
    if (target === 'signin') {
      signinPanel.classList.remove('auth-panel--hidden');
      signupPanel.classList.add('auth-panel--hidden');
    } else {
      signupPanel.classList.remove('auth-panel--hidden');
      signinPanel.classList.add('auth-panel--hidden');
    }

    // Clear any lingering error messages
    signinError.textContent = '';
    signupError.textContent = '';
  });
});


/* ----------------------------------------------------------
   4. SESSION CHECK
   If the user is already logged in, redirect them straight
   to the catalogue — no need to see the landing page.
   Only runs if Supabase initialized successfully.
   ---------------------------------------------------------- */
(async function checkSession() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = '/pages/catalogue.html';
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
})();


/* ----------------------------------------------------------
   5. HELPERS
   ---------------------------------------------------------- */

/** Set a button to loading state */
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('btn--loading', loading);
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText;
}

/** Show an error message in the given element */
function showError(el, message) {
  el.textContent = message;
}

/** Map Supabase auth error messages to friendly ones */
function friendlyError(message) {
  if (message.includes('Invalid login credentials'))  return 'Incorrect email or password.';
  if (message.includes('Email not confirmed'))        return 'Please confirm your email before signing in.';
  if (message.includes('User already registered'))    return 'An account with this email already exists. Try signing in.';
  if (message.includes('Password should be'))        return 'Password must be at least 8 characters.';
  return 'Something went wrong. Please try again.';
}


/* ----------------------------------------------------------
   6. SIGN IN
   Authenticates with Supabase, then checks subscription
   status before redirecting to the catalogue.
   ---------------------------------------------------------- */
signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(signinError, '');

  if (!supabase) {
    showError(signinError, 'Authentication unavailable. Please refresh and try again.');
    return;
  }

  setLoading(signinBtn, true);

  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showError(signinError, friendlyError(error.message));
    setLoading(signinBtn, false);
    return;
  }

  // Check subscription status before letting them in
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('subscription_status')
    .eq('auth_user_id', data.user.id)
    .single();

  if (memberError || !member) {
    // User has an auth account but no member record yet —
    // they signed up but never completed checkout
    window.location.href = '/pages/subscribe.html';
    return;
  }

  if (member.subscription_status === 'active') {
    window.location.href = '/pages/catalogue.html';
  } else {
    // Subscription lapsed — send to billing page
    window.location.href = '/pages/account.html';
  }
});


/* ----------------------------------------------------------
   7. SIGN UP
   Creates a Supabase auth account, then redirects to
   Stripe Checkout to complete the subscription.
   The member record in the database is created by the
   stripe-webhook function after payment succeeds.
   ---------------------------------------------------------- */
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(signupError, '');

  if (!supabase) {
    showError(signupError, 'Authentication unavailable. Please refresh and try again.');
    return;
  }

  setLoading(signupBtn, true);

  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  // Create the Supabase auth account
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },  // stored in auth.users metadata
    },
  });

  if (error) {
    showError(signupError, friendlyError(error.message));
    setLoading(signupBtn, false);
    return;
  }

  // Auth account created — now redirect to Stripe Checkout.
  // Pass the Supabase user ID and email so the Netlify function
  // can attach them to the Stripe customer and later the member record.
  const response = await fetch('/.netlify/functions/create-checkout', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authUserId: data.user.id,
      email,
      name,
    }),
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
   8. FORGOT PASSWORD
   Sends a password reset email via Supabase.
   ---------------------------------------------------------- */
forgotLink.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!supabase) return;

  const email = document.getElementById('signin-email').value.trim();

  if (!email) {
    showError(signinError, 'Enter your email address above first.');
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/pages/reset-password.html`,
  });

  if (error) {
    showError(signinError, 'Could not send reset email. Please try again.');
  } else {
    showError(signinError, '');
    // Reuse the error element for a success message
    signinError.style.color = 'var(--color-success)';
    signinError.textContent = 'Check your email for a password reset link.';
  }
});
