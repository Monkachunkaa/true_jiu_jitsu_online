/* ==========================================================
   stripe-webhook.js — Handle Stripe subscription events
   True Jiu Jitsu Online

   Listens for Stripe webhook events and keeps the Supabase
   members table in sync with subscription status.

   Handled events:
     checkout.session.completed     → create member, set active
     customer.subscription.updated  → update status
     customer.subscription.deleted  → set cancelled
     invoice.payment_failed         → set past_due
     invoice.payment_succeeded      → set active (recovery)
   ========================================================== */

/* TODO: Phase 1 */
exports.handler = async () => ({
  statusCode: 501,
  body: JSON.stringify({ error: 'Not implemented yet' }),
});
