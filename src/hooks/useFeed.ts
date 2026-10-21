import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Article, Category } from '../types';
import { fetchDbArticles, FeedCursor } from '../lib/feedApi';
import { fetchHNArticles } from '../lib/hnApi';
import { fetchDevToArticles } from '../lib/devtoApi';
import { fetchRedditArticles } from '../lib/redditApi';
import { fetchRssArticles } from '../lib/rssApi';
import { fetchLobstersArticles } from '../lib/lobstersApi';
import { fetchGithubTrending } from '../lib/githubApi';
import { mergeFeeds } from '../lib/feedMerger';
import { enhanceFeedContent } from '../lib/aiService';
import { useApp } from '../context/AppContext';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface FeedState {
  articles: Article[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
}

export function useFeed(category: Category) {
  const { setEnhancedContent } = useApp();
  const [state, setState] = useState<FeedState>({
    articles:        [],
    isLoading:       true,
    isRefreshing:    false,
    isLoadingMore:   false,
    hasMore:         true,
    error:           null,
    lastRefreshedAt: null,
  });

  const cursorRef = useRef<FeedCursor | null>(null);
  const pageRef = useRef(0); // legacy client-side path only
  // Set when the DB has no articles yet (fresh backend) or errors — fall back
  // to the old on-device fetchers for one release cycle.
  const usingFallbackRef = useRef(false);

  const fetchLegacyPage = useCallback(
    async (pageNum: number): Promise<Article[]> => {
      if (category === 'Repos') {
        return fetchGithubTrending('Repos', pageNum);
      }
      const isGithubCategory = category === 'All' || category === 'Dev';
      const [hnResult, devtoResult, redditResult, rssResult, lobstersResult, githubResult] =
        await Promise.allSettled([
          fetchHNArticles(category, pageNum),
          fetchDevToArticles(category, pageNum + 1),
          fetchRedditArticles(category, pageNum),
          pageNum === 0 ? fetchRssArticles(category) : Promise.resolve([]),
          fetchLobstersArticles(category, pageNum),
          isGithubCategory ? fetchGithubTrending(category, pageNum) : Promise.resolve([]),
        ]);

      return mergeFeeds(
        hnResult.status       === 'fulfilled' ? hnResult.value       : [],
        devtoResult.status    === 'fulfilled' ? devtoResult.value    : [],
        redditResult.status   === 'fulfilled' ? redditResult.value   : [],
        rssResult.status      === 'fulfilled' ? rssResult.value      : [],
        lobstersResult.status === 'fulfilled' ? lobstersResult.value : [],
        githubResult.status   === 'fulfilled' ? githubResult.value   : [],
      );
    },
    [category]
  );

  const fetchPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      if (mode === 'initial') {
        setState((s) => ({ ...s, isLoading: true, error: null }));
      } else if (mode === 'refresh') {
        setState((s) => ({ ...s, isRefreshing: true, error: null }));
      } else {
        setState((s) => ({ ...s, isLoadingMore: true }));
      }

      try {
        let fresh: Article[];

        if (!usingFallbackRef.current) {
          try {
            const page = await fetchDbArticles(
              category,
              mode === 'more' ? cursorRef.current : null,
            );
            if (page.articles.length === 0 && mode !== 'more') {
              // Backend not populated yet — switch this session to the legacy path.
              usingFallbackRef.current = true;
              fresh = await fetchLegacyPage(0);
              pageRef.current = 0;
            } else {
              fresh = page.articles;
              cursorRef.current = page.cursor;
            }
          } catch {
            if (mode === 'more') throw new Error('load more failed');
            usingFallbackRef.current = true;
            fresh = await fetchLegacyPage(0);
            pageRef.current = 0;
          }
        } else {
          const nextPage = mode === 'more' ? pageRef.current + 1 : 0;
          fresh = await fetchLegacyPage(nextPage);
          pageRef.current = nextPage;
        }

        // DB articles arrive pre-summarized by the summarize-articles edge
        // function; on-device enhancement only serves the legacy fallback path.
        if (usingFallbackRef.current) {
          enhanceFeedContent(fresh, setEnhancedContent).catch(() => {});
        }

        setState((s) => ({
          articles:        mode === 'more' ? [...s.articles, ...fresh] : fresh,
          isLoading:       false,
          isRefreshing:    false,
          isLoadingMore:   false,
          hasMore:         fresh.length > 0,
          error:           null,
          lastRefreshedAt: mode === 'more' ? s.lastRefreshedAt : new Date(),
        }));
      } catch {
        setState((s) => ({
          ...s,
          isLoading:     false,
          isRefreshing:  false,
          isLoadingMore: false,
          error:         'Could not load articles. Check your connection.',
        }));
      }
    },
    [category, fetchLegacyPage, setEnhancedContent]
  );

  useEffect(() => {
    cursorRef.current = null;
    pageRef.current = 0;
    fetchPage('initial');
  }, [category, fetchPage]);

  // Auto-refresh on foreground return if feed is stale
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      setState((s) => {
        const stale =
          !s.lastRefreshedAt ||
          Date.now() - s.lastRefreshedAt.getTime() > STALE_THRESHOLD_MS;
        if (stale && !s.isLoading && !s.isRefreshing) {
          cursorRef.current = null;
          pageRef.current = 0;
          fetchPage('refresh');
        }
        return s;
      });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [fetchPage]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    pageRef.current = 0;
    fetchPage('refresh');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    fetchPage('more');
  }, [state.isLoadingMore, state.hasMore, fetchPage]);

  return { ...state, refresh, loadMore };
}
