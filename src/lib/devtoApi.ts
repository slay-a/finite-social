import { Article, Category } from '../types';

const BASE = 'https://dev.to/api/articles';

const CATEGORY_PARAMS: Record<Category, string> = {
  All:      `${BASE}?top=7&per_page=20`,
  AI:       `${BASE}?tag=ai&per_page=20`,
  Robotics: `${BASE}?tag=robotics&per_page=20`,
  Dev:      `${BASE}?tag=webdev&per_page=20`,
  Startups: `${BASE}?tag=startup&per_page=20`,
  Security: `${BASE}?tag=security&per_page=20`,
  Science:  `${BASE}?tag=science&per_page=20`,
  Repos:    `${BASE}?top=7&per_page=20`,  // not used — useFeed bypasses this
};

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  canonical_url: string;
  tag_list: string[];
  published_at: string;
  reading_time_minutes: number;
  positive_reactions_count: number;
  comments_count: number;
  cover_image: string | null;
  social_image: string | null;
  user: { name: string; username: string };
}

export async function fetchDevToArticles(category: Category, page = 1): Promise<Article[]> {
  const base = CATEGORY_PARAMS[category];
  const url = `${base}&page=${page}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dev.to API error ${res.status}`);
  const data = (await res.json()) as DevToArticle[];

  return data
    .filter((a) => a.title && a.description)
    .map((a): Article => ({
      id:             `devto-${a.id}`,
      source:         'devto',
      title:          a.title,
      summary:        a.description,
      url:            a.canonical_url || a.url,
      author:         a.user.name || a.user.username,
      tags:           a.tag_list ?? [],
      category,
      publishedAt:    a.published_at,
      imageUrl:       a.cover_image ?? a.social_image ?? undefined,
      points:         a.positive_reactions_count,
      commentCount:   a.comments_count,
      readingTimeMin: a.reading_time_minutes,
    }));
}
