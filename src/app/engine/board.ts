import { BoardState, HarborType, Layout, Terrain } from './types';
import { RngState, shuffle } from './rng';

/** Anzahl Felder pro Reihe, spitze Sechsecke, Reihen von oben nach unten. */
const ROWS: Record<Layout, number[]> = {
  base: [3, 4, 5, 4, 3],
  ext: [3, 4, 5, 6, 5, 4, 3],
};

const TERRAINS: Record<Layout, Record<Terrain, number>> = {
  base: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, desert: 1 },
  ext: { wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, desert: 2 },
};

const NUMBERS: Record<Layout, number[]> = {
  base: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  ext: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
};

const HARBORS: Record<Layout, HarborType[]> = {
  base: ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  ext: ['any', 'any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore'],
};

export const BANK_SIZE: Record<Layout, number> = { base: 19, ext: 24 };

export interface TopoHex {
  id: number;
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

export interface Topology {
  layout: Layout;
  hexes: TopoHex[];
  vertices: TopoVertex[];
  edges: TopoEdge[];
  /** Küstenkanten in Umlaufreihenfolge. */
  coast: number[];
  harborEdges: number[];
}

const cache = new Map<Layout, Topology>();

/** Die Geometrie hängt nur vom Layout ab und wird deshalb nicht im Spielstand gespeichert. */
export function getTopology(layout: Layout): Topology {
  let topo = cache.get(layout);
  if (!topo) {
    topo = buildTopology(layout);
    cache.set(layout, topo);
  }
  return topo;
}

function buildTopology(layout: Layout): Topology {
  const hexes: TopoHex[] = [];
  const vertices: TopoVertex[] = [];
  const edges: TopoEdge[] = [];
  const vertexByKey = new Map<string, number>();
  const edgeByKey = new Map<string, number>();

  const vertexAt = (x: number, y: number): number => {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    let id = vertexByKey.get(key);
    if (id === undefined) {
      id = vertices.length;
      vertices.push({ id, x, y, hexes: [], edges: [], neighbors: [] });
      vertexByKey.set(key, id);
    }
    return id;
  };

  const edgeBetween = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    let id = edgeByKey.get(key);
    if (id === undefined) {
      id = edges.length;
      edges.push({ id, a: Math.min(a, b), b: Math.max(a, b), hexes: [] });
      edgeByKey.set(key, id);
    }
    return id;
  };

  ROWS[layout].forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * Math.sqrt(3);
      const y = row * 1.5;
      const hex: TopoHex = { id: hexes.length, x, y, corners: [], edges: [], neighbors: [] };
      for (let k = 0; k < 6; k++) {
        const angle = ((60 * k - 90) * Math.PI) / 180;
        const v = vertexAt(x + Math.cos(angle), y + Math.sin(angle));
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
  });

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

  const coast = orderCoast(edges, vertices);
  const harborCount = HARBORS[layout].length;
  const harborEdges = Array.from(
    { length: harborCount },
    (_, i) => coast[Math.round((i * coast.length) / harborCount)],
  );

  return { layout, hexes, vertices, edges, coast, harborEdges };
}

function orderCoast(edges: TopoEdge[], vertices: TopoVertex[]): number[] {
  const isCoast = (e: number) => edges[e].hexes.length === 1;
  const start = edges.find((e) => isCoast(e.id))!;
  const ordered = [start.id];
  let prev = start.id;
  let at = start.b;
  while (true) {
    const next = vertices[at].edges.find((e) => e !== prev && isCoast(e))!;
    if (next === start.id) break;
    ordered.push(next);
    at = edges[next].a === at ? edges[next].b : edges[next].a;
    prev = next;
  }
  return ordered;
}

export function generateBoard(layout: Layout, rng: RngState): { board: BoardState; robber: number } {
  const topo = getTopology(layout);
  const terrains = shuffle(
    rng,
    Object.entries(TERRAINS[layout]).flatMap(([t, n]) => Array<Terrain>(n).fill(t as Terrain)),
  );

  let numbers: (number | null)[] = [];
  for (let attempt = 0; attempt < 2000; attempt++) {
    const pool = shuffle(rng, NUMBERS[layout]);
    numbers = terrains.map((t) => (t === 'desert' ? null : pool.pop()!));
    if (redNumbersApart(topo, numbers)) break;
  }

  const harborTypes = shuffle(rng, HARBORS[layout]);
  const board: BoardState = {
    layout,
    hexes: terrains.map((terrain, i) => ({ terrain, number: numbers[i] })),
    harbors: topo.harborEdges.map((edge, i) => ({ type: harborTypes[i], edge })),
  };
  return { board, robber: terrains.indexOf('desert') };
}

function redNumbersApart(topo: Topology, numbers: (number | null)[]): boolean {
  const red = (n: number | null) => n === 6 || n === 8;
  return topo.hexes.every((h) => !red(numbers[h.id]) || h.neighbors.every((n) => !red(numbers[n])));
}

/** Hafentyp je Ecke, abgeleitet aus den Häfen auf dem Brett. */
export function vertexHarbors(board: BoardState): (HarborType | null)[] {
  const topo = getTopology(board.layout);
  const result: (HarborType | null)[] = topo.vertices.map(() => null);
  for (const h of board.harbors) {
    const e = topo.edges[h.edge];
    result[e.a] = h.type;
    result[e.b] = h.type;
  }
  return result;
}
