import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  height: number;
}

export default function LoadingCard({ height }: Props) {
  const theme = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  const s = useMemo(() => {
    const skel = { backgroundColor: theme.surface, borderRadius: 6 } as const;
    return StyleSheet.create({
      card: { width: SCREEN_W, backgroundColor: theme.card, overflow: 'hidden' },
      accentBar: { height: 3, backgroundColor: theme.surface },
      inner: { flex: 1, padding: 20, gap: 14 },
      skTop:        { ...skel, height: 22, width: 120 },
      skTitle:      { ...skel, height: 28, width: '90%' as any },
      skTitleShort: { ...skel, height: 28, width: '65%' as any },
      skLine:       { ...skel, height: 15, width: '95%' as any },
      skLineShort:  { ...skel, height: 15, width: '75%' as any },
    });
  }, [theme]);

  return (
    <View style={[s.card, { height }]}>
      <View style={s.accentBar} />
      <View style={s.inner}>
        <Animated.View style={[s.skTop, { opacity }]} />
        <Animated.View style={[s.skTitle, { opacity }]} />
        <Animated.View style={[s.skTitleShort, { opacity }]} />
        <Animated.View style={[s.skLine, { opacity }]} />
        <Animated.View style={[s.skLine, { opacity }]} />
        <Animated.View style={[s.skLineShort, { opacity }]} />
      </View>
    </View>
  );
}
