import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { getTopology } from './board';
import { applyAction, canImprove, createGame, defenseOf, guardTargets, handLimit, isMetropolis, legalGuardVertices, legalRoadEdges, legalSetupRoads, legalSetupVertices, longestRoad, raiderStrength, tradeRate, victoryPoints } from './rules';
import { isConsistent, rebuild, Secret, secretOf, viewFor } from './secrets';
import { COMMODITIES, count, emptyResources, GameState, ResourceCounts, totalResources } from './types';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
}

/** Ein Spiel nach der Aufstellung, Spieler 0 am Zug in der Hauptphase. */
function game(n = 3, seed = 1): GameState {
  let s = createGame(players(n), { victoryPoints: 13, variants: ['stadtwacht'] }, seed);
  while (s.phase.kind === 'setup') {
    const phase = s.phase;
    const seat = phase.order[phase.index];
    s =
      phase.step === 'settlement'
        ? applyAction(s, seat, { type: 'placeSettlement', vertex: legalSetupVertices(s)[(phase.index * 5) % legalSetupVertices(s).length] })
        : applyAction(s, seat, { type: 'placeRoad', edge: legalSetupRoads(s)[0] });
  }
  s = structuredClone(s);
  s.phase = { kind: 'main' };
  s.current = 0;
  return s;
}

const hand = (r: Partial<ResourceCounts>): ResourceCounts => ({ ...emptyResources(), ...r });
const cityOf = (s: GameState, seat: number) => s.buildings.findIndex((b) => b?.owner === seat && b.type === 'city');

/** Würfelt mit wechselndem Zufall, bis die gewünschte Summe fällt. */
function rollTo(s: GameState, sum: number): GameState {
  const t = structuredClone(s);
  t.phase = { kind: 'roll' };
  for (let seed = 1; ; seed++) {
    const n = applyAction({ ...t, rng: seed }, t.current, { type: 'roll' });
    if (n.dice![0] + n.dice![1] === sum) return n;
  }
}

describe('Stadtwacht I: Aufbau', () => {
  it('zweite Startfigur ist eine Stadt; Güter in der Bank, keine Entwicklungskarten', () => {
    const s = game();
    for (let seat = 0; seat < 3; seat++) {
      expect(s.buildings.filter((b) => b?.owner === seat && b.type === 'city')).toHaveLength(1);
      expect(s.buildings.filter((b) => b?.owner === seat && b.type === 'settlement')).toHaveLength(1);
    }
    for (const c of COMMODITIES) expect(count(s.bank, c)).toBe(12);
    expect(s.devDeck).toEqual([]);
    expect(s.improvements).toEqual([0, 1, 2].map(() => ({ market: 0, council: 0, scholars: 0 })));
    s.players[0].resources = hand({ sheep: 1, wheat: 1, ore: 1 });
    expect(() => applyAction(s, 0, { type: 'buyDevCard' })).toThrow(/keine Entwicklungskarten/);
  });
});

describe('Stadtwacht I: Güter', () => {
  it('Städte auf Wald, Weide, Gebirge liefern 1 Rohstoff + 1 Gut, sonst 2 Rohstoffe', () => {
    const base = game();
    const t = getTopology(base.board);
    for (const [terrain, good] of [
      ['wood', 'paper'],
      ['sheep', 'cloth'],
      ['ore', 'coin'],
      ['brick', null],
    ] as const) {
      const s = structuredClone(base);
      s.buildings = s.buildings.map(() => null);
      const hex = t.hexes.find((h) => s.board.hexes[h.id].terrain === terrain && s.board.hexes[h.id].number && h.id !== s.robber)!;
      s.buildings[hex.corners[0]] = { owner: 1, type: 'city' };
      s.players.forEach((p) => (p.resources = emptyResources()));
      const n = rollTo(s, s.board.hexes[hex.id].number!);
      const got = n.players[1].resources;
      if (good) {
        expect(count(got, terrain)).toBe(1);
        expect(count(got, good)).toBe(1);
      } else {
        expect(count(got, terrain)).toBe(2);
      }
    }
  });

  it('Güter zählen zum Limit, werden beim Abwerfen und Rauben mitgenommen und gehen 4:1 an die Bank', () => {
    const s = game();
    s.players[1].resources = hand({ paper: 4, cloth: 4 });
    expect(totalResources(s.players[1].resources)).toBe(8);
    const seven = rollTo(s, 7);
    expect(seven.phase).toMatchObject({ kind: 'discard' });
    expect((seven.phase as { pending: number[] }).pending[1]).toBe(4);
    const after = applyAction(seven, 1, { type: 'discard', resources: hand({ paper: 4 }) });
    expect(count(after.players[1].resources, 'paper')).toBe(0);
    expect(count(after.bank, 'paper')).toBe(count(seven.bank, 'paper') + 4);
    s.players[0].resources = hand({ coin: 4 });
    const traded = applyAction(s, 0, { type: 'bankTrade', give: 'coin', get: 'ore' });
    expect(traded.players[0].resources).toEqual(hand({ coin: 0, ore: 1 }));
  });
});

describe('Stadtwacht I: Stadtausbau', () => {
  it('Stufe n kostet n Güter der Richtung und braucht eine Stadt', () => {
    const s = game();
    s.players[0].resources = hand({ cloth: 3 });
    let n = applyAction(s, 0, { type: 'improveCity', track: 'market' });
    n = applyAction(n, 0, { type: 'improveCity', track: 'market' });
    expect(n.improvements![0].market).toBe(2);
    expect(count(n.players[0].resources, 'cloth')).toBe(0);
    expect(() => applyAction(n, 0, { type: 'improveCity', track: 'market' })).toThrow(/Rohstoffe/);
    const noCity = structuredClone(s);
    noCity.buildings = noCity.buildings.map((b) => (b?.owner === 0 && b.type === 'city' ? { ...b, type: 'settlement' } : b));
    expect(canImprove(noCity, 0, 'market')).toBe(false);
    expect(() => applyAction(noCity, 0, { type: 'improveCity', track: 'market' })).toThrow(/Stadt/);
  });

  it('als Erster auf Stufe 4 gibt eine Prachtstadt (+2); auf Stufe 5 übernimmt man sie, wenn der Inhaber nur 4 hat', () => {
    const s = game();
    s.improvements![1].scholars = 3;
    s.improvements![0].scholars = 3;
    s.players[1].resources = hand({ paper: 4 });
    s.current = 1;
    const one = applyAction(s, 1, { type: 'improveCity', track: 'scholars' });
    expect(one.metropolis!.scholars).toBe(cityOf(s, 1));
    expect(victoryPoints(one, 1, false) - victoryPoints(s, 1, false)).toBe(2);
    // Spieler 0 erreicht Stufe 4: keine Prachtstadt, sie ist vergeben.
    const two = structuredClone(one);
    two.current = 0;
    two.players[0].resources = hand({ paper: 9 });
    const four = applyAction(two, 0, { type: 'improveCity', track: 'scholars' });
    expect(four.metropolis!.scholars).toBe(cityOf(s, 1));
    // Stufe 5 vor dem Inhaber: übernommen.
    const five = applyAction(four, 0, { type: 'improveCity', track: 'scholars' });
    expect(five.metropolis!.scholars).toBe(cityOf(s, 0));
    expect(isMetropolis(five, cityOf(s, 1))).toBe(false);
    expect(victoryPoints(five, 1, false)).toBe(victoryPoints(s, 1, false));
  });

  it('mit mehreren Städten muss man wählen, welche Prachtstadt wird', () => {
    const s = game();
    const t = getTopology(s.board);
    const other = t.vertices.find((v) => s.buildings[v.id] === null && v.neighbors.every((w) => s.buildings[w] === null))!.id;
    s.buildings[other] = { owner: 0, type: 'city' };
    s.improvements![0].council = 3;
    s.players[0].resources = hand({ coin: 4 });
    expect(() => applyAction(s, 0, { type: 'improveCity', track: 'council' })).toThrow(/Wähle die Stadt/);
    expect(applyAction(s, 0, { type: 'improveCity', track: 'council', vertex: other }).metropolis!.council).toBe(other);
  });

  it('Markt ab Stufe 3: Güter 2:1; Gelehrte ab Stufe 3: wer nichts bekommt, wählt einen Rohstoff', () => {
    const s = game();
    expect(tradeRate(s, 0, 'cloth')).toBeGreaterThan(2);
    s.improvements![0].market = 3;
    expect(tradeRate(s, 0, 'cloth')).toBe(2);
    expect(tradeRate(s, 0, 'wood')).toBeGreaterThanOrEqual(3);
    // Gelehrte: Spieler 2 hat nichts auf der gewürfelten Zahl.
    const g = structuredClone(s);
    g.improvements![2].scholars = 3;
    const t = getTopology(g.board);
    let rolled: GameState | null = null;
    for (let sum = 2; sum <= 12 && !rolled; sum++) {
      if (sum === 7) continue;
      const hits = t.hexes.some((h) => g.board.hexes[h.id].number === sum && h.corners.some((v) => g.buildings[v]?.owner === 2));
      if (!hits) rolled = rollTo(g, sum);
    }
    expect(rolled!.phase).toMatchObject({ kind: 'gold' });
    expect((rolled!.phase as { pending: number[] }).pending[2]).toBe(1);
  });
});

describe('Stadtwacht I: Palisaden', () => {
  it('2 Lehm, nur unter eigener Stadt, höchstens 3, je +2 Handkartenlimit', () => {
    const s = game();
    const city = cityOf(s, 0);
    s.players[0].resources = hand({ brick: 2 });
    expect(handLimit(s, 0)).toBe(7);
    const n = applyAction(s, 0, { type: 'buildWall', vertex: city });
    expect(handLimit(n, 0)).toBe(9);
    expect(() => applyAction({ ...n, players: n.players.map((p, i) => (i ? p : { ...p, resources: hand({ brick: 2 }) })) }, 0, { type: 'buildWall', vertex: city })).toThrow(
      /schon eine Palisade/,
    );
    expect(() => applyAction(s, 0, { type: 'buildWall', vertex: cityOf(s, 1) })).toThrow(/eigene Stadt/);
    // Mit 9 Karten und Palisade wird bei der 7 nicht abgeworfen.
    const w = structuredClone(n);
    w.players[0].resources = hand({ wood: 9 });
    w.players.slice(1).forEach((p) => (p.resources = emptyResources()));
    expect(rollTo(w, 7).phase.kind).not.toBe('discard');
  });
});

describe('Stadtwacht I: im Spiel', () => {
  it('verdeckte Hände mit Gütern lassen sich wieder aufbauen', () => {
    let s = createGame(players(4), { victoryPoints: 30, variants: ['stadtwacht'] }, 3);
    const random = seeded(31);
    for (let i = 0; i < 900; i++) {
      const next = botStep(s, random)!;
      s = applyAction(s, next.seat, next.action);
    }
    expect(isConsistent(s)).toBe(true);
    const { state, dealt } = rebuild(viewFor(s, 0), new Map<number, Secret>([[0, secretOf(s, 0)!]]), { rng: 1 });
    expect(dealt).toEqual([1, 2, 3]);
    expect(isConsistent(state)).toBe(true);
    for (const i of [1, 2, 3]) expect(totalResources(state.players[i].resources)).toBe(totalResources(s.players[i].resources));
  });

  for (const n of [3, 4, 6]) {
    it(`${n} Spieler: 3000 Züge ohne Regelfehler, es wird ausgebaut`, { timeout: 120000 }, () => {
      const random = seeded(n * 41);
      let s = createGame(players(n), { victoryPoints: 13, variants: ['stadtwacht'] }, 11);
      let best = 0;
      let guards = 0;
      for (let step = 0; step < 3000 && s.phase.kind !== 'ended'; step++) {
        const next = botStep(s, random);
        expect(next).not.toBeNull();
        s = applyAction(s, next!.seat, next!.action);
        best = Math.max(best, ...s.improvements!.flatMap((i) => [i.market, i.council, i.scholars]));
        guards = Math.max(guards, s.guards!.filter(Boolean).length);
        expect(isConsistent(s)).toBe(true);
      }
      expect(best).toBeGreaterThan(0);
      expect(guards).toBeGreaterThan(0);
      expect(s.raiders!.attacked).toBe(true);
    });
  }
});

describe('Stadtwacht II: Plündererflotte', () => {
  /** Würfelt so lange, bis Summe und Ereignis passen. */
  function rollWith(s: GameState, sum: number, event: string): GameState {
    const t = structuredClone(s);
    t.phase = { kind: 'roll' };
    for (let seed = 1; ; seed++) {
      const n = applyAction({ ...t, rng: seed }, t.current, { type: 'roll' });
      if (n.dice![0] + n.dice![1] === sum && n.event === event) return n;
    }
  }

  it('ein Schiff rückt die Flotte vor, ein Tor nicht', () => {
    const s = game();
    expect(rollWith(s, 8, 'ship').raiders!.position).toBe(1);
    expect(rollWith(s, 8, 'market').raiders!.position).toBe(0);
  });

  it('ohne Verteidigung verliert, wer am wenigsten beigetragen hat, eine Stadt; Prachtstädte sind sicher', () => {
    const s = game();
    s.raiders!.position = 6;
    // Spieler 1 verteidigt mit einem bereiten Wächter, Spieler 0 und 2 nicht.
    const t = getTopology(s.board);
    const spot = legalGuardVertices(s, 1)[0];
    s.guards![spot] = { owner: 1, level: 1, active: true };
    s.metropolis!.market = cityOf(s, 2);
    expect(raiderStrength(s)).toBe(3);
    expect(defenseOf(s, 1)).toBe(1);
    const n = rollWith(s, 8, 'ship');
    expect(n.raiders).toEqual({ position: 0, attacked: true });
    expect(n.buildings[cityOf(s, 0)]?.type).toBe('settlement');
    expect(n.buildings[cityOf(s, 1)]?.type).toBe('city');
    expect(n.buildings[cityOf(s, 2)]?.type).toBe('city');
    // Danach ruhen alle Wächter.
    expect(n.guards![spot]!.active).toBe(false);
    expect(t.vertices.length).toBeGreaterThan(0);
  });

  it('mit mehreren Städten wählt der Spieler, welche fällt; danach geht der Wurf weiter', () => {
    const s = game();
    s.raiders!.position = 6;
    const t = getTopology(s.board);
    const other = t.vertices.find((v) => s.buildings[v.id] === null && v.neighbors.every((w) => s.buildings[w] === null))!.id;
    s.buildings[other] = { owner: 0, type: 'city' };
    s.walls = [other];
    const n = rollWith(s, 8, 'ship');
    expect(n.phase).toMatchObject({ kind: 'raid', sum: 8 });
    expect(() => applyAction(n, 0, { type: 'loseCity', vertex: cityOf(s, 1) })).toThrow(/eigene Stadt/);
    const after = applyAction(n, 0, { type: 'loseCity', vertex: other });
    expect(after.buildings[other]?.type).toBe('settlement');
    expect(after.walls).toEqual([]);
    expect(['main', 'gold']).toContain(after.phase.kind);
  });

  it('genug Verteidigung: der stärkste Beitrag bekommt einen Ehrenschild (+1)', () => {
    const s = game();
    s.raiders!.position = 6;
    const [a, b] = legalGuardVertices(s, 0);
    s.guards![a] = { owner: 0, level: 2, active: true };
    s.guards![b] = { owner: 0, level: 1, active: true };
    const n = rollWith(s, 8, 'ship');
    expect(n.honors).toEqual([1, 0, 0]);
    expect(victoryPoints(n, 0, false) - victoryPoints(s, 0, false)).toBe(1);
  });

  it('der Räuber kommt erst nach dem ersten Angriff ins Spiel', () => {
    const s = game();
    s.players.forEach((p) => (p.resources = emptyResources()));
    expect(rollWith(s, 7, 'market').phase.kind).toBe('main');
    s.raiders!.attacked = true;
    expect(rollWith(s, 7, 'market').phase.kind).toBe('robber');
  });
});

describe('Stadtwacht II: Wächter', () => {
  it('aufstellen an der eigenen Straße, aufwerten, bereit machen; Stufe 3 erst mit dem Rat auf 3', () => {
    let s = game();
    const v = legalGuardVertices(s, 0)[0];
    s.players[0].resources = hand({ sheep: 3, ore: 3, wheat: 1 });
    s = applyAction(s, 0, { type: 'buildGuard', vertex: v });
    expect(s.guards![v]).toEqual({ owner: 0, level: 1, active: false });
    s = applyAction(s, 0, { type: 'upgradeGuard', vertex: v });
    expect(s.guards![v]!.level).toBe(2);
    expect(() => applyAction(s, 0, { type: 'upgradeGuard', vertex: v })).toThrow(/Rat auf Stufe 3/);
    s = structuredClone(s);
    s.improvements![0].council = 3;
    s = applyAction(s, 0, { type: 'upgradeGuard', vertex: v });
    expect(s.guards![v]!.level).toBe(3);
    s = applyAction(s, 0, { type: 'activateGuard', vertex: v });
    expect(s.guards![v]!.active).toBe(true);
    expect(s.players[0].resources).toEqual(hand({}));
    // Gerade bereit gemacht: handelt erst im nächsten Zug.
    expect(() => applyAction(s, 0, { type: 'chaseRobber', vertex: v })).toThrow(/nächsten Zug/);
  });

  it('blockiert die Ecke und unterbricht fremde Straßen', () => {
    const s = game();
    const t = getTopology(s.board);
    const v = legalGuardVertices(s, 1)[0];
    s.guards![v] = { owner: 1, level: 1, active: false };
    // Spieler 0 kann über die Ecke mit dem fremden Wächter nicht weiterbauen.
    const through = t.vertices[v].edges.filter((e) => s.roads[e] === null);
    s.roads[t.vertices[v].edges.find((e) => s.roads[e] === null)!] = 0;
    for (const e of through) if (s.roads[e] === null) expect(legalRoadEdges(s, 0)).not.toContain(e);
    expect(longestRoad(s, 0)).toBeLessThanOrEqual(longestRoad({ ...s, guards: s.guards!.map(() => null) }, 0));
  });

  it('zieht über eigene Straßen, verdrängt schwächere fremde Wächter, vertreibt den Räuber', () => {
    const s = game();
    const t = getTopology(s.board);
    // Eine Straßenkette von Spieler 0 mit Wächter am Anfang und fremdem Wächter am Ende.
    const start = legalGuardVertices(s, 0)[0];
    const road = t.vertices[start].edges.find((e) => s.roads[e] === null)!;
    s.roads[road] = 0;
    const far = t.edges[road].a === start ? t.edges[road].b : t.edges[road].a;
    s.buildings[far] = null;
    s.guards![start] = { owner: 0, level: 2, active: true, ready: 0 };
    s.guards![far] = { owner: 2, level: 1, active: true };
    expect(guardTargets(s, 0, start)).toContain(far);
    const n = applyAction(s, 0, { type: 'moveGuard', from: start, to: far });
    expect(n.guards![far]).toMatchObject({ owner: 0, level: 2, active: false });
    expect(n.guards![start]).toBeNull();
    expect(n.phase).toMatchObject({ kind: 'displace', seat: 2 });
    const spot = legalGuardVertices(n, 2)[0];
    expect(() => applyAction(n, 2, { type: 'placeDisplaced', vertex: null })).toThrow(/Platz/);
    const placed = applyAction(n, 2, { type: 'placeDisplaced', vertex: spot });
    expect(placed.phase.kind).toBe('main');
    expect(placed.guards![spot]).toMatchObject({ owner: 2, level: 1 });
    // Räuber vertreiben: Wächter an einem Feld des Räubers.
    const r = structuredClone(s);
    r.raiders!.attacked = true;
    r.robber = t.vertices[start].hexes.find((h) => !t.hexes[h].sea)!;
    const chased = applyAction(r, 0, { type: 'chaseRobber', vertex: start });
    expect(chased.phase).toEqual({ kind: 'robber', returnTo: 'main' });
    expect(chased.guards![start]!.active).toBe(false);
  });
});
