// Icons: small inline SVGs on a 24-unit grid, drawn in the current text color.

import type { ReactNode } from 'react';

/** Solid shapes */
function Solid({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Rounded 2-unit strokes */
function Line({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Solid>
    <path d="M7.5 5.2v13.6a1.1 1.1 0 0 0 1.67.94l11.1-6.8a1.1 1.1 0 0 0 0-1.88l-11.1-6.8A1.1 1.1 0 0 0 7.5 5.2z" />
  </Solid>
);

export const PauseIcon = () => (
  <Solid>
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.3" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" />
  </Solid>
);

export const NextIcon = () => (
  <Solid>
    <path d="M5 6v12a1 1 0 0 0 1.55.83l8.9-6a1 1 0 0 0 0-1.66l-8.9-6A1 1 0 0 0 5 6z" />
    <rect x="16.6" y="5" width="2.6" height="14" rx="1.3" />
  </Solid>
);

export const PreviousIcon = () => (
  <Solid>
    <path d="M19 6v12a1 1 0 0 1-1.55.83l-8.9-6a1 1 0 0 1 0-1.66l8.9-6A1 1 0 0 1 19 6z" />
    <rect x="4.8" y="5" width="2.6" height="14" rx="1.3" />
  </Solid>
);

export const ShuffleIcon = () => (
  <Line>
    <path d="M16 4h4v4" />
    <path d="M4 19 20 4" />
    <path d="M20 16v4h-4" />
    <path d="m14.5 14.5 5.5 5.5" />
    <path d="M4 5l5 5" />
  </Line>
);

export const RepeatIcon = () => (
  <Line>
    <path d="m17 2 3 3-3 3" />
    <path d="M4 11v-1a5 5 0 0 1 5-5h11" />
    <path d="m7 22-3-3 3-3" />
    <path d="M20 13v1a5 5 0 0 1-5 5H4" />
  </Line>
);

export const RepeatOneIcon = () => (
  <Line>
    <path d="m17 2 3 3-3 3" />
    <path d="M4 11v-1a5 5 0 0 1 5-5h11" />
    <path d="m7 22-3-3 3-3" />
    <path d="M20 13v1a5 5 0 0 1-5 5H4" />
    <path d="M11 10.5 12.5 9.5v5" />
  </Line>
);

const Speaker = () => <path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z" fill="currentColor" />;

export const VolumeIcon = ({ level }: { level: number }) => (
  <Line>
    <Speaker />
    {level === 0 ? (
      <path d="m16 9.5 5 5m0-5-5 5" />
    ) : (
      <>
        <path d="M15.5 9a4 4 0 0 1 0 6" />
        {level >= 0.5 && <path d="M18.5 6a8 8 0 0 1 0 12" />}
      </>
    )}
  </Line>
);

export const PanelIcon = () => (
  <Line>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M14.5 4v16" />
    <path d="M7 9h4M7 13h3" />
  </Line>
);

export const CloseIcon = () => (
  <Line>
    <path d="M6 6l12 12M18 6 6 18" />
  </Line>
);

export const DownloadIcon = () => (
  <Line>
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </Line>
);

export const PlusIcon = () => (
  <Line>
    <path d="M12 5v14M5 12h14" />
  </Line>
);

/** A file going into a tray: the drop target */
export const ImportIcon = () => (
  <Line>
    <path d="M12 3v11" />
    <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Line>
);

export const ClockIcon = () => (
  <Line>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Line>
);

export const WarningIcon = () => (
  <Line>
    <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    <path d="M12 10v3.5M12 17h.01" />
  </Line>
);

/** The Polyphon mark: a few voices of different heights */
export const Logo = () => (
  <svg className="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <g fill="var(--accent-ink)">
      <rect x="7" y="12" width="3.2" height="8" rx="1.6" />
      <rect x="12.2" y="7" width="3.2" height="18" rx="1.6" />
      <rect x="17.4" y="10" width="3.2" height="12" rx="1.6" />
      <rect x="22.6" y="13.5" width="3.2" height="5" rx="1.6" />
    </g>
  </svg>
);
