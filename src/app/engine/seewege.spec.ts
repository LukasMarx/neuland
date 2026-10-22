import { describe, expect, it } from 'vitest';
import { getTopology } from './board';
import {
  actingSeats,
  applyAction,
  canBuildRoad,
  canBuildShip,
  createGame,
  legalRobberHexes,
  legalSetupVertices,
  legalShipEdges,
  longestRoad,
  movableShips,
  victoryPoints,
} from './rules';
import { COSTS, emptyResources, GameState, ResourceCounts, totalResources } from './types';

function game(map = 'erste-ueberfahrt', seed = 3): GameState {
  const players = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = structuredClone(createGame(players, { victoryPoints: 13, map }, seed));
  s.phase = { kind: 'main' };
  s.current = 0;
  s.turn = 1;
  s.dice = [3, 4];
  return s;
}

const res = (r: Partial<ResourceCounts>): ResourceCounts => ({ ...emptyResources(), ...r });
const isSea = (s: GameState, h: number) => s.board.hexes[h].terrain === 'sea';

/** Eine Küstenecke der größten Insel mit einer Kante, die zwischen zwei Meerfeldern hinausführt. */
function harbourSpot(s: GameState) {
  const t = getTopology(s.board);
  const sizes = new Map<number, number>();
  for (const i of t.islands) if (i >= 0) sizes.set(i, (sizes.get(i) ?? 0) + 1);
  const home = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  for (const v of t.vertices) {
    if (!v.hexes.some((h) => t.islands[h] === home)) continue;
    const out = v.edges.find((e) => t.edges[e].hexes.every((h) => isSea(s, h)));
    if (out !== undefined) return { t, home, vertex: v.id, out };
  }
  throw new Error('keine Küstenecke');
}

function far(t: ReturnType<typeof getTopology>, vertex: number, edge: number) {
  const e = t.edges[edge];
  return e.a === vertex ? e.b : e.a;
}

describe('Seewege: Brett', () => {
  it('hat Meerfelder, Inseln, Schiffe und ein Kaperschiff auf dem Meer', () => {
    const s = game();
    const t = getTopology(s.board);
    expect(s.ships).toHaveLength(t.edges.length);
    expect(isSea(s, s.pirate!)).toBe(true);
    expect(Math.max(...t.islands)).toBe(3);
    expect(s.board.hexes.filter((h) => h.terrain === 'gold')).toHaveLength(3);
    expect(s.islandBonus).toEqual([0, 0, 0]);
  });

  it('Erste Überfahrt: Startsiedlungen nur auf der Hauptinsel, nie im Meer', () => {
    const s = createGame([0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: 'c' })), { victoryPoints: 13, map: 'erste-ueberfahrt' }, 1);
    const { t, home } = harbourSpot(s);
    const legal = legalSetupVertices(s);
    expect(legal.length).toBeGreaterThan(10);
    for (const v of legal) expect(t.vertices[v].hexes.some((h) => t.islands[h] === home)).toBe(true);
    const q = createGame([0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: 'c' })), { victoryPoints: 12, map: 'inselquartett' }, 1);
    const islands = new Set(legalSetupVertices(q).flatMap((v) => getTopology(q.board).vertices[v].hexes.map((h) => getTopology(q.board).islands[h])));
    islands.delete(-1);
    expect(islands.size).toBe(4);
  });
});

describe('Seewege: Schiffe', () => {
  it('werden an eigenen Gebäuden an Meerkanten gebaut und kosten Holz und Wolle', () => {
    const s = game();
    const { t, vertex, out } = harbourSpot(s);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    expect(canBuildShip(s, 0, out)).toBe(true);
    expect(canBuildShip(s, 1, out)).toBe(false);
    s.players[0].resources = res(COSTS.ship);
    const n = applyAction(s, 0, { type: 'buildShip', edge: out });
    expect(n.ships![out]).toBe(0);
    expect(n.players[0].resources).toEqual(emptyResources());
    // Weiter geht es nur übers Meer, an Land gibt es keine Schiffe.
    const next = far(t, vertex, out);
    for (const e of legalShipEdges(n, 0)) expect(t.edges[e].hexes.some((h) => isSea(n, h))).toBe(true);
    expect(legalShipEdges(n, 0).some((e) => t.vertices[next].edges.includes(e))).toBe(true);
  });

  it('Straße und Schiff gehen nur über ein Gebäude ineinander über', () => {
    const s = game();
    const { t, vertex, out } = harbourSpot(s);
    // Eigene Straße endet an der Küstenecke, aber dort steht kein Gebäude.
    const landEdge = t.vertices[vertex].edges.find((e) => t.edges[e].hexes.some((h) => !isSea(s, h)))!;
    s.roads[landEdge] = 0;
    expect(canBuildShip(s, 0, out)).toBe(false);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    expect(canBuildShip(s, 0, out)).toBe(true);
  });

  it('am Kaperschiff kann niemand bauen', () => {
    const s = game();
    const { vertex, out, t } = harbourSpot(s);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    s.pirate = t.edges[out].hexes[0];
    expect(canBuildShip(s, 0, out)).toBe(false);
  });

  it('das offene Ende einer Linie darf einmal pro Zug versetzt werden, nicht im Bauzug', () => {
    let s = game();
    const { t, vertex, out } = harbourSpot(s);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    s.players[0].resources = res({ wood: 2, sheep: 2 });
    s = applyAction(s, 0, { type: 'buildShip', edge: out });
    const second = legalShipEdges(s, 0).find((e) => t.vertices[far(t, vertex, out)].edges.includes(e))!;
    s = applyAction(s, 0, { type: 'buildShip', edge: second });
    expect(movableShips(s, 0)).toEqual([]); // beide in diesem Zug gebaut
    s = structuredClone(s);
    s.shipsBuilt = [];
    expect(movableShips(s, 0)).toEqual([second]); // nur das Ende, nicht das Schiff am Gebäude
    const target = legalShipEdges({ ...s, ships: s.ships!.map((o, e) => (e === second ? null : o)) }, 0).find((e) => e !== second)!;
    const moved = applyAction(s, 0, { type: 'moveShip', from: second, to: target });
    expect(moved.ships![second]).toBeNull();
    expect(moved.ships![target]).toBe(0);
    expect(() => applyAction(moved, 0, { type: 'moveShip', from: target, to: second })).toThrow(/schon ein Schiff/);
  });
});

describe('Seewege: Inselbonus, Gold, Kaperschiff, Route', () => {
  it('die erste Siedlung auf einer neuen Insel bringt 2 Siegpunkte', () => {
    const s = game();
    const t = getTopology(s.board);
    const { home } = harbourSpot(s);
    const homeVertex = t.vertices.find((v) => v.hexes.some((h) => t.islands[h] === home) && v.hexes.every((h) => !isSea(s, h)))!;
    s.buildings[homeVertex.id] = { owner: 0, type: 'settlement' };
    // Eine Küstenecke einer kleinen Insel, erreicht per Schiff.
    const target = t.vertices.find((v) => v.hexes.some((h) => t.islands[h] > 0 && t.islands[h] !== home) && v.edges.some((e) => t.edges[e].hexes.some((h) => isSea(s, h))))!;
    const shipEdge = target.edges.find((e) => t.edges[e].hexes.some((h) => isSea(s, h)))!;
    s.ships![shipEdge] = 0;
    s.players[0].resources = res(COSTS.settlement);
    const n = applyAction(s, 0, { type: 'buildSettlement', vertex: target.id });
    expect(n.islandBonus![0]).toBe(2);
    expect(victoryPoints(n, 0, false)).toBe(2 + 2);
  });

  it('Gold: wer an einem Goldfeld steht, wählt seine Rohstoffe selbst', () => {
    let s = game();
    const t = getTopology(s.board);
    const goldHex = s.board.hexes.findIndex((h) => h.terrain === 'gold');
    s.buildings[t.hexes[goldHex].corners[0]] = { owner: 1, type: 'city' };
    s.robber = s.board.hexes.findIndex((h) => h.terrain === 'desert');
    s.phase = { kind: 'roll' };
    // Würfel so stellen, dass die Zahl des Goldfelds fällt.
    for (let seed = 1; ; seed++) {
      const trial = applyAction({ ...s, rng: seed }, 0, { type: 'roll' });
      if (trial.dice![0] + trial.dice![1] === s.board.hexes[goldHex].number) {
        s = trial;
        break;
      }
    }
    expect(s.phase).toEqual({ kind: 'gold', pending: [0, 2, 0] });
    expect(actingSeats(s)).toEqual([1]);
    expect(() => applyAction(s, 1, { type: 'chooseGold', resources: res({ ore: 1 }) })).toThrow(/genau 2/);
    const n = applyAction(s, 1, { type: 'chooseGold', resources: res({ ore: 1, wheat: 1 }) });
    expect(n.players[1].resources.ore).toBeGreaterThanOrEqual(1);
    expect(n.phase.kind).toBe('main');
  });

  it('das Kaperschiff wird statt des Räubers versetzt und zieht bei Schiffseignern', () => {
    const s = game();
    const t = getTopology(s.board);
    const seaHex = t.hexes.find((h) => h.sea && h.id !== s.pirate && h.edges.some((e) => t.edges[e].hexes.length === 2))!;
    s.ships![seaHex.edges[0]] = 1;
    s.players[1].resources = res({ wood: 1 });
    s.phase = { kind: 'robber', returnTo: 'main' };
    expect(legalRobberHexes(s)).toContain(seaHex.id);
    expect(legalRobberHexes(s)).not.toContain(s.pirate);
    const n = applyAction(s, 0, { type: 'moveRobber', hex: seaHex.id, victim: 1 });
    expect(n.pirate).toBe(seaHex.id);
    expect(n.robber).toBe(s.robber);
    expect(n.players[0].resources.wood).toBe(1);
  });

  it('die Route zählt Straßen und Schiffe zusammen, wenn ein eigenes Gebäude sie verbindet', () => {
    const s = game();
    const { t, vertex, out } = harbourSpot(s);
    const landEdges = t.vertices[vertex].edges.filter((e) => t.edges[e].hexes.some((h) => !isSea(s, h)));
    s.roads[landEdges[0]] = 0;
    s.ships![out] = 0;
    expect(longestRoad(s, 0)).toBe(1);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    expect(longestRoad(s, 0)).toBe(2);
  });

  it('Straßenbau-Karte legt auch Schiffe', () => {
    let s = game();
    const { vertex, out } = harbourSpot(s);
    s.buildings[vertex] = { owner: 0, type: 'settlement' };
    s.players[0].devCards = ['roadBuilding'];
    s = applyAction(s, 0, { type: 'playRoadBuilding' });
    s = applyAction(s, 0, { type: 'buildShip', edge: out });
    expect(s.ships![out]).toBe(0);
    expect(s.phase).toMatchObject({ kind: 'roadBuilding', remaining: 1 });
  });
});

describe('Seewege: Im Dunst', () => {
  const fogged = (s: GameState) => s.board.hexes.flatMap((h, i) => (h.terrain === 'fog' ? [i] : []));
  /** Eine Kante zwischen Meer und Nebel, dazu eine Ecke daran mit eigener Siedlung. */
  function seaFogEdge(s: GameState) {
    const t = getTopology(s.board);
    const e = t.edges.find((x) => x.hexes.length === 2 && x.hexes.some((h) => isSea(s, h)) && x.hexes.some((h) => s.board.hexes[h].terrain === 'fog'))!;
    s.buildings[e.a] = { owner: 0, type: 'settlement' };
    return e;
  }

  it('liegt verdeckt: im Spielstand nur ein Zählwerk, keine Felder und keine Zahlen', () => {
    const s = game('im-dunst');
    const fog = fogged(s);
    expect(fog.length).toBe(25);
    for (const h of fog) expect(s.board.hexes[h].number).toBeNull();
    const pool = Object.values(s.fog!.terrain).reduce((a, b) => a + b!, 0);
    expect(pool).toBe(fog.length);
    // Nebel ist weder Land noch Meer: kein Räuber, kein Kaperschiff, keine Startsiedlung daran.
    expect(legalRobberHexes(s).some((h) => fog.includes(h))).toBe(false);
    const t = getTopology(s.board);
    for (const v of legalSetupVertices(createGame([0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: 'c' })), { victoryPoints: 12, map: 'im-dunst' }, 1))) {
      expect(t.vertices[v].hexes.some((h) => !t.hexes[h].sea)).toBe(true);
    }
  });

  it('ein Schiff an den Nebel deckt das Feld auf, Land bringt Zahl und Rohstoff', () => {
    const s = game('im-dunst');
    const e = seaFogEdge(s);
    const hex = e.hexes.find((h) => s.board.hexes[h].terrain === 'fog')!;
    s.fog = { terrain: { ore: 3 }, numbers: { 9: 3 } };
    s.players[0].resources = res(COSTS.ship);
    const n = applyAction(s, 0, { type: 'buildShip', edge: e.id });
    expect(n.board.hexes[hex]).toEqual({ terrain: 'ore', number: 9 });
    expect(n.fog).toEqual({ terrain: { ore: 2 }, numbers: { 9: 2 } });
    expect(n.players[0].resources.ore).toBe(1);
    expect(n.bank.ore).toBe(s.bank.ore - 1);
    expect(n.transfers).toContainEqual({ from: { kind: 'hex', id: hex }, to: { kind: 'player', seat: 0 }, card: 'ore', count: 1 });
    // Die Topologie kennt das neue Land, der alte Stand bleibt unverändert.
    expect(getTopology(n.board).hexes[hex].sea).toBe(false);
    expect(getTopology(s.board).hexes[hex].sea).toBe(true);
    expect(s.board.hexes[hex].terrain).toBe('fog');
  });

  it('wird es Meer, gibt es nichts, und das Schiff kann weiter', () => {
    const s = game('im-dunst');
    const e = seaFogEdge(s);
    const hex = e.hexes.find((h) => s.board.hexes[h].terrain === 'fog')!;
    s.fog = { terrain: { sea: 30 }, numbers: {} };
    s.players[0].resources = res(COSTS.ship);
    const n = applyAction(s, 0, { type: 'buildShip', edge: e.id });
    expect(n.board.hexes[hex]).toEqual({ terrain: 'sea', number: null });
    expect(n.players[0].resources).toEqual(emptyResources());
    expect(n.log.at(-1)!.text).toMatch(/lichtet den Nebel: Meer/);
    expect(legalShipEdges(n, 0).some((x) => getTopology(n.board).hexes[hex].edges.includes(x))).toBe(true);
  });

  it('auch eine Straße an Land deckt auf; zwischen Nebel und Meer gibt es keine Straße', () => {
    const s = game('im-dunst');
    const t = getTopology(s.board);
    // Ein Meerfeld neben dem Nebel wird für den Test zu Land, so entsteht eine Kante Land–Nebel.
    const e = t.edges.find((x) => x.hexes.length === 2 && x.hexes.some((h) => isSea(s, h)) && x.hexes.some((h) => s.board.hexes[h].terrain === 'fog'))!;
    const seaHex = e.hexes.find((h) => isSea(s, h))!;
    const fogHex = e.hexes.find((h) => h !== seaHex)!;
    expect(canBuildRoad(s, 0, e.id)).toBe(false);
    s.board = { ...s.board, hexes: s.board.hexes.map((h, i) => (i === seaHex ? { terrain: 'wheat', number: 5 } : h)) };
    s.buildings[e.a] = { owner: 0, type: 'settlement' };
    expect(canBuildRoad(s, 0, e.id)).toBe(true);
    s.fog = { terrain: { gold: 1 }, numbers: { 4: 1 } };
    s.players[0].resources = res(COSTS.road);
    const n = applyAction(s, 0, { type: 'buildRoad', edge: e.id });
    expect(n.board.hexes[fogHex]).toEqual({ terrain: 'gold', number: 4 });
    expect(totalResources(n.players[0].resources)).toBe(1);
  });

  it('legt keine 6 neben eine 8, solange der Vorrat anderes hergibt', () => {
    const s = game('im-dunst');
    const e = seaFogEdge(s);
    const t = getTopology(s.board);
    const hex = e.hexes.find((h) => s.board.hexes[h].terrain === 'fog')!;
    const neighbor = t.hexes[hex].neighbors.find((m) => m !== e.hexes.find((h) => h !== hex))!;
    s.board = { ...s.board, hexes: s.board.hexes.map((h, i) => (i === neighbor ? { terrain: 'wood', number: 8 } : h)) };
    s.fog = { terrain: { wood: 1 }, numbers: { 6: 5, 3: 1 } };
    s.players[0].resources = res(COSTS.ship);
    expect(applyAction(s, 0, { type: 'buildShip', edge: e.id }).board.hexes[hex].number).toBe(3);
  });
});
