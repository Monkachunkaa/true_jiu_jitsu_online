/* ==========================================================
   save-progress.js — Record video watch progress
   True Jiu Jitsu Online

   Called every 30 seconds during playback and on completion.
   Upserts a record in video_progress for the current member.
   Uses Supabase upsert so it creates or updates cleanly.

   POST { videoId, secondsWatched, completed }
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

  // Verify JWT
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  // Get member record
  const { data: member } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    return respond(403, { error: 'Subscription inactive' });
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON' });
  }

  const { videoId, secondsWatched, completed } = body;
  if (!videoId) return respond(400, { error: 'videoId is required' });

  // Upsert progress — creates a new record or updates existing one
  const { error } = await supabase
    .from('video_progress')
    .upsert({
      member_id:       member.id,
      video_id:        videoId,
      seconds_watched: secondsWatched || 0,
      completed:       completed || false,
      last_watched_at: new Date().toISOString(),
    }, {
      onConflict: 'member_id,video_id',
    });

  if (error) {
    console.error('Progress save error:', error);
    return respond(500, { error: 'Failed to save progress' });
  }

  return respond(200, { success: true });
};
