import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { FREE_FEED_LIMIT, FREE_CODE_LIMIT } from '../lib/purchases';

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const FEED_KEY = (uid: string) => `finitesocial:usage:feed:${uid}:${todayKey()}`;
const CODE_KEY = (uid: string) => `finitesocial:usage:code:${uid}:${todayKey()}`;

interface SubscriptionContextValue {
  isPro:       boolean;
  feedCount:   number;
  codeCount:   number;
  feedLimit:   number;
  codeLimit:   number;
  canFeed:     boolean;
  canCode:     boolean;
  recordFeed:  () => void;
  recordCode:  () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [feedCount, setFeedCount] = useState(0);
  const [codeCount, setCodeCount] = useState(0);

  // Reload counts whenever the logged-in user changes
  const userId = user?.id ?? 'guest';
  useEffect(() => {
    setFeedCount(0);
    setCodeCount(0);
    Promise.all([
      AsyncStorage.getItem(FEED_KEY(userId)),
      AsyncStorage.getItem(CODE_KEY(userId)),
    ]).then(([f, c]) => {
      if (f) setFeedCount(parseInt(f, 10));
      if (c) setCodeCount(parseInt(c, 10));
    });
  }, [userId]);

  const recordFeed = useCallback(() => {
    setFeedCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(FEED_KEY(userId), String(next));
      return next;
    });
  }, [userId]);

  const recordCode = useCallback(() => {
    setCodeCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(CODE_KEY(userId), String(next));
      return next;
    });
  }, [userId]);

  const isPro  = profile?.is_pro ?? false;
  const canFeed = isPro || feedCount < FREE_FEED_LIMIT;
  const canCode = isPro || codeCount < FREE_CODE_LIMIT;

  return (
    <SubscriptionContext.Provider value={{
      isPro,
      feedCount,
      codeCount,
      feedLimit: FREE_FEED_LIMIT,
      codeLimit: FREE_CODE_LIMIT,
      canFeed,
      canCode,
      recordFeed,
      recordCode,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be inside SubscriptionProvider');
  return ctx;
}
