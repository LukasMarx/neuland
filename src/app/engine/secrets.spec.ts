import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { applyAction, createGame, devDeckFor } from './rules';
import { rebuild, Secret, secretOf, viewFor } from './secrets';
import { deckSize, DevCard, devCount, GameState, handSize, RESOURCES, totalResources } from './types';
import { FISH_POOL, VariantId } from './variants';

/** Eine Partie mit Bots ein Stück weit spielen, damit Hände, Stapel und Fische gefüllt sind. */
function midGame(n = 4, variants: VariantId[] = ['fischgruende'], steps = 700, seed = 3): GameState {
  const random = seeded(seed * 101);
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }));
  let s = createGame(players, { victoryPoints: 30, variants }, seed);
  for (let i = 0; i < steps; i++) {
    const next = botStep(s, random)!;
    s = applyAction(s, next.seat, next.action);
  }
  return s;
}

const sorted = <T>(xs: T[]) => [...xs].sort();

/** Nichts entsteht, nichts geht verloren: Vorrat, Entwicklungskarten und Fische gehen auf. */
function expectConserved(s: GameState): void {
  for (const r of RESOURCES) expect(s.bank[r] + s.players.reduce((n, p) => n + p.resources[r], 0)).toBe(s.supply);
  const dev = [...s.devDeck, ...(s.playedDev ?? []), ...s.players.flatMap((p) => [...p.devCards, ...p.newDevCards])];
  const initial = devDeckFor(s.players.length);
  for (const c of Object.keys(initial) as DevCard[]) expect(dev.filter((x) => x === c)).toHaveLength(initial[c]);
  if (s.fish) {
    const held = s.fish.flat();
    for (const v of [1, 2, 3]) expect((s.fishPool![v] ?? 0) + held.filter((x) => x === v).length).toBe(FISH_POOL[v]);
    expect((s.fishPool!['anchor'] ?? 0) + (s.anchor == null ? 0 : 1)).toBe(1);
  }
}

describe('Verdeckte Informationen', () => {
  it('der volle Stand geht auf, auch nach vielen Zügen', () => {
    expectConserved(midGame());
  });

  it('jeder sieht nur die eigenen Karten; fremde nur als Anzahl, Stapel nur als Größe', () => {
    const s = midGame();
    const v = viewFor(s, 1);
    expect(v.view).toBe(1);
    expect(v.players[1].resources).toEqual(s.players[1].resources);
    expect(v.players[1].hidden).toBeUndefined();
    for (const i of [0, 2, 3]) {
      expect(totalResources(v.players[i].resources)).toBe(0);
      expect(v.players[i].devCards).toEqual([]);
      expect(v.fish![i]).toEqual([]);
      expect(handSize(v.players[i])).toBe(totalResources(s.players[i].resources));
      expect(devCount(v.players[i])).toBe(devCount(s.players[i]));
      expect(v.players[i].hidden!.fish).toBe(s.fish![i].length);
    }
    expect(v.devDeck).toEqual([]);
    expect(deckSize(v)).toBe(s.devDeck.length);
    expect(v.fishPool).toEqual({});
    // Zuschauer sehen von niemandem etwas.
    expect(viewFor(s, -1).players.every((p) => p.hidden)).toBe(true);
    // Der volle Stand bleibt unberührt.
    expect(s.view).toBeUndefined();
    expect(s.devDeck.length).toBe(deckSize(v));
  });

  it('die beim Räuber gezogene Karte sehen nur Geber und Nehmer', () => {
    const s = structuredClone(midGame());
    s.transfers = [{ from: { kind: 'player', seat: 2 }, to: { kind: 'player', seat: 0 }, card: 'ore', count: 1, hidden: true }];
    expect(viewFor(s, 0).transfers[0].card).toBe('ore');
    expect(viewFor(s, 2).transfers[0].card).toBe('ore');
    expect(viewFor(s, 1).transfers[0].card).not.toBe('ore');
  });

  it('am Ende sieht jeder alles', () => {
    const s = structuredClone(midGame());
    s.phase = { kind: 'ended' };
    expect(viewFor(s, 0)).toBe(s);
  });

  it('mit allen Geheimnissen entsteht genau der alte Stand wieder', () => {
    const s = midGame();
    const secrets = new Map<number, Secret>(s.players.map((_, i) => [i, secretOf(s, i)!]));
    const { state, dealt } = rebuild(viewFor(s, 2), secrets, { rng: 9 });
    expect(dealt).toEqual([]);
    expect({ ...state, devDeck: sorted(state.devDeck), fishPool: undefined }).toEqual({ ...s, devDeck: sorted(s.devDeck), fishPool: undefined });
    for (const k of Object.keys(FISH_POOL)) expect(state.fishPool![k] ?? 0).toBe(s.fishPool![k] ?? 0);
    expectConserved(state);
  });

  it('eine Hand mit passender Anzahl, deren Karten es nicht mehr gibt, wird nicht übernommen', () => {
    const s = midGame(4, [], 900, 6);
    // Sitz 1 meldet so viele Karten wie öffentlich bekannt, aber alle von einer Sorte, die längst vergeben ist.
    const real = secretOf(s, 1)!;
    const n = totalResources(real.resources);
    const scarce = RESOURCES.reduce((a, r) => (s.bank[r] < s.bank[a] ? r : a));
    const fake = { ...real, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, [scarce]: n } };
    const secrets = new Map<number, Secret>([[0, secretOf(s, 0)!], [2, secretOf(s, 2)!], [3, secretOf(s, 3)!], [1, fake]]);
    const { state, dealt } = rebuild(viewFor(s, 0), secrets, { rng: 2 });
    const left = s.supply! - s.bank[scarce] - [0, 2, 3].reduce((m, i) => m + s.players[i].resources[scarce], 0);
    expect(n).toBeGreaterThan(left);
    expect(dealt).toEqual([1]);
    expectConserved(state);
  });

  it('fehlt ein Geheimnis oder passt es nicht, wird für diesen Sitz passend neu ausgeteilt', () => {
    const s = midGame(4, ['fischgruende'], 900, 5);
    const view = viewFor(s, 0);
    const secrets = new Map<number, Secret>([[0, secretOf(s, 0)!], [1, secretOf(s, 1)!]]);
    // Sitz 2 meldet eine Hand, die nicht zur öffentlichen Anzahl passt.
    const wrong = secretOf(s, 2)!;
    secrets.set(2, { ...wrong, resources: { ...wrong.resources, ore: wrong.resources.ore + 1 } });
    const { state, dealt } = rebuild(view, secrets, { rng: 4 });
    expect(dealt).toEqual([2, 3]);
    expect(state.players[1].resources).toEqual(s.players[1].resources);
    for (const i of [2, 3]) {
      expect(totalResources(state.players[i].resources)).toBe(totalResources(s.players[i].resources));
      expect(devCount(state.players[i])).toBe(devCount(s.players[i]));
      expect(state.fish![i]).toHaveLength(s.fish![i].length);
    }
    expect(state.devDeck).toHaveLength(s.devDeck.length);
    expectConserved(state);
    // Und es lässt sich weiterspielen.
    const random = seeded(17);
    let g = state;
    for (let i = 0; i < 400 && g.phase.kind !== 'ended'; i++) {
      const next = botStep(g, random)!;
      g = applyAction(g, next.seat, next.action);
    }
    expectConserved(g);
  });
});
