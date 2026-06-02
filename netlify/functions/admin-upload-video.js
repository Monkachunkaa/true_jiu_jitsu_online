/* ==========================================================
   admin-upload-video.js — Get a Cloudflare direct upload URL
   True Jiu Jitsu Online

   Admin only. Requests a one-time direct upload URL from
   Cloudflare Stream. The browser uploads the video file
   directly to Cloudflare, bypassing Netlify's size limits.

   POST { } (admin role required)
   Returns { uploadUrl: string, videoId: string }
   ========================================================== */

/* TODO: Phase 4 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
