export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export const RESOURCES: readonly Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

/**
 * `sea`, `gold` und `fog` gibt es nur auf Seewege-Karten. Gold liefert einen Rohstoff nach Wahl,
 * `fog` ist ein noch verdecktes Feld (Land oder Meer, entschieden erst beim Aufdecken).
 * `lake` ist der See der Fischgründe: Land statt Wüste, liefert Fische bei 2, 3, 11 und 12.
 */
export type Terrain = Resource | 'desert' | 'sea' | 'gold' | 'fog' | 'lake';
export type ResourceCounts = Record<Resource, number>;
export type DevCard = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';
export type HarborType = Resource | 'any';

/** Klassisches Brett: base = bis 4 Spieler (19 Felder), ext = 5–6 Spieler (30 Felder). */
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
  /** Gewählte Karte (siehe maps.ts); fehlt bei alten Spielständen, dann klassisch. */
  map?: string;
  /** Felder in „doubled coordinates“, zeilenweise; daraus entsteht die Topologie. */
  cells?: [number, number][];
  /** Nur beim klassischen Brett, und bei alten Spielständen statt `cells`. */
  layout?: Layout;
  hexes: HexState[];
  harbors: HarborState[];
  /** Fischgründe (Variante): Küstenkanten mit Zahl. */
  fishing?: FishingGround[];
}

export interface FishingGround {
  edge: number;
  number: number;
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
  /** Goldfeld hat geliefert (Seewege): pending[seat] = Rohstoffe, die dieser Spieler noch wählt. */
  | { kind: 'gold'; pending: number[] }
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
  /** Karte, Vorgabe „klassisch“. */
  map?: string;
  /** Zugeschaltete kleine Varianten (siehe variants.ts). */
  variants?: string[];
}

export interface LogEntry {
  seat: number | null;
  text: string;
}

export interface GameState {
  /** Kennung dieser Partie. Stände verschiedener Partien werden nie über die Version verglichen. */
  id?: string;
  version: number;
  /**
   * Letzte angewendete Aktion je Client (Sitzung und Laufnummer). Wandert beim Host-Wechsel mit,
   * damit eine erneut gesendete Aktion nie doppelt angewendet wird.
   */
  acks?: Record<string, { s: string; n: number }>;
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
  /** Hafenvogt (Variante): Sitz mit der Sonderkarte, sonst null. */
  harborMaster?: number | null;
  /** Würfelstapel (Variante): verbleibende Karten je Summe. Keine Reihenfolge, gezogen wird erst beim Würfeln. */
  diceDeck?: Record<number, number>;
  /** Seewege: Schiffe je Kante (Besitzer), parallel zu `roads`. */
  ships?: (number | null)[];
  /** Seewege: Feld des Kaperschiffs (ein Meerfeld). */
  pirate?: number | null;
  /** Seewege: in diesem Zug gebaute Schiffe (dürfen nicht versetzt werden) und ob schon versetzt wurde. */
  shipsBuilt?: number[];
  shipMoved?: boolean;
  /** Seewege: Siegpunkte aus dem Inselbonus je Sitz. */
  islandBonus?: number[];
  /**
   * Seewege „Im Dunst“: was unter den verdeckten Feldern noch liegt, nur als Zählwerk. Welches Feld
   * was wird, entscheidet erst der Zufall beim Aufdecken, deshalb steht es vorher nirgends im Stand.
   */
  fog?: FogPool;
  /** Fischgründe: Fischplättchen (Werte 1–3) je Sitz, der verdeckte Stapel als Zählwerk, Inhaber des Rostigen Ankers. */
  fish?: number[][];
  fishPool?: Record<string, number>;
  anchor?: number | null;
}

/** Was das Ausgeben von Fischen bringt (Fischgründe). */
export type FishEffect = 'robber' | 'steal' | 'bank' | 'road' | 'devCard';

export const FISH_COSTS: Record<FishEffect, number> = { robber: 2, steal: 3, bank: 4, road: 5, devCard: 7 };

export interface FogPool {
  terrain: Partial<Record<Terrain, number>>;
  numbers: Record<number, number>;
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
  | { type: 'endTurn' }
  /** Seewege */
  | { type: 'buildShip'; edge: number }
  | { type: 'moveShip'; from: number; to: number }
  | { type: 'chooseGold'; resources: ResourceCounts }
  /** Fischgründe */
  | { type: 'spendFish'; effect: FishEffect; victim?: number | null; resource?: Resource | null }
  | { type: 'passAnchor'; to: number };

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
  ship: { wood: 1, brick: 0, sheep: 1, wheat: 0, ore: 0 },
} satisfies Record<string, ResourceCounts>;

export const PIECE_LIMITS = { road: 15, settlement: 5, city: 4, ship: 15 };

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
