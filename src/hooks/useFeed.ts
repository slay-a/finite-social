import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Article, Category } from '../types';
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

  const pageRef = useRef(0);

  const fetchPage = useCallback(
    async (pageNum: number, mode: 'initial' | 'refresh' | 'more') => {
      if (mode === 'initial') {
        setState((s) => ({ ...s, isLoading: true, error: null }));
      } else if (mode === 'refresh') {
        setState((s) => ({ ...s, isRefreshing: true, error: null }));
      } else {
        setState((s) => ({ ...s, isLoadingMore: true }));
      }

      try {
        let fresh: Article[];

        if (category === 'Repos') {
          fresh = await fetchGithubTrending('Repos', pageNum);
        } else {
          // RSS only on first page (feeds don't paginate the same way)
          // GitHub trending mixed in for All and Dev categories
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

          const hn       = hnResult.status       === 'fulfilled' ? hnResult.value       : [];
          const devto    = devtoResult.status     === 'fulfilled' ? devtoResult.value    : [];
          const reddit   = redditResult.status    === 'fulfilled' ? redditResult.value   : [];
          const rss      = rssResult.status       === 'fulfilled' ? rssResult.value      : [];
          const lobsters = lobstersResult.status  === 'fulfilled' ? lobstersResult.value : [];
          const github   = githubResult.status    === 'fulfilled' ? githubResult.value   : [];

          fresh = mergeFeeds(hn, devto, reddit, rss, lobsters, github);
        }

        // Enhance titles + summaries in background — doesn't block the UI
        enhanceFeedContent(fresh, setEnhancedContent).catch(() => {});

        setState((s) => ({
          articles:        mode === 'more' ? [...s.articles, ...fresh] : fresh,
          isLoading:       false,
          isRefreshing:    false,
          isLoadingMore:   false,
          hasMore:         fresh.length > 0,
          error:           null,
          lastRefreshedAt: mode === 'more' ? s.lastRefreshedAt : new Date(),
        }));
        pageRef.current = pageNum;
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
    [category]
  );

  useEffect(() => {
    pageRef.current = 0;
    fetchPage(0, 'initial');
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
          pageRef.current = 0;
          fetchPage(0, 'refresh');
        }
        return s;
      });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [fetchPage]);

  const refresh = useCallback(() => {
    pageRef.current = 0;
    fetchPage(0, 'refresh');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    fetchPage(pageRef.current + 1, 'more');
  }, [state.isLoadingMore, state.hasMore, fetchPage]);

  return { ...state, refresh, loadMore };
}
