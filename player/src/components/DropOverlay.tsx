// Shown while files are dragged over the window: a blank disc waiting to be punched. Drop them to import.

export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__disc">
        <p className="drop-overlay__title">Drop MIDI files</p>
        <p className="label">Nothing leaves this tab</p>
      </div>
    </div>
  );
}
