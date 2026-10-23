import { GameState, getTopology } from '../../engine';
import { VoiceEvent } from '../shared/voice';

/** Wie oft der Erzfeind eine neue Straße kommentiert; sonst redet er bei jedem Zug. */
const ENEMY_ROAD_CHANCE = 0.2;

/**
 * Was sich zwischen zwei Spielständen aus meiner Sicht (Sitz `seat`) Ansagenswertes getan hat.
 * Zugbeginn, Tauschangebote, Zögern und Verbindungen meldet die Spielansicht selbst.
 */
export function voiceEvents(prev: GameState, next: GameState, seat: number, random: () => number = Math.random): VoiceEvent[] {
  if (seat < 0 || next.version <= prev.version) return [];
  const events: VoiceEvent[] = [];
  const isEnemy = (s: number | null) => s !== null && s !== seat && !next.players[s]?.neutral;

  // Eine 7 aus meinem eigenen Wurf.
  if (prev.phase.kind === 'roll' && next.phase.kind !== 'roll' && prev.current === seat && next.dice && next.dice[0] + next.dice[1] === 7) {
    events.push('mySeven');
  }

  if (next.longestRoad !== prev.longestRoad) {
    if (next.longestRoad === seat) events.push('myLongestRoad');
    else if (isEnemy(next.longestRoad)) events.push('enemyLongestRoad');
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

  // Neue gegnerische Siedlung an einer meiner Straßen: Dort hätte ich bauen können.
  const topo = getTopology(next.board);
  const settledNearMe = next.buildings.some(
    (b, v) => b && !prev.buildings[v] && b.type === 'settlement' && isEnemy(b.owner) && topo.vertices[v].edges.some((e) => next.roads[e] === seat),
  );
  if (settledNearMe && next.phase.kind !== 'setup') events.push('enemySettlesNearMe');
  else if (next.phase.kind !== 'setup' && next.roads.some((r, e) => r !== null && prev.roads[e] === null && isEnemy(r)) && random() < ENEMY_ROAD_CHANCE) {
    events.push('enemyRoad');
  }
  return events;
}
