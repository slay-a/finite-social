import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { ReelEdge, ReelNode, ReelScene, SectionCardData } from '../types';
import RichText from './RichText';
import { wordTimings } from '../lib/watchScript';

interface Props {
  scene: ReelScene;
  figureCard?: SectionCardData;
  height: number;
  width: number;
  elapsedMs: number;
  durationMs: number;
  active: boolean;
}

// ── Animation primitives ──────────────────────────────────────────────────────

function Pop({ shown, children, style }: { shown: boolean; children: React.ReactNode; style?: ViewStyle }) {
  const anim = useRef(new Animated.Value(0)).current;
  const played = useRef(false);
  useEffect(() => {
    if (shown && !played.current) {
      played.current = true;
      Animated.spring(anim, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    } else if (!shown && played.current) {
      played.current = false;
      anim.setValue(0);
    }
  }, [shown, anim]);
  return (
    <Animated.View
      style={[style, {
        opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

function Rise({ shown, children, style }: { shown: boolean; children: React.ReactNode; style?: ViewStyle }) {
  const anim = useRef(new Animated.Value(0)).current;
  const played = useRef(false);
  useEffect(() => {
    if (shown && !played.current) {
      played.current = true;
      Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    } else if (!shown && played.current) {
      played.current = false;
      anim.setValue(0);
    }
  }, [shown, anim]);
  return (
    <Animated.View
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

function KenBurns({ active, children }: { active: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      Animated.timing(scale, { toValue: 1.06, duration: 9000, useNativeDriver: true }).start();
    } else {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [active, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function DottedBackground({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse">
          <Circle cx={2} cy={2} r={1.3} fill={color} opacity={0.45} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
}

// ── Diagram layout (deterministic, no measurement) ────────────────────────────

const NODE_H = 54;
const NODE_GAP = 12;
const ROW_GAP = 46;

interface NodePos { x: number; y: number; w: number; h: number }

function layoutNodes(nodes: ReelNode[], canvasW: number): { pos: Record<string, NodePos>; height: number } {
  const rowValues = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
  const pos: Record<string, NodePos> = {};
  rowValues.forEach((rowValue, rowIndex) => {
    const rowNodes = nodes.filter((n) => n.row === rowValue);
    const k = rowNodes.length;
    const w = Math.min(230, (canvasW - (k - 1) * NODE_GAP) / k);
    const totalW = k * w + (k - 1) * NODE_GAP;
    const xStart = (canvasW - totalW) / 2;
    const y = rowIndex * (NODE_H + ROW_GAP);
    rowNodes.forEach((n, i) => {
      pos[n.id] = { x: xStart + i * (w + NODE_GAP), y, w, h: NODE_H };
    });
  });
  return { pos, height: rowValues.length * NODE_H + (rowValues.length - 1) * ROW_GAP };
}

function edgeGeometry(from: NodePos, to: NodePos): { x1: number; y1: number; x2: number; y2: number } {
  if (to.y > from.y + 10) {
    return { x1: from.x + from.w / 2, y1: from.y + from.h, x2: to.x + to.w / 2, y2: to.y - 2 };
  }
  if (from.y > to.y + 10) {
    return { x1: from.x + from.w / 2, y1: from.y, x2: to.x + to.w / 2, y2: to.y + to.h + 2 };
  }
  if (to.x > from.x) {
    return { x1: from.x + from.w, y1: from.y + from.h / 2, x2: to.x - 2, y2: to.y + to.h / 2 };
  }
  return { x1: from.x, y1: from.y + from.h / 2, x2: to.x + to.w + 2, y2: to.y + to.h / 2 };
}

function arrowHead(x2: number, y2: number, x1: number, y1: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 8;
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  return `M ${x2} ${y2} L ${x2 + len * Math.cos(a1)} ${y2 + len * Math.sin(a1)} M ${x2} ${y2} L ${x2 + len * Math.cos(a2)} ${y2 + len * Math.sin(a2)}`;
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export default function ReelSceneView({ scene, figureCard, height, width, elapsedMs, durationMs, active }: Props) {
  const theme = useTheme();
  const at = (fraction: number) => active && elapsedMs >= fraction * durationMs;

  const toneColors = useMemo(() => ({
    accent:  { bg: `${theme.primary}26`, border: theme.primary, text: theme.text },
    good:    { bg: `${theme.accent}26`, border: theme.accent, text: theme.text },
    bad:     { bg: `${theme.danger}26`, border: theme.danger, text: theme.text },
    neutral: { bg: theme.card, border: theme.border, text: theme.text },
  }), [theme]);

  const s = useMemo(() => StyleSheet.create({
    scene:     { height, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 80 },
    content:   { overflow: 'hidden', flexShrink: 1 },
    heading:   { fontSize: 13, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' },
    titleWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12 },
    titleWord: { fontSize: 42, lineHeight: 52, fontWeight: '800', color: theme.text, letterSpacing: -1 },
    titleAcc:  { color: theme.primary, fontStyle: 'italic' },
    point:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, marginBottom: 12 },
    pointDot:  { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary },
    pointText: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.text, lineHeight: 23 },
    node:      { position: 'absolute', borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    nodeText:  { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 17 },
    edgeLabel: { position: 'absolute', fontSize: 10, fontWeight: '700', color: theme.textMuted, backgroundColor: theme.bg, paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
    statValue: { fontSize: 76, fontWeight: '800', color: theme.primary, letterSpacing: -2, textAlign: 'center' },
    statLabel: { fontSize: 18, fontWeight: '600', color: theme.textSub, textAlign: 'center', marginTop: 8 },
    quoteCard: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 22 },
    quoteText: { fontSize: 22, lineHeight: 32, fontWeight: '700', color: theme.text, textAlign: 'center' },
    quoteSrc:  { marginTop: 12, fontSize: 13, color: theme.textMuted, textAlign: 'center' },
    figImage:  { width: '100%', borderRadius: 14, backgroundColor: '#fff' },
    figCaption:{ marginTop: 12, fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  }), [theme, height]);

  const canvasW = width - 48;

  const body = () => {
    if (scene.type === 'title') {
      const n = scene.words.length;
      return (
        <View style={s.titleWrap}>
          {scene.words.map((word, i) => (
            <Pop key={i} shown={at(0.05 + (i * 0.3) / n)}>
              <Text style={[s.titleWord, i === scene.accent && s.titleAcc]}>{word}</Text>
            </Pop>
          ))}
        </View>
      );
    }

    if (scene.type === 'points') {
      const n = scene.points.length;
      return (
        <>
          {scene.title ? (
            <Rise shown={at(0.02)}><Text style={s.heading}>{scene.title}</Text></Rise>
          ) : null}
          {scene.points.map((point, i) => (
            <Rise key={i} shown={at(0.14 + (i * 0.55) / n)}>
              <View style={s.point}>
                <View style={s.pointDot} />
                <RichText text={point} style={s.pointText} />
              </View>
            </Rise>
          ))}
        </>
      );
    }

    if (scene.type === 'diagram') {
      const { pos, height: diagramH } = layoutNodes(scene.nodes, canvasW);
      const nodeOrder = [...scene.nodes].sort((a, b) => a.row - b.row || pos[a.id].x - pos[b.id].x);
      const nodeShownAt: Record<string, number> = {};
      nodeOrder.forEach((n, i) => { nodeShownAt[n.id] = 0.08 + (i * 0.45) / nodeOrder.length; });
      const edgeAt = (j: number) => 0.58 + (j * 0.25) / Math.max(scene.edges.length, 1);
      return (
        <>
          {scene.title ? (
            <Rise shown={at(0.02)}><Text style={s.heading}>{scene.title}</Text></Rise>
          ) : null}
          <View style={{ width: canvasW, height: diagramH, alignSelf: 'center' }}>
            <Svg width={canvasW} height={diagramH} style={StyleSheet.absoluteFill} pointerEvents="none">
              {scene.edges.map((edge: ReelEdge, j: number) => {
                if (!at(edgeAt(j))) return null;
                const g = edgeGeometry(pos[edge.from], pos[edge.to]);
                return (
                  <React.Fragment key={j}>
                    <Line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={theme.textDim} strokeWidth={1.6} />
                    <Path d={arrowHead(g.x2, g.y2, g.x1, g.y1)} stroke={theme.textDim} strokeWidth={1.6} fill="none" />
                  </React.Fragment>
                );
              })}
            </Svg>
            {scene.edges.map((edge: ReelEdge, j: number) => {
              if (!edge.label || !at(edgeAt(j))) return null;
              const g = edgeGeometry(pos[edge.from], pos[edge.to]);
              return (
                <Text key={`l${j}`} style={[s.edgeLabel, { left: (g.x1 + g.x2) / 2 - 30, top: (g.y1 + g.y2) / 2 - 8, width: 60, textAlign: 'center' }]} numberOfLines={1}>
                  {edge.label}
                </Text>
              );
            })}
            {scene.nodes.map((node: ReelNode) => {
              const p = pos[node.id];
              const tone = toneColors[node.tone] ?? toneColors.neutral;
              return (
                <Pop
                  key={node.id}
                  shown={at(nodeShownAt[node.id])}
                  style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
                >
                  <View style={[s.node, { width: p.w, height: p.h, backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[s.nodeText, { color: tone.text }]} numberOfLines={2}>{node.label}</Text>
                  </View>
                </Pop>
              );
            })}
          </View>
        </>
      );
    }

    if (scene.type === 'stat') {
      return (
        <>
          <Pop shown={at(0.1)}><Text style={s.statValue}>{scene.value}</Text></Pop>
          <Rise shown={at(0.38)}><Text style={s.statLabel}>{scene.label}</Text></Rise>
        </>
      );
    }

    if (scene.type === 'quote') {
      return (
        <Pop shown={at(0.08)}>
          <View style={s.quoteCard}>
            <RichText text={scene.text} style={s.quoteText} />
            {scene.source ? <Text style={s.quoteSrc}>{scene.source}</Text> : null}
          </View>
        </Pop>
      );
    }

    // figure
    const figure = figureCard?.figure;
    if (figure?.signedUrl) {
      const figHeight = figure.width && figure.height
        ? Math.min(canvasW * (figure.height / figure.width), height * 0.55)
        : height * 0.4;
      return (
        <Rise shown={at(0.02)}>
          <KenBurns active={active}>
            <Image source={{ uri: figure.signedUrl }} style={[s.figImage, { height: figHeight }]} resizeMode="contain" />
          </KenBurns>
          <Text style={s.figCaption}>Straight from the book, page {(figure.page ?? 0) + 1}.</Text>
        </Rise>
      );
    }
    return null;
  };

  return (
    <LinearGradient colors={[theme.bg, theme.surface, theme.bg]} style={s.scene}>
      <DottedBackground width={width} height={height} color={theme.border} />
      <View style={s.content}>{body()}</View>
    </LinearGradient>
  );
}

// ── Caption bar (word-synced, GitDiagram style) ───────────────────────────────

export function CaptionBar({ narration, elapsedMs, durationMs }: { narration: string; elapsedMs: number; durationMs: number }) {
  const timings = useMemo(() => wordTimings(narration, durationMs), [narration, durationMs]);
  const s = useMemo(() => StyleSheet.create({
    pill: { alignSelf: 'center', maxWidth: '92%', backgroundColor: '#1A1A20EE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
    line: { fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  }), []);
  return (
    <View style={s.pill}>
      <Text style={s.line}>
        {timings.map((t, i) => (
          <Text key={i} style={{ color: elapsedMs >= t.at ? '#FFFFFF' : '#9A9AA5' }}>
            {t.word}{i < timings.length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Text>
    </View>
  );
}
