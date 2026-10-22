import { BIAS, CLASSIC_BASE, CLASSIC_EXT, FIXED, MapDef, mapById, MaskCell, parseMask } from './maps';
import { random, randomInt, RngState, shuffle } from './rng';
import { BoardState, HarborType, HexState, Layout, Resource, RESOURCES, Terrain } from './types';

const SQ3 = Math.sqrt(3);

/** Bankvorrat je Rohstoff; 19 bei 19 Feldern, 24 bei 30, für größere Karten mehr. */
export function bankSize(tiles: number): number {
  return Math.max(19, Math.round(19 + ((tiles - 19) * 5) / 11));
}

/** Für alte Spielstände und Tests: Bankvorrat der klassischen Bretter. */
export const BANK_SIZE: Record<Layout, number> = { base: bankSize(19), ext: bankSize(30) };

export interface TopoHex {
  id: number;
  /** Meerfeld (Seewege): hat Ecken und Kanten, liefert aber nichts und zählt nicht als Land. */
  sea: boolean;
  /** Feld in „doubled coordinates“ (siehe maps.ts). */
  c: number;
  r: number;
  x: number;
  y: number;
  corners: number[];
  edges: number[];
  neighbors: number[];
}

export interface TopoVertex {
  id: number;
  x: number;
  y: number;
  hexes: number[];
  edges: number[];
  neighbors: number[];
}

export interface TopoEdge {
  id: number;
  a: number;
  b: number;
  hexes: number[];
}

export interface CoastLoop {
  /** Küstenkanten in Umlaufreihenfolge. */
  edges: number[];
  /** Ufer eines Binnensees statt Außenküste. */
  lake: boolean;
}

export interface Topology {
  key: string;
  hexes: TopoHex[];
  vertices: TopoVertex[];
  edges: TopoEdge[];
  /** Außenküste in Umlaufreihenfolge (die längste Schleife, die kein Seeufer ist). */
  coast: number[];
  /** Alle Küstenschleifen: Außenküste und je eine pro Binnensee. */
  coastLoops: CoastLoop[];
  /** Wasserfelder rund ums Land, als „c,r“: Meer (von außen erreichbar) und Binnenseen. */
  water: { sea: Set<string>; lake: Set<string> };
  /** Insel je Feld (zusammenhängendes Land), -1 für Meerfelder. */
  islands: number[];
}

/** Woraus die Topologie entsteht: Felder und, auf Seewege-Karten, welche davon Meer sind. */
export type TopologySource = Pick<BoardState, 'cells' | 'layout'> & { hexes?: HexState[]; sea?: number[] };

/** Die sechs Nachbarn eines Felds in „doubled coordinates“. */
export const NEIGHBOR_STEPS: readonly [number, number][] = [
  [2, 0],
  [1, 1],
  [-1, 1],
  [-2, 0],
  [-1, -1],
  [1, -1],
];

const cellKey = (c: number, r: number) => `${c},${r}`;
const cache = new Map<string, Topology>();

/** Felder eines Bretts; alte Spielstände kennen nur das Layout. */
export function boardCells(board: Pick<BoardState, 'cells' | 'layout'>): [number, number][] {
  if (board.cells) return board.cells;
  return parseMask(board.layout === 'ext' ? CLASSIC_EXT : CLASSIC_BASE).map((m) => [m.c, m.r]);
}

/** Die Geometrie hängt nur von den Feldern ab und wird deshalb nicht im Spielstand gespeichert. */
export function getTopology(board: TopologySource | Layout): Topology {
  const source: TopologySource = typeof board === 'string' ? { layout: board } : board;
  const cells = boardCells(source);
  const sea = source.sea ?? (source.hexes ?? []).flatMap((h, i) => (h.terrain === 'sea' ? [i] : []));
  const key = cells.map(([c, r]) => cellKey(c, r)).join(';') + (sea.length ? `|${sea.join(',')}` : '');
  let topo = cache.get(key);
  if (!topo) {
    topo = buildTopology(cells, key, new Set(sea));
    cache.set(key, topo);
  }
  return topo;
}

function buildTopology(cells: [number, number][], key: string, sea: Set<number>): Topology {
  const hexes: TopoHex[] = [];
  const vertices: TopoVertex[] = [];
  const edges: TopoEdge[] = [];
  const vertexByKey = new Map<string, number>();
  const edgeByKey = new Map<string, number>();

  // Ecken auf einem ganzzahligen Gitter (Einheiten √3/2 und 1/2), damit Rundung nie zwei Ecken trennt.
  const CORNERS: [number, number][] = [
    [0, -2],
    [1, -1],
    [1, 1],
    [0, 2],
    [-1, 1],
    [-1, -1],
  ];
  const vertexAt = (gx: number, gy: number): number => {
    const k = `${gx},${gy}`;
    let id = vertexByKey.get(k);
    if (id === undefined) {
      id = vertices.length;
      vertices.push({ id, x: (gx * SQ3) / 2, y: gy / 2, hexes: [], edges: [], neighbors: [] });
      vertexByKey.set(k, id);
    }
    return id;
  };

  const edgeBetween = (a: number, b: number): number => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    let id = edgeByKey.get(k);
    if (id === undefined) {
      id = edges.length;
      edges.push({ id, a: Math.min(a, b), b: Math.max(a, b), hexes: [] });
      edgeByKey.set(k, id);
    }
    return id;
  };

  // Zeilenweise, links nach rechts: so bleiben die IDs des klassischen Bretts dieselben wie früher.
  const sorted = [...cells].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  for (const [c, r] of sorted) {
    const id = hexes.length;
    const hex: TopoHex = { id, sea: sea.has(id), c, r, x: (c * SQ3) / 2, y: r * 1.5, corners: [], edges: [], neighbors: [] };
    for (const [dx, dy] of CORNERS) {
      const v = vertexAt(c + dx, 3 * r + dy);
      hex.corners.push(v);
      vertices[v].hexes.push(hex.id);
    }
    for (let k = 0; k < 6; k++) {
      const e = edgeBetween(hex.corners[k], hex.corners[(k + 1) % 6]);
      hex.edges.push(e);
      edges[e].hexes.push(hex.id);
    }
    hexes.push(hex);
  }

  for (const e of edges) {
    vertices[e.a].edges.push(e.id);
    vertices[e.b].edges.push(e.id);
    vertices[e.a].neighbors.push(e.b);
    vertices[e.b].neighbors.push(e.a);
    if (e.hexes.length === 2) {
      hexes[e.hexes[0]].neighbors.push(e.hexes[1]);
      hexes[e.hexes[1]].neighbors.push(e.hexes[0]);
    }
  }

  const water = classifyWater(hexes.filter((h) => !h.sea));
  const coastLoops = findCoastLoops(hexes, vertices, edges, water.lake);
  const outer = coastLoops.filter((l) => !l.lake).sort((a, b) => b.edges.length - a.edges.length)[0];
  return { key, hexes, vertices, edges, coast: outer?.edges ?? [], coastLoops, water, islands: findIslands(hexes) };
}

/** Inseln: zusammenhängende Landfelder bekommen dieselbe Nummer, Meerfelder -1. */
function findIslands(hexes: TopoHex[]): number[] {
  const island = hexes.map(() => -1);
  let next = 0;
  for (const start of hexes) {
    if (start.sea || island[start.id] >= 0) continue;
    const stack = [start.id];
    island[start.id] = next;
    while (stack.length) {
      for (const n of hexes[stack.pop()!].neighbors) {
        if (!hexes[n].sea && island[n] < 0) {
          island[n] = next;
          stack.push(n);
        }
      }
    }
    next++;
  }
  return island;
}

/** Wasserfelder rund ums Land: Meer (von außen erreichbar) und Binnenseen (eingeschlossen). */
function classifyWater(hexes: TopoHex[]): { sea: Set<string>; lake: Set<string> } {
  const land = new Set(hexes.map((h) => cellKey(h.c, h.r)));
  const cs = hexes.map((h) => h.c);
  const rs = hexes.map((h) => h.r);
  const minC = Math.min(...cs) - 4;
  const maxC = Math.max(...cs) + 4;
  const minR = Math.min(...rs) - 2;
  const maxR = Math.max(...rs) + 2;
  const parity = (hexes[0].c + hexes[0].r) & 1;
  const inBox = (c: number, r: number) => c >= minC && c <= maxC && r >= minR && r <= maxR && ((c + r) & 1) === parity;
  const startC = ((minC + minR) & 1) === parity ? minC : minC + 1;
  const sea = new Set([cellKey(startC, minR)]);
  const queue: [number, number][] = [[startC, minR]];
  while (queue.length) {
    const [c, r] = queue.pop()!;
    for (const [dc, dr] of NEIGHBOR_STEPS) {
      const nc = c + dc;
      const nr = r + dr;
      const k = cellKey(nc, nr);
      if (!inBox(nc, nr) || sea.has(k) || land.has(k)) continue;
      sea.add(k);
      queue.push([nc, nr]);
    }
  }
  const lake = new Set<string>();
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const k = cellKey(c, r);
      if (inBox(c, r) && !sea.has(k) && !land.has(k)) lake.add(k);
    }
  }
  return { sea, lake };
}

/**
 * Küstenkanten (genau ein Landfeld) als geschlossene Schleifen. Jede Küstenecke hat genau zwei
 * Küstenkanten, deshalb geht das immer auf, auch mit Meerfeldern und Inseln.
 */
function findCoastLoops(hexes: TopoHex[], vertices: TopoVertex[], edges: TopoEdge[], lake: Set<string>): CoastLoop[] {
  const isCoast = (e: number) => edges[e].hexes.filter((h) => !hexes[h].sea).length === 1;
  const seen = new Set<number>();
  const loops: CoastLoop[] = [];
  for (const start of edges) {
    if (!isCoast(start.id) || seen.has(start.id)) continue;
    const ordered = [start.id];
    seen.add(start.id);
    let prev = start.id;
    let at = start.b;
    for (;;) {
      const next = vertices[at].edges.find((e) => e !== prev && isCoast(e))!;
      if (next === start.id) break;
      ordered.push(next);
      seen.add(next);
      at = edges[next].a === at ? edges[next].b : edges[next].a;
      prev = next;
    }
    // Liegt das Wasser hinter der ersten Kante in einem Binnensee? Spiegelt das Feld an der Kantenmitte.
    const e = edges[ordered[0]];
    const h = hexes[e.hexes.find((id) => !hexes[id].sea)!];
    const mx = (vertices[e.a].x + vertices[e.b].x) / 2;
    const my = (vertices[e.a].y + vertices[e.b].y) / 2;
    const wc = Math.round(((2 * mx - h.x) * 2) / SQ3);
    const wr = Math.round((2 * my - h.y) / 1.5);
    loops.push({ edges: ordered, lake: lake.has(cellKey(wc, wr)) });
  }
  return loops;
}

/** Jedes Landfeld über Land erreichbar (ohne Schiffe Pflicht): genau eine Insel. */
export function isConnected(topo: Topology): boolean {
  return topo.hexes.some((h) => !h.sea) && Math.max(...topo.islands) === 0;
}

// ---------------------------------------------------------------------------
// Erzeugung (siehe docs/KARTEN.md, Abschnitt 5)

const TERRAIN_WEIGHT: Record<Resource, number> = { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3 };
const NUMBER_WEIGHT: Record<number, number> = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 };
const pips = (n: number | null) => (n ? 6 - Math.abs(7 - n) : 0);
const isRed = (n: number | null) => n === 6 || n === 8;
/** Ab so vielen Wahrscheinlichkeitspunkten gilt eine Ecke als guter Startplatz. */
const GOOD_SPOT = 8;
/** So viele vollständige Bretter werden erzeugt; das beste nach Bewertung gewinnt. */
const VARIANTS = 24;

function largestRemainder<K extends string | number>(total: number, weights: Record<K, number>, rng: RngState): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  const exact = keys.map((k) => ({ k, v: (total * weights[k]) / sum, tie: random(rng) }));
  const out = {} as Record<K, number>;
  let used = 0;
  for (const x of exact) {
    out[x.k] = Math.floor(x.v);
    used += out[x.k];
  }
  exact.sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || a.tie - b.tie);
  for (let i = 0; i < total - used; i++) out[exact[i].k]++;
  return out;
}

/** 9 Häfen bei 19 Feldern, 11 bei 30; eine zerklüftete Küste bringt ein paar mehr. */
function harborCountFor(tiles: number, coastLength: number): number {
  const compactCoast = 6.9 * Math.sqrt(tiles);
  const base = 9 + ((tiles - 19) * 2) / 11;
  const extra = Math.min(3, Math.max(0, coastLength - compactCoast) / 14);
  return Math.max(5, Math.min(Math.round(base + extra), Math.floor(coastLength / 3)));
}

function harborTypes(count: number): HarborType[] {
  const special = Math.max(5, Math.round((count * 5) / 9));
  const order: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'sheep', 'wheat', 'wood', 'ore', 'brick'];
  const types: HarborType[] = [];
  for (let i = 0; i < Math.min(special, count); i++) types.push(order[i % order.length]);
  while (types.length < count) types.push('any');
  return types;
}

function placeTerrain(topo: Topology, marks: string[], pool: Record<Terrain, number>, rng: RngState): Terrain[] {
  const terrain: (Terrain | null)[] = topo.hexes.map((h) => (h.sea ? 'sea' : null));
  const left = { ...pool };
  for (const h of topo.hexes) {
    const t = FIXED[marks[h.id]];
    if (t && left[t] > 0) {
      terrain[h.id] = t;
      left[t]--;
    }
  }
  // Wüsten zuerst auf Wüstenplätze, sonst zufällig, nie zwei nebeneinander.
  const spots = shuffle(rng, topo.hexes.filter((h) => terrain[h.id] === null && marks[h.id] === 'x'));
  const others = shuffle(rng, topo.hexes.filter((h) => terrain[h.id] === null && marks[h.id] !== 'x'));
  for (const h of [...spots, ...others]) {
    if (left.desert <= 0) break;
    if (h.neighbors.some((m) => terrain[m] === 'desert')) continue;
    terrain[h.id] = 'desert';
    left.desert--;
  }
  // Rest gewichtet: Vorrat × Vorliebe der Maske × Strafe für Klumpen gleicher Landschaft.
  const order = shuffle(rng, topo.hexes.filter((h) => terrain[h.id] === null));
  order.sort((a, b) => (BIAS[marks[b.id]] ? 1 : 0) - (BIAS[marks[a.id]] ? 1 : 0));
  for (const h of order) {
    const options = RESOURCES.filter((t) => left[t] > 0);
    if (!options.length) {
      terrain[h.id] = 'desert';
      continue;
    }
    const weights = options.map((t) => {
      const same = h.neighbors.filter((m) => terrain[m] === t).length;
      const bias = BIAS[marks[h.id]] === t ? 5 : 1;
      return left[t] * bias * (same === 0 ? 1 : same === 1 ? 0.45 : 0.08);
    });
    let roll = random(rng) * weights.reduce((a, b) => a + b, 0);
    let pick = options[options.length - 1];
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = options[i];
        break;
      }
    }
    terrain[h.id] = pick;
    left[pick]--;
  }
  return terrain as Terrain[];
}

/** Zahlen mit harten Regeln: nie 6/8 nebeneinander; mit `strict` auch keine gleichen Zahlen. Neustart bei Sackgasse. */
function placeNumbers(topo: Topology, terrain: Terrain[], pool: number[], rng: RngState, strict: boolean): (number | null)[] | null {
  for (let attempt = 0; attempt < 400; attempt++) {
    const numbers: (number | null)[] = topo.hexes.map(() => null);
    const open = new Set(topo.hexes.filter((h) => terrain[h.id] !== 'desert' && terrain[h.id] !== 'sea').map((h) => h.id));
    const sequence = [...shuffle(rng, pool.filter(isRed)), ...shuffle(rng, pool.filter((x) => !isRed(x)))];
    let ok = true;
    for (const num of sequence) {
      const candidates = [...open].filter((id) =>
        topo.hexes[id].neighbors.every((m) => {
          const other = numbers[m];
          return other === null || (!(isRed(num) && isRed(other)) && !(strict && num === other));
        }),
      );
      if (!candidates.length) {
        ok = false;
        break;
      }
      const id = candidates[randomInt(rng, candidates.length)];
      numbers[id] = num;
      open.delete(id);
    }
    if (ok) return numbers;
  }
  return null;
}

/** Häfen gleichmäßig über alle Küsten, nie zwei an derselben oder an benachbarten Ecken. */
function placeHarbors(topo: Topology, count: number, rng: RngState): number[] {
  const loops = topo.coastLoops;
  const total = loops.reduce((a, l) => a + l.edges.length, 0);
  const capacity = (l: CoastLoop) => Math.floor(l.edges.length / (l.lake ? 6 : 3));
  const share = loops.map((l) => Math.min(capacity(l), (count * l.edges.length) / total));
  const alloc = share.map(Math.floor);
  let rest = count - alloc.reduce((a, b) => a + b, 0);
  share
    .map((s, i) => ({ i, f: s - Math.floor(s) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (rest > 0 && alloc[i] < capacity(loops[i])) {
        alloc[i]++;
        rest--;
      }
    });
  const blockedBy = (used: Set<number>, e: TopoEdge) =>
    [e.a, e.b].some((v) => used.has(v) || topo.vertices[v].neighbors.some((w) => used.has(w)));
  let used = new Set<number>();
  let chosen: number[] = [];
  for (let attempt = 0; attempt < 40 && chosen.length < count; attempt++) {
    const u = new Set<number>();
    const c: number[] = [];
    loops.forEach((loop, li) => {
      const len = loop.edges.length;
      const k = alloc[li];
      if (!k) return;
      const step = len / k;
      const offset = random(rng) * step;
      for (let i = 0; i < k; i++) {
        const target = Math.round(offset + i * step);
        let best: { e: TopoEdge; score: number } | null = null;
        for (const d of [0, 1, -1]) {
          const e = topo.edges[loop.edges[(((target + d) % len) + len) % len]];
          if (blockedBy(u, e)) continue;
          const score = topo.vertices[e.a].hexes.length + topo.vertices[e.b].hexes.length - Math.abs(d) * 1.5;
          if (!best || score > best.score) best = { e, score };
        }
        if (!best) continue;
        c.push(best.e.id);
        u.add(best.e.a);
        u.add(best.e.b);
      }
    });
    if (c.length > chosen.length) {
      chosen = c;
      used = u;
    }
  }
  // Was keinen Platz nahe der Sollposition fand, kommt an die freie Kante mit dem größten Abstand.
  const position = new Map<number, { loop: number; i: number; len: number }>();
  loops.forEach((loop, li) => loop.edges.forEach((e, i) => position.set(e, { loop: li, i, len: loop.edges.length })));
  while (chosen.length < count) {
    let best: { e: TopoEdge; score: number } | null = null;
    for (const loop of loops) {
      for (const id of loop.edges) {
        const e = topo.edges[id];
        if (blockedBy(used, e)) continue;
        const me = position.get(id)!;
        let gap = Infinity;
        for (const other of chosen) {
          const o = position.get(other)!;
          if (o.loop === me.loop) gap = Math.min(gap, Math.abs(o.i - me.i), me.len - Math.abs(o.i - me.i));
        }
        const score = Math.min(gap, 99) + random(rng) * 0.1;
        if (!best || score > best.score) best = { e, score };
      }
    }
    if (!best) break;
    chosen.push(best.e.id);
    used.add(best.e.a);
    used.add(best.e.b);
  }
  return chosen;
}

/** Bewertung eines Bretts; kleiner ist besser (docs/KARTEN.md, Abschnitt 5.6). */
function score(topo: Topology, terrain: Terrain[], numbers: (number | null)[], players: number): number {
  let redAdjacent = 0;
  let sameAdjacent = 0;
  for (const h of topo.hexes) {
    for (const m of h.neighbors) {
      if (m <= h.id) continue;
      if (isRed(numbers[h.id]) && isRed(numbers[m])) redAdjacent++;
      if (numbers[h.id] && numbers[h.id] === numbers[m]) sameAdjacent++;
    }
  }
  // Größte zusammenhängende Gruppe gleicher Landschaft
  let cluster = 1;
  const seen = new Set<number>();
  for (const h of topo.hexes) {
    if (seen.has(h.id) || terrain[h.id] === 'desert' || terrain[h.id] === 'sea') continue;
    let size = 0;
    const stack = [h.id];
    seen.add(h.id);
    while (stack.length) {
      const id = stack.pop()!;
      size++;
      for (const m of topo.hexes[id].neighbors) {
        if (!seen.has(m) && terrain[m] === terrain[id]) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    cluster = Math.max(cluster, size);
  }
  // Ertrag je Feld und Rohstoff: möglichst ausgeglichen
  const perTile = RESOURCES.map((r) => {
    const ids = topo.hexes.filter((h) => terrain[h.id] === r).map((h) => h.id);
    return ids.length ? ids.reduce((a, id) => a + pips(numbers[id]), 0) / ids.length : 0;
  });
  const mean = perTile.reduce((a, b) => a + b, 0) / perTile.length;
  const skew = Math.max(...perTile.map((p) => Math.abs(p - mean) / mean));
  // Startrunde: Schlangenauswahl, jeder nimmt gierig die beste freie Ecke
  const value = topo.vertices.map((v) => {
    const kinds = new Set(v.hexes.map((id) => terrain[id]).filter((t) => t !== 'desert' && t !== 'sea'));
    const p = v.hexes.reduce((a, id) => a + pips(numbers[id]), 0);
    return { p, score: p + 0.6 * Math.max(0, kinds.size - 1) };
  });
  const blocked = new Set<number>();
  const totals: number[] = Array(players).fill(0);
  for (const seat of [...Array(players).keys(), ...[...Array(players).keys()].reverse()]) {
    let best = -1;
    for (const v of topo.vertices) if (!blocked.has(v.id) && (best < 0 || value[v.id].score > value[best].score)) best = v.id;
    if (best < 0) break;
    blocked.add(best);
    for (const w of topo.vertices[best].neighbors) blocked.add(w);
    totals[seat] += value[best].p;
  }
  const spread = Math.max(...totals) - Math.min(...totals);
  // Gute Startplätze, die sich nach der Abstandsregel nicht gegenseitig stören
  const goodBlocked = new Set<number>();
  let good = 0;
  for (const v of [...topo.vertices].sort((a, b) => value[b.id].p - value[a.id].p)) {
    if (value[v.id].p < GOOD_SPOT) break;
    if (goodBlocked.has(v.id)) continue;
    good++;
    goodBlocked.add(v.id);
    for (const w of v.neighbors) goodBlocked.add(w);
  }
  return (
    Math.max(0, 2 * players - good) * 3 +
    redAdjacent * 100 +
    sameAdjacent * 6 +
    Math.max(0, cluster - 2) * 4 +
    spread * 1.5 +
    skew * 30
  );
}

/** Zufallsküste: Die Form wächst vom Mittelpunkt aus, kompakt, mit gelegentlichen Halbinseln und Seen. */
function growShape(size: number, rng: RngState): MaskCell[] {
  const land = new Map<string, MaskCell>([[cellKey(0, 0), { c: 0, r: 0, ch: '.' }]]);
  const reserved = new Set<string>();
  if (random(rng) < 0.45) {
    const [dc, dr] = NEIGHBOR_STEPS[randomInt(rng, 6)];
    reserved.add(cellKey(dc * 2, dr * 2));
  }
  const landNeighbors = (c: number, r: number) => NEIGHBOR_STEPS.filter(([dc, dr]) => land.has(cellKey(c + dc, r + dr))).length;
  const stretch = 0.7 + random(rng) * 0.6;
  while (land.size < size) {
    const frontier = new Map<string, { c: number; r: number }>();
    for (const cell of land.values()) {
      for (const [dc, dr] of NEIGHBOR_STEPS) {
        const k = cellKey(cell.c + dc, cell.r + dr);
        if (!land.has(k) && !reserved.has(k)) frontier.set(k, { c: cell.c + dc, r: cell.r + dr });
      }
    }
    const options = [...frontier.values()].map((f) => {
      const n = landNeighbors(f.c, f.r);
      const dist = Math.hypot(((f.c * SQ3) / 2) * stretch, (f.r * 1.5) / stretch);
      const arm = n === 1 && random(rng) < 0.18 ? 2.2 : 1;
      return { f, w: (n * n * arm * (0.4 + random(rng))) / (1 + 0.25 * dist) };
    });
    let roll = random(rng) * options.reduce((a, x) => a + x.w, 0);
    let pick = options[options.length - 1].f;
    for (const x of options) {
      roll -= x.w;
      if (roll <= 0) {
        pick = x.f;
        break;
      }
    }
    land.set(cellKey(pick.c, pick.r), { ...pick, ch: '.' });
  }
  // Nadelspitzen (nur ein Nachbar) nach innen verlegen, damit niemand auf einer Nadel siedelt.
  for (let pass = 0; pass < 3; pass++) {
    for (const [k, cell] of [...land]) {
      if (landNeighbors(cell.c, cell.r) > 1) continue;
      land.delete(k);
      let best: MaskCell | null = null;
      let bestNeighbors = -1;
      for (const other of land.values()) {
        for (const [dc, dr] of NEIGHBOR_STEPS) {
          const c = other.c + dc;
          const r = other.r + dr;
          const kk = cellKey(c, r);
          if (land.has(kk) || reserved.has(kk) || kk === k) continue;
          const n = landNeighbors(c, r);
          if (n > bestNeighbors) {
            bestNeighbors = n;
            best = { c, r, ch: '.' };
          }
        }
      }
      land.set(cellKey(best!.c, best!.r), best!);
    }
  }
  return [...land.values()];
}

/** Form einer Karte für eine Spielerzahl; auf Seewege-Karten mit Meerfeldern (`~`). */
export function mapShape(map: MapDef, players: number, rng: RngState): MaskCell[] {
  if (map.mask) return parseMask(typeof map.mask === 'function' ? map.mask(players) : map.mask, !!map.seafaring);
  return growShape(map.randomSize!(players), rng);
}

/** Erzeugt ein Brett für eine Karte: Form, Gelände, Zahlen und Häfen, die beste von mehreren Varianten. */
export function generateBoard(
  mapId: string | undefined,
  players: number,
  rng: RngState,
): { board: BoardState; robber: number; bank: number; pirate: number | null } {
  const map = mapById(mapId);
  const shape = mapShape(map, players, rng);
  // Felder in Brett-Reihenfolge (zeilenweise), die Maskenzeichen dazu.
  const sortedShape = [...shape].sort((p, q) => p.r - q.r || p.c - q.c);
  const cells = sortedShape.map((m): [number, number] => [m.c, m.r]);
  const marks = sortedShape.map((m) => m.ch);
  const sea = marks.flatMap((m, i) => (m === '~' ? [i] : []));
  const topo = getTopology({ cells, sea });
  // Vorräte richten sich nach den Landfeldern; Meer liefert nichts.
  const n = topo.hexes.length - sea.length;

  const deserts = Math.max(1, Math.round(n / 15));
  const gold = marks.filter((m) => m === '$').length;
  const terrainPool = {
    ...largestRemainder(n - deserts - gold, TERRAIN_WEIGHT, rng),
    desert: deserts,
    gold,
    sea: 0,
  } as Record<Terrain, number>;
  const counts = largestRemainder(n - deserts, NUMBER_WEIGHT, rng);
  const numberPool = Object.entries(counts).flatMap(([k, c]) => Array<number>(c).fill(Number(k)));
  const coastLength = topo.coastLoops.reduce((a, l) => a + l.edges.length, 0);
  const harborCount = map.harbors ?? harborCountFor(n, coastLength);

  let best: { hexes: HexState[]; harborEdges: number[]; score: number } | null = null;
  for (let t = 0; t < VARIANTS; t++) {
    const terrain = placeTerrain(topo, marks, terrainPool, rng);
    const numbers = placeNumbers(topo, terrain, numberPool, rng, true) ?? placeNumbers(topo, terrain, numberPool, rng, false);
    if (!numbers) continue;
    const harborEdges = map.evenHarbors ? evenHarborEdges(topo, harborCount) : placeHarbors(topo, harborCount, rng);
    const s = score(topo, terrain, numbers, players);
    if (!best || s < best.score) best = { hexes: terrain.map((t, i) => ({ terrain: t, number: numbers[i] })), harborEdges, score: s };
  }
  if (!best) throw new Error(`Für die Karte ${map.name} ließ sich kein gültiges Brett erzeugen.`);

  const types = shuffle(rng, harborTypes(best.harborEdges.length));
  // Das Kaperschiff startet auf einem Meerfeld an der Küste.
  const coastalSea = topo.hexes.filter((h) => h.sea && h.neighbors.some((m) => !topo.hexes[m].sea));
  const pirate = coastalSea.length ? coastalSea[randomInt(rng, coastalSea.length)].id : null;
  const board: BoardState = {
    map: map.id,
    cells,
    hexes: best.hexes,
    harbors: best.harborEdges.map((edge, i) => ({ type: types[i], edge })),
  };
  // Das klassische Brett behält sein Layout zusätzlich, so bleiben alte Werkzeuge und Tests gültig.
  if (map.id === 'klassisch') board.layout = n > 19 ? 'ext' : 'base';
  return { board, robber: best.hexes.findIndex((h) => h.terrain === 'desert'), bank: bankSize(n), pirate };
}

/** Klassisch: Häfen gleichmäßig um die Außenküste wie bisher. */
function evenHarborEdges(topo: Topology, count: number): number[] {
  const coast = topo.coast;
  return Array.from({ length: count }, (_, i) => coast[Math.round((i * coast.length) / count)]);
}

/** Hafentyp je Ecke, abgeleitet aus den Häfen auf dem Brett. */
export function vertexHarbors(board: BoardState): (HarborType | null)[] {
  const topo = getTopology(board);
  const result: (HarborType | null)[] = topo.vertices.map(() => null);
  for (const h of board.harbors) {
    const e = topo.edges[h.edge];
    result[e.a] = h.type;
    result[e.b] = h.type;
  }
  return result;
}
