/* ==========================================================
   get-video.js — Fetch single video metadata
   True Jiu Jitsu Online

   Verifies member auth + active subscription, then returns
   video metadata from Supabase for the requested video ID.

   GET ?videoId=string (member identified from JWT)
   Returns { video: { id, title, description, category,
             duration, cloudflareVideoId, thumbnail } }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
