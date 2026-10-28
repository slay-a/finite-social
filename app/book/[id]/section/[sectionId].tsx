import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, LayoutChangeEvent, StyleSheet, Text,
  TouchableOpacity, View, ViewToken, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import SectionCard from '../../../../src/components/SectionCard';
import { useTheme } from '../../../../src/context/ThemeContext';
import { useSectionCards } from '../../../../src/hooks/useSectionCards';
import { fetchSavedCardIds, fetchSection, saveProgress, setCardSaved } from '../../../../src/lib/booksApi';
import { resolveVoice, speakCard, SpeakController, VoiceGender } from '../../../../src/lib/speech';
import { BookSection, SectionCardData } from '../../../../src/types';

export default function SectionFeedScreen() {
  const theme = useTheme();
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const { height: screenH } = useWindowDimensions();

  const [section, setSection] = useState<BookSection | null>(null);
  const { cards, status, retry } = useSectionCards(sectionId);

  const cardHRef = useRef(screenH - 60);
  const [cardH, setCardH] = useState(screenH - 60);
  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 50) { cardHRef.current = h; setCardH(h); }
  }, []);

  useEffect(() => {
    if (sectionId) fetchSection(sectionId).then(setSection);
  }, [sectionId]);

  // ── Saved cards ─────────────────────────────────────────────────────────────
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetchSavedCardIds().then(setSavedIds).catch(() => {});
  }, []);
  const handleToggleSave = useCallback((card: SectionCardData, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(card.id); else next.delete(card.id);
      return next;
    });
    setCardSaved(card.id, saved).catch(() => {});
  }, []);
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  // ── Listen mode: speaks the current card, then advances the feed ────────────
  const listRef = useRef<FlatList<SectionCardData>>(null);
  const [playing, setPlaying] = useState(false);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const speakRef = useRef<SpeakController | null>(null);
  const currentIndexRef = useRef(0);
  const playingRef = useRef(false);
  playingRef.current = playing;

  const stopListening = useCallback(() => {
    speakRef.current?.stop();
    speakRef.current = null;
    setPlaying(false);
  }, []);

  const speakFrom = useCallback(async (index: number) => {
    const list = cardsRef.current;
    if (index >= list.length) { setPlaying(false); return; }
    listRef.current?.scrollToIndex({ index, animated: true });
    currentIndexRef.current = index;
    const voiceId = await resolveVoice(voiceGender);
    speakRef.current = speakCard(list[index], voiceId, (finished) => {
      if (finished && playingRef.current) speakFrom(index + 1);
    });
  }, [voiceGender]);

  const toggleListening = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) { stopListening(); return; }
    setPlaying(true);
    playingRef.current = true;
    speakFrom(currentIndexRef.current);
  }, [playing, stopListening, speakFrom]);

  const toggleVoice = useCallback(() => {
    Haptics.selectionAsync();
    setVoiceGender((g) => (g === 'female' ? 'male' : 'female'));
    if (playingRef.current) stopListening();
  }, [stopListening]);

  useEffect(() => stopListening, [stopListening]); // stop on unmount

  // ── Progress ────────────────────────────────────────────────────────────────
  const maxIndexRef = useRef(0);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const idx = viewableItems[0]?.index;
      if (idx == null) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      currentIndexRef.current = idx;
      if (idx > maxIndexRef.current) maxIndexRef.current = idx;
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const cardsRef = useRef<SectionCardData[]>([]);
  cardsRef.current = cards;
  useEffect(() => {
    return () => {
      if (sectionId && cardsRef.current.length > 0) {
        const total = cardsRef.current.length;
        saveProgress(sectionId, maxIndexRef.current, maxIndexRef.current >= total - 1).catch(() => {});
      }
    };
  }, [sectionId]);

  const sectionLabel = section
    ? `${section.label ? `${section.label} · ` : ''}${section.title}`
    : '';

  const renderItem = useCallback(
    ({ item, index }: { item: SectionCardData; index: number }) => (
      <SectionCard
        card={item}
        height={cardHRef.current}
        index={index}
        total={cardsRef.current.length}
        sectionLabel={sectionLabel}
        isSaved={savedIdsRef.current.has(item.id)}
        onToggleSave={handleToggleSave}
      />
    ),
    [sectionLabel, handleToggleSave],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<SectionCardData> | null | undefined, index: number) => ({
      length: cardHRef.current, offset: cardHRef.current * index, index,
    }),
    [],
  );

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    roundBtn:  { margin: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    listenRow: { flexDirection: 'row', alignItems: 'center' },
    voiceBtn:  { margin: 8, marginRight: 0, height: 38, borderRadius: 19, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    voiceTxt:  { fontSize: 12, fontWeight: '700', color: theme.textSub },
    feed:      { flex: 1 },
    centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
    waitTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    waitText:  { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19 },
    retryBtn:  { backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
    retryText: { fontSize: 14, fontWeight: '700', color: theme.bg },
  }), [theme]);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.header} pointerEvents="box-none">
        <TouchableOpacity style={s.roundBtn} onPress={() => { stopListening(); router.back(); }}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        {status === 'ready' && cards.length > 0 && (
          <View style={s.listenRow} pointerEvents="box-none">
            <TouchableOpacity style={s.voiceBtn} onPress={toggleVoice} activeOpacity={0.8}>
              <Text style={s.voiceTxt}>{voiceGender === 'female' ? 'Her voice' : 'His voice'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.roundBtn} onPress={toggleListening} activeOpacity={0.8}>
              <Ionicons name={playing ? 'pause' : 'headset-outline'} size={19} color={playing ? theme.primary : theme.text} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <View style={s.feed} onLayout={onListLayout}>
        {status === 'loading' || status === 'generating' ? (
          <View style={s.centered}>
            <ActivityIndicator color={theme.primary} />
            <Text style={s.waitTitle}>
              {status === 'generating' ? 'Writing this section…' : 'Loading…'}
            </Text>
            {status === 'generating' && (
              <Text style={s.waitText}>
                First visit to a section takes a few seconds. After that it loads instantly.
              </Text>
            )}
          </View>
        ) : status === 'failed' ? (
          <View style={s.centered}>
            <Ionicons name="cloud-offline-outline" size={44} color={theme.textDim} />
            <Text style={s.waitText}>Couldn't generate this section.</Text>
            <TouchableOpacity style={s.retryBtn} onPress={retry} activeOpacity={0.8}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={cards}
            renderItem={renderItem}
            keyExtractor={(c) => c.id}
            getItemLayout={getItemLayout}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            removeClippedSubviews
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={2}
            extraData={[cardH, savedIds]}
          />
        )}
      </View>
    </View>
  );
}
