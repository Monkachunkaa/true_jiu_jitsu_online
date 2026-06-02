/* ==========================================================
   get-playlist.js — Fetch playlist with member progress
   True Jiu Jitsu Online

   Verifies member auth + active subscription, then returns
   a playlist with all its items and the current member's
   completion status for each one.

   GET ?playlistId=string (member identified from JWT)
   Returns { playlist: { id, title, description, thumbnail,
             items: [{ ...video|article, completed }] } }
   ========================================================== */

/* TODO: Phase 3 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
