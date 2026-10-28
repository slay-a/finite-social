export type Category = 'All' | 'AI' | 'Robotics' | 'Dev' | 'Startups' | 'Security' | 'Science' | 'Repos';

export type ApiSource = 'hn' | 'devto' | 'reddit' | 'rss' | 'lobsters' | 'github';

// ─── Books (textbook → scrollable feed) ──────────────────────────────────────

export type BookStatus = 'uploaded' | 'parsing' | 'outlined' | 'failed';
export type CardStatus = 'none' | 'generating' | 'ready' | 'failed';

export type BookCardMode = 'concise' | 'detailed';

export interface CardVisual {
  type: 'flow' | 'compare';
  steps?: string[];
  left?: { label: string; points: string[] };
  right?: { label: string; points: string[] };
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  cardMode: BookCardMode;
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
  visual?: CardVisual | null;
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
  eventDate?: string;    // YYYY-MM-DD: when the underlying event happened, if known
  imageUrl?: string;
  points?: number;
  commentCount?: number;
  readingTimeMin?: number;
  hnId?: string;
  redditId?: string;
  rssSource?: string;    // publication name e.g. "TechCrunch"
}
