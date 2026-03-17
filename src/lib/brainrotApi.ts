import { XMLParser } from 'fast-xml-parser';
import { Article } from '../types';

// ─── Reddit viral subreddits ──────────────────────────────────────────────────

const BRAINROT_SUBS = [
  // Viral/trending general
  'memes', 'funny', 'videos', 'gifs', 'interestingasfuck',
  'nextfuckinglevel', 'oddlysatisfying', 'PublicFreakout',
  'Damnthatsinteresting', 'WTF',
  // TikTok & Instagram mirrors — same content, legally posted by users
  'TikTokCringe', 'reels', 'instantkarma', 'Unexpected',
  'HumansBeingBros', 'MadeMeSmile', 'BeAmazed',
];

// Rotate sort strategy per page so users always get fresh stuff
const SORTS = ['hot', 'top/?t=week', 'top/?t=month', 'new', 'rising'];

const BASE = 'https://www.reddit.com';

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    subreddit: string;
    permalink: string;
    thumbnail: string;
    preview?: { images: Array<{ source: { url: string } }> };
    is_self: boolean;
    is_video: boolean;
    post_hint?: string;
    link_flair_text: string | null;
  };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function fetchSubreddit(sub: string, sort: string, limit = 25): Promise<Article[]> {
  try {
    const url = `${BASE}/r/${sub}/${sort}.json?limit=${limit}&raw_json=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Pulse/1.0 (mobile news reader)' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data: { children: RedditChild[] } };

    return data.data.children
      .map((c) => c.data)
      .filter((p) => p.title && p.author !== 'AutoModerator' && p.score > 100)
      .map((p): Article => {
        let imageUrl: string | undefined;
        if (p.preview?.images[0]?.source?.url) {
          imageUrl = decodeHtmlEntities(p.preview.images[0].source.url);
        } else if (p.thumbnail && p.thumbnail.startsWith('http')) {
          imageUrl = p.thumbnail;
        }

        const isVideo = p.is_video || p.post_hint === 'hosted:video' || p.post_hint === 'rich:video';
        const isImage = p.post_hint === 'image' || (!p.is_self && !isVideo && imageUrl != null);

        const typeLabel = isVideo ? '▶ Video' : isImage ? '🖼 Image' : '💬 Post';

        const summary = p.selftext
          ? p.selftext.replace(/\n+/g, ' ').slice(0, 240).trim()
          : `${typeLabel} · ${p.score.toLocaleString()} upvotes · ${p.num_comments} comments on r/${p.subreddit}`;

        const articleUrl = p.is_self
          ? `https://reddit.com${p.permalink}`
          : p.url;

        return {
          id:           `brainrot-reddit-${p.id}`,
          redditId:     p.id,
          source:       'reddit',
          title:        p.title,
          summary,
          url:          articleUrl,
          author:       `u/${p.author}`,
          tags:         p.link_flair_text ? [p.link_flair_text, p.subreddit] : [p.subreddit],
          category:     'Brainrot',
          publishedAt:  new Date(p.created_utc * 1000).toISOString(),
          imageUrl,
          points:       p.score,
          commentCount: p.num_comments,
        };
      });
  } catch {
    return [];
  }
}

// ─── YouTube Trending RSS ────────────────────────────────────────────────────

const YT_RSS = 'https://www.youtube.com/feeds/videos.xml?chart=mostpopular&hl=en_US&gl=US';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'entry',
});

async function fetchYouTubeTrending(): Promise<Article[]> {
  try {
    const res = await fetch(YT_RSS, {
      headers: { 'User-Agent': 'Pulse/1.0 (mobile news reader)' },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const entries: any[] = parsed?.feed?.entry ?? [];

    return entries.map((entry: any, i: number): Article => {
      const videoId = entry['yt:videoId'] ?? '';
      const title = typeof entry.title === 'object'
        ? entry.title['#text'] ?? ''
        : entry.title ?? '';
      const channelName = entry.author?.name ?? 'YouTube';
      const published = entry.published ?? new Date().toISOString();
      const thumbnail = entry['media:group']?.['media:thumbnail']?.['@_url'] ?? undefined;
      const description = entry['media:group']?.['media:description'] ?? '';
      const viewCount = entry['media:community']?.['media:statistics']?.['@_views'];
      const views = viewCount ? Number(viewCount).toLocaleString() : null;

      const summary = description
        ? String(description).slice(0, 220).trim()
        : views
        ? `▶ YouTube · ${views} views`
        : `▶ Trending on YouTube`;

      return {
        id:          `brainrot-yt-${videoId}-${i}`,
        source:      'rss',
        rssSource:   'YouTube',
        title:       String(title),
        summary,
        url:         `https://www.youtube.com/watch?v=${videoId}`,
        author:      channelName,
        tags:        ['youtube', 'trending'],
        category:    'Brainrot',
        publishedAt: String(published),
        imageUrl:    thumbnail,
      };
    });
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchBrainrotContent(page = 0): Promise<Article[]> {
  const sort = SORTS[page % SORTS.length];

  // Split subs across pages so each load covers different sources
  const CHUNK = 9;
  const offset = (page * CHUNK) % BRAINROT_SUBS.length;
  const group = [
    ...BRAINROT_SUBS.slice(offset, offset + CHUNK),
    ...BRAINROT_SUBS.slice(0, Math.max(0, offset + CHUNK - BRAINROT_SUBS.length)),
  ];

  const subsPromises = group.map((sub) => fetchSubreddit(sub, sort, 30));
  const ytPromise = page === 0 ? fetchYouTubeTrending() : Promise.resolve<Article[]>([]);

  const results = await Promise.allSettled([...subsPromises, ytPromise]);

  const all: Article[] = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => (r as PromiseFulfilledResult<Article[]>).value);

  // Sort by score descending — highest upvotes / most viewed first
  return all.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}
