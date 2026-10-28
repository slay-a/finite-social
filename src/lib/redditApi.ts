import { Article, Category } from '../types';

// Reddit's free .json endpoint — no key needed for public subreddit reads
const BASE = 'https://www.reddit.com';

const CATEGORY_SUBS: Record<Category, string[]> = {
  All:      ['technology', 'programming'],
  AI:       ['MachineLearning', 'artificial', 'ChatGPT'],
  Robotics: ['robotics'],
  Dev:      ['programming', 'webdev'],
  Startups: ['startups', 'YCombinator'],
  Security: ['netsec', 'cybersecurity'],
  Science:  ['science', 'Futurology'],
  Repos:    ['programming', 'coding'],  // not used — useFeed bypasses this
};

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
    preview?: {
      images: Array<{ source: { url: string } }>;
    };
    is_self: boolean;
    link_flair_text: string | null;
  };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function detectCategory(sub: string): Category {
  const s = sub.toLowerCase();
  if (['machinelearning', 'artificial', 'chatgpt'].includes(s))    return 'AI';
  if (['netsec', 'cybersecurity'].includes(s))                     return 'Security';
  if (['startups', 'ycombinator'].includes(s))                     return 'Startups';
  if (['science', 'futurology'].includes(s))                       return 'Science';
  if (['programming', 'webdev'].includes(s))                       return 'Dev';
  return 'All';
}

export async function fetchRedditArticles(
  category: Category,
  page = 0
): Promise<Article[]> {
  const subs = CATEGORY_SUBS[category];
  // Pick sub based on page to rotate through them
  const sub = subs[page % subs.length];
  const url = `${BASE}/r/${sub}/hot.json?limit=20&raw_json=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Pulse/1.0 (mobile news reader)' },
  });
  if (!res.ok) throw new Error(`Reddit API error ${res.status}`);

  const data = (await res.json()) as { data: { children: RedditChild[] } };

  return data.data.children
    .map((c) => c.data)
    .filter((p) => p.title && p.author !== 'AutoModerator' && !p.title.startsWith('['))
    .map((p): Article => {
      // Get best available image
      let imageUrl: string | undefined;
      if (p.preview?.images[0]?.source?.url) {
        imageUrl = decodeHtmlEntities(p.preview.images[0].source.url);
      } else if (p.thumbnail && p.thumbnail.startsWith('http')) {
        imageUrl = p.thumbnail;
      }

      // Build summary from selftext or description
      const summary = p.selftext
        ? p.selftext.replace(/\n+/g, ' ').slice(0, 240).trim()
        : `${p.score.toLocaleString()} upvotes · ${p.num_comments} comments on r/${p.subreddit}`;

      // Link: if it's a reddit-hosted post use reddit URL, otherwise original URL
      const articleUrl = p.is_self
        ? `https://reddit.com${p.permalink}`
        : p.url;

      return {
        id:           `reddit-${p.id}`,
        redditId:     p.id,
        source:       'reddit',
        title:        p.title,
        summary,
        url:          articleUrl,
        author:       `u/${p.author}`,
        tags:         p.link_flair_text ? [p.link_flair_text] : [p.subreddit],
        category:     category === 'All' ? detectCategory(p.subreddit) : category,
        publishedAt:  new Date(p.created_utc * 1000).toISOString(),
        imageUrl,
        points:       p.score,
        commentCount: p.num_comments,
      };
    });
}
