import { GameState } from '../../engine';
import { Effect } from '../shared/sounds';

/**
 * Welche Geräusche ein neuer Spielstand auslöst. Bauen, Handel, Karten und Räuber hört jeder bei allen
 * Spielern; Rohstoffe aus Feldern nur, wer sie bekommt (`seat`). Der Sieg übertönt alles andere.
 */
export function effectEvents(prev: GameState, next: GameState, seat: number): Effect[] {
  if (next.version <= prev.version) return [];
  if (next.phase.kind === 'ended' && prev.phase.kind !== 'ended') return ['sieg'];
  const out: Effect[] = [];
  const t = next.transfers;
  type Point = (typeof t)[number]['from'];
  const isPlayer = (p: Point) => p.kind === 'player';
  const seatOf = (p: Point) => (p.kind === 'player' ? p.seat : -1);

  const newBuilding = (type: 'settlement' | 'city') =>
    next.buildings.some((b, v) => b?.type === type && (type === 'city' ? prev.buildings[v]?.type === 'settlement' : !prev.buildings[v]));
  if (newBuilding('city')) out.push('stadt');
  else if (newBuilding('settlement')) out.push('siedlung');
  const newRoad = next.roads.some((r, e) => r !== null && prev.roads[e] === null);
  const newShip = (next.ships ?? []).some((r, e) => r !== null && (prev.ships ?? [])[e] === null);
  if (newRoad || newShip) out.push('strasse');

  if (t.some((x) => x.from.kind === 'hex' && x.to.kind === 'player' && x.to.seat === seat)) out.push('karten');

  const played = next.playedDev ?? [];
  const newCard = played.length > (prev.playedDev ?? []).length ? played.at(-1) : null;
  if (t.some((x) => x.card === 'dev' && x.from.kind === 'bank')) out.push('pergament');
  if (newCard === 'knight') out.push('schwert');

  // Tausch zwischen zwei Spielern: Karten in beide Richtungen, offen (Raub ist verdeckt, Monopol geht nur in eine Richtung).
  const open = t.filter((x) => !x.hidden && isPlayer(x.from) && isPlayer(x.to));
  if (open.some((x) => open.some((y) => seatOf(y.from) === seatOf(x.to) && seatOf(y.to) === seatOf(x.from)))) out.push('muenzen');
  // Handel mit Bank oder Hafen: Rohstoffe hin und zurück (Bauen und Kaufen zahlen nur an die Bank).
  const toBank = t.some((x) => x.to.kind === 'bank' && isPlayer(x.from) && x.card !== 'dev');
  const fromBank = t.some((x) => x.from.kind === 'bank' && isPlayer(x.to) && x.card !== 'dev');
  if (toBank && fromBank) out.push('muenze');

  if (next.robber >= 0 && next.robber !== prev.robber) out.push('raeuber');
  const roadChanged = next.longestRoad !== null && next.longestRoad !== prev.longestRoad;
  const armyChanged = next.largestArmy !== null && next.largestArmy !== prev.largestArmy;
  if (roadChanged || armyChanged) out.push('horn');
  return out;
}
