import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { fetchBook, fetchProgress, fetchSections } from '../../../src/lib/booksApi';
import { Book, BookSection } from '../../../src/types';

interface OutlineGroup {
  title: string;
  label: string | null;
  topSection: BookSection;
  data: BookSection[]; // children, or the top section itself when it has none
}

export default function BookOutlineScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [groups, setGroups] = useState<OutlineGroup[]>([]);
  const [progress, setProgress] = useState<Map<string, { lastCardIndex: number; completed: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [b, sections] = await Promise.all([fetchBook(id), fetchSections(id)]);
    const tops = sections.filter((s) => s.depth === 0).sort((a, b) => a.orderIndex - b.orderIndex);
    const children = sections.filter((s) => s.depth > 0);

    setBook(b);
    setGroups(tops.map((top) => {
      const kids = children
        .filter((c) => c.parentId === top.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      return { title: top.title, label: top.label, topSection: top, data: kids.length ? kids : [top] };
    }));
    setProgress(await fetchProgress(sections.map((s) => s.id)));
    setLoading(false);
  }, [id]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const s = useMemo(() => StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.bg },
    header:       { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerInner:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
    backBtn:      { padding: 6 },
    headerTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: theme.text },
    sectionHeader:{ backgroundColor: theme.bg, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 13 },
    rowLabel:     { fontSize: 12, fontWeight: '700', color: theme.primary, minWidth: 28 },
    rowTitle:     { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
    rowMeta:      { fontSize: 11, color: theme.textDim },
    centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }), [theme]);

  const renderRow = useCallback(({ item }: { item: BookSection }) => {
    const p = progress.get(item.id);
    const icon = p?.completed ? 'checkmark-circle'
      : item.cardStatus === 'ready' || p ? 'play-circle-outline'
      : 'ellipse-outline';
    return (
      <TouchableOpacity
        style={s.row}
        activeOpacity={0.8}
        onPress={() => router.push(`/book/${id}/section/${item.id}`)}
      >
        <Text style={s.rowLabel}>{item.label ?? '·'}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.rowTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.rowMeta}>pages {item.pageStart + 1}–{item.pageEnd + 1}</Text>
        </View>
        <Ionicons name={icon} size={20} color={p?.completed ? theme.accent : theme.textDim} />
      </TouchableOpacity>
    );
  }, [progress, s, id, theme]);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerInner}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{book?.title ?? 'Book'}</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <SectionList
          sections={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                {section.label ? `${section.label} · ` : ''}{section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}
