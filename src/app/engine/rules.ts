import { BANK_SIZE, generateBoard, getTopology, vertexHarbors } from './board';
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
  const rng: RngState = { rng: seed | 0 };
  const layout = players.length > 4 ? 'ext' : 'base';
  const { board, robber } = generateBoard(layout, rng);
  const topo = getTopology(layout);
  const seated = shuffle(rng, players);
  const n = seated.length;
  const deck = shuffle(
    rng,
    Object.entries(DEV_DECK[layout]).flatMap(([card, count]) => Array<DevCard>(count).fill(card as DevCard)),
  );
  const bank = emptyResources();
  for (const r of RESOURCES) bank[r] = BANK_SIZE[layout];

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
  HANDLERS[action.type](s, seat, action as never);
  s.version = prev.version + 1;
  checkWinner(s);
  return s;
}

type Handler<T extends Action['type']> = (s: GameState, seat: number, action: Extract<Action, { type: T }>) => void;

const HANDLERS: { [T in Action['type']]: Handler<T> } = {
  placeSettlement(s, seat, { vertex }) {
    const phase = s.phase;
    if (phase.kind !== 'setup' || phase.step !== 'settlement') fail('Jetzt wird keine Siedlung gesetzt.');
    if (phase.order[phase.index] !== seat) fail('Du bist nicht dran.');
    if (!isFreeForSettlement(s, vertex)) fail('Hier darf keine Siedlung stehen.');
    s.buildings[vertex] = { owner: seat, type: 'settlement' };
    const secondRound = phase.index >= s.players.length;
    let text = `${name(s, seat)} setzt eine Siedlung.`;
    if (secondRound) {
      const gained = emptyResources();
      for (const h of getTopology(s.board.layout).vertices[vertex].hexes) {
        const terrain = s.board.hexes[h].terrain;
        if (terrain !== 'desert' && s.bank[terrain] > 0) {
          s.bank[terrain]--;
          gained[terrain]++;
          transfer(s, { kind: 'hex', id: h }, seatPoint(seat), terrain, 1);
        }
      }
      addTo(s.players[seat].resources, gained);
      text = `${name(s, seat)} setzt eine Siedlung und erhält ${formatResources(gained)}.`;
    }
    s.phase = { ...phase, step: 'road', settlement: vertex };
    updateLongestRoad(s);
    log(s, seat, text);
  },

  placeRoad(s, seat, { edge }) {
    const phase = s.phase;
    if (phase.kind !== 'setup' || phase.step !== 'road') fail('Jetzt wird keine Straße gesetzt.');
    if (phase.order[phase.index] !== seat) fail('Du bist nicht dran.');
    const e = getTopology(s.board.layout).edges[edge];
    if (!e || s.roads[edge] !== null) fail('Hier ist kein Platz für eine Straße.');
    if (e.a !== phase.settlement && e.b !== phase.settlement) fail('Die Straße muss an deine neue Siedlung grenzen.');
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
    const dice: [number, number] = [randomInt(s, 6) + 1, randomInt(s, 6) + 1];
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
    produce(s, sum);
    s.phase = { kind: 'main' };
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
    if (hex === s.robber) fail('Der Räuber muss auf ein anderes Feld.');
    const candidates = robberVictims(s, seat, hex);
    s.robber = hex;
    if (candidates.length > 0) {
      if (victim === null || !candidates.includes(victim)) fail('Wähle einen Spieler, bei dem du ziehst.');
      const pool = RESOURCES.flatMap((r) => Array<Resource>(s.players[victim].resources[r]).fill(r));
      const stolen = pool[randomInt(s, pool.length)];
      s.players[victim].resources[stolen]--;
      s.players[seat].resources[stolen]++;
      s.transfers.push({ from: seatPoint(victim), to: seatPoint(seat), card: stolen, count: 1, hidden: true });
      log(s, seat, `${name(s, seat)} versetzt den Räuber und zieht eine Karte bei ${name(s, victim)}.`);
    } else {
      log(s, seat, `${name(s, seat)} versetzt den Räuber.`);
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
      const remaining = phase.remaining - 1;
      s.phase =
        remaining > 0 && legalRoadEdges(s, seat).length > 0
          ? { ...phase, remaining }
          : { kind: phase.returnTo };
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
    s.buildings[vertex] = { owner: seat, type: 'settlement' };
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut eine Siedlung.`);
  },

  buildCity(s, seat, { vertex }) {
    requireBuilder(s, seat);
    if (piecesLeft(s, seat, 'city') <= 0) fail('Du hast keine Städte mehr.');
    const b = s.buildings[vertex];
    if (!b || b.owner !== seat || b.type !== 'settlement') fail('Eine Stadt kann nur auf eigene Siedlungen.');
    pay(s, seat, COSTS.city, { kind: 'vertex', id: vertex });
    b.type = 'city';
    log(s, seat, `${name(s, seat)} baut eine Stadt.`);
  },

  buyDevCard(s, seat) {
    requireBuilder(s, seat);
    if (s.devDeck.length === 0) fail('Es gibt keine Entwicklungskarten mehr.');
    pay(s, seat, COSTS.devCard);
    s.players[seat].newDevCards.push(s.devDeck.pop()!);
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
    const remaining = Math.min(2, piecesLeft(s, seat, 'road'));
    if (remaining === 0 || legalRoadEdges(s, seat).length === 0) fail('Du kannst gerade keine Straße bauen.');
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
    s.offers = s.offers.filter((o) => o.id !== offerId);
    const other = offer.counter ? seat : partner;
    log(s, seat, `${name(s, offer.from)} und ${name(s, other)} handeln: ${formatResources(offer.give)} gegen ${formatResources(offer.want)}.`);
  },

  cancelTrade(s, seat, { offerId }) {
    const offer = s.offers.find((o) => o.id === offerId);
    if (!offer) return;
    if (offer.from !== seat && !(offer.counter && seat === s.current)) fail('Das ist nicht dein Angebot.');
    s.offers = s.offers.filter((o) => o.id !== offerId);
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
  if (includeHidden) {
    const p = s.players[seat];
    vp += [...p.devCards, ...p.newDevCards].filter((c) => c === 'victoryPoint').length;
  }
  return vp;
}

export function isFreeForSettlement(s: GameState, vertex: number): boolean {
  const v = getTopology(s.board.layout).vertices[vertex];
  return !!v && s.buildings[vertex] === null && v.neighbors.every((n) => s.buildings[n] === null);
}

export function canBuildSettlement(s: GameState, seat: number, vertex: number): boolean {
  if (!isFreeForSettlement(s, vertex)) return false;
  return getTopology(s.board.layout).vertices[vertex].edges.some((e) => s.roads[e] === seat);
}

export function canBuildRoad(s: GameState, seat: number, edge: number): boolean {
  const topo = getTopology(s.board.layout);
  const e = topo.edges[edge];
  if (!e || s.roads[edge] !== null) return false;
  return [e.a, e.b].some((v) => {
    const b = s.buildings[v];
    if (b?.owner === seat) return true;
    if (b) return false;
    return topo.vertices[v].edges.some((other) => other !== edge && s.roads[other] === seat);
  });
}

export function legalSetupVertices(s: GameState): number[] {
  return getTopology(s.board.layout).vertices.filter((v) => isFreeForSettlement(s, v.id)).map((v) => v.id);
}

export function legalSetupRoads(s: GameState): number[] {
  const phase = s.phase;
  if (phase.kind !== 'setup' || phase.settlement === null) return [];
  return getTopology(s.board.layout).vertices[phase.settlement].edges.filter((e) => s.roads[e] === null);
}

export function legalSettlementVertices(s: GameState, seat: number): number[] {
  return getTopology(s.board.layout).vertices.filter((v) => canBuildSettlement(s, seat, v.id)).map((v) => v.id);
}

export function legalRoadEdges(s: GameState, seat: number): number[] {
  return getTopology(s.board.layout).edges.filter((e) => canBuildRoad(s, seat, e.id)).map((e) => e.id);
}

export function legalCityVertices(s: GameState, seat: number): number[] {
  return s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'settlement' ? [v] : []));
}

export function robberVictims(s: GameState, seat: number, hex: number): number[] {
  const victims = new Set<number>();
  for (const v of getTopology(s.board.layout).hexes[hex].corners) {
    const b = s.buildings[v];
    if (b && b.owner !== seat && totalResources(s.players[b.owner].resources) > 0) victims.add(b.owner);
  }
  return [...victims];
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

export function piecesLeft(s: GameState, seat: number, piece: 'road' | 'settlement' | 'city'): number {
  const used =
    piece === 'road'
      ? s.roads.filter((r) => r === seat).length
      : s.buildings.filter((b) => b?.owner === seat && b.type === piece).length;
  return PIECE_LIMITS[piece] - used;
}

/** Kann der Spieler in der Sonderbauphase überhaupt irgendetwas bauen oder kaufen? */
export function canBuildAnything(s: GameState, seat: number): boolean {
  const res = s.players[seat].resources;
  if (hasResources(res, COSTS.devCard) && s.devDeck.length > 0) return true;
  if (hasResources(res, COSTS.city) && piecesLeft(s, seat, 'city') > 0 && legalCityVertices(s, seat).length > 0) return true;
  if (hasResources(res, COSTS.settlement) && piecesLeft(s, seat, 'settlement') > 0 && legalSettlementVertices(s, seat).length > 0) return true;
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

function produce(s: GameState, sum: number): void {
  const topo = getTopology(s.board.layout);
  const demand = RESOURCES.map(() => s.players.map(() => 0));
  const sources: { hex: number; seat: number; res: Resource; n: number }[] = [];
  s.board.hexes.forEach((hex, id) => {
    if (hex.number !== sum || hex.terrain === 'desert' || id === s.robber) return;
    const r = RESOURCES.indexOf(hex.terrain);
    for (const v of topo.hexes[id].corners) {
      const b = s.buildings[v];
      if (!b) continue;
      const n = b.type === 'city' ? 2 : 1;
      demand[r][b.owner] += n;
      sources.push({ hex: id, seat: b.owner, res: hex.terrain, n });
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

export function longestRoad(s: GameState, seat: number): number {
  const topo = getTopology(s.board.layout);
  const visited = new Set<number>();
  let best = 0;

  const walk = (vertex: number, length: number) => {
    best = Math.max(best, length);
    for (const e of topo.vertices[vertex].edges) {
      if (s.roads[e] !== seat || visited.has(e)) continue;
      const edge = topo.edges[e];
      const next = edge.a === vertex ? edge.b : edge.a;
      visited.add(e);
      const blocker = s.buildings[next];
      if (blocker && blocker.owner !== seat) best = Math.max(best, length + 1);
      else walk(next, length + 1);
      visited.delete(e);
    }
  };

  topo.vertices.forEach((v) => {
    if (v.edges.some((e) => s.roads[e] === seat)) walk(v.id, 0);
  });
  return best;
}
