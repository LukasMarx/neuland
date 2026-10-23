import { describe, expect, it } from 'vitest';
import { botAction, botTradeResponse } from './bot';
import { applyAction, createGame, legalCityVertices, victoryPoints } from './rules';
import { isConsistent } from './secrets';
import { GameState } from './types';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
}

/** Eine Partie nur mit Bots: Jeder Zug muss legal sein, und das Spiel muss in vertretbarer Zeit enden. */
function botGame(n: number, seed: number, maxSteps = 6000): { s: GameState; steps: number } {
  let s = createGame(players(n), { victoryPoints: 10 }, seed);
  let steps = 0;
  for (; steps < maxSteps && s.phase.kind !== 'ended'; steps++) {
    const seat = [...s.players.keys()].find((i) => botAction(s, i) !== null)!;
    const action = botAction(s, seat)!;
    s = applyAction(s, seat, action);
    if (steps % 100 === 0) expect(isConsistent(s)).toBe(true);
  }
  return { s, steps };
}

describe('Bot für getrennte Spieler', () => {
  for (const n of [3, 4, 6, 8]) {
    it(`${n} Bots spielen legal bis zum Sieg`, { timeout: 120000 }, () => {
      for (const seed of [1, 2, 3]) {
        const { s, steps } = botGame(n, seed);
        expect(s.phase.kind).toBe('ended');
        expect(victoryPoints(s, s.winner!, true)).toBeGreaterThanOrEqual(10);
        // Ein Bot baut zielstrebig: kein endloses Hin und Her.
        expect(steps).toBeLessThan(6000);
      }
    });
  }

  it('baut eine Stadt, sobald es geht, und tauscht dafür mit der Bank', () => {
    let s = createGame(players(3), { victoryPoints: 10 }, 4);
    while (s.phase.kind === 'setup') s = applyAction(s, s.phase.order[s.phase.index], botAction(s, s.phase.order[s.phase.index])!);
    s = structuredClone(s);
    s.phase = { kind: 'main' };
    s.current = 0;
    s.players[0].resources = { wood: 0, brick: 0, sheep: 4, wheat: 2, ore: 3 };
    expect(botAction(s, 0)).toMatchObject({ type: 'buildCity' });
    s.players[0].resources = { wood: 0, brick: 0, sheep: 4, wheat: 2, ore: 2 };
    expect(botAction(s, 0)).toMatchObject({ type: 'bankTrade', give: 'sheep', get: 'ore' });
    expect(legalCityVertices(s, 0).length).toBeGreaterThan(0);
  });

  it('setzt den Räuber nie auf ein eigenes Feld, wenn es anders geht', () => {
    const { s } = botGame(4, 9, 200);
    const t = structuredClone(s);
    t.phase = { kind: 'robber', returnTo: 'main' };
    const seat = t.current;
    const action = botAction(t, seat);
    expect(action?.type).toBe('moveRobber');
    const next = applyAction(t, seat, action!);
    expect(next.phase.kind).toBe('main');
  });

  it('ist nur dran, wenn der Sitz handeln muss', () => {
    const s = createGame(players(3), { victoryPoints: 10 }, 1);
    const first = s.phase.kind === 'setup' ? s.phase.order[0] : 0;
    expect(botAction(s, (first + 1) % 3)).toBeNull();
    expect(botAction(s, first)).not.toBeNull();
  });

  it('Tauschangebote: hilft sich selbst, aber nicht dem Führenden kurz vor dem Sieg', () => {
    let s = createGame(players(3), { victoryPoints: 10 }, 4);
    while (s.phase.kind === 'setup') s = applyAction(s, s.phase.order[s.phase.index], botAction(s, s.phase.order[s.phase.index])!);
    s = structuredClone(s);
    s.phase = { kind: 'main' };
    s.current = 0;
    s.players[1].resources = { wood: 0, brick: 0, sheep: 2, wheat: 0, ore: 0 };
    const offer = { id: 1, from: 0, give: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 }, want: { wood: 0, brick: 0, sheep: 1, wheat: 0, ore: 0 }, counter: false, accepted: [], declined: [] };
    expect(botTradeResponse(s, 1, offer)).toBe(true);
    // Mehr verlangen, als er hat: ablehnen.
    expect(botTradeResponse(s, 1, { ...offer, want: { wood: 0, brick: 0, sheep: 3, wheat: 0, ore: 0 } })).toBe(false);
    // Der Anbietende steht kurz vor dem Sieg: ablehnen.
    const leader = structuredClone(s);
    leader.honors = undefined;
    for (let i = 0; i < 8; i++) leader.buildings[leader.buildings.findIndex((b) => !b)] = { owner: 0, type: 'settlement' };
    expect(botTradeResponse(leader, 1, offer)).toBe(false);
    // Schon geantwortet: nichts mehr zu sagen.
    expect(botTradeResponse(s, 1, { ...offer, declined: [1] })).toBeNull();
  });
});
