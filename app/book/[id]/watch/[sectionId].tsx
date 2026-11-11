import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, LayoutChangeEvent, Pressable, StyleSheet, Text,
  TouchableOpacity, View, ViewToken, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import WatchScene from '../../../../src/components/WatchScene';
import { useTheme } from '../../../../src/context/ThemeContext';
import { useSectionCards } from '../../../../src/hooks/useSectionCards';
import { fetchSection, saveProgress } from '../../../../src/lib/booksApi';
import {
  NarrationController, VoiceGender, cardToSpokenText, estimateSpokenMs,
  playCardNarration, prefetchCardAudio,
} from '../../../../src/lib/speech';
import { BookSection, SectionCardData } from '../../../../src/types';

export default function WatchScreen() {
  const theme = useTheme();
  useKeepAwake();
  const { sectionId } = useLocalSearchParams<{ id: string; sectionId: string }>();
  const { height: screenH, width: screenW } = useWindowDimensions();

  const [section, setSection] = useState<BookSection | null>(null);
  const { cards, status, retry } = useSectionCards(sectionId);

  const sceneHRef = useRef(screenH);
  const [sceneH, setSceneH] = useState(screenH);
  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 50) { sceneHRef.current = h; setSceneH(h); }
  }, []);

  useEffect(() => {
    if (sectionId) fetchSection(sectionId).then(setSection);
  }, [sectionId]);

  // ── Playback state ──────────────────────────────────────────────────────────
  const listRef = useRef<FlatList<SectionCardData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(1);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [replayNonce, setReplayNonce] = useState(0);

  const ctrlRef = useRef<NarrationController | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const maxIndexRef = useRef(0);

  const cardsRef = useRef<SectionCardData[]>([]);
  cardsRef.current = cards;

  const goTo = useCallback((next: number) => {
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    const list = cardsRef.current;
    if (next < 0) return;
    if (next >= list.length) { setEnded(true); return; }
    setActiveIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  // Narration for the active scene; restarts on card change or voice change.
  useEffect(() => {
    if (status !== 'ready' || cards.length === 0 || ended) return;
    const card = cards[activeIndex];
    if (!card) return;
    if (activeIndex > maxIndexRef.current) maxIndexRef.current = activeIndex;
    setElapsed(0);
    setDuration(estimateSpokenMs(cardToSpokenText(card)));
    setFinished(false);
    setPaused(false);
    if (cards[activeIndex + 1]) prefetchCardAudio(cards[activeIndex + 1], voiceGender);

    const ctrl = playCardNarration(card, voiceGender, {
      onProgress: (e, d) => { setElapsed(e); setDuration(d); },
      onDone: (ok) => {
        if (!ok) return;
        setFinished(true);
        setElapsed(Number.MAX_SAFE_INTEGER); // every reveal lands
        const dwell = card.kind === 'quiz' ? 4000 : 1000;
        advanceTimer.current = setTimeout(() => goTo(activeIndexRef.current + 1), dwell);
      },
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.stop();
      ctrlRef.current = null;
      if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, voiceGender, status, cards.length === 0, ended, replayNonce]);

  // Manual swipes retarget the narration.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const idx = viewableItems[0]?.index;
      if (idx == null || idx === activeIndexRef.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveIndex(idx);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  useEffect(() => {
    return () => {
      if (sectionId && cardsRef.current.length > 0) {
        const total = cardsRef.current.length;
        saveProgress(sectionId, maxIndexRef.current, maxIndexRef.current >= total - 1).catch(() => {});
      }
    };
  }, [sectionId]);

  const togglePauseHold = useCallback((down: boolean) => {
    if (down) { ctrlRef.current?.pause(); setPaused(true); }
    else { ctrlRef.current?.resume(); setPaused(false); }
  }, []);

  const onSceneTap = useCallback((x: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (x < screenW * 0.3) goTo(Math.max(0, activeIndexRef.current - 1));
    else goTo(activeIndexRef.current + 1);
  }, [goTo, screenW]);

  const toggleVoice = useCallback(() => {
    Haptics.selectionAsync();
    setVoiceGender((g) => (g === 'female' ? 'male' : 'female'));
  }, []);

  const replay = useCallback(() => {
    setEnded(false);
    maxIndexRef.current = 0;
    setActiveIndex(0);
    setReplayNonce((n) => n + 1);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: 0, animated: false }));
  }, []);

  const sectionLabel = section
    ? `${section.label ? `${section.label} · ` : ''}${section.title}`
    : '';

  const renderItem = useCallback(
    ({ item, index }: { item: SectionCardData; index: number }) => (
      <Pressable
        onPress={(e) => onSceneTap(e.nativeEvent.locationX)}
        onLongPress={() => togglePauseHold(true)}
        onPressOut={() => { if (paused) togglePauseHold(false); }}
        delayLongPress={180}
      >
        <WatchScene
          card={item}
          height={sceneHRef.current}
          sectionLabel={sectionLabel}
          elapsedMs={index === activeIndex ? elapsed : 0}
          durationMs={index === activeIndex ? duration : estimateSpokenMs(cardToSpokenText(item))}
          active={index === activeIndex}
          revealAnswer={index === activeIndex && finished}
        />
      </Pressable>
    ),
    [sectionLabel, activeIndex, elapsed, duration, finished, paused, onSceneTap, togglePauseHold],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<SectionCardData> | null | undefined, index: number) => ({
      length: sceneHRef.current, offset: sceneHRef.current * index, index,
    }),
    [],
  );

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    topBar:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    segments:  { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
    segment:   { flex: 1, height: 3, borderRadius: 2, backgroundColor: `${theme.textDim}55`, overflow: 'hidden' },
    segFill:   { height: 3, borderRadius: 2, backgroundColor: theme.primary },
    controls:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, marginTop: 4 },
    roundBtn:  { margin: 6, width: 38, height: 38, borderRadius: 19, backgroundColor: `${theme.surface}EE`, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    voiceBtn:  { margin: 6, height: 38, borderRadius: 19, backgroundColor: `${theme.surface}EE`, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    voiceTxt:  { fontSize: 12, fontWeight: '700', color: theme.textSub },
    feed:      { flex: 1 },
    centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
    waitTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    waitText:  { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19 },
    retryBtn:  { backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
    retryText: { fontSize: 14, fontWeight: '700', color: theme.bg },
    pausedTag: { position: 'absolute', alignSelf: 'center', top: '48%', backgroundColor: `${theme.surface}DD`, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, zIndex: 5 },
    pausedTxt: { fontSize: 13, fontWeight: '700', color: theme.text },
    endWrap:   { ...StyleSheet.absoluteFillObject, backgroundColor: `${theme.bg}F2`, alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 20 },
    endTitle:  { fontSize: 20, fontWeight: '800', color: theme.text },
    endRow:    { flexDirection: 'row', gap: 12 },
    endBtn:    { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
    endBtnTxt: { fontSize: 14, fontWeight: '700', color: theme.text },
  }), [theme]);

  return (
    <View style={s.container}>
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
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            extraData={[sceneH, activeIndex, elapsed, finished]}
          />
        )}
      </View>

      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        {status === 'ready' && cards.length > 0 && (
          <View style={s.segments}>
            {cards.map((c, i) => (
              <View key={c.id} style={s.segment}>
                <View
                  style={[s.segFill, {
                    width: i < activeIndex ? '100%'
                      : i === activeIndex ? `${Math.min(100, (elapsed / Math.max(duration, 1)) * 100)}%`
                      : '0%',
                  }]}
                />
              </View>
            ))}
          </View>
        )}
        <View style={s.controls} pointerEvents="box-none">
          <TouchableOpacity style={s.roundBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.voiceBtn} onPress={toggleVoice} activeOpacity={0.8}>
            <Text style={s.voiceTxt}>{voiceGender === 'female' ? 'Her voice' : 'His voice'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {paused && (
        <View style={s.pausedTag} pointerEvents="none">
          <Text style={s.pausedTxt}>Paused — release to continue</Text>
        </View>
      )}

      {ended && (
        <View style={s.endWrap}>
          <Ionicons name="checkmark-circle" size={48} color={theme.primary} />
          <Text style={s.endTitle}>Section complete</Text>
          <View style={s.endRow}>
            <TouchableOpacity style={s.endBtn} onPress={replay} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color={theme.text} />
              <Text style={s.endBtnTxt}>Replay</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.endBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={16} color={theme.text} />
              <Text style={s.endBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
