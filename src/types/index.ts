export type Category = 'All' | 'AI' | 'Dev' | 'Startups' | 'Security' | 'Science' | 'Repos';

export type ApiSource = 'hn' | 'devto' | 'reddit' | 'rss' | 'lobsters' | 'github';

export interface Article {
  id: string;
  source: ApiSource;
  title: string;
  summary: string;
  url: string;
  author: string;
  tags: string[];
  category: Category;
  publishedAt: string;   // ISO string
  imageUrl?: string;
  points?: number;
  commentCount?: number;
  readingTimeMin?: number;
  hnId?: string;
  redditId?: string;
  rssSource?: string;    // publication name e.g. "TechCrunch"
}
