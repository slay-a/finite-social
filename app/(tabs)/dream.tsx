import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Theme } from '../../src/theme/themes';
import { Article } from '../../src/types';

const bookmarkRowStyleCache = new Map<string, StyleSheet.NamedStyles<any>>();
function getBookmarkRowStyles(theme: Theme) {
  let s = bookmarkRowStyleCache.get(theme.id);
  if (s) return s;
  s = StyleSheet.create({
    row:        { flexDirection: 'row', backgroundColor: theme.card, borderRadius: 14, overflow: 'hidden' },
    catBar:     { width: 3 },
    rowContent: { flex: 1, padding: 14, gap: 8 },
    rowTop:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    catChip:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    catText:    { fontSize: 11, fontWeight: '600' },
    timeText:   { fontSize: 12, color: theme.textDim, marginLeft: 'auto' as any },
    rowTitle:   { fontSize: 16, fontWeight: '700', color: theme.text, lineHeight: 22 },
    rowSummary: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
    rowMeta:    { flexDirection: 'row', gap: 12, alignItems: 'center' },
    rowAuthor:  { fontSize: 12, color: theme.textDim },
    rowStat:    { fontSize: 12, color: theme.textDim },
  });
  bookmarkRowStyleCache.set(theme.id, s);
  return s;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function BookmarkRow({ article }: { article: Article }) {
  const theme = useTheme();
  const { toggleBookmark } = useApp();
  const s = getBookmarkRowStyles(theme);
  const catColor = theme.categoryColors[article.category] ?? theme.primary;

  const handleRead = useCallback(async () => {
    await WebBrowser.openBrowserAsync(article.url, {
      toolbarColor: theme.surface,
      controlsColor: theme.primary,
    });
  }, [article.url, theme.surface, theme.primary]);

  return (
    <TouchableOpacity style={s.row} onPress={handleRead} activeOpacity={0.8}>
      <View style={[s.catBar, { backgroundColor: catColor }]} />
      <View style={s.rowContent}>
        <View style={s.rowTop}>
          <View style={[s.catChip, { backgroundColor: `${catColor}22` }]}>
            <Text style={[s.catText, { color: catColor }]}>{article.category}</Text>
          </View>
          <Text style={s.timeText}>{timeAgo(article.publishedAt)}</Text>
          <TouchableOpacity onPress={() => toggleBookmark(article)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="bookmark" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <Text style={s.rowTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.rowSummary} numberOfLines={2}>{article.summary}</Text>
        <View style={s.rowMeta}>
          <Text style={s.rowAuthor}>{article.author}</Text>
          {(article.points ?? 0) > 0 && <Text style={s.rowStat}>▲ {article.points}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BookmarksScreen() {
  const theme = useTheme();
  const { bookmarkedArticles } = useApp();

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface },
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
    headerCount: { fontSize: 13, color: theme.textMuted },
    list: { padding: 12, gap: 10 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
    emptyBody: { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 21 },
  }), [theme]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Bookmarks</Text>
        <Text style={s.headerCount}>{bookmarkedArticles.length} saved</Text>
      </View>
      {bookmarkedArticles.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bookmark-outline" size={56} color={theme.textDim} />
          <Text style={s.emptyTitle}>Nothing saved yet</Text>
          <Text style={s.emptyBody}>Tap the bookmark icon on any article to save it for later.</Text>
        </View>
      ) : (
        <FlatList
          data={bookmarkedArticles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookmarkRow article={item} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
