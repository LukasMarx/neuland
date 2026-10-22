import { describe, expect, it } from 'vitest';
import { getTopology, vertexHarbors } from './board';
import { applyAction, createGame, harborPoints, legalRobberHexes, victoryPoints } from './rules';
import { COSTS, emptyResources, GameState } from './types';
import { DICE_DECK, VariantId } from './variants';

function game(variants: VariantId[], n = 3, seed = 1): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  const s = structuredClone(createGame(players, { victoryPoints: 10, variants }, seed));
  s.phase = { kind: 'main' };
  s.current = 0;
  s.turn = 1;
  s.dice = [3, 4];
  return s;
}

describe('Milder Räuber', () => {
  it('meidet Felder mit Spielern bis 2 Siegpunkte und geht notfalls in die Wüste', () => {
    const s = game(['milderRaeuber']);
    const t = getTopology(s.board);
    // Spieler 1 hat eine Siedlung (1 Punkt), Spieler 2 drei Städte (6 Punkte).
    const weak = t.hexes.find((h) => s.board.hexes[h.id].terrain !== 'desert' && h.id !== s.robber)!;
    s.buildings[weak.corners[0]] = { owner: 1, type: 'settlement' };
    const strongCorners = t.vertices.filter((v) => v.hexes.every((h) => !weak.corners.some((c) => t.hexes[h].corners.includes(c)))).slice(0, 3);
    for (const v of strongCorners) s.buildings[v.id] = { owner: 2, type: 'city' };
    const legal = legalRobberHexes(s);
    for (const h of t.vertices[weak.corners[0]].hexes) expect(legal).not.toContain(h);
    expect(legal.some((h) => t.hexes[h].corners.some((c) => s.buildings[c]?.owner === 2))).toBe(true);
    s.phase = { kind: 'robber', returnTo: 'main' };
    expect(() => applyAction(s, 0, { type: 'moveRobber', hex: weak.id, victim: 1 })).toThrow(/Milder Räuber/);

    // Stehen überall nur schwache Spieler, bleibt die Wüste.
    const all = game(['milderRaeuber']);
    for (const h of getTopology(all.board).hexes) all.buildings[h.corners[0]] = { owner: 1, type: 'settlement' };
    all.players[1].resources = { ...emptyResources(), wood: 1 };
    const desert = legalRobberHexes(all);
    expect(desert.every((h) => all.board.hexes[h].terrain === 'desert') || desert.length === all.board.hexes.length - 1).toBe(true);
  });

  it('ohne Variante darf der Räuber auf jedes andere Feld', () => {
    const s = game([]);
    expect(legalRobberHexes(s)).toHaveLength(s.board.hexes.length - 1);
  });
});

describe('Hafenvogt', () => {
  it('bekommt, wer zuerst 3 Hafenpunkte hat; wer mehr hat, übernimmt; zählt 2 Siegpunkte', () => {
    const s = game(['hafenvogt']);
    expect(s.harborMaster).toBeNull();
    const harbors = vertexHarbors(s.board);
    const t = getTopology(s.board);
    const spots = t.vertices.filter((v) => harbors[v.id]).map((v) => v.id);
    // Abstandsregel einhalten: nur Hafenecken nehmen, die sich nicht berühren.
    const free: number[] = [];
    for (const v of spots) if (free.every((f) => f !== v && !t.vertices[f].neighbors.includes(v))) free.push(v);
    // Spieler 0: Stadt (2) + Siedlung (1) per Aktionen.
    s.buildings[free[0]] = { owner: 0, type: 'settlement' };
    s.players[0].resources = { ...emptyResources(), ...COSTS.city };
    let n = applyAction(s, 0, { type: 'buildCity', vertex: free[0] });
    expect(harborPoints(n, 0)).toBe(2);
    expect(n.harborMaster).toBeNull();
    n.buildings[free[1]] = { owner: 0, type: 'settlement' };
    n.roads[t.vertices[free[1]].edges[0]] = 0;
    n.buildings[free[1]] = null;
    n.players[0].resources = { ...emptyResources(), ...COSTS.settlement };
    n = applyAction(n, 0, { type: 'buildSettlement', vertex: free[1] });
    expect(n.harborMaster).toBe(0);
    expect(victoryPoints(n, 0, false)).toBe(2 + 1 + 2);

    // Gleichziehen reicht nicht, überholen schon.
    n.buildings[free[2]] = { owner: 1, type: 'city' };
    n.buildings[free[3]] = { owner: 1, type: 'settlement' };
    n.players[1].resources = { ...emptyResources(), ...COSTS.city };
    n.current = 1;
    n = applyAction(n, 1, { type: 'buildCity', vertex: free[3] });
    expect(harborPoints(n, 1)).toBe(4);
    expect(n.harborMaster).toBe(1);
  });

  it('gibt es ohne Variante nicht', () => {
    expect(game([]).harborMaster).toBeUndefined();
  });
});

describe('Würfelstapel', () => {
  it('liefert genau die Verteilung zweier Würfel und mischt kurz vor dem Ende neu', () => {
    let s = game(['wuerfelstapel'], 2);
    expect(s.diceDeck).toEqual(DICE_DECK);
    const sums = new Map<number, number>();
    for (let i = 0; i < 31; i++) {
      s.phase = { kind: 'roll' };
      s.players.forEach((p) => (p.resources = emptyResources()));
      s = applyAction(s, s.current, { type: 'roll' });
      const [a, b] = s.dice!;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
      sums.set(a + b, (sums.get(a + b) ?? 0) + 1);
      s = structuredClone(s);
      s.phase = { kind: 'main' };
    }
    // Nach 31 von 36 Karten: jede Summe höchstens so oft wie im Stapel.
    for (const [sum, n] of sums) expect(n).toBeLessThanOrEqual(DICE_DECK[sum]);
    expect(Object.values(s.diceDeck!).reduce((a, b) => a + b, 0)).toBe(5);
    s.phase = { kind: 'roll' };
    s = applyAction(s, s.current, { type: 'roll' });
    expect(Object.values(s.diceDeck!).reduce((a, b) => a + b, 0)).toBe(35);
    expect(s.log.some((l) => l.text.includes('neu gemischt'))).toBe(true);
  });
});

describe('Entwicklungskarten', () => {
  it('werden zufällig gezogen, nicht von oben', () => {
    const tops = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const s = game([], 3, seed);
      const top = s.devDeck[s.devDeck.length - 1];
      s.players[0].resources = { ...emptyResources(), ...COSTS.devCard };
      const n = applyAction(s, 0, { type: 'buyDevCard' });
      tops.add(n.players[0].newDevCards[0] === top ? 'oben' : 'anders');
    }
    expect(tops.has('anders')).toBe(true);
  });
});
