// The listening room: the library sidebar, the playlist view, the Now playing panel and the bar along the bottom.
// MIDI files can be imported from the sidebar or dropped anywhere on the window.

import { use, useState } from 'react';
import { DropOverlay } from './components/DropOverlay.tsx';
import { NowPlayingBar } from './components/NowPlayingBar.tsx';
import { NowPlayingPanel } from './components/NowPlayingPanel.tsx';
import { PlaylistView } from './components/PlaylistView.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Toast } from './components/Toast.tsx';
import { IMPORTS_ID, type LibraryPlaylist } from './library.ts';
import { useFileDrop } from './useFileDrop.ts';
import { useImports } from './useImports.ts';
import { usePlayerState } from './usePlayer.ts';
import { useShortcuts } from './useShortcuts.ts';

/** From this width the Now playing panel is a column beside the playlist (and starts open); below it, it opens over the page */
const WIDE = '(min-width: 1100px)';

export function App({ library }: { library: Promise<LibraryPlaylist[]> }) {
  const examples = use(library);
  const imports = useImports();
  const playlists = imports.playlist ? [imports.playlist, ...examples] : examples;
  // The open playlist is kept in the address, so a reload (Vite reloads when a song file changes) comes back to it
  const [selectedId, setSelectedId] = useState(() => location.hash.slice(1) || examples[0].id);
  const [panelOpen, setPanelOpen] = useState(() => matchMedia(WIDE).matches);
  const hasSong = usePlayerState((s) => s.song !== null);
  const selected = playlists.find((p) => p.id === selectedId) ?? playlists[0];
  const showPanel = panelOpen && hasSong;
  useShortcuts();

  const select = (id: string) => {
    setSelectedId(id);
    history.replaceState(null, '', `#${id}`);
  };
  const importFiles = async (files: File[]) => {
    if (await imports.add(files)) select(IMPORTS_ID);
  };
  const dragging = useFileDrop(importFiles);

  return (
    <div className="app" data-panel={showPanel ? '' : undefined}>
      <Sidebar playlists={playlists} selected={selected} onSelect={(p) => select(p.id)} onImport={importFiles} />
      <PlaylistView key={selected.id} playlist={selected} />
      {showPanel && <NowPlayingPanel onClose={() => setPanelOpen(false)} />}
      <NowPlayingBar panelOpen={showPanel} onTogglePanel={() => setPanelOpen(!showPanel)} />
      {imports.errors.length > 0 && <Toast title="Couldn't import" messages={imports.errors} onDismiss={imports.dismissErrors} />}
      {dragging && <DropOverlay />}
    </div>
  );
}
