/* ==========================================================
   admin-auth.js — Admin session guard
   True Jiu Jitsu Online

   Verifies the current user is logged in AND exists in the
   admins table. Redirects to the landing page if either
   check fails. Called at the top of every admin page.

   Also renders the admin sidebar navigation.
   ========================================================== */


/* ----------------------------------------------------------
   Auth guard — call this on every admin page.
   Returns { session, user } if authorized, redirects if not.
   ---------------------------------------------------------- */
async function requireAdmin() {
  if (!window.supabaseClient) {
    window.location.href = '/';
    return null;
  }

  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = '/';
    return null;
  }

  // Check the admins table
  const { data: admin, error } = await window.supabaseClient
    .from('admins')
    .select('id')
    .eq('email', session.user.email)
    .single();

  if (error || !admin) {
    window.location.href = '/';
    return null;
  }

  return { session, user: session.user };
}


/* ----------------------------------------------------------
   Render the admin sidebar and top bar.
   activePage should match one of the nav item data-page values.
   ---------------------------------------------------------- */
function renderAdminShell(activePage = '', pageTitle = '') {
  document.body.classList.add('admin-body');

  // Build the sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';
  sidebar.id        = 'admin-sidebar';

  sidebar.innerHTML = `
    <!-- Logo -->
    <div class="admin-sidebar__logo">
      <img src="/img/true_jiu_jitsu_logo_white.webp" alt="True Jiu Jitsu">
    </div>

    <p class="admin-sidebar__label">Content</p>

    <!-- Navigation -->
    <nav class="admin-nav" aria-label="Admin navigation">
      <a href="/pages/admin/index.html"
         class="admin-nav__item ${activePage === 'dashboard' ? 'admin-nav__item--active' : ''}"
         data-page="dashboard">
        ${iconDashboard()}
        <span>Dashboard</span>
      </a>
      <a href="/pages/admin/videos.html"
         class="admin-nav__item ${activePage === 'videos' ? 'admin-nav__item--active' : ''}"
         data-page="videos">
        ${iconVideo()}
        <span>Videos</span>
      </a>
      <a href="/pages/admin/articles.html"
         class="admin-nav__item ${activePage === 'articles' ? 'admin-nav__item--active' : ''}"
         data-page="articles">
        ${iconArticle()}
        <span>Articles</span>
      </a>
      <a href="/pages/admin/playlists.html"
         class="admin-nav__item ${activePage === 'playlists' ? 'admin-nav__item--active' : ''}"
         data-page="playlists">
        ${iconPlaylist()}
        <span>Playlists</span>
      </a>

      <p class="admin-sidebar__label" style="margin-top:var(--space-lg);">Members</p>

      <a href="/pages/admin/gym-members.html"
         class="admin-nav__item ${activePage === 'members' ? 'admin-nav__item--active' : ''}"
         data-page="members">
        ${iconMembers()}
        <span>Members</span>
      </a>
      <a href="/pages/admin/gym-plans.html"
         class="admin-nav__item ${activePage === 'gym-plans' ? 'admin-nav__item--active' : ''}"
         data-page="gym-plans">
        ${iconPlaylist()}
        <span>Membership Plans</span>
      </a>
      <a href="/pages/admin/analytics.html"
         class="admin-nav__item ${activePage === 'analytics' ? 'admin-nav__item--active' : ''}"
         data-page="analytics">
        ${iconAnalytics()}
        <span>Analytics</span>
      </a>
    </nav>

    <!-- Footer: back to site + sign out -->
    <div class="admin-sidebar__footer">
      <a href="/pages/catalogue.html" class="admin-nav__item" style="margin-bottom:4px;">
        ${iconBack()}
        <span>View Site</span>
      </a>
      <button class="admin-nav__item" id="admin-signout-btn" style="width:100%;background:none;border:none;cursor:pointer;text-align:left;">
        ${iconSignOut()}
        <span>Sign Out</span>
      </button>
    </div>
  `;

  // Build the top bar
  const topbar = document.createElement('div');
  topbar.className = 'admin-topbar';
  topbar.innerHTML = `
    <!-- Mobile hamburger -->
    <button class="admin-topbar__hamburger" id="admin-hamburger" aria-label="Open menu">
      ${iconMenu()}
    </button>
    <h1 class="admin-topbar__title">${pageTitle}</h1>
    <div class="admin-topbar__actions" id="admin-topbar-actions"></div>
  `;

  // Build the main content wrapper
  const main = document.createElement('div');
  main.className = 'admin-main';
  main.id        = 'admin-main';

  const content = document.createElement('div');
  content.className = 'admin-content';
  content.id        = 'admin-content';

  main.appendChild(topbar);
  main.appendChild(content);

  // Mobile overlay
  const overlay = document.createElement('div');
  overlay.className = 'admin-sidebar-overlay';
  overlay.id        = 'admin-sidebar-overlay';

  // Inject everything
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.appendChild(main);
  document.body.appendChild(overlay);

  // Move any existing body children (except sidebar/main/overlay) into content
  // (handles content that was in the HTML before this ran)
  const existingContent = document.getElementById('page-content');
  if (existingContent) content.appendChild(existingContent);

  // Wire up sign out
  document.getElementById('admin-signout-btn').addEventListener('click', async () => {
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    window.location.href = '/';
  });

  // Wire up mobile hamburger
  const hamburger = document.getElementById('admin-hamburger');
  const sidebarEl = document.getElementById('admin-sidebar');
  const overlayEl = document.getElementById('admin-sidebar-overlay');

  function openSidebar() {
    sidebarEl.classList.add('is-open');
    overlayEl.classList.add('is-visible');
  }

  function closeSidebar() {
    sidebarEl.classList.remove('is-open');
    overlayEl.classList.remove('is-visible');
  }

  hamburger?.addEventListener('click', openSidebar);
  overlayEl?.addEventListener('click', closeSidebar);

  return content;
}


/* ----------------------------------------------------------
   Expose the content area so page scripts can populate it.
   ---------------------------------------------------------- */
function getAdminContent() {
  return document.getElementById('admin-content');
}

/* ----------------------------------------------------------
   safeModalClose — only closes a modal when the mousedown
   AND mouseup both land on the overlay itself, not when
   the user clicks inside the modal and drags out.

   Usage: safeModalClose('my-overlay-id', closeFn);
   ---------------------------------------------------------- */
function safeModalClose(overlayId, closeFn) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;

  let mousedownOnOverlay = false;

  overlay.addEventListener('mousedown', (e) => {
    mousedownOnOverlay = e.target === overlay;
  });

  overlay.addEventListener('click', (e) => {
    if (mousedownOnOverlay && e.target === overlay) closeFn();
    mousedownOnOverlay = false;
  });
}

/* ----------------------------------------------------------
   Expose the topbar actions area for page-level buttons.
   ---------------------------------------------------------- */
function getAdminActions() {
  return document.getElementById('admin-topbar-actions');
}


/* ----------------------------------------------------------
   SVG ICONS — inline SVGs for the sidebar nav
   ---------------------------------------------------------- */
function iconDashboard() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
}
function iconVideo() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;
}
function iconArticle() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
}
function iconPlaylist() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polygon points="3,6 3,18 8,12"/></svg>`;
}
function iconMembers() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
}
function iconAnalytics() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
}
function iconBack() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`;
}
function iconSignOut() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
}
function iconMenu() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
}
