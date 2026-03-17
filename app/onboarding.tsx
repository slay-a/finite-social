import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, useWindowDimensions, ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';

export const ONBOARDING_KEY = 'finitesocial:onboarded';

const SLIDES = [
  {
    id: '1',
    icon: 'newspaper-outline' as const,
    title: 'The best of tech, all in one place',
    body: 'Swipe through top stories from 14 sources — Hacker News, Reddit, TechCrunch, Wired, and more. Fresh content, every time you open the app.',
    accent: '#6C63FF',
  },
  {
    id: '2',
    icon: 'bulb-outline' as const,
    title: 'Ask questions about anything you read',
    body: 'Tap Explain on any article to get a clear, jargon-free breakdown — then ask follow-up questions. AI-powered, no account needed.',
    accent: '#00C8FF',
  },
  {
    id: '3',
    icon: 'options-outline' as const,
    title: 'Your feed, your way',
    body: 'Bookmark articles for later. Filter by topic — AI, Dev, Startups, Security, Science, and more. Choose a theme that fits your style.',
    accent: '#39D353',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    list: { flex: 1 },
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 22 },
    iconWrapper: {
      width: 130, height: 130, borderRadius: 65,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    iconInner: { },
    title: {
      fontSize: 27, fontWeight: '800', color: theme.text,
      textAlign: 'center', lineHeight: 34, letterSpacing: -0.5,
    },
    body: {
      fontSize: 16, color: theme.textSub,
      textAlign: 'center', lineHeight: 26,
    },
    bottom: { paddingHorizontal: 24, paddingBottom: 36, gap: 18 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: { borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
    nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: 6 },
    skipText: { fontSize: 14, color: theme.textMuted },
  }), [theme]);

  const activeSlide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={s.list}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <View style={[s.iconWrapper, { backgroundColor: `${item.accent}18` }]}>
              <Ionicons name={item.icon} size={52} color={item.accent} />
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={s.bottom}>
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                {
                  width: i === activeIndex ? 24 : 8,
                  backgroundColor: i === activeIndex ? activeSlide.accent : theme.border,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: activeSlide.accent }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={s.nextBtnText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {activeIndex < SLIDES.length - 1 && (
          <TouchableOpacity style={s.skipBtn} onPress={finish} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
