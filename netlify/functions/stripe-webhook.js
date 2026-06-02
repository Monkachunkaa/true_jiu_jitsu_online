/* ==========================================================
   stripe-webhook.js — Handle Stripe subscription events
   True Jiu Jitsu Online

   Stripe calls this function automatically when subscription
   events occur. It keeps the Supabase members table in sync
   with the real subscription status.

   Handled events:
     checkout.session.completed     → create member record, set active
     customer.subscription.updated  → sync subscription status
     customer.subscription.deleted  → set cancelled
     invoice.payment_failed         → set past_due
     invoice.payment_succeeded      → set active (payment recovery)
   ========================================================== */

const Stripe  = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // service role — can write to any table
);

/* ----------------------------------------------------------
   Helper: build a plain response
   ---------------------------------------------------------- */
function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/* ----------------------------------------------------------
   Helper: map Stripe subscription status to our status values
   ---------------------------------------------------------- */
function mapStatus(stripeStatus) {
  const map = {
    active:             'active',
    trialing:           'active',     // trial counts as active access
    past_due:           'past_due',
    canceled:           'cancelled',
    unpaid:             'past_due',
    incomplete:         'inactive',
    incomplete_expired: 'inactive',
    paused:             'inactive',
  };
  return map[stripeStatus] || 'inactive';
}

/* ----------------------------------------------------------
   HANDLER
   ---------------------------------------------------------- */
exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  // Verify the webhook signature — confirms the request is
  // genuinely from Stripe and not a spoofed request
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return respond(400, { error: 'Invalid signature' });
  }

  const data   = stripeEvent.data.object;
  const type   = stripeEvent.type;

  console.log(`Stripe webhook received: ${type}`);

  try {

    /* --------------------------------------------------------
       checkout.session.completed
       Fires when a new subscriber completes Stripe Checkout.
       Creates the member record in Supabase.
    -------------------------------------------------------- */
    if (type === 'checkout.session.completed') {
      const customerId     = data.customer;
      const subscriptionId = data.subscription;

      // Retrieve the customer to get the auth_user_id we stored in metadata
      const customer = await stripe.customers.retrieve(customerId);
      const authUserId = customer.metadata?.auth_user_id;

      if (!authUserId) {
        console.error('No auth_user_id in customer metadata — cannot create member record');
        return respond(200, { received: true });
      }

      // Retrieve the subscription to get the current status
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Create the member record
      const { error } = await supabase.from('members').upsert({
        auth_user_id:           authUserId,
        email:                  customer.email,
        name:                   customer.name || '',
        stripe_customer_id:     customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status:    mapStatus(subscription.status),
        subscribed_at:          new Date().toISOString(),
      }, {
        onConflict: 'auth_user_id',   // update if already exists
      });

      if (error) {
        console.error('Supabase member upsert error:', error);
        return respond(500, { error: 'Database error' });
      }

      console.log(`Member created/updated for auth_user_id: ${authUserId}`);
    }


    /* --------------------------------------------------------
       customer.subscription.updated
       Fires when subscription status changes — trial ends,
       payment method updated, plan changed, etc.
    -------------------------------------------------------- */
    else if (type === 'customer.subscription.updated') {
      const { error } = await supabase
        .from('members')
        .update({ subscription_status: mapStatus(data.status) })
        .eq('stripe_subscription_id', data.id);

      if (error) console.error('Supabase update error:', error);
    }


    /* --------------------------------------------------------
       customer.subscription.deleted
       Fires when a subscription is fully cancelled.
    -------------------------------------------------------- */
    else if (type === 'customer.subscription.deleted') {
      const { error } = await supabase
        .from('members')
        .update({
          subscription_status: 'cancelled',
          cancelled_at:        new Date().toISOString(),
        })
        .eq('stripe_subscription_id', data.id);

      if (error) console.error('Supabase update error:', error);
    }


    /* --------------------------------------------------------
       invoice.payment_failed
       Fires when a renewal payment fails.
       Sets status to past_due — member loses access.
    -------------------------------------------------------- */
    else if (type === 'invoice.payment_failed') {
      const { error } = await supabase
        .from('members')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', data.customer);

      if (error) console.error('Supabase update error:', error);
    }


    /* --------------------------------------------------------
       invoice.payment_succeeded
       Fires when a payment succeeds — including recovery
       after a failed payment. Restores active status.
    -------------------------------------------------------- */
    else if (type === 'invoice.payment_succeeded') {
      // Only update for subscription invoices, not one-off charges
      if (data.subscription) {
        const { error } = await supabase
          .from('members')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', data.customer);

        if (error) console.error('Supabase update error:', error);
      }
    }

  } catch (err) {
    console.error('Webhook handler error:', err);
    return respond(500, { error: 'Internal error' });
  }

  // Always return 200 to acknowledge receipt —
  // if we return an error Stripe will keep retrying
  return respond(200, { received: true });
};
