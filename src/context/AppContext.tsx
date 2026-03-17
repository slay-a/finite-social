import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Article, Category } from '../types';
import {
  loadBookmarkIds,
  saveBookmarkIds,
  loadReadIds,
  saveReadIds,
  loadFeedEnabled,
  saveFeedEnabled,
  loadDisabledCategories,
  saveDisabledCategories,
} from '../lib/storage';

interface AppContextValue {
  activeCategory: Category;
  setActiveCategory: (c: Category) => void;

  feedEnabled: boolean;
  setFeedEnabled: (v: boolean) => void;
  disabledCategories: Set<Category>;
  toggleCategory: (cat: Category) => void;

  bookmarkIds: Set<string>;
  toggleBookmark: (article: Article) => void;
  isBookmarked: (id: string) => boolean;
  bookmarkedArticles: Article[];
  addArticlesToCache: (articles: Article[]) => void;

  readIds: Set<string>;
  markRead: (id: string) => void;
  isRead: (id: string) => boolean;

  enhancedSummaries: Map<string, string>;
  enhancedTitles: Map<string, string>;
  setEnhancedContent: (id: string, content: { title?: string; summary?: string }) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [feedEnabled, setFeedEnabledState] = useState(true);
  const [disabledCategories, setDisabledCategories] = useState<Set<Category>>(new Set());
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [articleCache, setArticleCache] = useState<Map<string, Article>>(new Map());
  const [enhancedSummaries, setEnhancedSummaries] = useState<Map<string, string>>(new Map());
  const [enhancedTitles, setEnhancedTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    Promise.all([
      loadBookmarkIds(),
      loadReadIds(),
      loadFeedEnabled(),
      loadDisabledCategories(),
    ]).then(([bIds, rIds, fe, dc]) => {
      setBookmarkIds(new Set(bIds));
      setReadIds(new Set(rIds));
      setFeedEnabledState(fe);
      setDisabledCategories(new Set(dc as Category[]));
    });
  }, []);

  const setFeedEnabled = useCallback((v: boolean) => {
    setFeedEnabledState(v);
    saveFeedEnabled(v);
  }, []);

  const toggleCategory = useCallback((cat: Category) => {
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      saveDisabledCategories([...next]);
      return next;
    });
  }, []);

  const addArticlesToCache = useCallback((articles: Article[]) => {
    setArticleCache((prev) => {
      const next = new Map(prev);
      articles.forEach((a) => next.set(a.id, a));
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((article: Article) => {
    setBookmarkIds((prev) => {
      const next = new Set(prev);
      if (next.has(article.id)) {
        next.delete(article.id);
      } else {
        next.add(article.id);
        setArticleCache((c) => new Map(c).set(article.id, article));
      }
      saveBookmarkIds([...next]);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarkIds.has(id),
    [bookmarkIds]
  );

  const bookmarkedArticles: Article[] = [...bookmarkIds]
    .map((id) => articleCache.get(id))
    .filter(Boolean) as Article[];

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds([...next]);
      return next;
    });
  }, []);

  const isRead = useCallback(
    (id: string) => readIds.has(id),
    [readIds]
  );

  const setEnhancedContent = useCallback(
    (id: string, content: { title?: string; summary?: string }) => {
      if (content.summary) setEnhancedSummaries((prev) => new Map(prev).set(id, content.summary!));
      if (content.title)   setEnhancedTitles((prev) => new Map(prev).set(id, content.title!));
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        activeCategory,
        setActiveCategory,
        feedEnabled,
        setFeedEnabled,
        disabledCategories,
        toggleCategory,
        bookmarkIds,
        toggleBookmark,
        isBookmarked,
        bookmarkedArticles,
        addArticlesToCache,
        readIds,
        markRead,
        isRead,
        enhancedSummaries,
        enhancedTitles,
        setEnhancedContent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
