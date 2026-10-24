import { autoAction } from '../auto';
import { actingSeats, applyAction, createGame, victoryPoints } from '../rules';
import { Action, GameSettings, GameState, TradeOffer } from '../types';

/**
 * Messbank für Bots: Partien Bot gegen Bot, deren Ergebnis zeigt, ob eine Änderung am Bot wirklich hilft.
 * Läuft ohne Netz direkt auf der Engine, so wie der Host die Bots spielen lässt (room.service.ts).
 */

/**
 * Ein Bot im Turnier: sein Zug und, falls er handelt, seine Antwort auf Tauschangebote (annehmen, ablehnen
 * oder ein Gegenangebot). `offersMade` zählt seine eigenen Angebote in diesem Zug, wie beim Host.
 */
export interface Contender {
  name: string;
  act(s: GameState, seat: number, offersMade: number): Action | null;
  answer?(s: GameState, seat: number, offer: TradeOffer): Action | null;
}

export interface MatchResult {
  /** Name des Bots je Sitz. */
  seats: string[];
  winner: number | null;
  /** Siegpunkte am Ende, mit verdeckten. */
  points: number[];
  turns: number;
  steps: number;
  /** Züge, die der Bot nicht legal hinbekam und auto.ts übernehmen musste. */
  fallbacks: number[];
  /** Abbruch, weil kein Sitz mehr einen legalen Zug fand. */
  stuck: boolean;
  /** Abgeschlossene Tausche zwischen Spielern. */
  trades: number;
}

/**
 * Eine Partie. `lineup[i]` spielt für den i-ten Spieler; welcher Sitz das wird, lost createGame aus.
 * Nach jedem Zug antworten die Bots auf offene Angebote, wie beim Host.
 */
export function playMatch(lineup: Contender[], seed: number, settings: GameSettings, maxSteps = 8000): MatchResult {
  const players = lineup.map((_, i) => ({ id: `p${i}`, name: `S${i}`, color: `c${i}` }));
  let s = createGame(players, settings, seed);
  const bySeat = s.players.map((p) => lineup[Number(p.id.slice(1))]);
  const fallbacks = bySeat.map(() => 0);
  let steps = 0;
  let stuck = false;
  let trades = 0;
  // Eigene Angebote des Spielers am Zug in diesem Zug.
  let offers = { turn: -1, made: 0 };
  for (; steps < maxSteps && s.phase.kind !== 'ended'; steps++) {
    const answered = answerOffers(s, bySeat);
    if (answered) {
      s = answered;
      continue;
    }
    const seat = actingSeats(s)[0];
    if (offers.turn !== s.turn) offers = { turn: s.turn, made: 0 };
    const next = tryMove(s, seat, bySeat[seat], offers.made) ?? tryMove(s, seat, null, 0);
    if (!next) {
      stuck = true;
      break;
    }
    if (next.fallback) fallbacks[seat]++;
    if (next.action.type === 'offerTrade' && seat === s.current) offers.made++;
    if (next.action.type === 'confirmTrade') trades++;
    s = next.state;
  }
  return {
    seats: bySeat.map((c) => c.name),
    winner: s.winner,
    points: s.players.map((_, i) => victoryPoints(s, i, true)),
    turns: s.turn,
    steps,
    fallbacks,
    stuck,
    trades,
  };
}

function tryMove(s: GameState, seat: number, bot: Contender | null, offersMade: number): { state: GameState; action: Action; fallback: boolean } | null {
  const action = bot ? bot.act(s, seat, offersMade) : autoAction(s, seat, () => 0.5);
  if (!action) return null;
  try {
    const state = applyAction(s, seat, action);
    // Ein Zug, der nichts ändert, brächte die Partie nie weiter.
    return state === s ? null : { state, action, fallback: !bot };
  } catch {
    return null;
  }
}

function answerOffers(s: GameState, bySeat: Contender[]): GameState | null {
  for (const offer of s.offers) {
    for (let seat = 0; seat < bySeat.length; seat++) {
      const action = bySeat[seat].answer?.(s, seat, offer) ?? null;
      if (!action) continue;
      try {
        const next = applyAction(s, seat, action);
        if (next !== s) return next;
      } catch {
        // Angebot gerade nicht mehr gültig
      }
    }
  }
  return null;
}

export interface TournamentOptions {
  players: number;
  /** Anzahl Bretter; jedes wird in allen Drehungen der Aufstellung gespielt. */
  boards: number;
  settings?: GameSettings;
  /** Erster Seed; Brett b nutzt seed + b. */
  seed?: number;
  /**
   * Welcher Bot an welchem Platz der Aufstellung sitzt, als Index in `contenders`. Vorgabe: abwechselnd.
   * Die Aufstellung wird je Brett einmal ganz durchgedreht, damit jeder Bot jede Stelle bekommt.
   */
  pattern?: number[];
}

export interface Standing {
  name: string;
  games: number;
  /** Plätze, die dieser Bot in allen Partien zusammen hatte. */
  seats: number;
  wins: number;
  /** Siege je Platz mal Spielerzahl: 1 ist Durchschnitt, 1,2 heißt 20 % öfter gewonnen als erwartet. */
  strength: number;
  /** Ungefährer Fehler von `strength` (eine Standardabweichung). */
  error: number;
  avgPoints: number;
  fallbacks: number;
}

export interface TournamentResult {
  standings: Standing[];
  games: number;
  /** Partien ohne Sieger (Zuglimit oder festgefahren). */
  unfinished: number;
  avgTurns: number;
  /** Tausche zwischen Spielern je Partie. */
  avgTrades: number;
}

export function tournament(contenders: Contender[], options: TournamentOptions): TournamentResult {
  const n = options.players;
  const pattern = options.pattern ?? Array.from({ length: n }, (_, i) => i % contenders.length);
  const settings = options.settings ?? { victoryPoints: 10 };
  const seed = options.seed ?? 1;
  const tally = contenders.map((c) => ({
    name: c.name,
    games: 0,
    seats: 0,
    wins: 0,
    points: 0,
    fallbacks: 0,
  }));
  let games = 0;
  let unfinished = 0;
  let turns = 0;
  let trades = 0;
  for (let b = 0; b < options.boards; b++) {
    // Gleiche Drehungen (etwa bei abwechselnder Aufstellung) nur einmal spielen.
    const lineups = new Set<string>();
    for (let r = 0; r < n; r++) lineups.add(pattern.map((_, i) => pattern[(i + r) % n]).join(','));
    for (const key of lineups) {
      const lineup = key.split(',').map((i) => contenders[Number(i)]);
      const m = playMatch(lineup, seed + b, settings);
      games++;
      turns += m.turns;
      trades += m.trades;
      if (m.winner === null) unfinished++;
      const entry = (name: string) => tally.find((t) => t.name === name)!;
      for (const name of new Set(m.seats)) entry(name).games++;
      m.seats.forEach((name, seat) => {
        const t = entry(name);
        t.seats++;
        t.points += m.points[seat];
        t.fallbacks += m.fallbacks[seat];
        if (m.winner === seat) t.wins++;
      });
    }
  }
  const standings = tally.map((t) => {
    const p = t.seats ? t.wins / t.seats : 0;
    return {
      name: t.name,
      games: t.games,
      seats: t.seats,
      wins: t.wins,
      strength: p * n,
      error: t.seats ? Math.sqrt((p * (1 - p)) / t.seats) * n : 0,
      avgPoints: t.seats ? t.points / t.seats : 0,
      fallbacks: t.fallbacks,
    };
  });
  return {
    standings,
    games,
    unfinished,
    avgTurns: games ? turns / games : 0,
    avgTrades: games ? trades / games : 0,
  };
}

/** Ergebnis als kleine Tabelle für die Konsole. */
export function formatTournament(r: TournamentResult, title: string): string {
  const rows = r.standings.map(
    (s) =>
      `  ${s.name.padEnd(14)} Stärke ${s.strength.toFixed(2)} ± ${s.error.toFixed(2)}   Siege ${String(s.wins).padStart(4)} / ${String(s.seats).padStart(4)} Plätze   Ø Punkte ${s.avgPoints.toFixed(1)}   Notzüge ${s.fallbacks}`,
  );
  return [`${title}: ${r.games} Partien, Ø ${r.avgTurns.toFixed(0)} Züge, Ø ${r.avgTrades.toFixed(1)} Tausche, ${r.unfinished} ohne Sieger`, ...rows].join('\n');
}
