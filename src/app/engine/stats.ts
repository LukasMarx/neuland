import { Action, GameState, GameStats, Transfer } from './types';

export function emptyStats(players: number): GameStats {
  const zero = () => Array<number>(players).fill(0);
  return {
    dice: Array<number>(13).fill(0),
    produced: zero(),
    blocked: zero(),
    stolen: zero(),
    robbed: zero(),
    discarded: zero(),
    trades: zero(),
    bankCards: zero(),
    devBought: zero(),
    vp: [],
  };
}

/** Mehr Punktestände braucht die Kurve nicht; der Stand wird bei jeder Aktion kopiert. */
const MAX_VP_ENTRIES = 200;

const seatOf = (p: Transfer['from']) => (p.kind === 'player' ? p.seat : null);

/**
 * Trägt eine angewendete Aktion in die Statistik ein, aus den Kartenbewegungen und der Aktion selbst.
 * `vp` liefert die Siegpunkte (mit oder ohne verdeckte); als Rückruf, weil rules.ts dieses Modul nutzt.
 */
export function recordStats(prev: GameState, s: GameState, seat: number, action: Action, vp: (seat: number, hidden: boolean) => number): void {
  const st = s.stats;
  if (!st) return;
  if (action.type === 'roll' && s.dice) st.dice[s.dice[0] + s.dice[1]]++;
  for (const t of s.transfers) {
    const from = seatOf(t.from);
    const to = seatOf(t.to);
    if (t.card === 'dev') continue;
    if (to !== null && (t.from.kind === 'hex' || (action.type === 'chooseGold' && t.from.kind === 'bank'))) st.produced[to] += t.count;
    if (action.type === 'moveRobber' && from !== null && to !== null) {
      st.stolen[to] += t.count;
      st.robbed[from] += t.count;
    }
    if (action.type === 'discard' && from !== null) st.discarded[from] += t.count;
    if ((action.type === 'bankTrade' || action.type === 'bankTradeBatch') && from !== null && t.to.kind === 'bank') st.bankCards[from] += t.count;
  }
  if (action.type === 'confirmTrade') {
    const partners = new Set(s.transfers.flatMap((t) => [seatOf(t.from), seatOf(t.to)]).filter((x) => x !== null));
    for (const p of partners) st.trades[p]++;
  }
  if (action.type === 'buyDevCard') st.devBought[seat]++;
  const ended = s.phase.kind === 'ended';
  if (!ended && s.turn === prev.turn) return;
  st.vp.push({ turn: s.turn, points: s.players.map((_, i) => vp(i, ended)) });
  // Ausdünnen: jeden zweiten Stand streichen, den ersten und den letzten behalten.
  if (st.vp.length > MAX_VP_ENTRIES) st.vp = st.vp.filter((_, i) => i % 2 === 0 || i === st.vp.length - 1);
}
