/* ==========================================================
   stripe-webhook.js — Handle Stripe subscription events
   True Jiu Jitsu Online

   Handles events for two subscription types:
     1. Online video subscriptions (members table)
     2. Gym in-person memberships (gym_members table)

   Type is determined by metadata.type on the Stripe
   subscription — 'gym_membership' vs default (online).

   Handled events:
     checkout.session.completed     → create member record
     customer.subscription.updated  → sync status
     customer.subscription.deleted  → set cancelled
     invoice.payment_failed         → set past_due
     invoice.payment_succeeded      → restore active
   ========================================================== */

const Stripe           = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail }    = require('./send-email');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function mapStatus(stripeStatus) {
  const map = {
    active:             'active',
    trialing:           'active',
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
   Determine if a subscription belongs to a gym member.
   Checks subscription metadata for type: 'gym_membership'.
   ---------------------------------------------------------- */
async function isGymMembership(subscriptionId) {
  if (!subscriptionId) return false;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.metadata?.type === 'gym_membership';
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------
   Handle gym member checkout completion
   ---------------------------------------------------------- */
async function handleGymMemberCheckout(data) {
  const gymMemberId = data.metadata?.gym_member_id;
  if (!gymMemberId) {
    console.error('No gym_member_id in checkout metadata');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(data.subscription);

  const { error } = await supabase
    .from('gym_members')
    .update({
      stripe_subscription_id: data.subscription,
      subscription_status:    mapStatus(subscription.status),
    })
    .eq('id', gymMemberId);

  if (error) {
    console.error('Gym member update error:', error);
    return;
  }

  // Fetch member details for welcome email
  const { data: member } = await supabase
    .from('gym_members')
    .select('name, email')
    .eq('id', gymMemberId)
    .single();

  if (member?.email) {
    try {
      await sendEmail({ to: member.email, name: member.name || '', type: 'gym-welcome' });
    } catch (err) {
      console.error('Gym welcome email error:', err);
    }
  }

  console.log(`Gym member ${gymMemberId} billing activated`);
}

/* ----------------------------------------------------------
   Handle online member checkout completion
   ---------------------------------------------------------- */
async function handleOnlineMemberCheckout(data) {
  const customerId     = data.customer;
  const subscriptionId = data.subscription;

  const customer = await stripe.customers.retrieve(customerId);
  const authUserId = customer.metadata?.auth_user_id;

  if (!authUserId) {
    console.error('No auth_user_id in customer metadata');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const { error } = await supabase.from('members').upsert({
    auth_user_id:           authUserId,
    email:                  customer.email,
    name:                   customer.name || '',
    stripe_customer_id:     customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status:    mapStatus(subscription.status),
    subscribed_at:          new Date().toISOString(),
  }, { onConflict: 'auth_user_id' });

  if (error) {
    console.error('Member upsert error:', error);
    return;
  }

  try {
    await sendEmail({ to: customer.email, name: customer.name || '', type: 'welcome' });
  } catch (err) {
    console.error('Welcome email error:', err);
  }

  console.log(`Online member created for auth_user_id: ${authUserId}`);
}


/* ----------------------------------------------------------
   HANDLER
   ---------------------------------------------------------- */
exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return respond(400, { error: 'Invalid signature' });
  }

  const data = stripeEvent.data.object;
  const type = stripeEvent.type;
  console.log(`Stripe webhook: ${type}`);

  try {

    /* --------------------------------------------------------
       checkout.session.completed
       Route to gym or online handler based on metadata.
    -------------------------------------------------------- */
    if (type === 'checkout.session.completed') {
      if (data.metadata?.type === 'gym_membership') {
        await handleGymMemberCheckout(data);
      } else {
        await handleOnlineMemberCheckout(data);
      }
    }


    /* --------------------------------------------------------
       customer.subscription.updated
       Check metadata to route to correct table.
    -------------------------------------------------------- */
    else if (type === 'customer.subscription.updated') {
      if (data.metadata?.type === 'gym_membership' && data.metadata?.gym_member_id) {
        await supabase
          .from('gym_members')
          .update({ subscription_status: mapStatus(data.status) })
          .eq('id', data.metadata.gym_member_id);
      } else {
        await supabase
          .from('members')
          .update({ subscription_status: mapStatus(data.status) })
          .eq('stripe_subscription_id', data.id);
      }
    }


    /* --------------------------------------------------------
       customer.subscription.deleted
    -------------------------------------------------------- */
    else if (type === 'customer.subscription.deleted') {
      if (data.metadata?.type === 'gym_membership' && data.metadata?.gym_member_id) {
        // Gym member cancellation
        const { data: gymMember } = await supabase
          .from('gym_members')
          .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', data.metadata.gym_member_id)
          .select('name, email')
          .single();

        if (gymMember?.email) {
          try {
            await sendEmail({ to: gymMember.email, name: gymMember.name || '', type: 'gym-cancelled' });
          } catch (err) { console.error('Gym cancellation email error:', err); }
        }
      } else {
        // Online member cancellation
        const { data: member } = await supabase
          .from('members')
          .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', data.id)
          .select('name, email')
          .single();

        if (member?.email) {
          try {
            await sendEmail({ to: member.email, name: member.name || '', type: 'cancelled' });
          } catch (err) { console.error('Cancellation email error:', err); }
        }
      }
    }


    /* --------------------------------------------------------
       invoice.payment_failed
       Check customer metadata to find the right table.
    -------------------------------------------------------- */
    else if (type === 'invoice.payment_failed') {
      // Check if this is a gym member by looking up the subscription
      const isGym = data.subscription
        ? await isGymMembership(data.subscription)
        : false;

      if (isGym) {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        const gymMemberId = sub.metadata?.gym_member_id;
        if (gymMemberId) {
          const { data: gymMember } = await supabase
            .from('gym_members')
            .update({ subscription_status: 'past_due' })
            .eq('id', gymMemberId)
            .select('name, email')
            .single();

          if (gymMember?.email) {
            try {
              await sendEmail({ to: gymMember.email, name: gymMember.name || '', type: 'gym-payment-failed' });
            } catch (err) { console.error('Gym payment failed email error:', err); }
          }
        }
      } else {
        const { data: member } = await supabase
          .from('members')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', data.customer)
          .select('name, email')
          .single();

        if (member?.email) {
          try {
            await sendEmail({ to: member.email, name: member.name || '', type: 'payment-failed' });
          } catch (err) { console.error('Payment failed email error:', err); }
        }
      }
    }


    /* --------------------------------------------------------
       invoice.payment_succeeded
       Restore active status on payment recovery.
    -------------------------------------------------------- */
    else if (type === 'invoice.payment_succeeded') {
      if (!data.subscription) return respond(200, { received: true });

      const isGym = await isGymMembership(data.subscription);

      if (isGym) {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        if (sub.metadata?.gym_member_id) {
          await supabase
            .from('gym_members')
            .update({ subscription_status: 'active' })
            .eq('id', sub.metadata.gym_member_id);
        }
      } else {
        await supabase
          .from('members')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', data.customer);
      }
    }

  } catch (err) {
    console.error('Webhook handler error:', err);
    return respond(500, { error: 'Internal error' });
  }

  return respond(200, { received: true });
};
