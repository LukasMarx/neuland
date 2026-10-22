import { Commodity } from '../../engine';

/**
 * Platzhalter für die Güter der Stadtwacht, bis es Papiercollage-Grafiken gibt (Auftrag in
 * output/designs/stadtwacht-2026-10-22/grafik-auftrag.md): kleine SVGs als data-URI, als Symbol und als Karte.
 */
const ICONS: Record<Commodity, string> = {
  // Schriftrolle
  paper:
    '<rect x="14" y="18" width="36" height="28" rx="3" fill="#efe3c2" stroke="#6b5532" stroke-width="2.5"/>' +
    '<rect x="10" y="14" width="8" height="36" rx="4" fill="#d9c08a" stroke="#6b5532" stroke-width="2.5"/>' +
    '<rect x="46" y="14" width="8" height="36" rx="4" fill="#d9c08a" stroke="#6b5532" stroke-width="2.5"/>' +
    '<path d="M21 26h22M21 32h22M21 38h15" stroke="#8a6c3c" stroke-width="2" stroke-linecap="round"/>',
  // Stoffballen
  cloth:
    '<path d="M12 20 Q32 12 52 20 L52 46 Q32 38 12 46 Z" fill="#c55a4a" stroke="#5a2a20" stroke-width="2.5"/>' +
    '<path d="M12 28 Q32 20 52 28 M12 36 Q32 28 52 36" fill="none" stroke="#f0c9a8" stroke-width="2"/>' +
    '<ellipse cx="12" cy="33" rx="5" ry="13" fill="#a8473a" stroke="#5a2a20" stroke-width="2.5"/>',
  // Silbermünze
  coin:
    '<circle cx="32" cy="32" r="19" fill="#d7dde2" stroke="#4d5a63" stroke-width="2.5"/>' +
    '<circle cx="32" cy="32" r="13" fill="none" stroke="#8d9aa3" stroke-width="2"/>' +
    '<path d="M26 32h12M32 26v12" stroke="#4d5a63" stroke-width="2.5" stroke-linecap="round"/>',
};

const CARD_COLORS: Record<Commodity, [string, string]> = {
  paper: ['#f3ead2', '#d8c597'],
  cloth: ['#f4dccf', '#d99a84'],
  coin: ['#e6ecef', '#aab6be'],
};

const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const GOODS_ICON: Record<Commodity, string> = Object.fromEntries(
  Object.entries(ICONS).map(([k, body]) => [k, uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)]),
) as Record<Commodity, string>;

export const GOODS_CARD: Record<Commodity, string> = Object.fromEntries(
  (Object.keys(ICONS) as Commodity[]).map((k) => {
    const [a, b] = CARD_COLORS[k];
    return [
      k,
      uri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
          `<rect width="200" height="280" rx="14" fill="url(#g)"/><rect x="8" y="8" width="184" height="264" rx="10" fill="none" stroke="#fff8" stroke-width="3"/>` +
          `<g transform="translate(36 60) scale(2)">${ICONS[k]}</g></svg>`,
      ),
    ];
  }),
) as Record<Commodity, string>;
