// Small indicators: a turning disc for the song that is playing, and a spinner while a song prepares its samples.

export function PlayingDisc() {
  return (
    <svg className="playing-disc" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14.93 8.2a5.25 5.25 0 0 1 0 3.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <g fill="currentColor">
        <circle cx="10" cy="10" r="1.4" />
        <circle cx="12.63" cy="5.45" r="1.1" />
        <circle cx="12.63" cy="14.55" r="1.1" />
        <circle cx="4.93" cy="11.36" r="1.1" />
      </g>
    </svg>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
