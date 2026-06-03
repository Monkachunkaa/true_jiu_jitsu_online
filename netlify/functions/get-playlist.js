/* ==========================================================
   get-playlist.js — Fetch playlist with member progress
   True Jiu Jitsu Online

   Returns a playlist with all its ordered items and the
   current member's completion status for each one.

   GET ?playlistId=<uuid> (member identified via Authorization header)
   Returns { playlist, items, progress }
   ========================================================== */

const { createClient } = require('@supabase/supabase-js');

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

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  /* ----------------------------------------------------------
     1. Verify JWT
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  /* ----------------------------------------------------------
     2. Verify active subscription
     ---------------------------------------------------------- */
  const { data: member } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    return respond(403, { error: 'Subscription inactive' });
  }

  /* ----------------------------------------------------------
     3. Get the playlist
     ---------------------------------------------------------- */
  const playlistId = event.queryStringParameters?.playlistId;
  if (!playlistId) return respond(400, { error: 'playlistId is required' });

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id, title, description, thumbnail_url')
    .eq('id', playlistId)
    .eq('published', true)
    .single();

  if (playlistError || !playlist) return respond(404, { error: 'Playlist not found' });

  /* ----------------------------------------------------------
     4. Fetch playlist items in order, with content details
     ---------------------------------------------------------- */
  const { data: rawItems } = await supabase
    .from('playlist_items')
    .select(`
      id, position, video_id, article_id,
      videos   ( id, title, thumbnail_url, duration_seconds ),
      articles ( id, title, thumbnail_url )
    `)
    .eq('playlist_id', playlistId)
    .order('position');

  /* ----------------------------------------------------------
     5. Fetch member progress for all items
     ---------------------------------------------------------- */
  const videoIds   = (rawItems || []).filter(i => i.video_id).map(i => i.video_id);
  const articleIds = (rawItems || []).filter(i => i.article_id).map(i => i.article_id);

  const [{ data: videoProgress }, { data: articleProgress }] = await Promise.all([
    videoIds.length
      ? supabase.from('video_progress').select('video_id, completed, seconds_watched').eq('member_id', member.id).in('video_id', videoIds)
      : { data: [] },
    articleIds.length
      ? supabase.from('article_progress').select('article_id, completed').eq('member_id', member.id).in('article_id', articleIds)
      : { data: [] },
  ]);

  const videoProgressMap   = Object.fromEntries((videoProgress   || []).map(p => [p.video_id,   p]));
  const articleProgressMap = Object.fromEntries((articleProgress || []).map(p => [p.article_id, p]));

  /* ----------------------------------------------------------
     6. Build enriched items array
     ---------------------------------------------------------- */
  const items = (rawItems || []).map(item => {
    const isVideo   = !!item.video_id;
    const content   = isVideo ? item.videos : item.articles;
    const progress  = isVideo
      ? videoProgressMap[item.video_id]
      : articleProgressMap[item.article_id];

    return {
      position:       item.position,
      type:           isVideo ? 'video' : 'article',
      id:             content?.id || null,
      title:          content?.title || 'Untitled',
      thumbnailUrl:   content?.thumbnail_url || null,
      durationSecs:   isVideo ? content?.duration_seconds || null : null,
      completed:      progress?.completed || false,
      secondsWatched: isVideo ? (progress?.seconds_watched || 0) : null,
      href:           isVideo
        ? `/pages/video.html?id=${content?.id}&playlist=${playlistId}`
        : `/pages/article.html?id=${content?.id}&playlist=${playlistId}`,
    };
  });

  /* ----------------------------------------------------------
     7. Calculate overall progress
     ---------------------------------------------------------- */
  const total     = items.length;
  const completed = items.filter(i => i.completed).length;

  // First unwatched item (for the Continue button)
  const nextItem = items.find(i => !i.completed) || items[0];

  return respond(200, {
    playlist,
    items,
    progress: {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    nextItem,
  });
};
