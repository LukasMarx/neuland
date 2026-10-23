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

const never = () => 1;
const always = () => 0;

describe('Sprecher: Ereignisse aus meiner Sicht', () => {
  it('Raub an mir: der Erzfeind spricht, beim Raub an anderen nicht', () => {
    const prev = game();
    const robbed = step(prev, (s) => s.transfers.push({ from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'wood', count: 1, hidden: true }));
    expect(voiceEvents(prev, robbed, 0, never)).toEqual(['robbedMe']);
    expect(voiceEvents(prev, robbed, 2, never)).toEqual([]);
  });

  it('Handelsstraße und Rittermacht: Berater für mich, Erzfeind für Gegner', () => {
    const prev = game();
    const mine = step(prev, (s) => {
      s.longestRoad = 0;
      s.largestArmy = 0;
    });
    expect(voiceEvents(prev, mine, 0, never)).toEqual(['myLongestRoad', 'myLargestArmy']);
    expect(voiceEvents(prev, mine, 1, never)).toEqual(['enemyLongestRoad', 'enemyLargestArmy']);
  });

  it('Monopol: eigenes kommentiert der Berater, ein fremdes nur, wenn es mich trifft', () => {
    const prev = game();
    const monopoly = step(prev, (s) => {
      s.playedDev = ['monopoly'];
      s.transfers.push({ from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'ore', count: 2 });
    });
    expect(voiceEvents(prev, monopoly, 1, never)).toEqual(['myMonopoly']);
    expect(voiceEvents(prev, monopoly, 0, never)).toEqual(['enemyMonopoly']);
    expect(voiceEvents(prev, monopoly, 2, never)).toEqual([]);
  });

  it('eigene 7 nach dem Wurf', () => {
    const prev = { ...game(), phase: { kind: 'roll' as const }, current: 0 };
    const seven = step(prev, (s) => {
      s.dice = [3, 4];
      s.phase = { kind: 'robber', returnTo: 'main' };
    });
    expect(voiceEvents(prev, seven, 0, never)).toEqual(['mySeven']);
    expect(voiceEvents(prev, seven, 1, never)).toEqual([]);
  });

  it('Gegner siedelt an meiner Straße; sonst kommentiert er Straßen nur ab und zu', () => {
    const prev = game();
    const topo = getTopology(prev.board);
    const v = topo.vertices.find((x) => x.edges.length === 3)!;
    prev.roads[v.edges[0]] = 0;
    const settled = step(prev, (s) => (s.buildings[v.id] = { owner: 1, type: 'settlement' }));
    expect(voiceEvents(prev, settled, 0, never)).toEqual(['enemySettlesNearMe']);

    const road = step(prev, (s) => (s.roads[v.edges[1]] = 1));
    expect(voiceEvents(prev, road, 0, always)).toEqual(['enemyRoad']);
    expect(voiceEvents(prev, road, 0, never)).toEqual([]);
    // Die eigene Straße kommentiert der Erzfeind nicht.
    expect(voiceEvents(prev, road, 1, always)).toEqual([]);
  });

  it('nichts bei altem Stand oder als Zuschauer', () => {
    const prev = game();
    const next = step(prev, (s) => (s.longestRoad = 1));
    expect(voiceEvents(next, prev, 0, never)).toEqual([]);
    expect(voiceEvents(prev, next, -1, never)).toEqual([]);
  });
});
