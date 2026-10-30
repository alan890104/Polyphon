// Idle detection for auto-hiding controls: true once the pointer and keyboard have been still for a while inside an element.

import { useEffect, useState, type RefObject } from 'react';

export function useIdle(target: RefObject<HTMLElement | null>, enabled: boolean, delay = 3000): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!enabled || !element) {
      setIdle(false);
      return;
    }
    let timer = setTimeout(() => setIdle(true), delay);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delay);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'] as const;
    for (const name of events) element.addEventListener(name, wake, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const name of events) element.removeEventListener(name, wake);
    };
  }, [target, enabled, delay]);
  return idle;
}
