/* ==========================================================
   admin-save-video.js — Save or update a video record
   True Jiu Jitsu Online

   Admin only. Creates or updates a video record in Supabase
   with title, description, category, thumbnail, and
   published status.

   POST { id?, title, description, categoryId, thumbnailUrl,
          cloudflareVideoId, durationSeconds, published }
   ========================================================== */

/* TODO: Phase 4 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
