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

  it('Sonderbaurunde: der Herold eröffnet, der Berater meldet meine', () => {
    const prev = game();
    const special = step(prev, (s) => (s.phase = { kind: 'specialBuild', queue: [2, 0] }));
    expect(voiceEvents(prev, special, 2)).toEqual(['specialBuildStart', 'mySpecialBuild']);
    expect(voiceEvents(prev, special, 0)).toEqual(['specialBuildStart']);
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

  it('Sieg übertönt alles: Berater für mich, Erzfeind für einen Gegner', () => {
    const prev = game();
    const won = step(prev, (s) => {
      s.phase = { kind: 'ended' };
      s.winner = 1;
      s.longestRoad = 1;
    });
    expect(voiceEvents(prev, won, 1)).toEqual(['anyWin', 'myWin']);
    expect(voiceEvents(prev, won, 0)).toEqual(['anyWin', 'enemyWin']);
  });

  it('Handelsstraße verloren: erst der Berater, dann spottet der Erzfeind', () => {
    const prev = { ...game(), longestRoad: 0 };
    expect(voiceEvents(prev, step(prev, (s) => (s.longestRoad = 1)), 0)).toEqual(['lostLongestRoad', 'enemyLongestRoad']);
    expect(voiceEvents(prev, step(prev, (s) => (s.longestRoad = null)), 0)).toEqual(['lostLongestRoad']);
  });

  it('eigene und fremde Städte, reiche Ernte', () => {
    const prev = game();
    const v = prev.buildings.length - 1;
    prev.buildings[v] = { owner: 0, type: 'settlement' };
    const city = step(prev, (s) => (s.buildings[v] = { owner: 0, type: 'city' }));
    expect(voiceEvents(prev, city, 0)).toEqual(['myCity']);
    expect(voiceEvents(prev, city, 1)).toEqual(['enemyCity']);

    const rolling = { ...game(), phase: { kind: 'roll' as const } };
    const harvest = step(rolling, (s) => {
      s.phase = { kind: 'main' };
      s.transfers = [3, 2].map((count) => ({ from: { kind: 'hex' as const, id: 0 }, to: { kind: 'player' as const, seat: 2 }, card: 'ore' as const, count }));
    });
    expect(voiceEvents(rolling, harvest, 2)).toEqual(['bigHarvest']);
  });

  it('ich raube, ein Tausch kommt zustande, ein Gegner lehnt mein Angebot ab', () => {
    const prev = game();
    const robbed = step(prev, (s) => s.transfers.push({ from: { kind: 'player', seat: 2 }, to: { kind: 'player', seat: 0 }, card: 'wood', count: 1, hidden: true }));
    expect(voiceEvents(prev, robbed, 0)).toEqual(['iRobbed']);

    const traded = step(prev, (s) =>
      s.transfers.push(
        { from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'wood', count: 1 },
        { from: { kind: 'player', seat: 1 }, to: { kind: 'player', seat: 0 }, card: 'ore', count: 1 },
      ),
    );
    expect(voiceEvents(prev, traded, 0)).toEqual(['tradeDone']);

    const none = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const offered = { ...prev, offers: [{ id: 7, from: 0, give: none, want: none, counter: false, accepted: [], declined: [] }] };
    const declined = step(offered, (s) => s.offers[0].declined.push(1));
    expect(voiceEvents(offered, declined, 0)).toEqual(['tradeRejected']);
    // Der zweite, der ablehnt, löst nichts mehr aus.
    expect(voiceEvents(declined, step(declined, (s) => s.offers[0].declined.push(2)), 0)).toEqual([]);
  });

  it('Räuber an meinem Feld ohne Raub; mit Raub nur der Raub-Satz', () => {
    const prev = game();
    const topo = getTopology(prev.board);
    const hex = topo.hexes.find((h) => h.id !== prev.robber && !h.sea)!;
    prev.buildings[hex.corners[0]] = { owner: 0, type: 'settlement' };
    const moved = step(prev, (s) => (s.robber = hex.id));
    expect(voiceEvents(prev, moved, 0)).toEqual(['robberOnMyHex']);
    const movedAndRobbed = step(prev, (s) => {
      s.robber = hex.id;
      s.transfers.push({ from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'wood', count: 1, hidden: true });
    });
    expect(voiceEvents(prev, movedAndRobbed, 0)).toEqual(['robbedMe']);
  });

  it('noch ein Punkt bis zum Sieg', () => {
    const prev = game();
    const close = step(prev, (s) => s.players[0].devCards.push(...Array(9).fill('victoryPoint')));
    expect(voiceEvents(prev, close, 0)).toEqual(['myMatchPoint']);
    // Verdeckte Siegpunktkarten eines Gegners sieht niemand.
    expect(voiceEvents(prev, close, 1)).toEqual([]);
  });

  it('Herold: Ende der Aufbauphase, leere Bank, neu gemischter Würfelstapel', () => {
    const setup = { ...game(), phase: { kind: 'setup' as const, order: [0, 1, 2], index: 5, step: 'road' as const, settlement: null } };
    expect(voiceEvents(setup, step(setup, (s) => (s.phase = { kind: 'roll' })), 0)).toEqual(['setupDone']);

    const prev = game();
    expect(voiceEvents(prev, step(prev, (s) => (s.bank = { ...s.bank, ore: 0 })), 0)).toEqual(['bankEmpty']);

    const deck = { ...prev, diceDeck: { 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 1, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } };
    const reshuffled = step(deck, (s) => (s.diceDeck = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }));
    expect(voiceEvents(deck, reshuffled, 0)).toEqual(['diceReshuffle']);
    expect(voiceEvents(deck, step(deck, (s) => (s.diceDeck = { ...deck.diceDeck!, 7: 0 })), 0)).toEqual([]);
  });

  it('nichts bei altem Stand oder als Zuschauer', () => {
    const prev = game();
    const next = step(prev, (s) => (s.longestRoad = 1));
    expect(voiceEvents(next, prev, 0)).toEqual([]);
    expect(voiceEvents(prev, next, -1)).toEqual([]);
  });
});
