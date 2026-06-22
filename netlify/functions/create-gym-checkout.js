/* ==========================================================
   create-gym-checkout.js — Billing setup for gym members
   True Jiu Jitsu Online

   Admin only. Creates a Stripe Checkout session for a gym
   member to securely enter their card details. The gym
   member does not need a platform account — they just click
   the link, enter their card, and billing starts.

   POST { gymMemberId }
   Returns { checkoutUrl }
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
     Load gym member + their plan
     ---------------------------------------------------------- */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { gymMemberId } = body;
  if (!gymMemberId) return respond(400, { error: 'gymMemberId is required' });

  const { data: gymMember, error: memberError } = await supabase
    .from('gym_members')
    .select('*, membership_plans(name, stripe_price_id)')
    .eq('id', gymMemberId)
    .single();

  if (memberError || !gymMember) return respond(404, { error: 'Gym member not found' });

  const plan = gymMember.membership_plans;
  if (!plan?.stripe_price_id) {
    return respond(400, { error: 'Member has no plan with a Stripe price assigned' });
  }

  /* ----------------------------------------------------------
     Get or create the Stripe Customer for this gym member
     ---------------------------------------------------------- */
  let customerId = gymMember.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: gymMember.email || undefined,
      name:  gymMember.name,
      metadata: {
        gym_member_id: gymMemberId,
        type:          'gym_member',
      },
    });
    customerId = customer.id;

    // Save the customer ID
    await supabase
      .from('gym_members')
      .update({ stripe_customer_id: customerId })
      .eq('id', gymMemberId);
  }

  /* ----------------------------------------------------------
     Create the Stripe Checkout session.
     If the member has a discount, create a coupon and apply it.
     ---------------------------------------------------------- */
  const siteUrl = process.env.SITE_URL;

  const sessionParams = {
    customer:      customerId,
    mode:          'subscription',
    line_items: [{
      price:    plan.stripe_price_id,
      quantity: 1,
    }],
    metadata: {
      gym_member_id: gymMemberId,
      type:          'gym_membership',
    },
    subscription_data: {
      metadata: {
        gym_member_id: gymMemberId,
        type:          'gym_membership',
      },
    },
    success_url: 'https://truebjj.academy',
    cancel_url:  `${siteUrl}/pages/admin/gym-members.html?billing=cancelled`,
  };

  // Apply coupon if a discount is set on this member
  if (gymMember.discount_percent && gymMember.discount_percent > 0) {
    const couponParams = {
      percent_off: gymMember.discount_percent,
      duration:    gymMember.discount_months ? 'repeating' : 'forever',
      name:        `${gymMember.discount_percent}% off${gymMember.discount_months ? ` for ${gymMember.discount_months} months` : ''} — ${gymMember.name}`,
    };
    if (gymMember.discount_months) {
      couponParams.duration_in_months = gymMember.discount_months;
    }
    try {
      const coupon = await stripe.coupons.create(couponParams);
      sessionParams.discounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error('Coupon creation error during checkout:', err);
      // Non-fatal — proceed without discount
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return respond(200, { checkoutUrl: session.url });
};
