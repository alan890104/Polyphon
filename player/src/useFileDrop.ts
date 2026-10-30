// Files dragged anywhere onto the window: tells whether a drag is over it, and hands the dropped files over.

import { useEffect, useEffectEvent, useState } from 'react';

export function useFileDrop(onDrop: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const drop = useEffectEvent(onDrop);

  useEffect(() => {
    // dragenter and dragleave fire for every element crossed on the way, so count them to know when the drag leaves the window
    let depth = 0;
    const carriesFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const onDragEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (carriesFiles(e) && --depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!carriesFiles(e) || !e.dataTransfer) return;
      // Accepting dragover is what allows the drop
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onDropFiles = (e: DragEvent) => {
      if (!carriesFiles(e) || !e.dataTransfer) return;
      // Otherwise the browser opens the file
      e.preventDefault();
      depth = 0;
      setDragging(false);
      drop([...e.dataTransfer.files]);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDropFiles);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDropFiles);
    };
  }, []);

  return dragging;
}
