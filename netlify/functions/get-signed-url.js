/* ==========================================================
   get-signed-url.js — Generate a Cloudflare Stream signed URL
   True Jiu Jitsu Online

   Verifies member auth + active subscription, then returns
   a short-lived signed URL for the requested video.
   Signed URLs expire after 1 hour and cannot be shared.

   POST { videoId: string }
   Returns { signedUrl: string }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
