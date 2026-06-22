/* ==========================================================
   admin-delete-waiver.js — Delete a waiver submission
   True Jiu Jitsu Online

   Admin only. Permanently deletes a waiver_submissions row.
   Uses the service role key so it bypasses RLS and always
   has permission to delete regardless of table policies.

   POST { waiverId }
   Returns { success: true }
   ========================================================== */

const { createClient } = require('@supabase/supabase-js');

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
     Verify the caller is an admin
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
     Parse body
     ---------------------------------------------------------- */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { waiverId } = body;
  if (!waiverId) return respond(400, { error: 'waiverId is required' });

  /* ----------------------------------------------------------
     Delete the waiver row.
     Service role key ensures this always has permission.
     ---------------------------------------------------------- */
  const { error } = await supabase
    .from('waiver_submissions')
    .delete()
    .eq('id', waiverId);

  if (error) {
    console.error('Waiver delete error:', error);
    return respond(500, { error: 'Failed to delete waiver' });
  }

  console.log('Waiver deleted:', waiverId);
  return respond(200, { success: true });
};
