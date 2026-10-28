import * as Speech from 'expo-speech';
import { SectionCardData } from '../types';
import { parseInline } from '../components/RichText';

export type VoiceGender = 'female' | 'male';

// Common iOS/Android voice names by gender; first match on the device wins.
const FEMALE_NAMES = ['samantha', 'karen', 'victoria', 'martha', 'moira', 'tessa', 'serena', 'nicky', 'ava', 'allison', 'susan', 'zoe', 'female'];
const MALE_NAMES = ['aaron', 'daniel', 'fred', 'alex', 'arthur', 'gordon', 'tom', 'oliver', 'male'];

let voiceCache: { female?: string; male?: string } | null = null;

export async function resolveVoice(gender: VoiceGender): Promise<string | undefined> {
  if (!voiceCache) {
    voiceCache = {};
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
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

export interface SpeakController {
  stop: () => void;
}

/**
 * Speaks one card; resolves true when finished naturally, false when stopped.
 */
export function speakCard(
  card: SectionCardData,
  voiceId: string | undefined,
  onDone: (finished: boolean) => void,
): SpeakController {
  let stopped = false;
  Speech.stop();
  Speech.speak(cardToSpokenText(card), {
    voice: voiceId,
    rate: 0.97,
    onDone: () => { if (!stopped) onDone(true); },
    onStopped: () => { if (!stopped) { stopped = true; onDone(false); } },
    onError: () => { if (!stopped) { stopped = true; onDone(false); } },
  });
  return {
    stop: () => {
      stopped = true;
      Speech.stop();
    },
  };
}
