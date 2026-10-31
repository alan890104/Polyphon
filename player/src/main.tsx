// Entry point: create the player, start loading the library and render the app.

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadLibrary } from './library.ts';
import { Player } from './player.ts';
import { PlayerContext } from './usePlayer.ts';
import './styles.css';

const player = new Player();
const library = loadLibrary();

// Development only: the player on window, for the console and the end-to-end checks
if (import.meta.env.DEV) Object.assign(window, { player });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerContext value={player}>
      <Suspense fallback={<div className="splash" />}>
        <App library={library} />
      </Suspense>
    </PlayerContext>
  </StrictMode>,
);
