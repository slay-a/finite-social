import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useBooks } from '../../src/hooks/useBooks';
import { Book } from '../../src/types';

function statusLabel(book: Book): string {
  if (book.status === 'outlined') return book.pageCount ? `${book.pageCount} pages` : 'ready';
  if (book.status === 'parsing') {
    return book.pageCount
      ? `processing ${Math.round((book.parseProgress / book.pageCount) * 100)}%`
      : 'processing…';
  }
  if (book.status === 'failed') return book.parseError ?? 'failed';
  return 'uploaded';
}

export default function BooksScreen() {
  const theme = useTheme();
  const { books, isLoading, upload, startUpload, reload, dismissError, removeBook, regenerate, rename } = useBooks();

  useFocusEffect(React.useCallback(() => { reload(); }, [reload]));

  // Depth choice up front: cards are generated per section and cached, so the
  // mode is fixed per book at upload time.
  const handleAddBook = useCallback(() => {
    Alert.alert(
      'How deep should it go?',
      'Concise gives you the key ideas per section. Everything turns all the material into cards.',
      [
        { text: 'Concise', onPress: () => startUpload('concise') },
        { text: 'Everything', onPress: () => startUpload('detailed') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [startUpload]);

  const s = useMemo(() => StyleSheet.create({
    container:  { flex: 1, backgroundColor: theme.bg },
    header:     { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerInner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
    logoText:   { fontSize: 22, fontWeight: '800', color: theme.primary, letterSpacing: -0.5 },
    addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    addText:    { fontSize: 13, fontWeight: '700', color: theme.bg },
    list:       { padding: 16, gap: 12 },
    bookRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
    bookIcon:   { width: 44, height: 56, borderRadius: 8, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' },
    bookInfo:   { flex: 1, gap: 3 },
    bookTitle:  { fontSize: 15, fontWeight: '700', color: theme.text },
    bookMeta:   { fontSize: 12, color: theme.textMuted },
    banner:     { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14 },
    bannerText: { flex: 1, fontSize: 13, color: theme.textSub },
    centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    emptyText:  { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 20 },
  }), [theme]);

  const busy = upload.phase === 'uploading' || upload.phase === 'parsing';

  const handleBookActions = useCallback((book: Book) => {
    const otherMode = book.cardMode === 'concise' ? 'detailed' : 'concise';
    const otherLabel = otherMode === 'detailed' ? 'Everything' : 'Concise';
    Alert.alert(
      book.title,
      `Cards: ${book.cardMode === 'detailed' ? 'Everything' : 'Concise'}`,
      [
        {
          text: 'Rename',
          onPress: () => {
            Alert.prompt(
              'Rename book',
              undefined,
              [
                { text: 'Save', onPress: (title?: string) => { if (title?.trim()) rename(book, title.trim()); } },
                { text: 'Cancel', style: 'cancel' },
              ],
              'plain-text',
              book.title,
            );
          },
        },
        {
          text: `Regenerate as ${otherLabel}`,
          onPress: () => {
            Alert.alert(
              `Regenerate as ${otherLabel}?`,
              'All generated cards and reading progress for this book are cleared; each section regenerates when you next open it.',
              [
                { text: 'Regenerate', onPress: () => regenerate(book, otherMode) },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          },
        },
        {
          text: 'Delete book',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Delete book?', 'The PDF, its sections, and all cards are removed.', [
              { text: 'Delete', style: 'destructive', onPress: () => removeBook(book) },
              { text: 'Cancel', style: 'cancel' },
            ]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [regenerate, removeBook, rename]);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerInner}>
          <Text style={s.logoText}>learn</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => router.push('/saved-cards')}
            hitSlop={8}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="bookmark-outline" size={20} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={handleAddBook} disabled={busy} activeOpacity={0.8}>
            {busy
              ? <ActivityIndicator size="small" color={theme.bg} />
              : <Ionicons name="add" size={16} color={theme.bg} />}
            <Text style={s.addText}>
              {upload.phase === 'uploading' ? 'Uploading…'
                : upload.phase === 'parsing' ? `Processing ${Math.round(upload.progress * 100)}%`
                : 'Add book'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {upload.phase === 'error' && (
        <TouchableOpacity style={s.banner} onPress={dismissError} activeOpacity={0.8}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={s.bannerText}>{upload.error}</Text>
          <Ionicons name="close" size={16} color={theme.textDim} />
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={s.centered}><ActivityIndicator color={theme.primary} /></View>
      ) : books.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="library-outline" size={56} color={theme.textDim} />
          <Text style={s.emptyTitle}>Turn any book into a feed</Text>
          <Text style={s.emptyText}>
            Upload a PDF textbook and it becomes a topic-by-topic swipeable feed,
            explained as you scroll.
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.bookRow}
              activeOpacity={0.8}
              disabled={item.status !== 'outlined' && item.status !== 'failed'}
              onPress={() => (item.status === 'outlined' ? router.push(`/book/${item.id}`) : handleBookActions(item))}
              onLongPress={() => handleBookActions(item)}
            >
              <View style={s.bookIcon}>
                <Ionicons
                  name={item.status === 'failed' ? 'alert-circle-outline' : 'book-outline'}
                  size={22}
                  color={item.status === 'failed' ? theme.danger : theme.primary}
                />
              </View>
              <View style={s.bookInfo}>
                <Text style={s.bookTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={s.bookMeta} numberOfLines={2}>{statusLabel(item)}</Text>
              </View>
              {item.status === 'parsing' ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <TouchableOpacity onPress={() => handleBookActions(item)} hitSlop={10}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={theme.textDim} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
