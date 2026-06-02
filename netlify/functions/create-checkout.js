/* ==========================================================
   create-checkout.js — Create a Stripe Checkout session
   True Jiu Jitsu Online

   Creates a Stripe Checkout session for the $8.99/mo
   subscription with a 7-day free trial.

   POST { email: string, name: string }
   Returns { checkoutUrl: string }
   ========================================================== */

/* TODO: Phase 1 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
