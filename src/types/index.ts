export type Category = 'All' | 'AI' | 'Robotics' | 'Dev' | 'Startups' | 'Security' | 'Science' | 'Repos';

export type ApiSource = 'hn' | 'devto' | 'reddit' | 'rss' | 'lobsters' | 'github';

// ─── Books (textbook → scrollable feed) ──────────────────────────────────────

export type BookStatus = 'uploaded' | 'parsing' | 'outlined' | 'failed';
export type CardStatus = 'none' | 'generating' | 'ready' | 'failed';

export interface Book {
  id: string;
  title: string;
  author: string | null;
  fileType: 'pdf';
  pageCount: number | null;
  status: BookStatus;
  parseProgress: number;
  parseError: string | null;
  createdAt: string;
}

export interface BookSection {
  id: string;
  bookId: string;
  parentId: string | null;
  depth: number;
  orderIndex: number;
  label: string | null;
  title: string;
  pageStart: number;
  pageEnd: number;
  cardStatus: CardStatus;
}

export interface SectionCardData {
  id: string;
  sectionId: string;
  orderIndex: number;
  title: string;
  body: string;
}

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
