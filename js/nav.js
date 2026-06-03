/* ==========================================================
   nav.js — Shared member navigation
   True Jiu Jitsu Online

   Renders and injects the nav bar on all member-facing pages.
   Handles sign out via Supabase Auth.

   Include after supabase-client.js on every member page.
   ========================================================== */

/* ----------------------------------------------------------
   Auth guard — redirect to landing if not logged in.
   Every member page calls this to protect its content.
   ---------------------------------------------------------- */
async function requireAuth() {
  if (!window.supabaseClient) {
    window.location.href = '/';
    return null;
  }

  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = '/';
    return null;
  }

  // Also verify their subscription is still active
  const { data: member } = await window.supabaseClient
    .from('members')
    .select('subscription_status, name, email')
    .eq('auth_user_id', session.user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    window.location.href = '/pages/account.html';
    return null;
  }

  return { session, member };
}


/* ----------------------------------------------------------
   Render the nav bar and inject it into the page.
   Call this after requireAuth() confirms the session.
   ---------------------------------------------------------- */
async function renderNav(activePage = '') {
  // Check if current user is an admin to show the admin link
  let isAdmin = false;
  if (window.supabaseClient) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
      const { data: adminRecord } = await window.supabaseClient
        .from('admins')
        .select('id')
        .eq('email', session.user.email)
        .single();
      isAdmin = !!adminRecord;
    }
  }
  const nav = document.createElement('nav');
  nav.className = 'member-nav';
  nav.setAttribute('aria-label', 'Main navigation');

  nav.innerHTML = `
    <div class="member-nav__inner wrapper">

      <!-- Logo — links back to catalogue -->
      <a href="/pages/catalogue.html" class="member-nav__logo" aria-label="True Jiu Jitsu Online — Home">
        <img src="/img/true_jiu_jitsu_logo_white.webp" alt="True Jiu Jitsu">
      </a>

      <!-- Right side links -->
      <div class="member-nav__links">
        ${isAdmin ? `<a href="/pages/admin/index.html" class="member-nav__link member-nav__link--admin">Admin</a>` : ''}
        <a
          href="/pages/account.html"
          class="member-nav__link ${activePage === 'account' ? 'member-nav__link--active' : ''}"
        >My Account</a>
        <button class="btn btn--secondary btn--sm" id="signout-btn">Sign Out</button>
      </div>

    </div>
  `;

  // Insert at the very top of the body
  document.body.insertBefore(nav, document.body.firstChild);

  // Wire up sign out
  document.getElementById('signout-btn').addEventListener('click', async () => {
    if (window.supabaseClient) {
      await window.supabaseClient.auth.signOut();
    }
    window.location.href = '/';
  });
}


/* ----------------------------------------------------------
   Member nav CSS is injected here rather than in a separate
   file so nav.js is truly self-contained and easy to include.
   ---------------------------------------------------------- */
(function injectNavStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .member-nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: var(--nav-height);
      z-index: 1000;
      background: rgba(10, 10, 10, 0.95);
      border-bottom: 1px solid var(--color-mid-gray);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
    }

    .member-nav__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .member-nav__logo img {
      height: 100px;
      width: auto;
    }

    .member-nav__links {
      display: flex;
      align-items: center;
      gap: var(--space-lg);
    }

    .member-nav__link {
      font-family: var(--font-heading);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gray);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .member-nav__link:hover,
    .member-nav__link--active {
      color: var(--color-white);
    }
    .member-nav__link--admin {
      color: var(--color-red-accessible);
    }

    .member-nav__link--admin:hover {
      color: var(--color-white);
    }
  `;
  document.head.appendChild(style);
})();
