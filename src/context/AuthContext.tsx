import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabase, fetchProfile, Profile } from '../lib/supabase';

interface AuthContextValue {
  user:    User    | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp:  (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn:  (email: string, password: string) => Promise<{ error: string | null; errorType?: 'email_not_found' | 'wrong_password' | 'other' }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const p = await fetchProfile(userId);
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[Auth] Supabase not configured — add credentials to .env.local');
      setLoading(false);
      return;
    }

    let sb: ReturnType<typeof getSupabase>;
    try {
      sb = getSupabase();
    } catch {
      setLoading(false);
      return;
    }

    // Restore session on app start. Failure or slowness must never trap the
    // app on the launch screen: always resolve, with a hard timeout backstop.
    const timeout = setTimeout(() => setLoading(false), 6000);
    sb.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user) loadProfile(s.user.id);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const NOT_CONFIGURED = 'Supabase is not configured. Add your credentials to .env.local and restart.';

  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, needsConfirmation: false };
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    // needsConfirmation is true when Supabase requires email verification
    // (session is null until the user clicks the link)
    const needsConfirmation = !error && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, errorType: 'other' as const };
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };

    const msg = error.message.toLowerCase();
    if (msg.includes('invalid') || msg.includes('credentials')) {
      // Distinguish wrong password vs unknown email by checking profiles table
      const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
      if (data) {
        return { error: 'Incorrect password.', errorType: 'wrong_password' as const };
      }
      return { error: 'No account found with that email.', errorType: 'email_not_found' as const };
    }
    return { error: error.message, errorType: 'other' as const };
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await getSupabase().auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const deleteAccount = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    try {
      const sb = getSupabase();
      const { data, error: fnError } = await sb.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (fnError) return { error: fnError.message };
      if (data?.error) return { error: data.error };

      setSession(null);
      setProfile(null);
      return { error: null };
    } catch (e) {
      return { error: String(e) };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      forgotPassword,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
