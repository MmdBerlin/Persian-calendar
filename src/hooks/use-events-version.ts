'use client';

import { useSyncExternalStore } from 'react';
import { subscribeEvents, getEventsVersion } from '@/lib/events';

/** Re-renders the component when occasion data is updated (downloaded from the internet). */
export function useEventsVersion(): number {
  return useSyncExternalStore(subscribeEvents, getEventsVersion, () => 0);
}
