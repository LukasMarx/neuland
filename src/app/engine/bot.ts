import { autoAction } from './auto';
import { getTopology, vertexHarbors } from './board';
import { mapById } from './maps';
import {
  actingSeats,
  attackableFortress,
  besiegingShips,
  camelOptions,
  canBuildWonder,
  canRaiseGuard,
  harborSpots,
  isFortress,
  isVillageEdge,
  plainShips,
  settlementBonus,
  villageConnected,
  canSpendFish,
  canSpendTokens,
  coinPoints,
  defenseOf,
  fishTotal,
  guardSpots,
  improveCost,
  intrigueTargets,
  isFreeForSettlement,
  isLand,
  isRiverEdge,
  legalBridgeEdges,
  legalCityVertices,
  legalGuardVertices,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  legalShipEdges,
  legalWallVertices,
  longestRoad,
  metropolisCandidates,
  metropolisGain,
  neutralSpots,
  openRoads,
  piecesLeft,
  raiderStrength,
  reformHexes,
  richerPlayers,
  robberActive,
  robberVictims,
  scoutTargets,
  tradeRate,
  traderHexes,
  turncoatTargets,
  victoryPoints,
  victoryTarget,
  vulnerableCities,
} from './rules';
import {
  Action,
  Card,
  CARDS,
  Commodity,
  COMMODITIES,
  COSTS,
  count,
  DevCard,
  emptyResources,
  GameState,
  hasResources,
  isCommodity,
  ProgressCard,
  Resource,
  RESOURCES,
  ResourceCounts,
  TRACK_GOODS,
  TradeOffer,
  TRACKS,
  totalResources,
} from './types';
import { BALES_PER_POINT, BRIDGE_COINS, GUARDS_PER_LEVEL, METROPOLIS_POINTS, RAIDER_TRACK, WONDER_LEVELS, WONDERS } from './variants';

/**
 * Ein Bot, der für einen getrennten Spieler weiterspielt oder aus der Lobby mitspielt. Er verfolgt einen
 * Plan (siehe botPlan): eine Strategie nach seinen Erträgen, ein Ziel mit allen Schritten dahin und den
 * Rohstoffbedarf, der daraus folgt. Danach richten sich Bauen, Bankhandel, Abwerfen und Entwicklungskarten.
 * Er kennt nur, was der Spieler an diesem Platz auch wüsste: die eigene Hand und das offene Brett, keine
 * fremden Karten. Für Phasen, die er nicht kennt (Erweiterungen), macht er den zurückhaltenden Zug aus
 * auto.ts. Liefert null, wenn der Sitz nicht dran ist.
 */
export function botAction(s: GameState, seat: number, options: BotOptions = {}): Action | null {
  if (!actingSeats(s).includes(seat)) return null;
  const profile = profileOf(options);
  const phase = s.phase;
  switch (phase.kind) {
    case 'setup':
      if (phase.step === 'settlement')
        return {
          type: 'placeSettlement',
          vertex: sloppyBest(s, seat, profile, legalSetupVertices(s), (v) => setupValue(s, seat, v)),
        };
      return {
        type: 'placeRoad',
        edge: best(legalSetupRoads(s), (e) => roadValue(s, seat, e, phase.settlement)),
      };
    case 'roll':
      return knightBeforeRoll(s, seat) ?? fortune(s, seat) ?? { type: 'roll' };
    case 'discard':
      return { type: 'discard', resources: keepUseful(s, seat, phase.pending[seat], profile) };
    case 'robber':
      return robberMove(s, seat);
    case 'gold':
      return { type: 'chooseGold', resources: goldPick(s, seat, phase.pending[seat], profile) };
    case 'neutral':
      return neutralMove(s, seat, phase.piece, profile) ?? autoAction(s, seat);
    case 'raid':
      return loseCity(s, seat) ?? autoAction(s, seat);
    case 'roadBuilding':
      return freeRoad(s, seat, profile) ?? autoAction(s, seat);
    case 'main':
      return mainMove(s, seat, profile, options.offersMade ?? null) ?? { type: 'endTurn' };
    case 'specialBuild':
      return mainMove(s, seat, profile, null, false) ?? { type: 'endTurn' };
    case 'camelVote':
      return { type: 'bidCamel', bid: camelBid(s, seat, profile) };
    case 'camelPlace':
      return camelPlace(s, seat) ?? autoAction(s, seat);
    default:
      return autoAction(s, seat);
  }
}

// ---------------------------------------------------------------------------
// Plan: Strategie, Ziel und Rohstoffbedarf

/** Wohin der Bot nach seinen Erträgen strebt: Städte (Erz, Getreide), Ausbreitung (Holz, Lehm) oder beides. */
export type Strategy = 'cities' | 'expansion' | 'balanced';

/** Stellschrauben des Bots. Die Werte sind mit der Messbank (arena/) eingestellt. */
export interface BotProfile {
  /** Wie viel ein Siegpunkt an zusätzlichem Ertrag wert ist, gemessen an dem, was der Ertrag bis Spielende einbringt. */
  production: number;
  /** Grundwert einer Entwicklungskarte in Siegpunkten. */
  devCard: number;
  /** Faktor je Straße auf dem Weg zu einem Bauplatz: Je weiter, desto eher nimmt ihn jemand weg. */
  distance: number;
  /** Ab dieser Handgröße baut oder tauscht der Bot lieber, als bei einer 7 abzuwerfen. */
  handLimit: number;
  /** Vorrang je Strategie für bestimmte Ziele. */
  strategy: Record<Strategy, Partial<Record<GoalKind, number>>>;
  /** Anteil der Züge (0 bis 1), in denen der Bot nicht das beste, sondern ein nächstbestes Ziel wählt. */
  noise: number;
  /** So viele eigene Tauschangebote macht er höchstens je Zug. */
  offers: number;
  /** Schickt er Gegenangebote, wenn ihm ein Angebot nicht passt? */
  counters: boolean;
  /** Um diesen Anteil muss ein Tausch seinen Plan verbessern; unter 0 nimmt er auch etwas schlechtere an. */
  margin: number;
  /** Mit niemandem handeln, dem nur noch so viele Siegpunkte zum Sieg fehlen. */
  leaderGuard: number;
}

export const DEFAULT_PROFILE: BotProfile = {
  production: 2,
  devCard: 0.45,
  distance: 0.9,
  handLimit: 7,
  strategy: {
    cities: { city: 1.15, devCard: 1.2 },
    expansion: { settlement: 1.15, longestRoad: 1.2 },
    balanced: {},
  },
  noise: 0,
  offers: 1,
  counters: true,
  margin: 0.03,
  leaderGuard: 2,
};

/** Schwierigkeitsstufen. Leicht verplant sich öfter, bietet nichts an und nimmt auch mäßige Tausche an. */
export type BotLevel = 'easy' | 'normal' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];
export const BOT_LEVEL_NAMES: Record<BotLevel, string> = {
  easy: 'Leicht',
  normal: 'Mittel',
  hard: 'Schwer',
};

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  easy: {
    ...DEFAULT_PROFILE,
    noise: 0.45,
    offers: 0,
    counters: false,
    margin: -0.05,
    leaderGuard: 1,
  },
  normal: DEFAULT_PROFILE,
  hard: { ...DEFAULT_PROFILE, offers: 2, margin: 0.06, leaderGuard: 3 },
};

export interface BotOptions {
  /** Vorgabe: mittel. */
  level?: BotLevel;
  /** Statt der Stufe ein eigenes Profil, etwa für die Messbank. */
  profile?: BotProfile;
  /**
   * Wie viele Tauschangebote der Bot in diesem Zug schon gemacht hat; das weiß nur, wer ihn spielen lässt.
   * Ohne Angabe bietet er nichts an (etwa wenn er nur kurz für einen getrennten Spieler einspringt).
   */
  offersMade?: number;
}

function profileOf(options: BotOptions): BotProfile {
  return options.profile ?? BOT_PROFILES[options.level ?? 'normal'];
}

/**
 * Eine Zufallszahl je Sitz und Zug, aus dem Stand abgeleitet: Innerhalb eines Zuges bleibt der Bot bei
 * seiner Wahl, und die Messbank bleibt wiederholbar.
 */
function noiseRoll(s: GameState, seat: number): number {
  const setup = s.phase.kind === 'setup' ? s.phase.index + 1 : 0;
  // Fingerabdruck des Bretts, damit nicht jede Partie in Zug 3 dieselbe Zahl würfelt.
  const board = s.board.hexes.reduce((n, h, i) => (n * 31 + (h.number ?? 0) * (i + 1)) >>> 0, 7);
  let h = (s.turn * 2654435761 + seat * 40503 + setup * 9973 + board) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** Das Beste, bei Rauschen manchmal das Zweit- oder Drittbeste. */
function sloppyBest<T>(s: GameState, seat: number, profile: BotProfile, options: T[], value: (x: T) => number): T {
  const roll = noiseRoll(s, seat);
  if (roll >= profile.noise || options.length < 2) return best(options, value);
  const ranked = options.map((o) => ({ o, v: value(o) })).sort((a, b) => b.v - a.v);
  return ranked[1 + Math.floor((roll / profile.noise) * Math.min(2, ranked.length - 1))].o;
}

export type GoalKind = 'city' | 'settlement' | 'devCard' | 'longestRoad' | 'explore' | 'improve' | 'defense' | 'wall' | 'gift' | 'village' | 'fortress' | 'wonder';

/** Ein mögliches Ziel mit allen Schritten dahin. */
export interface PlanGoal {
  kind: GoalKind;
  /** Was das Ziel insgesamt kostet, etwa zwei Straßen und die Siedlung am Ende. */
  cost: ResourceCounts;
  /** Der nächste Zug dahin und was er kostet. */
  step: Action;
  stepCost: ResourceCounts;
  /** Gewinn in Siegpunkten, Ertrag umgerechnet. */
  value: number;
  /** Erwartete Runden, bis es bezahlbar ist (mit Erträgen und Bankhandel). */
  eta: number;
  /** Gewinn je Runde: danach wählt der Bot. */
  score: number;
  /** Bei einer Siedlung: die Ecke, auf die sie kommt. */
  target?: number;
}

export interface BotPlan {
  strategy: Strategy;
  /** Erwartete Karten je Rohstoff in einer Runde (alle Würfe bis zum nächsten eigenen Zug). */
  income: Record<Resource, number>;
  /** Alle Ziele, das beste zuerst. */
  goals: PlanGoal[];
  goal: PlanGoal | null;
  /** Was der Hand für das Ziel fehlt, Güter (Stadtwacht) eingeschlossen. */
  need: ResourceCounts;
  /** Karten, die das Ziel nicht braucht: Tauschware. Güter stehen nur drin, wenn welche übrig sind. */
  spare: ResourceCounts;
}

/** Ungefähr so viele Karten kostet ein Siegpunkt, und so viele Runden vergehen zwischen zwei Siegpunkten. */
const CARDS_PER_POINT = 5.5;
const ROUNDS_PER_POINT = 2.5;
/** Weiter schaut der Bot nicht voraus (Runden), und so viele Straßen weit sucht er Bauplätze. */
const HORIZON = 12;
const MAX_ROADS = 3;
/** Übers Meer braucht es meist mehr Teile als über Land. */
const MAX_SHIPS = 5;

export function botPlan(s: GameState, seat: number, profile: BotProfile = DEFAULT_PROFILE, mayBuyDev = true): BotPlan {
  const inc = income(s, seat);
  const strategy = strategyOf(inc);
  const ctx: PlanContext = {
    s,
    seat,
    profile,
    inc,
    goods: goodsIncome(s, seat),
    gold: goldIncome(s, seat),
    weights: resourceWeights(s),
    rates: rates(s, seat),
  };
  const goals = [
    ...cityGoals(ctx),
    ...settlementGoals(ctx),
    ...longestRoadGoals(ctx),
    ...exploreGoals(ctx),
    ...improveGoals(ctx),
    ...defenseGoals(ctx),
    ...wallGoals(ctx),
    ...giftGoals(ctx),
    ...villageGoals(ctx),
    ...fortressGoals(ctx),
    ...wonderGoals(ctx),
    ...(mayBuyDev ? devGoals(ctx) : []),
  ];
  for (const g of goals) g.score = (g.value * (profile.strategy[strategy][g.kind] ?? 1)) / (g.eta + 1);
  goals.sort((a, b) => b.score - a.score);
  const goal = goals.length ? sloppyBest(s, seat, profile, goals, (g) => g.score) : null;
  const hand = s.players[seat].resources;
  const need = emptyResources();
  const spare = emptyResources();
  for (const k of CARDS) {
    const d = count(hand, k) - count(goal?.cost ?? emptyResources(), k);
    if (d < 0) need[k] = -d;
    else if (d > 0 || isResource(k)) spare[k] = d;
  }
  return { strategy, income: inc, goals, goal, need, spare };
}

interface PlanContext {
  s: GameState;
  seat: number;
  profile: BotProfile;
  inc: Record<Resource, number>;
  /** Stadtwacht: Güter je Runde aus Städten. */
  goods: Record<Commodity, number>;
  /** Seewege: Karten nach Wahl je Runde aus Goldflüssen. */
  gold: number;
  /** Wert einer Karte je Rohstoff: Seltenes auf dem Brett ist mehr wert. */
  weights: Record<Resource, number>;
  rates: Record<Card, number>;
}

const pips = (n: number | null) => (n ? 6 - Math.abs(7 - n) : 0);
const isResource = (t: string): t is Resource => (RESOURCES as readonly string[]).includes(t);
const zeroIncome = (): Record<Resource, number> => ({
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
});

/** Würfe je Runde: einer je Spieler, der am Zug ist. */
function rolls(s: GameState): number {
  return s.players.filter((p) => !p.neutral).length;
}

/** Erträge je Runde. Stadtwacht: Eine Stadt auf Wald, Weide oder Gebirge bringt dort 1 Rohstoff und 1 Gut. */
function income(s: GameState, seat: number): Record<Resource, number> {
  const out = zeroIncome();
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat) return;
    const add = hexIncome(s, v);
    for (const r of RESOURCES) out[r] += add[r] * (b.type === 'city' && !(s.improvements && GOODS_OF[r]) ? 2 : 1);
  });
  return out;
}

const GOODS_OF: Partial<Record<Resource, Commodity>> = { wood: 'paper', sheep: 'cloth', ore: 'coin' };

function goodsIncome(s: GameState, seat: number): Record<Commodity, number> {
  const out: Record<Commodity, number> = { paper: 0, cloth: 0, coin: 0 };
  if (!s.improvements) return out;
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat || b.type !== 'city') return;
    const add = hexIncome(s, v);
    for (const r of RESOURCES) if (GOODS_OF[r]) out[GOODS_OF[r]!] += add[r];
  });
  return out;
}

/** Ertrag einer Ecke je Runde für eine Siedlung. Unter dem Räuber zählt ein Feld wenig, er zieht aber weiter. */
function hexIncome(s: GameState, vertex: number): Record<Resource, number> {
  const out = zeroIncome();
  for (const h of getTopology(s.board).vertices[vertex].hexes) {
    const hex = s.board.hexes[h];
    if (!isResource(hex.terrain)) continue;
    out[hex.terrain] += (pips(hex.number) / 36) * rolls(s) * (h === s.robber ? 0.3 : 1);
  }
  return out;
}

/** Seewege: Gold einer Ecke je Runde; jede Karte ist ein Rohstoff nach Wahl. */
function hexGold(s: GameState, vertex: number): number {
  return getTopology(s.board)
    .vertices[vertex].hexes.filter((h) => s.board.hexes[h].terrain === 'gold')
    .reduce((n, h) => n + (pips(s.board.hexes[h].number) / 36) * rolls(s) * (h === s.robber ? 0.3 : 1), 0);
}

function goldIncome(s: GameState, seat: number): number {
  return s.buildings.reduce((n, b, v) => (b?.owner === seat ? n + hexGold(s, v) * (b.type === 'city' ? 2 : 1) : n), 0);
}

function strategyOf(inc: Record<Resource, number>): Strategy {
  const cities = inc.ore + inc.wheat;
  const expansion = inc.wood + inc.brick;
  if (cities > expansion * 1.3) return 'cities';
  if (expansion > cities * 1.3) return 'expansion';
  return 'balanced';
}

function resourceWeights(s: GameState): Record<Resource, number> {
  const onBoard = zeroIncome();
  for (const hex of s.board.hexes) if (isResource(hex.terrain)) onBoard[hex.terrain] += pips(hex.number);
  const avg = RESOURCES.reduce((n, r) => n + onBoard[r], 0) / RESOURCES.length;
  const out = zeroIncome();
  for (const r of RESOURCES) out[r] = Math.min(1.4, Math.max(0.75, avg / Math.max(1, onBoard[r])));
  return out;
}

function rates(s: GameState, seat: number): Record<Card, number> {
  const out = { ...zeroIncome(), paper: 4, cloth: 4, coin: 4 };
  for (const k of CARDS) out[k] = tradeRate(s, seat, k);
  return out;
}

/** Runden, bis `cost` mit Hand, Erträgen und Bankhandel bezahlbar ist; in Vierteln gerechnet. */
function eta(ctx: PlanContext, cost: ResourceCounts): number {
  const hand = ctx.s.players[ctx.seat].resources;
  for (let t = 0; t <= HORIZON; t += 0.25) {
    let missing = 0;
    let lots = 0;
    for (const k of CARDS) {
      const d = count(hand, k) + (isResource(k) ? ctx.inc[k] : ctx.goods[k]) * t - count(cost, k);
      if (d < 0) missing -= d;
      else lots += t === 0 ? Math.floor(d / ctx.rates[k]) : d / ctx.rates[k];
    }
    if (missing <= lots + ctx.gold * t + 1e-9) return t;
  }
  return HORIZON * 2;
}

/** Was zusätzlicher Ertrag (Karten je Runde, gewichtet) bis Spielende in Siegpunkten bringt. */
function productionValue(ctx: PlanContext, gain: number, after: number): number {
  const left = (victoryTarget(ctx.s, ctx.seat) - victoryPoints(ctx.s, ctx.seat, true)) * ROUNDS_PER_POINT;
  return (gain * Math.max(0, left - after) * ctx.profile.production) / CARDS_PER_POINT;
}

function weighted(ctx: PlanContext, inc: Record<Resource, number>): number {
  return RESOURCES.reduce((n, r) => n + inc[r] * ctx.weights[r], 0);
}

/** Ertrag einer neuen Siedlung, mit Zuschlag für Rohstoffe, die noch fehlen, und für passende Häfen. Gold zählt mehr. */
function spotGain(ctx: PlanContext, vertex: number): number {
  const add = hexIncome(ctx.s, vertex);
  let gain = weighted(ctx, add) + hexGold(ctx.s, vertex) * 1.3;
  for (const r of RESOURCES) if (add[r] > 0 && ctx.inc[r] < 0.3) gain += 0.25;
  const harbor = vertexHarbors(ctx.s.board)[vertex];
  if (harbor === 'any') gain += 0.1;
  else if (harbor && ctx.inc[harbor] + add[harbor] >= 0.8) gain += 0.2;
  return gain;
}

function cityGoals(ctx: PlanContext): PlanGoal[] {
  if (piecesLeft(ctx.s, ctx.seat, 'city') <= 0) return [];
  const t = eta(ctx, COSTS.city);
  return legalCityVertices(ctx.s, ctx.seat).map((vertex) => ({
    kind: 'city',
    cost: COSTS.city,
    step: { type: 'buildCity', vertex },
    stepCost: COSTS.city,
    value: 1 + productionValue(ctx, weighted(ctx, hexIncome(ctx.s, vertex)) + hexGold(ctx.s, vertex) * 1.3, t),
    eta: t,
    score: 0,
  }));
}

/**
 * Freie Bauplätze, die der Bot über Land (Straßen, Brücken) oder übers Meer (Schiffe) erreicht, jeweils
 * über den kürzesten Weg. Eine neue Insel bringt ihren Bonus, eine Brücke Münzen.
 */
function settlementGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (piecesLeft(s, seat, 'settlement') <= 0) return [];
  const out: PlanGoal[] = [];
  const add = (vertex: number, path: Step[]) => {
    const cost = { ...COSTS.settlement };
    for (const step of path) for (const r of RESOURCES) cost[r] += COSTS[step.piece][r];
    const t = eta(ctx, cost);
    // Insel- oder Gebietsbonus (Seewege, Sandmeer) und Kamelzüge: ein Punkt für ein Gebäude an einer Karawane.
    const island = settlementBonus(s, seat, vertex) + (onCaravan(s, vertex) ? 1 : 0);
    const coins = path.filter((p) => p.piece === 'bridge').length * BRIDGE_COINS * COIN_VALUE;
    out.push({
      kind: 'settlement',
      cost,
      step: path.length ? pieceAction(path[0]) : { type: 'buildSettlement', vertex },
      stepCost: path.length ? COSTS[path[0].piece] : COSTS.settlement,
      value: (1 + island + coins + productionValue(ctx, spotGain(ctx, vertex), t)) * ctx.profile.distance ** path.length,
      eta: t,
      score: 0,
      target: vertex,
    });
  };
  const direct = legalSettlementVertices(s, seat);
  for (const v of direct) add(v, []);
  for (const [v, path] of routes(s, seat).spots) if (path.length && !direct.includes(v) && isFreeForSettlement(s, v)) add(v, path);
  return out;
}

type Piece = 'road' | 'ship' | 'bridge' | 'settlement';
/**
 * Ein Teil auf dem Weg zu einem Bauplatz. `edge` ist die Kante, bei einer Siedlung unterwegs (nur auf dem
 * Weg in den Nebel, um von Straße auf Schiff zu wechseln) die Ecke.
 */
interface Step {
  edge: number;
  piece: Piece;
}

/** Ungefährer Wert einer Münze in Siegpunkten (Flussläufe: die meisten +1, die wenigsten −2). */
const COIN_VALUE = 0.15;

function pieceAction(step: Step): Action {
  if (step.piece === 'settlement') return { type: 'buildSettlement', vertex: step.edge };
  return step.piece === 'ship'
    ? { type: 'buildShip', edge: step.edge }
    : step.piece === 'bridge'
      ? { type: 'buildBridge', edge: step.edge }
      : { type: 'buildRoad', edge: step.edge };
}

/**
 * Kürzeste Wege vom eigenen Netz zu jeder Ecke. Über Land mit Straßen (über Flüsse mit Brücken), übers
 * Meer mit Schiffen; gewechselt wird nur an einem eigenen Gebäude, wie in den Regeln. Fremde Gebäude und
 * Wächter sperren den Weg, das Kaperschiff sperrt seine Kanten für Schiffe. Der erste Schritt muss jetzt
 * schon legal sein, und es reichen die Teile im Vorrat. Nebenbei: der kürzeste Weg, dessen letztes Teil
 * an ein Nebelfeld stößt (Seewege, Im Dunst).
 */
function routes(s: GameState, seat: number): { spots: Map<number, Step[]>; fog: Step[] | null } {
  const topo = getTopology(s.board);
  const supply: Record<Piece, number> = {
    road: piecesLeft(s, seat, 'road'),
    ship: s.ships ? piecesLeft(s, seat, 'ship') : 0,
    bridge: s.coins ? piecesLeft(s, seat, 'bridge') : 0,
    settlement: piecesLeft(s, seat, 'settlement'),
  };
  const depth = supply.ship > 0 ? MAX_SHIPS : MAX_ROADS;
  const legal: Record<Piece, Set<number>> = {
    road: new Set(legalRoadEdges(s, seat)),
    ship: new Set(legalShipEdges(s, seat)),
    bridge: new Set(s.coins ? legalBridgeEdges(s, seat) : []),
    settlement: new Set(legalSettlementVertices(s, seat)),
  };
  const legalFirst = (path: Step[]) => !path.length || legal[path[0].piece].has(path[0].edge);
  type Mode = 'land' | 'sea' | 'both';
  const out = new Map<number, Step[]>();
  let fog: Step[] | null = null;
  const seen = new Set<string>();
  // `settled`: Der Weg enthält eine Siedlung unterwegs; er taugt nur für den Nebel, nicht als Weg zu einem Bauplatz.
  let frontier: { v: number; mode: Mode; path: Step[]; settled: boolean }[] = [];
  const coastal = (v: number) => topo.vertices[v].hexes.some((h) => s.board.hexes[h].terrain === 'sea');
  const reach = (v: number, mode: Mode, path: Step[], into: typeof frontier, settled = false) => {
    if (seen.has(`${v}${mode}${settled}`)) return;
    seen.add(`${v}${mode}${settled}`);
    into.push({ v, mode, path, settled });
    if (!settled && !out.has(v)) out.set(v, path);
    // Im Nebel: an einer freien Küstenecke eine Siedlung einplanen, um dort aufs Schiff zu wechseln.
    if (s.fog && mode === 'land' && !settled && supply.settlement > 0 && supply.ship > 0 && coastal(v) && isFreeForSettlement(s, v)) {
      reach(v, 'both', [...path, { edge: v, piece: 'settlement' }], into, true);
    }
  };
  for (const vx of topo.vertices) {
    const b = s.buildings[vx.id];
    if (b?.owner === seat) reach(vx.id, 'both', [], frontier);
    else if (!b) {
      if (vx.edges.some((e) => s.roads[e] === seat)) reach(vx.id, 'land', [], frontier);
      if (vx.edges.some((e) => s.ships?.[e] === seat)) reach(vx.id, 'sea', [], frontier);
    }
  }
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: typeof frontier = [];
    for (const { v, mode, path, settled } of frontier) {
      const b = s.buildings[v];
      const guard = s.guards?.[v];
      if ((b && b.owner !== seat) || (guard && guard.owner !== seat) || isFortress(s, v)) continue;
      for (const e of topo.vertices[v].edges) {
        if (s.roads[e] !== null || s.ships?.[e] != null || isVillageEdge(s, e)) continue;
        const edge = topo.edges[e];
        const w = edge.a === v ? edge.b : edge.a;
        const terrains = edge.hexes.map((h) => s.board.hexes[h].terrain);
        const pieces: Piece[] = [];
        if (mode !== 'sea' && terrains.some((t) => isLand(t))) pieces.push(isRiverEdge(s, e) ? 'bridge' : 'road');
        if (mode !== 'land' && terrains.includes('sea') && !(s.pirate != null && edge.hexes.includes(s.pirate))) pieces.push('ship');
        for (const piece of pieces) {
          const steps = [...path, { edge: e, piece }];
          if (steps.filter((x) => x.piece === piece).length > supply[piece]) continue;
          if (!fog && terrains.includes('fog') && legalFirst(steps)) fog = steps;
          reach(w, piece === 'ship' ? 'sea' : 'land', steps, next, settled);
        }
      }
    }
    frontier = next;
  }
  for (const [v, path] of out) if (!legalFirst(path)) out.delete(v);
  return { spots: out, fog };
}

/** Längste Straße: lohnt sich, wenn sie mit ein, zwei Straßen zu holen ist. */
function longestRoadGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (s.longestRoad === seat || piecesLeft(s, seat, 'road') <= 0) return [];
  const holder = s.longestRoad;
  const target = Math.max(5, holder === null ? 0 : s.roadLengths[holder] + 1);
  const mine = s.roadLengths[seat] ?? longestRoad(s, seat);
  const missingRoads = target - mine;
  if (missingRoads < 1 || missingRoads > 2 || missingRoads > piecesLeft(s, seat, 'road')) return [];
  let edge: number | null = null;
  for (const e of legalRoadEdges(s, seat)) {
    const roads = [...s.roads];
    roads[e] = seat;
    if (longestRoad({ ...s, roads }, seat) > mine) {
      edge = e;
      break;
    }
  }
  if (edge === null) return [];
  const cost = { ...COSTS.road, wood: missingRoads, brick: missingRoads };
  const t = eta(ctx, cost);
  return [
    {
      kind: 'longestRoad',
      cost,
      step: { type: 'buildRoad', edge },
      stepCost: COSTS.road,
      value: holder === null ? 2 : 2.5,
      eta: t,
      score: 0,
    },
  ];
}

/**
 * Seewege, Nebel: Eine Straße oder ein Schiff an einem Nebelfeld deckt es auf. Das bringt meist eine Karte
 * und neues Land, auf dem sich später bauen lässt.
 */
function exploreGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.fog) return [];
  const path = routes(s, seat).fog;
  if (!path) return [];
  const cost = emptyResources();
  for (const step of path) for (const r of RESOURCES) cost[r] += COSTS[step.piece][r];
  const t = eta(ctx, cost);
  // Was eine Siedlung auf dem neuen Land wert wäre: Punkt, Inselbonus und Ertrag zweier mittlerer Felder.
  const bonus = mapById(s.board.map).seafaring?.islandBonus ?? 0;
  const spot = 1 + bonus + productionValue(ctx, (2 * 3.5 * rolls(s)) / 36, t + 2);
  // Eine Küstensiedlung unterwegs ist für sich schon etwas wert.
  const stop = path.find((p) => p.piece === 'settlement');
  const settlement = stop ? 1 + productionValue(ctx, spotGain(ctx, stop.edge), t) : 0;
  const value = settlement + EXPLORE_WEIGHT * FOG_LAND * (0.2 + 0.5 * spot) * ctx.profile.distance ** (path.length - 1);
  return [{ kind: 'explore', cost, step: pieceAction(path[0]), stepCost: COSTS[path[0].piece], value, eta: t, score: 0 }];
}

/**
 * Anteil Land unter dem Nebel (Im Dunst: 45 % Meer). Ein Landfeld bringt sofort eine Karte (0,2) und mit
 * etwa halber Chance einen neuen Bauplatz, oft auf einer neuen Insel.
 */
const FOG_LAND = 0.55;
/** Mit der Messbank eingestellt (Im Dunst gegen den Bot ohne Erkunden): 1 → 1,10, 2 → 1,23, 4 → 1,00. */
const EXPLORE_WEIGHT = 2;

// Stadtwacht

/** Grundwert einer Ausbaustufe (Einflusskarten an den Toren, Vorteile ab Stufe 3) in Siegpunkten. */
const IMPROVE_VALUE = 0.4;
/** Was eine verlorene Stadt kostet: ein Siegpunkt und Ertrag. */
const CITY_LOSS = 1.5;

/** Stadtausbau in jede Richtung; eine Prachtstadt bringt ihre Punkte. */
function improveGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.improvements || !s.metropolis || !s.buildings.some((b) => b?.owner === seat && b.type === 'city')) return [];
  const out: PlanGoal[] = [];
  for (const track of TRACKS) {
    const next = s.improvements[seat][track] + 1;
    if (next > 5) continue;
    const cost = emptyResources();
    cost[TRACK_GOODS[track]] = improveCost(s, seat, next);
    const gains = metropolisGain(s, seat, track, next);
    const candidates = gains ? metropolisCandidates(s, seat) : [];
    if (gains && !candidates.length) continue;
    // Auf dem Weg zur Prachtstadt, solange sie noch niemand hat.
    const toward = s.metropolis[track] === null && next === 3 ? 0.5 : 0;
    const vertex = gains ? best(candidates, (v) => weighted(ctx, hexIncome(s, v))) : undefined;
    out.push({
      kind: 'improve',
      cost,
      step: { type: 'improveCity', track, ...(vertex === undefined ? {} : { vertex }) },
      stepCost: cost,
      value: IMPROVE_VALUE + toward + (gains ? METROPOLIS_POINTS : 0),
      eta: eta(ctx, cost),
      score: 0,
    });
  }
  return out;
}

/**
 * Wächter gegen die Plündererflotte. Lohnt sich, wenn der Bot beim nächsten Angriff sonst eine Stadt
 * verlöre (er hätte am wenigsten verteidigt) oder mit mehr Verteidigung den Ehrenschild bekäme. Je weiter
 * der Angriff weg ist, desto mehr Zeit bleibt; was bis dahin nicht bezahlbar ist, nützt wenig.
 */
function defenseGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.raiders || !s.guards) return [];
  const humans = s.players.flatMap((p, i) => (p.neutral ? [] : [i]));
  const contrib = s.players.map((_, i) => defenseOf(s, i));
  const total = humans.reduce((n, i) => n + contrib[i], 0);
  const strength = raiderStrength(s);
  const others = humans.filter((i) => i !== seat);
  const exposed = others.filter((i) => vulnerableCities(s, i).length > 0);
  const mine = vulnerableCities(s, seat).length > 0;
  const outlook = (me: number, all: number) => {
    const loses = mine && strength > all && (!exposed.length || me <= Math.min(...exposed.map((i) => contrib[i])));
    const honor = strength <= all && me > 0 && others.every((i) => contrib[i] < me);
    return (loses ? -CITY_LOSS : 0) + (honor ? 1 : 0);
  };
  // Ein Schiff auf dem Ereigniswürfel in der Hälfte der Würfe.
  const rounds = (RAIDER_TRACK - s.raiders.position) / (0.5 * rolls(s));
  const value = (gain: number, t: number) => Math.max(0, outlook(contrib[seat] + gain, total + gain) - outlook(contrib[seat], total)) * (t <= rounds ? 1 : 0.2);
  const out: PlanGoal[] = [];
  const add = (step: Action, stepCost: ResourceCounts, cost: ResourceCounts, gain: number, later: number) => {
    const t = eta(ctx, cost);
    out.push({ kind: 'defense', cost, step, stepCost, value: value(gain, t) + later, eta: t, score: 0 });
  };
  const guards = s.guards.flatMap((g, v) => (g?.owner === seat ? [{ g, v }] : []));
  for (const { g, v } of guards) {
    if (!g.active) add({ type: 'activateGuard', vertex: v }, COSTS.activate, COSTS.activate, g.level, 0);
    else if (canRaiseGuard(s, seat, v)) add({ type: 'upgradeGuard', vertex: v }, COSTS.guard, COSTS.guard, 1, 0.15);
  }
  const spots = legalGuardVertices(s, seat);
  if (spots.length) {
    // Am liebsten neben eine eigene Stadt, sonst irgendwo am eigenen Netz.
    const topo = getTopology(s.board);
    const vertex = best(spots, (v) => topo.vertices[v].neighbors.filter((w) => s.buildings[w]?.owner === seat).length);
    const cost = { ...COSTS.guard, wheat: COSTS.guard.wheat + COSTS.activate.wheat };
    add({ type: 'buildGuard', vertex }, COSTS.guard, cost, 1, 0.15);
  }
  return out;
}

/** Palisaden: mehr Karten auf der Hand bei einer 7; lohnt sich vor allem mit voller Hand. */
function wallGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  const walls = legalWallVertices(s, seat);
  if (!walls.length) return [];
  const full = totalResources(s.players[seat].resources) >= 7 ? 0.3 : 0;
  return [{ kind: 'wall', cost: COSTS.wall, step: { type: 'buildWall', vertex: walls[0] }, stepCost: COSTS.wall, value: 0.2 + full, eta: eta(ctx, COSTS.wall), score: 0 }];
}

// Seewege-Szenarien

/** Kosten aller Teile eines Wegs. */
function pathCost(path: Step[]): ResourceCounts {
  const cost = emptyResources();
  for (const step of path) for (const r of RESOURCES) cost[r] += COSTS[step.piece][r];
  return cost;
}

/**
 * Kürzeste Schiffslinie, ohne Längengrenze, bis eine Kante `goal` erfüllt: von eigenen Gebäuden und den Enden
 * eigener Schiffslinien über freie Meerkanten, nicht durch fremde Gebäude, Wächter oder Festungen und nicht am
 * Kaperschiff entlang. Der erste Schritt muss jetzt schon legal sein, und es reichen die Schiffe im Vorrat.
 */
function shipPath(s: GameState, seat: number, goal: (edge: number, to: number) => boolean): Step[] | null {
  if (!s.ships) return null;
  const topo = getTopology(s.board);
  const legal = new Set(legalShipEdges(s, seat));
  const supply = piecesLeft(s, seat, 'ship');
  const blocked = (v: number) => (s.buildings[v] && s.buildings[v]!.owner !== seat) || (s.guards?.[v] && s.guards[v]!.owner !== seat) || isFortress(s, v);
  const free = (e: number) =>
    s.ships![e] === null &&
    s.roads[e] === null &&
    !isVillageEdge(s, e) &&
    topo.edges[e].hexes.some((h) => s.board.hexes[h].terrain === 'sea') &&
    !(s.pirate != null && topo.edges[e].hexes.includes(s.pirate));
  const seen = new Set<number>();
  let frontier: { v: number; path: Step[] }[] = [];
  for (const v of topo.vertices) {
    const own = s.buildings[v.id]?.owner === seat || (!blocked(v.id) && !s.buildings[v.id] && v.edges.some((e) => s.ships![e] === seat));
    if (own) {
      seen.add(v.id);
      frontier.push({ v: v.id, path: [] });
    }
  }
  for (let depth = 0; depth < supply && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const { v, path } of frontier) {
      for (const e of topo.vertices[v].edges) {
        if (!free(e) || (!path.length && !legal.has(e))) continue;
        const w = topo.edges[e].a === v ? topo.edges[e].b : topo.edges[e].a;
        const steps: Step[] = [...path, { edge: e, piece: 'ship' }];
        if (goal(e, w)) return steps;
        if (seen.has(w) || blocked(w)) continue;
        seen.add(w);
        next.push({ v: w, path: steps });
      }
    }
    frontier = next;
  }
  return null;
}

/** Wert eines Punkt-Geschenks, der Anbindung an ein Dorf je Punkt und des Sogs einer Bauwerksstufe zum Sieg. */
const GIFT_WORTH = 1.2;
const VILLAGE_WEIGHT = 1.2;
const WONDER_PULL = 3;

/** Die Verschollenen: Geschenke an fremden Küsten, ein Schiff auf ihrer Kante holt sie ab. */
function giftGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.gifts?.length || piecesLeft(s, seat, 'ship') <= 0) return [];
  const out: PlanGoal[] = [];
  for (const gift of s.gifts) {
    const path = shipPath(s, seat, (e) => e === gift.edge);
    if (!path) continue;
    const cost = pathCost(path);
    const worth = gift.kind === 'point' ? GIFT_WORTH : gift.kind === 'dev' ? ctx.profile.devCard + 0.2 : 0.6;
    out.push({ kind: 'gift', cost, step: pieceAction(path[0]), stepCost: COSTS[path[0].piece], value: worth * ctx.profile.distance ** (path.length - 1), eta: eta(ctx, cost), score: 0 });
  }
  return out;
}

/** Stoffhandel: An ein Dorf anbinden; jeder zweite Ballen ist ein Punkt, so lange sein Vorrat reicht. */
function villageGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.villages) return [];
  const topo = getTopology(s.board);
  const left = (victoryTarget(s, seat) - victoryPoints(s, seat, true)) * ROUNDS_PER_POINT;
  const out: PlanGoal[] = [];
  s.villages.forEach((village, i) => {
    if (village.stock <= 0 || villageConnected(s, seat, i)) return;
    const { a, b } = topo.edges[village.edge];
    const path = shipPath(s, seat, (e) => e !== village.edge && [topo.edges[e].a, topo.edges[e].b].some((v) => v === a || v === b));
    if (!path) return;
    const cost = pathCost(path);
    const t = eta(ctx, cost);
    const bales = Math.min(village.stock, (pips(village.number) / 36) * rolls(s) * Math.max(0, left - t));
    // Die Anbindung zählt auch für die längste Route.
    const value = (0.3 + (VILLAGE_WEIGHT * bales) / BALES_PER_POINT) * ctx.profile.distance ** (path.length - 1);
    out.push({ kind: 'village', cost, step: pieceAction(path[0]), stepCost: COSTS[path[0].piece], value, eta: t, score: 0 });
  });
  return out;
}

/** Freibeuterbuchten: eine Schiffslinie bis an die eigene Festung; ohne sie gibt es keinen Sieg. */
function fortressGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  const fort = s.fortresses?.find((f) => f.owner === seat && f.walls > 0);
  if (!fort || besiegingShips(s, seat, fort.vertex).length) return [];
  const path = shipPath(s, seat, (_, to) => to === fort.vertex);
  if (!path) return [];
  const cost = pathCost(path);
  // Je näher der Sieg, desto dringender: Ohne Festung zählen die übrigen Punkte nicht.
  const missing = victoryTarget(s, seat) - victoryPoints(s, seat, true);
  const value = missing <= 0 ? 50 : missing <= 3 ? 8 : 2.5;
  return [{ kind: 'fortress', cost, step: pieceAction(path[0]), stepCost: COSTS[path[0].piece], value, eta: eta(ctx, cost), score: 0 }];
}

/** Großbauten: das eigene Bauwerk weiterbauen oder eines beginnen; die letzte Stufe gewinnt. */
function wonderGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (!s.wonders) return [];
  const mine = s.wonders.findIndex((w) => w.owner === seat);
  const options = mine >= 0 ? [mine] : s.wonders.flatMap((w, i) => (w.owner === null ? [i] : []));
  return options.flatMap((i) => {
    const w = s.wonders![i];
    if (w.level >= WONDER_LEVELS) return [];
    // Beginnen nur, wenn die Voraussetzung erfüllt ist (die Kosten zeigt eta).
    const trial = { ...s, players: s.players.map((p, k) => (k === seat ? { ...p, resources: { ...p.resources, ...WONDERS[i].cost } } : p)) };
    if (w.owner === null && !canBuildWonder(trial as GameState, seat, i)) return [];
    const cost = WONDERS[i].cost;
    // Jede Stufe ist ein Punkt und ein Schritt zum Sieg; die letzte ist der Sieg.
    const value = w.level === WONDER_LEVELS - 1 ? 50 : 1 + ((w.level + 1) / WONDER_LEVELS) * WONDER_PULL;
    return [{ kind: 'wonder' as const, cost, step: { type: 'buildWonder', wonder: i } as Action, stepCost: cost, value, eta: eta(ctx, cost), score: 0 }];
  });
}

/** Die Verschollenen: einen geschenkten Hafen an die eigene Küste, am liebsten an eine Stadt. */
function harborMove(s: GameState, seat: number): Action | null {
  const edges = harborSpots(s, seat);
  if (!edges.length) return null;
  const topo = getTopology(s.board);
  const weight = (e: number) => [topo.edges[e].a, topo.edges[e].b].reduce((n, v) => n + (s.buildings[v]?.owner === seat ? (s.buildings[v]!.type === 'city' ? 2 : 1) : 0), 0);
  return { type: 'placeHarbor', edge: best(edges, weight) };
}

/** Kamelzüge: Liegt die Ecke an einer Karawane? */
function onCaravan(s: GameState, vertex: number): boolean {
  if (!s.caravans) return false;
  const topo = getTopology(s.board);
  return s.caravans.flat().some((e) => topo.edges[e].a === vertex || topo.edges[e].b === vertex);
}

/** Kamelzüge: Was ein Kamel auf dieser Kante dem Sitz bringt: Punkte für eigene Gebäude, doppelte Straße, Bauplätze. */
function camelValue(s: GameState, seat: number, edge: number): number {
  const topo = getTopology(s.board);
  const e = topo.edges[edge];
  let value = 0;
  for (const v of [e.a, e.b]) {
    const b = s.buildings[v];
    if (b) value += b.owner === seat ? (onCaravan(s, v) ? 0 : 1) : onCaravan(s, v) ? 0 : -0.7;
    else if (freeForSettlement(s, v) && topo.vertices[v].edges.some((x) => s.roads[x] === seat)) value += 0.3;
  }
  if (s.roads[edge] === seat) value += 0.5;
  return value;
}

/** Kamelzüge: das Kamel dorthin, wo es dem Bot am meisten bringt. */
function camelPlace(s: GameState, seat: number): Action | null {
  const options = camelOptions(s);
  return options.length ? { type: 'placeCamel', edge: best(options, (e) => camelValue(s, seat, e)) } : null;
}

/**
 * Kamelzüge: Lohnt das Kamel (ein Punkt oder mehr), bietet der Bot bis zu zwei Karten Getreide und Wolle,
 * die sein Ziel nicht braucht; sonst nichts.
 */
function camelBid(s: GameState, seat: number, profile: BotProfile): ResourceCounts {
  const bid = emptyResources();
  const worth = Math.max(0, ...camelOptions(s).map((e) => camelValue(s, seat, e)));
  if (worth < 1) return bid;
  const plan = botPlan(s, seat, profile);
  for (const r of ['sheep', 'wheat'] as const) {
    while (totalResources(bid) < 2 && bid[r] < plan.spare[r]) bid[r]++;
  }
  return bid;
}

/** Stadtwacht, Angriff verloren: die Stadt mit dem wenigsten Ertrag abgeben. */
function loseCity(s: GameState, seat: number): Action | null {
  const cities = vulnerableCities(s, seat);
  if (!cities.length) return null;
  const weights = resourceWeights(s);
  return { type: 'loseCity', vertex: best(cities, (v) => -RESOURCES.reduce((n, r) => n + hexIncome(s, v)[r] * weights[r], 0)) };
}

function devGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (deckSize(s) <= 0) return [];
  // Rittermacht in Reichweite: Jeder Ritter zählt mehr.
  const p = s.players[seat];
  const knights = p.knights + p.devCards.filter((c) => c === 'knight').length;
  const holder = s.largestArmy;
  const army = holder !== seat && knights + 1 >= Math.max(3, holder === null ? 0 : s.players[holder].knights + 1) ? 0.3 : 0;
  return [
    {
      kind: 'devCard',
      cost: COSTS.devCard,
      step: { type: 'buyDevCard' },
      stepCost: COSTS.devCard,
      value: ctx.profile.devCard + army,
      eta: eta(ctx, COSTS.devCard),
      score: 0,
    },
  ];
}

/** In der eigenen Sicht fehlt der Inhalt des Stapels, die Größe steht in `hiddenDeck`. */
function deckSize(s: GameState): number {
  return s.hiddenDeck ?? s.devDeck.length;
}

// ---------------------------------------------------------------------------
// Bewertung beim Aufbau

/** Wert einer Ecke: Wahrscheinlichkeitspunkte der Felder, etwas mehr für verschiedene Rohstoffe und Häfen. */
function spotValue(s: GameState, vertex: number): number {
  const topo = getTopology(s.board);
  const kinds = new Set<string>();
  let value = 0;
  for (const h of topo.vertices[vertex].hexes) {
    const hex = s.board.hexes[h];
    if (!isResource(hex.terrain) || h === s.robber) continue;
    value += pips(hex.number);
    kinds.add(hex.terrain);
  }
  const harbor = vertexHarbors(s.board)[vertex];
  return value + kinds.size * 1.5 + (harbor ? 1 : 0);
}

/** Aufstellung: seltene Rohstoffe zählen mehr, und die zweite Siedlung ergänzt, was der ersten fehlt. */
function setupValue(s: GameState, seat: number, vertex: number): number {
  const weights = resourceWeights(s);
  const inc = income(s, seat);
  let value = 0;
  const fresh = new Set<Resource>();
  for (const h of getTopology(s.board).vertices[vertex].hexes) {
    const hex = s.board.hexes[h];
    if (hex.terrain === 'gold') value += pips(hex.number) * 1.3;
    if (!isResource(hex.terrain) || h === s.robber) continue;
    value += pips(hex.number) * weights[hex.terrain];
    if (inc[hex.terrain] === 0) fresh.add(hex.terrain);
  }
  const harbor = vertexHarbors(s.board)[vertex];
  return value + fresh.size * 1.5 + (harbor ? 1 : 0);
}

/** Wert einer Straße: wie gut die Bauplätze sind, zu denen sie führt (bis zwei Kanten weiter). */
function roadValue(s: GameState, seat: number, edge: number, from: number | null): number {
  const topo = getTopology(s.board);
  const e = topo.edges[edge];
  const far = from === e.a ? e.b : from === e.b ? e.a : null;
  const ends = far === null ? [e.a, e.b] : [far];
  let bestSpot = 0;
  for (const v of ends) {
    for (const w of [v, ...topo.vertices[v].neighbors]) {
      if (freeForSettlement(s, w)) bestSpot = Math.max(bestSpot, spotValue(s, w) - (w === v ? 0 : 1));
    }
  }
  // Etwas Vorrang für Straßen, die die eigene längste Straße verlängern könnten.
  const touchesOwn = [e.a, e.b].some((v) => topo.vertices[v].edges.some((o) => o !== edge && s.roads[o] === seat));
  return bestSpot + (touchesOwn ? 0.5 : 0);
}

function freeForSettlement(s: GameState, vertex: number): boolean {
  const topo = getTopology(s.board);
  return isFreeForSettlement(s, vertex) && topo.vertices[vertex].hexes.some((h) => isResource(s.board.hexes[h].terrain));
}

function best<T>(options: T[], value: (x: T) => number): T {
  let top = options[0];
  let topValue = -Infinity;
  for (const o of options) {
    const v = value(o);
    if (v > topValue) {
      top = o;
      topValue = v;
    }
  }
  return top;
}

// ---------------------------------------------------------------------------
// Züge

/** Vor dem Würfeln: Ritter gegen den Räuber auf einem eigenen Ertragsfeld oder für die Rittermacht. */
function knightBeforeRoll(s: GameState, seat: number): Action | null {
  if (s.devPlayed || !s.players[seat].devCards.includes('knight') || s.robber < 0) return null;
  const topo = getTopology(s.board);
  const blocked = topo.hexes[s.robber].corners.some((v) => s.buildings[v]?.owner === seat);
  if (blocked && pips(s.board.hexes[s.robber].number) >= 3) return { type: 'playKnight' };
  return winsArmy(s, seat) ? { type: 'playKnight' } : null;
}

/** Holt dieser Ritter die Rittermacht? */
function winsArmy(s: GameState, seat: number): boolean {
  const holder = s.largestArmy;
  const knights = s.players[seat].knights + 1;
  return holder !== seat && knights >= 3 && (holder === null || knights > s.players[holder].knights);
}

/**
 * Räuber oder Kaperschiff (Seewege): an Land aufs Feld, das den Führenden am meisten trifft, nie aufs eigene.
 * Das Kaperschiff sperrt fremde Schiffe an seinem Meerfeld; dorthin, wenn das mehr bringt, oder weg von
 * eigenen Schiffen, die es gerade sperrt. Gezogen wird beim Stärksten.
 */
function robberMove(s: GameState, seat: number): Action {
  const topo = getTopology(s.board);
  const vp = s.players.map((_, i) => victoryPoints(s, i, false));
  const legal = legalRobberHexes(s);
  const sea = (h: number) => s.board.hexes[h]?.terrain === 'sea';
  const steal = (h: number) => (robberVictims(s, seat, h).length ? 3 : 0);
  const landValue = (h: number) => {
    let value = steal(h);
    for (const v of topo.hexes[h]?.corners ?? []) {
      const b = s.buildings[v];
      if (!b) continue;
      const weight = (b.type === 'city' ? 2 : 1) * pips(s.board.hexes[h].number);
      value += b.owner === seat ? -3 * weight - 10 : weight * (1 + vp[b.owner] / 4);
    }
    return value;
  };
  // Am offenen Ende einer Schiffslinie sperrt das Kaperschiff den Weg zur nächsten Insel; das zählt wie ein
  // gutes Landfeld. Eigene Schiffe am bisherigen Feld werden frei.
  const open = (e: number) => {
    const o = s.ships![e]!;
    const edge = topo.edges[e];
    return [edge.a, edge.b].some((v) => s.buildings[v]?.owner !== o && !topo.vertices[v].edges.some((x) => x !== e && s.ships![x] === o));
  };
  const shipWeight = (e: number) => (open(e) ? 4 : 1);
  const own = (h: number) => topo.hexes[h].edges.reduce((n, e) => (s.ships?.[e] === seat ? n + shipWeight(e) : n), 0);
  const relief = s.pirate != null ? own(s.pirate) * 2 : 0;
  const pirateValue = (h: number) => {
    let value = steal(h) + relief - own(h) * 4;
    for (const e of topo.hexes[h].edges) {
      const o = s.ships?.[e];
      if (o != null && o !== seat) value += shipWeight(e) * 2 * (1 + vp[o] / 4);
    }
    return value;
  };
  const land = legal.filter((h) => !sea(h));
  const water = legal.filter(sea);
  const bestLand = land.length ? best(land, landValue) : null;
  const bestWater = water.length ? best(water, pirateValue) : null;
  const hex = bestWater !== null && (bestLand === null || pirateValue(bestWater) > landValue(bestLand)) ? bestWater : (bestLand ?? legal[0]);
  const victims = robberVictims(s, seat, hex);
  const victim = victims.length ? best(victims, (v) => vp[v] * 10 + handCount(s, v)) : null;
  return { type: 'moveRobber', hex, victim };
}

function handCount(s: GameState, seat: number): number {
  const p = s.players[seat];
  return p.hidden?.cards ?? CARDS.reduce((n, k) => n + count(p.resources, k), 0);
}

/** Beim Abwerfen: zuerst, was das Ziel nicht braucht, und davon das, wovon am meisten da ist. */
function keepUseful(s: GameState, seat: number, due: number, profile: BotProfile): ResourceCounts {
  const plan = botPlan(s, seat, profile);
  const left = { ...s.players[seat].resources };
  const out = emptyResources();
  const needed = (k: Card) => count(plan.goal?.cost ?? emptyResources(), k);
  for (let i = 0; i < due; i++) {
    // Güter (Stadtwacht) sind seltener als Rohstoffe: bei Gleichstand eher behalten.
    const card = best(
      CARDS.filter((k) => count(left, k) > 0),
      (k) => (count(left, k) > needed(k) ? 100 : 0) + count(left, k) - needed(k) - (isCommodity(k) ? 0.5 : 0),
    );
    left[card] = count(left, card) - 1;
    out[card] = count(out, card) + 1;
  }
  return out;
}

/**
 * Hauptphase: zuerst offene Tauschgeschäfte erledigen, dann eine passende Entwicklungskarte, dann der
 * nächste Schritt des Plans, sonst darauf hin tauschen: erst mit den Mitspielern, dann mit der Bank. Was nur
 * aus Überschuss bezahlt wird, darf nebenher entstehen; ist die Hand zu voll, baut der Bot lieber irgendetwas,
 * als bei einer 7 abzuwerfen. null heißt: Zug beenden. In der Sonderbauphase wird weder getauscht noch eine
 * Karte gespielt. `offersMade` null: keine eigenen Angebote.
 */
function mainMove(s: GameState, seat: number, profile: BotProfile, offersMade: number | null, ownTurn = true): Action | null {
  const hand = s.players[seat].resources;
  if (ownTurn) {
    const deal = settleOffers(s, seat, profile);
    if (deal) return deal;
  }
  if (ownTurn) {
    const fortress = attackableFortress(s, seat);
    if (fortress !== null) return { type: 'attackFortress', vertex: fortress };
    const harbor = harborMove(s, seat);
    if (harbor) return harbor;
  }
  const plan = botPlan(s, seat, profile);
  if (ownTurn) {
    const card = playUseful(s, seat, plan) ?? expansionMove(s, seat, plan);
    if (card) return card;
  }
  const goal = plan.goal;
  if (!goal) return null;
  if (hasResources(hand, goal.stepCost)) return goal.step;
  const offer = ownTurn && offersMade !== null && offersMade < profile.offers ? proposeTrade(s, seat, plan, profile, offersMade) : null;
  if (offer) return offer;
  const trade = ownTurn ? bankTradeToward(s, seat, plan, profile) : null;
  if (trade) return trade;
  for (const g of plan.goals) if (g !== goal && hasResources(plan.spare, g.stepCost)) return g.step;
  if (totalResources(hand) > profile.handLimit) for (const g of plan.goals) if (hasResources(hand, g.stepCost)) return g.step;
  return null;
}

/**
 * Ein Tausch mit der Bank (oder dem Hafen) aus Karten, die das Ziel nicht braucht, gegen eine, die ihm
 * fehlt. Nur wenn der Überschuss für den nächsten Schritt reicht, sonst wechselt das Ziel womöglich, und
 * die Karten gingen hin und her. Bei voller Hand auch schon vorher, damit eine 7 weniger kostet.
 */
function bankTradeToward(s: GameState, seat: number, plan: BotPlan, profile: BotProfile): Action | null {
  const goal = plan.goal!;
  const hand = s.players[seat].resources;
  const stepNeed = CARDS.flatMap((k) => Array<Card>(Math.max(0, count(goal.stepCost, k) - count(hand, k))).fill(k));
  const need = stepNeed.length ? stepNeed : CARDS.flatMap((k) => Array<Card>(count(plan.need, k)).fill(k));
  const get = need.find((k) => count(s.bank, k) > 0);
  if (!get) return null;
  const spare = RESOURCES.filter((r) => r !== get && plan.spare[r] >= tradeRate(s, seat, r));
  if (!spare.length) return null;
  const lots = spare.reduce((n, r) => n + Math.floor(plan.spare[r] / tradeRate(s, seat, r)), 0);
  if (lots < stepNeed.length && totalResources(hand) <= profile.handLimit) return null;
  if (!stepNeed.length && totalResources(hand) <= profile.handLimit) return null;
  const give = best(spare, (r) => plan.spare[r] - tradeRate(s, seat, r));
  return { type: 'bankTrade', give, get };
}

/** Entwicklungskarten, die gerade helfen: Ritter, Erfindung und Monopol für das Ziel, Straßenbau auf dem Weg dahin. */
function playUseful(s: GameState, seat: number, plan: BotPlan): Action | null {
  if (s.devPlayed) return null;
  const p = s.players[seat];
  const has = (c: DevCard) => p.devCards.includes(c);
  const knight = has('knight') ? knightBeforeRoll(s, seat) : null;
  if (knight) return knight;
  // Freibeuterbuchten: Kriegsschiffe helfen gegen Festung und Kaperschiff.
  if (has('knight') && s.warships && plainShips(s, seat).length) return { type: 'playKnight' };
  const need = RESOURCES.flatMap((r) => Array<Resource>(plan.need[r]).fill(r));
  if (plan.goal && has('yearOfPlenty') && need.length >= 1) {
    const picks = [...need, ...need].slice(0, 2) as [Resource, Resource];
    const take = emptyResources();
    for (const r of picks) take[r]++;
    if (hasResources(s.bank, take)) return { type: 'playYearOfPlenty', resources: picks };
  }
  if (plan.goal && has('monopoly') && need.length >= 2) {
    return {
      type: 'playMonopoly',
      resource: best(need, (r) => need.filter((x) => x === r).length),
    };
  }
  const road = plan.goals.find((g) => isFreePiece(g.step));
  if (has('roadBuilding') && road && piecesLeft(s, seat, 'road') + (s.ships ? piecesLeft(s, seat, 'ship') : 0) >= 2) return { type: 'playRoadBuilding' };
  return null;
}

/** Was die Straßenbau-Karte kostenlos legt: Straßen und Schiffe, keine Brücken. */
const isFreePiece = (a: Action) => a.type === 'buildRoad' || a.type === 'buildShip';

/** Straßenbau-Karte: die Straßen oder Schiffe auf dem Weg zum besten Ziel, das welche braucht. */
function freeRoad(s: GameState, seat: number, profile: BotProfile): Action | null {
  const road = botPlan(s, seat, profile).goals.find((g) => isFreePiece(g.step));
  if (road) return road.step;
  const edges = legalRoadEdges(s, seat);
  return edges.length ? { type: 'buildRoad', edge: best(edges, (e) => roadValue(s, seat, e, null)) } : null;
}

/** Gold: zuerst, was dem Ziel fehlt, sonst den Rohstoff, den der Bot am wenigsten erntet. */
function goldPick(s: GameState, seat: number, due: number, profile: BotProfile): ResourceCounts {
  const plan = botPlan(s, seat, profile);
  const need = { ...plan.need };
  const bank = { ...s.bank };
  const out = emptyResources();
  for (let i = 0; i < due; i++) {
    const options = RESOURCES.filter((r) => bank[r] > 0);
    if (!options.length) break;
    const r = best(options, (k) => need[k] * 10 - plan.income[k]);
    need[r] = Math.max(0, need[r] - 1);
    bank[r]--;
    out[r]++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Erweiterungen: Fische, Münzen, Handelsmarken

/**
 * Was die kleinen Erweiterungen am Zug zusätzlich erlauben: Fische ausgeben und den Anker loswerden
 * (Fischgründe), Münzen tauschen (Flussläufe), Handelsmarken einsetzen (Duell). Jede dieser Aktionen
 * verbraucht etwas, deshalb kann der Bot sich damit nicht im Kreis drehen.
 */
function expansionMove(s: GameState, seat: number, plan: BotPlan): Action | null {
  return fishMove(s, seat, plan) ?? coinMove(s, seat, plan) ?? tokenMove(s, seat, plan) ?? progressMove(s, seat, plan);
}

/**
 * Stadtwacht: Einflusskarten, die sich fast immer lohnen. Ernten, den Händler holen, Punkte-Führende zur
 * Kasse bitten, Wächter wecken oder aufwerten, Palisade und Stadt günstig, Straßen und Ausbau für das Ziel,
 * Karten von Mitspielern holen. Karten, die eine feinere Abwägung bräuchten (Überläufer, Gesandter,
 * Ränkespiel, Flurbereinigung, Losbuch, Frachtkontor, Jahrmarkt), hebt der Bot auf.
 */
function progressMove(s: GameState, seat: number, plan: BotPlan): Action | null {
  const cards = s.progress?.[seat];
  if (!cards?.length || s.phase.kind !== 'main' || s.current !== seat) return null;
  const has = (c: ProgressCard) => cards.includes(c);
  const play = (progress: ProgressCard, extra: Partial<Extract<Action, { type: 'playProgress' }>> = {}): Action => ({ type: 'playProgress', progress, ...extra });
  const topo = getTopology(s.board);
  const fields = (terrain: Resource) => topo.hexes.filter((h) => s.board.hexes[h.id].terrain === terrain && h.corners.some((v) => s.buildings[v]?.owner === seat)).length;
  const vp = victoryPoints(s, seat, false);
  const rivals = s.players.map((_, i) => i).filter((i) => i !== seat && !s.players[i].neutral);
  if (has('waterwheel') && fields('wheat')) return play('waterwheel');
  if (has('gallery') && fields('ore')) return play('gallery');
  if (has('peddler') && s.trader?.owner !== seat) {
    const hexes = traderHexes(s, seat);
    if (hexes.length) return play('peddler', { hexes: [best(hexes, (h) => pips(s.board.hexes[h].number))] });
  }
  if (has('banquet') && rivals.some((i) => victoryPoints(s, i, false) > vp && handCount(s, i) > 0)) return play('banquet');
  if (has('agitator') && rivals.filter((i) => victoryPoints(s, i, false) >= vp).reduce((n, i) => n + Math.floor(handCount(s, i) / 2), 0) >= 3) return play('agitator');
  const guards = (s.guards ?? []).flatMap((g, v) => (g?.owner === seat ? [{ g, v }] : []));
  if (has('alarmBell') && s.raiders && guards.some(({ g }) => !g.active) && s.raiders.position >= RAIDER_TRACK / 2) return play('alarmBell');
  // Waffenkammer: höchstens zwei Wächter, ohne mehr als GUARDS_PER_LEVEL auf einer Stufe.
  const perLevel = [0, 0, 0, 0];
  for (const { g } of guards) perLevel[g.level]++;
  const raisable: number[] = [];
  for (const { g, v } of guards) {
    if (raisable.length < 2 && canRaiseGuard(s, seat, v) && perLevel[g.level + 1] < GUARDS_PER_LEVEL) {
      perLevel[g.level + 1]++;
      raisable.push(v);
    }
  }
  if (has('armory') && raisable.length) return play('armory', { vertices: raisable });
  const walls = legalWallVertices(s, seat);
  if (has('pileDriver') && walls.length) return play('pileDriver', { vertices: [walls[0]] });
  const settlements = legalCityVertices(s, seat);
  if (has('lodge') && settlements.length && piecesLeft(s, seat, 'city') > 0 && hasResources(s.players[seat].resources, COSTS.lodge)) {
    return play('lodge', { vertices: [best(settlements, (v) => RESOURCES.reduce((n, r) => n + hexIncome(s, v)[r], 0))] });
  }
  if (has('surveyor') && plan.goal && isFreePiece(plan.goal.step)) return play('surveyor');
  if (has('pulley') && !s.boost?.pulley && plan.goal?.kind === 'improve' && totalResources(plan.need) === 1) return play('pulley');
  const resource = mostNeeded(s, plan);
  if (has('bulkBuy') && resource) return play('bulkBuy', { card: resource });
  const good = COMMODITIES.find((k) => count(plan.need, k) > 0);
  if (has('guildRight') && good) return play('guildRight', { card: good });
  const richer = richerPlayers(s, seat);
  if (has('bond') && richer.length) return play('bond', { target: best(richer, (i) => handCount(s, i)) });
  const scouted = scoutTargets(s, seat);
  if (has('scout') && scouted.length) return play('scout', { target: best(scouted, (i) => victoryPoints(s, i, false)) });
  if (has('taxCollector') && robberActive(s)) return play('taxCollector');
  // Fremde Wächter: einen herüberholen oder einen an der eigenen Straße verdrängen.
  const turncoat = turncoatTargets(s, seat);
  const spots = guardSpots(s, seat);
  if (has('turncoat') && turncoat.length && spots.length) {
    const from = best(turncoat, (v) => s.guards![v]!.level * 10 + victoryPoints(s, s.guards![v]!.owner, false));
    return play('turncoat', { vertices: [from, best(spots, (v) => topo.vertices[v].neighbors.filter((w) => s.buildings[w]?.owner === seat).length)] });
  }
  const intrigue = intrigueTargets(s, seat);
  if (has('intrigue') && intrigue.length) return play('intrigue', { vertices: [best(intrigue, (v) => s.guards![v]!.level)] });
  // Gesandter: eine offene Straße dessen, der die Längste Straße hält.
  const holder = s.longestRoad;
  const loose = holder !== null && holder !== seat ? openRoads(s).filter((e) => s.roads[e] === holder) : [];
  if (has('envoy') && loose.length) return play('envoy', { edge: loose[0] });
  const reform = landReform(s, seat);
  if (has('landReform') && reform) return play('landReform', { hexes: reform });
  // Frachtkontor: Überschuss einer Sorte für diesen Zug 2:1, wenn dem Ziel etwas fehlt.
  const surplus = CARDS.filter((k) => count(plan.spare, k) >= 2 && tradeRate(s, seat, k) > 2);
  if (has('tradingPost') && surplus.length && totalResources(plan.need) > 0) return play('tradingPost', { card: best(surplus, (k) => count(plan.spare, k)) });
  // Jahrmarkt: Rohstoffe gegen Güter, wenn ein Ausbau Güter braucht.
  const withCities = rivals.filter((i) => s.buildings.some((b) => b?.owner === i && b.type === 'city')).length;
  const spareResource = RESOURCES.filter((r) => plan.spare[r] >= Math.max(1, withCities));
  if (has('fair') && withCities && spareResource.length && COMMODITIES.some((k) => count(plan.need, k) > 0)) {
    return play('fair', { card: best(spareResource, (r) => plan.spare[r]) });
  }
  return null;
}

/** Wie stark ein Feld den Sitz trifft, gegen die anderen gerechnet: eigene Gebäude zählen voll, fremde halb. */
function hexStake(s: GameState, seat: number, hex: number): number {
  let stake = 0;
  for (const v of getTopology(s.board).hexes[hex].corners) {
    const b = s.buildings[v];
    if (!b || s.players[b.owner].neutral) continue;
    const weight = b.type === 'city' ? 2 : 1;
    stake += b.owner === seat ? weight : -weight / 2;
  }
  return stake;
}

/** Flurbereinigung: zwei Zahlen tauschen, sodass die bessere an die eigenen Felder kommt. Nur, wenn es sich lohnt. */
function landReform(s: GameState, seat: number): number[] | null {
  const hexes = reformHexes(s);
  let top: { pair: number[]; gain: number } | null = null;
  for (const a of hexes) {
    for (const b of hexes) {
      if (a >= b) continue;
      const diff = pips(s.board.hexes[b].number) - pips(s.board.hexes[a].number);
      const gain = diff * (hexStake(s, seat, a) - hexStake(s, seat, b));
      if (!top || gain > top.gain) top = { pair: [a, b], gain };
    }
  }
  return top && top.gain >= 2 ? top.pair : null;
}

/**
 * Losbuch (Stadtwacht): statt zu würfeln die Summe wählen, die dem Bot am meisten und den anderen am wenigsten
 * bringt; nie die 7. Der rote Würfel möglichst klein, das passt am ehesten zu den Toren.
 */
function fortune(s: GameState, seat: number): Action | null {
  if (!s.progress?.[seat]?.includes('fortune')) return null;
  let top: { sum: number; gain: number } | null = null;
  for (let sum = 2; sum <= 12; sum++) {
    if (sum === 7) continue;
    let gain = 0;
    s.board.hexes.forEach((h, id) => {
      if (h.number === sum && id !== s.robber && (isResource(h.terrain) || h.terrain === 'gold')) gain += hexStake(s, seat, id);
    });
    if (!top || gain > top.gain) top = { sum, gain };
  }
  if (!top || top.gain < 2) return null;
  const red = Math.max(1, top.sum - 6);
  return { type: 'playProgress', progress: 'fortune', dice: [top.sum - red, red] };
}

/** Das wichtigste fehlende Stück für das Ziel, das die Bank noch hat. */
function mostNeeded(s: GameState, plan: BotPlan): Resource | null {
  const options = RESOURCES.filter((r) => plan.need[r] > 0 && s.bank[r] > 0);
  return options.length ? best(options, (r) => plan.need[r] - plan.income[r]) : null;
}

/** Steht der Räuber auf einem Feld, an dem der Bot baut? */
function robberHurts(s: GameState, seat: number): boolean {
  if (s.robber < 0) return false;
  return getTopology(s.board).hexes[s.robber].corners.some((v) => s.buildings[v]?.owner === seat) && pips(s.board.hexes[s.robber].number) >= 2;
}

function fishMove(s: GameState, seat: number, plan: BotPlan): Action | null {
  if (!s.fish) return null;
  // Der Rostige Anker kostet einen Siegpunkt: weiter an den Stärksten, der ihn nehmen muss.
  if (s.anchor === seat) {
    const vp = victoryPoints(s, seat, false);
    const takers = s.players.map((_, i) => i).filter((i) => i !== seat && !s.players[i].neutral && victoryPoints(s, i, false) >= vp);
    if (takers.length) return { type: 'passAnchor', to: best(takers, (i) => victoryPoints(s, i, false)) };
  }
  const fish = fishTotal(s, seat);
  if (fish < 2) return null;
  if (robberHurts(s, seat) && canSpendFish(s, seat, 'robber')) return { type: 'spendFish', effect: 'robber' };
  if (canSpendFish(s, seat, 'devCard')) return { type: 'spendFish', effect: 'devCard' };
  const road = plan.goal && isFreePiece(plan.goal.step);
  if (road && fish >= 5 && canSpendFish(s, seat, 'road')) return { type: 'spendFish', effect: 'road' };
  const need = mostNeeded(s, plan);
  if (need && canSpendFish(s, seat, 'bank')) return { type: 'spendFish', effect: 'bank', resource: need };
  // Drei Fische: eine Karte beim Führenden mit voller Hand.
  if (fish === 3 && canSpendFish(s, seat, 'steal')) {
    const victims = s.players.map((_, i) => i).filter((i) => i !== seat && !s.players[i].neutral && handCount(s, i) >= 4);
    if (victims.length) return { type: 'spendFish', effect: 'steal', victim: best(victims, (i) => victoryPoints(s, i, false) * 10 + handCount(s, i)) };
  }
  return null;
}

/** Flussläufe: 2 Münzen gegen einen fehlenden Rohstoff, wenn der Bot dadurch nicht schlechter dasteht. */
function coinMove(s: GameState, seat: number, plan: BotPlan): Action | null {
  if (!s.coins || s.coins[seat] < 2 || s.current !== seat) return null;
  const need = mostNeeded(s, plan);
  if (!need) return null;
  const coins = [...s.coins];
  coins[seat] -= 2;
  const completes = plan.goal && totalResources(plan.need) === 1;
  return coinPoints({ ...s, coins }, seat) >= coinPoints(s, seat) || completes ? { type: 'tradeCoins', resource: need } : null;
}

/** Duell: Handelsmarken für den Räuber in die Wüste oder einen erzwungenen Tausch aus Überschuss. */
function tokenMove(s: GameState, seat: number, plan: BotPlan): Action | null {
  if (!s.tokens) return null;
  if (robberHurts(s, seat) && canSpendTokens(s, seat, 'robber')) return { type: 'spendTokens', effect: 'robber' };
  const spare = RESOURCES.flatMap((r) => Array<Resource>(plan.spare[r]).fill(r));
  if (spare.length >= 2 && totalResources(plan.need) >= 2 && canSpendTokens(s, seat, 'trade')) {
    const give = emptyResources();
    for (const r of [...spare].sort((a, b) => plan.spare[b] - plan.spare[a]).slice(0, 2)) give[r]++;
    return { type: 'spendTokens', effect: 'trade', give };
  }
  return null;
}

/**
 * Duell: Teile der Neutralen sperren. Eine Siedlung auf den Platz, den der Gegner gerade anstrebt (oder
 * einen Nachbarn davon), eine Straße möglichst nah daran. Nie auf ein eigenes Ziel.
 */
function neutralMove(s: GameState, seat: number, piece: 'road' | 'settlement', profile: BotProfile): Action | null {
  const options = neutralSpots(s, piece).filter((n) => n.spots.length);
  if (!options.length) return null;
  const topo = getTopology(s.board);
  const opponent = s.players.findIndex((p, i) => i !== seat && !p.neutral);
  // Die Hand des Gegners kennt der Bot nicht: seine Ziele nur nach Brett und Erträgen.
  const open = { ...s, players: s.players.map((p, i) => (i === opponent ? { ...p, resources: emptyResources() } : p)) };
  const targetsOf = (who: number, gs: GameState) =>
    botPlan(gs, who, profile)
      .goals.filter((g) => g.kind === 'settlement')
      .map((g) => g.target ?? -1)
      .filter((v) => v >= 0);
  const mine = new Set(targetsOf(seat, s));
  const targets = targetsOf(opponent, open).slice(0, 3);
  const near = (v: number) => {
    let d = Infinity;
    for (const t of targets) d = Math.min(d, Math.hypot(topo.vertices[v].x - topo.vertices[t].x, topo.vertices[v].y - topo.vertices[t].y));
    return d;
  };
  let top: { owner: number; spot: number; value: number } | null = null;
  for (const { owner, spots } of options) {
    for (const spot of spots) {
      const ends = piece === 'road' ? [topo.edges[spot].a, topo.edges[spot].b] : [spot];
      if (ends.some((v) => mine.has(v))) continue;
      const value = -Math.min(...ends.map(near)) + (piece === 'settlement' ? spotValue(s, spot) / 20 : 0);
      if (!top || value > top.value) top = { owner, spot, value };
    }
  }
  if (!top) return null;
  return piece === 'road' ? { type: 'placeNeutral', owner: top.owner, edge: top.spot } : { type: 'placeNeutral', owner: top.owner, vertex: top.spot };
}

// ---------------------------------------------------------------------------
// Handel mit Mitspielern

/** Wie gut der Plan mit dieser Hand steht: Gewinn je Runde des besten Ziels. */
function planScore(s: GameState, seat: number, hand: ResourceCounts, profile: BotProfile): number {
  const t = {
    ...s,
    players: s.players.map((p, i) => (i === seat ? { ...p, resources: hand } : p)),
  };
  return botPlan(t, seat, { ...profile, noise: 0 }).goals[0]?.score ?? 0;
}

/**
 * Lohnt sich der Tausch für den Bot? Er vergleicht seinen Plan vor und nach dem Tausch und will um
 * `margin` besser dastehen. Güter (Stadtwacht) bewertet er nicht, sie gibt er nicht her.
 */
function tradePays(s: GameState, seat: number, give: ResourceCounts, get: ResourceCounts, profile: BotProfile): boolean {
  if (CARDS.some((k) => !isResource(k) && count(give, k) > 0)) return false;
  const hand = s.players[seat].resources;
  if (!hasResources(hand, give)) return false;
  const after = { ...hand };
  for (const r of RESOURCES) after[r] = hand[r] - give[r] + get[r];
  const before = planScore(s, seat, hand, profile);
  return planScore(s, seat, after, profile) > before + profile.margin * Math.max(before, 0.05);
}

/** Steht dieser Spieler so kurz vor dem Sieg, dass der Bot ihm nichts mehr verschafft? */
function nearWin(s: GameState, seat: number, profile: BotProfile): boolean {
  return victoryPoints(s, seat, false) >= victoryTarget(s, seat) - profile.leaderGuard;
}

/**
 * Wartet der Bot am Zug auf Antworten zu seinem Angebot? Dann soll ihn, wer ihn spielen lässt, eine Weile
 * in Ruhe lassen, bevor botAction das Angebot abschließt oder zurückzieht.
 */
export function botAwaitsAnswers(s: GameState, seat: number): boolean {
  if (s.phase.kind !== 'main' || s.current !== seat) return false;
  const mine = s.offers.find((o) => o.from === seat && !o.counter);
  if (!mine || mine.accepted.length) return false;
  return s.players.some((p, i) => i !== seat && !p.neutral && !mine.declined.includes(i));
}

/**
 * Offene Geschäfte des Bots am Zug: Mit dem besten Partner abschließen, der sein Angebot angenommen hat,
 * oder ein lohnendes Gegenangebot annehmen. Sonst eigene Angebote zurückziehen und Gegenangebote ablehnen.
 */
function settleOffers(s: GameState, seat: number, profile: BotProfile): Action | null {
  const mine = s.offers.find((o) => o.from === seat && !o.counter);
  const counters = s.offers.filter((o) => o.counter);
  if (!mine && !counters.length) return null;
  const vp = (i: number) => victoryPoints(s, i, false);
  const partners = (mine?.accepted ?? []).filter((p) => !nearWin(s, p, profile));
  if (mine && partners.length) return { type: 'confirmTrade', offerId: mine.id, partner: best(partners, (p) => -vp(p)) };
  const good = counters.filter((o) => !nearWin(s, o.from, profile) && tradePays(s, seat, o.want, o.give, profile));
  if (good.length) {
    const o = best(good, (c) => -vp(c.from) - totalResources(c.want) + totalResources(c.give));
    return { type: 'confirmTrade', offerId: o.id, partner: o.from };
  }
  return { type: 'withdrawOffers' };
}

/**
 * Ein eigenes Angebot an alle: eine Karte, die dem Ziel fehlt, gegen Überschuss. Beim ersten Versuch eins
 * zu eins, danach darf es zwei gegen eins sein. Nur Rohstoffe, die ein anderer auch erntet.
 */
function proposeTrade(s: GameState, seat: number, plan: BotPlan, profile: BotProfile, attempt: number): Action | null {
  const others = s.players.map((_, i) => i).filter((i) => i !== seat && !s.players[i].neutral && handCount(s, i) > 0);
  const grown = new Set(others.flatMap((i) => RESOURCES.filter((r) => income(s, i)[r] > 0)));
  const wants = RESOURCES.filter((r) => plan.need[r] > 0 && grown.has(r)).sort((a, b) => plan.need[b] - plan.need[a]);
  const spare = RESOURCES.filter((r) => plan.spare[r] > 0).sort((a, b) => plan.spare[b] - plan.spare[a]);
  for (const get of wants) {
    for (const give of spare) {
      const amount = attempt > 0 && plan.spare[give] >= 2 ? 2 : 1;
      const giveCounts = { ...emptyResources(), [give]: amount };
      const getCounts = { ...emptyResources(), [get]: 1 };
      if (tradePays(s, seat, giveCounts, getCounts, profile)) return { type: 'offerTrade', give: giveCounts, want: getCounts };
    }
  }
  return null;
}

/**
 * Antwort auf ein Tauschangebot des Spielers am Zug: annehmen, wenn der Tausch den eigenen Plan um
 * `margin` voranbringt und der Bot nicht deutlich mehr abgibt, als er bekommt. Dem Führenden kurz vor dem
 * Sieg hilft er nicht. null: nichts zu antworten.
 */
export function botTradeResponse(s: GameState, seat: number, offer: TradeOffer, options: BotOptions = {}): boolean | null {
  if (s.phase.kind !== 'main' || offer.counter || offer.from === seat) return null;
  if (offer.accepted.includes(seat) || offer.declined.includes(seat)) return null;
  const profile = profileOf(options);
  // Aus Sicht des Bots: Er gibt, was der andere will, und bekommt, was der andere gibt.
  if (!hasResources(s.players[seat].resources, offer.want)) return false;
  if (nearWin(s, offer.from, profile)) return false;
  if (totalResources(offer.want) > totalResources(offer.give) + 1) return false;
  return tradePays(s, seat, offer.want, offer.give, profile);
}

/**
 * Wie botTradeResponse, aber als Zug: annehmen, ablehnen oder, wenn es ihm so nicht passt, vorher ein
 * Gegenangebot. Das Gegenangebot verlangt eine Karte, die der Anbietende ohnehin hergeben wollte, und gibt
 * dafür, was der verlangt. Danach lehnt der Bot das ursprüngliche Angebot ab.
 */
export function botAnswer(s: GameState, seat: number, offer: TradeOffer, options: BotOptions = {}): Action | null {
  const accept = botTradeResponse(s, seat, offer, options);
  if (accept === null) return null;
  const profile = profileOf(options);
  if (!accept && profile.counters && !s.offers.some((o) => o.from === seat) && !nearWin(s, offer.from, profile)) {
    const counter = counterOffer(s, seat, offer, profile);
    if (counter) return counter;
  }
  return { type: 'respondTrade', offerId: offer.id, accept };
}

function counterOffer(s: GameState, seat: number, offer: TradeOffer, profile: BotProfile): Action | null {
  const hand = s.players[seat].resources;
  const plan = botPlan(s, seat, profile);
  const gets = RESOURCES.filter((r) => count(offer.give, r) > 0 && plan.need[r] > 0);
  // Am liebsten gibt er, was der andere haben will, sonst eigenen Überschuss.
  const gives = RESOURCES.filter((r) => hand[r] > 0 && count(offer.give, r) === 0).sort((a, b) => count(offer.want, b) - count(offer.want, a) || plan.spare[b] - plan.spare[a]);
  for (const get of gets) {
    for (const give of gives) {
      const want = { ...emptyResources(), [get]: 1 };
      const pay = { ...emptyResources(), [give]: 1 };
      if (tradePays(s, seat, pay, want, profile)) return { type: 'offerTrade', give: pay, want };
    }
  }
  return null;
}
