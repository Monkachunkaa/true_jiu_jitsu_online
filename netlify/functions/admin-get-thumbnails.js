/* ==========================================================
   admin-get-thumbnails.js — Batch signed thumbnail URLs
   True Jiu Jitsu Online

   Admin only. Accepts an array of Cloudflare video IDs and
   returns a map of { cloudflare_video_id: signedThumbnailUrl }
   for any that don't have a custom thumbnail_url set.

   Used by the admin video list to show auto-thumbnails
   without requiring a custom image to be uploaded.

   POST { videoIds: ['cf-uid-1', 'cf-uid-2', ...] }
   Returns { thumbnails: { 'cf-uid-1': 'https://...', ... } }
   ========================================================== */

const { createClient }            = require('@supabase/supabase-js');
const { generateSignedThumbnailUrl } = require('./_cloudflare-signing');

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

  const { videoIds } = body;
  if (!Array.isArray(videoIds) || !videoIds.length) {
    return respond(400, { error: 'videoIds array is required' });
  }

  /* ----------------------------------------------------------
     Generate signed thumbnail URLs for each Cloudflare video ID.
     Tokens are generated server-side using the RSA signing key.
     ---------------------------------------------------------- */
  const thumbnails = {};
  for (const cfVideoId of videoIds) {
    try {
      thumbnails[cfVideoId] = generateSignedThumbnailUrl(cfVideoId);
    } catch (err) {
      // Non-fatal — just omit this video from the map
      console.error('Thumbnail signing failed for', cfVideoId, err.message);
    }
  }

  return respond(200, { thumbnails });
};
