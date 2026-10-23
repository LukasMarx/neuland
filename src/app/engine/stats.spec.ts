import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { applyAction, createGame, victoryPoints } from './rules';
import { viewFor } from './secrets';
import { GameState } from './types';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
}

function playToEnd(seed: number, n = 4): GameState {
  const random = seeded(seed);
  let s = createGame(players(n), { victoryPoints: 10 }, seed);
  for (let step = 0; step < 20000 && s.phase.kind !== 'ended'; step++) {
    const next = botStep(s, random);
    if (!next) break;
    s = applyAction(s, next.seat, next.action);
  }
  return s;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('Statistik', () => {
  it('beginnt leer, ein Eintrag je Sitz', () => {
    const s = createGame(players(3), { victoryPoints: 10 }, 1);
    expect(s.stats!.dice).toHaveLength(13);
    expect(s.stats!.produced).toEqual([0, 0, 0]);
    expect(s.stats!.vp).toEqual([]);
  });

  it('Duell: auch die neutralen Mitspieler haben Einträge', () => {
    const s = createGame(players(2), { victoryPoints: 10, variants: ['duell'] }, 1);
    expect(s.stats!.produced).toHaveLength(s.players.length);
  });

  it('zählt über ein ganzes Spiel mit, passend zum Spielverlauf', { timeout: 60000 }, () => {
    const s = playToEnd(7);
    expect(s.phase.kind).toBe('ended');
    const st = s.stats!;
    // Jeder Zug beginnt mit einem Wurf (Zug 1 ist der erste nach der Aufstellung).
    expect(sum(st.dice)).toBe(s.turn);
    expect(st.dice[0] + st.dice[1]).toBe(0);
    // Gestohlen und verloren gleichen sich aus.
    expect(sum(st.stolen)).toBe(sum(st.robbed));
    expect(sum(st.produced)).toBeGreaterThan(0);
    // Punktestände nach Zügen, ausgedünnt; der letzte ist der Endstand mit verdeckten Punkten.
    expect(st.vp.length).toBeLessThanOrEqual(201);
    expect(st.vp[0]).toEqual({ turn: 1, points: [2, 2, 2, 2] });
    expect(st.vp.at(-1)).toEqual({ turn: s.turn, points: s.players.map((_, i) => victoryPoints(s, i, true)) });
    expect(st.vp.map((e) => e.turn)).toEqual([...st.vp.map((e) => e.turn)].sort((a, b) => a - b));
    expect(sum(st.devBought)).toBeGreaterThan(0);
  });

  it('verrät in der Sicht eines Spielers nichts Verdecktes', () => {
    // Mitten im Spiel: Die Sicht hat dieselbe Statistik, sie enthält nur Zählwerte.
    let s = createGame(players(4), { victoryPoints: 10 }, 3);
    const random = seeded(3);
    for (let step = 0; step < 400; step++) {
      const next = botStep(s, random);
      if (!next) break;
      s = applyAction(s, next.seat, next.action);
    }
    expect(viewFor(s, 0).stats).toEqual(s.stats);
    expect(JSON.stringify(s.stats)).not.toMatch(/wood|brick|sheep|wheat|ore/);
  });
});
