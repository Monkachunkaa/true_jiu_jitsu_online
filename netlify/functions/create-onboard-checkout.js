/* ==========================================================
   create-onboard-checkout.js — Stripe checkout for new members
   True Jiu Jitsu Online

   Public endpoint — no admin auth required.
   Called after a new member completes the onboarding form.
   Validates the gym member is legitimately new (pending,
   no existing subscription) before creating checkout.

   POST { gymMemberId, planId }
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
  'Access-Control-Allow-Headers': 'Content-Type',
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

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { gymMemberId, planId } = body;
  if (!gymMemberId || !planId) {
    return respond(400, { error: 'gymMemberId and planId are required' });
  }

  /* ----------------------------------------------------------
     Load and validate the gym member —
     must be pending with no existing Stripe subscription
     ---------------------------------------------------------- */
  const { data: member, error: memberError } = await supabase
    .from('gym_members')
    .select('id, name, email, subscription_status, stripe_subscription_id, discount_percent, discount_months')
    .eq('id', gymMemberId)
    .single();

  if (memberError || !member) return respond(404, { error: 'Member not found' });

  if (member.subscription_status !== 'pending') {
    return respond(400, { error: 'Member already has an active or cancelled subscription' });
  }

  if (member.stripe_subscription_id) {
    return respond(400, { error: 'Member already has a Stripe subscription' });
  }

  /* ----------------------------------------------------------
     Load the plan and validate it has a Stripe price
     ---------------------------------------------------------- */
  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .select('id, name, stripe_price_id, price_cents')
    .eq('id', planId)
    .eq('active', true)
    .single();

  if (planError || !plan) return respond(404, { error: 'Plan not found or inactive' });
  if (!plan.stripe_price_id) return respond(400, { error: 'Plan has no Stripe price configured' });

  /* ----------------------------------------------------------
     Get or create Stripe customer
     ---------------------------------------------------------- */
  let { data: memberWithCustomer } = await supabase
    .from('gym_members')
    .select('stripe_customer_id')
    .eq('id', gymMemberId)
    .single();

  let customerId = memberWithCustomer?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    member.email || undefined,
      name:     member.name,
      metadata: { gym_member_id: gymMemberId, type: 'gym_member' },
    });
    customerId = customer.id;

    await supabase
      .from('gym_members')
      .update({ stripe_customer_id: customerId, plan_id: planId })
      .eq('id', gymMemberId);
  }

  /* ----------------------------------------------------------
     Build Stripe Checkout session
     ---------------------------------------------------------- */
  const siteUrl = process.env.SITE_URL || 'https://truejiujitsuonline.netlify.app';

  const sessionParams = {
    customer: customerId,
    mode:     'subscription',
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
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
    success_url: `${siteUrl}/pages/onboard-success.html`,
    cancel_url:  `${siteUrl}/join?billing=cancelled`,
  };

  // Apply discount if one was set during onboarding
  if (member.discount_percent && member.discount_percent > 0) {
    try {
      const couponParams = {
        percent_off: member.discount_percent,
        duration:    member.discount_months ? 'repeating' : 'forever',
        name:        `${member.discount_percent}% off — ${member.name}`,
      };
      if (member.discount_months) couponParams.duration_in_months = member.discount_months;
      const coupon = await stripe.coupons.create(couponParams);
      sessionParams.discounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error('Coupon creation error:', err);
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return respond(200, { checkoutUrl: session.url });
};
