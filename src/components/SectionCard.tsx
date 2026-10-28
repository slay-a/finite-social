import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Article, CardQuiz, CardVisual, SectionCardData } from '../types';
import ExplainSheet from './ExplainSheet';
import RichText, { renderMath } from './RichText';

interface Props {
  card: SectionCardData;
  height: number;
  index: number;
  total: number;
  sectionLabel: string;
}

type Block = { kind: 'paragraph' | 'bullet' | 'math'; text: string };

// The model sometimes packs bullets inline after a colon or sentence. Break
// them out so the card reads as a list, never a lump.
function normalizeBody(body: string): string {
  return body
    .replace(/([.:;)])\s+-\s+(?=\S)/g, '$1\n- ')
    .replace(/\s+-\s+(?=\*\*)/g, '\n- ');
}

function parseBody(body: string): Block[] {
  return normalizeBody(body)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): Block => {
      const displayMath = line.match(/^\$\$(.+)\$\$$/);
      if (displayMath) return { kind: 'math', text: renderMath(displayMath[1]) };
      if (line.startsWith('- ')) return { kind: 'bullet', text: line.slice(2) };
      return { kind: 'paragraph', text: line };
    });
}

// ─── Visuals ──────────────────────────────────────────────────────────────────

function Visual({ visual }: { visual: CardVisual }) {
  const theme = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap:      { marginTop: 16, gap: 8 },
    step:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    stepNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' },
    stepNumT:  { fontSize: 11, fontWeight: '800', color: theme.primary },
    stepText:  { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
    arrow:     { alignSelf: 'center', marginVertical: -4 },
    loopNote:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 2 },
    loopText:  { fontSize: 12, color: theme.textDim, fontWeight: '600' },
    compare:   { flexDirection: 'row', gap: 10, marginTop: 16 },
    side:      { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 6 },
    sideLabel: { fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    sidePoint: { fontSize: 13, lineHeight: 18, color: theme.textSub },
    gridWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    gridItem:  { width: '47%', flexGrow: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 4 },
    gridLabel: { fontSize: 13, fontWeight: '800', color: theme.text },
    gridText:  { fontSize: 12, lineHeight: 17, color: theme.textSub },
    tlRow:     { flexDirection: 'row', gap: 12 },
    tlRail:    { width: 20, alignItems: 'center' },
    tlDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary, marginTop: 4 },
    tlLine:    { flex: 1, width: 2, backgroundColor: theme.border },
    tlBody:    { flex: 1, paddingBottom: 14, gap: 2 },
    tlLabel:   { fontSize: 12, fontWeight: '800', color: theme.primary },
    tlText:    { fontSize: 13, lineHeight: 18, color: theme.textSub },
    statsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    statTile:  { flexGrow: 1, minWidth: '40%', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 24, fontWeight: '800', color: theme.primary, letterSpacing: -0.5 },
    statLabel: { fontSize: 12, color: theme.textMuted, textAlign: 'center' },
  }), [theme]);

  if ((visual.type === 'flow' || visual.type === 'cycle') && visual.steps?.length) {
    return (
      <View style={s.wrap}>
        {visual.steps.map((step, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Ionicons name="arrow-down" size={14} color={theme.textDim} style={s.arrow} />}
            <View style={s.step}>
              <View style={s.stepNum}><Text style={s.stepNumT}>{i + 1}</Text></View>
              <RichText text={step} style={s.stepText} />
            </View>
          </React.Fragment>
        ))}
        {visual.type === 'cycle' && (
          <View style={s.loopNote}>
            <Ionicons name="repeat" size={14} color={theme.textDim} />
            <Text style={s.loopText}>repeats</Text>
          </View>
        )}
      </View>
    );
  }
  if (visual.type === 'compare' && visual.left && visual.right) {
    return (
      <View style={s.compare}>
        {[visual.left, visual.right].map((side, i) => (
          <View key={i} style={s.side}>
            <Text style={s.sideLabel}>{side.label}</Text>
            {side.points.map((p, j) => (
              <RichText key={j} text={`• ${p}`} style={s.sidePoint} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (visual.type === 'grid' && visual.items?.length) {
    return (
      <View style={s.gridWrap}>
        {visual.items.map((it, i) => (
          <View key={i} style={s.gridItem}>
            <Text style={s.gridLabel}>{it.label}</Text>
            <RichText text={it.text ?? ''} style={s.gridText} />
          </View>
        ))}
      </View>
    );
  }
  if (visual.type === 'timeline' && visual.items?.length) {
    return (
      <View style={{ marginTop: 16 }}>
        {visual.items.map((it, i) => (
          <View key={i} style={s.tlRow}>
            <View style={s.tlRail}>
              <View style={s.tlDot} />
              {i < visual.items!.length - 1 && <View style={s.tlLine} />}
            </View>
            <View style={s.tlBody}>
              <Text style={s.tlLabel}>{it.label}</Text>
              <RichText text={it.text ?? ''} style={s.tlText} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (visual.type === 'stats' && visual.items?.length) {
    return (
      <View style={s.statsWrap}>
        {visual.items.map((it, i) => (
          <View key={i} style={s.statTile}>
            <Text style={s.statValue}>{it.value}</Text>
            <Text style={s.statLabel}>{it.label}</Text>
          </View>
        ))}
      </View>
    );
  }
  return null;
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

function Quiz({ quiz }: { quiz: CardQuiz }) {
  const theme = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  const s = useMemo(() => StyleSheet.create({
    question: { fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 28, marginBottom: 18 },
    option:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 },
    optText:  { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text, lineHeight: 21 },
    why:      { marginTop: 10, fontSize: 14, lineHeight: 20, color: theme.textSub },
    result:   { marginTop: 6, fontSize: 15, fontWeight: '800' },
  }), [theme]);

  return (
    <View>
      <RichText text={quiz.question} style={s.question} />
      {quiz.options.map((opt, i) => {
        const isCorrect = i === quiz.answer;
        const isPicked = i === picked;
        const border = !answered ? theme.border
          : isCorrect ? theme.accent
          : isPicked ? theme.danger
          : theme.border;
        return (
          <TouchableOpacity
            key={i}
            style={[s.option, { borderColor: border }]}
            disabled={answered}
            activeOpacity={0.8}
            onPress={() => {
              setPicked(i);
              Haptics.notificationAsync(
                i === quiz.answer
                  ? Haptics.NotificationFeedbackType.Success
                  : Haptics.NotificationFeedbackType.Error,
              );
            }}
          >
            <Ionicons
              name={!answered ? 'ellipse-outline' : isCorrect ? 'checkmark-circle' : isPicked ? 'close-circle' : 'ellipse-outline'}
              size={20}
              color={!answered ? theme.textDim : isCorrect ? theme.accent : isPicked ? theme.danger : theme.textDim}
            />
            <RichText text={opt} style={s.optText} />
          </TouchableOpacity>
        );
      })}
      {answered && (
        <>
          <Text style={[s.result, { color: picked === quiz.answer ? theme.accent : theme.danger }]}>
            {picked === quiz.answer ? 'Correct' : 'Not quite'}
          </Text>
          {quiz.why ? <RichText text={quiz.why} style={s.why} /> : null}
        </>
      )}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function SectionCard({ card, height, index, total, sectionLabel }: Props) {
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const blocks = useMemo(() => parseBody(card.body), [card.body]);
  const [explainVisible, setExplainVisible] = useState(false);

  // ExplainSheet only reads title/summary, so a study card wears the Article shape.
  const explainArticle = useMemo((): Article => ({
    id: card.id,
    source: 'rss',
    title: card.kind === 'quiz' && card.quiz ? card.quiz.question : card.title,
    summary: card.body,
    url: '',
    author: '',
    tags: [],
    category: 'Dev',
    publishedAt: new Date().toISOString(),
  }), [card]);

  const s = useMemo(() => StyleSheet.create({
    card:      { height, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center', backgroundColor: theme.bg },
    content:   { overflow: 'hidden', flexShrink: 1 },
    label:     { fontSize: 12, fontWeight: '700', color: theme.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
    title:     { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginBottom: 18, lineHeight: 32 },
    paragraph: { fontSize: 16, lineHeight: 25, color: theme.textSub, marginBottom: 14 },
    mathLine:  { fontSize: 20, lineHeight: 30, color: theme.text, fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
    bulletRow: { flexDirection: 'row', marginBottom: 10, paddingRight: 8 },
    bulletDot: { fontSize: 16, lineHeight: 25, color: theme.primary, marginRight: 8 },
    bold:      { fontWeight: '700', color: theme.text },
    footer:    { position: 'absolute', bottom: 28, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    counter:   { fontSize: 12, color: theme.textDim, fontWeight: '600' },
    explainBtn:{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
    explainTxt:{ fontSize: 12, fontWeight: '700', color: theme.textSub },
    figImage:  { width: '100%', borderRadius: 14, backgroundColor: '#fff' },
    figCaption:{ marginTop: 12, fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  }), [theme, height]);

  const figure = card.kind === 'figure' ? card.figure : null;
  const figHeight = figure?.width && figure?.height
    ? Math.min((screenW - 48) * (figure.height / figure.width), height * 0.65)
    : height * 0.45;

  return (
    <View style={s.card}>
      <View style={s.content}>
        <Text style={s.label} numberOfLines={2}>{sectionLabel}</Text>

        {card.kind === 'quiz' && card.quiz ? (
          <Quiz quiz={card.quiz} />
        ) : card.kind === 'figure' && figure?.signedUrl ? (
          <>
            <RichText text={card.title} style={s.title} boldStyle={s.bold} />
            <Image source={{ uri: figure.signedUrl }} style={[s.figImage, { height: figHeight }]} resizeMode="contain" />
            <Text style={s.figCaption}>Straight from the book, page {figure.page + 1}.</Text>
          </>
        ) : (
          <>
            <RichText text={card.title} style={s.title} boldStyle={s.bold} />
            {blocks.map((block, i) =>
              block.kind === 'bullet' ? (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <RichText text={block.text} style={[s.paragraph, { marginBottom: 0 }]} boldStyle={s.bold} />
                </View>
              ) : block.kind === 'math' ? (
                <Text key={i} style={s.mathLine}>{block.text}</Text>
              ) : (
                <RichText key={i} text={block.text} style={s.paragraph} boldStyle={s.bold} />
              ),
            )}
            {card.visual ? <Visual visual={card.visual} /> : null}
          </>
        )}
      </View>

      <View style={s.footer}>
        <Text style={s.counter}>{index + 1} / {total}</Text>
        {card.kind !== 'figure' && (
          <TouchableOpacity
            style={s.explainBtn}
            activeOpacity={0.8}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExplainVisible(true);
            }}
          >
            <Text style={s.explainTxt}>Explain</Text>
          </TouchableOpacity>
        )}
        <Text style={s.counter}>{index + 1 < total ? 'swipe up' : 'section done'}</Text>
      </View>

      <ExplainSheet
        article={explainArticle}
        visible={explainVisible}
        onClose={() => setExplainVisible(false)}
      />
    </View>
  );
}
