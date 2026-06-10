/* ==========================================================
   create-checkout.js — Create a Stripe Checkout session
   True Jiu Jitsu Online

   Called by auth.js after a new user creates their account.
   Creates a Stripe Checkout session with a 7-day free trial
   and returns the hosted checkout URL.

   Fixes applied vs original:
     1. authUserId is extracted from the verified JWT token —
        never trusted from the request body.
     2. Before creating a Stripe customer, we search for an
        existing one with the same auth_user_id in metadata.
        If found, it is reused — preventing duplicate customers
        when a user abandons checkout and tries again.
     3. stripe_customer_id is saved to the members table
        immediately (with status 'inactive') so the customer
        can always be found on subsequent attempts.

   POST (requires Authorization: Bearer <jwt>)
   Body: { name? }
   Returns { checkoutUrl }
   ========================================================== */

const Stripe           = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  /* ----------------------------------------------------------
     Verify the JWT from the Authorization header.
     authUserId comes from the verified token — never from
     the request body — so it cannot be spoofed.
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  const authUserId = user.id;
  const email      = user.email;

  // Name can optionally be passed in the body
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const name = body.name || user.user_metadata?.full_name || '';

  /* ----------------------------------------------------------
     Look for an existing Stripe customer with this authUserId
     in metadata before creating a new one. This prevents
     duplicate customer records when checkout is abandoned.
     ---------------------------------------------------------- */
  let customerId;

  try {
    const existing = await stripe.customers.search({
      query: `metadata['auth_user_id']:'${authUserId}'`,
      limit: 1,
    });

    if (existing.data.length > 0) {
      // Reuse the existing customer
      customerId = existing.data[0].id;
      console.log(`Reusing existing Stripe customer ${customerId} for ${email}`);
    } else {
      // Create a new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { auth_user_id: authUserId },
      });
      customerId = customer.id;
      console.log(`Created new Stripe customer ${customerId} for ${email}`);
    }
  } catch (err) {
    console.error('Stripe customer error:', err);
    return respond(500, { error: 'Failed to create or find Stripe customer' });
  }

  /* ----------------------------------------------------------
     Save the stripe_customer_id to the members table now —
     before checkout completes. This means a second attempt
     can always find the right customer record.
     The webhook will update the rest of the fields (status,
     subscription_id etc.) when checkout completes.
     ---------------------------------------------------------- */
  const { error: upsertError } = await supabase
    .from('members')
    .upsert({
      auth_user_id:       authUserId,
      email,
      name,
      stripe_customer_id: customerId,
      subscription_status: 'inactive',
    }, { onConflict: 'auth_user_id' });

  if (upsertError) {
    // Non-fatal — log it but don't block checkout
    console.error('Members upsert error:', upsertError);
  }

  /* ----------------------------------------------------------
     Create the Checkout session using the customer we just
     found or created.
     ---------------------------------------------------------- */
  try {
    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{
        price:    process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `${process.env.SITE_URL}/pages/catalogue.html?checkout=success`,
      cancel_url:  `${process.env.SITE_URL}/?checkout=cancelled`,
    });

    return respond(200, { checkoutUrl: session.url });

  } catch (err) {
    console.error('Stripe checkout session error:', err);
    return respond(500, { error: 'Failed to create checkout session' });
  }
};
