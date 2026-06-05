/* ==========================================================
   admin-apply-gym-discount.js — Apply or remove a discount
   True Jiu Jitsu Online

   Admin only. Creates a Stripe Coupon and applies it to
   an existing gym member's subscription, or removes the
   current discount if percent is 0.

   POST { gymMemberId, discountPercent, discountMonths }
     discountPercent: 1-100 to apply, 0 to remove
     discountMonths:  number for a timed discount, null for indefinite
   Returns { success: true }
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

  const { gymMemberId, discountPercent, discountMonths } = body;
  if (!gymMemberId) return respond(400, { error: 'gymMemberId is required' });

  /* ----------------------------------------------------------
     Load gym member
     ---------------------------------------------------------- */
  const { data: gymMember, error: memberError } = await supabase
    .from('gym_members')
    .select('id, name, stripe_subscription_id, stripe_customer_id')
    .eq('id', gymMemberId)
    .single();

  if (memberError || !gymMember) return respond(404, { error: 'Gym member not found' });

  /* ----------------------------------------------------------
     Remove discount case — discountPercent is 0 or not set
     ---------------------------------------------------------- */
  if (!discountPercent || discountPercent <= 0) {
    // Remove from Stripe subscription if one exists
    if (gymMember.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(gymMember.stripe_subscription_id, {
          discounts: [],
        });
      } catch (err) {
        console.error('Stripe discount removal error:', err);
        return respond(500, { error: 'Failed to remove discount from Stripe' });
      }
    }

    // Clear from Supabase
    await supabase
      .from('gym_members')
      .update({ discount_percent: null, discount_months: null })
      .eq('id', gymMemberId);

    return respond(200, { success: true, action: 'removed' });
  }

  /* ----------------------------------------------------------
     Apply discount case
     Build Stripe Coupon params based on duration setting
     ---------------------------------------------------------- */
  const couponParams = {
    percent_off: discountPercent,
    duration:    discountMonths ? 'repeating' : 'forever',
    name:        `${discountPercent}% off${discountMonths ? ` for ${discountMonths} months` : ''} — ${gymMember.name}`,
  };

  if (discountMonths) {
    couponParams.duration_in_months = discountMonths;
  }

  let coupon;
  try {
    coupon = await stripe.coupons.create(couponParams);
  } catch (err) {
    console.error('Stripe coupon creation error:', err);
    return respond(500, { error: 'Failed to create Stripe coupon' });
  }

  /* ----------------------------------------------------------
     Apply the coupon to the existing Stripe subscription
     ---------------------------------------------------------- */
  if (gymMember.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(gymMember.stripe_subscription_id, {
        discounts: [{ coupon: coupon.id }],
      });
    } catch (err) {
      console.error('Stripe discount application error:', err);
      return respond(500, { error: 'Failed to apply discount to subscription' });
    }
  }
  // Note: if no subscription yet, the coupon will be applied
  // during checkout in create-gym-checkout.js

  /* ----------------------------------------------------------
     Save discount to Supabase
     ---------------------------------------------------------- */
  const { error: dbError } = await supabase
    .from('gym_members')
    .update({
      discount_percent: discountPercent,
      discount_months:  discountMonths || null,
    })
    .eq('id', gymMemberId);

  if (dbError) {
    console.error('Supabase discount update error:', dbError);
    return respond(500, { error: 'Discount applied in Stripe but failed to save to database' });
  }

  console.log(`Applied ${discountPercent}% discount to ${gymMember.name}`);
  return respond(200, { success: true, action: 'applied', couponId: coupon.id });
};
