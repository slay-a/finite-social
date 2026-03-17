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

export default function SignupScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const [emailFocused,   setEmailFocused]   = useState(false);
  const [pw1Focused,     setPw1Focused]     = useState(false);
  const [pw2Focused,     setPw2Focused]     = useState(false);

  const pw2Ref = useRef<TextInput>(null);
  const pw1Ref = useRef<TextInput>(null);

  const handleSignup = useCallback(async () => {
    const em = email.trim().toLowerCase();
    if (!em || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signUp(em, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  }, [email, password, confirm, signUp]);

  const s = useMemo(() => StyleSheet.create({
    safe:        { flex: 1, backgroundColor: theme.bg },
    scroll:      { flexGrow: 1, justifyContent: 'center' },
    inner:       { paddingHorizontal: 28, paddingVertical: 40 },

    backBtn:     { position: 'absolute', top: 16, left: 16, padding: 6, zIndex: 10 },

    brand:       { marginBottom: 44 },
    logo:        { fontSize: 30, fontWeight: '900', color: theme.primary, letterSpacing: -1, marginBottom: 4 },
    tagline:     { fontSize: 13, color: theme.textMuted, letterSpacing: 0.1 },

    heading:     { fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 6, letterSpacing: -0.3 },
    subheading:  { fontSize: 13, color: theme.textMuted, marginBottom: 28, lineHeight: 20 },

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

    successBox:  { alignItems: 'center', gap: 16, padding: 8 },
    successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: `${theme.accent}22`, alignItems: 'center', justifyContent: 'center' },
    successTitle:{ fontSize: 22, fontWeight: '800', color: theme.text },
    successBody: { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },
  }), [theme]);

  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
          <View style={s.successBox}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={36} color={theme.accent} />
            </View>
            <Text style={s.successTitle}>Check your email</Text>
            <Text style={s.successBody}>
              We sent a confirmation link to {email.trim().toLowerCase()}.{'\n'}
              Click it to activate your account, then sign in.
            </Text>
            <TouchableOpacity
              style={[s.submitBtn, { width: '100%', marginTop: 8 }]}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={s.submitText}>Go to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.inner}>
            <View style={s.brand}>
              <Text style={s.logo}>finite</Text>
              <Text style={s.tagline}>Stay in the loop — without the noise</Text>
            </View>

            <Text style={s.heading}>Create account</Text>
            <Text style={s.subheading}>Free to start · Upgrade for unlimited access</Text>

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
                  onSubmitEditing={() => pw1Ref.current?.focus()}
                />
              </View>
            </View>

            <View style={s.fieldGap}>
              <Text style={s.label}>Password</Text>
              <View style={[s.inputWrap, { borderColor: pw1Focused ? theme.primary : theme.border }]}>
                <Ionicons name="lock-closed-outline" size={17} color={theme.textMuted} style={s.inputIcon} />
                <TextInput
                  ref={pw1Ref}
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.textDim}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onFocus={() => setPw1Focused(true)}
                  onBlur={() => setPw1Focused(false)}
                  onSubmitEditing={() => pw2Ref.current?.focus()}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={17} color={theme.textDim} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.fieldGap}>
              <Text style={s.label}>Confirm password</Text>
              <View style={[s.inputWrap, { borderColor: pw2Focused ? theme.primary : theme.border }]}>
                <Ionicons name="lock-closed-outline" size={17} color={theme.textMuted} style={s.inputIcon} />
                <TextInput
                  ref={pw2Ref}
                  style={s.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textDim}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onFocus={() => setPw2Focused(true)}
                  onBlur={() => setPw2Focused(false)}
                  onSubmitEditing={handleSignup}
                />
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
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={theme.bg} />
                : <Text style={s.submitText}>Create account</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={s.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
