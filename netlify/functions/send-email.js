/* ==========================================================
   send-email.js — Transactional emails via AWS SES
   True Jiu Jitsu Online

   Sends transactional emails triggered by platform events.
   Called internally by other functions, not directly
   by the client.

   Handled email types:
     welcome         → sent on checkout.session.completed
     billing-failed  → sent on invoice.payment_failed
     cancelled       → sent on subscription cancellation

   POST { type: string, member: { name, email } }
   ========================================================== */

/* TODO: Phase 5 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
