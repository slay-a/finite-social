import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  bookmarks:          'finitesocial:bookmarks',
  readIds:            'finitesocial:readIds',
  feedEnabled:        'finitesocial:feedEnabled',
  disabledCategories: 'finitesocial:disabledCategories',
};

// Migrate data from old "pulse:" keys on first run
async function migrateOnce() {
  const already = await AsyncStorage.getItem('finitesocial:migrated');
  if (already) return;
  try {
    const b = await AsyncStorage.getItem('pulse:bookmarks');
    if (b) await AsyncStorage.setItem(KEYS.bookmarks, b);
    const r = await AsyncStorage.getItem('pulse:readIds');
    if (r) await AsyncStorage.setItem(KEYS.readIds, r);
  } catch {}
  await AsyncStorage.setItem('finitesocial:migrated', '1');
}

export async function loadBookmarkIds(): Promise<string[]> {
  await migrateOnce();
  const raw = await AsyncStorage.getItem(KEYS.bookmarks);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function saveBookmarkIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(ids));
}

export async function loadReadIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.readIds);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function saveReadIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.readIds, JSON.stringify(ids.slice(-500)));
}

export async function loadFeedEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.feedEnabled);
  return raw === null ? true : raw === '1';
}

export async function saveFeedEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.feedEnabled, enabled ? '1' : '0');
}

export async function loadDisabledCategories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.disabledCategories);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function saveDisabledCategories(cats: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.disabledCategories, JSON.stringify(cats));
}
