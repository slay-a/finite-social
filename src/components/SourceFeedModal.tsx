import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList,
  TouchableOpacity, ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { Article } from '../types';
import { Theme } from '../theme/themes';
import { useTheme } from '../context/ThemeContext';
import { fetchArticlesBySource } from '../lib/sourceFeed';

// Module-level style cache — same pattern as ArticleCard
const rowStyleCache = new Map<string, StyleSheet.NamedStyles<any>>();
function getRowStyles(theme: Theme) {
  let s = rowStyleCache.get(theme.id);
  if (s) return s;
  s = StyleSheet.create({
    row:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 12, alignItems: 'flex-start' },
    content: { flex: 1, gap: 5 },
    title:   { fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 21 },
    summary: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
    meta:    { flexDirection: 'row', gap: 10, marginTop: 2 },
    time:    { fontSize: 11, color: theme.textDim },
    stat:    { fontSize: 11, color: theme.textDim },
    thumb:   { width: 72, height: 72, borderRadius: 8, backgroundColor: theme.surface },
  });
  rowStyleCache.set(theme.id, s);
  return s;
}

interface Props {
  sourceName: string;
  sourceColor: string;
  visible: boolean;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ArticleRow({ article }: { article: Article }) {
  const theme = useTheme();
  const s = getRowStyles(theme); // Cached — no StyleSheet.create during re-renders
  const hasImage = !!article.imageUrl;

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(article.url, {
      toolbarColor: theme.surface,
      controlsColor: theme.primary,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }, [article.url, theme.surface, theme.primary]);

  return (
    <TouchableOpacity style={s.row} onPress={handlePress} activeOpacity={0.75}>
      <View style={s.content}>
        <Text style={s.title} numberOfLines={2}>{article.title}</Text>
        <Text style={s.summary} numberOfLines={3}>{article.summary}</Text>
        <View style={s.meta}>
          <Text style={s.time}>{timeAgo(article.publishedAt)}</Text>
          {(article.points ?? 0) > 0 && <Text style={s.stat}>▲ {article.points}</Text>}
          {(article.commentCount ?? 0) > 0 && <Text style={s.stat}>💬 {article.commentCount}</Text>}
        </View>
      </View>
      {hasImage && <Image source={{ uri: article.imageUrl }} style={s.thumb} resizeMode="cover" />}
    </TouchableOpacity>
  );
}

export default function SourceFeedModal({ sourceName, sourceColor, visible, onClose }: Props) {
  const theme = useTheme();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setArticles([]);
    setError(null);
    setLoading(true);
    fetchArticlesBySource(sourceName)
      .then((data) => setArticles(data))
      .catch(() => setError('Could not load articles'))
      .finally(() => setLoading(false));
  }, [visible, sourceName]);

  const keyExtractor = useCallback((item: Article) => item.id, []);
  const renderItem = useCallback(({ item }: { item: Article }) => <ArticleRow article={item} />, []);
  const ItemSeparator = useCallback(() => (
    <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 16 }} />
  ), [theme]);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: theme.surface,
      borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.text },
    closeBtn: { padding: 4 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { fontSize: 14, color: theme.textMuted },
  }), [theme]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sourceColor }} />
          <Text style={s.headerTitle}>{sourceName}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={theme.primary} size="large" />
          </View>
        ) : error ? (
          <View style={s.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.textDim} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={articles}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={ItemSeparator}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
