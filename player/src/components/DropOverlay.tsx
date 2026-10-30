// Shown while files are dragged over the window: drop them to import.

import { ImportIcon } from './Icons.tsx';

export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__card">
        <ImportIcon />
        <p className="drop-overlay__title">Drop MIDI files to import</p>
        <p className="drop-overlay__hint">They play right here in your browser. Nothing is uploaded.</p>
      </div>
    </div>
  );
}
