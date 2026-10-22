import { describe, expect, it } from 'vitest';
import { autoAction, canAutoAct } from './auto';
import { actingSeats, applyAction, createGame } from './rules';
import { GameState } from './types';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }));
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('Automatische Züge für abwesende Spieler', () => {
  it.each([2, 4, 6])('bringen ein Spiel mit %i Spielern durch alle Phasen, ohne je eine Regel zu verletzen', (n) => {
    const random = seeded(n);
    let s: GameState = createGame(players(n), { victoryPoints: 10 }, n * 7);
    const seen = new Set<string>();
    for (let step = 0; step < 3000; step++) {
      const seat = actingSeats(s)[0];
      const action = autoAction(s, seat, random);
      expect(action).not.toBeNull();
      seen.add(s.phase.kind);
      s = applyAction(s, seat, action!);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['setup', 'roll', 'main', 'discard', 'robber']));
    if (n > 4) expect(seen.has('specialBuild')).toBe(true);
  });

  it('macht nichts für einen Sitz, der nicht dran ist', () => {
    const s = createGame(players(3), { victoryPoints: 10 }, 1);
    const waiting = [0, 1, 2].find((seat) => !actingSeats(s).includes(seat))!;
    expect(autoAction(s, waiting)).toBeNull();
    expect(canAutoAct(s, waiting)).toBe(false);
    expect(canAutoAct(s, actingSeats(s)[0])).toBe(true);
  });

  it('wirft von den größten Stapeln ab', () => {
    const s = structuredClone(createGame(players(3), { victoryPoints: 10 }, 1));
    s.phase = { kind: 'discard', pending: [0, 4, 0] };
    s.players[1].resources = { wood: 5, brick: 1, sheep: 3, wheat: 0, ore: 0 };
    expect(autoAction(s, 1)).toEqual({ type: 'discard', resources: { wood: 3, brick: 0, sheep: 1, wheat: 0, ore: 0 } });
  });
});
