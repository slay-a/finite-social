import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabase, fetchProfile, Profile } from '../lib/supabase';
import { initPurchases } from '../lib/purchases';

interface AuthContextValue {
  user:    User    | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp:  (email: string, password: string) => Promise<{ error: string | null }>;
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
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
    initPurchases(userId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[Auth] Supabase not configured — add credentials to .env.local');
      setLoading(false);
      return;
    }

    const sb = getSupabase();

    // Restore session on app start
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
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
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await getSupabase().auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
    setSession(null);
    setProfile(null);
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
