import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Article } from '../types';
import { Theme } from '../theme/themes';
import { useTheme } from '../context/ThemeContext';
import ExplainSheet from './ExplainSheet';
import { fetchOgImage } from '../lib/ogImage';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 210;

// ─── Module-level style cache keyed by theme.id ───────────────────────────────
// StyleSheet.create runs once per theme (at most 6 times total) instead of once
// per render per visible card. This is the biggest perf win for a paged feed.
const styleCache = new Map<string, StyleSheet.NamedStyles<any>>();

function getStyles(theme: Theme) {
  let s = styleCache.get(theme.id);
  if (s) return s;
  s = StyleSheet.create({
    card:            { width: SCREEN_W, backgroundColor: theme.card, overflow: 'hidden' },
    hero:            { height: HERO_H, width: '100%', overflow: 'hidden', position: 'relative' },
    heroImage:       { width: '100%', height: '100%' },
    heroGradient:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    heroPlaceholder: { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 20 },
    heroDomain:      { fontSize: 28, fontWeight: '800', color: 'rgba(255,255,255,0.15)', letterSpacing: -0.5 },
    heroSourceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.20)', fontWeight: '500', marginTop: 2 },
    heroBadges:      { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
    sourceBadge:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
    sourceText:      { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    catChip:         { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
    catText:         { fontSize: 11, fontWeight: '700', color: '#fff' },
    heroTime:        { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    readBadge:       { backgroundColor: 'rgba(57,211,83,0.75)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    readBadgeText:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    body:            { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 8, overflow: 'hidden' },
    title:           { fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 27, letterSpacing: -0.3 },
    titleRead:       { fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 27, letterSpacing: -0.3, opacity: 0.55 },
    summary:         { fontSize: 15, color: theme.textSub, lineHeight: 23, flex: 1 },
    tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    tagChip:         { backgroundColor: theme.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagText:         { fontSize: 11, color: theme.textMuted },
    bottomBar:       { borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    meta:            { flex: 1, gap: 2 },
    metaAuthor:      { fontSize: 12, fontWeight: '600', color: theme.textSub },
    metaStats:       { flexDirection: 'row', gap: 8 },
    metaStat:        { fontSize: 11, color: theme.textDim },
    actions:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
    explainBtn:      { backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6, marginRight: 2 },
    explainBtnText:  { fontSize: 12, fontWeight: '700', color: theme.textSub },
    actionBtn:       { padding: 6 },
    readBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 2 },
    readBtnText:     { fontSize: 12, fontWeight: '700', color: theme.bg },
  });
  styleCache.set(theme.id, s);
  return s;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sourceBadgeColor(source: Article['source']): string {
  switch (source) {
    case 'hn':       return 'rgba(255,99,20,0.85)';
    case 'reddit':   return 'rgba(255,69,0,0.85)';
    case 'devto':    return 'rgba(147,51,234,0.85)';
    case 'lobsters': return 'rgba(140,82,255,0.85)';
    case 'rss':      return 'rgba(30,144,255,0.85)';
    case 'github':   return 'rgba(36,41,47,0.90)';
  }
}

function sourceBadgeLabel(article: Article): string {
  switch (article.source) {
    case 'hn':       return 'HN';
    case 'reddit':   return 'Reddit';
    case 'devto':    return 'DEV';
    case 'lobsters': return 'LBRS';
    case 'rss':      return article.rssSource?.slice(0, 5).toUpperCase() ?? 'NEWS';
    case 'github':   return 'GitHub';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Freshness of the underlying EVENT, not just the publish time: when the
// summarizer found the event's own date, show that, and call out old news.
function freshnessLabel(article: Article): { text: string; stale: boolean } {
  const basis = article.eventDate ?? article.publishedAt;
  const ageDays = (Date.now() - new Date(basis).getTime()) / 86_400_000;
  const text = article.eventDate && ageDays >= 1
    ? `event: ${new Date(article.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : timeAgo(article.publishedAt);
  return { text, stale: ageDays > 14 };
}

function FreshnessChip({ article }: { article: Article }) {
  const fresh = freshnessLabel(article);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
        {fresh.text}
      </Text>
      {fresh.stale && (
        <View style={{ backgroundColor: 'rgba(255,158,100,0.85)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>OLDER STORY</Text>
        </View>
      )}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
// isBookmarked / isRead / onBookmark / onMarkRead come from the parent so this
// component does NOT subscribe to AppContext — context changes no longer trigger
// re-renders of every visible card.

interface Props {
  article: Article;
  height: number;
  displayTitle?: string;
  displaySummary?: string;
  isBookmarked: boolean;
  isRead: boolean;
  onBookmark: (article: Article) => void;
  onMarkRead: (id: string) => void;
}

function ArticleCard({
  article, height, displayTitle, displaySummary,
  isBookmarked: bookmarked, isRead: alreadyRead,
  onBookmark, onMarkRead,
}: Props) {
  const theme = useTheme();   // Only context subscription — theme changes are rare
  const s = getStyles(theme); // Cached; StyleSheet.create never runs during a re-render
  const [explainVisible, setExplainVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [ogImage, setOgImage] = useState<string | undefined>(undefined);
  const [ogImgError, setOgImgError] = useState(false);

  const resolvedTitle   = displayTitle   ?? article.title;
  const resolvedSummary = displaySummary ?? article.summary;
  const catColor = theme.categoryColors[article.category] ?? theme.primary;
  const hasImage = !!article.imageUrl && !imgError;

  // Lazily fetch og:image when the article has no image — cached at module level
  useEffect(() => {
    if (hasImage || article.imageUrl) return; // already have or already errored
    fetchOgImage(article.url).then((img) => {
      if (img) setOgImage(img);
    });
  }, [article.url, article.imageUrl]);

  const effectiveImage = hasImage
    ? article.imageUrl
    : (!ogImgError && ogImage ? ogImage : undefined);
  const showImage = !!effectiveImage;

  // Memoize LinearGradient color arrays — avoids creating a new array every render
  const heroGradientColors = useMemo(
    () => ['transparent', theme.card] as const,
    [theme.card]
  );
  const placeholderGradientColors = useMemo(
    () => [`${catColor}18`, `${catColor}08`, theme.card] as const,
    [catColor, theme.card]
  );

  const domain = useMemo(() => {
    try { return new URL(article.url).hostname.replace('www.', ''); }
    catch { return ''; }
  }, [article.url]);

  // Fit the summary to what this device's card can actually hold, so the
  // bottom bar is never pushed off or clipped. Fixed chrome: hero 210, title
  // ~2 lines 54, tags ~32, bottom bar ~58, body padding/gaps ~40.
  const summaryLines = Math.max(3, Math.floor((height - HERO_H - 54 - 32 - 58 - 40) / 23));

  const handleRead = useCallback(async () => {
    onMarkRead(article.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(article.url, {
      toolbarColor: theme.surface,
      controlsColor: theme.primary,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, [article.id, article.url, onMarkRead, theme.surface, theme.primary]);

  const handleShare = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ title: article.title, url: article.url, message: article.url });
  }, [article.title, article.url]);

  const handleBookmark = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBookmark(article);
  }, [article, onBookmark]);

  const handleComments = useCallback(async () => {
    let url = '';
    if (article.hnId) {
      url = `https://news.ycombinator.com/item?id=${article.hnId}`;
    } else if (article.redditId) {
      url = article.url.includes('reddit.com') ? article.url : `https://reddit.com/comments/${article.redditId}`;
    }
    if (!url) return;
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: theme.surface,
      controlsColor: article.source === 'hn' ? theme.hnOrange : '#FF4500',
    });
  }, [article, theme.surface, theme.hnOrange]);

  return (
    <View style={[s.card, { height }]}>
      <View style={s.hero}>
        {showImage ? (
          <>
            <Image
              source={{ uri: effectiveImage }}
              style={s.heroImage}
              resizeMode="cover"
              onError={() => {
                if (hasImage) setImgError(true);
                else setOgImgError(true);
              }}
            />
            <LinearGradient colors={heroGradientColors} style={s.heroGradient} />
          </>
        ) : (
          <LinearGradient colors={placeholderGradientColors} style={s.heroPlaceholder}>
            <Text style={s.heroDomain}>{domain}</Text>
            <Text style={s.heroSourceLabel}>
              {article.source === 'hn' ? 'Hacker News'
                : article.source === 'reddit' ? `r/${article.tags[0] ?? 'reddit'}`
                : article.source === 'rss' ? (article.rssSource ?? 'News')
                : article.source === 'lobsters' ? 'Lobsters'
                : 'DEV Community'}
            </Text>
          </LinearGradient>
        )}
        <View style={s.heroBadges}>
          <View style={[s.sourceBadge, { backgroundColor: sourceBadgeColor(article.source) }]}>
            <Text style={s.sourceText}>{sourceBadgeLabel(article)}</Text>
          </View>
          <View style={[s.catChip, { backgroundColor: `${catColor}CC` }]}>
            <Text style={s.catText}>{article.category}</Text>
          </View>
          <FreshnessChip article={article} />
          {alreadyRead && (
            <View style={s.readBadge}><Text style={s.readBadgeText}>✓ Read</Text></View>
          )}
        </View>
      </View>

      <View style={s.body}>
        <Text style={alreadyRead ? s.titleRead : s.title} numberOfLines={2}>{resolvedTitle}</Text>
        <Text style={s.summary} numberOfLines={summaryLines}>{resolvedSummary}</Text>
        {article.tags.length > 0 && (
          <View style={s.tagsRow}>
            {article.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={s.tagChip}>
                <Text style={s.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={s.bottomBar}>
        <View style={s.meta}>
          <Text style={s.metaAuthor} numberOfLines={1}>{article.author}</Text>
          <View style={s.metaStats}>
            {(article.points ?? 0) > 0 && <Text style={s.metaStat}>▲ {article.points}</Text>}
            {(article.commentCount ?? 0) > 0 && <Text style={s.metaStat}>{article.commentCount} comments</Text>}
            {article.readingTimeMin != null && <Text style={s.metaStat}>{article.readingTimeMin} min read</Text>}
          </View>
        </View>
        <View style={s.actions}>
          <TouchableOpacity
            style={s.explainBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExplainVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={s.explainBtnText}>Explain</Text>
          </TouchableOpacity>
          {(article.hnId || article.redditId) && (
            <TouchableOpacity style={s.actionBtn} onPress={handleComments} activeOpacity={0.7}>
              <Ionicons
                name="chatbubbles-outline" size={20}
                color={article.source === 'hn' ? theme.hnOrange : '#FF4500'}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleBookmark} activeOpacity={0.7}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20}
              color={bookmarked ? theme.primary : theme.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity style={s.readBtn} onPress={handleRead} activeOpacity={0.85}>
            <Text style={s.readBtnText}>Read</Text>
            <Ionicons name="arrow-forward" size={13} color={theme.bg} />
          </TouchableOpacity>
        </View>
      </View>

      <ExplainSheet article={article} visible={explainVisible} onClose={() => setExplainVisible(false)} />
    </View>
  );
}

export default React.memo(ArticleCard);
