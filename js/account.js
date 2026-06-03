/* ==========================================================
   account.js — Member account page
   True Jiu Jitsu Online

   Shows the member's name, email, subscription status,
   and renewal date. Handles the Stripe billing portal
   redirect for managing payment details.
   ========================================================== */

(async function init() {

  // Auth guard — but don't redirect if inactive, this is
  // where past-due members land to fix their billing
  if (!window.supabaseClient) {
    window.location.href = '/';
    return;
  }

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  // Render nav (pass 'account' as active page)
  renderNav('account');

  const accessToken = session.access_token;

  // Fetch member record
  const { data: member } = await window.supabaseClient
    .from('members')
    .select('name, email, subscription_status, subscribed_at, stripe_customer_id')
    .eq('auth_user_id', session.user.id)
    .single();

  // Hide spinner, show content
  document.getElementById('account-loading').style.display = 'none';
  document.getElementById('account-body').style.display    = '';

  if (!member) {
    // No member record — they signed up but never completed checkout
    window.location.href = '/?checkout=incomplete';
    return;
  }

  /* ----------------------------------------------------------
     Populate sidebar
     ---------------------------------------------------------- */
  const name  = member.name  || session.user.email.split('@')[0];
  const email = member.email || session.user.email;

  // Avatar initials
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('account-avatar').textContent = initials;

  document.getElementById('account-name').textContent  = name;
  document.getElementById('account-email').textContent = email;

  // Status badge
  const statusMap = {
    active:    { label: 'Active',    cls: 'badge--active'    },
    past_due:  { label: 'Past Due',  cls: 'badge--past-due'  },
    cancelled: { label: 'Cancelled', cls: 'badge--cancelled' },
    inactive:  { label: 'Inactive',  cls: 'badge--cancelled' },
  };
  const status = statusMap[member.subscription_status] || statusMap.inactive;
  document.getElementById('account-status-badge').innerHTML =
    `<span class="badge ${status.cls}">${status.label}</span>`;

  // Subscribed since
  if (member.subscribed_at) {
    const renewalBlock = document.getElementById('account-renewal-block');
    const renewalEl    = document.getElementById('account-renewal');
    renewalBlock.style.display = '';
    renewalEl.textContent = new Date(member.subscribed_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  /* ----------------------------------------------------------
     Show past due warning if applicable
     ---------------------------------------------------------- */
  if (member.subscription_status === 'past_due') {
    document.getElementById('account-warning').style.display = '';
    document.getElementById('account-normal').style.display  = 'none';

    document.getElementById('billing-btn-warning')?.addEventListener('click', () => {
      openBillingPortal(accessToken);
    });
  }

  /* ----------------------------------------------------------
     Billing portal button
     ---------------------------------------------------------- */
  document.getElementById('billing-btn')?.addEventListener('click', () => {
    openBillingPortal(accessToken);
  });

  async function openBillingPortal(token) {
    const btn = document.getElementById('billing-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    try {
      const response = await fetch('/.netlify/functions/billing-portal', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const { portalUrl, error } = await response.json();

      if (portalUrl) {
        window.location.href = portalUrl;
      } else {
        console.error('Billing portal error:', error);
        if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
        alert('Could not open billing portal. Please try again.');
      }
    } catch (err) {
      console.error('Billing portal fetch error:', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
    }
  }

})();
