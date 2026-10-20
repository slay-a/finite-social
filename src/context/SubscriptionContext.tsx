import React, { createContext, useContext } from 'react';

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
  return (
    <SubscriptionContext.Provider value={{
      isPro:      true,
      feedCount:  0,
      codeCount:  0,
      feedLimit:  Infinity,
      codeLimit:  Infinity,
      canFeed:    true,
      canCode:    true,
      recordFeed: () => {},
      recordCode: () => {},
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
