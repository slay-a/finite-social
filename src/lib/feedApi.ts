import { Article, ApiSource, Category } from '../types';
import { getSupabase } from './supabase';

/**
 * DB-backed feed: articles are ingested server-side (ingest-feeds edge
 * function, every 15 min) and read here with keyset pagination.
 */

export interface FeedCursor {
  publishedAt: string;
  id: string;
}

export interface DbFeedPage {
  articles: Article[];
  cursor: FeedCursor | null;
}

interface ArticleRow {
  id: string;
  source_kind: string;
  source_name: string;
  title: string;
  raw_summary: string | null;
  ai_title: string | null;
  ai_summary: string | null;
  url: string;
  author: string | null;
  tags: string[] | null;
  category: Category;
  published_at: string;
  points: number | null;
  comment_count: number | null;
  image_url: string | null;
  external_id: string;
  ai_event_date: string | null;
}

const PAGE_SIZE = 20;

function rowToArticle(row: ArticleRow): Article {
  const source = (['hn', 'devto', 'reddit', 'rss', 'lobsters', 'github'].includes(row.source_kind)
    ? row.source_kind
    : 'rss') as ApiSource;

  return {
    id: row.id,
    source,
    title: row.ai_title ?? row.title,
    summary: row.ai_summary ?? row.raw_summary ?? row.title,
    url: row.url,
    author: row.author ?? row.source_name,
    tags: row.tags ?? [],
    category: row.category,
    publishedAt: row.published_at,
    eventDate: row.ai_event_date ?? undefined,
    imageUrl: row.image_url ?? undefined,
    points: row.points ?? undefined,
    commentCount: row.comment_count ?? undefined,
    hnId: source === 'hn' ? row.external_id : undefined,
    redditId: source === 'reddit' ? row.external_id : undefined,
    rssSource: source === 'rss' ? row.source_name : undefined,
  };
}

export async function fetchDbArticles(
  category: Category,
  cursor: FeedCursor | null,
): Promise<DbFeedPage> {
  let query = getSupabase()
    .from('articles')
    .select(
      'id, source_kind, source_name, title, raw_summary, ai_title, ai_summary, url, author, tags, category, published_at, points, comment_count, image_url, external_id, ai_event_date',
    )
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (category !== 'All') {
    query = query.eq('category', category);
  } else {
    // Repos live only in their own tab.
    query = query.neq('source_kind', 'github');
  }
  if (cursor) {
    // Keyset pagination, tie-safe: older timestamp, or same timestamp with a
    // smaller id (matches the published_at desc, id desc ordering).
    query = query.or(
      `published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ArticleRow[];
  const last = rows[rows.length - 1];
  return {
    articles: rows.map(rowToArticle),
    cursor: last ? { publishedAt: last.published_at, id: last.id } : null,
  };
}
