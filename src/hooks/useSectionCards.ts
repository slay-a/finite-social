import { useCallback, useEffect, useRef, useState } from 'react';
import { SectionCardData } from '../types';
import { fetchSectionCards, generateSectionCards } from '../lib/booksApi';

interface SectionCardsState {
  cards: SectionCardData[];
  status: 'loading' | 'generating' | 'ready' | 'failed';
}

const POLL_MS = 2500;
const MAX_POLLS = 40; // ~100s

/**
 * Cards are generated server-side on first visit (generate-section-cards),
 * cached in the DB forever after. This hook triggers generation when needed
 * and polls until the cards exist.
 */
export function useSectionCards(sectionId: string | undefined) {
  const [state, setState] = useState<SectionCardsState>({ cards: [], status: 'loading' });
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    cancelledRef.current = false;
    setState({ cards: [], status: 'loading' });

    try {
      const existing = await fetchSectionCards(sectionId);
      if (cancelledRef.current) return;
      if (existing.length > 0) {
        setState({ cards: existing, status: 'ready' });
        return;
      }

      setState({ cards: [], status: 'generating' });
      const result = await generateSectionCards(sectionId);
      if (cancelledRef.current) return;

      if (result === 'ready') {
        const cards = await fetchSectionCards(sectionId);
        if (!cancelledRef.current) setState({ cards, status: cards.length ? 'ready' : 'failed' });
        return;
      }
      if (result === 'failed') {
        setState({ cards: [], status: 'failed' });
        return;
      }

      // Someone else is generating — poll until the cards appear.
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancelledRef.current) return;
        const cards = await fetchSectionCards(sectionId);
        if (cards.length > 0) {
          setState({ cards, status: 'ready' });
          return;
        }
      }
      setState({ cards: [], status: 'failed' });
    } catch {
      if (!cancelledRef.current) setState({ cards: [], status: 'failed' });
    }
  }, [sectionId]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  return { ...state, retry: load };
}
