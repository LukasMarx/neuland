import { coinPoints, GameState, getTopology, isRiverEdge, RAIDER_TRACK, RESOURCES, TRACKS, victoryPoints, victoryTarget } from '../../engine';
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
  const isEnemy = (s: number | null | undefined): s is number => typeof s === 'number' && s !== seat && !!next.players[s] && !next.players[s].neutral;

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

  // Erweiterungen: Wo der Herold ausruft, entfällt der allgemeine Kommentar zu Siedlung, Straße oder Ausbau.
  const extra = expansionEvents(prev, next, seat, isEnemy);
  const covered = new Set<VoiceEvent>([
    ...(extra.includes('islandAny') ? (['enemySettlement'] as const) : []),
    ...(extra.includes('bridgeBuilt') ? (['enemyRoad'] as const) : []),
  ]);
  events.splice(0, events.length, ...events.filter((e) => !covered.has(e)), ...extra);

  // Noch ein Punkt bis zum Sieg: meine Punkte samt verdeckten, bei Gegnern die offenen.
  const reaches = (s: number, hidden: boolean) => {
    const goal = victoryTarget(next, s) - 1;
    return victoryPoints(next, s, hidden) >= goal && victoryPoints(prev, s, hidden) < goal;
  };
  if (!setup && reaches(seat, true)) events.push('myMatchPoint');
  if (!setup && next.players.some((_, s) => isEnemy(s) && reaches(s, false))) events.push('enemyMatchPoint');
  return events;
}

/** Erweiterungen und Hausregeln, in Sprechreihenfolge: der Herold zuerst, danach Berater oder Erzfeind. */
function expansionEvents(prev: GameState, next: GameState, seat: number, isEnemy: (s: number | null | undefined) => s is number): VoiceEvent[] {
  const out: VoiceEvent[] = [];
  const topo = getTopology(next.board);

  // Entwicklungskarten in meinem Zug, angenommene Angebote (nur das erste je Angebot).
  const played = next.playedDev ?? [];
  const card = played.length > (prev.playedDev ?? []).length ? played.at(-1) : null;
  if (next.current === seat && card === 'roadBuilding') out.push('myRoadBuilding');
  if (next.current === seat && card === 'yearOfPlenty') out.push('myInvention');
  for (const offer of next.offers) {
    if (offer.from !== seat || offer.counter) continue;
    const before = prev.offers.find((o) => o.id === offer.id);
    if (before && !before.accepted.some(isEnemy) && offer.accepted.some(isEnemy)) {
      out.push('tradeAccepted');
      break;
    }
  }

  // Seewege: neue Insel, neue Schiffe (Versetzen zählt nicht), Gold, Kaperschiff, Nebel.
  const settlers = next.players.map((_, s) => s).filter((s) => (next.islandBonus?.[s] ?? 0) > (prev.islandBonus?.[s] ?? 0));
  if (settlers.length) {
    out.push('islandAny');
    if (settlers.includes(seat)) out.push('myIsland');
    else if (settlers.some(isEnemy)) out.push('enemyIsland');
  }
  const ships = (g: GameState) => (g.ships ?? []).filter((o) => o !== null).length;
  if (ships(next) > ships(prev) && next.phase.kind !== 'setup') {
    const added = (next.ships ?? []).flatMap((o, e) => (o !== null && (prev.ships ?? [])[e] == null ? [o] : []));
    if (added.includes(seat)) out.push('myShip');
    else if (added.some(isEnemy)) out.push('enemyShip');
  }
  if (next.phase.kind === 'gold' && prev.phase.kind !== 'gold') {
    const pending = next.phase.pending;
    if ((pending[seat] ?? 0) > 0) out.push('myGold');
    else if (pending.some((n, s) => n > 0 && isEnemy(s))) out.push('enemyGold');
  }
  if (typeof next.pirate === 'number' && prev.pirate !== undefined && next.pirate !== prev.pirate) {
    const hex = topo.hexes[next.pirate];
    const nearMe = hex.corners.some((v) => next.buildings[v]?.owner === seat) || hex.edges.some((e) => next.ships?.[e] === seat);
    out.push(isEnemy(next.current) && nearMe ? 'enemyPirateNearMe' : 'pirateMoved');
  }
  if (prev.board.hexes.some((h, i) => h.terrain === 'fog' && next.board.hexes[i]?.terrain !== 'fog')) out.push('fogLifted');

  // Stadtwacht: Flotte kurz vor dem Angriff, Angriff und Ausgang, Ausbau, Prachtstadt.
  if (prev.raiders && next.raiders) {
    const near = RAIDER_TRACK - 1;
    if (next.raiders.position === near && prev.raiders.position < near) out.push('raidersNear');
    if (next.raiders.position < prev.raiders.position) {
      out.push('raidersAttack');
      const lostCity = (s: number) => next.buildings.some((b, v) => prev.buildings[v]?.type === 'city' && prev.buildings[v]?.owner === s && b?.type !== 'city');
      const raid = next.phase.kind === 'raid' ? next.phase : null;
      if (lostCity(seat) || (raid?.pending[seat] ?? 0) > 0) out.push('myCityRaided', 'raidGloat');
      else if (!raid && !next.players.some((_, s) => lostCity(s))) {
        out.push('raidersRepelled');
        if ((next.honors?.[seat] ?? 0) > (prev.honors?.[seat] ?? 0)) out.push('myGuardsHeld');
      }
    }
  }
  const owners = next.metropolis && prev.metropolis ? TRACKS.flatMap((t) => (next.metropolis![t] !== prev.metropolis![t] && next.metropolis![t] !== null ? [next.metropolis![t]!] : [])) : [];
  if (owners.length) {
    out.push('metropolisAny');
    if (owners.includes(seat)) out.push('myMetropolis');
    else if (owners.some(isEnemy)) out.push('enemyMetropolis');
  }
  const level = (g: GameState) => TRACKS.reduce((n, t) => n + (g.improvements?.[seat]?.[t] ?? 0), 0);
  if (level(next) > level(prev) && !owners.includes(seat)) out.push('myImprovement');

  // Fischgründe: Fang, Rostiger Anker (gezogen oder von einem Gegner weitergegeben).
  if ((next.fish?.[seat]?.length ?? 0) > (prev.fish?.[seat]?.length ?? 0)) out.push('myFish');
  if (next.anchor === seat && prev.anchor !== seat && prev.anchor !== undefined) out.push(isEnemy(prev.anchor) ? 'anchorFromEnemy' : 'myAnchor');

  // Flussläufe: Brücke (eine Straße auf einer Flusskante), allein die meisten Münzen.
  if (next.board.rivers && next.roads.some((r, e) => r !== null && prev.roads[e] === null && isRiverEdge(next, e))) out.push('bridgeBuilt');
  if (next.coins && prev.coins && coinPoints(next, seat) === 1 && coinPoints(prev, seat) !== 1) out.push('myCoinLead');

  // Hafenvogt.
  if (typeof next.harborMaster === 'number' && next.harborMaster !== prev.harborMaster) {
    if (next.harborMaster === seat) out.push('myHarborMaster');
    else if (isEnemy(next.harborMaster)) out.push('enemyHarborMaster');
  }

  // Duell: Ein Gegner setzt eine neutrale Figur an eine meiner Straßen.
  if (isEnemy(next.current)) {
    const neutral = (s: number | null | undefined) => typeof s === 'number' && !!next.players[s]?.neutral;
    const myCorners = new Set(next.roads.flatMap((r, e) => (r === seat ? [topo.edges[e].a, topo.edges[e].b] : [])));
    const blockingRoad = next.roads.some((r, e) => neutral(r) && prev.roads[e] === null && (myCorners.has(topo.edges[e].a) || myCorners.has(topo.edges[e].b)));
    const blockingTown = next.buildings.some((b, v) => b && neutral(b.owner) && !prev.buildings[v] && myCorners.has(v));
    if (blockingRoad || blockingTown) out.push('neutralBlocks');
  }
  return out;
}
