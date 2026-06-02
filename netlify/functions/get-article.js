/* ==========================================================
   get-article.js — Fetch single article
   True Jiu Jitsu Online

   Verifies member auth + active subscription, then returns
   the full article content from Supabase.

   GET ?articleId=string (member identified from JWT)
   Returns { article: { id, title, bodyHtml, category,
             thumbnail, createdAt } }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
