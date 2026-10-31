// The listener's background picture: restored from IndexedDB on mount, replaced by an upload, removed on request.

import { useCallback, useEffect, useState } from 'react';
import { clearImage, decodeImage, loadImage, saveImage } from './imageStore.ts';

/** Bigger uploads are refused (a background never needs more) */
const MAX_BYTES = 30 * 1024 * 1024;

export type ImageStatus = 'none' | 'loading' | 'kept' | 'session' | 'error';

export interface BackgroundImage {
  image: HTMLCanvasElement | null;
  status: ImageStatus;
  /** Why the last upload failed */
  error: string | null;
  choose: (file: File) => Promise<boolean>;
  remove: () => void;
}

export function useBackgroundImage(): BackgroundImage {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ImageStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const blob = await loadImage();
      if (!blob) {
        if (live) setStatus((s) => (s === 'loading' ? 'none' : s));
        return;
      }
      try {
        const decoded = await decodeImage(blob);
        if (live) {
          setImage((current) => current ?? decoded);
          setStatus((s) => (s === 'loading' ? 'kept' : s));
        }
      } catch {
        // The stored picture no longer decodes: forget it
        await clearImage();
        if (live) setStatus((s) => (s === 'loading' ? 'none' : s));
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const choose = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('That file is not a picture.');
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError('That picture is over 30 MB.');
      return false;
    }
    try {
      const decoded = await decodeImage(file);
      setImage(decoded);
      setStatus((await saveImage(file)) ? 'kept' : 'session');
      return true;
    } catch {
      setError('That picture could not be opened.');
      return false;
    }
  }, []);

  const remove = useCallback(() => {
    setImage(null);
    setStatus('none');
    void clearImage();
  }, []);

  return { image, status, error, choose, remove };
}
