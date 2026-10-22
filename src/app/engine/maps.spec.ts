import { describe, expect, it } from 'vitest';
import { botStep, seeded } from '../net/testing/fake-net';
import { MAPS } from './maps';
import { applyAction, createGame } from './rules';

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }));
}

describe('Karten im Spiel', () => {
  it('lehnt Karten ab, die nicht zur Spielerzahl passen', () => {
    expect(() => createGame(players(3), { victoryPoints: 10, map: 'weltkarte' }, 1)).toThrow(/5–6 Spieler/);
    expect(() => createGame(players(6), { victoryPoints: 10, map: 'langes-tal' }, 1)).toThrow(/3–4 Spieler/);
  });

  it('nimmt ohne Angabe das klassische Brett', () => {
    expect(createGame(players(4), { victoryPoints: 10 }, 1).board.map).toBe('klassisch');
  });

  for (const map of MAPS) {
    it(`${map.name}: 3000 Züge mit ${map.players[1]} Spielern ohne Regelfehler`, { timeout: 120000 }, () => {
      const random = seeded(map.id.length * 97);
      let s = createGame(players(map.players[1]), { victoryPoints: map.victoryPoints, map: map.id }, 7);
      const fog = (g: typeof s) => g.board.hexes.filter((h) => h.terrain === 'fog').length;
      const fogAtStart = fog(s);
      for (let step = 0; step < 3000 && s.phase.kind !== 'ended'; step++) {
        const next = botStep(s, random);
        expect(next).not.toBeNull();
        s = applyAction(s, next!.seat, next!.action);
      }
      expect(s.turn).toBeGreaterThan(40);
      expect(s.roads.filter((r) => r !== null).length).toBeGreaterThan(map.players[1] * 2);
      if (map.seafaring) expect(s.ships!.filter((r) => r !== null).length).toBeGreaterThan(0);
      // Im Nebel wird entdeckt: Ein Teil der verdeckten Felder ist am Ende aufgedeckt.
      if (map.seafaring?.fog) expect(fog(s)).toBeLessThan(fogAtStart);
    });
  }
});
