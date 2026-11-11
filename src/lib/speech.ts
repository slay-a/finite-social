import * as Speech from 'expo-speech';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { SectionCardData } from '../types';
import { parseInline } from '../components/RichText';
import { getSupabase } from './supabase';

export type VoiceGender = 'female' | 'male';

// ── Neural narration (server TTS) ────────────────────────────────────────────
// Each card is narrated by the tts edge function (OpenAI neural voices) and
// cached server-side by content hash. The device voice below is only the
// offline/last-resort fallback.

let audioModeReady = false;
async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // playback still works; the iOS mute switch may silence it
  }
}

const urlCache = new Map<string, Promise<string | null>>();

function getAudioUrl(card: SectionCardData, gender: VoiceGender): Promise<string | null> {
  const key = `${card.id}:${gender}`;
  let pending = urlCache.get(key);
  if (!pending) {
    pending = fetchAudioUrl(card, gender).catch(() => null);
    urlCache.set(key, pending);
    // Signed URLs expire after an hour; don't pin a failure or stale URL forever.
    pending.then((url) => {
      if (!url) urlCache.delete(key);
      else setTimeout(() => urlCache.delete(key), 50 * 60 * 1000);
    });
  }
  return pending;
}

async function fetchAudioUrl(card: SectionCardData, gender: VoiceGender): Promise<string | null> {
  const { data, error } = await getSupabase().functions.invoke<{ url?: string }>('tts', {
    body: { text: cardToSpokenText(card), voice: gender },
  });
  if (error || !data?.url) return null;
  return data.url;
}

/** Warm the cache for the card that plays next, so playback never gaps. */
export function prefetchCardAudio(card: SectionCardData, gender: VoiceGender): void {
  getAudioUrl(card, gender);
}

// ── Device-voice fallback ────────────────────────────────────────────────────
const FEMALE_NAMES = ['samantha', 'karen', 'victoria', 'martha', 'moira', 'tessa', 'serena', 'nicky', 'ava', 'allison', 'susan', 'zoe', 'female'];
const MALE_NAMES = ['aaron', 'daniel', 'fred', 'alex', 'arthur', 'gordon', 'tom', 'oliver', 'male'];

let voiceCache: { female?: string; male?: string } | null = null;

async function resolveDeviceVoice(gender: VoiceGender): Promise<string | undefined> {
  if (!voiceCache) {
    voiceCache = {};
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const english = voices
        .filter((v) => v.language?.toLowerCase().startsWith('en'))
        // Enhanced (downloaded) voices sound far better than compact ones.
        .sort((a, b) => Number(b.quality === Speech.VoiceQuality.Enhanced) - Number(a.quality === Speech.VoiceQuality.Enhanced));
      const findBy = (names: string[]) =>
        english.find((v) => names.some((n) => v.name?.toLowerCase().includes(n)))?.identifier;
      voiceCache.female = findBy(FEMALE_NAMES);
      voiceCache.male = findBy(MALE_NAMES);
    } catch {
      // keep empty cache; system default voice is used
    }
  }
  return gender === 'female' ? voiceCache.female : voiceCache.male;
}

// ── Text preparation ─────────────────────────────────────────────────────────
/** Card markup -> listenable text: bold markers dropped, math spoken plainly. */
export function cardToSpokenText(card: SectionCardData): string {
  if (card.kind === 'quiz' && card.quiz) {
    const opts = card.quiz.options.map((o, i) => `Option ${i + 1}: ${stripMarkup(o)}`).join('. ');
    return `Quick check. ${stripMarkup(card.quiz.question)}. ${opts}`;
  }
  const body = card.body
    .split(/\n+/)
    .map((line) => stripMarkup(line.replace(/^-\s+/, '')))
    .filter(Boolean)
    .join('. ');
  return `${stripMarkup(card.title)}. ${body}`;
}

function stripMarkup(text: string): string {
  return parseInline(text.replace(/\$\$/g, '$'))
    .map((seg) => seg.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Playback ─────────────────────────────────────────────────────────────────
export interface SpeakController {
  stop: () => void;
}

/** Rough narration length for scheduling scene reveals before audio loads. */
export function estimateSpokenMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2500, (words / 155) * 60_000);
}

export interface NarrationCallbacks {
  onProgress?: (elapsedMs: number, durationMs: number) => void;
  onDone: (finished: boolean) => void;
}

export interface NarrationController {
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * Watch-mode narration: like speakCard but reports playback progress (250ms
 * ticks) and supports pause/resume. Manual stop never fires onDone.
 */
export function playCardNarration(
  card: SectionCardData,
  gender: VoiceGender,
  cbs: NarrationCallbacks,
): NarrationController {
  let stopped = false;
  let paused = false;
  let usingSystem = false;
  let player: AudioPlayer | null = null;
  let sub: { remove: () => void } | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let sysElapsed = 0;
  let sysDuration = 0;

  const cleanup = () => {
    try { sub?.remove(); } catch {}
    try { player?.remove(); } catch {}
    sub = null;
    player = null;
    if (tick) { clearInterval(tick); tick = null; }
  };

  (async () => {
    await ensureAudioMode();
    const url = await getAudioUrl(card, gender);
    if (stopped) return;

    if (url) {
      try {
        player = createAudioPlayer({ uri: url }, { updateInterval: 250 });
        sub = player.addListener('playbackStatusUpdate', (status) => {
          if (stopped) return;
          const durationMs = (status.duration ?? 0) * 1000;
          if (durationMs > 0) cbs.onProgress?.((status.currentTime ?? 0) * 1000, durationMs);
          if (status.didJustFinish) {
            stopped = true;
            cleanup();
            cbs.onDone(true);
          }
        });
        if (!paused) player.play();
        return;
      } catch {
        cleanup();
        if (stopped) return;
      }
    }

    // Offline fallback: device voice plus a word-count clock for the scenes.
    usingSystem = true;
    const text = cardToSpokenText(card);
    sysDuration = estimateSpokenMs(text);
    const voiceId = await resolveDeviceVoice(gender);
    if (stopped) return;
    Speech.stop();
    Speech.speak(text, {
      voice: voiceId,
      rate: 0.97,
      onDone: () => { if (!stopped) { stopped = true; cleanup(); cbs.onDone(true); } },
      onStopped: () => { stopped = true; },
      onError: () => { stopped = true; },
    });
    tick = setInterval(() => {
      if (stopped || paused) return;
      sysElapsed = Math.min(sysElapsed + 250, sysDuration);
      cbs.onProgress?.(sysElapsed, sysDuration);
    }, 250);
  })();

  return {
    pause: () => {
      paused = true;
      if (player) { try { player.pause(); } catch {} }
      else if (usingSystem) { Speech.pause().catch(() => {}); }
    },
    resume: () => {
      paused = false;
      if (stopped) return;
      if (player) { try { player.play(); } catch {} }
      else if (usingSystem) { Speech.resume().catch(() => {}); }
    },
    stop: () => {
      stopped = true;
      cleanup();
      Speech.stop();
    },
  };
}

/**
 * Speaks one card (neural mp3 when reachable, device voice offline);
 * calls onDone(true) when it finishes naturally. Manual stop never fires onDone.
 */
export function speakCard(
  card: SectionCardData,
  gender: VoiceGender,
  onDone: (finished: boolean) => void,
): SpeakController {
  let stopped = false;
  let player: AudioPlayer | null = null;
  let sub: { remove: () => void } | null = null;

  const cleanup = () => {
    try { sub?.remove(); } catch {}
    try { player?.remove(); } catch {}
    sub = null;
    player = null;
  };

  (async () => {
    await ensureAudioMode();
    const url = await getAudioUrl(card, gender);
    if (stopped) return;

    if (url) {
      try {
        player = createAudioPlayer({ uri: url });
        sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish && !stopped) {
            stopped = true;
            cleanup();
            onDone(true);
          }
        });
        player.play();
        return;
      } catch {
        cleanup();
        if (stopped) return;
      }
    }

    // Fallback: best available on-device voice.
    const voiceId = await resolveDeviceVoice(gender);
    if (stopped) return;
    Speech.stop();
    Speech.speak(cardToSpokenText(card), {
      voice: voiceId,
      rate: 0.97,
      onDone: () => { if (!stopped) { stopped = true; onDone(true); } },
      onStopped: () => { stopped = true; },
      onError: () => { stopped = true; },
    });
  })();

  return {
    stop: () => {
      stopped = true;
      cleanup();
      Speech.stop();
    },
  };
}
