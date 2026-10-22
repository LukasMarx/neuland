import { generateBoard, getTopology, vertexHarbors } from './board';
import { mapById, mapFits } from './maps';
import { DICE_DECK, DICE_DECK_RESHUFFLE, HARBOR_MASTER_POINTS, VariantId } from './variants';
import { randomInt, RngState, shuffle } from './rng';
import {
  Action,
  COSTS,
  DEV_CARD_NAMES,
  DevCard,
  emptyResources,
  formatResources,
  GameSettings,
  GameState,
  hasResources,
  PIECE_LIMITS,
  PlayerState,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  ReturnPhase,
  totalResources,
  TransferPoint,
} from './types';

export class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

const DEV_DECK: Record<'base' | 'ext', Record<DevCard, number>> = {
  base: { knight: 14, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2, victoryPoint: 5 },
  ext: { knight: 20, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3, victoryPoint: 5 },
};

const MAX_LOG = 200;

export interface NewPlayer {
  id: string;
  name: string;
  color: string;
}

export function createGame(players: NewPlayer[], settings: GameSettings, seed: number): GameState {
  if (players.length < 2 || players.length > 6) fail('Es werden 2 bis 6 Spieler benötigt.');
  const map = mapById(settings.map);
  if (!mapFits(map, players.length)) fail(`${map.name} ist für ${map.players[0]}–${map.players[1]} Spieler.`);
  const rng: RngState = { rng: seed | 0 };
  const { board, robber, bank: bankSize, pirate } = generateBoard(map.id, players.length, rng);
  const topo = getTopology(board);
  const seated = shuffle(rng, players);
  const n = seated.length;
  const deck = shuffle(
    rng,
    Object.entries(DEV_DECK[n > 4 ? 'ext' : 'base']).flatMap(([card, count]) => Array<DevCard>(count).fill(card as DevCard)),
  );
  const bank = emptyResources();
  for (const r of RESOURCES) bank[r] = bankSize;

  const state: GameState = {
    version: 0,
    rng: rng.rng,
    settings,
    board,
    players: seated.map(
      (p): PlayerState => ({
        ...p,
        resources: emptyResources(),
        devCards: [],
        newDevCards: [],
        knights: 0,
      }),
    ),
    bank,
    devDeck: deck,
    buildings: topo.vertices.map(() => null),
    roads: topo.edges.map(() => null),
    robber,
    current: 0,
    turn: 0,
    phase: {
      kind: 'setup',
      order: [...Array(n).keys(), ...[...Array(n).keys()].reverse()],
      index: 0,
      step: 'settlement',
      settlement: null,
    },
    dice: null,
    devPlayed: false,
    longestRoad: null,
    roadLengths: seated.map(() => 0),
    largestArmy: null,
    offers: [],
    nextOfferId: 1,
    log: [],
    transfers: [],
    winner: null,
  };
  if (hasVariant(state, 'hafenvogt')) state.harborMaster = null;
  if (map.seafaring) {
    state.ships = topo.edges.map(() => null);
    state.pirate = pirate;
    state.shipsBuilt = [];
    state.shipMoved = false;
    state.islandBonus = state.players.map(() => 0);
  }
  if (hasVariant(state, 'wuerfelstapel')) state.diceDeck = { ...DICE_DECK };
  log(state, null, `Spiel gestartet mit ${n} Spielern. ${seated[0].name} beginnt mit der Aufbauphase.`);
  return state;
}

/** Wendet eine Aktion an und liefert einen neuen Spielstand. Wirft RuleError bei ungültigen Zügen. */
export function applyAction(prev: GameState, seat: number, action: Action): GameState {
  if (prev.phase.kind === 'ended') fail('Das Spiel ist vorbei.');
  if (!prev.players[seat]) fail('Unbekannter Spieler.');
  if (!Object.hasOwn(HANDLERS, action?.type)) fail('Unbekannte Aktion.');
  const s = structuredClone(prev);
  s.transfers = [];
  // Ein Handler meldet `false`, wenn die Aktion nichts geändert hat: dann keine neue Version.
  if (HANDLERS[action.type](s, seat, action as never) === false) return prev;
  s.version = prev.version + 1;
  checkWinner(s);
  return s;
}

type Handler<T extends Action['type']> = (s: GameState, seat: number, action: Extract<Action, { type: T }>) => void | boolean;

const HANDLERS: { [T in Action['type']]: Handler<T> } = {
  placeSettlement(s, seat, { vertex }) {
    const phase = s.phase;
    if (phase.kind !== 'setup' || phase.step !== 'settlement') fail('Jetzt wird keine Siedlung gesetzt.');
    if (phase.order[phase.index] !== seat) fail('Du bist nicht dran.');
    if (!legalSetupVertices(s).includes(vertex)) fail('Hier darf keine Siedlung stehen.');
    s.buildings[vertex] = { owner: seat, type: 'settlement' };
    const secondRound = phase.index >= s.players.length;
    let text = `${name(s, seat)} setzt eine Siedlung.`;
    if (secondRound) {
      const gained = emptyResources();
      for (const h of getTopology(s.board).vertices[vertex].hexes) {
        const terrain = s.board.hexes[h].terrain;
        // Gold liefert in der Aufstellung den Rohstoff, von dem die Bank am meisten hat.
        const r = terrain === 'gold' ? [...RESOURCES].sort((a, b) => s.bank[b] - s.bank[a])[0] : terrain;
        if (isResource(r) && s.bank[r] > 0) {
          s.bank[r]--;
          gained[r]++;
          transfer(s, { kind: 'hex', id: h }, seatPoint(seat), r, 1);
        }
      }
      addTo(s.players[seat].resources, gained);
      text = `${name(s, seat)} setzt eine Siedlung und erhält ${formatResources(gained)}.`;
    }
    s.phase = { ...phase, step: 'road', settlement: vertex };
    updateLongestRoad(s);
    log(s, seat, text);
    updateHarborMaster(s);
  },

  placeRoad(s, seat, { edge }) {
    const phase = s.phase;
    if (phase.kind !== 'setup' || phase.step !== 'road') fail('Jetzt wird keine Straße gesetzt.');
    if (phase.order[phase.index] !== seat) fail('Du bist nicht dran.');
    const e = getTopology(s.board).edges[edge];
    if (!e || s.roads[edge] !== null) fail('Hier ist kein Platz für eine Straße.');
    if (e.a !== phase.settlement && e.b !== phase.settlement) fail('Die Straße muss an deine neue Siedlung grenzen.');
    if (!edgeTouchesLand(s, edge)) fail('Straßen liegen an Land.');
    s.roads[edge] = seat;
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut eine Straße.`);
    const index = phase.index + 1;
    if (index >= phase.order.length) {
      s.current = 0;
      s.turn = 1;
      s.phase = { kind: 'roll' };
      log(s, null, `Die Aufbauphase ist vorbei. ${name(s, 0)} ist am Zug.`);
    } else {
      s.current = phase.order[index];
      s.phase = { ...phase, index, step: 'settlement', settlement: null };
    }
  },

  roll(s, seat) {
    requireTurn(s, seat, 'roll');
    const dice = s.diceDeck ? drawDiceCard(s) : ([randomInt(s, 6) + 1, randomInt(s, 6) + 1] as [number, number]);
    s.dice = dice;
    const sum = dice[0] + dice[1];
    log(s, seat, `${name(s, seat)} würfelt ${sum} (${dice[0]} + ${dice[1]}).`);
    if (sum === 7) {
      const pending = s.players.map((p) => {
        const total = totalResources(p.resources);
        return total > 7 ? Math.floor(total / 2) : 0;
      });
      if (pending.some((n) => n > 0)) {
        s.phase = { kind: 'discard', pending };
        const who = pending.flatMap((n, i) => (n > 0 ? [`${name(s, i)} (${n})`] : []));
        log(s, null, `Räuber! Karten abwerfen müssen: ${who.join(', ')}.`);
      } else {
        s.phase = { kind: 'robber', returnTo: 'main' };
      }
      return;
    }
    const gold = produce(s, sum);
    s.phase = gold.some((n) => n > 0) ? { kind: 'gold', pending: gold } : { kind: 'main' };
  },

  chooseGold(s, seat, { resources }) {
    const phase = s.phase;
    if (phase.kind !== 'gold') fail('Gerade gibt es kein Gold zu verteilen.');
    const due = phase.pending[seat];
    if (!due) fail('Du bekommst gerade kein Gold.');
    validateCounts(resources);
    if (totalResources(resources) !== due) fail(`Wähle genau ${due} Rohstoffe.`);
    if (!hasResources(s.bank, resources)) fail('Die Bank hat diese Rohstoffe nicht mehr.');
    takeFrom(s.bank, resources);
    addTo(s.players[seat].resources, resources);
    transferAll(s, BANK, seatPoint(seat), resources);
    phase.pending[seat] = 0;
    log(s, seat, `${name(s, seat)} wählt aus dem Gold ${formatResources(resources)}.`);
    if (phase.pending.every((n) => n === 0)) s.phase = { kind: 'main' };
  },

  discard(s, seat, { resources }) {
    const phase = s.phase;
    if (phase.kind !== 'discard') fail('Jetzt wird nichts abgeworfen.');
    const due = phase.pending[seat];
    if (!due) fail('Du musst nichts abwerfen.');
    validateCounts(resources);
    if (totalResources(resources) !== due) fail(`Du musst genau ${due} Karten abwerfen.`);
    const player = s.players[seat];
    if (!hasResources(player.resources, resources)) fail('So viele Karten hast du nicht.');
    takeFrom(player.resources, resources);
    addTo(s.bank, resources);
    transferAll(s, seatPoint(seat), BANK, resources);
    phase.pending[seat] = 0;
    log(s, seat, `${name(s, seat)} wirft ${due} Karten ab.`);
    if (phase.pending.every((n) => n === 0)) s.phase = { kind: 'robber', returnTo: 'main' };
  },

  moveRobber(s, seat, { hex, victim }) {
    const phase = s.phase;
    if (phase.kind !== 'robber') fail('Der Räuber wird gerade nicht versetzt.');
    if (seat !== s.current) fail('Du bist nicht dran.');
    if (!s.board.hexes[hex]) fail('Unbekanntes Feld.');
    const pirate = s.board.hexes[hex].terrain === 'sea';
    if (pirate && s.pirate === undefined) fail('Auf diesem Brett gibt es kein Kaperschiff.');
    if (hex === (pirate ? s.pirate : s.robber)) fail(pirate ? 'Das Kaperschiff muss auf ein anderes Feld.' : 'Der Räuber muss auf ein anderes Feld.');
    if (!legalRobberHexes(s).includes(hex)) fail('Milder Räuber: Dort stehen Spieler mit höchstens 2 Siegpunkten.');
    const candidates = robberVictims(s, seat, hex);
    if (pirate) s.pirate = hex;
    else s.robber = hex;
    if (candidates.length > 0) {
      if (victim === null || !candidates.includes(victim)) fail('Wähle einen Spieler, bei dem du ziehst.');
      const pool = RESOURCES.flatMap((r) => Array<Resource>(s.players[victim].resources[r]).fill(r));
      const stolen = pool[randomInt(s, pool.length)];
      s.players[victim].resources[stolen]--;
      s.players[seat].resources[stolen]++;
      s.transfers.push({ from: seatPoint(victim), to: seatPoint(seat), card: stolen, count: 1, hidden: true });
      log(s, seat, `${name(s, seat)} versetzt ${pirate ? 'das Kaperschiff' : 'den Räuber'} und zieht eine Karte bei ${name(s, victim)}.`);
    } else {
      log(s, seat, `${name(s, seat)} versetzt ${pirate ? 'das Kaperschiff' : 'den Räuber'}.`);
    }
    s.phase = { kind: phase.returnTo };
  },

  buildRoad(s, seat, { edge }) {
    const phase = s.phase;
    if (phase.kind === 'roadBuilding') {
      if (seat !== s.current) fail('Du bist nicht dran.');
      if (!canBuildRoad(s, seat, edge)) fail('Hier kannst du keine Straße bauen.');
      s.roads[edge] = seat;
      updateLongestRoad(s);
      log(s, seat, `${name(s, seat)} baut eine Straße (Straßenbau).`);
      continueRoadBuilding(s, seat);
      return;
    }
    requireBuilder(s, seat);
    if (piecesLeft(s, seat, 'road') <= 0) fail('Du hast keine Straßen mehr.');
    if (!canBuildRoad(s, seat, edge)) fail('Hier kannst du keine Straße bauen.');
    pay(s, seat, COSTS.road, { kind: 'edge', id: edge });
    s.roads[edge] = seat;
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut eine Straße.`);
  },

  buildSettlement(s, seat, { vertex }) {
    requireBuilder(s, seat);
    if (piecesLeft(s, seat, 'settlement') <= 0) fail('Du hast keine Siedlungen mehr.');
    if (!canBuildSettlement(s, seat, vertex)) fail('Hier kannst du keine Siedlung bauen.');
    pay(s, seat, COSTS.settlement, { kind: 'vertex', id: vertex });
    const newIsland = s.islandBonus ? !ownsOnIsland(s, seat, vertex) : false;
    s.buildings[vertex] = { owner: seat, type: 'settlement' };
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut eine Siedlung.`);
    updateHarborMaster(s);
    if (newIsland) {
      const bonus = mapById(s.board.map).seafaring?.islandBonus ?? 0;
      s.islandBonus![seat] += bonus;
      if (bonus) log(s, seat, `${name(s, seat)} besiedelt eine neue Insel und bekommt ${bonus} Siegpunkte.`);
    }
  },

  buildCity(s, seat, { vertex }) {
    requireBuilder(s, seat);
    if (piecesLeft(s, seat, 'city') <= 0) fail('Du hast keine Städte mehr.');
    const b = s.buildings[vertex];
    if (!b || b.owner !== seat || b.type !== 'settlement') fail('Eine Stadt kann nur auf eigene Siedlungen.');
    pay(s, seat, COSTS.city, { kind: 'vertex', id: vertex });
    b.type = 'city';
    log(s, seat, `${name(s, seat)} baut eine Stadt.`);
    updateHarborMaster(s);
  },

  buyDevCard(s, seat) {
    requireBuilder(s, seat);
    if (s.devDeck.length === 0) fail('Es gibt keine Entwicklungskarten mehr.');
    pay(s, seat, COSTS.devCard);
    // Zufällig ziehen statt von oben: Die Reihenfolge im Spielstand verrät so nichts.
    const [card] = s.devDeck.splice(randomInt(s, s.devDeck.length), 1);
    s.players[seat].newDevCards.push(card);
    transfer(s, BANK, seatPoint(seat), 'dev', 1);
    log(s, seat, `${name(s, seat)} kauft eine Entwicklungskarte.`);
  },

  playKnight(s, seat) {
    const returnTo = playDevCard(s, seat, 'knight');
    const player = s.players[seat];
    player.knights++;
    const holder = s.largestArmy;
    if (player.knights >= 3 && holder !== seat && (holder === null || player.knights > s.players[holder].knights)) {
      s.largestArmy = seat;
      log(s, seat, `${name(s, seat)} hat jetzt die größte Rittermacht.`);
    }
    s.phase = { kind: 'robber', returnTo };
  },

  playRoadBuilding(s, seat) {
    const remaining = Math.min(2, piecesLeft(s, seat, 'road') + (s.ships ? piecesLeft(s, seat, 'ship') : 0));
    if (remaining === 0 || !canLayFreePiece(s, seat)) fail('Du kannst gerade keine Straße bauen.');
    const returnTo = playDevCard(s, seat, 'roadBuilding');
    s.phase = { kind: 'roadBuilding', remaining, returnTo };
  },

  playYearOfPlenty(s, seat, { resources }) {
    if (!Array.isArray(resources) || resources.length !== 2) fail('Wähle genau zwei Rohstoffe.');
    const need = emptyResources();
    for (const r of resources) {
      if (!RESOURCES.includes(r)) fail('Unbekannter Rohstoff.');
      need[r]++;
    }
    if (!hasResources(s.bank, need)) fail('Die Bank hat diese Rohstoffe nicht mehr.');
    playDevCard(s, seat, 'yearOfPlenty');
    takeFrom(s.bank, need);
    addTo(s.players[seat].resources, need);
    transferAll(s, BANK, seatPoint(seat), need);
    log(s, seat, `${name(s, seat)} nimmt sich ${formatResources(need)} (Erfindung).`);
  },

  playMonopoly(s, seat, { resource }) {
    if (!RESOURCES.includes(resource)) fail('Unbekannter Rohstoff.');
    playDevCard(s, seat, 'monopoly');
    let total = 0;
    s.players.forEach((p, i) => {
      if (i === seat) return;
      total += p.resources[resource];
      transfer(s, seatPoint(i), seatPoint(seat), resource, p.resources[resource]);
      p.resources[resource] = 0;
    });
    s.players[seat].resources[resource] += total;
    log(s, seat, `${name(s, seat)} spielt Monopol auf ${RESOURCE_NAMES[resource]} und bekommt ${total} Karten.`);
  },

  bankTradeBatch(s, seat, { give, get }) {
    requireTurn(s, seat, 'main');
    validateCounts(give);
    validateCounts(get);
    if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) fail('Derselbe Rohstoff kann nicht auf beiden Seiten stehen.');
    // Jedes Kurs-Paket bringt eine Karte; erst prüfen, dann einzeln tauschen (bei einem Fehler bleibt nichts halb).
    const lots = RESOURCES.flatMap((r) => {
      const rate = tradeRate(s, seat, r);
      if (give[r] % rate) fail(`${RESOURCE_NAMES[r]} tauschst du ${rate}:1.`);
      return Array<Resource>(give[r] / rate).fill(r);
    });
    const wanted = RESOURCES.flatMap((r) => Array<Resource>(get[r]).fill(r));
    if (!lots.length || lots.length !== wanted.length) fail('Das passt nicht zum Kurs der Bank.');
    lots.forEach((r, i) => HANDLERS.bankTrade(s, seat, { type: 'bankTrade', give: r, get: wanted[i] }));
  },

  bankTrade(s, seat, { give, get }) {
    requireTurn(s, seat, 'main');
    if (!RESOURCES.includes(give) || !RESOURCES.includes(get) || give === get) fail('Ungültiger Tausch.');
    const rate = tradeRate(s, seat, give);
    const player = s.players[seat];
    if (player.resources[give] < rate) fail(`Du brauchst ${rate} ${RESOURCE_NAMES[give]}.`);
    if (s.bank[get] < 1) fail(`Die Bank hat kein ${RESOURCE_NAMES[get]} mehr.`);
    player.resources[give] -= rate;
    s.bank[give] += rate;
    s.bank[get]--;
    player.resources[get]++;
    transfer(s, seatPoint(seat), BANK, give, rate);
    transfer(s, BANK, seatPoint(seat), get, 1);
    log(s, seat, `${name(s, seat)} tauscht ${rate} ${RESOURCE_NAMES[give]} gegen 1 ${RESOURCE_NAMES[get]} mit der Bank.`);
  },

  offerTrade(s, seat, { give, want }) {
    if (s.phase.kind !== 'main') fail('Gehandelt wird nach dem Würfeln.');
    validateCounts(give);
    validateCounts(want);
    if (totalResources(give) === 0 || totalResources(want) === 0) fail('Ein Angebot braucht beide Seiten.');
    if (RESOURCES.some((r) => give[r] > 0 && want[r] > 0)) fail('Derselbe Rohstoff kann nicht auf beiden Seiten stehen.');
    if (!hasResources(s.players[seat].resources, give)) fail('Du hast diese Rohstoffe nicht.');
    const counter = seat !== s.current;
    s.offers = s.offers.filter((o) => o.from !== seat);
    s.offers.push({ id: s.nextOfferId++, from: seat, give: pick(give), want: pick(want), counter, accepted: [], declined: [] });
    const target = counter ? ` an ${name(s, s.current)}` : '';
    log(s, seat, `${name(s, seat)} bietet${target} ${formatResources(give)} gegen ${formatResources(want)}.`);
  },

  respondTrade(s, seat, { offerId, accept }) {
    if (s.phase.kind !== 'main') fail('Gehandelt wird nach dem Würfeln.');
    const offer = s.offers.find((o) => o.id === offerId);
    if (!offer || offer.counter) fail('Dieses Angebot gibt es nicht mehr.');
    if (offer.from === seat) fail('Das ist dein eigenes Angebot.');
    if (accept && !hasResources(s.players[seat].resources, offer.want)) fail('Dafür fehlen dir die Rohstoffe.');
    offer.accepted = offer.accepted.filter((p) => p !== seat);
    offer.declined = offer.declined.filter((p) => p !== seat);
    (accept ? offer.accepted : offer.declined).push(seat);
  },

  confirmTrade(s, seat, { offerId, partner }) {
    if (s.phase.kind !== 'main') fail('Gehandelt wird nach dem Würfeln.');
    if (seat !== s.current) fail('Nur der aktive Spieler schließt Handel ab.');
    const offer = s.offers.find((o) => o.id === offerId);
    if (!offer) fail('Dieses Angebot gibt es nicht mehr.');
    if (offer.counter ? offer.from !== partner : offer.from !== seat || !offer.accepted.includes(partner)) {
      fail('Dieser Spieler hat das Angebot nicht angenommen.');
    }
    const from = s.players[offer.from];
    const to = s.players[offer.counter ? seat : partner];
    if (!hasResources(from.resources, offer.give) || !hasResources(to.resources, offer.want)) {
      fail('Einem der beiden fehlen die Rohstoffe.');
    }
    takeFrom(from.resources, offer.give);
    addTo(to.resources, offer.give);
    takeFrom(to.resources, offer.want);
    addTo(from.resources, offer.want);
    const toSeat = offer.counter ? seat : partner;
    transferAll(s, seatPoint(offer.from), seatPoint(toSeat), offer.give);
    transferAll(s, seatPoint(toSeat), seatPoint(offer.from), offer.want);
    // Nach einem Tausch haben sich die Hände geändert: alle übrigen Angebote verfallen.
    s.offers = [];
    const other = offer.counter ? seat : partner;
    log(s, seat, `${name(s, offer.from)} und ${name(s, other)} handeln: ${formatResources(offer.give)} gegen ${formatResources(offer.want)}.`);
  },

  cancelTrade(s, seat, { offerId }) {
    const offer = s.offers.find((o) => o.id === offerId);
    if (!offer) return false;
    if (offer.from !== seat && !(offer.counter && seat === s.current)) fail('Das ist nicht dein Angebot.');
    s.offers = s.offers.filter((o) => o.id !== offerId);
    return true;
  },

  withdrawOffers(s, seat) {
    const keep = s.offers.filter((o) => o.from !== seat && !(o.counter && seat === s.current));
    if (keep.length === s.offers.length) return false;
    s.offers = keep;
    return true;
  },

  buildShip(s, seat, { edge }) {
    if (!s.ships) fail('Auf diesem Brett gibt es keine Schiffe.');
    const phase = s.phase;
    const free = phase.kind === 'roadBuilding';
    if (free) {
      if (seat !== s.current) fail('Du bist nicht dran.');
    } else {
      requireBuilder(s, seat);
    }
    if (piecesLeft(s, seat, 'ship') <= 0) fail('Du hast keine Schiffe mehr.');
    if (!canBuildShip(s, seat, edge)) fail('Hier kannst du kein Schiff bauen.');
    if (!free) pay(s, seat, COSTS.ship, { kind: 'edge', id: edge });
    s.ships[edge] = seat;
    s.shipsBuilt = [...(s.shipsBuilt ?? []), edge];
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut ein Schiff.`);
    if (free) continueRoadBuilding(s, seat);
  },

  moveShip(s, seat, { from, to }) {
    if (!s.ships) fail('Auf diesem Brett gibt es keine Schiffe.');
    requireTurn(s, seat, 'main');
    if (s.shipMoved) fail('Du hast in diesem Zug schon ein Schiff versetzt.');
    if (!movableShips(s, seat).includes(from)) fail('Dieses Schiff kann nicht versetzt werden.');
    s.ships[from] = null;
    if (to === from || !canBuildShip(s, seat, to)) fail('Dorthin kann das Schiff nicht.');
    s.ships[to] = seat;
    s.shipMoved = true;
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} versetzt ein Schiff.`);
  },

  endTurn(s, seat) {
    const phase = s.phase;
    if (phase.kind === 'specialBuild') {
      if (phase.queue[0] !== seat) fail('Du bist nicht dran.');
      continueSpecialBuild(s, phase.queue.slice(1));
      return;
    }
    requireTurn(s, seat, 'main');
    s.offers = [];
    if (s.players.length > 4) {
      const n = s.players.length;
      const queue = Array.from({ length: n - 1 }, (_, i) => (s.current + 1 + i) % n);
      continueSpecialBuild(s, queue);
    } else {
      nextTurn(s);
    }
  },
};

// ---------------------------------------------------------------------------
// Abfragen für Host und Oberfläche

export function actingSeats(s: GameState): number[] {
  const phase = s.phase;
  switch (phase.kind) {
    case 'setup':
      return [phase.order[phase.index]];
    case 'discard':
    case 'gold':
      return phase.pending.flatMap((n, i) => (n > 0 ? [i] : []));
    case 'specialBuild':
      return [phase.queue[0]];
    case 'ended':
      return [];
    default:
      return [s.current];
  }
}

export function victoryPoints(s: GameState, seat: number, includeHidden: boolean): number {
  let vp = 0;
  for (const b of s.buildings) if (b?.owner === seat) vp += b.type === 'city' ? 2 : 1;
  if (s.longestRoad === seat) vp += 2;
  if (s.largestArmy === seat) vp += 2;
  if (s.harborMaster === seat) vp += 2;
  vp += s.islandBonus?.[seat] ?? 0;
  if (includeHidden) {
    const p = s.players[seat];
    vp += [...p.devCards, ...p.newDevCards].filter((c) => c === 'victoryPoint').length;
  }
  return vp;
}

export function isFreeForSettlement(s: GameState, vertex: number): boolean {
  const v = getTopology(s.board).vertices[vertex];
  return (
    !!v &&
    s.buildings[vertex] === null &&
    v.neighbors.every((n) => s.buildings[n] === null) &&
    v.hexes.some((h) => s.board.hexes[h].terrain !== 'sea')
  );
}

export function canBuildSettlement(s: GameState, seat: number, vertex: number): boolean {
  if (!isFreeForSettlement(s, vertex)) return false;
  // Anschluss über eine eigene Straße oder, bei Seewege, über ein eigenes Schiff.
  return getTopology(s.board).vertices[vertex].edges.some((e) => s.roads[e] === seat || s.ships?.[e] === seat);
}

export function canBuildRoad(s: GameState, seat: number, edge: number): boolean {
  const topo = getTopology(s.board);
  const e = topo.edges[edge];
  if (!e || s.roads[edge] !== null || s.ships?.[edge] != null || !edgeTouchesLand(s, edge)) return false;
  return [e.a, e.b].some((v) => {
    const b = s.buildings[v];
    if (b?.owner === seat) return true;
    if (b) return false;
    return topo.vertices[v].edges.some((other) => other !== edge && s.roads[other] === seat);
  });
}

export function legalSetupVertices(s: GameState): number[] {
  const topo = getTopology(s.board);
  // Seewege „Erste Überfahrt“: Startsiedlungen nur auf der größten Insel.
  let home: number | null = null;
  if (mapById(s.board.map).seafaring?.setup === 'largest') {
    const sizes = new Map<number, number>();
    for (const id of topo.islands) if (id >= 0) sizes.set(id, (sizes.get(id) ?? 0) + 1);
    home = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  }
  return topo.vertices
    .filter((v) => isFreeForSettlement(s, v.id) && (home === null || v.hexes.some((h) => topo.islands[h] === home)))
    .map((v) => v.id);
}

export function legalSetupRoads(s: GameState): number[] {
  const phase = s.phase;
  if (phase.kind !== 'setup' || phase.settlement === null) return [];
  return getTopology(s.board).vertices[phase.settlement].edges.filter((e) => s.roads[e] === null && edgeTouchesLand(s, e));
}

export function legalSettlementVertices(s: GameState, seat: number): number[] {
  return getTopology(s.board).vertices.filter((v) => canBuildSettlement(s, seat, v.id)).map((v) => v.id);
}

export function legalRoadEdges(s: GameState, seat: number): number[] {
  return getTopology(s.board).edges.filter((e) => canBuildRoad(s, seat, e.id)).map((e) => e.id);
}

/** Seewege: Kanten, an denen ein Schiff gebaut werden darf. */
export function legalShipEdges(s: GameState, seat: number): number[] {
  if (!s.ships) return [];
  return getTopology(s.board).edges.filter((e) => canBuildShip(s, seat, e.id)).map((e) => e.id);
}

/**
 * Ein Schiff liegt an einer Kante mit Meer, schließt an ein eigenes Gebäude oder Schiff an
 * (der Übergang von Straße zu Schiff geht nur über ein Gebäude) und nicht am Kaperschiff.
 */
export function canBuildShip(s: GameState, seat: number, edge: number): boolean {
  if (!s.ships) return false;
  const topo = getTopology(s.board);
  const e = topo.edges[edge];
  if (!e || s.roads[edge] !== null || s.ships[edge] !== null) return false;
  if (!e.hexes.some((h) => s.board.hexes[h].terrain === 'sea')) return false;
  if (s.pirate != null && e.hexes.includes(s.pirate)) return false;
  return [e.a, e.b].some((v) => {
    const b = s.buildings[v];
    if (b?.owner === seat) return true;
    if (b) return false;
    return topo.vertices[v].edges.some((other) => other !== edge && s.ships![other] === seat);
  });
}

/**
 * Schiffe, die man versetzen darf: am offenen Ende einer Schiffslinie (eine Ecke ohne eigenes
 * Gebäude und ohne weiteres eigenes Schiff), nicht in diesem Zug gebaut, nicht am Kaperschiff.
 */
export function movableShips(s: GameState, seat: number): number[] {
  if (!s.ships || s.shipMoved) return [];
  const topo = getTopology(s.board);
  return s.ships.flatMap((owner, edge) => {
    if (owner !== seat || s.shipsBuilt?.includes(edge)) return [];
    const e = topo.edges[edge];
    if (s.pirate != null && e.hexes.includes(s.pirate)) return [];
    const open = [e.a, e.b].some(
      (v) => s.buildings[v]?.owner !== seat && !topo.vertices[v].edges.some((o) => o !== edge && s.ships![o] === seat),
    );
    return open ? [edge] : [];
  });
}

export function legalCityVertices(s: GameState, seat: number): number[] {
  return s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'settlement' ? [v] : []));
}

export function robberVictims(s: GameState, seat: number, hex: number): number[] {
  const victims = new Set<number>();
  const topo = getTopology(s.board);
  // Das Kaperschiff zieht bei allen, die ein Schiff an diesem Meerfeld haben.
  if (s.board.hexes[hex].terrain === 'sea') {
    for (const e of topo.hexes[hex].edges) {
      const owner = s.ships?.[e];
      if (owner != null && owner !== seat && totalResources(s.players[owner].resources) > 0) victims.add(owner);
    }
    return [...victims];
  }
  for (const v of topo.hexes[hex].corners) {
    const b = s.buildings[v];
    if (b && b.owner !== seat && totalResources(s.players[b.owner].resources) > 0) victims.add(b.owner);
  }
  return [...victims];
}

export function hasVariant(s: Pick<GameState, 'settings'>, id: VariantId): boolean {
  return s.settings.variants?.includes(id) ?? false;
}

/**
 * Felder, auf die der Räuber darf: jedes andere Feld. Mit dem milden Räuber keines, an dem ein Spieler
 * mit höchstens 2 sichtbaren Siegpunkten baut; bleibt dann nichts, darf er in die Wüste.
 */
export function legalRobberHexes(s: GameState): number[] {
  const sea = (id: number) => s.board.hexes[id].terrain === 'sea';
  // Seewege: Statt des Räubers darf man das Kaperschiff auf ein anderes Meerfeld setzen.
  const pirateHexes = s.pirate !== undefined ? s.board.hexes.map((_, id) => id).filter((id) => sea(id) && id !== s.pirate) : [];
  return [...landRobberHexes(s), ...pirateHexes];
}

function landRobberHexes(s: GameState): number[] {
  const others = s.board.hexes.map((_, id) => id).filter((id) => id !== s.robber && s.board.hexes[id].terrain !== 'sea');
  if (!hasVariant(s, 'milderRaeuber')) return others;
  const topo = getTopology(s.board);
  const protectedSeat = s.players.map((_, seat) => victoryPoints(s, seat, false) <= 2);
  const allowed = others.filter((id) => topo.hexes[id].corners.every((v) => !s.buildings[v] || !protectedSeat[s.buildings[v]!.owner]));
  if (allowed.length) return allowed;
  const deserts = others.filter((id) => s.board.hexes[id].terrain === 'desert');
  return deserts.length ? deserts : others;
}

/** Hafenpunkte (Hafenvogt): Siedlung an einem Hafen 1, Stadt 2. */
export function harborPoints(s: GameState, seat: number): number {
  const harbors = vertexHarbors(s.board);
  return s.buildings.reduce((n, b, v) => (b?.owner === seat && harbors[v] ? n + (b.type === 'city' ? 2 : 1) : n), 0);
}

function updateHarborMaster(s: GameState): void {
  if (!hasVariant(s, 'hafenvogt')) return;
  const points = s.players.map((_, seat) => harborPoints(s, seat));
  const holder = s.harborMaster ?? null;
  const max = Math.max(...points);
  let next = holder;
  if (max >= HARBOR_MASTER_POINTS && (holder === null || max > points[holder])) {
    const leaders = points.flatMap((p, seat) => (p === max ? [seat] : []));
    if (leaders.length === 1) next = leaders[0];
  }
  if (next !== holder && next !== null) {
    s.harborMaster = next;
    log(s, next, `${name(s, next)} ist jetzt Hafenvogt (${points[next]} Hafenpunkte).`);
  }
}

/** Würfelstapel: eine Karte ziehen; kurz vor dem Ende wird der ganze Stapel neu gemischt. */
function drawDiceCard(s: GameState): [number, number] {
  let deck = s.diceDeck!;
  if (Object.values(deck).reduce((a, b) => a + b, 0) <= DICE_DECK_RESHUFFLE) {
    deck = { ...DICE_DECK };
    log(s, null, 'Der Würfelstapel wird neu gemischt.');
  }
  const cards = Object.entries(deck).flatMap(([sum, n]) => Array<number>(n).fill(Number(sum)));
  const sum = cards[randomInt(s, cards.length)];
  s.diceDeck = { ...deck, [sum]: deck[sum] - 1 };
  // Passende Einzelwerte, damit die Würfelanzeige stimmt.
  const low = Math.max(1, sum - 6);
  const first = low + randomInt(s, Math.min(6, sum - 1) - low + 1);
  return [first, sum - first];
}

export function tradeRate(s: GameState, seat: number, give: Resource): number {
  const harbors = vertexHarbors(s.board);
  let rate = 4;
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat) return;
    if (harbors[v] === give) rate = Math.min(rate, 2);
    else if (harbors[v] === 'any') rate = Math.min(rate, 3);
  });
  return rate;
}

export function piecesLeft(s: GameState, seat: number, piece: 'road' | 'settlement' | 'city' | 'ship'): number {
  const used =
    piece === 'road'
      ? s.roads.filter((r) => r === seat).length
      : piece === 'ship'
        ? (s.ships ?? []).filter((r) => r === seat).length
        : s.buildings.filter((b) => b?.owner === seat && b.type === piece).length;
  return PIECE_LIMITS[piece] - used;
}

function isResource(t: string): t is Resource {
  return (RESOURCES as readonly string[]).includes(t);
}

function edgeTouchesLand(s: GameState, edge: number): boolean {
  return getTopology(s.board).edges[edge].hexes.some((h) => s.board.hexes[h].terrain !== 'sea');
}

/** Hat der Spieler schon ein Gebäude auf der Insel dieser Ecke? */
function ownsOnIsland(s: GameState, seat: number, vertex: number): boolean {
  const topo = getTopology(s.board);
  const islandOf = (v: number) => topo.vertices[v].hexes.map((h) => topo.islands[h]).find((i) => i >= 0) ?? -1;
  const island = islandOf(vertex);
  return s.buildings.some((b, v) => b?.owner === seat && islandOf(v) === island);
}

/** Straßenbau-Karte: Gibt es noch eine kostenlose Straße oder ein Schiff zu legen? */
function canLayFreePiece(s: GameState, seat: number): boolean {
  return (
    (piecesLeft(s, seat, 'road') > 0 && legalRoadEdges(s, seat).length > 0) ||
    (piecesLeft(s, seat, 'ship') > 0 && legalShipEdges(s, seat).length > 0)
  );
}

function continueRoadBuilding(s: GameState, seat: number): void {
  const phase = s.phase;
  if (phase.kind !== 'roadBuilding') return;
  const remaining = phase.remaining - 1;
  s.phase = remaining > 0 && canLayFreePiece(s, seat) ? { ...phase, remaining } : { kind: phase.returnTo };
}

/** Kann der Spieler in der Sonderbauphase überhaupt irgendetwas bauen oder kaufen? */
export function canBuildAnything(s: GameState, seat: number): boolean {
  const res = s.players[seat].resources;
  if (hasResources(res, COSTS.devCard) && s.devDeck.length > 0) return true;
  if (hasResources(res, COSTS.city) && piecesLeft(s, seat, 'city') > 0 && legalCityVertices(s, seat).length > 0) return true;
  if (hasResources(res, COSTS.settlement) && piecesLeft(s, seat, 'settlement') > 0 && legalSettlementVertices(s, seat).length > 0) return true;
  if (s.ships && hasResources(res, COSTS.ship) && piecesLeft(s, seat, 'ship') > 0 && legalShipEdges(s, seat).length > 0) return true;
  return hasResources(res, COSTS.road) && piecesLeft(s, seat, 'road') > 0 && legalRoadEdges(s, seat).length > 0;
}

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen

function name(s: GameState, seat: number): string {
  return s.players[seat].name;
}

function log(s: GameState, seat: number | null, text: string): void {
  s.log.push({ seat, text });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function addTo(target: ResourceCounts, add: ResourceCounts): void {
  for (const r of RESOURCES) target[r] += add[r];
}

function takeFrom(target: ResourceCounts, take: ResourceCounts): void {
  for (const r of RESOURCES) target[r] -= take[r];
}

/** Nur die Rohstofffelder übernehmen, damit keine fremden Felder im Spielstand landen. */
function pick(r: ResourceCounts): ResourceCounts {
  const result = emptyResources();
  for (const k of RESOURCES) result[k] = r[k];
  return result;
}

function validateCounts(r: ResourceCounts): void {
  if (!r || RESOURCES.some((k) => !Number.isInteger(r[k]) || r[k] < 0)) fail('Ungültige Rohstoffangabe.');
}

/** Bezahlen an die Bank. `to` ist der Bauplatz, zu dem die Karten in der Animation fliegen. */
function pay(s: GameState, seat: number, cost: ResourceCounts, to: TransferPoint = BANK): void {
  const p = s.players[seat];
  if (!hasResources(p.resources, cost)) fail('Dafür fehlen dir die Rohstoffe.');
  takeFrom(p.resources, cost);
  addTo(s.bank, cost);
  transferAll(s, seatPoint(seat), to, cost);
}

const BANK: TransferPoint = { kind: 'bank' };

function seatPoint(seat: number): TransferPoint {
  return { kind: 'player', seat };
}

function transfer(s: GameState, from: TransferPoint, to: TransferPoint, card: Resource | 'dev', count: number): void {
  if (count > 0) s.transfers.push({ from, to, card, count });
}

function transferAll(s: GameState, from: TransferPoint, to: TransferPoint, counts: ResourceCounts): void {
  for (const r of RESOURCES) transfer(s, from, to, r, counts[r]);
}

function requireTurn(s: GameState, seat: number, phase: 'roll' | 'main'): void {
  if (seat !== s.current) fail('Du bist nicht dran.');
  if (s.phase.kind !== phase) fail(phase === 'roll' ? 'Jetzt wird nicht gewürfelt.' : 'Das geht gerade nicht.');
}

function requireBuilder(s: GameState, seat: number): void {
  const phase = s.phase;
  if (phase.kind === 'specialBuild') {
    if (phase.queue[0] !== seat) fail('Du bist in der Sonderbauphase nicht dran.');
    return;
  }
  requireTurn(s, seat, 'main');
}

function playDevCard(s: GameState, seat: number, card: DevCard): ReturnPhase {
  if (seat !== s.current) fail('Du bist nicht dran.');
  const phase = s.phase.kind;
  if (phase !== 'roll' && phase !== 'main') fail('Jetzt kannst du keine Karte spielen.');
  if (s.devPlayed) fail('Du hast in diesem Zug schon eine Entwicklungskarte gespielt.');
  const cards = s.players[seat].devCards;
  const index = cards.indexOf(card);
  if (index < 0) fail(`Du hast keine spielbare Karte „${DEV_CARD_NAMES[card]}“.`);
  cards.splice(index, 1);
  s.devPlayed = true;
  if (card !== 'knight') log(s, seat, `${name(s, seat)} spielt ${DEV_CARD_NAMES[card]}.`);
  else log(s, seat, `${name(s, seat)} spielt einen Ritter.`);
  return phase;
}

/** Verteilt den Ertrag; liefert, wie viele Rohstoffe jeder aus Goldfeldern noch selbst wählt. */
function produce(s: GameState, sum: number): number[] {
  const topo = getTopology(s.board);
  const demand = RESOURCES.map(() => s.players.map(() => 0));
  const gold = s.players.map(() => 0);
  const sources: { hex: number; seat: number; res: Resource; n: number }[] = [];
  s.board.hexes.forEach((hex, id) => {
    const terrain = hex.terrain;
    if (hex.number !== sum || id === s.robber || (!isResource(terrain) && terrain !== 'gold')) return;
    for (const v of topo.hexes[id].corners) {
      const b = s.buildings[v];
      if (!b) continue;
      const n = b.type === 'city' ? 2 : 1;
      if (terrain === 'gold') {
        gold[b.owner] += n;
        continue;
      }
      demand[RESOURCES.indexOf(terrain)][b.owner] += n;
      sources.push({ hex: id, seat: b.owner, res: terrain, n });
    }
  });

  const gained = s.players.map(() => emptyResources());
  RESOURCES.forEach((res, r) => {
    const total = demand[r].reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const receivers = demand[r].flatMap((n, seat) => (n > 0 ? [seat] : []));
    if (total <= s.bank[res]) {
      receivers.forEach((seat) => (gained[seat][res] = demand[r][seat]));
    } else if (receivers.length === 1) {
      gained[receivers[0]][res] = s.bank[res];
    } else {
      log(s, null, `Die Bank hat nicht genug ${RESOURCE_NAMES[res]}, niemand bekommt welches.`);
    }
  });

  // Für die Animation: Karten fliegen von den liefernden Feldern, höchstens so viele wie tatsächlich ausgezahlt.
  const left = gained.map((g) => ({ ...g }));
  for (const { hex, seat, res, n } of sources) {
    const count = Math.min(n, left[seat][res]);
    left[seat][res] -= count;
    transfer(s, { kind: 'hex', id: hex }, seatPoint(seat), res, count);
  }

  gained.forEach((g, seat) => {
    if (totalResources(g) === 0) return;
    takeFrom(s.bank, g);
    addTo(s.players[seat].resources, g);
    log(s, seat, `${name(s, seat)} erhält ${formatResources(g)}.`);
  });
  // Gold: höchstens so viel, wie die Bank noch hat.
  let available = totalResources(s.bank);
  return gold.map((n) => {
    const take = Math.min(n, available);
    available -= take;
    return take;
  });
}

function continueSpecialBuild(s: GameState, queue: number[]): void {
  const remaining = [...queue];
  while (remaining.length > 0 && !canBuildAnything(s, remaining[0])) remaining.shift();
  if (remaining.length === 0) {
    nextTurn(s);
  } else {
    s.phase = { kind: 'specialBuild', queue: remaining };
  }
}

function nextTurn(s: GameState): void {
  for (const p of s.players) {
    p.devCards.push(...p.newDevCards);
    p.newDevCards = [];
  }
  s.current = (s.current + 1) % s.players.length;
  s.turn++;
  s.dice = null;
  s.devPlayed = false;
  s.offers = [];
  if (s.ships) {
    s.shipsBuilt = [];
    s.shipMoved = false;
  }
  s.phase = { kind: 'roll' };
}

function checkWinner(s: GameState): void {
  const kind = s.phase.kind;
  if (kind === 'setup' || kind === 'specialBuild' || kind === 'ended') return;
  const vp = victoryPoints(s, s.current, true);
  if (vp >= s.settings.victoryPoints) {
    s.winner = s.current;
    s.phase = { kind: 'ended' };
    log(s, s.current, `${name(s, s.current)} gewinnt mit ${vp} Siegpunkten!`);
  }
}

function updateLongestRoad(s: GameState): void {
  s.roadLengths = s.players.map((_, seat) => longestRoad(s, seat));
  const max = Math.max(...s.roadLengths);
  const holder = s.longestRoad;
  let next: number | null;
  if (max < 5) next = null;
  else if (holder !== null && s.roadLengths[holder] === max) next = holder;
  else {
    const leaders = s.roadLengths.flatMap((len, seat) => (len === max ? [seat] : []));
    next = leaders.length === 1 ? leaders[0] : null;
  }
  if (next !== holder) {
    s.longestRoad = next;
    if (next !== null) log(s, next, `${name(s, next)} hat jetzt die längste Handelsstraße (${max}).`);
    else log(s, null, 'Niemand hat mehr die längste Handelsstraße.');
  }
}

/**
 * Längste Handelsstraße bzw. -route: Straßen und Schiffe zählen zusammen, wechseln dürfen sie aber
 * nur an einem eigenen Gebäude. Fremde Gebäude unterbrechen.
 */
export function longestRoad(s: GameState, seat: number): number {
  const topo = getTopology(s.board);
  const visited = new Set<number>();
  let best = 0;
  const kindOf = (e: number): 'road' | 'ship' | null =>
    s.roads[e] === seat ? 'road' : s.ships?.[e] === seat ? 'ship' : null;

  const walk = (vertex: number, length: number, via: 'road' | 'ship' | null) => {
    best = Math.max(best, length);
    const own = s.buildings[vertex]?.owner === seat;
    for (const e of topo.vertices[vertex].edges) {
      const kind = kindOf(e);
      if (!kind || visited.has(e)) continue;
      if (via && kind !== via && !own) continue;
      const edge = topo.edges[e];
      const next = edge.a === vertex ? edge.b : edge.a;
      visited.add(e);
      const blocker = s.buildings[next];
      if (blocker && blocker.owner !== seat) best = Math.max(best, length + 1);
      else walk(next, length + 1, kind);
      visited.delete(e);
    }
  };

  topo.vertices.forEach((v) => {
    if (v.edges.some((e) => kindOf(e))) walk(v.id, 0, null);
  });
  return best;
}
