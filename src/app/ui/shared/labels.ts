import { DevCard, HarborType, Resource, Terrain } from '../../engine';

export const TERRAIN_ICONS: Record<Terrain, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰️',
  desert: '🌵',
  sea: '🌊',
  gold: '✨',
  fog: '☁️',
};

export const TERRAIN_COLORS: Record<Terrain, string> = {
  wood: '#3f7d3a',
  brick: '#c4693f',
  sheep: '#9bc65a',
  wheat: '#e6c24a',
  ore: '#8e98a3',
  desert: '#e2d3a2',
  sea: '#2c6d8f',
  gold: '#e0b33c',
  fog: '#c9d0d4',
};

export const RESOURCE_ICONS: Record<Resource, string> = {
  wood: TERRAIN_ICONS.wood,
  brick: TERRAIN_ICONS.brick,
  sheep: TERRAIN_ICONS.sheep,
  wheat: TERRAIN_ICONS.wheat,
  ore: '🪨',
};

export const DEV_CARD_ICONS: Record<DevCard, string> = {
  knight: '⚔️',
  roadBuilding: '🛤️',
  yearOfPlenty: '🎁',
  monopoly: '💰',
  victoryPoint: '🏆',
};

export const DEV_CARD_HELP: Record<DevCard, string> = {
  knight: 'Versetze den Räuber und ziehe eine Karte.',
  roadBuilding: 'Baue 2 Straßen kostenlos.',
  yearOfPlenty: 'Nimm dir 2 beliebige Rohstoffe aus der Bank.',
  monopoly: 'Alle anderen geben dir einen Rohstoff ihrer Wahl komplett ab.',
  victoryPoint: 'Zählt automatisch 1 Siegpunkt.',
};

/** Ausführliche Regeltexte für die Rückseite der vergrößerten Karte. */
export const DEV_CARD_RULES: Record<DevCard, string> = {
  knight:
    'Spiele den Ritter vor oder nach dem Würfeln. Versetze den Räuber auf ein anderes Feld und ziehe bei einem Spieler, der dort ein Gebäude hat, eine zufällige Rohstoffkarte. Wer als Erster 3 Ritter gespielt hat, bekommt die größte Rittermacht und damit 2 Siegpunkte.',
  roadBuilding: 'Baue sofort 2 Straßen, ohne Rohstoffe zu bezahlen. Es gelten die normalen Bauregeln.',
  yearOfPlenty:
    'Nimm dir 2 beliebige Rohstoffkarten aus der Bank, auch zweimal dieselbe. Du kannst sie im selben Zug noch verbauen.',
  monopoly: 'Nenne einen Rohstoff. Alle anderen Spieler müssen dir sämtliche Karten dieses Rohstoffs geben.',
  victoryPoint:
    'Diese Karte zählt 1 Siegpunkt. Sie bleibt verdeckt in deiner Hand und wird erst am Spielende für alle sichtbar.',
};

export const DEV_CARD_GENERAL = 'Pro Zug darfst du eine Entwicklungskarte spielen, aber nicht in dem Zug, in dem du sie gekauft hast.';

export function harborLabel(type: HarborType): string {
  return type === 'any' ? '3:1' : `2:1`;
}
