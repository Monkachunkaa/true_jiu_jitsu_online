/* ==========================================================
   admin-upload-video.js — Get a Cloudflare direct upload URL
   True Jiu Jitsu Online

   Admin only. Requests a one-time direct upload URL from
   Cloudflare Stream. The browser then uploads the video
   file directly to Cloudflare — bypassing Netlify's
   10MB function size limit entirely.

   POST { fileName }
   Returns { uploadUrl, videoId }
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

  // Verify JWT
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  // Verify admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) return respond(403, { error: 'Admin access required' });

  // Request a direct upload URL from Cloudflare Stream
  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 21600,   // 6 hours max
        requireSignedURLs:  true,    // enforce signed URL delivery
      }),
    }
  );

  if (!cfResponse.ok) {
    const err = await cfResponse.text();
    console.error('Cloudflare direct upload error:', err);
    return respond(500, { error: 'Failed to get upload URL from Cloudflare' });
  }

  const cfData = await cfResponse.json();

  return respond(200, {
    uploadUrl: cfData.result.uploadURL,
    videoId:   cfData.result.uid,
  });
};
