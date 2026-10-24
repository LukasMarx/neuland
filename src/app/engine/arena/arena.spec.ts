import { describe, expect, it } from 'vitest';
import { botAction, botAnswer, BotLevel } from '../bot';
import { botActionV1, botTradeResponseV1 } from './bot-v1';
import { Contender, formatTournament, playMatch, tournament } from './arena';

const v1 = (name = 'Bot v1'): Contender => ({
  name,
  act: botActionV1,
  answer: (s, seat, offer) => {
    const accept = botTradeResponseV1(s, seat, offer);
    return accept === null ? null : { type: 'respondTrade', offerId: offer.id, accept };
  },
});

const level = (l: BotLevel, name = `Bot ${l}`): Contender => ({
  name,
  act: (s, seat, offersMade) => botAction(s, seat, { level: l, offersMade }),
  answer: (s, seat, offer) => botAnswer(s, seat, offer, { level: l }),
});

/** Großes Turnier nur auf Wunsch: `ARENA=200 npx vitest run src/app/engine/arena --reporter=verbose` (Zahl = Bretter je Turnier). */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const boards = Number(env['ARENA'] ?? 0);

describe('Messbank', () => {
  it('spielt eine Partie bis zum Sieg und merkt sich, wer wo saß', () => {
    const m = playMatch([v1('A'), v1('B'), v1('A2'), v1('B2')], 7, { victoryPoints: 10 });
    expect(m.winner).not.toBeNull();
    expect(new Set(m.seats)).toEqual(new Set(['A', 'B', 'A2', 'B2']));
    expect(m.points[m.winner!]).toBeGreaterThanOrEqual(10);
    expect(m.stuck).toBe(false);
  });

  it('dreht die Aufstellung, sodass jeder Bot gleich oft sitzt', () => {
    const r = tournament([v1('A'), v1('B')], { players: 4, boards: 3 });
    expect(r.games).toBe(6);
    expect(r.standings.map((s) => s.seats)).toEqual([12, 12]);
    expect(r.standings.reduce((n, s) => n + s.wins, 0) + r.unfinished).toBe(6);
  });

  it('Bots aller Stufen handeln untereinander und spielen ohne Notzüge zu Ende', { timeout: 60000 }, () => {
    const r = tournament([level('easy'), level('normal'), level('hard')], {
      players: 3,
      boards: 4,
    });
    expect(r.unfinished).toBe(0);
    expect(r.avgTrades).toBeGreaterThan(0);
    for (const s of r.standings) expect(s.fallbacks).toBe(0);
  });
});

describe.runIf(boards > 0)('Messbank, großes Turnier', () => {
  it('Bot v1 gegen sich selbst (Kontrolle: beide um 1,0)', { timeout: 0 }, () => {
    const r = tournament([v1('v1 A'), v1('v1 B')], { players: 4, boards });
    console.log(formatTournament(r, '4 Spieler, v1 gegen v1'));
  });

  for (const players of [3, 4, 6]) {
    it(`Stufen gegeneinander, ${players} Spieler`, { timeout: 0 }, () => {
      const r = tournament([level('easy'), level('normal'), level('hard')], { players, boards });
      console.log(formatTournament(r, `${players} Spieler, leicht, mittel und schwer`));
    });
  }

  for (const l of ['easy', 'normal', 'hard'] as const) {
    it(`Stufe ${l} gegen v1, 4 Spieler abwechselnd`, { timeout: 0 }, () => {
      const r = tournament([level(l), v1()], { players: 4, boards });
      console.log(formatTournament(r, `4 Spieler, ${l} gegen v1`));
    });
  }
});
