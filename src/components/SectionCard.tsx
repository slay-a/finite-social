import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SectionCardData } from '../types';

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
      <View style={s.footer}>
        <Text style={s.counter}>{index + 1} / {total}</Text>
        <Text style={s.counter}>{index + 1 < total ? 'swipe up' : 'section done'}</Text>
      </View>
    </View>
  );
}
