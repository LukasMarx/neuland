export type PieceKind = 'knight' | 'city' | 'road' | 'settlement' | 'ship' | 'bridge' | 'metropolis' | 'guard1' | 'guard2' | 'guard3' | 'trader';

/** Palette of the exported PNGs; unknown saved colors retain the SVG fallback. */
const PIECE_COLORS: Readonly<Record<string, string>> = {
  '#d23c3c': 'red',
  '#2f64d6': 'blue',
  '#f4f1e8': 'white',
  '#ffffff': 'white',
  '#ee8a1c': 'orange',
  '#2f9a48': 'green',
  '#2e2b2f': 'black',
  '#e0569f': 'pink',
  '#8152b3': 'purple',
  // Frühere Lobbyfarben, für gespeicherte Spiele.
  '#7b4a2a': 'brown',
  '#d5a824': 'gold',
  // Neutrale Mitspieler im Duell
  '#9aa1a8': 'grey-light',
  '#5d646c': 'grey-dark',
};

export function pieceImage(kind: PieceKind, color: string): string | null {
  const palette = PIECE_COLORS[color.trim().toLowerCase()];
  const style = kind === 'city' || kind === 'settlement' || kind === 'metropolis' ? 'papiercollage-organic-v2' : 'papiercollage';
  return palette ? `web/pieces/${style}/${kind}-${palette}.png` : null;
}
