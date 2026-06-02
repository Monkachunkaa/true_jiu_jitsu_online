/* ==========================================================
   admin-save-article.js — Save or update an article record
   True Jiu Jitsu Online

   Admin only. Creates or updates an article record in
   Supabase with title, slug, rich text body, category,
   thumbnail, and published status.

   POST { id?, title, slug, bodyHtml, categoryId,
          thumbnailUrl, published }
   ========================================================== */

/* TODO: Phase 4 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
