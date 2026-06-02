/* ==========================================================
   get-catalogue.js — Fetch published content for members
   True Jiu Jitsu Online

   Returns all published videos, articles, and playlists
   with the current member's progress for each item.

   GET (member identified from JWT)
   Returns { videos, articles, playlists, categories }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
