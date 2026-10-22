import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { getTopology } from './board';
import { applyAction, createGame, devDeckFor, victoryPoints } from './rules';
import { isConsistent, rebuild, Secret, secretOf, viewFor } from './secrets';
import { DevCard, GameState, RESOURCES } from './types';

/** Eigene Erweiterung für 7–8 Spieler auf der klassischen Karte (37 Felder). */
function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
}

function devTotal(s: GameState): number {
  return s.devDeck.length + (s.playedDev?.length ?? 0) + s.players.reduce((n, p) => n + p.devCards.length + p.newDevCards.length, 0);
}

describe('7–8 Spieler: Aufbau', () => {
  for (const n of [7, 8]) {
    it(`${n} Spieler: großes Brett mit 37 Feldern, Bank 27, 44 Entwicklungskarten`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const s = createGame(players(n), { victoryPoints: 10 }, seed);
        const hexes = s.board.hexes;
        expect(s.board.layout).toBe('big');
        expect(hexes).toHaveLength(37);
        expect(hexes.filter((h) => h.terrain === 'desert')).toHaveLength(2);
        expect(hexes.filter((h) => h.number !== null)).toHaveLength(35);
        expect(hexes.find((h) => h.terrain === 'desert')?.number ?? null).toBeNull();
        for (const r of RESOURCES) expect(s.bank[r]).toBe(27);
        expect(s.devDeck).toHaveLength(44);
        expect(s.board.harbors.length).toBeGreaterThanOrEqual(11);
        // Häfen teilen sich keine Ecke.
        const topo = getTopology(s.board);
        const corners = new Set(s.board.harbors.flatMap((h) => [topo.edges[h.edge].a, topo.edges[h.edge].b]));
        expect(corners.size).toBe(s.board.harbors.length * 2);
        // Aufstellung: hin und zurück, je eine Siedlung und Straße.
        expect(s.phase).toMatchObject({ kind: 'setup', order: [...Array(n).keys(), ...[...Array(n).keys()].reverse()] });
        expect(getTopology(s.board).hexes).toHaveLength(37);
      }
    });
  }

  it('mehr als 8 Spieler gibt es nicht, die Erweiterungen nur bis 6', () => {
    expect(() => createGame(players(9), { victoryPoints: 10 }, 1)).toThrow(/2 bis 8/);
    expect(() => createGame(players(7), { victoryPoints: 13, variants: ['stadtwacht'] }, 1)).toThrow(/bis zu 6/);
    expect(() => createGame(players(7), { victoryPoints: 10, map: 'atoll' }, 1)).toThrow(/5–6 Spieler/);
    // Hausregeln gehen auch mit 8.
    expect(createGame(players(8), { victoryPoints: 11, variants: ['milderRaeuber', 'hafenvogt', 'wuerfelstapel'] }, 1).players).toHaveLength(8);
  });
});

describe('7–8 Spieler: im Spiel', () => {
  for (const n of [7, 8]) {
    it(`${n} Spieler: Bots spielen bis zum Sieg, nichts geht verloren, Sonderbauphase läuft`, { timeout: 120000 }, () => {
      let wins = 0;
      for (const seed of [11, 12, 13]) {
        const random = seeded(seed * 31 + n);
        let s = createGame(players(n), { victoryPoints: 10 }, seed);
        let special = false;
        for (let step = 0; step < 20000 && s.phase.kind !== 'ended'; step++) {
          const next = botStep(s, random);
          expect(next).not.toBeNull();
          s = applyAction(s, next!.seat, next!.action);
          if (s.phase.kind === 'specialBuild') special = true;
          if (step % 50 === 0) {
            expect(isConsistent(s)).toBe(true);
            expect(devTotal(s)).toBe(44);
          }
        }
        expect(special).toBe(true);
        if (s.phase.kind === 'ended') {
          wins++;
          expect(victoryPoints(s, s.winner!, true)).toBeGreaterThanOrEqual(10);
        }
      }
      expect(wins).toBeGreaterThan(0);
    });
  }

  it('8 Spieler: Nach einem Host-Wechsel hat jeder wieder genau seine Karten', () => {
    const random = seeded(808);
    let s = createGame(players(8), { victoryPoints: 30 }, 8);
    for (let i = 0; i < 1500; i++) {
      const next = botStep(s, random)!;
      s = applyAction(s, next.seat, next.action);
    }
    const secrets = new Map<number, Secret>(s.players.map((_, seat) => [seat, secretOf(s, seat)!]));
    const { state, dealt } = rebuild(viewFor(s, 3), secrets, { rng: 5 });
    expect(dealt).toEqual([]);
    expect(isConsistent(state)).toBe(true);
    const hands = (g: GameState) => g.players.map((p) => [p.resources, [...p.devCards].sort(), [...p.newDevCards].sort()]);
    expect(hands(state)).toEqual(hands(s));
    const deck = (g: GameState) => [...g.devDeck].sort() as DevCard[];
    expect(deck(state)).toEqual(deck(s));
    expect(devDeckFor(8).knight).toBe(26);
  });
});
