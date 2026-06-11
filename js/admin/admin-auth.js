/* ==========================================================
   admin-auth.js — Admin session guard
   True Jiu Jitsu Online

   Verifies the current user is logged in AND exists in the
   admins table. Redirects to the landing page if either
   check fails. Called at the top of every admin page.

   Also renders the admin sidebar navigation.
   ========================================================== */


/* ----------------------------------------------------------
   SHARED CONSTANTS
   Defined once here so there's a single place to update them.
   ---------------------------------------------------------- */

// Monthly price for an online video subscription, in cents.
// Used in dashboard MRR and analytics calculations.
const ONLINE_SUBSCRIPTION_PRICE_CENTS = 899;


/* ----------------------------------------------------------
   showToast — display a brief status notification.

   message  — string to display
   type     — 'success' (default) | 'error'

   Defined here because admin-auth.js is loaded on every admin
   page, making showToast available everywhere without duplication.
   ---------------------------------------------------------- */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container           = document.createElement('div');
    container.id        = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast       = document.createElement('div');
  toast.className   = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), type === 'success' ? 3500 : 5000);
}


/* ----------------------------------------------------------
   formatDate — format an ISO date string for display.

   iso          — ISO 8601 date string
   includeTime  — if true, appends hour:minute (for waivers)
   ---------------------------------------------------------- */
function formatDate(iso, includeTime = false) {
  if (!iso) return '\u2014'; // em dash
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  if (includeTime) {
    opts.hour   = 'numeric';
    opts.minute = '2-digit';
  }
  return new Date(iso).toLocaleDateString('en-US', opts);
}


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

    <!-- Navigation -->
    <nav class="admin-nav" aria-label="Admin navigation">

      <a href="/pages/admin/index.html"
         class="admin-nav__item ${activePage === 'dashboard' ? 'admin-nav__item--active' : ''}"
         data-page="dashboard">
        ${iconDashboard()}
        <span>Home</span>
      </a>

      <p class="admin-sidebar__label" style="margin-top:var(--space-lg);">Members</p>

      <a href="/pages/admin/leads.html"
         class="admin-nav__item ${activePage === 'leads' ? 'admin-nav__item--active' : ''}"
         data-page="leads">
        ${iconLeads()}
        <span>Leads</span>
      </a>

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
      <a href="/pages/admin/waivers.html"
         class="admin-nav__item ${activePage === 'waivers' ? 'admin-nav__item--active' : ''}"
         data-page="waivers">
        ${iconWaivers()}
        <span>Waivers</span>
      </a>
      <a href="/pages/admin/announcements.html"
         class="admin-nav__item ${activePage === 'announcements' ? 'admin-nav__item--active' : ''}"
         data-page="announcements">
        ${iconAnnouncement()}
        <span>Announcements</span>
      </a>

      <p class="admin-sidebar__label" style="margin-top:var(--space-lg);">Content</p>

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
      <a href="/pages/admin/analytics.html"
         class="admin-nav__item ${activePage === 'analytics' ? 'admin-nav__item--active' : ''}"
         data-page="analytics">
        ${iconAnalytics()}
        <span>Analytics</span>
      </a>

      <p class="admin-sidebar__label" style="margin-top:var(--space-lg);">Help</p>

      <a href="/pages/admin/manual.html"
         class="admin-nav__item ${activePage === 'manual' ? 'admin-nav__item--active' : ''}"
         data-page="manual">
        ${iconManual()}
        <span>Admin Manual</span>
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

  // Close sidebar when a nav link is tapped on mobile
  sidebarEl.querySelectorAll('.admin-nav__item').forEach(link => {
    link.addEventListener('click', closeSidebar);
  });

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
   confirmAction — inline, theme-consistent alternative to
   the native browser confirm() dialog.

   Hides the trigger button and inserts a "prompt + Yes/No"
   row next to it. On No, the confirm row is removed and the
   original button is shown again — with its event listeners
   still intact because we never replaced it in the DOM.

   Usage:
     confirmAction(buttonEl, 'Cancel membership?', async () => {
       await doTheDangerousThing();
     });
   ---------------------------------------------------------- */
function confirmAction(triggerBtn, promptText, onConfirm) {
  // Prevent double-triggering while the confirm row is visible
  if (triggerBtn.dataset.confirming === 'true') return;
  triggerBtn.dataset.confirming = 'true';

  // Hide the original button rather than removing it,
  // so its event listeners survive the cancel path.
  triggerBtn.style.display = 'none';

  // Build the confirmation row and insert it after the trigger
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;';
  wrap.innerHTML = `
    <span style="font-size:var(--text-xs);color:var(--color-light-gray);">${promptText}</span>
    <button class="btn btn--danger btn--sm" data-confirm-yes style="padding:3px 10px;">Yes</button>
    <button class="btn btn--ghost btn--sm"  data-confirm-no  style="padding:3px 10px;">No</button>
  `;
  triggerBtn.insertAdjacentElement('afterend', wrap);

  // Restore: remove the confirm row, unhide the original button
  function restore() {
    wrap.remove();
    triggerBtn.style.display = '';
    delete triggerBtn.dataset.confirming;
  }

  wrap.querySelector('[data-confirm-yes]').addEventListener('click', async () => {
    wrap.innerHTML = '<span style="font-size:var(--text-xs);color:var(--color-gray);">Working…</span>';
    await onConfirm();
    // onConfirm usually re-renders the table, removing both elements.
    // If the confirm row is still in the DOM (e.g. an error occurred), clean up.
    if (wrap.isConnected) restore();
  });

  wrap.querySelector('[data-confirm-no]').addEventListener('click', restore);
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
function iconLeads() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
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
function iconWaivers() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`;
}
function iconAnnouncement() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>`;
}
function iconMenu() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
}
function iconManual() {
  return `<svg class="admin-nav__icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`;
}
