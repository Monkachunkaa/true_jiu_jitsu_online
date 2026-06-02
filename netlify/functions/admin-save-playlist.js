/* ==========================================================
   admin-save-playlist.js — Save or update a playlist
   True Jiu Jitsu Online

   Admin only. Creates or updates a playlist record in
   Supabase including its ordered items (videos and/or
   articles).

   POST { id?, title, description, thumbnailUrl, published,
          items: [{ videoId|articleId, position }] }
   ========================================================== */

/* TODO: Phase 4 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
