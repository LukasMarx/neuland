import { describe, expect, it } from 'vitest';
import { bankSize, getTopology } from './board';
import { randomInt } from './rng';
import {
  actingSeats,
  applyAction,
  canBuildAnything,
  createGame,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  longestRoad,
  piecesLeft,
  robberVictims,
  RuleError,
  tradeRate,
  victoryPoints,
} from './rules';
import { Action, COSTS, DevCard, GameState, RESOURCES, ResourceCounts, emptyResources, totalResources } from './types';

// ---------------------------------------------------------------------------
// Hilfsfunktionen

const CENTER = 9; // mittleres Feld des Basisbretts

function game(n = 4, seed = 1, victoryPointsGoal = 10): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  return createGame(players, { victoryPoints: victoryPointsGoal }, seed);
}

function res(partial: Partial<ResourceCounts> = {}): ResourceCounts {
  return { ...emptyResources(), ...partial };
}

function topo(s: GameState) {
  return getTopology(s.board);
}

/** Überspringt die Aufbauphase: `seat` ist in der angegebenen Phase am Zug. */
function toPhase(s: GameState, kind: 'roll' | 'main', seat = 0): GameState {
  s.phase = { kind };
  s.current = seat;
  s.turn = 1;
  s.dice = kind === 'main' ? [3, 4] : null;
  return s;
}

function give(s: GameState, seat: number, r: Partial<ResourceCounts>): void {
  s.players[seat].resources = res(r);
  // Bank so anpassen, dass die Gesamtsumme der Rohstoffe stimmt
  for (const k of RESOURCES) {
    s.bank[k] = bankSize(getTopology(s.board).hexes.length) - s.players.reduce((sum, p) => sum + p.resources[k], 0);
  }
}

function settle(s: GameState, seat: number, vertex: number, type: 'settlement' | 'city' = 'settlement'): void {
  s.buildings[vertex] = { owner: seat, type };
}

/** Stellt den Zufallsgenerator so, dass der nächste Wurf `sum` ergibt. */
function setDice(s: GameState, sum: number): void {
  for (let seed = 1; ; seed++) {
    const r = { rng: seed };
    if (randomInt(r, 6) + randomInt(r, 6) + 2 === sum) {
      s.rng = seed;
      return;
    }
  }
}

function act(s: GameState, seat: number, action: Action): GameState {
  return applyAction(s, seat, action);
}

function expectFail(s: GameState, seat: number, action: Action, message?: RegExp): void {
  let error: unknown;
  try {
    applyAction(s, seat, action);
  } catch (e) {
    error = e;
  }
  expect(error, `${action.type} hätte scheitern sollen`).toBeInstanceOf(RuleError);
  if (message) expect((error as Error).message).toMatch(message);
}

function totalOf(s: GameState, k: keyof ResourceCounts): number {
  return s.bank[k] + s.players.reduce((sum, p) => sum + p.resources[k], 0);
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Ecken und Kanten des mittleren Felds: Ring c0–c5, Kante ring[k] verbindet c[k] und c[k+1]. */
function centerRing(s: GameState) {
  const h = topo(s).hexes[CENTER];
  return { c: h.corners, ring: h.edges };
}

/** Die nach außen führende Kante einer Ecke des mittleren Felds. */
function outward(s: GameState, vertex: number): number {
  const { ring } = centerRing(s);
  return topo(s).vertices[vertex].edges.find((e) => !ring.includes(e))!;
}

function sharedVertex(s: GameState, e1: number, e2: number): number {
  const a = topo(s).edges[e1];
  const b = topo(s).edges[e2];
  return [a.a, a.b].find((v) => v === b.a || v === b.b)!;
}

// ---------------------------------------------------------------------------

describe('createGame', () => {
  it('verlangt 2 bis 6 Spieler', () => {
    expect(() => game(1)).toThrow(RuleError);
    expect(() => game(7)).toThrow(RuleError);
    expect(() => game(2)).not.toThrow();
    expect(() => game(6)).not.toThrow();
  });

  it('Basis für 2–4, Erweiterung für 5–6 Spieler', () => {
    for (const [n, layout, bank, deck] of [
      [2, 'base', 19, 25],
      [4, 'base', 19, 25],
      [5, 'ext', 24, 34],
      [6, 'ext', 24, 34],
    ] as const) {
      const s = game(n);
      expect(s.board.layout).toBe(layout);
      for (const r of RESOURCES) expect(s.bank[r]).toBe(bank);
      expect(s.devDeck.length).toBe(deck);
      expect(s.buildings.length).toBe(topo(s).vertices.length);
      expect(s.roads.length).toBe(topo(s).edges.length);
      expect(s.board.hexes[s.robber].terrain).toBe('desert');
    }
  });

  it('Entwicklungskarten-Stapel hat die richtige Zusammensetzung', () => {
    const count = (deck: DevCard[], c: DevCard) => deck.filter((d) => d === c).length;
    const base = game(4).devDeck;
    expect([count(base, 'knight'), count(base, 'roadBuilding'), count(base, 'yearOfPlenty'), count(base, 'monopoly'), count(base, 'victoryPoint')]).toEqual([14, 2, 2, 2, 5]);
    const ext = game(6).devDeck;
    expect([count(ext, 'knight'), count(ext, 'roadBuilding'), count(ext, 'yearOfPlenty'), count(ext, 'monopoly'), count(ext, 'victoryPoint')]).toEqual([20, 3, 3, 3, 5]);
  });

  it('lost die Sitzreihenfolge aus, deterministisch je Seed', () => {
    const s = game(6, 7);
    expect(s.players.map((p) => p.id).sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(game(6, 7)).toEqual(s);
  });

  it('startet in der Aufbauphase mit leeren Händen', () => {
    const s = game(3);
    expect(s.phase).toMatchObject({ kind: 'setup', index: 0, step: 'settlement' });
    expect(s.current).toBe(0);
    for (const p of s.players) expect(totalResources(p.resources)).toBe(0);
  });
});

describe('applyAction allgemein', () => {
  it('lehnt unbekannte Spieler und Aktionen ab', () => {
    const s = game();
    expectFail(s, 9, { type: 'placeSettlement', vertex: 0 }, /Unbekannter Spieler/);
    expectFail(s, 0, { type: 'fly' } as unknown as Action, /Unbekannte Aktion/);
  });

  it('erhöht die Version', () => {
    const s = game();
    const v = legalSetupVertices(s)[0];
    expect(act(s, 0, { type: 'placeSettlement', vertex: v }).version).toBe(s.version + 1);
  });
});

describe('Aufbauphase', () => {
  function playSetup(s: GameState) {
    const seats: number[] = [];
    while (s.phase.kind === 'setup') {
      const seat = actingSeats(s)[0];
      expect(s.current).toBe(seat);
      seats.push(seat);
      // Ecke mit möglichst vielen Feldern wählen, damit es Starterrohstoffe gibt
      const vertex = legalSetupVertices(s).sort((a, b) => topo(s).vertices[b].hexes.length - topo(s).vertices[a].hexes.length)[0];
      const before = { ...s.players[seat].resources };
      const secondRound = s.phase.index >= s.players.length;
      s = act(s, seat, { type: 'placeSettlement', vertex });
      const gained = RESOURCES.map((r) => s.players[seat].resources[r] - before[r]);
      const expected = RESOURCES.map(
        (r) => topo(s).vertices[vertex].hexes.filter((h) => s.board.hexes[h].terrain === r).length,
      );
      expect(gained).toEqual(secondRound ? expected : [0, 0, 0, 0, 0]);
      s = act(s, seat, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    }
    return { s, seats };
  }

  it('läuft in Schlangenreihenfolge, die zweite Siedlung bringt Rohstoffe', () => {
    const { s, seats } = playSetup(game(4, 3));
    expect(seats).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.current).toBe(0);
    expect(s.turn).toBe(1);
    for (let i = 0; i < 4; i++) {
      expect(s.buildings.filter((b) => b?.owner === i).length).toBe(2);
      expect(s.roads.filter((r) => r === i).length).toBe(2);
      expect(victoryPoints(s, i, true)).toBe(2);
    }
    for (const r of RESOURCES) expect(totalOf(s, r)).toBe(19);
  });

  it('Schlangenreihenfolge auch für 2 und 6 Spieler', () => {
    expect(playSetup(game(2, 5)).seats).toEqual([0, 1, 1, 0]);
    expect(playSetup(game(6, 5)).seats).toEqual([0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]);
  });

  it('prüft Reihenfolge, Schritt und Abstandsregel', () => {
    let s = game(3);
    const v = topo(s).hexes[CENTER].corners[0];
    expectFail(s, 1, { type: 'placeSettlement', vertex: v }, /nicht dran/);
    expectFail(s, 0, { type: 'placeRoad', edge: 0 }, /keine Straße/);
    s = act(s, 0, { type: 'placeSettlement', vertex: v });
    expectFail(s, 0, { type: 'placeSettlement', vertex: topo(s).hexes[CENTER].corners[3] }, /keine Siedlung/);
    // Straße muss an die neue Siedlung grenzen
    const farEdge = topo(s).edges.find((e) => e.a !== v && e.b !== v)!.id;
    expectFail(s, 0, { type: 'placeRoad', edge: farEdge }, /grenzen/);
    expectFail(s, 0, { type: 'placeRoad', edge: 9999 });
    s = act(s, 0, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    // Abstandsregel: Nachbarecke und dieselbe Ecke sind verboten
    for (const n of [v, ...topo(s).vertices[v].neighbors]) {
      expect(legalSetupVertices(s)).not.toContain(n);
      expectFail(s, 1, { type: 'placeSettlement', vertex: n }, /keine Siedlung/);
    }
    expectFail(s, 1, { type: 'placeSettlement', vertex: -1 });
    const twoAway = topo(s).hexes[CENTER].corners[2];
    expect(act(s, 1, { type: 'placeSettlement', vertex: twoAway }).buildings[twoAway]).toEqual({ owner: 1, type: 'settlement' });
  });

  it('zweite Straße muss an die zweite Siedlung grenzen', () => {
    let s = game(2);
    const { c, ring } = centerRing(s);
    s = act(s, 0, { type: 'placeSettlement', vertex: c[0] });
    s = act(s, 0, { type: 'placeRoad', edge: ring[0] });
    const far = legalSetupVertices(s).find((v) => !topo(s).vertices[v].hexes.includes(CENTER))!;
    s = act(s, 1, { type: 'placeSettlement', vertex: far });
    s = act(s, 1, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    s = act(s, 1, { type: 'placeSettlement', vertex: legalSetupVertices(s)[0] });
    s = act(s, 1, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    s = act(s, 0, { type: 'placeSettlement', vertex: c[3] });
    expectFail(s, 0, { type: 'placeRoad', edge: ring[5] }, /grenzen/);
    expect(legalSetupRoads(s).sort()).toEqual(topo(s).vertices[c[3]].edges.filter((e) => s.roads[e] === null).sort());
  });

  it('erste Siedlung bringt nichts, keine anderen Aktionen in der Aufbauphase', () => {
    const s = game();
    expectFail(s, 0, { type: 'roll' });
    expectFail(s, 0, { type: 'endTurn' });
    expectFail(s, 0, { type: 'buyDevCard' });
  });
});

describe('Würfeln und Ertrag', () => {
  function productionGame() {
    const s = toPhase(game(4), 'roll');
    s.board.hexes.forEach((h, i) => (h.number = i === CENTER ? 8 : null));
    s.board.hexes[CENTER].terrain = 'wheat';
    s.robber = 0;
    const { c } = centerRing(s);
    settle(s, 0, c[0]);
    settle(s, 1, c[2], 'city');
    settle(s, 0, c[4]);
    setDice(s, 8);
    return s;
  }

  it('Siedlung bringt 1, Stadt 2', () => {
    const s = productionGame();
    const n = act(s, 0, { type: 'roll' });
    expect(n.dice![0] + n.dice![1]).toBe(8);
    expect(n.phase).toEqual({ kind: 'main' });
    expect(n.players[0].resources).toEqual(res({ wheat: 2 }));
    expect(n.players[1].resources).toEqual(res({ wheat: 2 }));
    expect(n.bank.wheat).toBe(15);
  });

  it('Räuber blockiert das Feld', () => {
    const s = productionGame();
    s.robber = CENTER;
    const n = act(s, 0, { type: 'roll' });
    expect(n.players[0].resources).toEqual(res());
    expect(n.players[1].resources).toEqual(res());
  });

  it('Bank zu knapp für mehrere: niemand bekommt etwas', () => {
    const s = productionGame();
    s.bank.wheat = 3;
    const n = act(s, 0, { type: 'roll' });
    expect(n.players[0].resources.wheat).toBe(0);
    expect(n.players[1].resources.wheat).toBe(0);
    expect(n.bank.wheat).toBe(3);
  });

  it('Bank zu knapp für einen einzigen Empfänger: er bekommt den Rest', () => {
    const s = productionGame();
    s.buildings[centerRing(s).c[2]] = null;
    s.bank.wheat = 1;
    const n = act(s, 0, { type: 'roll' });
    expect(n.players[0].resources.wheat).toBe(1);
    expect(n.bank.wheat).toBe(0);
  });

  it('nur der aktive Spieler würfelt, und nur einmal', () => {
    const s = productionGame();
    expectFail(s, 1, { type: 'roll' }, /nicht dran/);
    const n = act(s, 0, { type: 'roll' });
    expectFail(n, 0, { type: 'roll' }, /nicht gewürfelt/);
  });

  it('vor dem Würfeln wird nicht gebaut, gehandelt oder beendet', () => {
    const s = toPhase(game(), 'roll');
    give(s, 0, { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 });
    expectFail(s, 0, { type: 'buyDevCard' });
    expectFail(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 1 }), want: res({ ore: 1 }) });
    expectFail(s, 0, { type: 'endTurn' });
  });
});

describe('Räuber bei einer 7', () => {
  function sevenGame() {
    const s = toPhase(game(4), 'roll');
    give(s, 0, { wood: 9 });
    give(s, 1, { ore: 7 });
    give(s, 2, { wheat: 5, sheep: 6 });
    setDice(s, 7);
    return s;
  }

  it('wer mehr als 7 Karten hat, wirft die Hälfte ab, dann Räuber, dann Ziehen', () => {
    let s = sevenGame();
    s = act(s, 0, { type: 'roll' });
    expect(s.phase).toEqual({ kind: 'discard', pending: [4, 0, 5, 0] });
    expect(actingSeats(s)).toEqual([0, 2]);
    // keine Erträge bei 7
    expect(s.players[1].resources).toEqual(res({ ore: 7 }));

    expectFail(s, 1, { type: 'discard', resources: res({ ore: 3 }) }, /nichts abwerfen/);
    expectFail(s, 0, { type: 'discard', resources: res({ wood: 3 }) }, /genau 4/);
    expectFail(s, 0, { type: 'discard', resources: res({ ore: 4 }) }, /So viele/);
    expectFail(s, 0, { type: 'discard', resources: res({ wood: -1, ore: 5 }) }, /Ungültige/);
    expectFail(s, 0, { type: 'moveRobber', hex: 1, victim: null }, /nicht versetzt/);
    expectFail(s, 0, { type: 'endTurn' });

    s = act(s, 0, { type: 'discard', resources: res({ wood: 4 }) });
    expect(s.players[0].resources).toEqual(res({ wood: 5 }));
    expect(s.bank.wood).toBe(19 - 5);
    expect(s.phase.kind).toBe('discard');
    expectFail(s, 0, { type: 'discard', resources: res({ wood: 4 }) }, /nichts abwerfen/);
    s = act(s, 2, { type: 'discard', resources: res({ wheat: 3, sheep: 2 }) });
    expect(s.players[2].resources).toEqual(res({ wheat: 2, sheep: 4 }));
    expect(s.phase).toEqual({ kind: 'robber', returnTo: 'main' });
    expect(actingSeats(s)).toEqual([0]);

    const target = s.robber === CENTER ? 0 : CENTER;
    const { c } = topo(s).hexes[target] ? { c: topo(s).hexes[target].corners } : { c: [] };
    settle(s, 1, c[0]);
    settle(s, 3, c[2]); // Spieler 3 hat keine Karten
    settle(s, 0, c[4]);
    expect(robberVictims(s, 0, target)).toEqual([1]);

    expectFail(s, 1, { type: 'moveRobber', hex: target, victim: 0 }, /nicht dran/);
    expectFail(s, 0, { type: 'moveRobber', hex: s.robber, victim: null }, /anderes Feld/);
    expectFail(s, 0, { type: 'moveRobber', hex: 99, victim: null }, /Unbekanntes Feld/);
    expectFail(s, 0, { type: 'moveRobber', hex: target, victim: null }, /Wähle/);
    expectFail(s, 0, { type: 'moveRobber', hex: target, victim: 3 }, /Wähle/);
    expectFail(s, 0, { type: 'moveRobber', hex: target, victim: 2 }, /Wähle/);

    s = act(s, 0, { type: 'moveRobber', hex: target, victim: 1 });
    expect(s.robber).toBe(target);
    expect(s.players[1].resources).toEqual(res({ ore: 6 }));
    expect(s.players[0].resources).toEqual(res({ wood: 5, ore: 1 }));
    expect(s.phase).toEqual({ kind: 'main' });
    for (const r of RESOURCES) expect(totalOf(s, r)).toBe(19);
  });

  it('ohne Abwerfen direkt zum Räuber, Feld ohne Gegner braucht kein Opfer', () => {
    let s = toPhase(game(4), 'roll');
    give(s, 1, { ore: 7 });
    setDice(s, 7);
    s = act(s, 0, { type: 'roll' });
    expect(s.phase).toEqual({ kind: 'robber', returnTo: 'main' });
    const target = s.robber === 0 ? 1 : 0;
    s = act(s, 0, { type: 'moveRobber', hex: target, victim: null });
    expect(s.robber).toBe(target);
    expect(s.phase).toEqual({ kind: 'main' });
  });
});

describe('Bauen', () => {
  function buildGame() {
    const s = toPhase(game(4), 'main');
    const { c, ring } = centerRing(s);
    settle(s, 0, c[0]);
    return { s, c, ring };
  }

  it('Straße kostet Holz und Lehm und muss anschließen', () => {
    const { s, c, ring } = buildGame();
    give(s, 0, COSTS.road);
    expectFail(s, 0, { type: 'buildRoad', edge: ring[2] }, /keine Straße/);
    expectFail(s, 1, { type: 'buildRoad', edge: ring[0] }, /nicht dran/);
    const n = act(s, 0, { type: 'buildRoad', edge: ring[0] });
    expect(n.roads[ring[0]]).toBe(0);
    expect(n.players[0].resources).toEqual(res());
    expect(n.bank.wood).toBe(19);
    expectFail(n, 0, { type: 'buildRoad', edge: ring[1] }, /fehlen/);
    give(n, 0, COSTS.road);
    expectFail(n, 0, { type: 'buildRoad', edge: ring[0] }, /keine Straße/);
    expect(legalRoadEdges(n, 0)).toContain(ring[1]);
    expect(legalRoadEdges(n, 0)).toContain(outward(n, c[1]));
  });

  it('Straßen führen nicht durch fremde Siedlungen', () => {
    const { s, c, ring } = buildGame();
    s.roads[ring[0]] = 0;
    give(s, 0, COSTS.road);
    expect(legalRoadEdges(s, 0)).toContain(ring[1]);
    settle(s, 1, c[1]);
    expect(legalRoadEdges(s, 0)).not.toContain(ring[1]);
    expect(legalRoadEdges(s, 0)).not.toContain(outward(s, c[1]));
    expectFail(s, 0, { type: 'buildRoad', edge: ring[1] }, /keine Straße/);
    // an der eigenen Siedlung geht es weiter
    expect(act(s, 0, { type: 'buildRoad', edge: ring[5] }).roads[ring[5]]).toBe(0);
  });

  it('Siedlung braucht eigene Straße und Abstand', () => {
    const { s, c, ring } = buildGame();
    give(s, 0, COSTS.settlement);
    expectFail(s, 0, { type: 'buildSettlement', vertex: c[2] }, /keine Siedlung/);
    s.roads[ring[0]] = 0;
    // c[1] verletzt die Abstandsregel
    expectFail(s, 0, { type: 'buildSettlement', vertex: c[1] }, /keine Siedlung/);
    expectFail(s, 0, { type: 'buildSettlement', vertex: c[2] }, /keine Siedlung/);
    s.roads[ring[1]] = 0;
    expect(legalSettlementVertices(s, 0)).toEqual([c[2]]);
    // fremde Straße reicht nicht
    s.roads[ring[1]] = 1;
    expectFail(s, 0, { type: 'buildSettlement', vertex: c[2] }, /keine Siedlung/);
    s.roads[ring[1]] = 0;
    const n = act(s, 0, { type: 'buildSettlement', vertex: c[2] });
    expect(n.buildings[c[2]]).toEqual({ owner: 0, type: 'settlement' });
    expect(n.players[0].resources).toEqual(res());
    expect(victoryPoints(n, 0, false)).toBe(2);
  });

  it('Stadt nur auf eigener Siedlung', () => {
    const { s, c } = buildGame();
    settle(s, 1, c[3]);
    give(s, 0, { wheat: 2, ore: 3 });
    expectFail(s, 0, { type: 'buildCity', vertex: c[3] }, /eigene Siedlungen/);
    expectFail(s, 0, { type: 'buildCity', vertex: c[2] }, /eigene Siedlungen/);
    expect(legalCityVertices(s, 0)).toEqual([c[0]]);
    const n = act(s, 0, { type: 'buildCity', vertex: c[0] });
    expect(n.buildings[c[0]]).toEqual({ owner: 0, type: 'city' });
    expect(n.players[0].resources).toEqual(res());
    expect(victoryPoints(n, 0, false)).toBe(2);
    give(n, 0, { wheat: 2, ore: 3 });
    expectFail(n, 0, { type: 'buildCity', vertex: c[0] }, /eigene Siedlungen/);
    give(n, 0, { wheat: 1, ore: 3 });
    settle(n, 0, c[2]);
    expectFail(n, 0, { type: 'buildCity', vertex: c[2] }, /fehlen/);
  });

  it('Entwicklungskarte kaufen', () => {
    const { s } = buildGame();
    give(s, 0, COSTS.devCard);
    const top = s.devDeck[s.devDeck.length - 1];
    const n = act(s, 0, { type: 'buyDevCard' });
    expect(n.players[0].newDevCards).toEqual([top]);
    expect(n.players[0].devCards).toEqual([]);
    expect(n.devDeck.length).toBe(s.devDeck.length - 1);
    expect(n.players[0].resources).toEqual(res());
    expectFail(n, 0, { type: 'buyDevCard' }, /fehlen/);
    give(n, 0, COSTS.devCard);
    n.devDeck = [];
    expectFail(n, 0, { type: 'buyDevCard' }, /keine Entwicklungskarten/);
  });

  it('Limits: 15 Straßen, 5 Siedlungen, 4 Städte', () => {
    const { s, c, ring } = buildGame();
    const t = topo(s);
    // 15 Straßen irgendwo
    let placed = 0;
    for (const e of t.edges) {
      if (placed === 15) break;
      if (e.id !== ring[0]) {
        s.roads[e.id] = 0;
        placed++;
      }
    }
    expect(piecesLeft(s, 0, 'road')).toBe(0);
    give(s, 0, COSTS.road);
    expectFail(s, 0, { type: 'buildRoad', edge: ring[0] }, /keine Straßen mehr/);

    // 5 Siedlungen
    const s2 = buildGame().s;
    const far = t.vertices.filter((v) => !v.hexes.includes(CENTER)).map((v) => v.id);
    for (const v of far.slice(0, 4)) settle(s2, 0, v);
    expect(piecesLeft(s2, 0, 'settlement')).toBe(0);
    s2.roads[ring[0]] = 0;
    s2.roads[ring[1]] = 0;
    give(s2, 0, COSTS.settlement);
    expectFail(s2, 0, { type: 'buildSettlement', vertex: c[2] }, /keine Siedlungen mehr/);
    // Stadt gibt eine Siedlung zurück
    give(s2, 0, COSTS.city);
    const s3 = act(s2, 0, { type: 'buildCity', vertex: c[0] });
    expect(piecesLeft(s3, 0, 'settlement')).toBe(1);
    expect(piecesLeft(s3, 0, 'city')).toBe(3);

    // 4 Städte
    const s4 = buildGame().s;
    for (const v of far.slice(0, 4)) settle(s4, 0, v, 'city');
    give(s4, 0, COSTS.city);
    expect(piecesLeft(s4, 0, 'city')).toBe(0);
    expectFail(s4, 0, { type: 'buildCity', vertex: c[0] }, /keine Städte mehr/);
  });
});

describe('Entwicklungskarten', () => {
  it('nicht im Kaufzug spielbar, ab dem nächsten Zug schon', () => {
    let s = toPhase(game(2), 'main');
    give(s, 0, COSTS.devCard);
    s.devDeck.push('knight');
    s = act(s, 0, { type: 'buyDevCard' });
    expectFail(s, 0, { type: 'playKnight' }, /keine spielbare Karte/);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.players[0].devCards).toEqual(['knight']);
    expect(s.players[0].newDevCards).toEqual([]);
    expect(s.current).toBe(1);
    expectFail(s, 0, { type: 'playKnight' }, /nicht dran/);
    toPhase(s, 'roll', 0);
    s.devPlayed = false;
    expect(act(s, 0, { type: 'playKnight' }).phase).toEqual({ kind: 'robber', returnTo: 'roll' });
  });

  it('eine ältere Karte bleibt spielbar, auch wenn eine gleiche gekauft wurde', () => {
    let s = toPhase(game(), 'main');
    s.players[0].devCards = ['knight'];
    give(s, 0, COSTS.devCard);
    s.devDeck.push('knight');
    s = act(s, 0, { type: 'buyDevCard' });
    s = act(s, 0, { type: 'playKnight' });
    expect(s.players[0].devCards).toEqual([]);
    expect(s.players[0].newDevCards).toEqual(['knight']);
  });

  it('Siegpunktkarten zählen sofort, aber nur verdeckt', () => {
    let s = toPhase(game(), 'main');
    give(s, 0, COSTS.devCard);
    s.devDeck.push('victoryPoint');
    s = act(s, 0, { type: 'buyDevCard' });
    expect(victoryPoints(s, 0, true)).toBe(1);
    expect(victoryPoints(s, 0, false)).toBe(0);
  });

  it('nur eine Karte pro Zug', () => {
    let s = toPhase(game(), 'main');
    s.players[0].devCards = ['knight', 'monopoly', 'knight'];
    s = act(s, 0, { type: 'playKnight' });
    s = act(s, 0, { type: 'moveRobber', hex: s.robber === 0 ? 1 : 0, victim: null });
    expectFail(s, 0, { type: 'playMonopoly', resource: 'ore' }, /schon eine/);
    expectFail(s, 0, { type: 'playKnight' }, /schon eine/);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.devPlayed).toBe(false);
  });

  it('Ritter vor dem Würfeln führt zurück zum Würfeln', () => {
    let s = toPhase(game(), 'roll');
    s.players[0].devCards = ['knight', 'knight'];
    s = act(s, 0, { type: 'playKnight' });
    expect(s.phase).toEqual({ kind: 'robber', returnTo: 'roll' });
    expectFail(s, 0, { type: 'roll' });
    s = act(s, 0, { type: 'moveRobber', hex: s.robber === 0 ? 1 : 0, victim: null });
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.players[0].knights).toBe(1);
    expectFail(s, 0, { type: 'playKnight' }, /schon eine/);
    setDice(s, 6);
    expect(act(s, 0, { type: 'roll' }).phase).toEqual({ kind: 'main' });
  });

  it('Ritter nach dem Würfeln führt zurück in die Hauptphase', () => {
    let s = toPhase(game(), 'main');
    s.players[0].devCards = ['knight'];
    s = act(s, 0, { type: 'playKnight' });
    expect(s.phase).toEqual({ kind: 'robber', returnTo: 'main' });
    s = act(s, 0, { type: 'moveRobber', hex: s.robber === 0 ? 1 : 0, victim: null });
    expect(s.phase).toEqual({ kind: 'main' });
  });

  it('keine Karten während Abwerfen, Räuber oder fremdem Zug', () => {
    const s = toPhase(game(), 'main');
    s.players[0].devCards = ['knight'];
    s.players[1].devCards = ['knight'];
    expectFail(s, 1, { type: 'playKnight' }, /nicht dran/);
    s.phase = { kind: 'robber', returnTo: 'main' };
    expectFail(s, 0, { type: 'playKnight' }, /keine Karte/);
    s.phase = { kind: 'discard', pending: [0, 4, 0, 0] };
    expectFail(s, 0, { type: 'playKnight' }, /keine Karte/);
  });

  it('Straßenbau: zwei kostenlose Straßen', () => {
    let s = toPhase(game(), 'main');
    const { c, ring } = centerRing(s);
    settle(s, 0, c[0]);
    s.players[0].devCards = ['roadBuilding'];
    s = act(s, 0, { type: 'playRoadBuilding' });
    expect(s.phase).toEqual({ kind: 'roadBuilding', remaining: 2, returnTo: 'main' });
    expect(s.players[0].devCards).toEqual([]);
    expectFail(s, 0, { type: 'endTurn' });
    expectFail(s, 1, { type: 'buildRoad', edge: ring[0] }, /nicht dran/);
    expectFail(s, 0, { type: 'buildRoad', edge: ring[2] }, /keine Straße/);
    s = act(s, 0, { type: 'buildRoad', edge: ring[0] });
    expect(s.phase).toEqual({ kind: 'roadBuilding', remaining: 1, returnTo: 'main' });
    s = act(s, 0, { type: 'buildRoad', edge: ring[1] });
    expect(s.phase).toEqual({ kind: 'main' });
    expect(s.players[0].resources).toEqual(res());
    expect(piecesLeft(s, 0, 'road')).toBe(13);
  });

  it('Straßenbau mit nur einer verbleibenden Straße oder ohne Bauplatz', () => {
    let s = toPhase(game(), 'main');
    const { c, ring } = centerRing(s);
    settle(s, 0, c[0]);
    const other = topo(s).edges.filter((e) => !topo(s).hexes[CENTER].corners.some((v) => v === e.a || v === e.b));
    other.slice(0, 14).forEach((e) => (s.roads[e.id] = 0));
    s.players[0].devCards = ['roadBuilding'];
    const one = act(s, 0, { type: 'playRoadBuilding' });
    expect(one.phase).toEqual({ kind: 'roadBuilding', remaining: 1, returnTo: 'main' });
    expect(act(one, 0, { type: 'buildRoad', edge: ring[0] }).phase).toEqual({ kind: 'main' });

    // keine Straße möglich: Karte bleibt auf der Hand
    s = toPhase(game(), 'main');
    s.players[0].devCards = ['roadBuilding'];
    expectFail(s, 0, { type: 'playRoadBuilding' }, /keine Straße/);
  });

  it('Erfindung: zwei Rohstoffe aus der Bank', () => {
    const s = toPhase(game(), 'main');
    s.players[0].devCards = ['yearOfPlenty'];
    const n = act(s, 0, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] });
    expect(n.players[0].resources).toEqual(res({ ore: 2 }));
    expect(n.bank.ore).toBe(17);
    const m = act(s, 0, { type: 'playYearOfPlenty', resources: ['wood', 'sheep'] });
    expect(m.players[0].resources).toEqual(res({ wood: 1, sheep: 1 }));

    s.bank.ore = 1;
    expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }, /Bank/);
    expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['gold', 'ore'] as never }, /Unbekannter/);
    expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['wood', 'wood', 'wood', 'wood'] as never });
    expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['wood'] as never });
    s.players[0].devCards = [];
    expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['wood', 'wood'] }, /keine spielbare/);
  });

  it('Monopol: alle anderen geben den Rohstoff ab', () => {
    const s = toPhase(game(), 'main');
    s.players[0].devCards = ['monopoly'];
    give(s, 0, { wheat: 1 });
    give(s, 1, { wheat: 3, ore: 2 });
    give(s, 3, { wheat: 2 });
    const n = act(s, 0, { type: 'playMonopoly', resource: 'wheat' });
    expect(n.players[0].resources).toEqual(res({ wheat: 6 }));
    expect(n.players[1].resources).toEqual(res({ ore: 2 }));
    expect(n.players[3].resources).toEqual(res());
    expectFail(s, 0, { type: 'playMonopoly', resource: 'gold' as never }, /Unbekannter/);
  });

  it('größte Rittermacht ab 3, Übernahme nur mit mehr Rittern', () => {
    let s = toPhase(game(), 'main');
    s.players[0].knights = 2;
    s.players[0].devCards = ['knight'];
    s = act(s, 0, { type: 'playKnight' });
    expect(s.largestArmy).toBe(0);
    expect(victoryPoints(s, 0, false)).toBe(2);

    // Gleichstand reicht nicht
    toPhase(s, 'main', 1);
    s.devPlayed = false;
    s.players[1].knights = 2;
    s.players[1].devCards = ['knight', 'knight'];
    s = act(s, 1, { type: 'playKnight' });
    expect(s.players[1].knights).toBe(3);
    expect(s.largestArmy).toBe(0);
    s = act(s, 1, { type: 'moveRobber', hex: s.robber === 0 ? 1 : 0, victim: null });
    s.devPlayed = false;
    s = act(s, 1, { type: 'playKnight' });
    expect(s.largestArmy).toBe(1);
    expect(victoryPoints(s, 0, false)).toBe(0);
    expect(victoryPoints(s, 1, false)).toBe(2);
  });

  it('zwei Ritter reichen nicht', () => {
    let s = toPhase(game(), 'main');
    s.players[0].knights = 1;
    s.players[0].devCards = ['knight'];
    s = act(s, 0, { type: 'playKnight' });
    expect(s.largestArmy).toBeNull();
  });
});

describe('Längste Handelsstraße', () => {
  /** Spieler 0: Siedlung c0, Straßen ring[0..count-1]. */
  function roadGame(count: number) {
    const s = toPhase(game(4), 'main');
    const { c, ring } = centerRing(s);
    settle(s, 0, c[0]);
    for (let i = 0; i < count; i++) s.roads[ring[i]] = 0;
    return { s, c, ring };
  }

  /** Straße der Länge `len` entlang der Küste für `seat`, beginnend bei Küstenkante `start`. */
  function coastRoad(s: GameState, seat: number, start: number, len: number): number[] {
    const edges = topo(s).coast.slice(start, start + len);
    for (const e of edges) s.roads[e] = seat;
    return edges;
  }

  it('longestRoad zählt Wege, Ringe und Verzweigungen', () => {
    const { s, c, ring } = roadGame(4);
    expect(longestRoad(s, 0)).toBe(4);
    s.roads[outward(s, c[2])] = 0;
    expect(longestRoad(s, 0)).toBe(4);
    s.roads[ring[4]] = 0;
    s.roads[ring[5]] = 0;
    // Ring aus 6 plus Abzweig: 7
    expect(longestRoad(s, 0)).toBe(7);
    expect(longestRoad(s, 1)).toBe(0);
  });

  it('eigene Siedlung unterbricht nicht, fremde schon', () => {
    const { s, c } = roadGame(5);
    settle(s, 0, c[2]);
    expect(longestRoad(s, 0)).toBe(5);
    settle(s, 1, c[2]);
    expect(longestRoad(s, 0)).toBe(3);
  });

  it('ab 5 Straßen gibt es 2 Siegpunkte', () => {
    const { s, ring } = roadGame(4);
    give(s, 0, COSTS.road);
    const n = act(s, 0, { type: 'buildRoad', edge: ring[4] });
    expect(n.roadLengths[0]).toBe(5);
    expect(n.longestRoad).toBe(0);
    expect(victoryPoints(n, 0, false)).toBe(3);
  });

  it('Gleichstand: Inhaber behält, Übernahme nur mit längerer Straße', () => {
    let { s, ring } = roadGame(4);
    give(s, 0, COSTS.road);
    s = act(s, 0, { type: 'buildRoad', edge: ring[4] });
    const edges = coastRoad(s, 1, 0, 4);
    const next = topo(s).coast[4];
    toPhase(s, 'main', 1);
    give(s, 1, COSTS.road);
    s = act(s, 1, { type: 'buildRoad', edge: next });
    expect(s.roadLengths[1]).toBe(5);
    expect(s.longestRoad).toBe(0);
    give(s, 1, COSTS.road);
    s = act(s, 1, { type: 'buildRoad', edge: topo(s).coast[5] });
    expect(s.roadLengths[1]).toBe(6);
    expect(s.longestRoad).toBe(1);
    expect(edges.length).toBe(4);
  });

  it('gleichzeitig erreichte 5 ohne Inhaber: niemand bekommt sie', () => {
    let { s, ring } = roadGame(5);
    coastRoad(s, 1, 0, 5);
    // beide haben 5, aber noch keiner hat die Karte (direkt gesetzt)
    give(s, 0, COSTS.devCard);
    s = act(s, 0, { type: 'buyDevCard' });
    expect(s.longestRoad).toBeNull();
    expect(ring.length).toBe(6);
  });

  function breakGame() {
    let { s, c, ring } = roadGame(4);
    give(s, 0, COSTS.road);
    s = act(s, 0, { type: 'buildRoad', edge: ring[4] });
    expect(s.longestRoad).toBe(0);
    // Spieler 1 baut eine Siedlung mitten in die Straße (Ecke c2)
    s.roads[outward(s, c[2])] = 1;
    toPhase(s, 'main', 1);
    give(s, 1, COSTS.settlement);
    return { s, c };
  }

  it('durch Siedlung unterbrochen: unter 5 ist die Karte weg', () => {
    const { s, c } = breakGame();
    const n = act(s, 1, { type: 'buildSettlement', vertex: c[2] });
    expect(n.roadLengths[0]).toBe(3);
    expect(n.longestRoad).toBeNull();
  });

  it('durch Siedlung unterbrochen: ein anderer mit der längsten bekommt sie', () => {
    const { s, c } = breakGame();
    coastRoad(s, 2, 0, 5);
    const n = act(s, 1, { type: 'buildSettlement', vertex: c[2] });
    expect(n.longestRoad).toBe(2);
  });

  it('durch Siedlung unterbrochen: Gleichstand anderer legt die Karte beiseite', () => {
    const { s, c } = breakGame();
    coastRoad(s, 2, 0, 5);
    coastRoad(s, 3, 15, 5);
    const n = act(s, 1, { type: 'buildSettlement', vertex: c[2] });
    expect(n.roadLengths[2]).toBe(5);
    expect(n.roadLengths[3]).toBe(5);
    expect(n.longestRoad).toBeNull();
  });

  it('durch Siedlung unterbrochen, aber noch gleichauf: Inhaber behält', () => {
    // Spieler 0 hat 6 (Ring 0..4 + Abzweig an c0), Spieler 2 hat 5; Bruch bei c4 lässt 0 mit 5
    let { s, c, ring } = roadGame(4);
    s.roads[outward(s, c[0])] = 0;
    give(s, 0, COSTS.road);
    s = act(s, 0, { type: 'buildRoad', edge: ring[4] });
    expect(s.roadLengths[0]).toBe(6);
    coastRoad(s, 2, 0, 5);
    s.roads[outward(s, c[4])] = 1;
    toPhase(s, 'main', 1);
    give(s, 1, COSTS.settlement);
    const n = act(s, 1, { type: 'buildSettlement', vertex: c[4] });
    expect(n.roadLengths[0]).toBe(5);
    expect(n.roadLengths[2]).toBe(5);
    expect(n.longestRoad).toBe(0);
    expect(sharedVertex(n, ring[3], ring[4])).toBe(c[4]);
  });
});

describe('Handel mit der Bank', () => {
  it('4:1 ohne Hafen', () => {
    const s = toPhase(game(), 'main');
    give(s, 0, { wood: 4 });
    expect(tradeRate(s, 0, 'wood')).toBe(4);
    const n = act(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expect(n.players[0].resources).toEqual(res({ ore: 1 }));
    expect(n.bank.wood).toBe(19);
    expect(n.bank.ore).toBe(18);
    give(s, 0, { wood: 3 });
    expectFail(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' }, /brauchst 4/);
  });

  it('3:1 und 2:1 über Häfen', () => {
    const s = toPhase(game(), 'main');
    const t = topo(s);
    const [e1, e2] = s.board.harbors.map((h) => h.edge);
    s.board.harbors = [
      { type: 'any', edge: e1 },
      { type: 'wood', edge: e2 },
    ];
    settle(s, 1, t.edges[e1].a);
    expect(tradeRate(s, 0, 'brick')).toBe(4);
    settle(s, 0, t.edges[e1].a, 'city');
    expect(tradeRate(s, 0, 'brick')).toBe(3);
    expect(tradeRate(s, 0, 'wood')).toBe(3);
    settle(s, 0, t.edges[e2].b);
    expect(tradeRate(s, 0, 'wood')).toBe(2);
    expect(tradeRate(s, 0, 'brick')).toBe(3);
    give(s, 0, { wood: 2, brick: 3 });
    let n = act(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    n = act(n, 0, { type: 'bankTrade', give: 'brick', get: 'ore' });
    expect(n.players[0].resources).toEqual(res({ ore: 2 }));
  });

  it('ungültige Tausche', () => {
    const s = toPhase(game(), 'main');
    give(s, 0, { wood: 4 });
    expectFail(s, 0, { type: 'bankTrade', give: 'wood', get: 'wood' }, /Ungültiger/);
    expectFail(s, 0, { type: 'bankTrade', give: 'gold' as never, get: 'wood' }, /Ungültiger/);
    expectFail(s, 1, { type: 'bankTrade', give: 'wood', get: 'ore' }, /nicht dran/);
    s.bank.ore = 0;
    expectFail(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' }, /kein Erz/);
  });

  it('mehrere Pakete auf einmal, ganz oder gar nicht', () => {
    const s = toPhase(game(), 'main');
    give(s, 0, { wood: 8 });
    const n = act(s, 0, { type: 'bankTradeBatch', give: res({ wood: 8 }), get: res({ ore: 1, wheat: 1 }) });
    expect(n.players[0].resources).toEqual(res({ ore: 1, wheat: 1 }));
    expect(n.version).toBe(s.version + 1);
    expectFail(s, 0, { type: 'bankTradeBatch', give: res({ wood: 6 }), get: res({ ore: 1 }) }, /4:1/);
    expectFail(s, 0, { type: 'bankTradeBatch', give: res({ wood: 8 }), get: res({ ore: 1 }) }, /Kurs/);
    expectFail(s, 0, { type: 'bankTradeBatch', give: res({ wood: 4 }), get: res({ wood: 1 }) }, /beiden Seiten/);
    // Fehlt der Bank die zweite Karte, wird auch die erste nicht getauscht.
    s.bank.wheat = 0;
    expectFail(s, 0, { type: 'bankTradeBatch', give: res({ wood: 8 }), get: res({ ore: 1, wheat: 1 }) }, /kein Getreide/);
    expect(s.players[0].resources).toEqual(res({ wood: 8 }));
  });
});

describe('Handel unter Spielern', () => {
  function tradeGame() {
    const s = toPhase(game(4), 'main');
    give(s, 0, { wood: 2 });
    give(s, 1, { ore: 1 });
    give(s, 2, { sheep: 3 });
    return s;
  }

  it('Angebot, Annehmen, Abschließen', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    expect(s.offers).toHaveLength(1);
    const offer = s.offers[0];
    expect(offer).toMatchObject({ from: 0, counter: false, accepted: [], declined: [] });

    expectFail(s, 2, { type: 'respondTrade', offerId: offer.id, accept: true }, /fehlen/);
    expectFail(s, 0, { type: 'respondTrade', offerId: offer.id, accept: true }, /eigenes/);
    expectFail(s, 1, { type: 'respondTrade', offerId: 999, accept: true }, /nicht mehr/);
    s = act(s, 2, { type: 'respondTrade', offerId: offer.id, accept: false });
    s = act(s, 1, { type: 'respondTrade', offerId: offer.id, accept: true });
    expect(s.offers[0].accepted).toEqual([1]);
    expect(s.offers[0].declined).toEqual([2]);
    // Meinung ändern
    s = act(s, 2, { type: 'respondTrade', offerId: offer.id, accept: false });
    expect(s.offers[0].declined).toEqual([2]);

    expectFail(s, 0, { type: 'confirmTrade', offerId: offer.id, partner: 2 }, /nicht angenommen/);
    expectFail(s, 0, { type: 'confirmTrade', offerId: offer.id, partner: 3 }, /nicht angenommen/);
    expectFail(s, 1, { type: 'confirmTrade', offerId: offer.id, partner: 1 }, /aktive Spieler/);
    s = act(s, 0, { type: 'confirmTrade', offerId: offer.id, partner: 1 });
    expect(s.players[0].resources).toEqual(res({ ore: 1 }));
    expect(s.players[1].resources).toEqual(res({ wood: 2 }));
    expect(s.offers).toEqual([]);
  });

  it('Abschluss scheitert, wenn Rohstoffe inzwischen fehlen', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    const id = s.offers[0].id;
    s = act(s, 1, { type: 'respondTrade', offerId: id, accept: true });
    s.players[1].resources.ore = 0;
    expectFail(s, 0, { type: 'confirmTrade', offerId: id, partner: 1 }, /fehlen/);
    s.players[1].resources.ore = 1;
    s.players[0].resources.wood = 1;
    expectFail(s, 0, { type: 'confirmTrade', offerId: id, partner: 1 }, /fehlen/);
  });

  it('ungültige Angebote', () => {
    const s = tradeGame();
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 3 }), want: res({ ore: 1 }) }, /nicht/);
    expectFail(s, 0, { type: 'offerTrade', give: res(), want: res({ ore: 1 }) }, /beide Seiten/);
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 1 }), want: res() }, /beide Seiten/);
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 1 }), want: res({ wood: 1, ore: 1 }) }, /beiden Seiten/);
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 1.5 }), want: res({ ore: 1 }) }, /Ungültige/);
    toPhase(s, 'roll');
    expectFail(s, 0, { type: 'offerTrade', give: res({ wood: 1 }), want: res({ ore: 1 }) }, /nach dem Würfeln/);
  });

  it('neues Angebot ersetzt das alte, Zugende löscht alle', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 1 }), want: res({ sheep: 1 }) });
    expect(s.offers).toHaveLength(1);
    expect(s.offers[0].give).toEqual(res({ wood: 1 }));
    s = act(s, 1, { type: 'offerTrade', give: res({ ore: 1 }), want: res({ wood: 1 }) });
    expect(s.offers).toHaveLength(2);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.offers).toEqual([]);
  });

  it('Gegenangebot an den aktiven Spieler', () => {
    let s = tradeGame();
    s = act(s, 1, { type: 'offerTrade', give: res({ ore: 1 }), want: res({ wood: 1 }) });
    const counter = s.offers[0];
    expect(counter).toMatchObject({ from: 1, counter: true });
    // andere Mitspieler können Gegenangebote nicht annehmen
    expectFail(s, 2, { type: 'respondTrade', offerId: counter.id, accept: true }, /nicht mehr/);
    expectFail(s, 2, { type: 'confirmTrade', offerId: counter.id, partner: 1 }, /aktive Spieler/);
    expectFail(s, 0, { type: 'confirmTrade', offerId: counter.id, partner: 2 }, /nicht angenommen/);
    s = act(s, 0, { type: 'confirmTrade', offerId: counter.id, partner: 1 });
    expect(s.players[0].resources).toEqual(res({ wood: 1, ore: 1 }));
    expect(s.players[1].resources).toEqual(res({ wood: 1 }));
    expect(s.offers).toEqual([]);
  });

  it('Zurückziehen und Ablehnen von Gegenangeboten', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    s = act(s, 1, { type: 'offerTrade', give: res({ ore: 1 }), want: res({ wood: 1 }) });
    const [own, counter] = s.offers;
    expectFail(s, 2, { type: 'cancelTrade', offerId: own.id }, /nicht dein/);
    expectFail(s, 2, { type: 'cancelTrade', offerId: counter.id }, /nicht dein/);
    s = act(s, 0, { type: 'cancelTrade', offerId: counter.id });
    s = act(s, 0, { type: 'cancelTrade', offerId: own.id });
    expect(s.offers).toEqual([]);
    // unbekanntes Angebot: nichts passiert, auch keine neue Version
    expect(act(s, 0, { type: 'cancelTrade', offerId: 12345 })).toBe(s);
  });

  it('Alles zurückziehen mit einer Aktion', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    s = act(s, 1, { type: 'offerTrade', give: res({ ore: 1 }), want: res({ wood: 1 }) });
    s = act(s, 2, { type: 'offerTrade', give: res({ sheep: 1 }), want: res({ wood: 1 }) });
    // Ein Mitspieler zieht nur sein eigenes Gegenangebot zurück.
    const afterOne = act(s, 2, { type: 'withdrawOffers' });
    expect(afterOne.offers.map((o) => o.from)).toEqual([0, 1]);
    // Wer am Zug ist, räumt alles ab.
    const cleared = act(s, 0, { type: 'withdrawOffers' });
    expect(cleared.offers).toEqual([]);
    expect(act(cleared, 0, { type: 'withdrawOffers' })).toBe(cleared);
  });

  it('ein Abschluss lässt alle übrigen Angebote verfallen', () => {
    let s = tradeGame();
    s = act(s, 0, { type: 'offerTrade', give: res({ wood: 2 }), want: res({ ore: 1 }) });
    s = act(s, 2, { type: 'offerTrade', give: res({ sheep: 1 }), want: res({ wood: 1 }) });
    s = act(s, 1, { type: 'respondTrade', offerId: s.offers[0].id, accept: true });
    s = act(s, 0, { type: 'confirmTrade', offerId: s.offers[0].id, partner: 1 });
    expect(s.offers).toEqual([]);
  });
});

describe('Sonderbauphase (5–6 Spieler)', () => {
  it('geht reihum an alle, die bauen können, ohne Handel und ohne Karten', () => {
    let s = toPhase(game(5), 'main');
    give(s, 2, COSTS.devCard);
    give(s, 4, COSTS.devCard);
    s.players[2].devCards = ['knight'];
    s = act(s, 0, { type: 'endTurn' });
    // Spieler 1 wird übersprungen, 3 erst geprüft, wenn er an der Reihe wäre
    expect(s.phase).toEqual({ kind: 'specialBuild', queue: [2, 3, 4] });
    expect(s.current).toBe(0);
    expect(actingSeats(s)).toEqual([2]);

    expectFail(s, 4, { type: 'buyDevCard' }, /nicht dran/);
    expectFail(s, 4, { type: 'endTurn' }, /nicht dran/);
    expectFail(s, 0, { type: 'endTurn' }, /nicht dran/);
    expectFail(s, 0, { type: 'buyDevCard' });
    expectFail(s, 2, { type: 'bankTrade', give: 'sheep', get: 'ore' });
    expectFail(s, 2, { type: 'offerTrade', give: res({ sheep: 1 }), want: res({ ore: 1 }) });
    expectFail(s, 2, { type: 'playKnight' });
    expectFail(s, 0, { type: 'roll' });

    s = act(s, 2, { type: 'buyDevCard' });
    expect(s.players[2].newDevCards).toHaveLength(1);
    s = act(s, 2, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'specialBuild', queue: [4] });
    s = act(s, 4, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.current).toBe(1);
    expect(s.turn).toBe(2);
    // in der Sonderbauphase gekaufte Karte ist ab dem eigenen Zug spielbar
    expect(s.players[2].devCards).toHaveLength(2);
  });

  it('Reihenfolge beginnt beim linken Nachbarn', () => {
    let s = toPhase(game(6), 'main', 3);
    for (let i = 0; i < 6; i++) give(s, i, COSTS.devCard);
    s = act(s, 3, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'specialBuild', queue: [4, 5, 0, 1, 2] });
  });

  it('wird übersprungen, wenn niemand etwas bauen kann', () => {
    let s = toPhase(game(5), 'main');
    // Rohstoffe für eine Siedlung, aber kein Bauplatz und keine Straße
    give(s, 1, COSTS.settlement);
    expect(canBuildAnything(s, 1)).toBe(false);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.current).toBe(1);
  });

  it('canBuildAnything berücksichtigt Bauplätze und Vorrat', () => {
    const s = toPhase(game(5), 'main');
    const v = topo(s).hexes[CENTER].corners[0];
    give(s, 1, COSTS.road);
    expect(canBuildAnything(s, 1)).toBe(false);
    settle(s, 1, v);
    expect(canBuildAnything(s, 1)).toBe(true);
    give(s, 1, COSTS.city);
    expect(canBuildAnything(s, 1)).toBe(true);
    give(s, 1, COSTS.devCard);
    expect(canBuildAnything(s, 1)).toBe(true);
    s.devDeck = [];
    expect(canBuildAnything(s, 1)).toBe(false);
  });

  it('nach unterbrochener Sonderbauphase werden später Übersprungene neu geprüft', () => {
    let s = toPhase(game(5), 'main');
    give(s, 1, COSTS.devCard);
    give(s, 3, COSTS.devCard);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'specialBuild', queue: [1, 2, 3, 4] });
    // Spieler 3 verliert seine Rohstoffe (z. B. durch Abschluss davor) und wird übersprungen
    s.players[3].resources = res();
    s = act(s, 1, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'roll' });
  });

  it('in der Sonderbauphase gewinnt niemand, erst im eigenen Zug', () => {
    let s = toPhase(game(5), 'main', 1);
    const far = topo(s).vertices.map((v) => v.id);
    for (const v of far.slice(0, 4)) settle(s, 2, v, 'city');
    settle(s, 2, far[20]);
    expect(victoryPoints(s, 2, true)).toBe(9);
    give(s, 2, COSTS.devCard);
    s.devDeck.push('victoryPoint');
    s = act(s, 1, { type: 'endTurn' });
    expect(actingSeats(s)).toEqual([2]);
    s = act(s, 2, { type: 'buyDevCard' });
    expect(victoryPoints(s, 2, true)).toBe(10);
    expect(s.winner).toBeNull();
    expect(s.phase.kind).toBe('specialBuild');
    s = act(s, 2, { type: 'endTurn' });
    expect(s.current).toBe(2);
    expect(s.winner).toBe(2);
    expect(s.phase).toEqual({ kind: 'ended' });
  });

  it('bei 4 Spielern gibt es keine Sonderbauphase', () => {
    let s = toPhase(game(4), 'main');
    give(s, 1, COSTS.devCard);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.current).toBe(1);
  });
});

describe('Sieg', () => {
  function nearWin() {
    const s = toPhase(game(4), 'main');
    const vs = topo(s).vertices.map((v) => v.id);
    for (const v of vs.slice(0, 3)) settle(s, 0, v, 'city');
    for (const v of vs.slice(10, 13)) settle(s, 0, v);
    expect(victoryPoints(s, 0, true)).toBe(9);
    return { s, vs };
  }

  it('wer im eigenen Zug die Zielpunktzahl erreicht, gewinnt', () => {
    const { s, vs } = nearWin();
    give(s, 0, COSTS.city);
    const n = act(s, 0, { type: 'buildCity', vertex: vs[10] });
    expect(n.winner).toBe(0);
    expect(n.phase).toEqual({ kind: 'ended' });
    expect(actingSeats(n)).toEqual([]);
    expectFail(n, 0, { type: 'endTurn' }, /vorbei/);
  });

  it('auch eine gekaufte Siegpunktkarte entscheidet sofort', () => {
    const { s } = nearWin();
    give(s, 0, COSTS.devCard);
    s.devDeck.push('victoryPoint');
    expect(act(s, 0, { type: 'buyDevCard' }).winner).toBe(0);
  });

  it('einstellbare Zielpunktzahl', () => {
    const s = toPhase(game(4, 1, 3), 'main');
    const { c, ring } = centerRing(s);
    settle(s, 0, c[0], 'city');
    s.roads[ring[0]] = 0;
    s.roads[ring[1]] = 0;
    give(s, 0, COSTS.settlement);
    expect(act(s, 0, { type: 'buildSettlement', vertex: c[2] }).winner).toBe(0);
  });

  it('Punkte außerhalb des eigenen Zugs zählen erst im eigenen Zug', () => {
    const { s } = nearWin();
    // Spieler 0 hat 9 + längste Straße = 11, aber Spieler 1 ist am Zug
    s.longestRoad = 0;
    toPhase(s, 'main', 1);
    let n = act(s, 1, { type: 'endTurn' });
    expect(n.winner).toBeNull();
    for (const seat of [2, 3]) {
      toPhase(n, 'roll', seat);
      setDice(n, 6);
      n = act(n, seat, { type: 'roll' });
      n = act(n, seat, { type: 'endTurn' });
    }
    expect(n.current).toBe(0);
    expect(n.winner).toBe(0);
  });
});

describe('Unveränderlichkeit', () => {
  it('applyAction verändert den vorherigen Stand nie, auch nicht bei Fehlern', () => {
    let s = game(5, 11);
    let steps = 0;
    const step = (seat: number, action: Action) => {
      const snapshot = JSON.stringify(s);
      deepFreeze(s);
      const next = applyAction(s, seat, action);
      expect(JSON.stringify(s)).toBe(snapshot);
      expect(next).not.toBe(s);
      s = next;
      steps++;
    };
    const failing = (seat: number, action: Action) => {
      const snapshot = JSON.stringify(s);
      deepFreeze(s);
      expect(() => applyAction(s, seat, action)).toThrow(RuleError);
      expect(JSON.stringify(s)).toBe(snapshot);
    };

    while (s.phase.kind === 'setup') {
      const seat = actingSeats(s)[0];
      failing(seat, { type: 'placeRoad', edge: 0 });
      step(seat, { type: 'placeSettlement', vertex: legalSetupVertices(s)[0] });
      step(seat, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    }
    s = structuredClone(s);
    give(s, 0, { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 });
    give(s, 1, { ore: 9 });
    s.players[0].devCards = ['knight', 'monopoly'];
    setDice(s, 7);
    step(0, { type: 'roll' });
    if (s.phase.kind === 'discard') {
      for (const seat of actingSeats(s)) {
        const due = (s.phase as { pending: number[] }).pending[seat];
        const pay = res();
        let left = due;
        for (const r of RESOURCES) {
          const n = Math.min(left, s.players[seat].resources[r]);
          pay[r] = n;
          left -= n;
        }
        step(seat, { type: 'discard', resources: pay });
      }
    }
    const hex = s.robber === CENTER ? 0 : CENTER;
    step(0, { type: 'moveRobber', hex, victim: robberVictims(s, 0, hex)[0] ?? null });
    step(0, { type: 'playMonopoly', resource: 'ore' });
    failing(0, { type: 'playKnight' });
    step(0, { type: 'buildRoad', edge: legalRoadEdges(s, 0)[0] });
    step(0, { type: 'buyDevCard' });
    step(0, { type: 'offerTrade', give: res({ ore: 1 }), want: res({ wood: 1 }) });
    step(1, { type: 'respondTrade', offerId: s.offers[0].id, accept: false });
    step(0, { type: 'bankTrade', give: 'ore', get: 'brick' });
    step(0, { type: 'endTurn' });
    expect(steps).toBeGreaterThan(20);
  });
});

describe('Zufallsspiele', () => {
  /** Spielt zufällige, meist gültige Züge und prüft dabei Invarianten. */
  function randomGame(n: number, seed: number, maxSteps = 3000) {
    let s = game(n, seed);
    const rnd = { rng: seed * 31 + 7 };
    const pick = <T>(items: T[]): T => items[randomInt(rnd, items.length)];
    const bankTotal = bankSize(getTopology(s.board).hexes.length);
    const deckSize = s.devDeck.length;

    for (let step = 0; step < maxSteps && s.phase.kind !== 'ended'; step++) {
      const phase = s.phase;
      const seat = pick(actingSeats(s));
      const candidates: Action[] = [];
      const p = s.players[seat];
      switch (phase.kind) {
        case 'setup':
          candidates.push(
            phase.step === 'settlement'
              ? { type: 'placeSettlement', vertex: pick(legalSetupVertices(s)) }
              : { type: 'placeRoad', edge: pick(legalSetupRoads(s)) },
          );
          break;
        case 'roll':
          candidates.push({ type: 'roll' });
          if (p.devCards.includes('knight')) candidates.push({ type: 'playKnight' });
          break;
        case 'discard': {
          const pay = res();
          let left = phase.pending[seat];
          for (const r of RESOURCES) {
            const k = Math.min(left, p.resources[r]);
            pay[r] = k;
            left -= k;
          }
          candidates.push({ type: 'discard', resources: pay });
          break;
        }
        case 'robber': {
          const hex = pick(s.board.hexes.map((_, i) => i).filter((i) => i !== s.robber));
          candidates.push({ type: 'moveRobber', hex, victim: robberVictims(s, seat, hex)[0] ?? null });
          break;
        }
        case 'roadBuilding':
          candidates.push({ type: 'buildRoad', edge: pick(legalRoadEdges(s, seat)) });
          break;
        case 'main':
        case 'specialBuild': {
          const settlements = legalSettlementVertices(s, seat);
          const cities = legalCityVertices(s, seat);
          const roads = legalRoadEdges(s, seat);
          if (settlements.length) candidates.push({ type: 'buildSettlement', vertex: pick(settlements) });
          if (cities.length) candidates.push({ type: 'buildCity', vertex: pick(cities) });
          if (roads.length) candidates.push({ type: 'buildRoad', edge: pick(roads) });
          candidates.push({ type: 'buyDevCard' });
          if (phase.kind === 'main') {
            candidates.push({ type: 'bankTrade', give: pick([...RESOURCES]), get: pick([...RESOURCES]) });
            candidates.push({ type: 'playKnight' }, { type: 'playRoadBuilding' }, { type: 'playMonopoly', resource: pick([...RESOURCES]) });
            candidates.push({ type: 'playYearOfPlenty', resources: [pick([...RESOURCES]), pick([...RESOURCES])] });
            if (randomInt(rnd, 4) === 0) {
              const partner = (seat + 1 + randomInt(rnd, n - 1)) % n;
              const [g, w] = [pick([...RESOURCES]), pick([...RESOURCES])];
              candidates.push({ type: 'offerTrade', give: res({ [g]: 1 }), want: res({ [w]: 1 }) });
              const offer = s.offers.find((o) => o.from === seat);
              if (offer) {
                candidates.push({ type: 'confirmTrade', offerId: offer.id, partner });
              }
              const open = s.offers.find((o) => o.from !== seat && !o.counter);
              if (open) candidates.push({ type: 'respondTrade', offerId: open.id, accept: true });
            }
          }
          candidates.push({ type: 'endTurn' });
          break;
        }
      }
      // Bauaktionen bevorzugen, damit das Spiel vorankommt
      for (const action of candidates) {
        try {
          s = applyAction(s, seat, action);
          break;
        } catch (e) {
          if (!(e instanceof RuleError)) throw e;
        }
      }

      for (const r of RESOURCES) {
        expect(totalOf(s, r)).toBe(bankTotal);
        expect(s.bank[r]).toBeGreaterThanOrEqual(0);
        for (const pl of s.players) expect(pl.resources[r]).toBeGreaterThanOrEqual(0);
      }
      s.players.forEach((_, i) => {
        expect(piecesLeft(s, i, 'road')).toBeGreaterThanOrEqual(0);
        expect(piecesLeft(s, i, 'settlement')).toBeGreaterThanOrEqual(0);
        expect(piecesLeft(s, i, 'city')).toBeGreaterThanOrEqual(0);
      });
      const cardsInHands = s.players.reduce((sum, pl) => sum + pl.devCards.length + pl.newDevCards.length, 0);
      expect(cardsInHands + s.devDeck.length).toBeLessThanOrEqual(deckSize);
      // Abstandsregel gilt immer
      s.buildings.forEach((b, v) => {
        if (b) for (const nb of topo(s).vertices[v].neighbors) expect(s.buildings[nb]).toBeNull();
      });
    }
    return s;
  }

  for (const [n, seed] of [
    [2, 1],
    [3, 2],
    [4, 3],
    [4, 4],
    [5, 5],
    [6, 6],
  ] as const) {
    it(`${n} Spieler, Seed ${seed}: Invarianten bleiben erhalten und das Spiel endet`, () => {
      const s = randomGame(n, seed);
      expect(s.phase.kind).toBe('ended');
      expect(victoryPoints(s, s.winner!, true)).toBeGreaterThanOrEqual(10);
    });
  }
});
