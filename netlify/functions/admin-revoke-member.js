/* ==========================================================
   admin-revoke-member.js — Revoke a member's access
   True Jiu Jitsu Online

   Admin only. Cancels the member's Stripe subscription
   immediately and sets their status to cancelled in Supabase.
   Both happen together so they're always in sync.

   POST { memberId }
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
     Verify JWT + admin role
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) return respond(403, { error: 'Admin access required' });

  /* ----------------------------------------------------------
     Parse request body
     ---------------------------------------------------------- */
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON' });
  }

  const { memberId, gymMemberId } = body;

  /* ----------------------------------------------------------
     Handle gym member cancellation
     ---------------------------------------------------------- */
  if (gymMemberId) {
    const { data: gymMember, error: gymMemberError } = await supabase
      .from('gym_members')
      .select('id, name, email, stripe_subscription_id')
      .eq('id', gymMemberId)
      .single();

    if (gymMemberError || !gymMember) {
      return respond(404, { error: 'Gym member not found' });
    }

    if (gymMember.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(gymMember.stripe_subscription_id);
      } catch (err) {
        if (err.code !== 'resource_missing') {
          console.error('Stripe cancellation error:', err);
          return respond(500, { error: 'Failed to cancel Stripe subscription' });
        }
      }
    }

    const { error: updateError } = await supabase
      .from('gym_members')
      .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', gymMemberId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return respond(500, { error: 'Failed to update gym member status' });
    }

    console.log(`Gym member ${gymMember.email} revoked successfully`);
    return respond(200, { success: true });
  }

  /* ----------------------------------------------------------
     Handle online member cancellation (original logic)
     ---------------------------------------------------------- */
  if (!memberId) return respond(400, { error: 'memberId or gymMemberId is required' });

  /* ----------------------------------------------------------
     Fetch the member record to get their Stripe subscription ID
     ---------------------------------------------------------- */
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, name, email, stripe_subscription_id, subscription_status')
    .eq('id', memberId)
    .single();

  if (memberError || !member) {
    return respond(404, { error: 'Member not found' });
  }

  /* ----------------------------------------------------------
     Cancel the Stripe subscription if one exists.
     cancel_at_period_end: false means cancel immediately,
     not at the end of the billing period.
     ---------------------------------------------------------- */
  if (member.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(member.stripe_subscription_id);
      console.log(`Cancelled Stripe subscription ${member.stripe_subscription_id} for ${member.email}`);
    } catch (err) {
      // If Stripe says it's already cancelled, that's fine — continue
      if (err.code !== 'resource_missing') {
        console.error('Stripe cancellation error:', err);
        return respond(500, { error: 'Failed to cancel Stripe subscription' });
      }
    }
  }

  /* ----------------------------------------------------------
     Update Supabase — mark as cancelled
     ---------------------------------------------------------- */
  const { error: updateError } = await supabase
    .from('members')
    .update({
      subscription_status: 'cancelled',
      cancelled_at:        new Date().toISOString(),
    })
    .eq('id', memberId);

  if (updateError) {
    console.error('Supabase update error:', updateError);
    return respond(500, { error: 'Failed to update member status' });
  }

  console.log(`Member ${member.email} revoked successfully`);
  return respond(200, { success: true });
};
