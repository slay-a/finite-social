import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { CardVisual, SectionCardData } from '../types';

interface Props {
  card: SectionCardData;
  height: number;
  index: number;
  total: number;
  sectionLabel: string;
}

type Block =
  | { kind: 'paragraph'; parts: Array<{ text: string; bold: boolean }> }
  | { kind: 'bullet'; parts: Array<{ text: string; bold: boolean }> };

// Tiny renderer for the subset of markdown the generator emits: **bold** and
// "- " bullets. Keeps the card dependency-free.
function parseBody(body: string): Block[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): Block => {
      const isBullet = line.startsWith('- ');
      const text = isBullet ? line.slice(2) : line;
      const parts = text.split(/\*\*/).map((chunk, i) => ({ text: chunk, bold: i % 2 === 1 }));
      return { kind: isBullet ? 'bullet' : 'paragraph', parts };
    });
}

function Visual({ visual }: { visual: CardVisual }) {
  const theme = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap:      { marginTop: 16, gap: 8 },
    step:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    stepNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' },
    stepNumT:  { fontSize: 11, fontWeight: '800', color: theme.primary },
    stepText:  { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
    arrow:     { alignSelf: 'center', marginVertical: -4 },
    compare:   { flexDirection: 'row', gap: 10, marginTop: 16 },
    side:      { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 6 },
    sideLabel: { fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    sidePoint: { fontSize: 13, lineHeight: 18, color: theme.textSub },
  }), [theme]);

  if (visual.type === 'flow' && visual.steps?.length) {
    return (
      <View style={s.wrap}>
        {visual.steps.map((step, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Ionicons name="arrow-down" size={14} color={theme.textDim} style={s.arrow} />}
            <View style={s.step}>
              <View style={s.stepNum}><Text style={s.stepNumT}>{i + 1}</Text></View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    );
  }
  if (visual.type === 'compare' && visual.left && visual.right) {
    return (
      <View style={s.compare}>
        {[visual.left, visual.right].map((side, i) => (
          <View key={i} style={s.side}>
            <Text style={s.sideLabel}>{side.label}</Text>
            {side.points.map((p, j) => <Text key={j} style={s.sidePoint}>• {p}</Text>)}
          </View>
        ))}
      </View>
    );
  }
  return null;
}

export default function SectionCard({ card, height, index, total, sectionLabel }: Props) {
  const theme = useTheme();
  const blocks = useMemo(() => parseBody(card.body), [card.body]);

  const s = useMemo(() => StyleSheet.create({
    card:      { height, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center', backgroundColor: theme.bg },
    label:     { fontSize: 12, fontWeight: '700', color: theme.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
    title:     { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginBottom: 18, lineHeight: 32 },
    paragraph: { fontSize: 16, lineHeight: 25, color: theme.textSub, marginBottom: 12 },
    bulletRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 8 },
    bulletDot: { fontSize: 16, lineHeight: 25, color: theme.primary, marginRight: 8 },
    bold:      { fontWeight: '700', color: theme.text },
    footer:    { position: 'absolute', bottom: 28, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between' },
    counter:   { fontSize: 12, color: theme.textDim, fontWeight: '600' },
  }), [theme, height]);

  return (
    <View style={s.card}>
      <Text style={s.label}>{sectionLabel}</Text>
      <Text style={s.title}>{card.title}</Text>
      {blocks.map((block, i) =>
        block.kind === 'bullet' ? (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.paragraph}>
              {block.parts.map((p, j) => (
                <Text key={j} style={p.bold ? s.bold : undefined}>{p.text}</Text>
              ))}
            </Text>
          </View>
        ) : (
          <Text key={i} style={s.paragraph}>
            {block.parts.map((p, j) => (
              <Text key={j} style={p.bold ? s.bold : undefined}>{p.text}</Text>
            ))}
          </Text>
        ),
      )}
      {card.visual ? <Visual visual={card.visual} /> : null}
      <View style={s.footer}>
        <Text style={s.counter}>{index + 1} / {total}</Text>
        <Text style={s.counter}>{index + 1 < total ? 'swipe up' : 'section done'}</Text>
      </View>
    </View>
  );
}
