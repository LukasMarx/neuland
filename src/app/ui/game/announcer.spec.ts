import { describe, expect, it } from 'vitest';
import { createGame, GameState, getTopology } from '../../engine';
import { voiceEvents } from './announcer';

function game(): GameState {
  const players = [0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = createGame(players, { victoryPoints: 10 }, 5);
  return { ...s, phase: { kind: 'main' }, turn: 4, current: 1 };
}

/** Der nächste Spielstand nach `change`, wie ihn ein Client sieht. */
function step(prev: GameState, change: (s: GameState) => void): GameState {
  const next = structuredClone(prev);
  next.version = prev.version + 1;
  next.transfers = [];
  change(next);
  return next;
}

describe('Sprecher: Ereignisse aus meiner Sicht', () => {
  it('Raub an mir: der Erzfeind spricht, beim Raub an anderen nicht', () => {
    const prev = game();
    const robbed = step(prev, (s) => s.transfers.push({ from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'wood', count: 1, hidden: true }));
    expect(voiceEvents(prev, robbed, 0)).toEqual(['robbedMe']);
    expect(voiceEvents(prev, robbed, 2)).toEqual([]);
  });

  it('Handelsstraße und Rittermacht: Berater für mich, Erzfeind für Gegner', () => {
    const prev = game();
    const mine = step(prev, (s) => {
      s.longestRoad = 0;
      s.largestArmy = 0;
    });
    expect(voiceEvents(prev, mine, 0)).toEqual(['myLongestRoad', 'myLargestArmy']);
    expect(voiceEvents(prev, mine, 1)).toEqual(['enemyLongestRoad', 'enemyLargestArmy']);
  });

  it('eigene Handelsstraße wächst: Berater; gleich lang: nichts', () => {
    const prev = { ...game(), longestRoad: 0, roadLengths: [5, 2, 2] };
    expect(voiceEvents(prev, step(prev, (s) => (s.roadLengths = [6, 2, 2])), 0)).toEqual(['myLongestRoadGrows']);
    expect(voiceEvents(prev, step(prev, () => undefined), 0)).toEqual([]);
  });

  it('Monopol: eigenes kommentiert der Berater, ein fremdes nur, wenn es mich trifft', () => {
    const prev = game();
    const monopoly = step(prev, (s) => {
      s.playedDev = ['monopoly'];
      s.transfers.push({ from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'ore', count: 2 });
    });
    expect(voiceEvents(prev, monopoly, 1)).toEqual(['myMonopoly']);
    expect(voiceEvents(prev, monopoly, 0)).toEqual(['enemyMonopoly']);
    expect(voiceEvents(prev, monopoly, 2)).toEqual([]);
  });

  it('eine 7 und ich muss abwerfen, egal wer gewürfelt hat', () => {
    const prev = { ...game(), phase: { kind: 'roll' as const }, current: 1 };
    const seven = step(prev, (s) => {
      s.dice = [3, 4];
      s.phase = { kind: 'discard', pending: [4, 0, 0] };
    });
    expect(voiceEvents(prev, seven, 0)).toEqual(['mustDiscard']);
    expect(voiceEvents(prev, seven, 1)).toEqual([]);
    // Abwerfen der Stadtwacht (mit Empfänger) ist keine 7.
    const other = step(prev, (s) => (s.phase = { kind: 'discard', pending: [2, 0, 0], to: 1, then: 'main' }));
    expect(voiceEvents(prev, other, 0)).toEqual([]);
  });

  it('meine Sonderbaurunde beginnt', () => {
    const prev = game();
    const special = step(prev, (s) => (s.phase = { kind: 'specialBuild', queue: [2, 0] }));
    expect(voiceEvents(prev, special, 2)).toEqual(['mySpecialBuild']);
    expect(voiceEvents(prev, special, 0)).toEqual([]);
    const next = step(special, (s) => (s.phase = { kind: 'specialBuild', queue: [0] }));
    expect(voiceEvents(special, next, 0)).toEqual(['mySpecialBuild']);
  });

  it('Gegner baut eine Siedlung oder Straße, nicht in der Aufbauphase und nicht die eigene', () => {
    const prev = game();
    const topo = getTopology(prev.board);
    const v = topo.vertices.find((x) => x.edges.length === 3)!;
    const settled = step(prev, (s) => (s.buildings[v.id] = { owner: 1, type: 'settlement' }));
    expect(voiceEvents(prev, settled, 0)).toEqual(['enemySettlement']);
    expect(voiceEvents(prev, settled, 1)).toEqual([]);

    const road = step(prev, (s) => (s.roads[v.edges[1]] = 1));
    expect(voiceEvents(prev, road, 0)).toEqual(['enemyRoad']);
    expect(voiceEvents(prev, road, 1)).toEqual([]);

    const setup = { ...prev, phase: { kind: 'setup' as const, order: [0, 1, 2], index: 1, step: 'road' as const, settlement: null } };
    expect(voiceEvents(setup, step(setup, (s) => (s.buildings[v.id] = { owner: 1, type: 'settlement' })), 0)).toEqual([]);
  });

  it('nichts bei altem Stand oder als Zuschauer', () => {
    const prev = game();
    const next = step(prev, (s) => (s.longestRoad = 1));
    expect(voiceEvents(next, prev, 0)).toEqual([]);
    expect(voiceEvents(prev, next, -1)).toEqual([]);
  });
});
