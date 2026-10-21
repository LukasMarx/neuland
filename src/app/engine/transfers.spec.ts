import { describe, expect, it } from 'vitest';
import { BANK_SIZE, getTopology } from './board';
import { randomInt } from './rng';
import { applyAction, createGame } from './rules';
import { emptyResources, GameState, RESOURCES, ResourceCounts, Transfer } from './types';

function game(): GameState {
  const players = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = createGame(players, { victoryPoints: 10 }, 7);
  s.phase = { kind: 'main' };
  s.current = 0;
  s.turn = 1;
  s.dice = [3, 4];
  return s;
}

function give(s: GameState, seat: number, r: Partial<ResourceCounts>): void {
  s.players[seat].resources = { ...emptyResources(), ...r };
  for (const k of RESOURCES) {
    s.bank[k] = BANK_SIZE[s.board.layout] - s.players.reduce((sum, p) => sum + p.resources[k], 0);
  }
}

function setDice(s: GameState, sum: number): void {
  for (let seed = 1; ; seed++) {
    const r = { rng: seed };
    if (randomInt(r, 6) + randomInt(r, 6) + 2 === sum) {
      s.rng = seed;
      return;
    }
  }
}

/** Ein Feld mit Zahl, das nicht unter dem Räuber liegt. */
function producingHex(s: GameState): number {
  return s.board.hexes.findIndex((h, i) => h.number !== null && h.number !== 7 && i !== s.robber);
}

describe('Kartenbewegungen', () => {
  it('Ertrag fliegt vom liefernden Feld zum Spieler, Städte zählen doppelt', () => {
    const s = game();
    const hex = producingHex(s);
    const corners = getTopology(s.board.layout).hexes[hex].corners;
    s.buildings[corners[0]] = { owner: 1, type: 'settlement' };
    s.buildings[corners[3]] = { owner: 2, type: 'city' };
    s.phase = { kind: 'roll' };
    setDice(s, s.board.hexes[hex].number!);
    const next = applyAction(s, 0, { type: 'roll' });
    const terrain = s.board.hexes[hex].terrain;
    expect(next.transfers).toContainEqual({ from: { kind: 'hex', id: hex }, to: { kind: 'player', seat: 1 }, card: terrain, count: 1 });
    expect(next.transfers).toContainEqual({ from: { kind: 'hex', id: hex }, to: { kind: 'player', seat: 2 }, card: terrain, count: 2 });
  });

  it('Ertrag und Bewegungen stimmen mit den Handkarten überein', () => {
    const s = game();
    const topo = getTopology(s.board.layout);
    // Viele Gebäude verteilen, dann alle Zahlen würfeln
    topo.vertices.forEach((v, i) => {
      if (i % 5 === 0) s.buildings[v.id] = { owner: i % 3, type: i % 2 ? 'city' : 'settlement' };
    });
    for (let sum = 2; sum <= 12; sum++) {
      if (sum === 7) continue;
      const before = structuredClone(s);
      before.phase = { kind: 'roll' };
      setDice(before, sum);
      const after = applyAction(before, 0, { type: 'roll' });
      before.players.forEach((p, seat) => {
        for (const r of RESOURCES) {
          const moved = after.transfers
            .filter((t) => t.card === r && t.to.kind === 'player' && t.to.seat === seat)
            .reduce((n, t) => n + t.count, 0);
          expect(after.players[seat].resources[r] - p.resources[r]).toBe(moved);
        }
      });
    }
  });

  it('beim Räuber-Feld gibt es keine Bewegung', () => {
    const s = game();
    const hex = producingHex(s);
    s.buildings[getTopology(s.board.layout).hexes[hex].corners[0]] = { owner: 1, type: 'settlement' };
    s.robber = hex;
    s.phase = { kind: 'roll' };
    setDice(s, s.board.hexes[hex].number!);
    const next = applyAction(s, 0, { type: 'roll' });
    expect(next.transfers.some((t) => t.from.kind === 'hex' && t.from.id === hex)).toBe(false);
  });

  it('Baukosten fliegen zum Bauplatz', () => {
    const s = game();
    const edge = getTopology(s.board.layout).vertices[0].edges[0];
    s.buildings[0] = { owner: 0, type: 'settlement' };
    give(s, 0, { wood: 1, brick: 1 });
    const next = applyAction(s, 0, { type: 'buildRoad', edge });
    expect(next.transfers).toEqual<Transfer[]>([
      { from: { kind: 'player', seat: 0 }, to: { kind: 'edge', id: edge }, card: 'wood', count: 1 },
      { from: { kind: 'player', seat: 0 }, to: { kind: 'edge', id: edge }, card: 'brick', count: 1 },
    ]);
  });

  it('Entwicklungskarte: Kosten an die Bank, Karte von der Bank', () => {
    const s = game();
    give(s, 0, { sheep: 1, wheat: 1, ore: 1 });
    const next = applyAction(s, 0, { type: 'buyDevCard' });
    expect(next.transfers.filter((t) => t.to.kind === 'bank').map((t) => t.card)).toEqual(['sheep', 'wheat', 'ore']);
    expect(next.transfers).toContainEqual({ from: { kind: 'bank' }, to: { kind: 'player', seat: 0 }, card: 'dev', count: 1 });
  });

  it('Bank-Handel bewegt Karten in beide Richtungen', () => {
    const s = game();
    give(s, 0, { wood: 4 });
    const next = applyAction(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expect(next.transfers).toEqual<Transfer[]>([
      { from: { kind: 'player', seat: 0 }, to: { kind: 'bank' }, card: 'wood', count: 4 },
      { from: { kind: 'bank' }, to: { kind: 'player', seat: 0 }, card: 'ore', count: 1 },
    ]);
  });

  it('Handel zwischen Spielern bewegt beide Seiten', () => {
    let s = game();
    give(s, 0, { wood: 2 });
    give(s, 1, { ore: 1, wood: 0 });
    s.players[0].resources.wood = 2;
    s = applyAction(s, 0, { type: 'offerTrade', give: { ...emptyResources(), wood: 2 }, want: { ...emptyResources(), ore: 1 } });
    const id = s.offers[0].id;
    s = applyAction(s, 1, { type: 'respondTrade', offerId: id, accept: true });
    expect(s.transfers).toEqual([]);
    s = applyAction(s, 0, { type: 'confirmTrade', offerId: id, partner: 1 });
    expect(s.transfers).toEqual<Transfer[]>([
      { from: { kind: 'player', seat: 0 }, to: { kind: 'player', seat: 1 }, card: 'wood', count: 2 },
      { from: { kind: 'player', seat: 1 }, to: { kind: 'player', seat: 0 }, card: 'ore', count: 1 },
    ]);
  });

  it('der Räuber-Diebstahl ist verdeckt', () => {
    const s = game();
    const hex = producingHex(s);
    s.buildings[getTopology(s.board.layout).hexes[hex].corners[0]] = { owner: 1, type: 'settlement' };
    give(s, 1, { sheep: 1 });
    s.phase = { kind: 'robber', returnTo: 'main' };
    const next = applyAction(s, 0, { type: 'moveRobber', hex, victim: 1 });
    expect(next.transfers).toEqual<Transfer[]>([
      { from: { kind: 'player', seat: 1 }, to: { kind: 'player', seat: 0 }, card: 'sheep', count: 1, hidden: true },
    ]);
  });

  it('Monopol holt die Karten von jedem Mitspieler einzeln', () => {
    const s = game();
    give(s, 1, { wheat: 2 });
    give(s, 2, { wheat: 3 });
    s.players[0].devCards = ['monopoly'];
    const next = applyAction(s, 0, { type: 'playMonopoly', resource: 'wheat' });
    expect(next.transfers).toEqual<Transfer[]>([
      { from: { kind: 'player', seat: 1 }, to: { kind: 'player', seat: 0 }, card: 'wheat', count: 2 },
      { from: { kind: 'player', seat: 2 }, to: { kind: 'player', seat: 0 }, card: 'wheat', count: 3 },
    ]);
  });

  it('jede Aktion beginnt mit leeren Bewegungen', () => {
    const s = game();
    give(s, 0, { wood: 4 });
    const traded = applyAction(s, 0, { type: 'bankTrade', give: 'wood', get: 'ore' });
    expect(traded.transfers.length).toBe(2);
    const ended = applyAction(traded, 0, { type: 'endTurn' });
    expect(ended.transfers).toEqual([]);
  });
});
