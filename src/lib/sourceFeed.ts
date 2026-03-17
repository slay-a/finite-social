import { Article } from '../types';
import { fetchHNArticles } from './hnApi';
import { fetchRedditArticles } from './redditApi';
import { fetchDevToArticles } from './devtoApi';
import { fetchLobstersArticles } from './lobstersApi';
import { fetchSingleSourceArticles } from './rssApi';

type FetchFn = () => Promise<Article[]>;

const SOURCE_FETCHERS: Record<string, FetchFn> = {
  'Hacker News':     () => fetchHNArticles('All'),
  'Reddit':          () => fetchRedditArticles('All'),
  'DEV Community':   () => fetchDevToArticles('All'),
  'Lobsters':        () => fetchLobstersArticles('All'),
  'TechCrunch':      () => fetchSingleSourceArticles('TechCrunch'),
  'The Verge':       () => fetchSingleSourceArticles('The Verge'),
  'Wired':           () => fetchSingleSourceArticles('Wired'),
  'Ars Technica':    () => fetchSingleSourceArticles('Ars Technica'),
  'MIT Tech Review': () => fetchSingleSourceArticles('MIT Tech Review'),
  'Product Hunt':    () => fetchSingleSourceArticles('Product Hunt'),
  'VentureBeat':     () => fetchSingleSourceArticles('VentureBeat'),
  'The Register':    () => fetchSingleSourceArticles('The Register'),
  'ZDNet':           () => fetchSingleSourceArticles('ZDNet'),
  'InfoQ':           () => fetchSingleSourceArticles('InfoQ'),
};

export function canFetchSource(name: string): boolean {
  return name in SOURCE_FETCHERS;
}

export async function fetchArticlesBySource(name: string): Promise<Article[]> {
  const fn = SOURCE_FETCHERS[name];
  if (!fn) return [];
  try {
    return await fn();
  } catch {
    return [];
  }
}
