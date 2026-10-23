import { describe, expect, it } from 'vitest';
import { createGame, GameState, getTopology, Transfer } from '../../engine';
import { effectEvents } from './effects';

function game(): GameState {
  const players = [0, 1, 2].map((i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  return { ...createGame(players, { victoryPoints: 10 }, 5), phase: { kind: 'main' }, turn: 4, current: 1 };
}

function step(prev: GameState, change: (s: GameState) => void): GameState {
  const next = structuredClone(prev);
  next.version = prev.version + 1;
  next.transfers = [];
  change(next);
  return next;
}

const player = (seat: number) => ({ kind: 'player' as const, seat });
const bank = { kind: 'bank' as const };
const move = (from: Transfer['from'], to: Transfer['to'], card: Transfer['card'] = 'wood', hidden?: boolean): Transfer => ({ from, to, card, count: 1, hidden });

describe('Geräusche zum Spielstand', () => {
  it('Bauen: Straße, Siedlung, Stadt; bezahlen ist kein Bankhandel', () => {
    const prev = game();
    const topo = getTopology(prev.board);
    const v = topo.vertices[0];
    const road = step(prev, (s) => {
      s.roads[v.edges[0]] = 1;
      s.transfers = [move(player(1), bank), move(player(1), bank, 'brick')];
    });
    expect(effectEvents(prev, road, 0)).toEqual(['strasse']);
    const settled = step(prev, (s) => (s.buildings[v.id] = { owner: 1, type: 'settlement' }));
    expect(effectEvents(prev, settled, 0)).toEqual(['siedlung']);
    const city = step(settled, (s) => (s.buildings[v.id] = { owner: 1, type: 'city' }));
    expect(effectEvents(settled, city, 0)).toEqual(['stadt']);
  });

  it('Rohstoffe aus Feldern hört nur, wer sie bekommt', () => {
    const prev = game();
    const roll = step(prev, (s) => (s.transfers = [move({ kind: 'hex', id: 3 }, player(2))]));
    expect(effectEvents(prev, roll, 2)).toEqual(['karten']);
    expect(effectEvents(prev, roll, 0)).toEqual([]);
  });

  it('Entwicklungskarte kaufen ist Pergament, kein Bankhandel; Ritter ist das Schwert', () => {
    const prev = game();
    const buy = step(prev, (s) => (s.transfers = [move(player(1), bank, 'ore'), move(bank, player(1), 'dev')]));
    expect(effectEvents(prev, buy, 0)).toEqual(['pergament']);
    const knight = step(prev, (s) => (s.playedDev = ['knight']));
    expect(effectEvents(prev, knight, 0)).toEqual(['schwert']);
  });

  it('Tausch, Bankhandel und Raub unterscheiden sich', () => {
    const prev = game();
    const trade = step(prev, (s) => (s.transfers = [move(player(1), player(2)), move(player(2), player(1), 'ore')]));
    expect(effectEvents(prev, trade, 0)).toEqual(['muenzen']);
    const harbor = step(prev, (s) => (s.transfers = [move(player(1), bank), move(player(1), bank), move(bank, player(1), 'ore')]));
    expect(effectEvents(prev, harbor, 0)).toEqual(['muenze']);
    const robbed = step(prev, (s) => {
      s.robber = (prev.robber + 1) % s.board.hexes.length;
      s.transfers = [move(player(2), player(1), 'wood', true)];
    });
    expect(effectEvents(prev, robbed, 0)).toEqual(['raeuber']);
  });

  it('Handelsstraße oder Rittermacht wechselt: Horn; Sieg übertönt alles', () => {
    const prev = game();
    expect(effectEvents(prev, step(prev, (s) => (s.longestRoad = 2)), 0)).toEqual(['horn']);
    expect(effectEvents(prev, step(prev, (s) => (s.largestArmy = 2)), 0)).toEqual(['horn']);
    const won = step(prev, (s) => {
      s.phase = { kind: 'ended' };
      s.winner = 1;
      s.longestRoad = 1;
    });
    expect(effectEvents(prev, won, 0)).toEqual(['sieg']);
  });
});
