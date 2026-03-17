import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// True only when real credentials are present
export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnon.length > 20 &&
  !supabaseAnon.includes('your-anon-key');

// Lazy singleton — never created when not configured, so no crash on import
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  _client = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      storage:            AsyncStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  is_pro: boolean;
  pro_expires_at: string | null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as Profile;
  } catch {
    return null;
  }
}
