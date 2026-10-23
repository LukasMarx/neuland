/**
 * Spielerfarbe für Schrift, Linien und kleine Punkte auf der dunklen Oberfläche.
 * Sehr dunkle Farben (Schwarz) verschwinden dort und werden zu einem mittleren Grau aufgehellt.
 */
export function uiColor(color: string): string {
  const rgb = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)?.slice(1).map((h) => parseInt(h, 16) / 255);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  if (0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.04) return color;
  return '#' + rgb.map((c) => Math.round((c + (0xe8 / 255 - c) * 0.5) * 255).toString(16).padStart(2, '0')).join('');
}
