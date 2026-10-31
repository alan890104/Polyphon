// Icons: one set on a 20-unit grid, drawn with 1.5-unit strokes and round ends in the current text color.
// The play and pause glyphs are solid, to sit inside the round play button.

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

function Solid({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Solid>
    <path d="M6.5 4.6v10.8a.8.8 0 0 0 1.22.68l8.64-5.4a.8.8 0 0 0 0-1.36L7.72 3.92a.8.8 0 0 0-1.22.68z" />
  </Solid>
);

export const PauseIcon = () => (
  <Solid>
    <rect x="5.5" y="4.5" width="3" height="11" rx="0.75" />
    <rect x="11.5" y="4.5" width="3" height="11" rx="0.75" />
  </Solid>
);

export const PreviousIcon = () => (
  <Line>
    <path d="M14.5 5.5v9L8 10z" />
    <path d="M5.5 5v10" />
  </Line>
);

export const NextIcon = () => (
  <Line>
    <path d="M5.5 5.5v9L12 10z" />
    <path d="M14.5 5v10" />
  </Line>
);

export const ShuffleIcon = () => (
  <Line>
    <path d="M3 6.5h2c2 0 3 1 5 3.5s3 3.5 5 3.5h2" />
    <path d="M3 13.5h2c2 0 3-1 5-3.5s3-3.5 5-3.5h2" />
    <path d="m15 4.5 2 2-2 2M15 11.5l2 2-2 2" />
  </Line>
);

const RepeatLoop = () => (
  <>
    <path d="M4 9.5v-1A2.5 2.5 0 0 1 6.5 6H16" />
    <path d="m14 4 2 2-2 2" />
    <path d="M16 10.5v1a2.5 2.5 0 0 1-2.5 2.5H4" />
    <path d="m6 12-2 2 2 2" />
  </>
);

export const RepeatIcon = () => (
  <Line>
    <RepeatLoop />
  </Line>
);

export const RepeatOneIcon = () => (
  <Line>
    <RepeatLoop />
    <path d="m9.25 9 1-.75v3.5" />
  </Line>
);

export const VolumeIcon = ({ level }: { level: number }) => (
  <Line>
    <path d="M3.5 7.75h2.25L9 5v10l-3.25-2.75H3.5z" />
    {level === 0 ? (
      <path d="m13 8 4 4m0-4-4 4" />
    ) : (
      <>
        <path d="M12.5 7.75a3.2 3.2 0 0 1 0 4.5" />
        {level >= 0.5 && <path d="M14.75 5.5a6.4 6.4 0 0 1 0 9" />}
      </>
    )}
  </Line>
);

/** The Now playing panel: a disc under its comb */
export const DiscIcon = () => (
  <Line>
    <circle cx="10" cy="11" r="6.5" />
    <circle cx="10" cy="11" r="1.25" />
    <path d="M10 2.5v4" />
  </Line>
);

/** The immersive visualizer: a disc radiating its spectrum */
export const VisualizerIcon = () => (
  <Line>
    <circle cx="10" cy="10" r="3.25" />
    <circle cx="10" cy="10" r="0.4" />
    <path d="M10 4.25v-2.5M10 15.75v2.5M4.25 10h-2.5M15.75 10h2.5" />
    <path d="m14.07 5.93 1.06-1.06M14.07 14.07l1.06 1.06M5.93 5.93 4.87 4.87M5.93 14.07l-1.06 1.06" />
  </Line>
);

export const CloseIcon = () => (
  <Line>
    <path d="m5.5 5.5 9 9m0-9-9 9" />
  </Line>
);

export const DownloadIcon = () => (
  <Line>
    <path d="M10 3.5V12" />
    <path d="M6.5 8.5 10 12l3.5-3.5" />
    <path d="M4.5 16h11" />
  </Line>
);

export const PlusIcon = () => (
  <Line>
    <path d="M10 4.5v11M4.5 10h11" />
  </Line>
);

export const WarningIcon = () => (
  <Line>
    <path d="M10 3.5 17 16H3z" />
    <path d="M10 8.25v3.5M10 13.75v.25" />
  </Line>
);

/** The Polyphon mark: a music box's comb, seven tuned tines cut from one plate, longest (lowest) to shortest (highest) */
export const Logo = () => (
  <svg className="logo" viewBox="0 0 40 40" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M5 30h30v4H5z" />
    <rect x="5" y="6" width="2.6" height="25" rx="1.3" />
    <rect x="9.6" y="9" width="2.6" height="22" rx="1.3" />
    <rect x="14.2" y="12" width="2.6" height="19" rx="1.3" />
    <rect x="18.8" y="14.6" width="2.6" height="16.4" rx="1.3" />
    <rect x="23.4" y="17" width="2.6" height="14" rx="1.3" />
    <rect x="28" y="19.2" width="2.6" height="11.8" rx="1.3" />
    <rect x="32.4" y="21.2" width="2.6" height="9.8" rx="1.3" />
  </svg>
);
