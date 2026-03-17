import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { useTheme, useThemeControls } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { THEMES, ThemeId } from '../../src/theme/themes';
import { Category } from '../../src/types';
import SourceFeedModal from '../../src/components/SourceFeedModal';
import { FREE_FEED_LIMIT, FREE_CODE_LIMIT } from '../../src/lib/purchases';

const FEED_CATEGORIES: Category[] = ['AI', 'Dev', 'Startups', 'Science', 'Repos'];

export default function ProfileScreen() {
  const {
    bookmarkedArticles, readIds,
    feedEnabled, setFeedEnabled,
    disabledCategories, toggleCategory,
  } = useApp();
  const theme = useTheme();
  const { setThemeId } = useThemeControls();
  const { user, signOut } = useAuth();
  const { isPro, feedCount, codeCount, feedLimit, codeLimit } = useSubscription();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };
  const [activeSource, setActiveSource] = useState<{ name: string; color: string } | null>(null);

  const s = useMemo(() => StyleSheet.create({
    safe:         { flex: 1, backgroundColor: theme.bg },
    content:      { paddingBottom: 40 },
    header:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerTitle:  { fontSize: 22, fontWeight: '800', color: theme.text },

    statsRow:   { flexDirection: 'row', margin: 16, backgroundColor: theme.card, borderRadius: 16, padding: 20 },
    statItem:   { flex: 1, alignItems: 'center', gap: 2 },
    statValue:  { fontSize: 22, fontWeight: '800', color: theme.text },
    statLabel:  { fontSize: 11, color: theme.textMuted },
    statDivider:{ width: 1, backgroundColor: theme.border },

    section:      { paddingHorizontal: 16, marginBottom: 20, gap: 10 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    card:         { backgroundColor: theme.card, borderRadius: 14, overflow: 'hidden' },
    divider:      { height: 1, backgroundColor: theme.border, marginHorizontal: 14 },

    // Theme row
    themesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
    themeBtn:    { alignItems: 'center', gap: 6 },
    themeSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
    themeLabel:  { fontSize: 10, fontWeight: '600' },

    // Toggle row
    toggleRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
    toggleLeft:  { flex: 1, gap: 2 },
    toggleTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
    toggleSub:   { fontSize: 12, color: theme.textMuted },
    toggleDot:   { width: 8, height: 8, borderRadius: 4, marginRight: 8 },

    // Source row
    sourceRow:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    sourceDot:     { width: 10, height: 10, borderRadius: 5 },
    sourceInfo:    { flex: 1 },
    sourceName:    { fontSize: 15, fontWeight: '600', color: theme.text },
    sourceDesc:    { fontSize: 12, color: theme.textMuted, marginTop: 1 },
    sourceLive:    { backgroundColor: 'rgba(57,211,83,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    sourceLiveText:{ fontSize: 11, fontWeight: '700', color: theme.accent },

    aboutCard:    { backgroundColor: theme.card, borderRadius: 14, padding: 18, gap: 8 },
    aboutAppName: { fontSize: 22, fontWeight: '800', color: theme.primary, letterSpacing: -0.5 },
    aboutTagline: { fontSize: 13, fontWeight: '500', color: theme.textMuted, marginTop: -2 },
    aboutDesc:    { fontSize: 14, color: theme.textSub, lineHeight: 21, marginTop: 4 },
    aboutMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    aboutMetaText:{ fontSize: 12, color: theme.textDim },
    aboutMetaDot: { fontSize: 12, color: theme.textDim },
    blogRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    blogLabel:    { fontSize: 14, fontWeight: '600', color: theme.text },
    blogSub:      { fontSize: 11, color: theme.textMuted, marginTop: 1 },

    footer: { fontSize: 12, color: theme.textDim, textAlign: 'center', marginTop: 8, marginBottom: 16 },

    // Account
    accountRow:  { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' },
    accountInfo: { flex: 1 },
    accountEmail:{ fontSize: 15, fontWeight: '600', color: theme.text },
    accountBadge:{ fontSize: 12, color: theme.textMuted, marginTop: 1 },
    proBadge:    { backgroundColor: `${theme.primary}22`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    proBadgeText:{ fontSize: 11, fontWeight: '800', color: theme.primary },
    upgradeBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12, backgroundColor: `${theme.primary}12`, borderRadius: 14, borderWidth: 1, borderColor: `${theme.primary}44` },
    upgradeTxt:  { flex: 1 },
    upgradeTitle:{ fontSize: 15, fontWeight: '700', color: theme.text },
    upgradeSub:  { fontSize: 12, color: theme.textMuted, marginTop: 1 },
    signOutRow:  { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    signOutText: { fontSize: 15, color: theme.danger, fontWeight: '600' },

    // Usage bar
    usageRow:    { padding: 16, gap: 8 },
    usageLabel:  { flexDirection: 'row', justifyContent: 'space-between' },
    usageLabelTxt:{ fontSize: 12, color: theme.textMuted, fontWeight: '600' },
    usageCount:  { fontSize: 12, color: theme.textDim },
    bar:         { height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' },
    barFill:     { height: '100%', borderRadius: 2 },
  }), [theme]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.headerTitle}>Profile</Text>
        </View>

        {/* Account */}
        <View style={[s.section, { marginTop: 16 }]}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.card}>
            <View style={s.accountRow}>
              <View style={s.avatar}>
                <Ionicons name="person" size={20} color={theme.primary} />
              </View>
              <View style={s.accountInfo}>
                <Text style={s.accountEmail} numberOfLines={1}>{user?.email ?? 'Not signed in'}</Text>
                <Text style={s.accountBadge}>{isPro ? 'Pro member' : `Free · ${feedCount}/${feedLimit} feed · ${codeCount}/${codeLimit} code today`}</Text>
              </View>
              {isPro && <View style={s.proBadge}><Text style={s.proBadgeText}>PRO</Text></View>}
            </View>

            {!isPro && (
              <>
                <View style={s.divider} />
                {/* Usage bars */}
                <View style={s.usageRow}>
                  <View style={s.usageLabel}>
                    <Text style={s.usageLabelTxt}>Feed articles today</Text>
                    <Text style={s.usageCount}>{feedCount} / {feedLimit}</Text>
                  </View>
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${Math.min((feedCount / feedLimit) * 100, 100)}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <View style={[s.usageLabel, { marginTop: 8 }]}>
                    <Text style={s.usageLabelTxt}>LeetCode cards today</Text>
                    <Text style={s.usageCount}>{codeCount} / {codeLimit}</Text>
                  </View>
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${Math.min((codeCount / codeLimit) * 100, 100)}%`, backgroundColor: '#F7C94B' }]} />
                  </View>
                </View>

                <View style={s.divider} />
                <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
                  <Ionicons name="flash-outline" size={20} color={theme.primary} />
                  <View style={s.upgradeTxt}>
                    <Text style={s.upgradeTitle}>Upgrade to Pro</Text>
                    <Text style={s.upgradeSub}>Unlimited everything · $2.99/mo</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={theme.primary} />
                </TouchableOpacity>
              </>
            )}

            <View style={s.divider} />
            <TouchableOpacity style={s.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              <Text style={s.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{bookmarkedArticles.length}</Text>
            <Text style={s.statLabel}>Saved</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{readIds.size}</Text>
            <Text style={s.statLabel}>Read</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{FEED_CATEGORIES.filter((c) => !disabledCategories.has(c)).length}</Text>
            <Text style={s.statLabel}>Active Topics</Text>
          </View>
        </View>

        {/* Feed controls */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Feed</Text>
          <View style={s.card}>
            {/* Master feed toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <Text style={s.toggleTitle}>Enable Feed</Text>
                <Text style={s.toggleSub}>Show the news feed tab</Text>
              </View>
              <Switch
                value={feedEnabled}
                onValueChange={setFeedEnabled}
                trackColor={{ false: theme.border, true: `${theme.primary}88` }}
                thumbColor={feedEnabled ? theme.primary : theme.textDim}
              />
            </View>

            <View style={s.divider} />

            {/* Per-category toggles */}
            {FEED_CATEGORIES.map((cat, i) => {
              const enabled = !disabledCategories.has(cat);
              const color = theme.categoryColors[cat];
              return (
                <View key={cat}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={[s.toggleRow, !feedEnabled && { opacity: 0.4 }]}>
                    <View style={[s.toggleDot, { backgroundColor: color }]} />
                    <View style={s.toggleLeft}>
                      <Text style={s.toggleTitle}>{cat}</Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={() => { if (feedEnabled) toggleCategory(cat); }}
                      trackColor={{ false: theme.border, true: `${color}88` }}
                      thumbColor={enabled ? color : theme.textDim}
                      disabled={!feedEnabled}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Appearance */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Appearance</Text>
          <View style={s.card}>
            <View style={s.themesRow}>
              {THEMES.map((t) => {
                const isActive = t.id === theme.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={s.themeBtn}
                    onPress={() => setThemeId(t.id as ThemeId)}
                    activeOpacity={0.75}
                  >
                    <View style={[
                      s.themeSwatch,
                      { backgroundColor: t.swatch, borderColor: isActive ? t.primary : 'transparent' },
                    ]}>
                      {isActive && (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={20} color={t.primary} />
                        </View>
                      )}
                    </View>
                    <Text style={[s.themeLabel, { color: isActive ? theme.primary : theme.textMuted }]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sources */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sources</Text>
          <View style={s.card}>
            {([
              { name: 'Hacker News',     desc: 'Top tech stories voted by developers',             color: theme.hnOrange },
              { name: 'Reddit',          desc: 'r/technology, r/MachineLearning + more',            color: '#FF4500' },
              { name: 'DEV Community',   desc: 'Developer articles from dev.to',                   color: theme.devPurple },
              { name: 'Lobsters',        desc: 'Curated tech links from lobste.rs',                color: '#8C52FF' },
              { name: 'TechCrunch',      desc: 'Startup and tech journalism',                      color: '#0A9F3C' },
              { name: 'The Verge',       desc: 'Technology, science, and culture',                 color: '#FF3C00' },
              { name: 'Wired',           desc: 'In-depth tech and culture reporting',              color: '#AAAAAA' },
              { name: 'Ars Technica',    desc: 'Technology, science, policy deep dives',           color: '#FF6600' },
              { name: 'MIT Tech Review', desc: 'Research and emerging technology',                 color: '#A31F34' },
              { name: 'Product Hunt',    desc: 'New apps and tools launching today',               color: '#DA552F' },
              { name: 'VentureBeat',     desc: 'AI and enterprise tech news',                      color: '#1A8CFF' },
              { name: 'The Register',    desc: 'Dev and security deep dives',                      color: '#CC0000' },
              { name: 'ZDNet',           desc: 'Enterprise technology news',                       color: '#0057B8' },
              { name: 'InfoQ',           desc: 'Software engineering in depth',                    color: '#E03B2C' },
            ] as const).map((src, i) => (
              <View key={src.name}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity
                  style={s.sourceRow}
                  onPress={() => setActiveSource({ name: src.name, color: src.color })}
                  activeOpacity={0.7}
                >
                  <View style={[s.sourceDot, { backgroundColor: src.color }]} />
                  <View style={s.sourceInfo}>
                    <Text style={s.sourceName}>{src.name}</Text>
                    <Text style={s.sourceDesc}>{src.desc}</Text>
                  </View>
                  <View style={s.sourceLive}><Text style={s.sourceLiveText}>Live</Text></View>
                  <Ionicons name="chevron-forward" size={14} color={theme.textDim} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <View style={s.aboutCard}>
            <Text style={s.aboutAppName}>Finite Social</Text>
            <Text style={s.aboutTagline}>Stay in the loop — without the noise</Text>
            <Text style={s.aboutDesc}>
              Finite Social brings together the best of tech, culture, and trending content into one clean, fast feed. AI-enhanced summaries, smart headlines, and 14 live sources.
            </Text>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.blogRow}
              onPress={() => Linking.openURL('https://whatintheai.blogspot.com')}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={18} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.blogLabel}>What in the AI</Text>
                <Text style={s.blogSub}>whatintheai.blogspot.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textDim} />
            </TouchableOpacity>
            <View style={s.divider} />
            <View style={s.aboutMeta}>
              <Text style={s.aboutMetaText}>Version 1.0</Text>
              <Text style={s.aboutMetaDot}>·</Text>
              <Text style={s.aboutMetaText}>14 Sources</Text>
              <Text style={s.aboutMetaDot}>·</Text>
              <Text style={s.aboutMetaText}>5 Topics</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>Finite Social · Stay in the loop</Text>
      </ScrollView>

      {activeSource && (
        <SourceFeedModal
          sourceName={activeSource.name}
          sourceColor={activeSource.color}
          visible={!!activeSource}
          onClose={() => setActiveSource(null)}
        />
      )}
    </SafeAreaView>
  );
}
