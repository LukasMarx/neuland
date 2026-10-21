import { DevCard, HarborType, Resource, Terrain } from '../../engine';

export const TERRAIN_ICONS: Record<Terrain, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰️',
  desert: '🌵',
};

export const TERRAIN_COLORS: Record<Terrain, string> = {
  wood: '#3f7d3a',
  brick: '#c4693f',
  sheep: '#9bc65a',
  wheat: '#e6c24a',
  ore: '#8e98a3',
  desert: '#e2d3a2',
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

export function harborLabel(type: HarborType): string {
  return type === 'any' ? '3:1' : `2:1`;
}
