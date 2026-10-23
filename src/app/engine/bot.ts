import { autoAction } from './auto';
import { getTopology, vertexHarbors } from './board';
import {
  actingSeats,
  legalCityVertices,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  piecesLeft,
  robberVictims,
  tradeRate,
  victoryPoints,
} from './rules';
import { Action, Card, CARDS, COSTS, count, DevCard, emptyResources, GameState, hasResources, Resource, RESOURCES, ResourceCounts } from './types';

/**
 * Ein Bot, der für einen getrennten Spieler weiterspielt: baut, kauft, tauscht mit der Bank und setzt
 * den Räuber vernünftig. Er kennt nur, was der Spieler an diesem Platz auch wüsste: die eigene Hand
 * und das offene Brett, keine fremden Karten. Für Phasen, die er nicht kennt (Erweiterungen), macht
 * er den zurückhaltenden Zug aus auto.ts. Liefert null, wenn der Sitz nicht dran ist.
 */
export function botAction(s: GameState, seat: number): Action | null {
  if (!actingSeats(s).includes(seat)) return null;
  const phase = s.phase;
  switch (phase.kind) {
    case 'setup':
      if (phase.step === 'settlement') return { type: 'placeSettlement', vertex: best(legalSetupVertices(s), (v) => spotValue(s, v)) };
      return { type: 'placeRoad', edge: best(legalSetupRoads(s), (e) => roadValue(s, seat, e, phase.settlement)) };
    case 'roll':
      return knightAgainstRobber(s, seat) ?? { type: 'roll' };
    case 'discard':
      return { type: 'discard', resources: keepUseful(s.players[seat].resources, phase.pending[seat]) };
    case 'robber':
      return robberMove(s, seat);
    case 'roadBuilding': {
      const edges = legalRoadEdges(s, seat);
      return edges.length ? { type: 'buildRoad', edge: best(edges, (e) => roadValue(s, seat, e, null)) } : autoAction(s, seat);
    }
    case 'main':
      return mainMove(s, seat, true) ?? { type: 'endTurn' };
    case 'specialBuild':
      return mainMove(s, seat, false) ?? { type: 'endTurn' };
    default:
      return autoAction(s, seat);
  }
}

// ---------------------------------------------------------------------------
// Bewertung

const pips = (n: number | null) => (n ? 6 - Math.abs(7 - n) : 0);

/** Wert einer Ecke: Wahrscheinlichkeitspunkte der Felder, etwas mehr für verschiedene Rohstoffe und Häfen. */
function spotValue(s: GameState, vertex: number): number {
  const topo = getTopology(s.board);
  const kinds = new Set<string>();
  let value = 0;
  for (const h of topo.vertices[vertex].hexes) {
    const hex = s.board.hexes[h];
    if (!(RESOURCES as readonly string[]).includes(hex.terrain) || h === s.robber) continue;
    value += pips(hex.number);
    kinds.add(hex.terrain);
  }
  const harbor = vertexHarbors(s.board)[vertex];
  return value + kinds.size * 1.5 + (harbor ? 1 : 0);
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
  if (!topo.vertices[vertex].hexes.some((h) => (RESOURCES as readonly string[]).includes(s.board.hexes[h].terrain))) return false;
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

/** Vor dem Würfeln: Steht der Räuber auf einem eigenen Ertragsfeld, einen Ritter spielen. */
function knightAgainstRobber(s: GameState, seat: number): Action | null {
  if (s.devPlayed || !s.players[seat].devCards.includes('knight') || s.robber < 0) return null;
  const topo = getTopology(s.board);
  const blocked = topo.hexes[s.robber].corners.some((v) => s.buildings[v]?.owner === seat);
  return blocked && pips(s.board.hexes[s.robber].number) >= 3 ? { type: 'playKnight' } : null;
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

/** Beim Abwerfen: von dem trennen, wovon am meisten da ist, Erz und Getreide (Stadt) eher behalten. */
function keepUseful(hand: ResourceCounts, due: number): ResourceCounts {
  const left = { ...hand };
  const out = emptyResources();
  const keepBonus: Partial<Record<Card, number>> = { ore: 0.5, wheat: 0.5 };
  for (let i = 0; i < due; i++) {
    const card = best(
      CARDS.filter((k) => count(left, k) > 0),
      (k) => count(left, k) - (keepBonus[k] ?? 0),
    );
    left[card] = count(left, card) - 1;
    out[card] = count(out, card) + 1;
  }
  return out;
}

/** Was der Bot als Nächstes bauen will, mit Kosten und dem passenden Zug. */
interface Goal {
  cost: ResourceCounts;
  action: Action;
}

function goals(s: GameState, seat: number, mayBuyDev: boolean): Goal[] {
  const out: Goal[] = [];
  const cities = piecesLeft(s, seat, 'city') > 0 ? legalCityVertices(s, seat) : [];
  if (cities.length) out.push({ cost: COSTS.city, action: { type: 'buildCity', vertex: best(cities, (v) => spotValue(s, v)) } });
  const spots = piecesLeft(s, seat, 'settlement') > 0 ? legalSettlementVertices(s, seat) : [];
  if (spots.length) out.push({ cost: COSTS.settlement, action: { type: 'buildSettlement', vertex: best(spots, (v) => spotValue(s, v)) } });
  if (mayBuyDev && s.devDeck.length > 0) out.push({ cost: COSTS.devCard, action: { type: 'buyDevCard' } });
  // Straßen nur, wenn kein Bauplatz frei ist: Sie sollen zu einem führen.
  const roads = piecesLeft(s, seat, 'road') > 0 && !spots.length ? legalRoadEdges(s, seat) : [];
  if (roads.length) {
    const edge = best(roads, (e) => roadValue(s, seat, e, null));
    if (roadValue(s, seat, edge, null) > 0) out.push({ cost: COSTS.road, action: { type: 'buildRoad', edge } });
  }
  return out;
}

/**
 * Hauptphase: zuerst eine passende Entwicklungskarte, dann bauen, was bezahlbar ist (Stadt, Siedlung,
 * Entwicklung, Straße), sonst mit der Bank auf das nächste Ziel hin tauschen. null heißt: Zug beenden.
 * In der Sonderbauphase wird weder getauscht noch eine Karte gespielt.
 */
function mainMove(s: GameState, seat: number, ownTurn: boolean): Action | null {
  const hand = s.players[seat].resources;
  const list = goals(s, seat, true);
  if (ownTurn) {
    const card = playUseful(s, seat, list);
    if (card) return card;
  }
  // Ziele nach Vorrang: bauen, was geht; sonst auf das wichtigere Ziel hin tauschen, bevor etwas
  // Billigeres die Karten dafür verbraucht (keine Entwicklungskarte statt der Stadt).
  for (const g of list) {
    if (hasResources(hand, g.cost)) return g.action;
    const trade = ownTurn ? bankTradeToward(s, seat, g.cost) : null;
    if (trade) return trade;
  }
  return null;
}

function missing(hand: ResourceCounts, cost: ResourceCounts): Resource[] {
  return RESOURCES.flatMap((r) => Array<Resource>(Math.max(0, cost[r] - hand[r])).fill(r));
}

/** Ein Tausch mit der Bank (oder dem Hafen), der genau eine fehlende Karte bringt, aus echtem Überschuss. */
function bankTradeToward(s: GameState, seat: number, cost: ResourceCounts): Action | null {
  const hand = s.players[seat].resources;
  const need = missing(hand, cost);
  if (!need.length) return null;
  const get = need.find((r) => s.bank[r] > 0);
  if (!get) return null;
  // Nach dem Tausch muss noch alles bezahlbar sein, was nicht fehlt: Überschuss = Hand minus Kosten.
  const spare = CARDS.filter((k) => k !== get && count(hand, k) - count(cost, k) >= tradeRate(s, seat, k));
  if (!spare.length) return null;
  // Mehr fehlende Karten, als der Überschuss je bringen kann? Dann lohnt das Ziel noch nicht.
  const lots = spare.reduce((n, k) => n + Math.floor((count(hand, k) - count(cost, k)) / tradeRate(s, seat, k)), 0);
  if (lots < need.length) return null;
  const give = best(spare, (k) => count(hand, k) - count(cost, k) - tradeRate(s, seat, k));
  return { type: 'bankTrade', give, get };
}

/** Entwicklungskarten, die gerade helfen: Ritter gegen den Räuber, Erfindung und Monopol für ein Ziel, Straßenbau zu einem Bauplatz. */
function playUseful(s: GameState, seat: number, list: Goal[]): Action | null {
  if (s.devPlayed) return null;
  const p = s.players[seat];
  const has = (c: DevCard) => p.devCards.includes(c);
  const knight = has('knight') ? knightAgainstRobber(s, seat) : null;
  if (knight) return knight;
  const target = list[0];
  if (target && has('yearOfPlenty')) {
    const need = missing(p.resources, target.cost);
    if (need.length >= 1 && need.length <= 2) {
      const picks = [...need, ...need].slice(0, 2) as [Resource, Resource];
      const take = emptyResources();
      for (const r of picks) take[r]++;
      if (hasResources(s.bank, take)) return { type: 'playYearOfPlenty', resources: picks };
    }
  }
  if (target && has('monopoly')) {
    const need = missing(p.resources, target.cost);
    if (need.length >= 2) return { type: 'playMonopoly', resource: best(need, (r) => need.filter((x) => x === r).length) };
  }
  if (has('roadBuilding') && !legalSettlementVertices(s, seat).length && piecesLeft(s, seat, 'road') >= 2 && legalRoadEdges(s, seat).length) {
    return { type: 'playRoadBuilding' };
  }
  return null;
}
