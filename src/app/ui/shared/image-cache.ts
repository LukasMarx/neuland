import { GameSettings, mapById, NEUTRALS, Terrain } from '../../engine';
import { TILE_IMAGES } from '../board/tile-art';
import { CARD_ART } from './card-art';
import { PieceKind, pieceImage } from './piece-art';
import { RESOURCE_ART } from './resource-art';

/**
 * Vorgeladene Grafiken: In der Lobby im Leerlauf geholt und decodiert, damit Brett und Hand beim Spielstart
 * sofort vollständig dastehen. Die Bilder bleiben hier gehalten, so trifft das Spiel denselben Eintrag im
 * Speicher-Cache des Browsers und fragt nicht noch einmal nach. Adressen genau wie im Spiel (`web/...`).
 */
const held = new Map<string, HTMLImageElement>();
const PARALLEL = 4;

/** Lädt die Adressen nach und nach im Leerlauf, jede nur einmal; bei „Datensparen“ gar nicht. */
export function preloadImages(urls: string[]): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const todo = [...new Set(urls)].filter((u) => !held.has(u));
  if (!todo.length) return;
  const next = async (): Promise<void> => {
    const url = todo.shift();
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    held.set(url, img);
    // Fehlt eine Datei, zeigt das Spiel ohnehin die Ersatzgrafik.
    await img.decode().catch(() => undefined);
    await idle();
    return next();
  };
  void idle().then(() => {
    for (let i = 0; i < PARALLEL; i++) void next();
  });
}

const BASE_TERRAIN: Terrain[] = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert'];
const BASE_PIECES: PieceKind[] = ['settlement', 'city', 'road', 'knight'];
const BASE_CARDS = ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const;
const GOODS = ['paper', 'cloth', 'coin'] as const;

/**
 * Alle Grafiken, die Brett, Hand und Dock gleich nach dem Start zeigen: Felder der gewählten Karte, Figuren
 * in den Farben im Raum, Rohstoffkarten und Hafen-Icons. Teile einer Erweiterung nur, wenn sie an ist.
 */
export function gameStartImages(settings: GameSettings, colors: string[]): string[] {
  const map = mapById(settings.map);
  const on = (id: string) => settings.variants?.includes(id) ?? false;
  const terrain = [...BASE_TERRAIN];
  const pieces = [...BASE_PIECES];
  const cards: (keyof typeof CARD_ART)[] = [...BASE_CARDS, 'back'];
  const resources: (keyof typeof RESOURCE_ART)[] = [...BASE_CARDS];
  const extra = ['web/tiles/papiercollage/ocean.jpg', 'web/pieces/papiercollage/robber.png', 'web/icons/ui/trade.png', 'web/banner/papiercollage/horn.png'];
  const seats = [...colors];

  if (map.seafaring) {
    terrain.push('gold');
    pieces.push('ship');
    extra.push('web/pieces/papiercollage/pirate.png', 'web/icons/ui/move-ship.png');
  }
  if (map.seafaring?.fog) terrain.push('fog');
  if (on('stadtwacht')) {
    pieces.push('guard1', 'metropolis');
    cards.push(...GOODS);
    resources.push(...GOODS);
    extra.push(
      'web/pieces/papiercollage/wall.png',
      'web/pieces/papiercollage/raiders.png',
      'web/icons/city/improve.png',
      ...['council', 'market', 'scholars'].flatMap((t) => [`web/icons/city/${t}.png`, `web/icons/city/event-${t}.png`]),
      'web/icons/city/event-ship.png',
    );
  }
  if (on('fischgruende')) {
    terrain.push('lake');
    extra.push('web/icons/fishing/ground.png', 'web/icons/fishing/fish-1.png');
  }
  if (on('flusslaeufe')) {
    pieces.push('bridge');
    extra.push('web/icons/rivers/coin.png');
  }
  if (on('duell')) {
    seats.push(...NEUTRALS.map((n) => n.color));
    extra.push('web/icons/duel/token.png');
  }
  if (on('wuerfelstapel')) extra.push('web/cards/dice-deck-back.jpg');

  const urls = [
    ...terrain.flatMap((t) => TILE_IMAGES[t] ?? []),
    ...extra,
    ...cards.map((c) => CARD_ART[c]),
    ...resources.map((r) => RESOURCE_ART[r]),
    ...[...new Set(seats)].flatMap((color) => pieces.map((kind) => pieceImage(kind, color))),
  ];
  return [...new Set(urls.filter((u): u is string => !!u))];
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 50);
  });
}
