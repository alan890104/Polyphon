// Generated covers: a gradient and a geometric motif picked from the id. A playlist shows its first four songs as a 2×2 mosaic.
// A cover fills the box it is placed in; the parent sets the size.

import type { ReactNode } from 'react';
import { artFor, coverIds, type Motif } from '../art.ts';
import type { LibraryPlaylist } from '../library.ts';

const LIGHT = '#fff';
const DARK = '#000';

/** Each motif on a 100×100 canvas; `shift` (0-1) moves its parts around */
const MOTIFS: Record<Motif, (shift: number) => ReactNode> = {
  sun: (shift) => (
    <>
      <circle cx={50} cy={60 - shift * 14} r={26} fill={LIGHT} fillOpacity={0.88} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={0} y={58 + i * 9} width={100} height={1.5 + i * 1.2} fill={DARK} fillOpacity={0.3} />
      ))}
    </>
  ),
  rings: (shift) => (
    <g fill="none" stroke={LIGHT} strokeWidth={5}>
      {[14, 28, 42, 56, 70, 84].map((r, i) => (
        <circle key={r} cx={14 + shift * 24} cy={86} r={r} strokeOpacity={0.6 - i * 0.08} />
      ))}
    </g>
  ),
  stripes: (shift) => (
    <g transform={`rotate(-35 50 50) translate(${shift * 18} 0)`}>
      {[-3, -2, -1, 0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={i * 18} y={-40} width={i % 2 ? 6 : 9} height={180} fill={i % 2 ? DARK : LIGHT} fillOpacity={i % 2 ? 0.22 : 0.3} />
      ))}
    </g>
  ),
  peaks: (shift) => (
    <>
      <circle cx={70 - shift * 30} cy={28} r={9} fill={LIGHT} fillOpacity={0.9} />
      <polygon points={`0,78 28,${44 + shift * 10} 54,70 76,46 100,66 100,100 0,100`} fill={DARK} fillOpacity={0.2} />
      <polygon points="0,90 34,62 62,88 84,70 100,82 100,100 0,100" fill={DARK} fillOpacity={0.34} />
    </>
  ),
  orbit: (shift) => (
    <>
      <ellipse cx={50} cy={52} rx={46} ry={15} transform="rotate(-18 50 52)" fill="none" stroke={LIGHT} strokeOpacity={0.55} strokeWidth={2} />
      <circle cx={44} cy={54} r={22} fill={LIGHT} fillOpacity={0.9} />
      <circle cx={84 - shift * 10} cy={38 + shift * 4} r={5} fill={DARK} fillOpacity={0.5} />
    </>
  ),
  dots: (shift) => {
    const big = Math.floor(shift * 25);
    return Array.from({ length: 25 }, (_, i) => (
      <circle key={i} cx={18 + (i % 5) * 16} cy={18 + Math.floor(i / 5) * 16} r={i === big ? 8 : 2.6} fill={LIGHT} fillOpacity={i === big ? 0.92 : 0.42} />
    ));
  },
  waves: (shift) => (
    <g fill="none" stroke={LIGHT} strokeWidth={4} strokeLinecap="round">
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 22 + i * 14;
        const lift = 8 + shift * 8;
        return <path key={i} d={`M-10 ${y} Q 15 ${y - lift} 40 ${y} T 90 ${y} T 140 ${y}`} strokeOpacity={0.75 - i * 0.12} />;
      })}
    </g>
  ),
};

export function Cover({ id }: { id: string }) {
  const { background, motif, turn, shift } = artFor(id);
  return (
    <div className="cover" style={{ background }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <g transform={`rotate(${turn} 50 50)`}>{MOTIFS[motif](shift)}</g>
      </svg>
    </div>
  );
}

export function PlaylistCover({ playlist }: { playlist: LibraryPlaylist }) {
  const ids = coverIds(playlist);
  if (ids.length === 1) return <Cover id={ids[0]} />;
  return (
    <div className="cover cover--mosaic" aria-hidden="true">
      {ids.map((id) => (
        <Cover key={id} id={id} />
      ))}
    </div>
  );
}
