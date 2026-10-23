import {
  actingSeats,
  Action,
  applyAction,
  botAction,
  createGame,
  GameState,
  getTopology,
  legalRoadEdges,
  legalRobberHexes,
  legalSettlementVertices,
  NewPlayer,
  Resource,
  robberVictims,
} from '../../engine';

/** Die Runde in den Videos: immer dieselben vier, immer dasselbe Brett. */
const PLAYERS: NewPlayer[] = [
  { id: 'mara', name: 'Mara', color: '#d23c3c' },
  { id: 'bruno', name: 'Bruno', color: '#2f64d6' },
  { id: 'clara', name: 'Clara', color: '#f4f1e8' },
  { id: 'jonas', name: 'Jonas', color: '#ee8a1c' },
];
/** Seed, bei dem Mara (aus Sicht des Videos „du“) als Erste setzt, danach Bruno, Clara, Jonas. */
const SEED = 1;

export interface Spielstand {
  state: GameState;
  /** Sitz der Spielerin, aus deren Sicht das Video gefilmt wird. */
  seat: number;
  /** Vorbereitete Ziele für das Drehbuch, etwa die Ecke für die neue Siedlung. */
  plan?: Record<string, unknown>;
}

export function neuesSpiel(): Spielstand {
  const state = createGame(PLAYERS, { victoryPoints: 10, map: 'klassisch' }, SEED);
  return { state, seat: state.players.findIndex((p) => p.id === 'mara') };
}

/** Lässt alle Plätze mit dem Bot spielen, bis `done` zutrifft. */
export function spieleBis(s: GameState, done: (s: GameState) => boolean, limit = 2000): GameState {
  for (let i = 0; i < limit && !done(s); i++) {
    const seat = actingSeats(s)[0];
    const action = botAction(s, seat);
    if (!action) break;
    s = applyAction(s, seat, action);
  }
  return s;
}

/** Ein Zug ohne Würfel: setzt den Stand direkt in die Hauptphase des Spielers. */
export function amZug(s: GameState, seat: number): GameState {
  return { ...s, current: seat, phase: { kind: 'main' }, dice: s.dice ?? [3, 4], devPlayed: false };
}

/** Gibt einem Spieler Karten aus der Bank, ohne Würfel. */
export function gib(s: GameState, seat: number, cards: Partial<Record<Resource, number>>): GameState {
  const players = s.players.map((p, i) => {
    if (i !== seat) return p;
    const resources = { ...p.resources };
    for (const [r, n] of Object.entries(cards)) resources[r as Resource] += n!;
    return { ...p, resources };
  });
  const bank = { ...s.bank };
  for (const [r, n] of Object.entries(cards)) bank[r as Resource] -= n!;
  return { ...s, players, bank };
}

/** Setzt die Hand eines Spielers auf genau diese Karten (der Rest geht zurück in die Bank). */
export function hand(s: GameState, seat: number, cards: Partial<Record<Resource, number>>): GameState {
  const back = Object.fromEntries(Object.entries(s.players[seat].resources).map(([r, n]) => [r, -n]));
  return gib(gib(s, seat, back), seat, cards);
}

export function wende(s: GameState, seat: number, ...actions: Action[]): GameState {
  return actions.reduce((acc, a) => applyAction(acc, seat, a), s);
}

const setupDone = (s: GameState) => s.phase.kind !== 'setup';

/** Nach dem Aufbau, Mara ist am Zug und würfelt gleich. */
function nachAufbau(): Spielstand {
  const { state, seat } = neuesSpiel();
  return { state: spieleBis(state, setupDone), seat };
}

const pips = (n: number | null) => (n ? 6 - Math.abs(7 - n) : 0);

/** Zahlen an den Gebäuden eines Spielers. */
function zahlenAn(s: GameState, seat: number): Set<number> {
  const topo = getTopology(s.board);
  const out = new Set<number>();
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat) return;
    for (const h of topo.vertices[v].hexes) {
      const n = s.board.hexes[h].number;
      if (n && h !== s.robber) out.add(n);
    }
  });
  return out;
}

/** Ein Wurf, von dem Mara und möglichst viele andere etwas haben. */
function guterWurf(s: GameState, seat: number): [number, number] {
  const mine = zahlenAn(s, seat);
  const others = s.players.map((_, i) => (i === seat ? new Set<number>() : zahlenAn(s, i)));
  const best = [...mine].sort((a, b) => others.filter((o) => o.has(b)).length - others.filter((o) => o.has(a)).length || pips(b) - pips(a))[0];
  const a = Math.max(1, best - 6);
  return [a, best - a];
}

/** Wert einer Ecke für eine neue Siedlung: Wahrscheinlichkeit der Felder daran. */
function eckenWert(s: GameState, v: number): number {
  return getTopology(s.board).vertices[v].hexes.reduce((sum, h) => sum + pips(s.board.hexes[h].number), 0);
}

/** Zwei Straßen, nach denen eine neue Siedlung möglich wird, und die beste Ecke dafür. */
function wegZurSiedlung(s: GameState, seat: number): { strassen: [number, number]; ecke: number } {
  let best: { strassen: [number, number]; ecke: number; wert: number } | null = null;
  for (const e1 of legalRoadEdges(s, seat)) {
    const s1 = wende(s, seat, { type: 'buildRoad', edge: e1 });
    for (const e2 of legalRoadEdges(s1, seat)) {
      const s2 = wende(s1, seat, { type: 'buildRoad', edge: e2 });
      for (const v of legalSettlementVertices(s2, seat)) {
        const wert = eckenWert(s2, v);
        if (!best || wert > best.wert) best = { strassen: [e1, e2], ecke: v, wert };
      }
    }
  }
  if (!best) throw new Error('Kein Weg zu einer neuen Siedlung');
  return best;
}

const eigeneSiedlungen = (s: GameState, seat: number) =>
  s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'settlement' ? [v] : [])).sort((a, b) => eckenWert(s, b) - eckenWert(s, a));

/** Ein Feld für den Räuber, das einen Mitspieler trifft und Mara nicht, mit dem Opfer. */
function raeuberZiel(s: GameState, seat: number): { feld: number; opfer: number } {
  const topo = getTopology(s.board);
  const options = legalRobberHexes(s)
    .map((h) => ({ h, victims: robberVictims(s, seat, h), mine: topo.hexes[h] && s.buildings.some((b, v) => b?.owner === seat && topo.vertices[v].hexes.includes(h)) }))
    .filter((o) => o.victims.length && !o.mine)
    .sort((a, b) => pips(s.board.hexes[b.h].number) - pips(s.board.hexes[a.h].number));
  if (!options.length) throw new Error('Kein Feld für den Räuber');
  return { feld: options[0].h, opfer: options[0].victims[0] };
}

const name = (s: GameState, seat: number) => s.players[seat].name;

/**
 * Die Spielstände der einzelnen Clips. Jeder ist reproduzierbar: gleicher Seed, gleicher Bot,
 * gleiche Eingriffe. Der Sitz ist immer Mara. `plan` sagt dem Drehbuch, wohin es klicken soll.
 */
export const SPIELSTAENDE: Record<string, () => Spielstand> = {
  /** Leeres Brett, Mara setzt gleich ihre erste Siedlung. */
  aufbau: () => neuesSpiel(),

  /** Aufbau vorbei, Mara würfelt gleich eine Zahl, die ihr und anderen etwas bringt. */
  zug: () => {
    const { state, seat } = nachAufbau();
    return { state, seat, plan: { wurf: guterWurf(state, seat) } };
  },

  /** Ein paar Runden gespielt, Mara steht mitten im Spiel. */
  mitte: () => {
    const { state, seat } = neuesSpiel();
    return { state: spieleBis(state, (s) => s.turn >= 12 && s.current === seat && s.phase.kind === 'roll'), seat };
  },

  /** Mara hat gewürfelt und genug für zwei Straßen, eine Siedlung und eine Stadt. */
  bauen: () => {
    const start = nachAufbau();
    const seat = start.seat;
    const state = hand(amZug(start.state, seat), seat, { wood: 3, brick: 3, sheep: 1, wheat: 3, ore: 3 });
    const weg = wegZurSiedlung(state, seat);
    return { state, seat, plan: { ...weg, stadt: eigeneSiedlungen(state, seat)[0] } };
  },

  /** Mara hat Getreide übrig und braucht Erz; Bruno hat welches. */
  handel: () => {
    const start = nachAufbau();
    const seat = start.seat;
    let state = hand(amZug(start.state, seat), seat, { wood: 1, sheep: 2, wheat: 5 });
    const bruno = state.players.findIndex((p) => p.name === 'Bruno');
    state = gib(state, bruno, { ore: 2 });
    return { state, seat, plan: { partner: bruno } };
  },

  /** Mara würfelt gleich eine Sieben und hat neun Karten auf der Hand. */
  sieben: () => {
    const start = nachAufbau();
    const seat = start.seat;
    const state = hand(start.state, seat, { wood: 3, brick: 2, sheep: 2, wheat: 2 });
    const ziel = raeuberZiel(state, seat);
    return { state, seat, plan: { wurf: [3, 4], abwerfen: { wood: 2, brick: 1, sheep: 1 }, ...ziel, opferName: name(state, ziel.opfer) } };
  },

  /** Mara hat gewürfelt und kann eine Entwicklungskarte kaufen. */
  entwicklung: () => {
    const start = nachAufbau();
    const seat = start.seat;
    return { state: hand(amZug(start.state, seat), seat, { sheep: 1, wheat: 1, ore: 1, wood: 1 }), seat };
  },

  /**
   * Endspurt: Mara hat zwei Städte, eine Siedlung, zwei Siegpunktkarten, vier Straßen am Stück und
   * zwei Ritter. Die fünfte Straße bringt die Längste Straße, der dritte Ritter die Größte
   * Rittermacht und damit den Sieg.
   */
  sieg: () => {
    const start = nachAufbau();
    const seat = start.seat;
    let state = amZug(start.state, seat);
    // Zwei Städte.
    for (const v of eigeneSiedlungen(state, seat)) {
      state = wende(gib(state, seat, { wheat: 2, ore: 3 }), seat, { type: 'buildCity', vertex: v });
    }
    // Straßen verlängern, bis die längste vier lang ist (die Bank zahlt).
    while (state.roadLengths[seat] < 4) {
      const options = legalRoadEdges(state, seat).map((e) => ({ e, s: wende(gib(state, seat, { wood: 1, brick: 1 }), seat, { type: 'buildRoad', edge: e }) }));
      options.sort((a, b) => b.s.roadLengths[seat] - a.s.roadLengths[seat]);
      state = options[0].s;
    }
    // Eine Siedlung am Ende der Straße, wenn Platz ist; sonst reicht ein dritter Siegpunkt aus Karten.
    const spot = legalSettlementVertices(state, seat).sort((a, b) => eckenWert(state, b) - eckenWert(state, a))[0];
    if (spot !== undefined) state = wende(gib(state, seat, { wood: 1, brick: 1, sheep: 1, wheat: 1 }), seat, { type: 'buildSettlement', vertex: spot });
    const players = state.players.map((p, i) =>
      i === seat ? { ...p, knights: 2, devCards: spot !== undefined ? ['knight', 'victoryPoint'] : ['knight', 'victoryPoint', 'victoryPoint'] } : p,
    ) as GameState['players'];
    state = hand({ ...state, players }, seat, { wood: 1, brick: 1, wheat: 1 });
    // Die fünfte Straße muss die Kette verlängern.
    const fuenfte = legalRoadEdges(state, seat).find((e) => wende(state, seat, { type: 'buildRoad', edge: e }).roadLengths[seat] >= 5);
    if (fuenfte === undefined) throw new Error('Keine Straße verlängert die Kette');
    return { state, seat, plan: { strasse: fuenfte, ...raeuberZiel(state, seat) } };
  },
};
