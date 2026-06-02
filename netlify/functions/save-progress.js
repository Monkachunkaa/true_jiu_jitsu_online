/* ==========================================================
   save-progress.js — Record video watch progress
   True Jiu Jitsu Online

   Called every 30 seconds during playback and on completion.
   Upserts a record in video_progress for the current member.

   POST { videoId: string, secondsWatched: number, completed: boolean }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
