// Keyboard shortcuts: Space plays and pauses, the left and right arrows seek five seconds. Ignored while typing.

import { useEffect } from 'react';
import { usePlayer } from './usePlayer.ts';

const SEEK_STEP = 5;

export function useShortcuts(): void {
  const player = usePlayer();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A focused control that handles the key itself (a slider's arrows) has already called preventDefault()
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === ' ') {
        if (!e.repeat) player.toggle();
      } else if (e.key === 'ArrowLeft') player.seekBy(-SEEK_STEP);
      else if (e.key === 'ArrowRight') player.seekBy(SEEK_STEP);
      else return;
      // Space would otherwise also scroll the page, or press the focused button
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player]);
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));
}
