// React bindings for the player: the instance from context, and a selector hook that re-renders only when its slice of the state changes.

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Player, PlayerState } from './player.ts';

export const PlayerContext = createContext<Player | null>(null);

export function usePlayer(): Player {
  const player = useContext(PlayerContext);
  if (!player) throw new Error('usePlayer() needs a <PlayerContext> above it');
  return player;
}

/**
 * Read part of the player state, re-rendering when it changes.
 * `select` must return a primitive or something taken from the state as is (a new object would change on every call).
 *
 * @example
 * const playing = usePlayerState((s) => s.status === 'playing');
 */
export function usePlayerState<T>(select: (state: PlayerState) => T): T {
  const player = usePlayer();
  return useSyncExternalStore(player.subscribe, () => select(player.state));
}
