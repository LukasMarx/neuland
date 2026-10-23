import { describe, expect, it } from 'vitest';
import { createGame, GameState, getTopology, RAIDER_TRACK } from '../../engine';
import { voiceEvents } from './announcer';

/** Eine Partie nach der Aufbauphase, ich bin Sitz 0, am Zug ist Sitz 1. */
function game(options: { map?: string; variants?: string[]; players?: number } = {}): GameState {
  const players = Array.from({ length: options.players ?? 3 }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = createGame(players, { victoryPoints: 30, map: options.map, variants: options.variants }, 5);
  return { ...s, phase: { kind: 'main' }, turn: 4, current: 1 };
}

function step(prev: GameState, change: (s: GameState) => void): GameState {
  const next = structuredClone(prev);
  next.version = prev.version + 1;
  next.transfers = [];
  change(next);
  return next;
}

describe('Sprecher in den Erweiterungen', () => {
  it('Seewege: neue Insel, Schiffe (Versetzen zählt nicht), Gold', () => {
    const prev = game({ map: 'erste-ueberfahrt' });
    const island = step(prev, (s) => (s.islandBonus![1] += 2));
    expect(voiceEvents(prev, island, 1)).toEqual(['islandAny', 'myIsland']);
    expect(voiceEvents(prev, island, 0)).toEqual(['islandAny', 'enemyIsland']);

    const sea = prev.ships!.findIndex((x) => x === null);
    const built = step(prev, (s) => (s.ships![sea] = 1));
    expect(voiceEvents(prev, built, 1)).toEqual(['myShip']);
    expect(voiceEvents(prev, built, 0)).toEqual(['enemyShip']);
    const placed = { ...prev, ships: prev.ships!.map((x, e) => (e === sea ? 1 : x)) };
    const moved = step(placed, (s) => {
      s.ships![sea] = null;
      s.ships![sea + 1] = 1;
    });
    expect(voiceEvents(placed, moved, 0)).toEqual([]);

    const gold = step(prev, (s) => (s.phase = { kind: 'gold', pending: [0, 2, 0] }));
    expect(voiceEvents(prev, gold, 1)).toEqual(['myGold']);
    expect(voiceEvents(prev, gold, 0)).toEqual(['enemyGold']);
  });

  it('Seewege: Kaperschiff; an meiner Küste spricht der Erzfeind statt des Herolds', () => {
    const prev = game({ map: 'erste-ueberfahrt' });
    const topo = getTopology(prev.board);
    const seaHexes = topo.hexes.filter((h) => h.sea && h.id !== prev.pirate);
    const far = step(prev, (s) => (s.pirate = seaHexes[0].id));
    expect(voiceEvents(prev, far, 0)).toEqual(['pirateMoved']);
    const coast = seaHexes.find((h) => h.corners.some((v) => topo.vertices[v].hexes.some((id) => !topo.hexes[id].sea)))!;
    const mine = { ...prev, buildings: prev.buildings.map((b, v) => (coast.corners[0] === v ? { owner: 0, type: 'settlement' as const } : b)) };
    expect(voiceEvents(mine, step(mine, (s) => (s.pirate = coast.id)), 0)).toEqual(['enemyPirateNearMe']);
  });

  it('Im Dunst: Nebel wird aufgedeckt', () => {
    const prev = game({ map: 'im-dunst' });
    const fog = prev.board.hexes.findIndex((h) => h.terrain === 'fog');
    expect(fog).toBeGreaterThanOrEqual(0);
    const lifted = step(prev, (s) => (s.board.hexes = s.board.hexes.map((h, i) => (i === fog ? { terrain: 'wood', number: 6 } : h))));
    expect(voiceEvents(prev, lifted, 0)).toEqual(['fogLifted']);
  });

  it('Stadtwacht: Flotte vor dem Angriff, Angriff abgewehrt mit Ehrenschild, Stadt verloren', () => {
    const prev = game({ variants: ['stadtwacht'] });
    const close = { ...prev, raiders: { position: RAIDER_TRACK - 2, attacked: false } };
    expect(voiceEvents(close, step(close, (s) => (s.raiders = { position: RAIDER_TRACK - 1, attacked: false })), 0)).toEqual(['raidersNear']);

    const before = { ...prev, raiders: { position: RAIDER_TRACK - 1, attacked: false } };
    const held = step(before, (s) => {
      s.raiders = { position: 0, attacked: true };
      s.honors![0]++;
    });
    expect(voiceEvents(before, held, 0)).toEqual(['raidersAttack', 'raidersRepelled', 'myGuardsHeld']);
    expect(voiceEvents(before, held, 1)).toEqual(['raidersAttack', 'raidersRepelled']);

    const lost = step(before, (s) => {
      s.raiders = { position: 0, attacked: true };
      s.phase = { kind: 'raid', pending: [1, 0, 0], sum: 8 };
    });
    expect(voiceEvents(before, lost, 0)).toEqual(['raidersAttack', 'myCityRaided', 'raidGloat']);
    expect(voiceEvents(before, lost, 1)).toEqual(['raidersAttack']);
  });

  it('Stadtwacht: Ausbau und Prachtstadt (dann ohne „Eure Stadt gedeiht“)', () => {
    const prev = game({ variants: ['stadtwacht'] });
    const up = step(prev, (s) => (s.improvements![0].market = 1));
    expect(voiceEvents(prev, up, 0)).toEqual(['myImprovement']);
    const metro = step(prev, (s) => {
      s.improvements![0].market = 4;
      s.metropolis!.market = 0;
    });
    expect(voiceEvents(prev, metro, 0)).toEqual(['metropolisAny', 'myMetropolis']);
    expect(voiceEvents(prev, metro, 1)).toEqual(['metropolisAny', 'enemyMetropolis']);
  });

  it('Fischgründe: Fang, Anker gezogen oder vom Gegner bekommen', () => {
    const prev = game({ variants: ['fischgruende'] });
    expect(voiceEvents(prev, step(prev, (s) => s.fish![0].push(2)), 0)).toEqual(['myFish']);
    expect(voiceEvents(prev, step(prev, (s) => (s.anchor = 0)), 0)).toEqual(['myAnchor']);
    const theirs = { ...prev, anchor: 1 };
    expect(voiceEvents(theirs, step(theirs, (s) => (s.anchor = 0)), 0)).toEqual(['anchorFromEnemy']);
  });

  it('Flussläufe: Brücke statt Straßen-Spott, allein die meisten Münzen', () => {
    const prev = game({ variants: ['flusslaeufe'] });
    const river = prev.board.rivers![0].edges[0];
    expect(voiceEvents(prev, step(prev, (s) => (s.roads[river] = 1)), 0)).toEqual(['bridgeBuilt']);
    expect(voiceEvents(prev, step(prev, (s) => (s.coins = [3, 1, 1])), 0)).toEqual(['myCoinLead']);
  });

  it('Hafenvogt: für mich der Berater, für Gegner der Erzfeind', () => {
    const prev = game({ variants: ['hafenvogt'] });
    const taken = step(prev, (s) => (s.harborMaster = 1));
    expect(voiceEvents(prev, taken, 1)).toEqual(['myHarborMaster']);
    expect(voiceEvents(prev, taken, 0)).toEqual(['enemyHarborMaster']);
  });

  it('Duell: Der Gegner setzt eine neutrale Straße an meine', () => {
    const prev = game({ variants: ['duell'], players: 2 });
    const topo = getTopology(prev.board);
    const mine = topo.edges[10];
    const next = topo.edges.find((e) => e.id !== mine.id && (e.a === mine.b || e.b === mine.b))!;
    const start = { ...prev, roads: prev.roads.map((r, e) => (e === mine.id ? 0 : r)) };
    expect(voiceEvents(start, step(start, (s) => (s.roads[next.id] = 2)), 0)).toEqual(['neutralBlocks']);
  });

  it('Entwicklungskarten und angenommenes Angebot', () => {
    const mine = { ...game(), current: 0 };
    expect(voiceEvents(mine, step(mine, (s) => (s.playedDev = ['roadBuilding'])), 0)).toEqual(['myRoadBuilding']);
    expect(voiceEvents(mine, step(mine, (s) => (s.playedDev = ['yearOfPlenty'])), 0)).toEqual(['myInvention']);
    const none = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const offered = { ...mine, offers: [{ id: 3, from: 0, give: none, want: none, counter: false, accepted: [], declined: [] }] };
    expect(voiceEvents(offered, step(offered, (s) => s.offers[0].accepted.push(2)), 0)).toEqual(['tradeAccepted']);
  });
});
