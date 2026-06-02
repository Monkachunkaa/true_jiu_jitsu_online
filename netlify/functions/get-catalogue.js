/* ==========================================================
   get-catalogue.js — Fetch member catalogue data
   True Jiu Jitsu Online

   Returns all published playlists with member progress,
   continue watching items, and categories for filtering.

   GET (member identified via Authorization: Bearer <jwt>)
   Returns {
     playlists: [...],
     continueWatching: [...],
     categories: [...]
   }
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
     1. Verify JWT — confirm the request is from a logged-in member
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  /* ----------------------------------------------------------
     2. Get member record — confirm active subscription
     ---------------------------------------------------------- */
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (memberError || !member) return respond(404, { error: 'Member not found' });
  if (member.subscription_status !== 'active') return respond(403, { error: 'Subscription inactive' });

  const memberId = member.id;

  /* ----------------------------------------------------------
     3. Fetch all published playlists with category info
     ---------------------------------------------------------- */
  const { data: playlists, error: playlistError } = await supabase
    .from('playlists')
    .select(`
      id, title, description, thumbnail_url, display_order,
      categories ( id, name, slug )
    `)
    .eq('published', true)
    .order('display_order');

  if (playlistError) {
    console.error('Playlist fetch error:', playlistError);
    return respond(500, { error: 'Failed to fetch playlists' });
  }

  /* ----------------------------------------------------------
     4. Fetch all playlist items so we know what's in each one
     ---------------------------------------------------------- */
  const playlistIds = playlists.map(p => p.id);

  const { data: playlistItems } = playlistIds.length
    ? await supabase
        .from('playlist_items')
        .select('playlist_id, video_id, article_id, position')
        .in('playlist_id', playlistIds)
        .order('position')
    : { data: [] };

  /* ----------------------------------------------------------
     5. Fetch member's video and article progress
     ---------------------------------------------------------- */
  const { data: videoProgress } = await supabase
    .from('video_progress')
    .select('video_id, completed, seconds_watched, last_watched_at')
    .eq('member_id', memberId);

  const { data: articleProgress } = await supabase
    .from('article_progress')
    .select('article_id, completed')
    .eq('member_id', memberId);

  // Index progress by ID for fast lookup
  const videoProgressMap   = Object.fromEntries((videoProgress   || []).map(p => [p.video_id,   p]));
  const articleProgressMap = Object.fromEntries((articleProgress || []).map(p => [p.article_id, p]));

  /* ----------------------------------------------------------
     6. Calculate per-playlist progress and attach to playlists
     ---------------------------------------------------------- */
  const enrichedPlaylists = playlists.map(playlist => {
    const items = (playlistItems || []).filter(i => i.playlist_id === playlist.id);
    const total = items.length;

    const completed = items.filter(item => {
      if (item.video_id)   return videoProgressMap[item.video_id]?.completed   === true;
      if (item.article_id) return articleProgressMap[item.article_id]?.completed === true;
      return false;
    }).length;

    return {
      ...playlist,
      item_count: total,
      progress: {
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    };
  });

  /* ----------------------------------------------------------
     7. Build "Continue Watching" — recent unfinished videos
     ---------------------------------------------------------- */
  const { data: continueWatchingRaw } = await supabase
    .from('video_progress')
    .select(`
      video_id, seconds_watched, last_watched_at,
      videos ( id, title, thumbnail_url, duration_seconds )
    `)
    .eq('member_id', memberId)
    .eq('completed', false)
    .order('last_watched_at', { ascending: false })
    .limit(6);

  // For each continue watching item, find which playlist it belongs to
  const continueWatching = (continueWatchingRaw || [])
    .filter(item => item.videos)  // skip if video was deleted
    .map(item => {
      const playlistItem = (playlistItems || []).find(pi => pi.video_id === item.video_id);
      const playlist = playlistItem
        ? playlists.find(p => p.id === playlistItem.playlist_id)
        : null;

      return {
        videoId:        item.video_id,
        title:          item.videos.title,
        thumbnailUrl:   item.videos.thumbnail_url,
        durationSecs:   item.videos.duration_seconds,
        secondsWatched: item.seconds_watched,
        lastWatchedAt:  item.last_watched_at,
        playlistId:     playlist?.id    || null,
        playlistTitle:  playlist?.title || null,
      };
    });

  /* ----------------------------------------------------------
     8. Fetch categories that have at least one published playlist
     ---------------------------------------------------------- */
  const usedCategoryIds = [...new Set(
    playlists
      .filter(p => p.categories)
      .map(p => p.categories.id)
  )];

  const { data: categories } = usedCategoryIds.length
    ? await supabase
        .from('categories')
        .select('id, name, slug, display_order')
        .in('id', usedCategoryIds)
        .order('display_order')
    : { data: [] };

  return respond(200, {
    playlists:       enrichedPlaylists,
    continueWatching,
    categories:      categories || [],
  });
};
