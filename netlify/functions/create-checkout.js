/* ==========================================================
   create-checkout.js — Create a Stripe Checkout session
   True Jiu Jitsu Online

   Called by auth.js after a new user creates their account.
   Creates a Stripe Checkout session with a 7-day free trial
   and returns the hosted checkout URL.

   The Supabase auth user ID is stored in Stripe customer
   metadata so the stripe-webhook function can link the
   member record back to their auth account after payment.

   POST { authUserId, email, name }
   Returns { checkoutUrl }
   ========================================================== */

const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* ----------------------------------------------------------
   CORS headers
   ---------------------------------------------------------- */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/* ----------------------------------------------------------
   Helper: build a JSON response
   ---------------------------------------------------------- */
function respond(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/* ----------------------------------------------------------
   HANDLER
   ---------------------------------------------------------- */
exports.handler = async (event) => {

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { authUserId, email, name } = body;

  if (!authUserId || !email) {
    return respond(400, { error: 'authUserId and email are required' });
  }

  try {
    // Create a Stripe customer so we can attach metadata
    // linking back to the Supabase auth user
    const customer = await stripe.customers.create({
      email,
      name:     name || '',
      metadata: {
        auth_user_id: authUserId,   // used by stripe-webhook to create the member record
      },
    });

    // Create the Checkout session
    const session = await stripe.checkout.sessions.create({
      customer:   customer.id,
      mode:       'subscription',
      line_items: [
        {
          price:    process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,   // 7-day free trial before first charge
      },
      // Where to send the member after successful payment
      success_url: `${process.env.SITE_URL}/pages/catalogue.html?checkout=success`,
      // Where to send them if they abandon checkout
      cancel_url:  `${process.env.SITE_URL}/?checkout=cancelled`,
    });

    return respond(200, { checkoutUrl: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return respond(500, { error: 'Failed to create checkout session' });
  }
};
