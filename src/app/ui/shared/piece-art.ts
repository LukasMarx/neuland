export type PieceKind = 'knight' | 'city' | 'road' | 'settlement';

/** Palette of the exported PNGs; unknown saved colors retain the SVG fallback. */
const PIECE_COLORS: Readonly<Record<string, string>> = {
  '#d23c3c': 'red',
  '#2f64d6': 'blue',
  '#f4f1e8': 'white',
  '#ffffff': 'white',
  '#ee8a1c': 'orange',
  '#2f9a48': 'green',
  '#7b4a2a': 'brown',
  '#d5a824': 'gold',
  '#8152b3': 'purple',
};

export function pieceImage(kind: PieceKind, color: string): string | null {
  const palette = PIECE_COLORS[color.trim().toLowerCase()];
  const style = kind === 'city' || kind === 'settlement' ? 'papiercollage-organic-v2' : 'papiercollage';
  return palette ? `web/pieces/${style}/${kind}-${palette}.png` : null;
}
