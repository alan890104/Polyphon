// Small animated indicators: equalizer bars for the song that is playing, and a spinner while a song prepares its samples.

export function Equalizer() {
  return (
    <span className="equalizer" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
