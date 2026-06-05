/* ==========================================================
   admin-create-gym-plan.js — Create a membership plan
   True Jiu Jitsu Online

   Admin only. Creates a Stripe Product + recurring monthly
   Price, then saves the plan to Supabase with the Stripe
   Price ID stored for future checkout sessions.

   POST { name, description, priceCents, includesOnlineAccess }
   Returns { plan }
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

  /* ----------------------------------------------------------
     Verify admin
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  const { data: admin } = await supabase
    .from('admins').select('id').eq('email', user.email).single();
  if (!admin) return respond(403, { error: 'Admin access required' });

  /* ----------------------------------------------------------
     Parse request
     ---------------------------------------------------------- */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { name, description, priceCents, includesOnlineAccess = false } = body;
  if (!name || !priceCents) return respond(400, { error: 'name and priceCents are required' });

  /* ----------------------------------------------------------
     Create Stripe Product + Price
     ---------------------------------------------------------- */
  let stripeProduct, stripePrice;

  try {
    stripeProduct = await stripe.products.create({
      name,
      description: description || undefined,
      metadata: { type: 'gym_membership' },
    });

    stripePrice = await stripe.prices.create({
      product:     stripeProduct.id,
      unit_amount: priceCents,
      currency:    'usd',
      recurring:   { interval: 'month' },
      metadata:    { type: 'gym_membership' },
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return respond(500, { error: 'Failed to create Stripe product/price' });
  }

  /* ----------------------------------------------------------
     Save to Supabase
     ---------------------------------------------------------- */
  const { data: plan, error: dbError } = await supabase
    .from('membership_plans')
    .insert({
      name,
      description:            description || null,
      price_cents:            priceCents,
      stripe_price_id:        stripePrice.id,
      includes_online_access: includesOnlineAccess,
      active:                 true,
    })
    .select()
    .single();

  if (dbError) {
    console.error('DB error:', dbError);
    return respond(500, { error: 'Failed to save plan' });
  }

  return respond(200, { plan });
};
