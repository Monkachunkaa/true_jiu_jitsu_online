/* ==========================================================
   billing-portal.js — Create a Stripe billing portal session
   True Jiu Jitsu Online

   Redirects authenticated members to the Stripe Customer
   Portal to manage their subscription, update card details,
   view invoices, or cancel.

   POST {} (member identified from JWT)
   Returns { portalUrl }
   ========================================================== */

const Stripe        = require('stripe');
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

  // Verify JWT
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  // Get member's Stripe customer ID
  const { data: member } = await supabase
    .from('members')
    .select('stripe_customer_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!member?.stripe_customer_id) {
    return respond(404, { error: 'No billing account found' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   member.stripe_customer_id,
      return_url: `${process.env.SITE_URL}/pages/account.html`,
    });

    return respond(200, { portalUrl: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    return respond(500, { error: 'Failed to create billing portal session' });
  }
};
