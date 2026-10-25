import { describe, expect, it } from 'vitest';
import { getTopology, homeIsland } from './board';
import {
  actingSeats,
  applyAction,
  attackableFortress,
  canBuildShip,
  caravanEnd,
  caravanPoints,
  camelOptions,
  createGame,
  harborSpots,
  isFreeForSettlement,
  legalRobberHexes,
  legalSetupVertices,
  longestRoad,
  plainShips,
  regionsOf,
  tradeRate,
  victoryPoints,
  villageConnected,
} from './rules';
import { botAction } from './bot';
import { viewFor } from './secrets';
import { COSTS, emptyResources, GameState, ResourceCounts } from './types';
import { mapById } from './maps';
import { VariantId, WONDERS } from './variants';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
}

function game(map: string, variants: VariantId[] = [], n = 3, seed = 1): GameState {
  const s = structuredClone(createGame(players(n), { victoryPoints: 13, map, variants }, seed));
  s.phase = { kind: 'main' };
  s.current = 0;
  s.turn = 1;
  s.dice = [3, 4];
  return s;
}

const res = (r: Partial<ResourceCounts>): ResourceCounts => ({ ...emptyResources(), ...r });
const isSea = (s: GameState, h: number) => s.board.hexes[h].terrain === 'sea';

/** Eine Kante an der Ecke, die ans Meer grenzt und nicht `not` ist: Platz für ein Schiff dorthin. */
function seaEdgeAt(s: GameState, vertex: number, not = -1): number {
  const t = getTopology(s.board);
  return t.vertices[vertex].edges.find((e) => e !== not && t.edges[e].hexes.some((h) => isSea(s, h)))!;
}

/** Würfelt so lange mit anderem Zufall, bis die Summe passt. */
function rollUntil(s: GameState, sum: number): GameState {
  for (let seed = 1; seed < 5000; seed++) {
    const t = structuredClone(s);
    t.rng = seed;
    t.phase = { kind: 'roll' };
    const next = applyAction(t, t.current, { type: 'roll' });
    if (next.dice![0] + next.dice![1] === sum) return next;
  }
  throw new Error(`keine ${sum} gewürfelt`);
}

describe('Sandmeer', () => {
  it('startet im größten Gebiet diesseits der Wüste', () => {
    const s = createGame(players(3), { victoryPoints: 14, map: 'sandmeer' }, 1);
    const t = getTopology(s.board);
    const regions = regionsOf(s.board);
    const sizes = new Map<number, number>();
    for (const r of regions) if (r >= 0) sizes.set(r, (sizes.get(r) ?? 0) + 1);
    const home = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
    const spots = legalSetupVertices(s);
    expect(spots.length).toBeGreaterThan(10);
    for (const v of spots) expect(t.vertices[v].hexes.some((h) => regions[h] === home)).toBe(true);
    // Mindestens fünf Wüstenfelder bilden den Streifen.
    expect(s.board.hexes.filter((h) => h.terrain === 'desert').length).toBeGreaterThanOrEqual(5);
  });

  it('neues Gebiet jenseits der Wüste: 1 Punkt, neue Insel: 2 Punkte, danach nichts mehr', () => {
    const s = game('sandmeer');
    const t = getTopology(s.board);
    const regions = regionsOf(s.board);
    const island = homeIsland(t).id;
    const regionOf = (v: number) => t.vertices[v].hexes.map((h) => regions[h]).find((r) => r >= 0) ?? -1;
    const inland = (v: number, test: (h: number) => boolean) => t.vertices[v].hexes.length === 3 && t.vertices[v].hexes.every(test);
    const home = regionOf(legalSetupVertices(s)[0]);
    const a = t.vertices.find((v) => inland(v.id, (h) => regions[h] === home))!.id;
    s.buildings[a] = { owner: 0, type: 'settlement' };
    // Ein anderes Gebiet derselben Insel, eine Straße liegt schon dort.
    const b = t.vertices.find((v) => isFreeForSettlement(s, v.id) && inland(v.id, (h) => regions[h] >= 0 && regions[h] !== home && t.islands[h] === island))!.id;
    s.roads[t.vertices[b].edges[0]] = 0;
    s.players[0].resources = res({ wood: 2, brick: 2, sheep: 2, wheat: 2 });
    let next = applyAction(s, 0, { type: 'buildSettlement', vertex: b });
    expect(next.islandBonus![0]).toBe(1);
    expect(next.log.at(-1)!.text).toMatch(/neues Gebiet/);
    // Eine kleine Insel, per Schiff erreicht.
    const c = t.vertices.find((v) => isFreeForSettlement(next, v.id) && v.hexes.some((h) => t.islands[h] >= 0 && t.islands[h] !== island) && v.hexes.some((h) => isSea(next, h)))!.id;
    next.ships![seaEdgeAt(next, c)] = 0;
    next = applyAction(next, 0, { type: 'buildSettlement', vertex: c });
    expect(next.islandBonus![0]).toBe(3);
    expect(victoryPoints(next, 0, false)).toBe(3 + 3);
  });
});

describe('Die Verschollenen', () => {
  it('bewohnte Inseln: keine Zahlen, keine Siedlungen, keine Häfen, Geschenke an ihren Küsten', () => {
    const s = createGame(players(4), { victoryPoints: 13, map: 'die-verschollenen' }, 2);
    const t = getTopology(s.board);
    const tribe = new Set(s.board.tribe);
    expect(tribe.size).toBe(12);
    for (const h of tribe) expect(s.board.hexes[h].number).toBeNull();
    for (const v of t.vertices) if (v.hexes.some((h) => tribe.has(h))) expect(isFreeForSettlement(s, v.id)).toBe(false);
    for (const harbor of s.board.harbors) expect(t.edges[harbor.edge].hexes.some((h) => tribe.has(h))).toBe(false);
    expect(s.gifts!.length).toBe(12);
    for (const g of s.gifts!) expect(t.edges[g.edge].hexes.some((h) => tribe.has(h)) && t.edges[g.edge].hexes.some((h) => isSea(s, h))).toBe(true);
    expect(legalRobberHexes(s).some((h) => tribe.has(h))).toBe(false);
  });

  for (const kind of ['point', 'dev', 'harbor'] as const) {
    it(`ein Schiff auf der Geschenkkante holt das Geschenk ab (${kind})`, () => {
      const s = game('die-verschollenen');
      const t = getTopology(s.board);
      const gift = s.gifts![0];
      gift.kind = kind;
      gift.harbor = kind === 'harbor' ? 'ore' : undefined;
      const edge = t.edges[gift.edge];
      s.ships![seaEdgeAt(s, edge.a, gift.edge)] = 0;
      s.players[0].resources = res({ wood: 1, sheep: 1 });
      expect(canBuildShip(s, 0, gift.edge)).toBe(true);
      const next = applyAction(s, 0, { type: 'buildShip', edge: gift.edge });
      expect(next.gifts!.length).toBe(s.gifts!.length - 1);
      if (kind === 'point') expect(victoryPoints(next, 0, false)).toBe(1);
      if (kind === 'dev') expect(next.players[0].newDevCards.length).toBe(1);
      if (kind === 'harbor') expect(next.harborGifts![0]).toEqual(['ore']);
    });
  }

  it('ein geschenkter Hafen kommt an eine eigene Küstensiedlung und gilt sofort', () => {
    const s = game('die-verschollenen');
    const t = getTopology(s.board);
    s.harborGifts![0] = ['ore'];
    const spot = t.vertices.find((v) => {
      if (!isFreeForSettlement(s, v.id) || !v.hexes.some((h) => isSea(s, h))) return false;
      const trial = structuredClone(s);
      trial.buildings[v.id] = { owner: 0, type: 'settlement' };
      return harborSpots(trial, 0).length > 0;
    })!.id;
    s.buildings[spot] = { owner: 0, type: 'settlement' };
    const edge = harborSpots(s, 0)[0];
    expect(tradeRate(s, 0, 'ore')).toBe(4);
    const next = applyAction(s, 0, { type: 'placeHarbor', edge });
    expect(next.board.harbors.length).toBe(s.board.harbors.length + 1);
    expect(next.harborGifts![0]).toEqual([]);
    expect(tradeRate(next, 0, 'ore')).toBe(2);
    expect(() => applyAction(next, 0, { type: 'placeHarbor', edge })).toThrow(/keinen Hafen/);
  });
});

describe('Stoffhandel', () => {
  it('Dörfer liegen an den Küsten der kleinen Inseln; ihre Kante und Ecken sind belegt', () => {
    const s = game('stoffhandel');
    const t = getTopology(s.board);
    const home = homeIsland(t).id;
    expect(s.villages!.length).toBe(8);
    for (const v of s.villages!) {
      const e = t.edges[v.edge];
      expect(e.hexes.some((h) => t.islands[h] >= 0 && t.islands[h] !== home)).toBe(true);
      expect(v.stock).toBe(5);
      expect(isFreeForSettlement(s, e.a)).toBe(false);
      s.ships![seaEdgeAt(s, e.a, v.edge)] = 0;
      expect(canBuildShip(s, 0, v.edge)).toBe(false);
    }
  });

  it('wer angebunden ist, bekommt bei der Zahl des Dorfes einen Ballen; 2 Ballen sind 1 Punkt', () => {
    const s = game('stoffhandel');
    const t = getTopology(s.board);
    const village = s.villages![0];
    const e = t.edges[village.edge];
    expect(villageConnected(s, 0, 0)).toBe(false);
    s.ships![seaEdgeAt(s, e.b, village.edge)] = 0;
    expect(villageConnected(s, 0, 0)).toBe(true);
    s.bales![0] = 1;
    const next = rollUntil(s, village.number);
    expect(next.bales![0]).toBe(2);
    expect(next.villages![0].stock).toBe(4);
    expect(victoryPoints(next, 0, false)).toBe(1);
    // Leer ist leer.
    const empty = structuredClone(s);
    empty.villages![0].stock = 0;
    expect(rollUntil(empty, village.number).bales![0]).toBe(1);
  });
});

describe('Freibeuterbuchten', () => {
  it('jeder hat eine Festung; dort und daneben siedelt niemand, das Kaperschiff lässt sich nicht versetzen', () => {
    const s = game('freibeuterbuchten');
    const t = getTopology(s.board);
    expect(s.fortresses!.map((f) => f.owner)).toEqual([0, 1, 2]);
    for (const f of s.fortresses!) {
      expect(isFreeForSettlement(s, f.vertex)).toBe(false);
      for (const w of t.vertices[f.vertex].neighbors) expect(isFreeForSettlement(s, w)).toBe(false);
    }
    expect(legalRobberHexes(s).some((h) => isSea(s, h))).toBe(false);
    expect(s.pirateRoute!.length).toBeGreaterThan(10);
    expect(s.pirateRoute).toContain(s.pirate);
  });

  it('das Kaperschiff fährt so weit, wie der erste Würfel zeigt', () => {
    const s = game('freibeuterbuchten');
    s.phase = { kind: 'roll' };
    const route = s.pirateRoute!;
    const before = route.indexOf(s.pirate!);
    const next = applyAction(s, 0, { type: 'roll' });
    expect(next.pirate).toBe(route[(before + next.dice![0]) % route.length]);
  });

  it('ein Ritter macht ein Schiff zum Kriegsschiff, statt den Räuber zu versetzen', () => {
    const s = game('freibeuterbuchten');
    const t = getTopology(s.board);
    const coast = t.vertices.find((v) => isFreeForSettlement(s, v.id) && v.hexes.some((h) => isSea(s, h)))!.id;
    s.buildings[coast] = { owner: 0, type: 'settlement' };
    const ship = seaEdgeAt(s, coast);
    s.ships![ship] = 0;
    s.players[0].devCards = ['knight'];
    let next = applyAction(s, 0, { type: 'playKnight' });
    expect(next.phase.kind).toBe('warship');
    next = applyAction(next, 0, { type: 'chooseWarship', edge: ship });
    expect(next.warships).toEqual([ship]);
    expect(next.phase.kind).toBe('main');
    expect(plainShips(next, 0)).toEqual([]);
  });

  it('die eigene Festung fällt nach drei gewonnenen Angriffen; verloren kostet das Schiff', () => {
    let s = game('freibeuterbuchten');
    const fort = s.fortresses![0];
    const ship = seaEdgeAt(s, fort.vertex);
    s.ships![ship] = 0;
    expect(attackableFortress(s, 0)).toBe(fort.vertex);
    expect(() => applyAction(s, 0, { type: 'attackFortress', vertex: s.fortresses![1].vertex })).toThrow(/eigene Festung/);
    let walls = 3;
    let lost = 0;
    for (let i = 0; i < 200 && walls > 0; i++) {
      s.fortressAttacked = false;
      s.ships![ship] = 0;
      s = applyAction(s, 0, { type: 'attackFortress', vertex: fort.vertex });
      expect(() => applyAction(s, 0, { type: 'attackFortress', vertex: fort.vertex })).toThrow(/schon angegriffen|schon erobert/);
      const now = s.fortresses![0].walls;
      expect(now === walls || now === walls - 1).toBe(true);
      if (s.ships![ship] === null) lost++;
      walls = now;
    }
    expect(walls).toBe(0);
    expect(lost).toBeGreaterThan(0);
    expect(s.buildings[fort.vertex]).toEqual({ owner: 0, type: 'settlement' });
  });

  it('gewinnen kann nur, wer seine Festung erobert hat', () => {
    const s = game('freibeuterbuchten');
    s.islandBonus![0] = 20;
    s.players[0].resources = res({ wood: 8 });
    const blocked = applyAction(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expect(blocked.phase.kind).toBe('main');
    blocked.fortresses![0].walls = 0;
    blocked.buildings[blocked.fortresses![0].vertex] = { owner: 0, type: 'settlement' };
    const won = applyAction(blocked, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expect(won.phase.kind).toBe('ended');
    expect(won.winner).toBe(0);
  });
});

describe('Großbauten', () => {
  it('beginnen nur mit Voraussetzung, je Stufe 1 Punkt, vollendet gewinnt sofort', () => {
    let s = game('grossbauten');
    const t = getTopology(s.board);
    const cathedral = WONDERS.findIndex((w) => w.need === 'cities');
    const cost = WONDERS[cathedral].cost;
    s.players[0].resources = res({ brick: 8, wheat: 4, ore: 8, wood: 4 });
    expect(() => applyAction(s, 0, { type: 'buildWonder', wonder: cathedral })).toThrow(/zwei Städte/);
    const spots = t.vertices.filter((v) => isFreeForSettlement(s, v.id)).map((v) => v.id);
    s.buildings[spots[0]] = { owner: 0, type: 'city' };
    s.buildings[spots.find((v) => isFreeForSettlement(s, v))!] = { owner: 0, type: 'city' };
    s = applyAction(s, 0, { type: 'buildWonder', wonder: cathedral });
    expect(s.wonders![cathedral]).toEqual({ owner: 0, level: 1 });
    expect(victoryPoints(s, 0, false)).toBe(4 + 1);
    expect(s.players[0].resources.ore).toBe(8 - cost.ore);
    // Nur ein Bauwerk je Spieler, und fremde Bauwerke baut man nicht weiter.
    const lighthouse = WONDERS.findIndex((w) => w.need === 'harbor');
    expect(() => applyAction(s, 0, { type: 'buildWonder', wonder: lighthouse })).toThrow(/schon an einem Bauwerk/);
    const other = structuredClone(s);
    other.current = 1;
    other.players[1].resources = res({ brick: 2, wheat: 1, ore: 2 });
    expect(() => applyAction(other, 1, { type: 'buildWonder', wonder: cathedral })).toThrow(/baut schon/);
    s = applyAction(s, 0, { type: 'buildWonder', wonder: cathedral });
    s = applyAction(s, 0, { type: 'buildWonder', wonder: cathedral });
    expect(s.phase.kind).toBe('main');
    s = applyAction(s, 0, { type: 'buildWonder', wonder: cathedral });
    expect(s.phase.kind).toBe('ended');
    expect(s.winner).toBe(0);
  });
});

describe('Kamelzüge', () => {
  /** Siedlung für Sitz 0 an einer freien Ecke mit eigener Straße. */
  function buildAt(s: GameState, test: (v: number) => boolean = () => true): GameState {
    const t = getTopology(s.board);
    const v = t.vertices.find((x) => x.hexes.length === 3 && isFreeForSettlement(s, x.id) && test(x.id))!.id;
    s.roads[t.vertices[v].edges.find((e) => t.edges[e].hexes.length === 2)!] = 0;
    s.players[0].resources = res({ ...COSTS.settlement });
    return applyAction(s, 0, { type: 'buildSettlement', vertex: v });
  }

  it('drei Karawanen starten an der Oase in der Wüste', () => {
    const s = game('klassisch', ['kamelzuege']);
    const t = getTopology(s.board);
    expect(s.board.hexes[s.board.oasis!].terrain).toBe('desert');
    expect(s.caravans!.length).toBe(3);
    for (const c of s.caravans!) {
      expect(c.length).toBe(1);
      const e = t.edges[c[0]];
      expect(t.hexes[s.board.oasis!].corners.some((v) => v === e.a || v === e.b)).toBe(true);
      expect(t.hexes[s.board.oasis!].corners).not.toContain(caravanEnd(s, c));
    }
  });

  it('nach einer Siedlung bieten alle verdeckt; das höchste Gebot setzt das Kamel und alle zahlen', () => {
    const s = game('klassisch', ['kamelzuege']);
    s.players[1].resources = res({ wheat: 2, sheep: 1 });
    s.players[2].resources = res({ sheep: 1 });
    let next = buildAt(s);
    expect(next.phase.kind).toBe('camelVote');
    // Sitz 0 hat nach dem Bau weder Getreide noch Wolle und wird nicht gefragt.
    expect(actingSeats(next)).toEqual([1, 2]);
    next = applyAction(next, 1, { type: 'bidCamel', bid: res({ wheat: 2 }) });
    // Die anderen sehen nur, dass Sitz 1 fertig ist, nicht was er bietet.
    const seen = viewFor(next, 2);
    expect(seen.phase.kind === 'camelVote' && seen.phase.done[1] && seen.phase.bids[1] === null).toBe(true);
    expect(() => applyAction(next, 2, { type: 'bidCamel', bid: res({ wood: 1 }) })).toThrow(/Getreide und Wolle/);
    next = applyAction(next, 2, { type: 'bidCamel', bid: res({ sheep: 1 }) });
    expect(next.phase).toMatchObject({ kind: 'camelPlace', seat: 1 });
    expect(next.players[1].resources.wheat).toBe(0);
    expect(next.players[2].resources.sheep).toBe(0);
    const edge = camelOptions(next)[0];
    expect(() => applyAction(next, 2, { type: 'placeCamel', edge })).toThrow(/anderer Spieler/);
    next = applyAction(next, 1, { type: 'placeCamel', edge });
    expect(next.caravans!.flat()).toContain(edge);
    expect(next.phase.kind).toBe('main');
  });

  it('bietet niemand, setzt der Bauende; bei Gleichstand gewinnt, wer nach ihm zuerst kommt', () => {
    const s = game('klassisch', ['kamelzuege']);
    s.players[1].resources = res({ wheat: 1 });
    s.players[2].resources = res({ wheat: 1 });
    let none = buildAt(structuredClone(s));
    none = applyAction(none, 1, { type: 'bidCamel', bid: emptyResources() });
    none = applyAction(none, 2, { type: 'bidCamel', bid: emptyResources() });
    expect(none.phase).toMatchObject({ kind: 'camelPlace', seat: 0 });
    let tie = buildAt(structuredClone(s));
    tie = applyAction(tie, 2, { type: 'bidCamel', bid: res({ wheat: 1 }) });
    tie = applyAction(tie, 1, { type: 'bidCamel', bid: res({ wheat: 1 }) });
    expect(tie.phase).toMatchObject({ kind: 'camelPlace', seat: 1 });
  });

  it('Gebäude an einer Karawane zählen einen Punkt mehr, Straßen unter Kamelen doppelt', () => {
    const s = game('klassisch', ['kamelzuege']);
    const t = getTopology(s.board);
    const camel = s.caravans![0][0];
    const end = caravanEnd(s, s.caravans![0]);
    s.buildings[end] = { owner: 0, type: 'settlement' };
    expect(caravanPoints(s, 0)).toBe(1);
    expect(victoryPoints(s, 0, false)).toBe(2);
    s.roads[camel] = 0;
    const start = t.edges[camel].a === end ? t.edges[camel].b : t.edges[camel].a;
    const plain = t.vertices[start].edges.find((e) => e !== camel && t.edges[e].hexes.length === 2)!;
    s.roads[plain] = 0;
    expect(longestRoad(s, 0)).toBe(3);
  });
});

describe('Bots auf den neuen Szenarien', () => {
  const cases: [string, VariantId[]][] = [
    ['sandmeer', []],
    ['die-verschollenen', []],
    ['stoffhandel', []],
    ['freibeuterbuchten', []],
    ['grossbauten', []],
    ['klassisch', ['kamelzuege']],
  ];
  for (const [map, variants] of cases) {
    it(`${mapById(map).name}${variants.length ? ' mit Kamelzügen' : ''}: vier Bots spielen die Partie zu Ende`, () => {
      const target = mapById(map).victoryPoints + (variants.length ? 2 : 0);
      let s = createGame(players(4), { victoryPoints: target, map, variants }, 3);
      for (let step = 0; step < 5000 && s.phase.kind !== 'ended'; step++) {
        const seat = actingSeats(s)[0];
        const action = botAction(viewFor(s, seat), seat);
        expect(action).not.toBeNull();
        s = applyAction(s, seat, action!);
      }
      expect(s.phase.kind).toBe('ended');
      expect(s.winner).not.toBeNull();
      if (s.fortresses) expect(s.fortresses[s.winner!].walls).toBe(0);
    });
  }
});
