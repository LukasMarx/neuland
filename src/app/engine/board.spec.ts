import { describe, expect, it } from 'vitest';
import { bankSize, generateBoard, getTopology, isConnected, Topology, vertexHarbors } from './board';
import { MAPS, mapById, parseMask } from './maps';
import { shuffle } from './rng';
import { Layout, Terrain } from './types';

function count<T>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

/** Die frühere Topologie aus festen Reihen, als Referenz für die Ecken- und Kanten-IDs alter Spielstände. */
function legacyTopology(rows: number[]) {
  const hexes: { corners: number[]; edges: number[] }[] = [];
  const vertices: { x: number; y: number }[] = [];
  const edges: { a: number; b: number }[] = [];
  const vByKey = new Map<string, number>();
  const eByKey = new Map<string, number>();
  const vertexAt = (x: number, y: number) => {
    const k = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    if (!vByKey.has(k)) {
      vByKey.set(k, vertices.length);
      vertices.push({ x, y });
    }
    return vByKey.get(k)!;
  };
  const edgeBetween = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!eByKey.has(k)) {
      eByKey.set(k, edges.length);
      edges.push({ a: Math.min(a, b), b: Math.max(a, b) });
    }
    return eByKey.get(k)!;
  };
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * Math.sqrt(3);
      const y = row * 1.5;
      const corners = Array.from({ length: 6 }, (_, k) => {
        const angle = ((60 * k - 90) * Math.PI) / 180;
        return vertexAt(x + Math.cos(angle), y + Math.sin(angle));
      });
      hexes.push({ corners, edges: corners.map((c, k) => edgeBetween(c, corners[(k + 1) % 6])) });
    }
  });
  return { hexes, vertices, edges };
}

function checkTopology(t: Topology): void {
  for (const h of t.hexes) {
    expect(new Set(h.corners).size).toBe(6);
    expect(new Set(h.edges).size).toBe(6);
    for (const n of h.neighbors) expect(t.hexes[n].neighbors).toContain(h.id);
  }
  for (const v of t.vertices) {
    expect(v.edges.length).toBeGreaterThanOrEqual(2);
    expect(v.edges.length).toBeLessThanOrEqual(3);
    for (const n of v.neighbors) expect(t.vertices[n].neighbors).toContain(v.id);
  }
  // Jede Küstenkante gehört zu genau einer geschlossenen Schleife.
  const coast = t.edges.filter((e) => e.hexes.filter((h) => !t.hexes[h].sea).length === 1).map((e) => e.id);
  const looped = t.coastLoops.flatMap((l) => l.edges);
  expect([...looped].sort((a, b) => a - b)).toEqual(coast);
  for (const loop of t.coastLoops) {
    for (let i = 0; i < loop.edges.length; i++) {
      const a = t.edges[loop.edges[i]];
      const b = t.edges[loop.edges[(i + 1) % loop.edges.length]];
      expect([a.a, a.b].filter((v) => v === b.a || v === b.b)).toHaveLength(1);
    }
  }
}

describe('Topologie', () => {
  it('klassisch: 19 bzw. 30 Felder mit Euler-Charakteristik 1', () => {
    for (const [layout, hexes, vertices, edges] of [
      ['base', 19, 54, 72],
      ['ext', 30, 80, 109],
    ] as const) {
      const t = getTopology(layout);
      expect([t.hexes.length, t.vertices.length, t.edges.length]).toEqual([hexes, vertices, edges]);
      expect(t.vertices.length - t.edges.length + t.hexes.length).toBe(1);
      expect(t.coastLoops).toHaveLength(1);
      checkTopology(t);
    }
  });

  it('klassisch: Ecken und Kanten haben dieselben IDs wie früher, alte Spielstände bleiben gültig', () => {
    for (const [layout, rows] of [
      ['base', [3, 4, 5, 4, 3]],
      ['ext', [3, 4, 5, 6, 5, 4, 3]],
    ] as [Layout, number[]][]) {
      const before = legacyTopology(rows);
      const now = getTopology(layout);
      expect(now.hexes.map((h) => h.corners)).toEqual(before.hexes.map((h) => h.corners));
      expect(now.hexes.map((h) => h.edges)).toEqual(before.hexes.map((h) => h.edges));
      expect(now.edges.map((e) => [e.a, e.b])).toEqual(before.edges.map((e) => [e.a, e.b]));
    }
  });

  it('wird zwischengespeichert, auch über alte und neue Spielstände hinweg', () => {
    const { board } = generateBoard('klassisch', 4, { rng: 1 });
    expect(getTopology(board)).toBe(getTopology('base'));
    expect(getTopology({ layout: 'base' })).toBe(getTopology('base'));
  });

  it('erkennt Binnenseen als eigene Küstenschleife', () => {
    const krater = getTopology({ cells: parseMask(mapById('kratersee').mask as string[]).map((m) => [m.c, m.r]) });
    expect(krater.coastLoops.filter((l) => l.lake).map((l) => l.edges.length)).toEqual([6]);
    const atoll = getTopology({ cells: parseMask(mapById('atoll').mask as string[]).map((m) => [m.c, m.r]) });
    expect(atoll.coastLoops.filter((l) => l.lake)).toHaveLength(1);
    expect(getTopology('base').coastLoops.filter((l) => l.lake)).toHaveLength(0);
  });

  it('meldet verrutschte Masken', () => {
    expect(() => parseMask([' . .', '. .', '. . '].map((l, i) => (i === 1 ? ' ' + l : l)))).toThrow(/Raster/);
  });
});

describe('Brettgenerierung', () => {
  const expected: Record<number, { terrains: Partial<Record<Terrain, number>>; numbers: Record<number, number>; harbors: Record<string, number> }> = {
    4: {
      terrains: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, desert: 1 },
      numbers: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
      harbors: { any: 4, wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 },
    },
    6: {
      terrains: { wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, desert: 2 },
      numbers: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
      harbors: { any: 5, wood: 1, brick: 1, sheep: 2, wheat: 1, ore: 1 },
    },
  };

  for (const players of [4, 6]) {
    it(`klassisch mit ${players} Spielern: dieselben Vorräte und Hafenplätze wie früher`, () => {
      const t = getTopology(players > 4 ? 'ext' : 'base');
      const harbors = players > 4 ? 11 : 9;
      const harborEdges = Array.from({ length: harbors }, (_, i) => t.coast[Math.round((i * t.coast.length) / harbors)]);
      for (let seed = 1; seed < 60; seed++) {
        const { board, bank } = generateBoard('klassisch', players, { rng: seed * 7919 });
        expect(board.layout).toBe(players > 4 ? 'ext' : 'base');
        expect(Object.fromEntries(count(board.hexes.map((h) => h.terrain)))).toEqual(expected[players].terrains);
        const nums = board.hexes.filter((h) => h.number !== null).map((h) => h.number!);
        expect(Object.fromEntries(count(nums))).toEqual(expected[players].numbers);
        expect(Object.fromEntries(count(board.harbors.map((h) => h.type)))).toEqual(expected[players].harbors);
        expect(board.harbors.map((h) => h.edge)).toEqual(harborEdges);
        expect(bank).toBe(players > 4 ? 24 : 19);
      }
    });
  }

  for (const map of MAPS) {
    it(`${map.name}: jedes Brett hält die Regeln ein, bei jeder Spielerzahl`, { timeout: 60000 }, () => {
      const red = (n: number | null) => n === 6 || n === 8;
      for (let players = map.players[0]; players <= map.players[1]; players++) {
        for (let seed = 1; seed <= 12; seed++) {
          const { board, robber, bank, fog } = generateBoard(map.id, players, { rng: seed * 104729 + players });
          const t = getTopology(board);
          checkTopology(t);
          // Ohne Schiffe muss alles über Land erreichbar sein; Seewege-Karten bestehen aus Inseln
          // (im Nebel zeigen sie sich erst beim Aufdecken).
          expect(isConnected(t)).toBe(!map.seafaring || !!fog);
          if (map.seafaring && !fog) expect(Math.max(...t.islands)).toBeGreaterThan(0);
          expect(board.hexes).toHaveLength(t.hexes.length);
          expect(board.hexes[robber].terrain).toBe('desert');
          for (const [i, h] of board.hexes.entries()) expect(h.terrain === 'sea' || h.terrain === 'fog').toBe(t.hexes[i].sea);
          // Bank für alles Land, auch das unter dem Nebel.
          const fogCells = board.hexes.filter((h) => h.terrain === 'fog').length;
          const fogLand = fog ? fogCells - (fog.terrain.sea ?? 0) : 0;
          if (fog) expect(Object.values(fog.terrain).reduce((a, b) => a + b, 0)).toBe(fogCells);
          expect(bank).toBe(bankSize(t.hexes.filter((h) => !h.sea).length + fogLand));
          for (const h of t.hexes) {
            const hex = board.hexes[h.id];
            // Bewohnte Inseln (Die Verschollenen) haben Gelände, aber keine Zahl.
            const blank = hex.terrain === 'desert' || hex.terrain === 'sea' || hex.terrain === 'fog' || !!board.tribe?.includes(h.id);
            expect(hex.number === null).toBe(blank);
            if (red(hex.number)) for (const n of h.neighbors) expect(red(board.hexes[n].number)).toBe(false);
          }
          // Häfen an der Küste, nie an derselben oder einer benachbarten Ecke.
          const corners = board.harbors.flatMap((h) => [t.edges[h.edge].a, t.edges[h.edge].b]);
          expect(new Set(corners).size).toBe(corners.length);
          for (const h of board.harbors) expect(t.edges[h.edge].hexes.filter((x) => !t.hexes[x].sea)).toHaveLength(1);
          if (!map.evenHarbors) {
            for (const v of corners) {
              for (const w of t.vertices[v].neighbors) expect(corners.filter((c) => c === w).length).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    });
  }

  it('ist deterministisch je Seed', () => {
    for (const id of ['klassisch', 'weltkarte', 'zufallskueste']) {
      const players = mapById(id).players[1];
      expect(generateBoard(id, players, { rng: 42 })).toEqual(generateBoard(id, players, { rng: 42 }));
      expect(generateBoard(id, players, { rng: 42 })).not.toEqual(generateBoard(id, players, { rng: 43 }));
    }
  });

  it('die Weltkarte legt ihre Wüsten auf die Wüstenplätze', () => {
    const mask = mapById('weltkarte').mask as string[];
    const spots = parseMask(mask)
      .sort((p, q) => p.r - q.r || p.c - q.c)
      .map((m, i) => (m.ch === 'x' ? i : -1))
      .filter((i) => i >= 0);
    for (let seed = 1; seed < 10; seed++) {
      const { board } = generateBoard('weltkarte', 6, { rng: seed });
      const deserts = board.hexes.map((h, i) => (h.terrain === 'desert' ? i : -1)).filter((i) => i >= 0);
      expect(deserts).toEqual(spots);
    }
  });

  it('vertexHarbors markiert genau die beiden Ecken jedes Hafens', () => {
    const { board } = generateBoard('klassisch', 4, { rng: 5 });
    const t = getTopology(board);
    const vh = vertexHarbors(board);
    expect(vh.filter((h) => h !== null).length).toBe(18);
    for (const h of board.harbors) {
      expect(vh[t.edges[h.edge].a]).toBe(h.type);
      expect(vh[t.edges[h.edge].b]).toBe(h.type);
    }
  });
});

describe('Zufallsgenerator', () => {
  it('shuffle ist eine Permutation und verändert die Eingabe nicht', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle({ rng: 3 }, input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
  });
});
