import { Article, Category } from '../types';
import { detectCategory } from './categoryDetect';

const BASE = 'https://hn.algolia.com/api/v1';

const CATEGORY_QUERIES: Record<Category, string> = {
  All:      `${BASE}/search?tags=front_page&hitsPerPage=20`,
  AI:       `${BASE}/search?tags=story&query=AI+machine+learning+LLM&hitsPerPage=20`,
  Robotics: `${BASE}/search?tags=story&query=robot+robotics+humanoid+drone&hitsPerPage=20`,
  Dev:      `${BASE}/search?tags=story&query=programming+software+engineering&hitsPerPage=20`,
  Startups: `${BASE}/search?tags=story&query=startup+YC+founder+venture&hitsPerPage=20`,
  Security: `${BASE}/search?tags=story&query=security+hacking+vulnerability+breach&hitsPerPage=20`,
  Science:  `${BASE}/search?tags=story&query=science+research+physics+biology&hitsPerPage=20`,
  Repos:    `${BASE}/search?tags=front_page&hitsPerPage=20`,  // not used — useFeed bypasses this
};

interface HNHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  story_text?: string;
  _tags?: string[];
}


export async function fetchHNArticles(category: Category, page = 0): Promise<Article[]> {
  const base = CATEGORY_QUERIES[category];
  const url = `${base}&page=${page}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error ${res.status}`);
  const data = (await res.json()) as { hits: HNHit[] };

  return data.hits
    .filter((h) => (h.title || h.story_title) && (h.url || h.story_text))
    .map((h): Article => {
      const title = (h.title || h.story_title || '').trim();
      const summary = h.story_text
        ? h.story_text.replace(/<[^>]+>/g, '').slice(0, 200).trim()
        : `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`;
      const tags = (h._tags ?? []).filter((t) => !t.startsWith('author_') && !t.startsWith('story_'));

      return {
        id:             `hn-${h.objectID}`,
        hnId:           h.objectID,
        source:         'hn',
        title,
        summary,
        url:            h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        author:         h.author,
        tags,
        category:       category === 'All' ? detectCategory(title, tags) : category,
        publishedAt:    h.created_at,
        points:         h.points,
        commentCount:   h.num_comments,
      };
    });
}
