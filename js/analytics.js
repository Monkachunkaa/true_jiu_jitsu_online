/* ==========================================================
   analytics.js — GA4 event tracking
   True Jiu Jitsu Online

   Loads GA4 and tracks meaningful member interactions.
   Exposes a global trackEvent() function so other scripts
   can fire events without knowing GA4 internals.

   Note: The online platform shares the same GA4 property
   as truebjj.academy — events are differentiated by
   hostname automatically in GA4 reports.

   Replace G-XXXXXXXXXX with the real Measurement ID if a
   separate property is created for the online platform.
   ========================================================== */

const GA_MEASUREMENT_ID = 'G-048VGWFB10';


/* ----------------------------------------------------------
   Load GA4 asynchronously — never blocks page rendering
   ---------------------------------------------------------- */
(function loadGA4() {
  const script  = document.createElement('script');
  script.src    = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async  = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    // Don't send page_view automatically — we'll send it manually
    // so we can include the member's context
    send_page_view: false,
  });
})();


/* ----------------------------------------------------------
   Global trackEvent helper
   Called by player.js, playlist.js, article.js etc.
   ---------------------------------------------------------- */
window.trackEvent = function(eventName, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
};


/* ----------------------------------------------------------
   Track page view — called once per page
   ---------------------------------------------------------- */
window.trackPageView = function(pageName) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_title:    pageName,
    page_location: window.location.href,
  });
};


/* ----------------------------------------------------------
   Auto-detect the current page and fire page_view
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  const pageNames = {
    '/':                        'Landing / Sign In',
    '/pages/catalogue.html':    'Catalogue',
    '/pages/video.html':        'Video Player',
    '/pages/article.html':      'Article Reader',
    '/pages/playlist.html':     'Playlist',
    '/pages/account.html':      'Account',
    '/pages/reset-password.html': 'Password Reset',
  };

  const pageName = pageNames[path] || path;
  window.trackPageView(pageName);
});
