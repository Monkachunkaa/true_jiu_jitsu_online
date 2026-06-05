/* ==========================================================
   search-catalogue.js — Search videos and articles
   True Jiu Jitsu Online

   Searches published videos and articles by:
     - Title (partial match)
     - Description (partial match)
     - Tags (exact match by tag ID)

   Returns individual content items with their tags,
   category, and playlist membership so the catalogue
   can show "from: Playlist Name" labels.

   GET ?q=<search term>&tags=<tag-slug>,<tag-slug>
   Returns { results: [...], total: number }
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
     Verify JWT + active subscription
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  const { data: member } = await supabase
    .from('members')
    .select('id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!member || member.subscription_status !== 'active') {
    return respond(403, { error: 'Subscription inactive' });
  }

  /* ----------------------------------------------------------
     Parse query params
     ---------------------------------------------------------- */
  const params   = event.queryStringParameters || {};
  const query    = (params.q || '').trim();
  const tagSlugs = params.tags
    ? params.tags.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Need at least a search term or a tag
  if (!query && !tagSlugs.length) {
    return respond(200, { results: [], total: 0 });
  }

  /* ----------------------------------------------------------
     Resolve tag slugs to IDs
     ---------------------------------------------------------- */
  let tagIds = [];
  if (tagSlugs.length) {
    const { data: tagRows } = await supabase
      .from('tags')
      .select('id')
      .in('slug', tagSlugs);
    tagIds = (tagRows || []).map(t => t.id);
  }

  /* ----------------------------------------------------------
     Fetch matching videos
     ---------------------------------------------------------- */
  let videoQuery = supabase
    .from('videos')
    .select(`
      id, title, description, thumbnail_url, duration_seconds, created_at,
      video_tags ( tag_id, tags ( name, slug, category ) )
    `)
    .eq('published', true);

  // Title / description search
  if (query) {
    videoQuery = videoQuery.or(
      `title.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data: videos } = await videoQuery.order('created_at', { ascending: false });

  /* ----------------------------------------------------------
     Fetch matching articles
     ---------------------------------------------------------- */
  let articleQuery = supabase
    .from('articles')
    .select(`
      id, title, thumbnail_url, created_at,
      article_tags ( tag_id, tags ( name, slug, category ) )
    `)
    .eq('published', true);

  if (query) {
    articleQuery = articleQuery.ilike('title', `%${query}%`);
  }

  const { data: articles } = await articleQuery.order('created_at', { ascending: false });

  /* ----------------------------------------------------------
     Filter by tags in JS (Supabase doesn't support filtering
     by junction table values directly in this query shape)
     ---------------------------------------------------------- */
  function hasAllTags(itemTags, requiredTagIds) {
    if (!requiredTagIds.length) return true;
    const itemTagIds = itemTags.map(t => t.tag_id);
    return requiredTagIds.every(id => itemTagIds.includes(id));
  }

  const filteredVideos   = (videos   || []).filter(v => hasAllTags(v.video_tags   || [], tagIds));
  const filteredArticles = (articles || []).filter(a => hasAllTags(a.article_tags || [], tagIds));

  /* ----------------------------------------------------------
     Find playlist membership for each result
     ---------------------------------------------------------- */
  const allVideoIds   = filteredVideos.map(v => v.id);
  const allArticleIds = filteredArticles.map(a => a.id);

  const { data: playlistItems } = await supabase
    .from('playlist_items')
    .select('video_id, article_id, playlist_id, playlists(title)')
    .or(
      [
        allVideoIds.length   ? `video_id.in.(${allVideoIds.join(',')})` : null,
        allArticleIds.length ? `article_id.in.(${allArticleIds.join(',')})` : null,
      ].filter(Boolean).join(',')
    );

  // Build lookup maps
  const videoPlaylistMap   = {};
  const articlePlaylistMap = {};
  (playlistItems || []).forEach(item => {
    if (item.video_id && !videoPlaylistMap[item.video_id]) {
      videoPlaylistMap[item.video_id] = {
        id:    item.playlist_id,
        title: item.playlists?.title || null,
      };
    }
    if (item.article_id && !articlePlaylistMap[item.article_id]) {
      articlePlaylistMap[item.article_id] = {
        id:    item.playlist_id,
        title: item.playlists?.title || null,
      };
    }
  });

  /* ----------------------------------------------------------
     Shape the results into a unified format
     ---------------------------------------------------------- */
  const videoResults = filteredVideos.map(v => ({
    type:          'video',
    id:            v.id,
    title:         v.title,
    description:   v.description || '',
    thumbnailUrl:  v.thumbnail_url || null,
    durationSecs:  v.duration_seconds || null,
    tags:          (v.video_tags || []).map(t => t.tags).filter(Boolean),
    playlist:      videoPlaylistMap[v.id] || null,
    href:          videoPlaylistMap[v.id]
      ? `/pages/video.html?id=${v.id}&playlist=${videoPlaylistMap[v.id].id}`
      : `/pages/video.html?id=${v.id}`,
  }));

  const articleResults = filteredArticles.map(a => ({
    type:         'article',
    id:           a.id,
    title:        a.title,
    description:  '',
    thumbnailUrl: a.thumbnail_url || null,
    durationSecs: null,
    tags:         (a.article_tags || []).map(t => t.tags).filter(Boolean),
    playlist:     articlePlaylistMap[a.id] || null,
    href:         articlePlaylistMap[a.id]
      ? `/pages/article.html?id=${a.id}&playlist=${articlePlaylistMap[a.id].id}`
      : `/pages/article.html?id=${a.id}`,
  }));

  // Interleave videos and articles, videos first
  const results = [...videoResults, ...articleResults];

  return respond(200, { results, total: results.length });
};
