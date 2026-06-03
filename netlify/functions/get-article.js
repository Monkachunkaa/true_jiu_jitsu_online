/* ==========================================================
   get-article.js — Fetch a single article
   True Jiu Jitsu Online

   Verifies member auth + active subscription, returns the
   full article content and next playlist item if applicable.

   GET ?articleId=<uuid>&playlistId=<uuid> (playlistId optional)
   Returns { article, nextItem, playlistTitle }
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

  // Verify subscription
  const { data: member } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    return respond(403, { error: 'Subscription inactive' });
  }

  const { articleId, playlistId } = event.queryStringParameters || {};
  if (!articleId) return respond(400, { error: 'articleId is required' });

  // Fetch article
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('id, title, body_html, thumbnail_url, created_at, categories(name)')
    .eq('id', articleId)
    .eq('published', true)
    .single();

  if (articleError || !article) return respond(404, { error: 'Article not found' });

  // Fetch member's read progress for this article
  const { data: progress } = await supabase
    .from('article_progress')
    .select('completed')
    .eq('member_id', member.id)
    .eq('article_id', articleId)
    .single();

  let nextItem      = null;
  let playlistTitle = null;

  // Find next item in playlist if applicable
  if (playlistId) {
    const { data: playlist } = await supabase
      .from('playlists').select('title').eq('id', playlistId).single();
    playlistTitle = playlist?.title || null;

    const { data: items } = await supabase
      .from('playlist_items')
      .select('video_id, article_id, position')
      .eq('playlist_id', playlistId)
      .order('position');

    if (items?.length) {
      const currentIndex = items.findIndex(i => i.article_id === articleId);
      if (currentIndex !== -1 && currentIndex < items.length - 1) {
        const next = items[currentIndex + 1];
        if (next.video_id) {
          const { data: nextVideo } = await supabase
            .from('videos').select('id, title, thumbnail_url, duration_seconds')
            .eq('id', next.video_id).single();
          if (nextVideo) nextItem = {
            type: 'video', id: nextVideo.id, title: nextVideo.title,
            thumbnailUrl: nextVideo.thumbnail_url, duration: nextVideo.duration_seconds,
            href: `/pages/video.html?id=${nextVideo.id}&playlist=${playlistId}`,
          };
        } else if (next.article_id) {
          const { data: nextArticle } = await supabase
            .from('articles').select('id, title, thumbnail_url')
            .eq('id', next.article_id).single();
          if (nextArticle) nextItem = {
            type: 'article', id: nextArticle.id, title: nextArticle.title,
            thumbnailUrl: nextArticle.thumbnail_url,
            href: `/pages/article.html?id=${nextArticle.id}&playlist=${playlistId}`,
          };
        }
      }
    }
  }

  return respond(200, {
    article: {
      id:           article.id,
      title:        article.title,
      bodyHtml:     article.body_html || '',
      thumbnailUrl: article.thumbnail_url,
      category:     article.categories?.name || '',
      createdAt:    article.created_at,
    },
    progress: progress || { completed: false },
    nextItem,
    playlistTitle,
    playlistId: playlistId || null,
  });
};
