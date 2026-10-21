import { describe, expect, it } from 'vitest';
import { generateBoard, getTopology, vertexHarbors } from './board';
import { shuffle } from './rng';
import { Layout, Terrain } from './types';

function count<T>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

describe('Topologie', () => {
  it('Basisbrett: 19 Felder, 54 Ecken, 72 Kanten, 30 Küstenkanten, 9 Häfen', () => {
    const t = getTopology('base');
    expect(t.hexes.length).toBe(19);
    expect(t.vertices.length).toBe(54);
    expect(t.edges.length).toBe(72);
    expect(t.coast.length).toBe(30);
    expect(t.harborEdges.length).toBe(9);
  });

  it('Erweiterungsbrett: 30 Felder, 11 Häfen', () => {
    const t = getTopology('ext');
    expect(t.hexes.length).toBe(30);
    expect(t.harborEdges.length).toBe(11);
    // 6 Ecken pro Feld, Euler: V - E + F = 1 (ohne Außenfläche)
    expect(t.vertices.length - t.edges.length + t.hexes.length).toBe(1);
  });

  it('wird zwischengespeichert', () => {
    expect(getTopology('base')).toBe(getTopology('base'));
  });

  for (const layout of ['base', 'ext'] as Layout[]) {
    describe(layout, () => {
      const t = getTopology(layout);

      it('jedes Feld hat 6 verschiedene Ecken und Kanten', () => {
        for (const h of t.hexes) {
          expect(new Set(h.corners).size).toBe(6);
          expect(new Set(h.edges).size).toBe(6);
        }
      });

      it('Ecken haben 2–3 Kanten und 1–3 Felder, Nachbarschaft ist symmetrisch', () => {
        for (const v of t.vertices) {
          expect(v.edges.length).toBeGreaterThanOrEqual(2);
          expect(v.edges.length).toBeLessThanOrEqual(3);
          expect(v.hexes.length).toBeGreaterThanOrEqual(1);
          expect(v.hexes.length).toBeLessThanOrEqual(3);
          for (const n of v.neighbors) expect(t.vertices[n].neighbors).toContain(v.id);
        }
      });

      it('Kanten verbinden zwei Ecken und liegen an 1–2 Feldern', () => {
        for (const e of t.edges) {
          expect(e.a).not.toBe(e.b);
          expect(e.hexes.length).toBeGreaterThanOrEqual(1);
          expect(e.hexes.length).toBeLessThanOrEqual(2);
          expect(t.vertices[e.a].edges).toContain(e.id);
          expect(t.vertices[e.b].edges).toContain(e.id);
        }
      });

      it('Felder-Nachbarn sind symmetrisch, höchstens 6', () => {
        for (const h of t.hexes) {
          expect(h.neighbors.length).toBeLessThanOrEqual(6);
          for (const n of h.neighbors) expect(t.hexes[n].neighbors).toContain(h.id);
        }
      });

      it('Küste ist ein geschlossener Ring aus Kanten mit nur einem Feld', () => {
        const coastCount = t.edges.filter((e) => e.hexes.length === 1).length;
        expect(t.coast.length).toBe(coastCount);
        expect(new Set(t.coast).size).toBe(t.coast.length);
        for (let i = 0; i < t.coast.length; i++) {
          const a = t.edges[t.coast[i]];
          const b = t.edges[t.coast[(i + 1) % t.coast.length]];
          const shared = [a.a, a.b].filter((v) => v === b.a || v === b.b);
          expect(shared.length).toBe(1);
        }
      });

      it('Häfen liegen an der Küste und teilen sich nie eine Ecke', () => {
        const corners = t.harborEdges.flatMap((e) => [t.edges[e].a, t.edges[e].b]);
        expect(new Set(corners).size).toBe(corners.length);
        for (const e of t.harborEdges) expect(t.coast).toContain(e);
      });
    });
  }
});

describe('Brettgenerierung', () => {
  const expected: Record<Layout, { terrains: Record<Terrain, number>; numbers: Record<number, number>; harbors: Record<string, number> }> = {
    base: {
      terrains: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, desert: 1 },
      numbers: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
      harbors: { any: 4, wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 },
    },
    ext: {
      terrains: { wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, desert: 2 },
      numbers: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
      harbors: { any: 5, wood: 1, brick: 1, sheep: 2, wheat: 1, ore: 1 },
    },
  };

  for (const layout of ['base', 'ext'] as Layout[]) {
    describe(layout, () => {
      const t = getTopology(layout);
      const seeds = Array.from({ length: 150 }, (_, i) => i * 7919 + 1);

      it('Landschaften, Zahlen und Häfen stimmen für viele Seeds', () => {
        for (const seed of seeds) {
          const { board } = generateBoard(layout, { rng: seed });
          expect(board.layout).toBe(layout);
          expect(Object.fromEntries(count(board.hexes.map((h) => h.terrain)))).toEqual(expected[layout].terrains);
          const nums = board.hexes.filter((h) => h.number !== null).map((h) => h.number!);
          expect(Object.fromEntries(count(nums))).toEqual(expected[layout].numbers);
          expect(Object.fromEntries(count(board.harbors.map((h) => h.type)))).toEqual(expected[layout].harbors);
          expect(board.harbors.map((h) => h.edge)).toEqual(t.harborEdges);
        }
      });

      it('Wüsten haben keine Zahl, alle anderen Felder schon', () => {
        for (const seed of seeds) {
          const { board } = generateBoard(layout, { rng: seed });
          for (const h of board.hexes) {
            if (h.terrain === 'desert') expect(h.number).toBeNull();
            else expect(h.number).not.toBeNull();
          }
        }
      });

      it('6 und 8 liegen nie nebeneinander', () => {
        const red = (n: number | null) => n === 6 || n === 8;
        for (const seed of seeds) {
          const { board } = generateBoard(layout, { rng: seed });
          for (const h of t.hexes) {
            if (!red(board.hexes[h.id].number)) continue;
            for (const n of h.neighbors) expect(red(board.hexes[n].number), `Seed ${seed}, Feld ${h.id}/${n}`).toBe(false);
          }
        }
      });

      it('Räuber startet auf einer Wüste', () => {
        for (const seed of seeds) {
          const { board, robber } = generateBoard(layout, { rng: seed });
          expect(board.hexes[robber].terrain).toBe('desert');
        }
      });

      it('ist deterministisch je Seed', () => {
        expect(generateBoard(layout, { rng: 42 })).toEqual(generateBoard(layout, { rng: 42 }));
        expect(generateBoard(layout, { rng: 42 })).not.toEqual(generateBoard(layout, { rng: 43 }));
      });
    });
  }

  it('vertexHarbors markiert genau die beiden Ecken jedes Hafens', () => {
    const { board } = generateBoard('base', { rng: 5 });
    const t = getTopology('base');
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
