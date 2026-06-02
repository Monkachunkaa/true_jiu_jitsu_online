/* ==========================================================
   get-signed-url.js — Generate a Cloudflare Stream signed URL
   True Jiu Jitsu Online

   Verifies member auth + active subscription, then returns
   a short-lived signed URL for the requested video.
   Signed URLs expire after 1 hour and cannot be shared
   or hotlinked — they're bound to this session.

   GET ?videoId=<uuid> (member identified via Authorization header)
   Returns { signedUrl, video: { title, description, duration } }
   ========================================================== */

const { createClient } = require('@supabase/supabase-js');
const crypto           = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

/* ----------------------------------------------------------
   Generate a Cloudflare Stream signed URL.

   Cloudflare expects a JWT signed with the RSA private key.
   The token payload includes the video ID and expiry time.
   ---------------------------------------------------------- */
function generateSignedUrl(cloudflareVideoId) {
  const keyId       = process.env.CLOUDFLARE_STREAM_KEY_ID;
  const pemBase64   = process.env.CLOUDFLARE_STREAM_SIGNING_KEY;

  // The PEM is stored as base64 in the env var
  const pem = Buffer.from(pemBase64, 'base64').toString('utf8');

  // Token expires in 1 hour
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  // Build the JWT header and payload
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: cloudflareVideoId,
    kid: keyId,
    exp: expiresAt,
    accessRules: [{ type: 'any', action: 'allow' }],
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  // Sign with the RSA private key
  const sign      = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(pem, 'base64url');

  const token = `${signingInput}.${signature}`;

  // Return the signed iframe embed URL
  return `https://iframe.cloudflarestream.com/${token}`;
}

/* ----------------------------------------------------------
   HANDLER
   ---------------------------------------------------------- */
exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // Verify JWT
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  // Verify active subscription
  const { data: member } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    return respond(403, { error: 'Subscription inactive' });
  }

  // Get the video ID from query params
  const videoId = event.queryStringParameters?.videoId;
  if (!videoId) return respond(400, { error: 'videoId is required' });

  // Fetch video metadata from Supabase
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select(`
      id, title, description, cloudflare_video_id,
      duration_seconds, thumbnail_url,
      categories ( name, slug )
    `)
    .eq('id', videoId)
    .eq('published', true)
    .single();

  if (videoError || !video) {
    return respond(404, { error: 'Video not found' });
  }

  // Generate the signed URL
  let signedUrl;
  try {
    signedUrl = generateSignedUrl(video.cloudflare_video_id);
  } catch (err) {
    console.error('Signed URL generation failed:', err);
    return respond(500, { error: 'Failed to generate video URL' });
  }

  // Fetch member progress for this video
  const { data: progress } = await supabase
    .from('video_progress')
    .select('seconds_watched, completed')
    .eq('member_id', member.id)
    .eq('video_id', videoId)
    .single();

  return respond(200, {
    signedUrl,
    video: {
      id:              video.id,
      title:           video.title,
      description:     video.description,
      durationSeconds: video.duration_seconds,
      thumbnailUrl:    video.thumbnail_url,
      category:        video.categories?.name || '',
    },
    progress: progress || { seconds_watched: 0, completed: false },
  });
};
