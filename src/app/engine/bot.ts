import { autoAction } from './auto';
import { getTopology, vertexHarbors } from './board';
import {
  actingSeats,
  isFreeForSettlement,
  isRiverEdge,
  legalCityVertices,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  longestRoad,
  piecesLeft,
  robberVictims,
  tradeRate,
  victoryPoints,
  victoryTarget,
} from './rules';
import { Action, Card, CARDS, COSTS, count, DevCard, emptyResources, GameState, hasResources, Resource, RESOURCES, ResourceCounts, TradeOffer, totalResources } from './types';

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
      return knightBeforeRoll(s, seat) ?? { type: 'roll' };
    case 'discard':
      return { type: 'discard', resources: keepUseful(s, seat, phase.pending[seat], profile) };
    case 'robber':
      return robberMove(s, seat);
    case 'roadBuilding':
      return freeRoad(s, seat, profile) ?? autoAction(s, seat);
    case 'main':
      return mainMove(s, seat, profile, options.offersMade ?? null) ?? { type: 'endTurn' };
    case 'specialBuild':
      return mainMove(s, seat, profile, null, false) ?? { type: 'endTurn' };
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

export type GoalKind = 'city' | 'settlement' | 'devCard' | 'longestRoad';

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
}

export interface BotPlan {
  strategy: Strategy;
  /** Erwartete Karten je Rohstoff in einer Runde (alle Würfe bis zum nächsten eigenen Zug). */
  income: Record<Resource, number>;
  /** Alle Ziele, das beste zuerst. */
  goals: PlanGoal[];
  goal: PlanGoal | null;
  /** Was der Hand für das Ziel fehlt. */
  need: ResourceCounts;
  /** Karten, die das Ziel nicht braucht: Tauschware. */
  spare: ResourceCounts;
}

/** Ungefähr so viele Karten kostet ein Siegpunkt, und so viele Runden vergehen zwischen zwei Siegpunkten. */
const CARDS_PER_POINT = 5.5;
const ROUNDS_PER_POINT = 2.5;
/** Weiter schaut der Bot nicht voraus (Runden), und so viele Straßen weit sucht er Bauplätze. */
const HORIZON = 12;
const MAX_ROADS = 3;

export function botPlan(s: GameState, seat: number, profile: BotProfile = DEFAULT_PROFILE, mayBuyDev = true): BotPlan {
  const inc = income(s, seat);
  const strategy = strategyOf(inc);
  const ctx: PlanContext = {
    s,
    seat,
    profile,
    inc,
    weights: resourceWeights(s),
    rates: rates(s, seat),
  };
  const goals = [...cityGoals(ctx), ...settlementGoals(ctx), ...longestRoadGoals(ctx), ...(mayBuyDev ? devGoals(ctx) : [])];
  for (const g of goals) g.score = (g.value * (profile.strategy[strategy][g.kind] ?? 1)) / (g.eta + 1);
  goals.sort((a, b) => b.score - a.score);
  const goal = goals.length ? sloppyBest(s, seat, profile, goals, (g) => g.score) : null;
  const hand = s.players[seat].resources;
  const need = emptyResources();
  const spare = emptyResources();
  for (const r of RESOURCES) {
    const d = hand[r] - (goal?.cost[r] ?? 0);
    if (d < 0) need[r] = -d;
    else spare[r] = d;
  }
  return { strategy, income: inc, goals, goal, need, spare };
}

interface PlanContext {
  s: GameState;
  seat: number;
  profile: BotProfile;
  inc: Record<Resource, number>;
  /** Wert einer Karte je Rohstoff: Seltenes auf dem Brett ist mehr wert. */
  weights: Record<Resource, number>;
  rates: Record<Resource, number>;
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

function income(s: GameState, seat: number): Record<Resource, number> {
  const out = zeroIncome();
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat) return;
    const add = hexIncome(s, v);
    for (const r of RESOURCES) out[r] += add[r] * (b.type === 'city' ? 2 : 1);
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

function rates(s: GameState, seat: number): Record<Resource, number> {
  const out = zeroIncome();
  for (const r of RESOURCES) out[r] = tradeRate(s, seat, r);
  return out;
}

/** Runden, bis `cost` mit Hand, Erträgen und Bankhandel bezahlbar ist; in Vierteln gerechnet. */
function eta(ctx: PlanContext, cost: ResourceCounts): number {
  const hand = ctx.s.players[ctx.seat].resources;
  for (let t = 0; t <= HORIZON; t += 0.25) {
    let missing = 0;
    let lots = 0;
    for (const r of RESOURCES) {
      const d = hand[r] + ctx.inc[r] * t - cost[r];
      if (d < 0) missing -= d;
      else lots += t === 0 ? Math.floor(d / ctx.rates[r]) : d / ctx.rates[r];
    }
    if (missing <= lots + 1e-9) return t;
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

/** Ertrag einer neuen Siedlung, mit Zuschlag für Rohstoffe, die noch fehlen, und für passende Häfen. */
function spotGain(ctx: PlanContext, vertex: number): number {
  const add = hexIncome(ctx.s, vertex);
  let gain = weighted(ctx, add);
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
    value: 1 + productionValue(ctx, weighted(ctx, hexIncome(ctx.s, vertex)), t),
    eta: t,
    score: 0,
  }));
}

/** Freie Bauplätze, die der Bot mit höchstens MAX_ROADS Straßen erreicht, über den kürzesten Weg. */
function settlementGoals(ctx: PlanContext): PlanGoal[] {
  const { s, seat } = ctx;
  if (piecesLeft(s, seat, 'settlement') <= 0) return [];
  const out: PlanGoal[] = [];
  const add = (vertex: number, path: number[]) => {
    const cost = { ...COSTS.settlement };
    cost.wood += path.length;
    cost.brick += path.length;
    const t = eta(ctx, cost);
    out.push({
      kind: 'settlement',
      cost,
      step: path.length ? { type: 'buildRoad', edge: path[0] } : { type: 'buildSettlement', vertex },
      stepCost: path.length ? COSTS.road : COSTS.settlement,
      value: (1 + productionValue(ctx, spotGain(ctx, vertex), t)) * ctx.profile.distance ** path.length,
      eta: t,
      score: 0,
    });
  };
  const direct = legalSettlementVertices(s, seat);
  for (const v of direct) add(v, []);
  const reach = roadPaths(s, seat, Math.min(MAX_ROADS, piecesLeft(s, seat, 'road')));
  for (const [v, path] of reach) if (path.length && !direct.includes(v) && isFreeForSettlement(s, v)) add(v, path);
  return out;
}

/** Kürzeste Wege aus neuen Straßen vom eigenen Netz zu jeder Ecke, höchstens `depth` lang. */
function roadPaths(s: GameState, seat: number, depth: number): Map<number, number[]> {
  const topo = getTopology(s.board);
  const paths = new Map<number, number[]>();
  const ownNet = (v: number) => s.buildings[v]?.owner === seat || (!s.buildings[v] && topo.vertices[v].edges.some((e) => s.roads[e] === seat));
  let frontier = topo.vertices.filter((v) => ownNet(v.id)).map((v) => v.id);
  for (const v of frontier) paths.set(v, []);
  for (let d = 0; d < depth; d++) {
    const next: number[] = [];
    for (const v of frontier) {
      // Durch fremde Gebäude führt kein Weg.
      const b = s.buildings[v];
      if (b && b.owner !== seat) continue;
      for (const e of topo.vertices[v].edges) {
        if (s.roads[e] !== null || s.ships?.[e] != null || isRiverEdge(s, e)) continue;
        const edge = topo.edges[e];
        if (!edge.hexes.some((h) => isResource(s.board.hexes[h].terrain) || s.board.hexes[h].terrain === 'desert')) continue;
        const w = edge.a === v ? edge.b : edge.a;
        if (paths.has(w)) continue;
        paths.set(w, [...paths.get(v)!, e]);
        next.push(w);
      }
    }
    frontier = next;
  }
  // Der erste Schritt muss jetzt schon legal sein.
  const legal = new Set(legalRoadEdges(s, seat));
  for (const [v, path] of paths) if (path.length && !legal.has(path[0])) paths.delete(v);
  return paths;
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
  if (s.buildings[vertex]) return false;
  if (!topo.vertices[vertex].hexes.some((h) => isResource(s.board.hexes[h].terrain))) return false;
  return topo.vertices[vertex].neighbors.every((w) => !s.buildings[w]);
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

/** Räuber: aufs Feld, das den Führenden am meisten trifft, nie aufs eigene; ziehen beim Stärksten. */
function robberMove(s: GameState, seat: number): Action {
  const topo = getTopology(s.board);
  const vp = s.players.map((_, i) => victoryPoints(s, i, false));
  const hexes = legalRobberHexes(s).filter((h) => !s.board.hexes[h] || s.board.hexes[h].terrain !== 'sea');
  const options = hexes.length ? hexes : legalRobberHexes(s);
  const hex = best(options, (h) => {
    let value = 0;
    for (const v of topo.hexes[h]?.corners ?? []) {
      const b = s.buildings[v];
      if (!b) continue;
      const weight = (b.type === 'city' ? 2 : 1) * pips(s.board.hexes[h].number);
      value += b.owner === seat ? -3 * weight - 10 : weight * (1 + vp[b.owner] / 4);
    }
    return value;
  });
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
  const needed = (k: Card) => (isResource(k) ? (plan.goal?.cost[k] ?? 0) : 0);
  for (let i = 0; i < due; i++) {
    const card = best(
      CARDS.filter((k) => count(left, k) > 0),
      (k) => (count(left, k) > needed(k) ? 100 : 0) + count(left, k) - needed(k),
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
  const plan = botPlan(s, seat, profile);
  if (ownTurn) {
    const card = playUseful(s, seat, plan);
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
  const stepNeed = RESOURCES.flatMap((r) => Array<Resource>(Math.max(0, goal.stepCost[r] - hand[r])).fill(r));
  const need = stepNeed.length ? stepNeed : RESOURCES.flatMap((r) => Array<Resource>(plan.need[r]).fill(r));
  const get = need.find((r) => s.bank[r] > 0);
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
  const road = plan.goals.find((g) => g.step.type === 'buildRoad');
  if (has('roadBuilding') && road && piecesLeft(s, seat, 'road') >= 2) return { type: 'playRoadBuilding' };
  return null;
}

/** Straßenbau-Karte: die Straßen auf dem Weg zum besten Ziel, das Straßen braucht. */
function freeRoad(s: GameState, seat: number, profile: BotProfile): Action | null {
  const road = botPlan(s, seat, profile).goals.find((g) => g.step.type === 'buildRoad');
  if (road) return road.step;
  const edges = legalRoadEdges(s, seat);
  return edges.length ? { type: 'buildRoad', edge: best(edges, (e) => roadValue(s, seat, e, null)) } : null;
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
