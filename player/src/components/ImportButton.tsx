// "Import MIDI": opens a file picker for .mid and .midi files (they can also be dropped anywhere on the window).

import { useRef } from 'react';
import { PlusIcon } from './Icons.tsx';

export function ImportButton({ onImport }: { onImport: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="import-button" title="Import MIDI files, or drop them anywhere" onClick={() => input.current?.click()}>
        <PlusIcon />
        Import MIDI
      </button>
      <input
        ref={input}
        type="file"
        accept=".mid,.midi"
        multiple
        hidden
        onChange={(e) => {
          onImport([...(e.currentTarget.files ?? [])]);
          // Cleared, so picking the same file again still counts as a change
          e.currentTarget.value = '';
        }}
      />
    </>
  );
}
