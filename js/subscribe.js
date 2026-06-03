/* ==========================================================
   subscribe.js — Complete subscription page
   True Jiu Jitsu Online

   Shown when a member has created an auth account but
   hasn't completed Stripe checkout yet. Lets them restart
   the checkout flow without creating a new account.
   ========================================================== */

(async function init() {

  if (!window.supabaseClient) {
    window.location.href = '/';
    return;
  }

  /* ----------------------------------------------------------
     Verify there's a logged-in session
     ---------------------------------------------------------- */
  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (!session) {
    // Not logged in — send to landing page
    window.location.href = '/';
    return;
  }

  /* ----------------------------------------------------------
     If they already have an active member record, send them
     straight to the catalogue — they don't need to be here
     ---------------------------------------------------------- */
  const { data: member } = await window.supabaseClient
    .from('members')
    .select('subscription_status')
    .eq('auth_user_id', session.user.id)
    .single();

  if (member?.subscription_status === 'active') {
    window.location.href = '/pages/catalogue.html';
    return;
  }

  /* ----------------------------------------------------------
     Show the user's email so they know which account this is
     ---------------------------------------------------------- */
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = session.user.email;

  /* ----------------------------------------------------------
     Sign out link — lets them start fresh with a different email
     ---------------------------------------------------------- */
  document.getElementById('signout-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await window.supabaseClient.auth.signOut();
    window.location.href = '/';
  });

  /* ----------------------------------------------------------
     Subscribe button — restart the Stripe Checkout session
     ---------------------------------------------------------- */
  const btn = document.getElementById('subscribe-btn');
  const err = document.getElementById('subscribe-error');

  btn?.addEventListener('click', async () => {
    btn.disabled    = true;
    btn.textContent = 'Loading…';
    err.textContent = '';

    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId: session.user.id,
          email:      session.user.email,
          name:       session.user.user_metadata?.full_name || '',
        }),
      });

      const result = await response.json();

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      console.error('Checkout error:', e);
      err.textContent  = 'Could not start checkout. Please try again.';
      btn.disabled     = false;
      btn.textContent  = 'Complete Subscription';
    }
  });

})();
