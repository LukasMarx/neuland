import { describe, expect, it } from 'vitest';
import { actingSeats, ResourceCounts } from '../engine';
import { AWAY_MS } from './room.service';
import { bySeat, Clock, hostOf, Net, play, resetNet, seeded, setup, Sim } from './testing/fake-net';

const board = (s: Sim) => s.game.board.hexes.map((h) => h.terrain).join();
const versions = (sims: Sim[]) => new Set(sims.map((s) => s.v));
const hosts = (sims: Sim[]) => sims.filter((s) => s.host);

function start(names: string[]) {
  const ctx = setup(names);
  ctx.sims[0].svc.startGame();
  ctx.clock.advance(500);
  return ctx;
}

/** Spielt, bis jemand in der Hauptphase ist (nach der Aufbauphase). */
function playUntilMain(sims: Sim[], random: () => number): void {
  for (let i = 0; i < 400; i++) {
    const g = hostOf(sims)!.game;
    if (g.phase.kind === 'main' && g.turn > 2) return;
    play(sims, 1, random);
  }
  throw new Error('Hauptphase nicht erreicht');
}

function one(r: keyof ResourceCounts): ResourceCounts {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, [r]: 1 };
}

describe('Mehrspieler: Grundablauf', () => {
  it('hält alle auf demselben Stand, auch nach sauberem Host-Wechsel und Wiedereinstieg', () => {
    const { sims, code, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    play(sims, 40, seeded(1));
    expect(versions(sims).size).toBe(1);
    H.close();
    clock.advance(2000);
    expect(hosts([A, B])).toHaveLength(1);
    const H2 = H.reopen();
    H2.svc.join(code, 'H');
    clock.advance(2000);
    expect(H2.seat).toBeGreaterThanOrEqual(0);
    expect(H2.v).toBe(A.v);
    play([A, B, H2], 40, seeded(2));
    expect(versions([A, B, H2]).size).toBe(1);
  });

  it('startet nur mit verbundenen Spielern', () => {
    const { sims, clock } = setup(['H', 'A', 'B']);
    const [H, , B] = sims;
    B.close();
    clock.advance(500);
    H.svc.startGame();
    clock.advance(500);
    expect(H.game.players.map((p) => p.name)).not.toContain('B');
    expect(H.svc.notice()?.text).toMatch(/Ohne B/);
  });
});

describe('Mehrspieler: alte Stände', () => {
  it('ein Laptop aus dem Ruhezustand bringt kein altes Spiel zurück', () => {
    const { sims, net, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    play(sims, 30, seeded(3));
    net.isolate(B);
    clock.advance(20000);
    expect(B.host).toBe(false); // ohne Mehrheit wird B nicht Host
    H.svc.backToLobby();
    clock.advance(500);
    H.svc.removePlayer(B.svc.clientId);
    clock.advance(500);
    H.svc.startGame();
    clock.advance(500);
    play([H, A], 6, seeded(4));
    const g2 = board(H);
    net.heal(B);
    clock.advance(5000);
    expect([board(H), board(A), board(B)]).toEqual([g2, g2, g2]);
    expect(hosts(sims)).toEqual([H]);
    expect(B.seat).toBe(-1);
  });

  it('Auto-Fortsetzen nach langer Verbindungssuche überschreibt die neue Runde nicht', () => {
    const { sims, net, code, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    play(sims, 30, seeded(5));
    B.close();
    clock.advance(1000);
    H.svc.backToLobby();
    H.svc.removePlayer(B.svc.clientId);
    H.svc.startGame();
    clock.advance(500);
    play([H, A], 6, seeded(6));
    const g2 = board(H);
    const B2 = B.reopen();
    net.joinDelay = 14000;
    B2.svc.join(code, 'B');
    net.joinDelay = 300;
    clock.advance(20000);
    expect([board(H), board(B2)]).toEqual([g2, g2]);
    expect(H.game.players).toHaveLength(2);
  });

  it('ein neuerer Speicherstand gewinnt, auch wenn ein älterer zuerst wieder da ist', () => {
    const { sims, code, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    const random = seeded(9);
    play(sims, 25, random);
    while (H.game.players[actingSeats(H.game)[0]].id === B.svc.clientId) play(sims, 1, random);
    const older = B.v!;
    B.close();
    clock.advance(500);
    play([H, A], 10, random);
    const newest = A.v!;
    expect(newest).toBeGreaterThan(older);
    H.close();
    A.close();
    clock.advance(500);
    const B2 = B.reopen();
    B2.svc.join(code, 'B');
    clock.advance(13000);
    const A2 = A.reopen();
    A2.svc.join(code, 'A');
    clock.advance(3000);
    expect([B2.v, A2.v]).toEqual([newest, newest]);
    expect(JSON.parse(A2.storage.getItem(`neuland:save:${code}`)!).game.version).toBe(newest);
  });
});

describe('Mehrspieler: Netzstörungen', () => {
  it('ein verspäteter älterer Stand wird ignoriert, ein verlorener per Lebenszeichen nachgeholt', () => {
    const { sims, net, clock } = start(['H', 'A', 'B']);
    const [H] = sims;
    const random = seeded(11);
    let next: Sim;
    for (;;) {
      playUntilMain(sims, random);
      const g = H.game;
      next = bySeat(sims, g, (g.current + 1) % g.players.length)!;
      if (next !== H && bySeat(sims, g, g.current) !== H) break;
      play(sims, 1, random);
    }
    const cur = bySeat(sims, H.game, H.game.current)!;
    const have = (Object.keys(cur.game.players[cur.seat].resources) as (keyof ResourceCounts)[]).find(
      (r) => cur.game.players[cur.seat].resources[r] > 0,
    )!;
    cur.svc.act({ type: 'offerTrade', give: one(have), want: one(have === 'ore' ? 'wood' : 'ore') });
    clock.advance(300);
    const N = H.v! + 1;
    net.tamper = (_f, to, msg) => (msg.t === 'room' && msg.game?.version === N && to === next.name ? 150 : 0);
    cur.svc.act({ type: 'withdrawOffers' });
    cur.svc.act({ type: 'endTurn' });
    clock.advance(1000);
    net.tamper = null;
    expect(next.v).toBe(H.v);
    expect(next.game.current).toBe(next.seat);

    const M = H.v! + 1;
    net.tamper = (_f, to, msg) => (msg.t === 'room' && msg.game?.version === M && to === next.name ? -1 : 0);
    next.svc.act({ type: 'roll' });
    clock.advance(500);
    net.tamper = null;
    clock.advance(4000);
    expect(next.v).toBe(H.v);
  });

  it('eine abgetrennte Minderheit wird nicht Host und kann die Mehrheit nicht überschreiben', () => {
    const { sims, net, clock } = start(['H', 'A', 'B']);
    const random = seeded(13);
    playUntilMain(sims, random);
    const g = sims[0].game;
    const outsider = sims.find((s) => !s.host && s.seat !== g.current)!;
    net.isolate(outsider);
    clock.advance(25000);
    expect(outsider.host).toBe(false);
    expect(outsider.svc.status()).toBe('reconnecting');
    outsider.svc.act({ type: 'withdrawOffers' });
    const majority = sims.filter((s) => s !== outsider);
    play(majority, 10, random);
    const majorityBoard = hostOf(majority)!.game;
    net.heal(outsider);
    clock.advance(5000);
    expect(versions(sims).size).toBe(1);
    expect(outsider.game.version).toBe(majorityBoard.version);
    expect(outsider.svc.status()).toBe('connected');
  });

  it('bei einseitigem Abbruch gibt es höchstens einen Host, und das Spiel läuft weiter', () => {
    const { sims, net, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    play(sims, 12, seeded(15));
    net.cut(H, B);
    clock.advance(30000);
    expect(hosts(sims)).toHaveLength(1);
    const host = hosts(sims)[0];
    const followers = [H, A, B].filter((s) => s !== host && s.svc.status() === 'connected');
    expect(followers.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 10; i++) {
      clock.advance(3000);
      expect(hosts(sims)).toHaveLength(1);
    }
  });

  it('ein Zug während eines harten Host-Ausfalls wird nachgeschickt und genau einmal angewendet', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { sims, net, clock } = start(['H', 'A', 'B']);
      const [H] = sims;
      const random = seeded(seed);
      for (let i = 0; i < 300 && !(H.game.phase.kind === 'roll' && H.game.turn > 1); i++) play(sims, 1, random);
      const X = bySeat(sims, H.game, H.game.current)!;
      const candidate = H.game.players.map((_, seat) => bySeat(sims, H.game, seat)!).filter((s) => s !== H)[0];
      if (X === H || X === candidate) {
        sims.forEach((s) => s.close());
        continue;
      }
      // X würfelt, der Broadcast erreicht den Nachfolger nicht mehr, dann fällt H hart aus.
      const N = H.v! + 1;
      net.tamper = (_f, to, msg) => (msg.t === 'room' && msg.game?.version === N && to === candidate.name ? -1 : 0);
      X.svc.act({ type: 'roll' });
      clock.advance(100);
      net.tamper = null;
      net.cut(H, candidate, 15000, 3000);
      net.cut(H, X, 15000, 15000);
      clock.advance(6000);
      // X spielt weiter, obwohl der Host weg ist.
      const g = X.game;
      const before = g.version;
      const action = g.phase.kind === 'main' ? ({ type: 'endTurn' } as const) : null;
      if (!action) {
        sims.forEach((s) => s.close());
        continue;
      }
      X.svc.act(action);
      clock.advance(30000);
      const rest = [candidate, X];
      expect(versions(rest).size).toBe(1);
      expect(X.v).toBe(before + 1);
      expect(X.game.current).not.toBe(g.current);
      expect(X.svc.pending()).toBe(0);
      return;
    }
    throw new Error('kein passender Spielverlauf');
  });

  it('doppelt zugestellte Aktionen werden nur einmal angewendet', () => {
    const { sims, net, clock } = start(['H', 'A']);
    const random = seeded(17);
    net.duplicate = (msg) => msg.t === 'action';
    play(sims, 60, random);
    net.duplicate = null;
    clock.advance(1000);
    expect(versions(sims).size).toBe(1);
    // Jede Aktion erzeugt höchstens eine Version: keine doppelten Würfe oder Käufe.
    const log = hostOf(sims)!.game.log.map((l) => l.text);
    for (let i = 1; i < log.length; i++) {
      if (log[i].includes('würfelt')) expect(log[i - 1]).not.toBe(log[i]);
    }
  });
});

describe('Mehrspieler: Hintergrund-Tabs', () => {
  it('Mitspieler im Hintergrund halten das Spiel nicht an', () => {
    const { sims, clock } = start(['H', 'A', 'B']);
    const [H, A, B] = sims;
    A.throttled = true;
    B.throttled = true;
    clock.advance(5 * 60000);
    expect(H.svc.status()).toBe('connected');
    play(sims, 40, seeded(31));
    expect(versions(sims).size).toBe(1);
    expect(hosts(sims)).toEqual([H]);
  });

  it('ein Host im Hintergrund bleibt Host, die anderen spielen weiter', () => {
    const { sims, clock } = start(['H', 'A', 'B']);
    const [H] = sims;
    H.throttled = true;
    clock.advance(5 * 60000);
    expect(hosts(sims)).toEqual([H]);
    play(sims, 40, seeded(37));
    expect(versions(sims).size).toBe(1);
    expect(sims.every((s) => s.svc.status() === 'connected')).toBe(true);
  });
});

describe('Mehrspieler: Spieler, die wegbleiben', () => {
  it('nach einer Wartezeit können Mitspieler für einen getrennten Spieler weiterspielen', () => {
    const { sims, clock } = start(['H', 'A', 'B']);
    const [H, A] = sims;
    const random = seeded(19);
    // Warten, bis B dran ist, dann verschwindet B.
    for (let i = 0; i < 200; i++) {
      const g = H.game;
      if (g.players[actingSeats(g)[0]].name === 'B') break;
      play(sims, 1, random);
    }
    const B = sims[2];
    const seatB = B.seat;
    B.close();
    clock.advance(1000);
    A.svc.standIn(seatB);
    clock.advance(500);
    expect(A.svc.notice()?.text).toMatch(/warten/);
    clock.advance(AWAY_MS);
    for (let i = 0; i < 10 && actingSeats(H.game).includes(seatB); i++) {
      A.svc.standIn(seatB);
      clock.advance(500);
    }
    expect(actingSeats(H.game)).not.toContain(seatB);
    play([H, A], 20, random);
    expect(versions([H, A]).size).toBe(1);
  });
});

describe('Mehrspieler: Identität und Bedienung', () => {
  it('ein Zuschauer mit gleichem Namen verdrängt keinen verbundenen Spieler', () => {
    const { sims, code, net, clock } = start(['H', 'A']);
    const [, A] = sims;
    const X = new Sim('A', net);
    X.svc.join(code, 'A');
    clock.advance(1000);
    const seat = A.seat;
    X.svc.claimSeat(A.svc.clientId);
    clock.advance(500);
    expect([A.seat, X.seat]).toEqual([seat, -1]);
  });

  it('ein Doppelklick schickt dieselbe Aktion nur einmal, bei Host und Mitspieler', () => {
    const { sims, clock } = start(['H', 'A']);
    const random = seeded(21);
    playUntilMain(sims, random);
    for (const who of sims) {
      while (bySeat(sims, sims[0].game, sims[0].game.current) !== who) play(sims, 1, random);
      if (sims[0].game.phase.kind !== 'main') play(sims, 1, random);
      if (bySeat(sims, sims[0].game, sims[0].game.current) !== who || sims[0].game.phase.kind !== 'main') continue;
      const res = who.game.players[who.seat].resources;
      const have = (Object.keys(res) as (keyof ResourceCounts)[]).find((r) => res[r] > 0);
      if (!have) continue;
      const before = hostOf(sims)!.v!;
      const offer = { type: 'offerTrade', give: one(have), want: one(have === 'ore' ? 'wood' : 'ore') } as const;
      who.svc.act(offer);
      who.svc.act(offer);
      clock.advance(500);
      expect(hostOf(sims)!.v).toBe(before + 1);
    }
  });

  it('ein Host ohne Mehrheit nimmt keine Züge an', () => {
    const { sims, net, clock } = start(['H', 'A', 'B']);
    const [H] = sims;
    playUntilMain(sims, seeded(23));
    net.isolate(H, 1000);
    clock.advance(2000);
    expect(H.svc.status()).toBe('reconnecting');
    const before = H.v;
    H.svc.act({ type: 'endTurn' });
    expect(H.v).toBe(before);
    expect(H.svc.notice()?.text).toMatch(/Mehrheit/);
  });

  it('Peers mit anderer Protokollversion spielen nicht mit', () => {
    const clock = new Clock();
    const net = new Net(clock);
    const H = new Sim('H', net);
    H.svc.create('H');
    const transport = net.transport(new Sim('Alt', net), H.svc.code()!, {
      onPeerJoin: (peer) => transport.send({ t: 'hello', id: 'alt', name: 'Alt' }, peer),
      onPeerLeave: () => {},
      onMessage: () => {},
    });
    clock.advance(1000);
    expect(H.svc.room()!.players.map((p) => p.name)).toEqual(['H']);
    expect(H.svc.notice()?.text).toMatch(/andere Version/);
  });
});

describe('Mehrspieler: Chaos', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('läuft nach zufälligen Störungen wieder auf einen Host und einen Stand zusammen (Lauf %i)', (seed) => {
    resetNet(seed);
    const random = seeded(seed * 7919);
    const { sims, code, net, clock } = start(['H', 'A', 'B', 'C']);
    const tabs = [...sims];
    for (let step = 0; step < 120; step++) {
      const r = random();
      const pick = () => tabs[Math.floor(random() * tabs.length)];
      if (r < 0.06) {
        net.cut(pick(), pick(), 1000 + random() * 14000, 1000 + random() * 14000);
      } else if (r < 0.12) {
        net.heal(pick());
      } else if (r < 0.15) {
        // Tab schließen und neu öffnen
        const i = Math.floor(random() * tabs.length);
        tabs[i].close();
        clock.advance(500 + random() * 5000);
        tabs[i] = tabs[i].reopen();
        tabs[i].svc.join(code, tabs[i].name);
      } else {
        play(tabs, 1, random, 100 + random() * 900);
      }
      clock.advance(random() * 2000);
    }
    for (const t of tabs) net.heal(t);
    clock.advance(60000);
    const live = tabs.filter((t) => t.svc.room());
    expect(hosts(live)).toHaveLength(1);
    expect(new Set(live.map((t) => t.game?.id)).size).toBe(1);
    expect(versions(live).size).toBe(1);
    expect(live.every((t) => t.svc.status() === 'connected')).toBe(true);
    expect(live.every((t) => t.svc.pending() === 0)).toBe(true);
    // Und es geht weiter.
    play(live, 30, random);
    clock.advance(5000);
    expect(versions(live).size).toBe(1);
  });
});
