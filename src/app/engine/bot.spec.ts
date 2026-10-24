import { describe, expect, it } from 'vitest';
import { botAction, botAnswer, botAwaitsAnswers, botPlan, BOT_PROFILES, botTradeResponse } from './bot';
import { getTopology } from './board';
import { applyAction, createGame, legalCityVertices, legalSettlementVertices, victoryPoints, vulnerableCities } from './rules';
import { isConsistent } from './secrets';
import { GameSettings, GameState, RESOURCES } from './types';

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

/** Nach der Aufstellung, in der Hauptphase, Sitz 0 am Zug. */
function afterSetup(n: number, seed: number, settings: GameSettings = { victoryPoints: 10 }): GameState {
  let s = createGame(players(n), settings, seed);
  while (s.phase.kind === 'setup') s = applyAction(s, s.phase.order[s.phase.index], botAction(s, s.phase.order[s.phase.index])!);
  s = structuredClone(s);
  s.phase = { kind: 'main' };
  s.current = 0;
  return s;
}

const hand = (wood: number, brick: number, sheep: number, wheat: number, ore: number) => ({
  wood,
  brick,
  sheep,
  wheat,
  ore,
});

describe('Plan des Bots', () => {
  it('kennt Strategie, Ziel und Bedarf: was dem Ziel fehlt und was übrig ist', () => {
    const s = afterSetup(3, 4);
    s.players[0].resources = hand(0, 0, 3, 1, 1);
    const plan = botPlan(s, 0);
    expect(['cities', 'expansion', 'balanced']).toContain(plan.strategy);
    expect(plan.goal).not.toBeNull();
    for (const r of ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const) {
      expect(plan.need[r] - plan.spare[r]).toBe(plan.goal!.cost[r] - s.players[0].resources[r]);
    }
    // Die Ziele sind nach Gewinn je Runde sortiert.
    const scores = plan.goals.map((g) => g.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('plant Straßen zu einem Bauplatz, der noch nicht erreichbar ist', () => {
    const s = afterSetup(3, 4);
    expect(legalSettlementVertices(s, 0)).toEqual([]);
    s.players[0].resources = hand(3, 3, 1, 1, 0);
    const plan = botPlan(s, 0);
    const settlement = plan.goals.find((g) => g.kind === 'settlement')!;
    expect(settlement.step.type).toBe('buildRoad');
    expect(settlement.cost.wood).toBeGreaterThan(1);
    expect(botAction(s, 0)).toMatchObject({ type: 'buildRoad' });
  });

  it('wählt auf leicht manchmal nicht den besten Bauplatz', () => {
    const picks = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const s = createGame(players(4), { victoryPoints: 10 }, seed);
      const seat = s.phase.kind === 'setup' ? s.phase.order[0] : 0;
      return [botAction(s, seat, { level: 'normal' }), botAction(s, seat, { level: 'easy' })];
    });
    expect(picks.some(([n, e]) => JSON.stringify(n) !== JSON.stringify(e))).toBe(true);
    expect(BOT_PROFILES.easy.offers).toBe(0);
  });
});

describe('Handel des Bots', () => {
  it('bietet am Zug Überschuss gegen eine fehlende Karte an, aber nur, wenn er darf', () => {
    const s = afterSetup(3, 4);
    s.players[0].resources = hand(0, 0, 1, 1, 5);
    s.players[1].resources = hand(2, 2, 2, 2, 2);
    s.players[2].resources = hand(2, 2, 2, 2, 2);
    // Ohne Zählung (Bot springt nur ein) kein Angebot, sondern Bank.
    expect(botAction(s, 0)?.type).not.toBe('offerTrade');
    const offer = botAction(s, 0, { offersMade: 0 });
    expect(offer).toMatchObject({ type: 'offerTrade' });
    expect(botAction(s, 0, { offersMade: 1 })?.type).not.toBe('offerTrade');
  });

  it('wartet auf Antworten, schließt mit einem Partner ab oder zieht zurück', () => {
    let s = afterSetup(3, 4);
    s.players[0].resources = hand(0, 0, 1, 2, 5);
    s.players[1].resources = hand(2, 2, 2, 2, 2);
    s = applyAction(s, 0, {
      type: 'offerTrade',
      give: hand(0, 0, 0, 0, 1),
      want: hand(1, 0, 0, 0, 0),
    });
    expect(botAwaitsAnswers(s, 0)).toBe(true);
    const accepted = applyAction(s, 1, {
      type: 'respondTrade',
      offerId: s.offers[0].id,
      accept: true,
    });
    expect(botAwaitsAnswers(accepted, 0)).toBe(false);
    expect(botAction(accepted, 0, { offersMade: 1 })).toEqual({
      type: 'confirmTrade',
      offerId: s.offers[0].id,
      partner: 1,
    });
    let declined = applyAction(s, 1, {
      type: 'respondTrade',
      offerId: s.offers[0].id,
      accept: false,
    });
    declined = applyAction(declined, 2, {
      type: 'respondTrade',
      offerId: s.offers[0].id,
      accept: false,
    });
    expect(botAwaitsAnswers(declined, 0)).toBe(false);
    expect(botAction(declined, 0, { offersMade: 1 })).toEqual({ type: 'withdrawOffers' });
  });

  it('macht ein Gegenangebot, wenn ihm das Angebot so nicht passt, und lehnt danach ab', () => {
    let s = afterSetup(3, 4);
    s.players[0].resources = hand(0, 0, 0, 3, 0);
    s.players[1].resources = hand(0, 0, 2, 1, 3);
    // Sitz 0 will Erz für Getreide. Sitz 1 fehlt Getreide für eine Stadt, das Erz braucht er aber selbst:
    // Er bietet stattdessen ein Schaf an, das er übrig hat.
    s = applyAction(s, 0, {
      type: 'offerTrade',
      give: hand(0, 0, 0, 1, 0),
      want: hand(0, 0, 0, 0, 1),
    });
    const offer = s.offers[0];
    expect(botPlan(s, 1).goal?.kind).toBe('city');
    expect(botTradeResponse(s, 1, offer)).toBe(false);
    const answer = botAnswer(s, 1, offer);
    expect(answer).toEqual({
      type: 'offerTrade',
      give: hand(0, 0, 1, 0, 0),
      want: hand(0, 0, 0, 1, 0),
    });
    s = applyAction(s, 1, answer!);
    expect(s.offers.find((o) => o.from === 1)?.counter).toBe(true);
    expect(botAnswer(s, 1, offer)).toEqual({
      type: 'respondTrade',
      offerId: offer.id,
      accept: false,
    });
  });

  it('nimmt ein lohnendes Gegenangebot an', () => {
    let s = afterSetup(3, 4);
    s.players[0].resources = hand(0, 0, 3, 2, 2);
    s.players[1].resources = hand(0, 0, 0, 0, 2);
    s = applyAction(s, 1, {
      type: 'offerTrade',
      give: hand(0, 0, 0, 0, 1),
      want: hand(0, 0, 1, 0, 0),
    });
    expect(botAction(s, 0)).toEqual({ type: 'confirmTrade', offerId: s.offers[0].id, partner: 1 });
  });
});

describe('Bot auf den Erweiterungen', () => {
  it('Gold: nimmt, was dem Ziel fehlt', () => {
    const s = afterSetup(4, 3, { victoryPoints: 12, map: 'inselquartett' });
    s.players[0].resources = hand(0, 0, 0, 2, 2);
    s.phase = { kind: 'gold', pending: [1, 0, 0, 0] };
    const plan = botPlan(s, 0);
    const action = botAction(s, 0);
    expect(action?.type).toBe('chooseGold');
    const picked = RESOURCES.find((r) => action?.type === 'chooseGold' && action.resources[r] > 0)!;
    expect(plan.need[picked]).toBeGreaterThan(0);
  });

  it('Stadtwacht: gibt bei einem verlorenen Angriff die schwächste Stadt ab', () => {
    const s = afterSetup(3, 5, { victoryPoints: 13, variants: ['stadtwacht'] });
    for (const v of s.buildings.flatMap((b, i) => (b?.owner === 0 ? [i] : []))) s.buildings[v] = { owner: 0, type: 'city' };
    const cities = vulnerableCities(s, 0);
    expect(cities.length).toBe(2);
    s.phase = { kind: 'raid', pending: [1, 0, 0], sum: 8 };
    const topo = getTopology(s.board);
    const pips = (v: number) => topo.vertices[v].hexes.reduce((n, h) => n + (s.board.hexes[h].number ? 6 - Math.abs(7 - s.board.hexes[h].number!) : 0), 0);
    const action = botAction(s, 0);
    expect(action).toEqual({ type: 'loseCity', vertex: pips(cities[0]) <= pips(cities[1]) ? cities[0] : cities[1] });
  });

  it('Stadtwacht: spielt das Losbuch statt zu würfeln und wählt nie die 7', () => {
    const s = afterSetup(3, 5, { victoryPoints: 13, variants: ['stadtwacht'] });
    s.phase = { kind: 'roll' };
    s.progress![0] = ['fortune'];
    const action = botAction(s, 0);
    expect(action).toMatchObject({ type: 'playProgress', progress: 'fortune' });
    const dice = action?.type === 'playProgress' ? action.dice! : [0, 0];
    expect(dice[0] + dice[1]).not.toBe(7);
    expect(dice.every((d) => d >= 1 && d <= 6)).toBe(true);
    expect(() => applyAction(s, 0, action!)).not.toThrow();
  });

  it('Stadtwacht: holt mit dem Überläufer einen fremden Wächter', () => {
    let s = afterSetup(3, 5, { victoryPoints: 13, variants: ['stadtwacht'] });
    s.players[1].resources = hand(0, 0, 1, 0, 1);
    s.current = 1;
    // Sitz 1 stellt einen Wächter auf, Sitz 0 hat den Überläufer.
    const vertex = getTopology(s.board).vertices.find((v) => !s.buildings[v.id] && v.edges.some((e) => s.roads[e] === 1) && v.neighbors.every((w) => !s.guards?.[w]))!.id;
    s = applyAction(s, 1, { type: 'buildGuard', vertex });
    s.current = 0;
    s.progress![0] = ['turncoat'];
    s.players[0].resources = hand(0, 0, 0, 0, 0);
    const action = botAction(s, 0);
    expect(action).toMatchObject({ type: 'playProgress', progress: 'turncoat' });
    expect(action?.type === 'playProgress' && action.vertices?.[0]).toBe(vertex);
    const next = applyAction(s, 0, action!);
    expect(next.guards![vertex]).toBeNull();
    expect(next.guards!.some((g) => g?.owner === 0)).toBe(true);
  });
});
