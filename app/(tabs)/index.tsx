import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, LayoutChangeEvent, ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ArticleCard from '../../src/components/ArticleCard';
import CategoryBar from '../../src/components/CategoryBar';
import LoadingCard from '../../src/components/LoadingCard';
import { useApp } from '../../src/context/AppContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { useFeed } from '../../src/hooks/useFeed';
import { Article } from '../../src/types';
import { FREE_FEED_LIMIT } from '../../src/lib/purchases';

function PaywallCard({ height, onUpgrade }: { height: number; onUpgrade: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ height, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Ionicons name="lock-closed-outline" size={48} color={theme.textDim} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
        You've reached the free limit
      </Text>
      <Text style={{ fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 22 }}>
        Free accounts get {FREE_FEED_LIMIT} articles per day.{'\n'}Upgrade for unlimited access.
      </Text>
      <TouchableOpacity
        onPress={onUpgrade}
        activeOpacity={0.85}
        style={{ backgroundColor: theme.primary, borderRadius: 18, paddingHorizontal: 32, paddingVertical: 14 }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.bg }}>Upgrade to Pro</Text>
      </TouchableOpacity>
    </View>
  );
}

function timeLabel(date: Date | null): string {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function FeedScreen() {
  const theme = useTheme();
  const { height: screenH } = useWindowDimensions();

  const cardHRef = useRef(screenH - 83);
  const [cardH, setCardH] = useState(screenH - 83);

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 50) { cardHRef.current = h; setCardH(h); }
  }, []);

  const {
    activeCategory, setActiveCategory, addArticlesToCache,
    enhancedTitles, enhancedSummaries,
    bookmarkIds, readIds, toggleBookmark, markRead,
    feedEnabled,
  } = useApp();
  const { isPro, recordFeed } = useSubscription();

  const { articles, isLoading, isRefreshing, error, refresh, loadMore, lastRefreshedAt } = useFeed(activeCategory);

  useEffect(() => {
    if (articles.length > 0) addArticlesToCache(articles);
  }, [articles, addArticlesToCache]);

  // ─── Refs hold latest values so renderItem can stay stable ──────────────────
  const bookmarkIdsRef = useRef(bookmarkIds);
  bookmarkIdsRef.current = bookmarkIds;
  const readIdsRef = useRef(readIds);
  readIdsRef.current = readIds;
  const enhancedTitlesRef = useRef(enhancedTitles);
  enhancedTitlesRef.current = enhancedTitles;
  const enhancedSummariesRef = useRef(enhancedSummaries);
  enhancedSummariesRef.current = enhancedSummaries;

  // Stable callbacks — useCallback with stable deps
  const handleToggleBookmark = useCallback((article: Article) => {
    toggleBookmark(article);
  }, [toggleBookmark]);

  const handleMarkRead = useCallback((id: string) => {
    markRead(id);
  }, [markRead]);

  // extraData changes whenever any display-relevant state changes → FlatList
  // re-renders visible items, which then read fresh values from refs above.
  const extraData = useMemo(
    () => ({ bookmarkIds, readIds, enhancedTitles, enhancedSummaries }),
    [bookmarkIds, readIds, enhancedTitles, enhancedSummaries]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        recordFeed();
      }
    }
  ).current;

  // Stable renderItem — reads Maps/Sets via refs, paywall sentinel via __paywall flag
  const renderItem = useCallback(
    ({ item }: { item: Article & { __paywall?: true } }) => {
      if (item.__paywall) {
        return (
          <PaywallCard height={cardHRef.current} onUpgrade={() => router.push('/paywall')} />
        );
      }
      return (
        <ArticleCard
          article={item}
          height={cardHRef.current}
          displayTitle={enhancedTitlesRef.current.get(item.id)}
          displaySummary={enhancedSummariesRef.current.get(item.id)}
          isBookmarked={bookmarkIdsRef.current.has(item.id)}
          isRead={readIdsRef.current.has(item.id)}
          onBookmark={handleToggleBookmark}
          onMarkRead={handleMarkRead}
        />
      );
    },
    [handleToggleBookmark, handleMarkRead]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Article> | null | undefined, index: number) => ({
      length: cardHRef.current, offset: cardHRef.current * index, index,
    }),
    []
  );

  const keyExtractor = useCallback((item: Article & { __paywall?: true }) => item.__paywall ? '__paywall__' : item.id, []);

  // Limit feed to FREE_FEED_LIMIT for free users; append paywall sentinel
  const feedData = useMemo(() => {
    if (isPro) return articles;
    const capped = articles.slice(0, FREE_FEED_LIMIT);
    if (articles.length > FREE_FEED_LIMIT) {
      return [...capped, { __paywall: true, id: '__paywall__' } as any];
    }
    return capped;
  }, [articles, isPro]);

  const s = useMemo(() => StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.bg },
    header:       { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
    logoText:     { fontSize: 22, fontWeight: '800', color: theme.primary, letterSpacing: -0.5 },
    freshLabel:   { fontSize: 10, color: theme.textDim, letterSpacing: 0.5, marginTop: 1 },
    refreshBtn:   { padding: 8 },
    feedContainer: { flex: 1 },
    centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    errorText:    { fontSize: 15, color: theme.textMuted, textAlign: 'center' },
    retryBtn:     { backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
    retryText:    { fontSize: 14, fontWeight: '700', color: theme.bg },
  }), [theme]);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerInner}>
          <View>
            <Text style={s.logoText}>finite</Text>
            {lastRefreshedAt && <Text style={s.freshLabel}>Updated {timeLabel(lastRefreshedAt)}</Text>}
          </View>
          <TouchableOpacity onPress={refresh} activeOpacity={0.7} style={s.refreshBtn}>
            <Ionicons
              name={isRefreshing ? 'hourglass-outline' : 'refresh'}
              size={20}
              color={isRefreshing ? theme.primary : theme.textMuted}
            />
          </TouchableOpacity>
        </View>
        <CategoryBar active={activeCategory} onChange={setActiveCategory} />
      </SafeAreaView>

      <View style={s.feedContainer} onLayout={onListLayout}>
        {!feedEnabled ? (
          <View style={s.centered}>
            <Ionicons name="pause-circle-outline" size={56} color={theme.textDim} />
            <Text style={[s.errorText, { fontWeight: '700', color: theme.text }]}>Feed is paused</Text>
            <Text style={s.errorText}>Turn it back on in Profile → Feed.</Text>
          </View>
        ) : isLoading ? (
          <LoadingCard height={cardH} />
        ) : error ? (
          <View style={s.centered}>
            <Ionicons name="cloud-offline-outline" size={48} color={theme.textDim} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={refresh} activeOpacity={0.8}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={feedData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            extraData={extraData}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            onEndReached={loadMore}
            onEndReachedThreshold={2}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            refreshing={isRefreshing}
            onRefresh={refresh}
            removeClippedSubviews
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={2}
          />
        )}
      </View>
    </View>
  );
}
