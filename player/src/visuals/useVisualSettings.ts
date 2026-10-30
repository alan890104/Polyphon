// The visualizer settings as React state: read once from storage, saved on every change.

import { useCallback, useEffect, useState } from 'react';
import { defaultSettings, loadSettings, prefersReducedMotion, saveSettings, type VisualSettings } from './settings.ts';

export function useVisualSettings(): {
  settings: VisualSettings;
  update: (patch: Partial<VisualSettings>) => void;
  reset: () => void;
} {
  const [settings, setSettings] = useState(() => loadSettings(prefersReducedMotion()));
  useEffect(() => saveSettings(settings), [settings]);
  const update = useCallback((patch: Partial<VisualSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings(defaultSettings(prefersReducedMotion())), []);
  return { settings, update, reset };
}
