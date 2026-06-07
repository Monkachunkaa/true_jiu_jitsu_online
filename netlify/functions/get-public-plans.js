/* ==========================================================
   get-public-plans.js — Return active membership plans
   True Jiu Jitsu Online

   Public endpoint — no auth required.
   Used by the onboarding flow to let new members choose
   their membership plan before billing setup.

   GET
   Returns { plans: [...] }
   ========================================================== */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const { data: plans, error } = await supabase
    .from('membership_plans')
    .select('id, name, description, price_cents, includes_online_access')
    .eq('active', true)
    .order('display_order');

  if (error) {
    console.error('Plans fetch error:', error);
    return respond(500, { error: 'Failed to load plans' });
  }

  return respond(200, { plans: plans || [] });
};
