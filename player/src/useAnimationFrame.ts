// Run a callback on every animation frame while the component is mounted, for canvases and meters drawn outside React.

import { useEffect, useEffectEvent } from 'react';

export function useAnimationFrame(callback: () => void): void {
  const onFrame = useEffectEvent(callback);
  useEffect(() => {
    let id = requestAnimationFrame(function frame() {
      onFrame();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, []);
}
