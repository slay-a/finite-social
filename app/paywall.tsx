import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { purchasePro, restorePurchases, PRO_MONTHLY_PRICE, PRO_ANNUAL_PRICE } from '../src/lib/purchases';
import { getSupabase, isSupabaseConfigured } from '../src/lib/supabase';

const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'newspaper-outline',   text: 'Unlimited news feed, no daily cap' },
  { icon: 'code-slash-outline',  text: 'Unlimited LeetCode swipe mode' },
  { icon: 'bulb-outline',        text: 'Unlimited AI explanations & coach' },
  { icon: 'bookmark-outline',    text: 'Sync bookmarks across devices' },
  { icon: 'heart-outline',       text: 'Support independent development' },
];

type Plan = 'monthly' | 'annual';

export default function PaywallScreen() {
  const theme = useTheme();
  const { user, refreshProfile } = useAuth();
  const [plan, setPlan]       = useState<Plan>('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!user) { router.push('/(auth)/signup'); return; }
    setLoading(true);
    setError(null);
    const { success, error: err } = await purchasePro(plan);
    if (err === 'PURCHASES_NOT_CONFIGURED') {
      // Dev/demo mode: grant pro directly in Supabase for testing
      if (isSupabaseConfigured) {
        await getSupabase().from('profiles').update({ is_pro: true }).eq('id', user.id);
        await refreshProfile();
      }
      router.back();
    } else if (success) {
      if (isSupabaseConfigured) {
        await getSupabase().from('profiles').update({ is_pro: true }).eq('id', user.id);
        await refreshProfile();
      }
      router.back();
    } else if (err) {
      setError(err);
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    if (!user) return;
    setLoading(true);
    const restored = await restorePurchases();
    if (restored && isSupabaseConfigured) {
      await getSupabase().from('profiles').update({ is_pro: true }).eq('id', user.id);
      await refreshProfile();
      router.back();
    } else if (!restored) {
      setError('No active purchases found.');
    }
    setLoading(false);
  };

  const s = useMemo(() => StyleSheet.create({
    safe:        { flex: 1, backgroundColor: theme.bg },
    closeBtn:    { position: 'absolute', top: 0, right: 16, padding: 8, zIndex: 10 },
    scroll:      { flexGrow: 1 },
    hero:        { alignItems: 'center', paddingTop: 60, paddingBottom: 28, paddingHorizontal: 24 },
    badge:       { backgroundColor: `${theme.primary}22`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20 },
    badgeText:   { fontSize: 13, fontWeight: '700', color: theme.primary },
    heroTitle:   { fontSize: 30, fontWeight: '900', color: theme.text, textAlign: 'center', letterSpacing: -0.5, marginBottom: 10 },
    heroSub:     { fontSize: 15, color: theme.textMuted, textAlign: 'center', lineHeight: 23 },
    features:    { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
    featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' },
    featureText: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
    plans:       { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 20 },
    planCard:    { flex: 1, borderRadius: 16, borderWidth: 2, padding: 16, alignItems: 'center', gap: 4 },
    planLabel:   { fontSize: 13, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    planPrice:   { fontSize: 22, fontWeight: '900', color: theme.text },
    planSub:     { fontSize: 11, color: theme.textDim },
    planSave:    { backgroundColor: theme.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
    planSaveText:{ fontSize: 10, fontWeight: '800', color: theme.bg },
    cta:         { marginHorizontal: 24, borderRadius: 18, paddingVertical: 18, alignItems: 'center', backgroundColor: theme.primary, marginBottom: 14 },
    ctaText:     { fontSize: 17, fontWeight: '800', color: theme.bg },
    ctaSub:      { fontSize: 12, color: theme.textDim, textAlign: 'center', marginHorizontal: 24, marginBottom: 16 },
    errorBox:    { flexDirection: 'row', gap: 8, backgroundColor: `${theme.danger}18`, borderRadius: 12, padding: 12, marginHorizontal: 24, marginBottom: 12 },
    errorText:   { flex: 1, fontSize: 13, color: theme.danger },
    restore:     { alignItems: 'center', marginBottom: 8 },
    restoreText: { fontSize: 13, color: theme.textDim },
    terms:       { fontSize: 11, color: theme.textDim, textAlign: 'center', paddingHorizontal: 24, marginBottom: 20, lineHeight: 17 },
  }), [theme]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={22} color={theme.textMuted} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={s.badge}>
            <Text style={s.badgeText}>✦ Finite Pro</Text>
          </View>
          <Text style={s.heroTitle}>Unlock everything.{'\n'}Support the app.</Text>
          <Text style={s.heroSub}>
            One subscription covers your AI costs,{'\n'}keeps the servers running, and removes all limits.
          </Text>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map((f) => (
            <View key={f.text} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon} size={18} color={theme.primary} />
              </View>
              <Text style={s.featureText}>{f.text}</Text>
              <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={s.plans}>
          {(['monthly', 'annual'] as Plan[]).map((p) => {
            const active = plan === p;
            return (
              <TouchableOpacity
                key={p}
                style={[s.planCard, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}12` : theme.card }]}
                onPress={() => setPlan(p)}
                activeOpacity={0.8}
              >
                <Text style={[s.planLabel, active && { color: theme.primary }]}>{p}</Text>
                <Text style={s.planPrice}>{p === 'monthly' ? PRO_MONTHLY_PRICE : '$1.83/mo'}</Text>
                <Text style={s.planSub}>{p === 'monthly' ? 'billed monthly' : PRO_ANNUAL_PRICE + ' /yr'}</Text>
                {p === 'annual' && (
                  <View style={s.planSave}><Text style={s.planSaveText}>SAVE 39%</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.cta, loading && { opacity: 0.7 }]}
          onPress={handlePurchase}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={theme.bg} />
            : <Text style={s.ctaText}>Start free trial</Text>}
        </TouchableOpacity>

        <Text style={s.ctaSub}>3-day free trial · Cancel anytime</Text>

        <TouchableOpacity style={s.restore} onPress={handleRestore} disabled={loading}>
          <Text style={s.restoreText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={s.terms}>
          Payment charged to your App Store / Google Play account at confirmation. Subscription auto-renews unless cancelled 24h before period ends.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
