import { GameState } from '../../engine';
import { VoiceEvent } from '../shared/voice';

/**
 * Was sich zwischen zwei Spielständen aus meiner Sicht (Sitz `seat`) Ansagenswertes getan hat.
 * Zugbeginn, Bauhinweis, Tauschangebote, Zögern und Verbindungen meldet die Spielansicht selbst;
 * sie sorgt auch dafür, dass der Erzfeind höchstens eine Straße je Zug kommentiert.
 */
export function voiceEvents(prev: GameState, next: GameState, seat: number): VoiceEvent[] {
  if (seat < 0 || next.version <= prev.version) return [];
  const events: VoiceEvent[] = [];
  const isEnemy = (s: number | null) => s !== null && s !== seat && !next.players[s]?.neutral;
  const setup = next.phase.kind === 'setup';

  // Eine 7 (egal von wem) und ich muss abwerfen. Abwerfen aus anderen Gründen (Stadtwacht) hat `to` oder `then`.
  const discard = next.phase.kind === 'discard' ? next.phase : null;
  if (discard && prev.phase.kind !== 'discard' && !discard.to && !discard.then && (discard.pending[seat] ?? 0) > 0) {
    events.push('mustDiscard');
  }

  // Meine Sonderbaurunde beginnt.
  const special = next.phase.kind === 'specialBuild' ? next.phase : null;
  const wasMine = prev.phase.kind === 'specialBuild' && prev.phase.queue[0] === seat;
  if (special && special.queue[0] === seat && !wasMine) events.push('mySpecialBuild');

  if (next.longestRoad === seat) {
    if (prev.longestRoad !== seat) events.push('myLongestRoad');
    else if (next.roadLengths[seat] > prev.roadLengths[seat]) events.push('myLongestRoadGrows');
  } else if (next.longestRoad !== prev.longestRoad && isEnemy(next.longestRoad)) {
    events.push('enemyLongestRoad');
  }
  if (next.largestArmy !== prev.largestArmy) {
    if (next.largestArmy === seat) events.push('myLargestArmy');
    else if (isEnemy(next.largestArmy)) events.push('enemyLargestArmy');
  }

  const played = next.playedDev ?? [];
  const monopoly = played.length > (prev.playedDev ?? []).length && played.at(-1) === 'monopoly';
  if (monopoly && next.current === seat) events.push('myMonopoly');
  const tookFromMe = next.transfers.some((t) => t.from.kind === 'player' && t.from.seat === seat && t.to.kind === 'player' && isEnemy(t.to.seat));
  if (monopoly && next.current !== seat && tookFromMe) events.push('enemyMonopoly');
  else if (next.transfers.some((t) => t.hidden && t.from.kind === 'player' && t.from.seat === seat && t.to.kind === 'player' && isEnemy(t.to.seat))) {
    events.push('robbedMe');
  }

  if (!setup) {
    if (next.buildings.some((b, v) => b && !prev.buildings[v] && b.type === 'settlement' && isEnemy(b.owner))) events.push('enemySettlement');
    else if (next.roads.some((r, e) => r !== null && prev.roads[e] === null && isEnemy(r))) events.push('enemyRoad');
  }
  return events;
}
