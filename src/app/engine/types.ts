export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export const RESOURCES: readonly Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export type Terrain = Resource | 'desert';
export type ResourceCounts = Record<Resource, number>;
export type DevCard = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';
export type HarborType = Resource | 'any';

/** base = 3–4 Spieler (19 Felder), ext = 5–6-Erweiterung (30 Felder). */
export type Layout = 'base' | 'ext';

export interface HexState {
  terrain: Terrain;
  number: number | null;
}

export interface HarborState {
  type: HarborType;
  edge: number;
}

export interface BoardState {
  layout: Layout;
  hexes: HexState[];
  harbors: HarborState[];
}

export interface Building {
  owner: number;
  type: 'settlement' | 'city';
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  resources: ResourceCounts;
  devCards: DevCard[];
  /** Diese Runde gekauft, erst ab dem nächsten Zug spielbar. */
  newDevCards: DevCard[];
  knights: number;
}

export interface TradeOffer {
  id: number;
  from: number;
  /** Aus Sicht von `from`: was er abgibt und was er bekommt. */
  give: ResourceCounts;
  want: ResourceCounts;
  /** Gegenangebot eines Mitspielers an den aktiven Spieler. */
  counter: boolean;
  accepted: number[];
  declined: number[];
}

export type ReturnPhase = 'roll' | 'main';

export type Phase =
  | { kind: 'setup'; order: number[]; index: number; step: 'settlement' | 'road'; settlement: number | null }
  | { kind: 'roll' }
  /** pending[seat] = Anzahl Karten, die dieser Spieler noch abwerfen muss. */
  | { kind: 'discard'; pending: number[] }
  | { kind: 'robber'; returnTo: ReturnPhase }
  | { kind: 'main' }
  | { kind: 'roadBuilding'; remaining: number; returnTo: ReturnPhase }
  /** Sonderbauphase (5–6 Spieler): queue[0] ist gerade dran. */
  | { kind: 'specialBuild'; queue: number[] }
  | { kind: 'ended' };

/** Wo eine Karte herkommt oder hingeht, für die Flug-Animation. */
export type TransferPoint =
  | { kind: 'bank' }
  | { kind: 'player'; seat: number }
  | { kind: 'hex'; id: number }
  | { kind: 'vertex'; id: number }
  | { kind: 'edge'; id: number };

export interface Transfer {
  from: TransferPoint;
  to: TransferPoint;
  card: Resource | 'dev';
  count: number;
  /** Nur Geber und Nehmer sehen, welche Karte es ist (Räuber). */
  hidden?: boolean;
}

export interface GameSettings {
  victoryPoints: number;
}

export interface LogEntry {
  seat: number | null;
  text: string;
}

export interface GameState {
  /** Kennung dieser Partie. Stände verschiedener Partien werden nie über die Version verglichen. */
  id?: string;
  version: number;
  rng: number;
  settings: GameSettings;
  board: BoardState;
  players: PlayerState[];
  bank: ResourceCounts;
  devDeck: DevCard[];
  buildings: (Building | null)[];
  roads: (number | null)[];
  robber: number;
  current: number;
  turn: number;
  phase: Phase;
  dice: [number, number] | null;
  devPlayed: boolean;
  longestRoad: number | null;
  roadLengths: number[];
  largestArmy: number | null;
  offers: TradeOffer[];
  nextOfferId: number;
  log: LogEntry[];
  /** Kartenbewegungen der letzten Aktion. */
  transfers: Transfer[];
  winner: number | null;
}

export type Action =
  | { type: 'placeSettlement'; vertex: number }
  | { type: 'placeRoad'; edge: number }
  | { type: 'roll' }
  | { type: 'discard'; resources: ResourceCounts }
  | { type: 'moveRobber'; hex: number; victim: number | null }
  | { type: 'buildRoad'; edge: number }
  | { type: 'buildSettlement'; vertex: number }
  | { type: 'buildCity'; vertex: number }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: Resource; get: Resource }
  /** Mehrere Bank- und Hafentausche auf einmal, ganz oder gar nicht. */
  | { type: 'bankTradeBatch'; give: ResourceCounts; get: ResourceCounts }
  | { type: 'offerTrade'; give: ResourceCounts; want: ResourceCounts }
  | { type: 'respondTrade'; offerId: number; accept: boolean }
  | { type: 'confirmTrade'; offerId: number; partner: number }
  | { type: 'cancelTrade'; offerId: number }
  /** Eigene Angebote zurückziehen; wer am Zug ist, lehnt damit auch alle Gegenangebote ab. */
  | { type: 'withdrawOffers' }
  | { type: 'endTurn' };

export const RESOURCE_NAMES: Record<Resource, string> = {
  wood: 'Holz',
  brick: 'Lehm',
  sheep: 'Wolle',
  wheat: 'Getreide',
  ore: 'Erz',
};

export const DEV_CARD_NAMES: Record<DevCard, string> = {
  knight: 'Ritter',
  roadBuilding: 'Straßenbau',
  yearOfPlenty: 'Erfindung',
  monopoly: 'Monopol',
  victoryPoint: 'Siegpunkt',
};

export const COSTS = {
  road: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
  devCard: { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 },
} satisfies Record<string, ResourceCounts>;

export const PIECE_LIMITS = { road: 15, settlement: 5, city: 4 };

export function emptyResources(): ResourceCounts {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function totalResources(r: ResourceCounts): number {
  return RESOURCES.reduce((sum, k) => sum + r[k], 0);
}

export function hasResources(have: ResourceCounts, need: ResourceCounts): boolean {
  return RESOURCES.every((k) => have[k] >= need[k]);
}

export function formatResources(r: ResourceCounts): string {
  const parts = RESOURCES.filter((k) => r[k] > 0).map((k) => `${r[k]} ${RESOURCE_NAMES[k]}`);
  return parts.length ? parts.join(', ') : 'nichts';
}
