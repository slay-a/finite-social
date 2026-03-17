import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { Theme } from '../../src/theme/themes';
import { Article } from '../../src/types';
import { useApp } from '../../src/context/AppContext';

const searchRowStyleCache = new Map<string, StyleSheet.NamedStyles<any>>();
function getSearchRowStyles(theme: Theme) {
  let s = searchRowStyleCache.get(theme.id);
  if (s) return s;
  s = StyleSheet.create({
    row:        { flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, overflow: 'hidden', marginBottom: 2 },
    catBar:     { width: 3 },
    rowContent: { flex: 1, padding: 14, gap: 6 },
    rowTitle:   { fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 21 },
    rowSummary: { fontSize: 13, color: theme.textMuted, lineHeight: 18 },
    rowMeta:    { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 2 },
    rowAuthor:  { fontSize: 12, color: theme.textDim },
    timeText:   { fontSize: 12, color: theme.textDim },
    rowStat:    { fontSize: 12, color: theme.textDim },
  });
  searchRowStyleCache.set(theme.id, s);
  return s;
}

const BASE_HN = 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=20';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SearchRow({ article }: { article: Article }) {
  const theme = useTheme();
  const { toggleBookmark, isBookmarked } = useApp();
  const catColor = theme.categoryColors[article.category] ?? theme.primary;
  const bookmarked = isBookmarked(article.id);

  const handleRead = async () => {
    await WebBrowser.openBrowserAsync(article.url, {
      toolbarColor: theme.surface,
      controlsColor: theme.primary,
    });
  };

  const s = getSearchRowStyles(theme);

  return (
    <TouchableOpacity style={s.row} onPress={handleRead} activeOpacity={0.8}>
      <View style={[s.catBar, { backgroundColor: catColor }]} />
      <View style={s.rowContent}>
        <Text style={s.rowTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.rowSummary} numberOfLines={2}>{article.summary}</Text>
        <View style={s.rowMeta}>
          <Text style={s.rowAuthor}>{article.author}</Text>
          <Text style={s.timeText}>{timeAgo(article.publishedAt)}</Text>
          {(article.points ?? 0) > 0 && <Text style={s.rowStat}>▲ {article.points}</Text>}
          <TouchableOpacity
            onPress={() => toggleBookmark(article)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 'auto' as any }}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={16}
              color={bookmarked ? theme.primary : theme.textDim}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`${BASE_HN}&query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      const articles: Article[] = data.hits
        .filter((h: any) => (h.title || h.story_title) && (h.url || h.story_text))
        .map((h: any): Article => ({
          id: `hn-${h.objectID}`, hnId: h.objectID, source: 'hn',
          title: (h.title || h.story_title || '').trim(),
          summary: h.story_text
            ? h.story_text.replace(/<[^>]+>/g, '').slice(0, 200)
            : `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
          url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
          author: h.author,
          tags: (h._tags ?? []).filter((t: string) => !t.startsWith('author_') && !t.startsWith('story_')),
          category: 'All',
          publishedAt: h.created_at,
          points: h.points,
          commentCount: h.num_comments,
        }));
      setResults(articles);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    inputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
    input: { flex: 1, fontSize: 15, color: theme.text },
    goBtn: { backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    goBtnDisabled: { opacity: 0.4 },
    goText: { fontSize: 14, fontWeight: '700', color: theme.bg },
    list: { padding: 12, gap: 10 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 },
    hintText: { fontSize: 15, color: theme.textMuted },
  }), [theme]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.searchBar}>
        <View style={s.inputRow}>
          <Ionicons name="search" size={16} color={theme.textDim} />
          <TextInput
            style={s.input}
            placeholder="Search tech news…"
            placeholderTextColor={theme.textDim}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={16} color={theme.textDim} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[s.goBtn, !query.trim() && s.goBtnDisabled]} onPress={handleSearch} disabled={!query.trim()} activeOpacity={0.8}>
          <Text style={s.goText}>Go</Text>
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <View style={s.centered}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : !searched ? (
        <View style={s.hint}>
          <Ionicons name="search-outline" size={48} color={theme.textDim} />
          <Text style={s.hintText}>Search tech news</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.hint}><Text style={s.hintText}>No results for "{query}"</Text></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SearchRow article={item} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
