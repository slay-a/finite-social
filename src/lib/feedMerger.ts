import { Article } from '../types';

/**
 * Merge articles from all sources, sort by recency, deduplicate by title.
 * Time-based sort works better than fixed interleaving when 5+ sources are present.
 */
export function mergeFeeds(...sources: Article[][]): Article[] {
  const all = sources.flat();

  // Sort newest first
  all.sort((a, b) => {
    const ta = new Date(a.publishedAt).getTime();
    const tb = new Date(b.publishedAt).getTime();
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });

  // Deduplicate by title (first 50 alphanum chars)
  const seen = new Set<string>();
  return all.filter((a) => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
