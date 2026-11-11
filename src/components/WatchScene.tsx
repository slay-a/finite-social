import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { CardVisual, SectionCardData } from '../types';
import RichText from './RichText';
import { buildScenePlan, sceneBlocks, scheduleFor } from '../lib/watchScript';

interface Props {
  card: SectionCardData;
  height: number;
  sectionLabel: string;
  elapsedMs: number;
  durationMs: number;
  active: boolean;
  revealAnswer: boolean;
}

/** Fades + slides its children in the first time `shown` turns true. */
function Reveal({ shown, children, style }: { shown: boolean; children: React.ReactNode; style?: ViewStyle }) {
  const anim = useRef(new Animated.Value(0)).current;
  const played = useRef(false);
  useEffect(() => {
    if (shown && !played.current) {
      played.current = true;
      Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } else if (!shown && played.current) {
      played.current = false;
      anim.setValue(0);
    }
  }, [shown, anim]);
  return (
    <Animated.View
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Slow push-in for figure images, running while the scene is active. */
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

function visualStepWrappers(visual: CardVisual): number {
  if ((visual.type === 'flow' || visual.type === 'cycle') && visual.steps?.length) return visual.steps.length;
  if (visual.type === 'compare' && visual.left && visual.right) return 2;
  return visual.items?.length ?? 0;
}

export default function WatchScene({ card, height, sectionLabel, elapsedMs, durationMs, active, revealAnswer }: Props) {
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const blocks = useMemo(() => sceneBlocks(card), [card]);
  const schedule = useMemo(
    () => scheduleFor(buildScenePlan(card), durationMs),
    [card, durationMs],
  );
  const shown = (key: string) => active && elapsedMs >= (schedule[key] ?? 0);

  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { if (!active) setPicked(null); }, [active]);
  const answered = picked !== null || revealAnswer;

  const s = useMemo(() => StyleSheet.create({
    scene:     { height, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 60 },
    content:   { overflow: 'hidden', flexShrink: 1 },
    label:     { fontSize: 12, fontWeight: '700', color: theme.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
    title:     { fontSize: 30, fontWeight: '800', color: theme.text, letterSpacing: -0.6, lineHeight: 37, marginBottom: 20 },
    paragraph: { fontSize: 17, lineHeight: 27, color: theme.textSub, marginBottom: 14 },
    mathLine:  { fontSize: 21, lineHeight: 31, color: theme.text, fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
    bulletRow: { flexDirection: 'row', marginBottom: 11, paddingRight: 8 },
    bulletDot: { fontSize: 17, lineHeight: 27, color: theme.primary, marginRight: 9 },
    bold:      { fontWeight: '700', color: theme.text },
    step:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8 },
    stepNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' },
    stepNumT:  { fontSize: 11, fontWeight: '800', color: theme.primary },
    stepText:  { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
    compare:   { flexDirection: 'row', gap: 10, marginTop: 8 },
    side:      { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 6 },
    sideLabel: { fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    sidePoint: { fontSize: 13, lineHeight: 18, color: theme.textSub },
    tileWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    tile:      { flexGrow: 1, minWidth: '40%', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 13, gap: 3 },
    tileLabel: { fontSize: 12, fontWeight: '800', color: theme.primary },
    tileText:  { fontSize: 13, lineHeight: 18, color: theme.textSub },
    tileValue: { fontSize: 22, fontWeight: '800', color: theme.primary, letterSpacing: -0.5 },
    question:  { fontSize: 23, fontWeight: '800', color: theme.text, lineHeight: 31, marginBottom: 18 },
    option:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 },
    optText:   { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text, lineHeight: 21 },
    why:       { marginTop: 8, fontSize: 14, lineHeight: 20, color: theme.textSub },
    figImage:  { width: '100%', borderRadius: 14, backgroundColor: '#fff' },
    figCaption:{ marginTop: 12, fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  }), [theme, height]);

  const figure = card.kind === 'figure' ? card.figure : null;
  const figHeight = figure?.width && figure?.height
    ? Math.min((screenW - 52) * (figure.height / figure.width), height * 0.6)
    : height * 0.45;

  const renderVisual = (visual: CardVisual) => {
    const stepCount = visualStepWrappers(visual);
    if (stepCount === 0) return null;
    if ((visual.type === 'flow' || visual.type === 'cycle') && visual.steps?.length) {
      return (
        <View style={{ marginTop: 10 }}>
          {visual.steps.map((step, i) => (
            <Reveal key={i} shown={shown(`vstep:${i}`)}>
              <View style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumT}>{i + 1}</Text></View>
                <RichText text={step} style={s.stepText} />
              </View>
            </Reveal>
          ))}
        </View>
      );
    }
    if (visual.type === 'compare' && visual.left && visual.right) {
      return (
        <View style={s.compare}>
          {[visual.left, visual.right].map((side, i) => (
            <Reveal key={i} shown={shown(`vstep:${i}`)} style={{ flex: 1 }}>
              <View style={s.side}>
                <Text style={s.sideLabel}>{side.label}</Text>
                {side.points.map((p, j) => (
                  <RichText key={j} text={`• ${p}`} style={s.sidePoint} />
                ))}
              </View>
            </Reveal>
          ))}
        </View>
      );
    }
    if (visual.items?.length) {
      return (
        <View style={s.tileWrap}>
          {visual.items.map((it, i) => (
            <Reveal key={i} shown={shown(`vstep:${i}`)} style={{ flexGrow: 1, minWidth: '40%' }}>
              <View style={s.tile}>
                {visual.type === 'stats' ? (
                  <>
                    <Text style={s.tileValue}>{it.value}</Text>
                    <Text style={s.tileText}>{it.label}</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.tileLabel}>{it.label}</Text>
                    <RichText text={it.text ?? ''} style={s.tileText} />
                  </>
                )}
              </View>
            </Reveal>
          ))}
        </View>
      );
    }
    return null;
  };

  return (
    <LinearGradient colors={[theme.bg, theme.surface, theme.bg]} style={s.scene}>
      <View style={s.content}>
        <Reveal shown={shown('title')}>
          <Text style={s.label} numberOfLines={2}>{sectionLabel}</Text>
          {card.kind !== 'quiz' && <RichText text={card.title} style={s.title} boldStyle={s.bold} />}
        </Reveal>

        {card.kind === 'quiz' && card.quiz ? (
          <>
            <Reveal shown={shown('question')}>
              <RichText text={card.quiz.question} style={s.question} />
            </Reveal>
            {card.quiz.options.map((opt, i) => {
              const isCorrect = i === card.quiz!.answer;
              const isPicked = i === picked;
              const border = !answered ? theme.border
                : isCorrect ? theme.accent
                : isPicked ? theme.danger
                : theme.border;
              return (
                <Reveal key={i} shown={shown(`option:${i}`)}>
                  <TouchableOpacity
                    style={[s.option, { borderColor: border }]}
                    disabled={answered}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPicked(i);
                      Haptics.notificationAsync(
                        isCorrect
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
                </Reveal>
              );
            })}
            {answered && card.quiz.why ? <RichText text={card.quiz.why} style={s.why} /> : null}
          </>
        ) : figure?.signedUrl ? (
          <Reveal shown={shown('figure')}>
            <KenBurns active={active}>
              <Image source={{ uri: figure.signedUrl }} style={[s.figImage, { height: figHeight }]} resizeMode="contain" />
            </KenBurns>
            <Text style={s.figCaption}>Straight from the book, page {(figure.page ?? 0) + 1}.</Text>
          </Reveal>
        ) : (
          <>
            {blocks.map((block, i) => (
              <Reveal key={i} shown={shown(`block:${i}`)}>
                {block.kind === 'bullet' ? (
                  <View style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <RichText text={block.text} style={[s.paragraph, { marginBottom: 0 }]} boldStyle={s.bold} />
                  </View>
                ) : block.kind === 'math' ? (
                  <Text style={s.mathLine}>{block.text}</Text>
                ) : (
                  <RichText text={block.text} style={s.paragraph} boldStyle={s.bold} />
                )}
              </Reveal>
            ))}
            {card.visual ? renderVisual(card.visual) : null}
          </>
        )}
      </View>
    </LinearGradient>
  );
}
