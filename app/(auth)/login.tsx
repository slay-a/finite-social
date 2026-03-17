import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [emailFocused, setEmailFocused]   = useState(false);
  const [pwFocused,    setPwFocused]      = useState(false);

  const pwRef = useRef<TextInput>(null);

  const handleLogin = useCallback(async () => {
    const em = email.trim().toLowerCase();
    if (!em || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(em, password);
    setLoading(false);
    if (err) {
      setError(err.includes('Invalid') ? 'Incorrect email or password.' : err);
    } else {
      router.replace('/(tabs)');
    }
  }, [email, password, signIn]);

  const s = useMemo(() => StyleSheet.create({
    safe:        { flex: 1, backgroundColor: theme.bg },
    scroll:      { flexGrow: 1, justifyContent: 'center' },
    inner:       { paddingHorizontal: 28, paddingVertical: 40 },

    brand:       { marginBottom: 44 },
    logo:        { fontSize: 30, fontWeight: '900', color: theme.primary, letterSpacing: -1, marginBottom: 4 },
    tagline:     { fontSize: 13, color: theme.textMuted, letterSpacing: 0.1 },

    heading:     { fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 28, letterSpacing: -0.3 },

    fieldGap:    { marginBottom: 14 },
    label:       { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 7, letterSpacing: 0.3, textTransform: 'uppercase' },
    inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, gap: 10 },
    inputIcon:   { opacity: 0.5 },
    input:       { flex: 1, paddingVertical: 14, fontSize: 15, color: theme.text },
    eyeBtn:      { padding: 6 },

    errorBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${theme.danger}15`, borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 4 },
    errorText:   { flex: 1, fontSize: 13, color: theme.danger, lineHeight: 19 },

    submitBtn:   { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    submitText:  { fontSize: 16, fontWeight: '800', color: theme.bg },

    footer:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 20 },
    footerText:  { fontSize: 14, color: theme.textMuted },
    footerLink:  { fontSize: 14, fontWeight: '700', color: theme.primary },
  }), [theme]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.inner}>
            <View style={s.brand}>
              <Text style={s.logo}>finite</Text>
              <Text style={s.tagline}>Stay in the loop — without the noise</Text>
            </View>

            <Text style={s.heading}>Sign in</Text>

            <View style={s.fieldGap}>
              <Text style={s.label}>Email</Text>
              <View style={[s.inputWrap, { borderColor: emailFocused ? theme.primary : theme.border }]}>
                <Ionicons name="mail-outline" size={17} color={theme.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => pwRef.current?.focus()}
                />
              </View>
            </View>

            <View style={s.fieldGap}>
              <Text style={s.label}>Password</Text>
              <View style={[s.inputWrap, { borderColor: pwFocused ? theme.primary : theme.border }]}>
                <Ionicons name="lock-closed-outline" size={17} color={theme.textMuted} style={s.inputIcon} />
                <TextInput
                  ref={pwRef}
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textDim}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={17} color={theme.textDim} />
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={theme.bg} />
                : <Text style={s.submitText}>Sign in</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>No account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={s.footerLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
