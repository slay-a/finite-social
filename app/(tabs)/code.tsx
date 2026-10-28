import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, ViewToken, Modal, TextInput,
  KeyboardAvoidingView, Platform, Animated, Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { Theme } from '../../src/theme/themes';
import {
  getProblems, getExplanation, getCuratedProblems,
  LeetcodeProblem, LeetcodeExplanation, Difficulty, ProblemSet,
} from '../../src/lib/leetcodeApi';
import { NEETCODE_TOPICS, NeetcodeTopic } from '../../src/lib/neetcodeData';
import { callOpenAI, ChatMessage } from '../../src/lib/aiService';

// ─── Difficulty helpers ───────────────────────────────────────────────────────

const DIFF_COLOR = { Easy: '#39D353', Medium: '#F7C94B', Hard: '#FF6B70' } as const;

// ─── Style cache ──────────────────────────────────────────────────────────────

const cardStyleCache = new Map<string, StyleSheet.NamedStyles<any>>();
function getCardStyles(theme: Theme, height: number) {
  const key = `${theme.id}-${height}`;
  let s = cardStyleCache.get(key);
  if (s) return s;
  s = StyleSheet.create({
    card:        { height, backgroundColor: theme.card, overflow: 'hidden' },
    top:         { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingBottom: 8 },
    diffBadge:   { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
    diffText:    { fontSize: 12, fontWeight: '700' },
    problemNum:  { fontSize: 13, color: theme.textDim, fontWeight: '600' },
    acRate:      { fontSize: 12, color: theme.textDim, marginLeft: 'auto' as any },
    body:        { flex: 1, paddingHorizontal: 16, paddingTop: 6, gap: 14 },
    title:       { fontSize: 24, fontWeight: '800', color: theme.text, lineHeight: 31, letterSpacing: -0.4 },
    tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    tagChip:     { backgroundColor: theme.surface, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    tagText:     { fontSize: 12, color: theme.textMuted },
    divider:     { height: 1, backgroundColor: theme.border },
    section:     { gap: 6 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    sectionLabel:{ fontSize: 12, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    sectionText: { fontSize: 15, color: theme.textSub, lineHeight: 23 },
    complexity:  { fontSize: 13, fontWeight: '600', color: theme.primary },
    loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { fontSize: 13, color: theme.textMuted },
    errorText:   { fontSize: 13, color: theme.textMuted, textAlign: 'center', padding: 16 },
    bottomBar:   { borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    askBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: theme.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
    askTxt:      { fontSize: 13, fontWeight: '700', color: theme.primary },
    practiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 'auto' as any },
    practiceTxt: { fontSize: 13, fontWeight: '700', color: theme.bg },
    hint:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    hintTitle:   { fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
    hintBody:    { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },
    progressStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: `${theme.surface}88` },
    progressPos:   { fontSize: 11, fontWeight: '700', color: theme.textDim, letterSpacing: 0.3 },
    progressCounts:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
    progressDiff:  { fontSize: 11, fontWeight: '700' },
    progressLeft:  { fontSize: 11, color: theme.textDim },
  });
  cardStyleCache.set(key, s);
  return s;
}

// ─── LeetCode AI Coach sheet ──────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');
const QUICK_HINTS = ['Give me a hint', 'Show pseudocode', 'Python template', 'Explain complexity'];

interface ChatSheetProps {
  problem: LeetcodeProblem;
  explanation: LeetcodeExplanation | null;
  visible: boolean;
  onClose: () => void;
}

function LeetCodeChatSheet({ problem, explanation, visible, onClose }: ChatSheetProps) {
  const theme = useTheme();
  const diffColor = DIFF_COLOR[problem.difficulty];
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  type Msg = { role: 'user' | 'assistant'; content: string };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
      if (messages.length === 0) {
        const greeting = explanation
          ? `Ready to help with **${problem.title}**! I can see the key insight is: ${explanation.insight}. Ask me for a hint, pseudocode, or a code template.`
          : `Let's work through **${problem.title}** (${problem.difficulty}). Ask me for a hint, the approach, or a code template!`;
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => { setMessages([]); setChatError(null); }, [problem.id]);

  const systemPrompt = useMemo((): string => {
    const ctx = explanation
      ? `\nContext already shown to user:\n- What: ${explanation.what}\n- Insight: ${explanation.insight}\n- Approach: ${explanation.approach}\n- Complexity: ${explanation.complexity}`
      : '';
    return `You are a LeetCode interview coach helping solve "${problem.title}" (${problem.difficulty}).${ctx}\n\nGive hints before full solutions unless explicitly asked. Use examples and pseudocode. Keep responses concise.`;
  }, [problem.id, explanation]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Msg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setAiLoading(true);
    setChatError(null);
    try {
      const history: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updated.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const reply = await callOpenAI(history, undefined, 500);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setChatError(
        msg.includes('NO_KEY') ? 'API key not configured.' :
        msg.includes('401')    ? 'Invalid API key.' :
        msg.includes('429')    ? 'Rate limit hit. Try again shortly.' :
        'Could not connect. Check your connection.'
      );
    } finally {
      setAiLoading(false);
    }
  }, [messages, systemPrompt]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || aiLoading) return;
    setInput('');
    inputRef.current?.blur();
    await sendMessage(text);
  }, [input, aiLoading, sendMessage]);

  const s = useMemo(() => StyleSheet.create({
    backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: SCREEN_H * 0.78, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 24 },
    handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 },
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${diffColor}22` },
    headerText:  { flex: 1 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: theme.text },
    headerSub:   { fontSize: 12, color: theme.textMuted, marginTop: 1 },
    closeBtn:    { padding: 6 },
    chatScroll:  { flex: 1 },
    chatContent: { padding: 16 },
    bubble:      { borderRadius: 14, padding: 12, marginBottom: 10 },
    aiBubble:    { backgroundColor: theme.surface, alignSelf: 'flex-start', maxWidth: '92%', borderBottomLeftRadius: 4 },
    userBubble:  { backgroundColor: `${theme.primary}22`, alignSelf: 'flex-end', maxWidth: '92%', borderBottomRightRadius: 4 },
    bubbleText:  { fontSize: 14, color: theme.text, lineHeight: 21 },
    userText:    { color: theme.textSub },
    aiLabel:     { fontSize: 10, fontWeight: '800', color: diffColor, letterSpacing: 0.5, marginBottom: 4 },
    thinkRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    thinkText:   { fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
    errorBox:    { flexDirection: 'row', gap: 8, backgroundColor: `${theme.danger}18`, borderRadius: 10, padding: 12, marginBottom: 10 },
    errorTxt:    { flex: 1, fontSize: 13, color: theme.danger },
    hintsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
    hintChip:    { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
    hintText:    { fontSize: 12, fontWeight: '600', color: theme.textSub },
    inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
    textInput:   { flex: 1, backgroundColor: theme.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: theme.text },
    sendBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnOff:  { backgroundColor: theme.border },
  }), [theme, diffColor]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View style={s.handle} />
            <View style={s.header}>
              <View style={s.headerIcon}>
                <Ionicons name="bulb-outline" size={18} color={diffColor} />
              </View>
              <View style={s.headerText}>
                <Text style={s.headerTitle} numberOfLines={1}>{problem.title}</Text>
                <Text style={s.headerSub}>AI Coach · {problem.difficulty}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} style={s.chatScroll} contentContainerStyle={s.chatContent} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive">
              {messages.map((msg, i) => (
                <View key={i} style={[s.bubble, msg.role === 'assistant' ? s.aiBubble : s.userBubble]}>
                  {msg.role === 'assistant' && <Text style={s.aiLabel}>COACH</Text>}
                  <Text style={[s.bubbleText, msg.role === 'user' && s.userText]}>{msg.content}</Text>
                </View>
              ))}
              {aiLoading && (
                <View style={s.thinkRow}>
                  <ActivityIndicator size="small" color={diffColor} />
                  <Text style={s.thinkText}>Thinking…</Text>
                </View>
              )}
              {chatError && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                  <Text style={s.errorTxt}>{chatError}</Text>
                </View>
              )}
            </ScrollView>

            {messages.length <= 1 && (
              <View style={s.hintsRow}>
                {QUICK_HINTS.map((h) => (
                  <TouchableOpacity key={h} style={s.hintChip} onPress={() => sendMessage(h)} activeOpacity={0.75}>
                    <Text style={s.hintText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                style={s.textInput}
                placeholder="Ask anything…"
                placeholderTextColor={theme.textDim}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!aiLoading}
                multiline={false}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || aiLoading) && s.sendBtnOff]}
                onPress={handleSend}
                disabled={!input.trim() || aiLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-up" size={15} color={theme.bg} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ─── Problem card ─────────────────────────────────────────────────────────────

interface DiffCounts { easy: number; medium: number; hard: number; }

interface CardProps {
  problem: LeetcodeProblem;
  height: number;
  position?: number;
  total?: number;
  diffCounts?: DiffCounts;
}

type ExplainState =
  | { status: 'loading' }
  | { status: 'ok'; data: LeetcodeExplanation }
  | { status: 'error'; message: string };

function ProblemCardInner({ problem, height, position, total, diffCounts }: CardProps) {
  const theme = useTheme();
  const s = getCardStyles(theme, height);
  const diffColor = DIFF_COLOR[problem.difficulty];

  const [explainState, setExplainState] = useState<ExplainState>({ status: 'loading' });
  const [coachVisible, setCoachVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setExplainState({ status: 'loading' });
    getExplanation(problem)
      .then((data) => { if (!cancelled) setExplainState({ status: 'ok', data }); })
      .catch((e: unknown) => {
        if (!cancelled) setExplainState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => { cancelled = true; };
  }, [problem.id]);

  const explanation = explainState.status === 'ok' ? explainState.data : null;

  const openOnLeetcode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`https://leetcode.com/problems/${problem.slug}/`);
  }, [problem.slug]);

  const sections = useMemo(() => {
    if (!explanation) return [];
    return [
      { icon: 'help-circle-outline' as const, label: 'What it asks', text: explanation.what },
      { icon: 'bulb-outline'        as const, label: 'Key insight',  text: explanation.insight },
      { icon: 'git-branch-outline'  as const, label: 'Approach',     text: explanation.approach },
    ].filter((s) => s.text);
  }, [explanation]);

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.top}>
        <View style={[s.diffBadge, { backgroundColor: `${diffColor}22` }]}>
          <Text style={[s.diffText, { color: diffColor }]}>{problem.difficulty}</Text>
        </View>
        <Text style={s.problemNum}>#{problem.id}</Text>
        {problem.acRate != null && (
          <Text style={s.acRate}>{problem.acRate}% acceptance</Text>
        )}
      </View>

      {/* Progress strip */}
      {position != null && total != null && diffCounts != null && (
        <View style={s.progressStrip}>
          <Text style={s.progressPos}>{position} of {total}</Text>
          <View style={s.progressCounts}>
            {diffCounts.easy > 0 && <Text style={[s.progressDiff, { color: DIFF_COLOR.Easy }]}>{diffCounts.easy}E</Text>}
            {diffCounts.medium > 0 && <Text style={[s.progressDiff, { color: DIFF_COLOR.Medium }]}>{diffCounts.medium}M</Text>}
            {diffCounts.hard > 0 && <Text style={[s.progressDiff, { color: DIFF_COLOR.Hard }]}>{diffCounts.hard}H</Text>}
            <Text style={s.progressLeft}>· {total - position} left</Text>
          </View>
        </View>
      )}

      {/* Body */}
      <View style={s.body}>
        <Text style={s.title}>{problem.title}</Text>

        {problem.slug && (
          <View style={s.tagsRow}>
            {problem.slug.split('-').slice(0, 4).map((tag) => (
              <View key={tag} style={s.tagChip}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.divider} />

        <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {explainState.status === 'loading' ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={theme.primary} />
              <Text style={s.loadingText}>Generating explanation…</Text>
            </View>
          ) : explainState.status === 'error' ? (
            <Text style={s.errorText}>{explainState.message || 'Couldn\'t load explanation.'}</Text>
          ) : (
            <>
              {sections.map((sec) => (
                <View key={sec.label} style={s.section}>
                  <View style={s.sectionHead}>
                    <Ionicons name={sec.icon} size={13} color={theme.textMuted} />
                    <Text style={s.sectionLabel}>{sec.label}</Text>
                  </View>
                  <Text style={s.sectionText}>{sec.text}</Text>
                </View>
              ))}
              {explanation?.complexity ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Ionicons name="time-outline" size={13} color={theme.primary} />
                  <Text style={s.complexity}>{explanation.complexity}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCoachVisible(true); }}
          style={s.askBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="bulb-outline" size={14} color={theme.primary} />
          <Text style={s.askTxt}>Ask AI</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openOnLeetcode} style={s.practiceBtn} activeOpacity={0.85}>
          <Text style={s.practiceTxt}>Practice</Text>
          <Ionicons name="arrow-forward" size={13} color={theme.bg} />
        </TouchableOpacity>
      </View>

      <LeetCodeChatSheet
        problem={problem}
        explanation={explanation}
        visible={coachVisible}
        onClose={() => setCoachVisible(false)}
      />
    </View>
  );
}

const ProblemCard = React.memo(ProblemCardInner, (prev, next) =>
  prev.problem.id === next.problem.id &&
  prev.height     === next.height &&
  prev.position   === next.position &&
  prev.total      === next.total &&
  prev.diffCounts?.easy   === next.diffCounts?.easy &&
  prev.diffCounts?.medium === next.diffCounts?.medium &&
  prev.diffCounts?.hard   === next.diffCounts?.hard
);

// ─── Filter pill ──────────────────────────────────────────────────────────────

function DiffPill({
  label, active, onPress,
}: { label: Difficulty | 'All'; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = label === 'All' ? theme.primary : DIFF_COLOR[label as Difficulty];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
        backgroundColor: active ? color : `${color}18`,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : color }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CodeScreen() {
  const theme = useTheme();
  const cardHRef = useRef(0);
  const [listH, setListH] = useState(0);
  const problemsRef = useRef<LeetcodeProblem[]>([]);
  const diffCountsRef = useRef<DiffCounts>({ easy: 0, medium: 0, hard: 0 });

  const [problemSet, setProblemSet] = useState<ProblemSet>('All');
  const [topic, setTopic] = useState<NeetcodeTopic | 'All'>('All');
  const [difficulty, setDifficulty] = useState<Difficulty | 'All'>('All');
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);

  const [problems, setProblems] = useState<LeetcodeProblem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (
    set: ProblemSet, top: NeetcodeTopic | 'All', diff: Difficulty | 'All',
    pg: number, replace: boolean,
  ) => {
    if (pg === 0) setLoading(true);
    setError(null);
    try {
      let items: LeetcodeProblem[];
      if (set === 'All') {
        items = await getProblems(diff, pg, 15);
        setHasMore(items.length === 15);
      } else {
        items = await getCuratedProblems(set, top, diff);
        setHasMore(false); // curated lists are fully loaded at once
      }
      setProblems((prev) => replace ? items : [...prev, ...items]);
      setPage(pg);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load problems. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setProblems([]);
    setPage(0);
    setHasMore(true);
    load(problemSet, topic, difficulty, 0, true);
  }, [problemSet, topic, difficulty]);

  useEffect(() => {
    problemsRef.current = problems;
    diffCountsRef.current = {
      easy:   problems.filter((p) => p.difficulty === 'Easy').length,
      medium: problems.filter((p) => p.difficulty === 'Medium').length,
      hard:   problems.filter((p) => p.difficulty === 'Hard').length,
    };
  }, [problems]);

  const loadMore = useCallback(() => {
    if (!hasMore || problemSet !== 'All') return;
    load(problemSet, topic, difficulty, page + 1, false);
  }, [hasMore, problemSet, topic, difficulty, page, load]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: LeetcodeProblem; index: number }) => (
      <ProblemCard
        problem={item}
        height={cardHRef.current}
        position={index + 1}
        total={problemsRef.current.length}
        diffCounts={diffCountsRef.current}
      />
    ),
    []
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: cardHRef.current, offset: cardHRef.current * index, index,
    }),
    []
  );

  const keyExtractor = useCallback((item: LeetcodeProblem) => String(item.id), []);

  const s = useMemo(() => StyleSheet.create({
    header:      { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 10 },
    headerTop:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
    subtitle:    { fontSize: 12, color: theme.textDim, marginLeft: 6, marginTop: 2 },
    setRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    setPill:     { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
    setPillText: { fontSize: 13, fontWeight: '700' },
    filterRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, alignItems: 'center' },
    topicBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.border },
    topicBtnTxt: { fontSize: 13, fontWeight: '600', color: theme.textSub },
    centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
    errorText:   { fontSize: 15, color: theme.textMuted, textAlign: 'center' },
    retryBtn:    { backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
    retryText:   { fontSize: 14, fontWeight: '700', color: theme.bg },
    // Topic picker modal
    pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    pickerSheet:    { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
    pickerHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
    pickerTitle:    { fontSize: 16, fontWeight: '800', color: theme.text, paddingHorizontal: 20, paddingVertical: 12 },
    pickerItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.border },
    pickerItemText: { fontSize: 15, color: theme.text, flex: 1 },
    pickerCheck:    { marginLeft: 8 },
  }), [theme]);

  const SET_OPTIONS: ProblemSet[] = ['All', 'LeetCode 150', 'LeetCode 75'];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>LeetCode</Text>
          <Text style={s.subtitle}>swipe to study</Text>
        </View>

        {/* Problem set selector */}
        <View style={s.setRow}>
          {SET_OPTIONS.map((opt) => {
            const active = problemSet === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[s.setPill, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : 'transparent' }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setProblemSet(opt); setTopic('All'); }}
                activeOpacity={0.75}
              >
                <Text style={[s.setPillText, { color: active ? theme.primary : theme.textMuted }]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Topic + difficulty row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {problemSet !== 'All' && (
            <TouchableOpacity
              style={[s.topicBtn, topic !== 'All' && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }]}
              onPress={() => setTopicPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.topicBtnTxt, topic !== 'All' && { color: theme.primary }]}>
                {topic === 'All' ? 'All Topics' : topic}
              </Text>
              <Ionicons name="chevron-down" size={13} color={topic !== 'All' ? theme.primary : theme.textDim} />
            </TouchableOpacity>
          )}
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
            <DiffPill key={d} label={d} active={difficulty === d} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDifficulty(d); }} />
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* Topic picker modal */}
      <Modal visible={topicPickerVisible} animationType="slide" transparent onRequestClose={() => setTopicPickerVisible(false)}>
        <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setTopicPickerVisible(false)}>
          <SafeAreaView edges={['bottom']} style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Topic</Text>
            <ScrollView>
              {(['All', ...NEETCODE_TOPICS] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={s.pickerItem}
                  onPress={() => { setTopic(t as NeetcodeTopic | 'All'); setTopicPickerVisible(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pickerItemText, topic === t && { color: theme.primary, fontWeight: '700' }]}>
                    {t === 'All' ? 'All Topics' : t}
                  </Text>
                  {topic === t && <Ionicons name="checkmark" size={18} color={theme.primary} style={s.pickerCheck} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={[s.centered, { flex: 1 }]}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={s.errorText}>Loading problems…</Text>
        </View>
      ) : error ? (
        <View style={[s.centered, { flex: 1 }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textDim} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load(problemSet, topic, difficulty, 0, true)} activeOpacity={0.8}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== cardHRef.current) {
              cardHRef.current = h;
              setListH(h);
            }
          }}
        >
          {listH > 0 && (
            <FlatList
              data={problems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              onEndReached={loadMore}
              onEndReachedThreshold={3}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              removeClippedSubviews
              windowSize={3}
              maxToRenderPerBatch={2}
              initialNumToRender={2}
              extraData={listH}
            />
          )}
        </View>
      )}
    </View>
  );
}
