// The visualizer's own icons (settings, full screen), drawn like the app's set in components/Icons.tsx: a 20-unit grid,
// 1.5-unit strokes with round ends, in the current text colour.

import type { ReactNode } from 'react';

function Line({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const SettingsIcon = () => (
  <Line>
    <path d="M3.5 6.5h7.5M15.5 6.5h1M3.5 13.5h1M9 13.5h7.5" />
    <circle cx="13.25" cy="6.5" r="1.75" />
    <circle cx="6.75" cy="13.5" r="1.75" />
  </Line>
);

export const EnterFullscreenIcon = () => (
  <Line>
    <path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" />
  </Line>
);

export const ExitFullscreenIcon = () => (
  <Line>
    <path d="M7.5 3.5v4h-4M12.5 3.5v4h4M7.5 16.5v-4h-4M12.5 16.5v-4h4" />
  </Line>
);
