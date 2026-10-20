import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These are public credentials — anon key is safe to ship in the client.
// Row Level Security on Supabase controls data access, not key secrecy.
const supabaseUrl  = 'https://thcvuehyblejxetazvia.supabase.co';
const supabaseAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoY3Z1ZWh5YmxlanhldGF6dmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTQ0ODAsImV4cCI6MjA4OTI5MDQ4MH0.6flJSrhPrJzRyOf9zTDrFem-4JWpR0yViBY6XnUdWhE';

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
