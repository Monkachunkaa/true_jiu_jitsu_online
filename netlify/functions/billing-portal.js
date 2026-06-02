/* ==========================================================
   billing-portal.js — Create a Stripe billing portal session
   True Jiu Jitsu Online

   Redirects authenticated members to the Stripe Customer
   Portal to manage their subscription, update card details,
   view invoices, or cancel.

   POST { } (member identified from JWT)
   Returns { portalUrl: string }
   ========================================================== */

/* TODO: Phase 2 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
