import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import RichText from '../src/components/RichText';
import { useTheme } from '../src/context/ThemeContext';
import { fetchSavedCards, SavedCardRow, setCardSaved } from '../src/lib/booksApi';

export default function SavedCardsScreen() {
  const theme = useTheme();
  const [rows, setRows] = useState<SavedCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(React.useCallback(() => {
    fetchSavedCards()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  const unsave = useCallback((row: SavedCardRow) => {
    setRows((prev) => prev.filter((r) => r.card.id !== row.card.id));
    setCardSaved(row.card.id, false).catch(() => {});
  }, []);

  const s = useMemo(() => StyleSheet.create({
    container:  { flex: 1, backgroundColor: theme.bg },
    header:     { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerInner:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
    backBtn:    { padding: 6 },
    headerTitle:{ flex: 1, fontSize: 16, fontWeight: '800', color: theme.text },
    cardRow:    { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 6 },
    cardSource: { fontSize: 11, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    cardTitle:  { fontSize: 16, fontWeight: '800', color: theme.text },
    cardBody:   { fontSize: 14, lineHeight: 20, color: theme.textSub },
    bold:       { fontWeight: '700', color: theme.text },
    rowActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    openTxt:    { fontSize: 13, fontWeight: '700', color: theme.primary },
    centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyText:  { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 20 },
  }), [theme]);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerInner}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Saved cards</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={theme.primary} /></View>
      ) : rows.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="bookmark-outline" size={48} color={theme.textDim} />
          <Text style={s.emptyText}>
            Tap the bookmark on any study card to keep it here for quick review.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.card.id}
          contentContainerStyle={{ paddingVertical: 16 }}
          renderItem={({ item }) => (
            <View style={s.cardRow}>
              <Text style={s.cardSource} numberOfLines={1}>
                {item.bookTitle} · {item.sectionTitle}
              </Text>
              <RichText
                text={item.card.kind === 'quiz' && item.card.quiz ? item.card.quiz.question : item.card.title}
                style={s.cardTitle}
                boldStyle={s.bold}
              />
              {item.card.body ? (
                <RichText text={item.card.body.split('\n')[0]} style={s.cardBody} boldStyle={s.bold} numberOfLines={3} />
              ) : null}
              <View style={s.rowActions}>
                <TouchableOpacity onPress={() => router.push(`/book/${item.bookId}/section/${item.sectionId}`)}>
                  <Text style={s.openTxt}>Open section</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => unsave(item)} hitSlop={8}>
                  <Ionicons name="bookmark" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
