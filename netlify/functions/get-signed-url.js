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
const { generateSignedPlaybackUrl, generateSignedThumbnailUrl } = require('./_cloudflare-signing');

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
      id, title, description, cloudflare_video_id, duration_seconds, thumbnail_url,
      video_tags ( tags ( id, name, slug ) )
    `)
    .eq('id', videoId)
    .eq('published', true)
    .single();

  if (videoError || !video) {
    return respond(404, { error: 'Video not found' });
  }

  /* ----------------------------------------------------------
     If duration is missing, fetch it from Cloudflare and
     save it to Supabase for future requests.
     ---------------------------------------------------------- */
  let durationSeconds = video.duration_seconds;

  if (!durationSeconds) {
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/${video.cloudflare_video_id}`,
        { headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } }
      );
      const cfData = await cfRes.json();
      const fetchedDuration = cfData?.result?.duration;

      if (fetchedDuration && fetchedDuration > 0) {
        durationSeconds = Math.round(fetchedDuration);

        // Save it so we don't need to fetch again
        await supabase
          .from('videos')
          .update({ duration_seconds: durationSeconds })
          .eq('id', videoId);
      }
    } catch (err) {
      // Non-fatal — duration just stays null for now
      console.error('Cloudflare duration fetch failed:', err);
    }
  }

  // Generate signed URLs for playback and thumbnail
  let signedUrl;
  let signedThumbnailUrl;
  try {
    signedUrl          = generateSignedPlaybackUrl(video.cloudflare_video_id);
    // Only generate a signed thumbnail if no custom one was uploaded
    signedThumbnailUrl = video.thumbnail_url
      ? null
      : generateSignedThumbnailUrl(video.cloudflare_video_id);
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
      durationSeconds: durationSeconds,
      // Custom thumbnail takes precedence; fall back to signed Cloudflare thumbnail
      thumbnailUrl:    video.thumbnail_url || signedThumbnailUrl,
      tags:            (video.video_tags || []).map(t => t.tags).filter(Boolean),
    },
    progress: progress || { seconds_watched: 0, completed: false },
  });
};
