// The immersive visualizer, connected to the player: the full-screen view of the song playing, with its transport. Loaded on
// demand, so the visuals cost nothing until they are opened.

import { ImmersiveView } from '../visuals/ImmersiveView.tsx';
import { usePlayer, usePlayerState } from '../usePlayer.ts';

export default function ImmersiveMode({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const song = usePlayerState((s) => s.song);
  const playlist = usePlayerState((s) => s.playlist);
  const position = usePlayerState((s) => s.position);
  const status = usePlayerState((s) => s.status);
  const playback = usePlayerState((s) => s.playback);

  return (
    <ImmersiveView
      analyser={player.analyser}
      song={song?.song ?? null}
      playlistName={playlist?.title}
      position={position}
      duration={song?.duration ?? 0}
      playing={status === 'playing'}
      loading={status === 'loading'}
      playback={playback}
      onTogglePlay={() => player.toggle()}
      onNext={() => player.next()}
      onPrevious={() => player.previous()}
      onSeek={(seconds) => player.seek(seconds)}
      onClose={onClose}
    />
  );
}
