import { Article, Category } from '../types';
import { detectCategory } from './categoryDetect';

interface LobstersStory {
  short_id: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  created_at: string;
  description: string;
  submitter_user: { username: string };
  tags: string[];
}

const CATEGORY_QUERIES: Record<Category, string> = {
  All:      'https://lobste.rs/hottest.json',
  AI:       'https://lobste.rs/t/ai.json',
  Robotics: 'https://lobste.rs/t/hardware.json',
  Dev:      'https://lobste.rs/t/programming.json',
  Startups: 'https://lobste.rs/hottest.json',
  Security: 'https://lobste.rs/t/security.json',
  Science:  'https://lobste.rs/t/science.json',
  Repos:    'https://lobste.rs/hottest.json',  // not used — useFeed bypasses this
};

export async function fetchLobstersArticles(category: Category, page = 0): Promise<Article[]> {
  try {
    const baseUrl = CATEGORY_QUERIES[category];
    const url = page > 0 ? `${baseUrl}?page=${page + 1}` : baseUrl;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Pulse/1.0 (mobile news reader)' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as LobstersStory[];

    return data
      .filter((s) => s.url && s.title)
      .map((s): Article => {
        const tags = s.tags ?? [];
        return {
          id:           `lobsters-${s.short_id}`,
          source:       'lobsters',
          title:        s.title,
          summary:      s.description
            ? s.description.replace(/<[^>]+>/g, '').slice(0, 220).trim()
            : `${s.score} points · ${s.comment_count} comments on Lobsters`,
          url:          s.url || `https://lobste.rs/s/${s.short_id}`,
          author:       s.submitter_user.username,
          tags,
          category:     category === 'All' ? detectCategory(s.title, tags) : category,
          publishedAt:  s.created_at,
          points:       s.score,
          commentCount: s.comment_count,
        };
      });
  } catch {
    return [];
  }
}
