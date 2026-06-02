/* ==========================================================
   get-video.js — Fetch video metadata + next playlist item
   True Jiu Jitsu Online

   Returns video metadata and optionally the next item in
   a playlist so the player can show the "Up Next" card.

   GET ?videoId=<uuid>&playlistId=<uuid> (optional playlistId)
   Returns { video, nextItem, playlistTitle }
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

  const { videoId, playlistId } = event.queryStringParameters || {};
  if (!videoId) return respond(400, { error: 'videoId is required' });

  // Fetch the video
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id, title, description, duration_seconds, thumbnail_url, categories(name)')
    .eq('id', videoId)
    .eq('published', true)
    .single();

  if (videoError || !video) return respond(404, { error: 'Video not found' });

  let nextItem      = null;
  let playlistTitle = null;

  /* ----------------------------------------------------------
     If a playlistId was provided, find the next item
     in the playlist after this video.
     ---------------------------------------------------------- */
  if (playlistId) {
    // Get the playlist title
    const { data: playlist } = await supabase
      .from('playlists')
      .select('title')
      .eq('id', playlistId)
      .single();

    playlistTitle = playlist?.title || null;

    // Get all items in the playlist ordered by position
    const { data: items } = await supabase
      .from('playlist_items')
      .select('video_id, article_id, position')
      .eq('playlist_id', playlistId)
      .order('position');

    if (items?.length) {
      // Find the current video's position in the playlist
      const currentIndex = items.findIndex(i => i.video_id === videoId);

      if (currentIndex !== -1 && currentIndex < items.length - 1) {
        const nextPlaylistItem = items[currentIndex + 1];

        // Fetch the next item's details
        if (nextPlaylistItem.video_id) {
          const { data: nextVideo } = await supabase
            .from('videos')
            .select('id, title, thumbnail_url, duration_seconds')
            .eq('id', nextPlaylistItem.video_id)
            .single();

          if (nextVideo) {
            nextItem = {
              type:        'video',
              id:          nextVideo.id,
              title:       nextVideo.title,
              thumbnailUrl: nextVideo.thumbnail_url,
              duration:    nextVideo.duration_seconds,
              href:        `/pages/video.html?id=${nextVideo.id}&playlist=${playlistId}`,
            };
          }
        } else if (nextPlaylistItem.article_id) {
          const { data: nextArticle } = await supabase
            .from('articles')
            .select('id, title, thumbnail_url')
            .eq('id', nextPlaylistItem.article_id)
            .single();

          if (nextArticle) {
            nextItem = {
              type:        'article',
              id:          nextArticle.id,
              title:       nextArticle.title,
              thumbnailUrl: nextArticle.thumbnail_url,
              href:        `/pages/article.html?id=${nextArticle.id}&playlist=${playlistId}`,
            };
          }
        }
      }
    }
  }

  return respond(200, {
    video: {
      id:              video.id,
      title:           video.title,
      description:     video.description,
      durationSeconds: video.duration_seconds,
      thumbnailUrl:    video.thumbnail_url,
      category:        video.categories?.name || '',
    },
    nextItem,
    playlistTitle,
    playlistId: playlistId || null,
  });
};
