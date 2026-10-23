import { GameState, getTopology, RESOURCES, victoryPoints, victoryTarget } from '../../engine';
import { VoiceEvent } from '../shared/voice';

/** Ab so vielen Rohstoffen aus einem Wurf freut sich der Berater über die Ernte. */
const BIG_HARVEST = 5;

/**
 * Was sich zwischen zwei Spielständen aus meiner Sicht (Sitz `seat`) Ansagenswertes getan hat, in der
 * Reihenfolge, in der es gesagt werden soll. Spielbeginn, Zugbeginn, Bauhinweis, Tauschangebote, Zögern und
 * Verbindungen meldet die Spielansicht selbst; sie sorgt auch dafür, dass der Erzfeind höchstens eine Straße
 * je Zug kommentiert.
 */
export function voiceEvents(prev: GameState, next: GameState, seat: number): VoiceEvent[] {
  if (seat < 0 || next.version <= prev.version) return [];
  const isEnemy = (s: number | null) => s !== null && s !== seat && !next.players[s]?.neutral;

  // Der Sieg übertönt alles andere: erst der Herold, dann Berater oder Erzfeind.
  if (next.phase.kind === 'ended' && prev.phase.kind !== 'ended') {
    if (next.winner === seat) return ['anyWin', 'myWin'];
    return isEnemy(next.winner) ? ['anyWin', 'enemyWin'] : ['anyWin'];
  }

  const events: VoiceEvent[] = [];
  const setup = next.phase.kind === 'setup';

  // Herold: Ende der Aufbauphase, Beginn einer Sonderbaurunde, leere Bank, neu gemischter Würfelstapel.
  if (prev.phase.kind === 'setup' && !setup) events.push('setupDone');
  if (next.phase.kind === 'specialBuild' && prev.phase.kind !== 'specialBuild') events.push('specialBuildStart');
  if (RESOURCES.some((r) => prev.bank[r] > 0 && next.bank[r] === 0)) events.push('bankEmpty');
  const deckSize = (s: GameState) => Object.values(s.diceDeck ?? {}).reduce((a, n) => a + n, 0);
  if (prev.diceDeck && next.diceDeck && deckSize(next) > deckSize(prev)) events.push('diceReshuffle');
  const fromPlayer = (t: GameState['transfers'][number], a: (s: number) => boolean, b: (s: number) => boolean) =>
    t.from.kind === 'player' && t.to.kind === 'player' && a(t.from.seat) && b(t.to.seat);
  const me = (s: number) => s === seat;

  // Eine 7 (egal von wem) und ich muss abwerfen. Abwerfen aus anderen Gründen (Stadtwacht) hat `to` oder `then`.
  const discard = next.phase.kind === 'discard' ? next.phase : null;
  if (discard && prev.phase.kind !== 'discard' && !discard.to && !discard.then && (discard.pending[seat] ?? 0) > 0) {
    events.push('mustDiscard');
  }

  // Meine Sonderbaurunde beginnt.
  const special = next.phase.kind === 'specialBuild' ? next.phase : null;
  const wasMine = prev.phase.kind === 'specialBuild' && prev.phase.queue[0] === seat;
  if (special && special.queue[0] === seat && !wasMine) events.push('mySpecialBuild');

  // Reiche Ernte aus einem Wurf.
  if (prev.phase.kind === 'roll' && next.phase.kind !== 'roll') {
    const harvest = next.transfers.filter((t) => t.from.kind === 'hex' && t.to.kind === 'player' && t.to.seat === seat).reduce((n, t) => n + t.count, 0);
    if (harvest >= BIG_HARVEST) events.push('bigHarvest');
  }

  // Handelsstraße und Rittermacht: gewonnen, ausgebaut, verloren; ein Gegner, der sie bekommt, spottet danach.
  if (next.longestRoad === seat) {
    if (prev.longestRoad !== seat) events.push('myLongestRoad');
    else if (next.roadLengths[seat] > prev.roadLengths[seat]) events.push('myLongestRoadGrows');
  } else if (next.longestRoad !== prev.longestRoad) {
    if (prev.longestRoad === seat) events.push('lostLongestRoad');
    if (isEnemy(next.longestRoad)) events.push('enemyLongestRoad');
  }
  if (next.largestArmy !== prev.largestArmy) {
    if (next.largestArmy === seat) events.push('myLargestArmy');
    else {
      if (prev.largestArmy === seat) events.push('lostLargestArmy');
      if (isEnemy(next.largestArmy)) events.push('enemyLargestArmy');
    }
  }

  // Monopol, Raub, Tausch.
  const played = next.playedDev ?? [];
  const monopoly = played.length > (prev.playedDev ?? []).length && played.at(-1) === 'monopoly';
  if (monopoly && next.current === seat) events.push('myMonopoly');
  const robbedMe = next.transfers.some((t) => t.hidden && fromPlayer(t, me, isEnemy));
  if (monopoly && next.current !== seat && next.transfers.some((t) => fromPlayer(t, me, isEnemy))) events.push('enemyMonopoly');
  else if (robbedMe) events.push('robbedMe');
  if (next.transfers.some((t) => t.hidden && fromPlayer(t, isEnemy, me))) events.push('iRobbed');
  const gave = next.transfers.some((t) => !t.hidden && fromPlayer(t, me, isEnemy));
  const got = next.transfers.some((t) => !t.hidden && fromPlayer(t, isEnemy, me));
  if (!monopoly && gave && got) events.push('tradeDone');

  // Der Räuber kommt an mein Feld, ohne dass ich ausgeraubt werde.
  if (next.robber >= 0 && next.robber !== prev.robber && isEnemy(next.current) && !robbedMe) {
    const corners = getTopology(next.board).hexes[next.robber]?.corners ?? [];
    if (corners.some((v) => next.buildings[v]?.owner === seat)) events.push('robberOnMyHex');
  }

  // Ein Gegner lehnt mein Angebot ab: nur beim ersten Ablehnen je Angebot.
  for (const offer of next.offers) {
    if (offer.from !== seat || offer.counter) continue;
    const before = prev.offers.find((o) => o.id === offer.id);
    const enemyDeclined = (o: typeof offer) => o.declined.some((s) => isEnemy(s));
    if (before && !enemyDeclined(before) && enemyDeclined(offer)) {
      events.push('tradeRejected');
      break;
    }
  }

  // Bauten der Gegner (nicht in der Aufbauphase): Stadt vor Siedlung vor Straße, je Spielstand eine Ansage.
  if (!setup) {
    // Neue Siedlung nur auf leerer Ecke (eine Stadt, die bei der Stadtwacht zurückfällt, zählt nicht), Stadt aus Siedlung.
    const built = (type: 'settlement' | 'city') =>
      next.buildings.some((b, v) => b?.type === type && isEnemy(b.owner) && (type === 'city' ? prev.buildings[v]?.type === 'settlement' : !prev.buildings[v]));
    const myCity = next.buildings.some((b, v) => b?.type === 'city' && b.owner === seat && prev.buildings[v]?.type === 'settlement');
    if (myCity) events.push('myCity');
    if (built('city')) events.push('enemyCity');
    else if (built('settlement')) events.push('enemySettlement');
    else if (next.roads.some((r, e) => r !== null && prev.roads[e] === null && isEnemy(r))) events.push('enemyRoad');
  }

  // Noch ein Punkt bis zum Sieg: meine Punkte samt verdeckten, bei Gegnern die offenen.
  const reaches = (s: number, hidden: boolean) => {
    const goal = victoryTarget(next, s) - 1;
    return victoryPoints(next, s, hidden) >= goal && victoryPoints(prev, s, hidden) < goal;
  };
  if (!setup && reaches(seat, true)) events.push('myMatchPoint');
  if (!setup && next.players.some((_, s) => isEnemy(s) && reaches(s, false))) events.push('enemyMatchPoint');
  return events;
}
