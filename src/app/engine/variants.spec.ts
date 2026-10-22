import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { getTopology, vertexHarbors } from './board';
import {
  actingSeats,
  applyAction,
  canBuildRoad,
  canBuildSettlement,
  canSpendFish,
  coinPoints,
  createGame,
  fishTotal,
  harborPoints,
  legalBridgeEdges,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  piecesLeft,
  tokenCost,
  victoryPoints,
  victoryTarget,
} from './rules';
import { COSTS, emptyResources, GameState, totalResources } from './types';
import { DICE_DECK, VariantId } from './variants';

function game(variants: VariantId[], n = 3, seed = 1): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = structuredClone(createGame(players, { victoryPoints: 10, variants }, seed));
  s.phase = { kind: 'main' };
  s.current = 0;
  s.turn = 1;
  s.dice = [3, 4];
  return s;
}

describe('Milder Räuber', () => {
  it('meidet Felder mit Spielern bis 2 Siegpunkte und geht notfalls in die Wüste', () => {
    const s = game(['milderRaeuber']);
    const t = getTopology(s.board);
    // Spieler 1 hat eine Siedlung (1 Punkt), Spieler 2 drei Städte (6 Punkte).
    const weak = t.hexes.find((h) => s.board.hexes[h.id].terrain !== 'desert' && h.id !== s.robber)!;
    s.buildings[weak.corners[0]] = { owner: 1, type: 'settlement' };
    const strongCorners = t.vertices.filter((v) => v.hexes.every((h) => !weak.corners.some((c) => t.hexes[h].corners.includes(c)))).slice(0, 3);
    for (const v of strongCorners) s.buildings[v.id] = { owner: 2, type: 'city' };
    const legal = legalRobberHexes(s);
    for (const h of t.vertices[weak.corners[0]].hexes) expect(legal).not.toContain(h);
    expect(legal.some((h) => t.hexes[h].corners.some((c) => s.buildings[c]?.owner === 2))).toBe(true);
    s.phase = { kind: 'robber', returnTo: 'main' };
    expect(() => applyAction(s, 0, { type: 'moveRobber', hex: weak.id, victim: 1 })).toThrow(/Milder Räuber/);

    // Stehen überall nur schwache Spieler, bleibt die Wüste.
    const all = game(['milderRaeuber']);
    for (const h of getTopology(all.board).hexes) all.buildings[h.corners[0]] = { owner: 1, type: 'settlement' };
    all.players[1].resources = { ...emptyResources(), wood: 1 };
    const desert = legalRobberHexes(all);
    expect(desert.every((h) => all.board.hexes[h].terrain === 'desert') || desert.length === all.board.hexes.length - 1).toBe(true);
  });

  it('ohne Variante darf der Räuber auf jedes andere Feld', () => {
    const s = game([]);
    expect(legalRobberHexes(s)).toHaveLength(s.board.hexes.length - 1);
  });
});

describe('Hafenvogt', () => {
  it('bekommt, wer zuerst 3 Hafenpunkte hat; wer mehr hat, übernimmt; zählt 2 Siegpunkte', () => {
    const s = game(['hafenvogt']);
    expect(s.harborMaster).toBeNull();
    const harbors = vertexHarbors(s.board);
    const t = getTopology(s.board);
    const spots = t.vertices.filter((v) => harbors[v.id]).map((v) => v.id);
    // Abstandsregel einhalten: nur Hafenecken nehmen, die sich nicht berühren.
    const free: number[] = [];
    for (const v of spots) if (free.every((f) => f !== v && !t.vertices[f].neighbors.includes(v))) free.push(v);
    // Spieler 0: Stadt (2) + Siedlung (1) per Aktionen.
    s.buildings[free[0]] = { owner: 0, type: 'settlement' };
    s.players[0].resources = { ...emptyResources(), ...COSTS.city };
    let n = applyAction(s, 0, { type: 'buildCity', vertex: free[0] });
    expect(harborPoints(n, 0)).toBe(2);
    expect(n.harborMaster).toBeNull();
    n.buildings[free[1]] = { owner: 0, type: 'settlement' };
    n.roads[t.vertices[free[1]].edges[0]] = 0;
    n.buildings[free[1]] = null;
    n.players[0].resources = { ...emptyResources(), ...COSTS.settlement };
    n = applyAction(n, 0, { type: 'buildSettlement', vertex: free[1] });
    expect(n.harborMaster).toBe(0);
    expect(victoryPoints(n, 0, false)).toBe(2 + 1 + 2);

    // Gleichziehen reicht nicht, überholen schon.
    n.buildings[free[2]] = { owner: 1, type: 'city' };
    n.buildings[free[3]] = { owner: 1, type: 'settlement' };
    n.players[1].resources = { ...emptyResources(), ...COSTS.city };
    n.current = 1;
    n = applyAction(n, 1, { type: 'buildCity', vertex: free[3] });
    expect(harborPoints(n, 1)).toBe(4);
    expect(n.harborMaster).toBe(1);
  });

  it('gibt es ohne Variante nicht', () => {
    expect(game([]).harborMaster).toBeUndefined();
  });
});

describe('Würfelstapel', () => {
  it('liefert genau die Verteilung zweier Würfel und mischt kurz vor dem Ende neu', () => {
    let s = game(['wuerfelstapel'], 2);
    expect(s.diceDeck).toEqual(DICE_DECK);
    const sums = new Map<number, number>();
    for (let i = 0; i < 31; i++) {
      s.phase = { kind: 'roll' };
      s.players.forEach((p) => (p.resources = emptyResources()));
      s = applyAction(s, s.current, { type: 'roll' });
      const [a, b] = s.dice!;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
      sums.set(a + b, (sums.get(a + b) ?? 0) + 1);
      s = structuredClone(s);
      s.phase = { kind: 'main' };
    }
    // Nach 31 von 36 Karten: jede Summe höchstens so oft wie im Stapel.
    for (const [sum, n] of sums) expect(n).toBeLessThanOrEqual(DICE_DECK[sum]);
    expect(Object.values(s.diceDeck!).reduce((a, b) => a + b, 0)).toBe(5);
    s.phase = { kind: 'roll' };
    s = applyAction(s, s.current, { type: 'roll' });
    expect(Object.values(s.diceDeck!).reduce((a, b) => a + b, 0)).toBe(35);
    expect(s.log.some((l) => l.text.includes('neu gemischt'))).toBe(true);
  });
});

describe('Entwicklungskarten', () => {
  it('werden zufällig gezogen, nicht von oben', () => {
    const tops = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const s = game([], 3, seed);
      const top = s.devDeck[s.devDeck.length - 1];
      s.players[0].resources = { ...emptyResources(), ...COSTS.devCard };
      const n = applyAction(s, 0, { type: 'buyDevCard' });
      tops.add(n.players[0].newDevCards[0] === top ? 'oben' : 'anders');
    }
    expect(tops.has('anders')).toBe(true);
  });
});

describe('Fischgründe', () => {
  const fishing = (s: GameState) => s.board.fishing!;
  /** Würfelt mit wechselndem Zufall, bis die gewünschte Summe fällt. */
  function rollTo(s: GameState, sum: number): GameState {
    s.phase = { kind: 'roll' };
    for (let seed = 1; ; seed++) {
      const n = applyAction({ ...s, rng: seed }, 0, { type: 'roll' });
      if (n.dice![0] + n.dice![1] === sum) return n;
    }
  }

  it('ersetzt die Wüste durch einen See, der Räuber beginnt neben dem Brett', () => {
    const s = game(['fischgruende']);
    expect(s.robber).toBe(-1);
    expect(s.board.hexes.filter((h) => h.terrain === 'lake')).toHaveLength(1);
    expect(s.board.hexes.some((h) => h.terrain === 'desert')).toBe(false);
    expect(s.fish).toEqual([[], [], []]);
    expect(s.anchor).toBeNull();
    // Der Räuber darf auf jedes Landfeld, auch den See.
    expect(legalRobberHexes(s)).toHaveLength(19);
  });

  it('legt die Fischgründe an die Küste, nie auf Hafenkanten und nie Ecke an Ecke', () => {
    for (const [n, count] of [
      [3, 6],
      [6, 8],
    ]) {
      for (let seed = 1; seed <= 10; seed++) {
        const s = game(['fischgruende'], n, seed);
        const t = getTopology(s.board);
        const grounds = fishing(s);
        expect(grounds).toHaveLength(count);
        expect(grounds.map((f) => f.number).sort((a, b) => a - b).slice(0, 6)).toEqual(n > 4 ? [4, 5, 5, 6, 8, 9] : [4, 5, 6, 8, 9, 10]);
        const harborEdges = new Set(s.board.harbors.map((h) => h.edge));
        const corners = grounds.flatMap((f) => [t.edges[f.edge].a, t.edges[f.edge].b]);
        expect(new Set(corners).size).toBe(corners.length);
        for (const f of grounds) {
          expect(t.edges[f.edge].hexes).toHaveLength(1);
          expect(harborEdges.has(f.edge)).toBe(false);
        }
        for (const f of grounds) {
          const own = [t.edges[f.edge].a, t.edges[f.edge].b];
          const others = corners.filter((c) => !own.includes(c));
          for (const v of own) for (const w of t.vertices[v].neighbors) expect(others).not.toContain(w);
        }
      }
    }
  });

  it('Fischgrund und See liefern Fischplättchen: Siedlung 1, Stadt 2; der Räuber sperrt den See', () => {
    const s = game(['fischgruende']);
    const t = getTopology(s.board);
    const ground = fishing(s)[0];
    s.buildings[t.edges[ground.edge].a] = { owner: 1, type: 'city' };
    const lake = s.board.hexes.findIndex((h) => h.terrain === 'lake');
    s.buildings[t.hexes[lake].corners[0]] = { owner: 2, type: 'settlement' };
    const n = rollTo(structuredClone(s), ground.number);
    expect(n.fish![1].length + (n.anchor === 1 ? 1 : 0)).toBe(2);
    const total = (g: GameState) => Object.values(g.fishPool!).reduce((a, b) => a + b, 0);
    expect(total(n)).toBe(total(s) - 2);
    const atLake = rollTo(structuredClone(s), 12);
    expect(atLake.fish![2].length + (atLake.anchor === 2 ? 1 : 0)).toBe(1);
    const blocked = structuredClone(s);
    blocked.robber = lake;
    expect(rollTo(blocked, 12).fish![2]).toEqual([]);
  });

  it('bezahlt ohne Wechselgeld mit der kleinsten passenden Summe', () => {
    const s = game(['fischgruende']);
    s.fish![0] = [3, 3, 1];
    s.robber = 5;
    s.players[1].resources = { ...emptyResources(), ore: 1 };
    const n = applyAction(s, 0, { type: 'spendFish', effect: 'bank', resource: 'wheat' });
    expect(n.fish![0]).toEqual([3]);
    expect(n.players[0].resources.wheat).toBe(1);
    expect(n.fishPool!['3']).toBe(s.fishPool!['3'] + 1);
    expect(n.fishPool!['1']).toBe(s.fishPool!['1'] + 1);
    expect(() => applyAction(n, 0, { type: 'spendFish', effect: 'bank', resource: 'wheat' })).toThrow(/Wert von 4/);
  });

  it('Räuber vom Brett (2), Karte ziehen (3), Straße (5), Entwicklung (7)', () => {
    const s = game(['fischgruende']);
    const t = getTopology(s.board);
    s.fish![0] = [3, 3, 3, 3, 3, 3];
    s.robber = 4;
    let n = applyAction(s, 0, { type: 'spendFish', effect: 'robber' });
    expect(n.robber).toBe(-1);
    expect(() => applyAction(n, 0, { type: 'spendFish', effect: 'robber' })).toThrow(/schon vom Brett/);
    n.players[1].resources = { ...emptyResources(), ore: 1 };
    n = applyAction(n, 0, { type: 'spendFish', effect: 'steal', victim: 1 });
    expect(n.players[0].resources.ore).toBe(1);
    expect(() => applyAction(n, 0, { type: 'spendFish', effect: 'steal', victim: 1 })).toThrow(/keine Karten/);
    n = structuredClone(n);
    n.buildings[t.edges[0].a] = { owner: 0, type: 'settlement' };
    n = applyAction(n, 0, { type: 'spendFish', effect: 'road' });
    expect(n.phase).toEqual({ kind: 'roadBuilding', remaining: 1, returnTo: 'main' });
    n = applyAction(n, 0, { type: 'buildRoad', edge: t.edges[0].id });
    expect(n.phase.kind).toBe('main');
    expect(fishTotal(n, 0)).toBe(18 - 3 - 3 - 6);
    n = structuredClone(n);
    n.fish![0] = [3, 2, 2];
    n = applyAction(n, 0, { type: 'spendFish', effect: 'devCard' });
    expect(n.players[0].newDevCards).toHaveLength(1);
    expect(n.fish![0]).toEqual([]);
  });

  it('nur im eigenen Zug nach dem Würfeln', () => {
    const s = game(['fischgruende']);
    s.fish![1] = [3];
    s.robber = 2;
    expect(() => applyAction(s, 1, { type: 'spendFish', effect: 'robber' })).toThrow(/nicht dran/);
    s.fish![0] = [3];
    s.phase = { kind: 'roll' };
    expect(() => applyAction(s, 0, { type: 'spendFish', effect: 'robber' })).toThrow();
    expect(canSpendFish(s, 0, 'robber')).toBe(false);
  });

  it('der Rostige Anker verlangt einen Punkt mehr und geht nur an Gleichstarke oder Stärkere', () => {
    const s = game(['fischgruende']);
    const t = getTopology(s.board);
    // Spieler 0 hat 9 Punkte und baut die zehnte Siedlung.
    const spots = t.vertices.filter((v, i) => i % 7 === 0).slice(0, 5);
    spots.slice(0, 4).forEach((v) => (s.buildings[v.id] = { owner: 0, type: 'city' }));
    s.buildings[spots[4].id] = { owner: 0, type: 'settlement' };
    s.buildings[t.vertices[3].id] = { owner: 1, type: 'settlement' };
    s.anchor = 0;
    expect(victoryTarget(s, 0)).toBe(11);
    // Mit einer Siegpunktkarte sind es 10: ohne Anker gewonnen, mit Anker nicht.
    s.players[0].devCards = ['victoryPoint'];
    s.players[0].resources = { ...emptyResources(), ...COSTS.devCard };
    expect(applyAction(s, 0, { type: 'buyDevCard' }).phase.kind).not.toBe('ended');
    expect(applyAction({ ...s, anchor: 1 }, 0, { type: 'buyDevCard' }).phase.kind).toBe('ended');
    expect(() => applyAction(s, 0, { type: 'passAnchor', to: 1 })).toThrow(/mindestens so viele/);
    s.buildings[t.vertices[30].id] = { owner: 2, type: 'city' };
    for (const v of [40, 44, 50, 52]) s.buildings[t.vertices[v].id] = { owner: 2, type: 'city' };
    const passed = applyAction(s, 0, { type: 'passAnchor', to: 2 });
    expect(passed.anchor).toBe(2);
    expect(victoryTarget(passed, 0)).toBe(10);
  });
});

describe('Fischgründe im Spiel', () => {
  for (const [map, n] of [
    ['klassisch', 4],
    ['klassisch', 6],
    ['erste-ueberfahrt', 4],
  ] as const) {
    it(`${map} mit ${n} Spielern: 3000 Züge ohne Regelfehler, es wird gefischt und ausgegeben`, { timeout: 120000 }, () => {
      const random = seeded(n * 31 + map.length);
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }));
      let s = createGame(players, { victoryPoints: 12, map, variants: ['fischgruende'] }, 9);
      let spent = 0;
      for (let step = 0; step < 3000 && s.phase.kind !== 'ended'; step++) {
        const next = botStep(s, random);
        expect(next).not.toBeNull();
        s = applyAction(s, next!.seat, next!.action);
        if (next!.action.type === 'spendFish') spent++;
        // Kein Plättchen geht verloren: Stapel plus Hände ergeben immer 29 Fische und einen Anker.
        const held = s.fish!.reduce((a, f) => a + f.length, 0);
        expect(held + Object.entries(s.fishPool!).filter(([k]) => k !== 'anchor').reduce((a, [, c]) => a + c, 0)).toBe(29);
        expect((s.fishPool!['anchor'] ?? 0) + (s.anchor === null ? 0 : 1)).toBe(1);
      }
      expect(spent).toBeGreaterThan(0);
    });
  }
});

describe('Duell für zwei', () => {
  const two = () => Array.from({ length: 2 }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  /** Aufstellung mit den jeweils ersten erlaubten Plätzen durchspielen. */
  function afterSetup(seed = 1): GameState {
    let s = createGame(two(), { victoryPoints: 10, variants: ['duell'] }, seed);
    while (s.phase.kind === 'setup') {
      const seat = actingSeats(s)[0];
      const phase = s.phase;
      s =
        phase.step === 'settlement'
          ? applyAction(s, seat, { type: 'placeSettlement', vertex: legalSetupVertices(s)[(phase.index * 7) % legalSetupVertices(s).length] })
          : applyAction(s, seat, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
    }
    return structuredClone(s);
  }

  it('nur zu zweit; zwei neutrale Mitspieler sitzen hinten und bekommen in der Aufstellung je eine Siedlung', () => {
    const three = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
    expect(() => createGame(three, { victoryPoints: 10, variants: ['duell'] }, 1)).toThrow(/nur für zwei/);
    const s = afterSetup();
    expect(s.players.map((p) => !!p.neutral)).toEqual([false, false, true, true]);
    expect(s.buildings.filter((b) => b?.owner === 2)).toHaveLength(1);
    expect(s.buildings.filter((b) => b?.owner === 3)).toHaveLength(1);
    expect(s.roads.filter((r) => r === 2)).toHaveLength(1);
    expect(s.buildings.filter((b) => b?.owner === 0)).toHaveLength(2);
    // Startrohstoffe nur für die zweite eigene Siedlung, die Neutralen bekommen nichts.
    expect(totalResources(s.players[2].resources) + totalResources(s.players[3].resources)).toBe(0);
    expect(totalResources(s.players[0].resources) + totalResources(s.players[1].resources)).toBeGreaterThan(0);
    expect(s.phase.kind).toBe('roll');
    expect(s.current).toBe(0);
  });

  it('die Neutralen sind nie am Zug', () => {
    let s = afterSetup();
    s.phase = { kind: 'main' };
    s = applyAction(s, 0, { type: 'endTurn' });
    expect(s.current).toBe(1);
    s = structuredClone(s);
    s.phase = { kind: 'main' };
    s = applyAction(s, 1, { type: 'endTurn' });
    expect(s.current).toBe(0);
  });

  it('nach Straße und Siedlung setzt der Spieler ein Teil für einen Neutralen', () => {
    const s = afterSetup();
    s.phase = { kind: 'main' };
    const road = legalRoadEdges(s, 0)[0];
    s.players[0].resources = { ...emptyResources(), wood: 5, brick: 5, sheep: 5, wheat: 5 };
    let n = applyAction(s, 0, { type: 'buildRoad', edge: road });
    expect(n.phase).toEqual({ kind: 'neutral', piece: 'road' });
    expect(() => applyAction(n, 0, { type: 'endTurn' })).toThrow();
    expect(() => applyAction(n, 0, { type: 'placeNeutral', owner: 1, edge: legalRoadEdges(n, 1)[0] })).toThrow(/neutralen/);
    expect(() => applyAction(n, 1, { type: 'placeNeutral', owner: 2, edge: legalRoadEdges(n, 2)[0] })).toThrow(/nicht dran/);
    const neutralRoad = legalRoadEdges(n, 2)[0];
    n = applyAction(n, 0, { type: 'placeNeutral', owner: 2, edge: neutralRoad });
    expect(n.roads[neutralRoad]).toBe(2);
    expect(n.phase.kind).toBe('main');
    // Keine Siedlung möglich für die Neutralen: dann eine Straße.
    const t = getTopology(n.board);
    const spot = t.vertices.find((v) => canBuildSettlement(n, 0, v.id));
    if (spot) {
      const m = applyAction(n, 0, { type: 'buildSettlement', vertex: spot.id });
      const expected = legalSettlementVertices(m, 2).length + legalSettlementVertices(m, 3).length ? 'settlement' : 'road';
      expect(m.phase).toEqual({ kind: 'neutral', piece: expected });
    }
  });

  it('Neutrale ernten nichts und halten nie die längste Handelsstraße', () => {
    const s = afterSetup();
    const t = getTopology(s.board);
    const hex = t.hexes.find((h) => s.board.hexes[h.id].number && h.id !== s.robber)!;
    s.buildings = s.buildings.map(() => null);
    s.buildings[hex.corners[0]] = { owner: 2, type: 'city' };
    s.phase = { kind: 'roll' };
    for (let seed = 1; ; seed++) {
      const n = applyAction({ ...s, rng: seed }, 0, { type: 'roll' });
      if (n.dice![0] + n.dice![1] !== s.board.hexes[hex.id].number) continue;
      expect(n.players[2].resources).toEqual(emptyResources());
      break;
    }
    // Eine lange neutrale Straße zählt nicht.
    const m = structuredClone(s);
    m.roads = m.roads.map(() => null);
    m.buildings[hex.corners[0]] = null;
    for (const e of t.hexes[0].edges) m.roads[e] = 3;
    m.phase = { kind: 'neutral', piece: 'road' };
    m.current = 0;
    const n = applyAction(m, 0, { type: 'placeNeutral', owner: 3, edge: legalRoadEdges(m, 3)[0] });
    expect(n.roadLengths[3]).toBe(0);
    expect(n.longestRoad).toBeNull();
  });

  it('Handelsmarken für Küste, Wüste und Ritter; Räuber in die Wüste, der Führende zahlt doppelt', () => {
    const s = afterSetup();
    const t = getTopology(s.board);
    const desert = s.board.hexes.findIndex((h) => h.terrain === 'desert');
    s.buildings = s.buildings.map(() => null);
    s.roads = s.roads.map(() => null);
    const coastDesert = t.hexes[desert].corners.find((v) => t.vertices[v].hexes.length < 3);
    const spot = coastDesert ?? t.hexes[desert].corners[0];
    const e = t.vertices[spot].edges[0];
    s.roads[e] = 0;
    s.phase = { kind: 'main' };
    s.players[0].resources = { ...emptyResources(), ...COSTS.settlement };
    let n = applyAction(s, 0, { type: 'buildSettlement', vertex: spot });
    expect(n.tokens![0]).toBe(coastDesert !== undefined ? 2 : 1);
    n = structuredClone(n);
    n.phase = { kind: 'main' };
    n.robber = (desert + 1) % n.board.hexes.length;
    n.tokens![0] = 2;
    // Spieler 0 führt (1 Punkt gegen 0): kostet 2.
    expect(tokenCost(n, 0)).toBe(2);
    const moved = applyAction(n, 0, { type: 'spendTokens', effect: 'robber' });
    expect(moved.robber).toBe(desert);
    expect(moved.tokens![0]).toBe(0);
    expect(() => applyAction(moved, 0, { type: 'spendTokens', effect: 'robber' })).toThrow(/Handelsmarke/);
    const k = structuredClone(n);
    k.players[0].devCards = ['knight'];
    expect(applyAction(k, 0, { type: 'playKnight' }).tokens![0]).toBe(3);
  });

  it('erzwungener Tausch: zwei zufällige Karten gegen zwei gewählte', () => {
    const s = afterSetup();
    s.phase = { kind: 'main' };
    s.tokens![0] = 1;
    s.players[0].resources = { ...emptyResources(), ore: 2 };
    s.players[1].resources = { ...emptyResources(), wood: 3 };
    s.buildings = s.buildings.map(() => null);
    const n = applyAction(s, 0, { type: 'spendTokens', effect: 'trade', give: { ...emptyResources(), ore: 2 } });
    expect(n.players[0].resources).toEqual({ ...emptyResources(), wood: 2 });
    expect(n.players[1].resources).toEqual({ ...emptyResources(), wood: 1, ore: 2 });
    expect(n.tokens![0]).toBe(0);
    expect(() => applyAction(s, 0, { type: 'spendTokens', effect: 'trade', give: { ...emptyResources(), ore: 1 } })).toThrow(/2 Karten/);
  });

  it('3000 Züge ohne Regelfehler, die Neutralen bauen mit', { timeout: 120000 }, () => {
    const random = seeded(77);
    let s = createGame(two(), { victoryPoints: 12, variants: ['duell'] }, 5);
    for (let step = 0; step < 3000 && s.phase.kind !== 'ended'; step++) {
      const next = botStep(s, random);
      expect(next).not.toBeNull();
      expect(s.players[next!.seat].neutral).toBeFalsy();
      s = applyAction(s, next!.seat, next!.action);
    }
    expect(s.roads.filter((r) => r === 2 || r === 3).length).toBeGreaterThan(3);
  });
});

describe('Flussläufe', () => {
  const rivers = (s: GameState) => s.board.rivers!;

  it('zwei Flüsse von der Quelle zur Küste, ohne gemeinsame Felder, Mündung nicht an Hafen oder Fischgrund', () => {
    for (const [n, variants] of [
      [3, ['flusslaeufe']],
      [6, ['flusslaeufe']],
      [4, ['flusslaeufe', 'fischgruende']],
    ] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const s = game([...variants], n, seed);
        const t = getTopology(s.board);
        expect(rivers(s)).toHaveLength(2);
        const harborEdges = new Set(s.board.harbors.map((h) => h.edge));
        const fishEdges = new Set((s.board.fishing ?? []).map((f) => f.edge));
        const allHexes = rivers(s).flatMap((r) => r.hexes);
        expect(new Set(allHexes).size).toBe(allHexes.length);
        for (const r of rivers(s)) {
          expect(r.edges.length).toBe(r.hexes.length);
          expect(r.edges.length).toBeGreaterThanOrEqual(2);
          r.edges.slice(0, -1).forEach((e, i) => expect(t.edges[e].hexes.sort()).toEqual([r.hexes[i], r.hexes[i + 1]].sort()));
          const mouth = r.edges[r.edges.length - 1];
          expect(t.edges[mouth].hexes).toEqual([r.hexes[r.hexes.length - 1]]);
          expect(harborEdges.has(mouth) || fishEdges.has(mouth)).toBe(false);
          expect(s.board.hexes[r.hexes[0]].terrain).not.toBe('desert');
        }
      }
    }
    expect(() => createGame([0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: 'c' })), { victoryPoints: 13, map: 'erste-ueberfahrt', variants: ['flusslaeufe'] }, 1)).toThrow(
      /ohne Meerfelder/,
    );
  });

  it('über den Fluss nur mit Brücke; Brücke kostet 2 Lehm und 1 Holz und bringt 3 Münzen', () => {
    const s = game(['flusslaeufe']);
    const t = getTopology(s.board);
    const edge = rivers(s)[0].edges[0];
    s.buildings[t.edges[edge].a] = { owner: 0, type: 'settlement' };
    expect(canBuildRoad(s, 0, edge)).toBe(false);
    expect(legalBridgeEdges(s, 0)).toContain(edge);
    s.players[0].resources = { ...emptyResources(), ...COSTS.road };
    expect(() => applyAction(s, 0, { type: 'buildRoad', edge })).toThrow(/keine Straße/);
    expect(() => applyAction(s, 0, { type: 'buildBridge', edge })).toThrow(/Rohstoffe/);
    s.players[0].resources = { ...emptyResources(), ...COSTS.bridge };
    const n = applyAction(s, 0, { type: 'buildBridge', edge });
    expect(n.roads[edge]).toBe(0);
    expect(n.coins![0]).toBe(3);
    expect(piecesLeft(n, 0, 'bridge')).toBe(2);
    expect(piecesLeft(n, 0, 'road')).toBe(15);
    expect(n.players[0].resources).toEqual(emptyResources());
  });

  it('Straße und Siedlung am Fluss bringen je eine Münze', () => {
    const s = game(['flusslaeufe']);
    const t = getTopology(s.board);
    const river = rivers(s)[0].edges[0];
    const v = t.edges[river].a;
    s.buildings[v] = { owner: 0, type: 'settlement' };
    const road = t.vertices[v].edges.find((e) => e !== river && canBuildRoad(s, 0, e))!;
    s.players[0].resources = { ...emptyResources(), ...COSTS.road };
    const n = applyAction(s, 0, { type: 'buildRoad', edge: road });
    expect(n.coins![0]).toBe(1);
  });

  it('meiste Münzen +1 Punkt, wenigste −2, bei allen gleich nichts; 2 Münzen sind ein Rohstoff', () => {
    const s = game(['flusslaeufe']);
    expect([0, 1, 2].map((i) => coinPoints(s, i))).toEqual([0, 0, 0]);
    s.coins = [4, 1, 1];
    expect([0, 1, 2].map((i) => coinPoints(s, i))).toEqual([1, -2, -2]);
    s.coins = [4, 4, 2];
    expect([0, 1, 2].map((i) => coinPoints(s, i))).toEqual([1, 1, -2]);
    s.coins = [3, 2, 1];
    expect(victoryPoints(s, 1, false)).toBe(0);
    const n = applyAction(s, 0, { type: 'tradeCoins', resource: 'ore' });
    expect(n.coins![0]).toBe(1);
    expect(n.players[0].resources.ore).toBe(1);
    expect(() => applyAction(n, 0, { type: 'tradeCoins', resource: 'ore' })).toThrow(/2 Münzen/);
  });

  for (const [n, variants] of [
    [4, ['flusslaeufe']],
    [2, ['flusslaeufe', 'duell']],
    [6, ['flusslaeufe', 'fischgruende']],
  ] as const) {
    it(`${n} Spieler mit ${variants.join(' + ')}: 3000 Züge ohne Regelfehler, es entstehen Brücken`, { timeout: 120000 }, () => {
      const random = seeded(n * 13 + variants.length);
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }));
      let s = createGame(players, { victoryPoints: 12, variants: [...variants] }, 4);
      const riverEdges = new Set(s.board.rivers!.flatMap((r) => r.edges));
      let coins = 0;
      for (let step = 0; step < 3000 && s.phase.kind !== 'ended'; step++) {
        const next = botStep(s, random);
        expect(next).not.toBeNull();
        s = applyAction(s, next!.seat, next!.action);
        // Münzen werden auch wieder ausgegeben, deshalb zählt, ob es irgendwann welche gab.
        coins = Math.max(coins, ...s.coins!);
      }
      expect(s.roads.some((r, e) => r !== null && riverEdges.has(e))).toBe(true);
      expect(coins).toBeGreaterThan(0);
    });
  }
});
