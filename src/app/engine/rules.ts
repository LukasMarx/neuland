import { generateBoard, getTopology, placeFishingGrounds, placeRivers, vertexHarbors } from './board';
import { mapById, mapFits } from './maps';
import { BRIDGE_COINS, DICE_DECK, DICE_DECK_RESHUFFLE, FISH_POOL, GOODS_SUPPLY, GUARDS_PER_LEVEL, HARBOR_MASTER_POINTS, LAKE_NUMBERS, MAX_WALLS, METROPOLIS_POINTS, NEUTRALS, PROGRESS_LIMIT, RAIDER_TRACK, RIVER_COINS, VariantId, VARIANTS } from './variants';
import { randomInt, RngState, shuffle } from './rng';
import {
  Action,
  COSTS,
  DEV_CARD_NAMES,
  DevCard,
  deckSize,
  emptyResources,
  FISH_COSTS,
  FishEffect,
  formatResources,
  GameSettings,
  GameState,
  handSize,
  hasResources,
  PIECE_LIMITS,
  PlayerState,
  PROGRESS,
  PROGRESS_CARDS,
  ProgressCard,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  Card,
  CARD_NAMES,
  CARDS,
  COMMODITIES,
  Commodity,
  count,
  isCommodity,
  setCount,
  EventFace,
  Guard,
  Track,
  TRACK_GOODS,
  TRACK_NAMES,
  TRACKS,
  ReturnPhase,
  Terrain,
  TokenEffect,
  totalResources,
  TransferPoint,
} from './types';

export class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

export const DEV_DECK: Record<'base' | 'ext' | 'big', Record<DevCard, number>> = {
  base: { knight: 14, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2, victoryPoint: 5 },
  ext: { knight: 20, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3, victoryPoint: 5 },
  // Eigene Erweiterung für 7–8 Spieler, im Verhältnis wie 5–6.
  big: { knight: 26, roadBuilding: 4, yearOfPlenty: 4, monopoly: 4, victoryPoint: 6 },
};

/** Entwicklungskarten im Stapel je nach Spielerzahl (ohne Neutrale). */
export function devDeckFor(players: number): Record<DevCard, number> {
  return DEV_DECK[players > 6 ? 'big' : players > 4 ? 'ext' : 'base'];
}

const MAX_LOG = 200;

export interface NewPlayer {
  id: string;
  name: string;
  color: string;
}

export function createGame(players: NewPlayer[], settings: GameSettings, seed: number): GameState {
  if (players.length < 2 || players.length > 8) fail('Es werden 2 bis 8 Spieler benötigt.');
  const map = mapById(settings.map);
  if (!mapFits(map, players.length)) fail(`${map.name} ist für ${map.players[0]}–${map.players[1]} Spieler.`);
  if (settings.variants?.includes('duell') && players.length !== 2) fail('Das Duell ist nur für zwei Spieler.');
  const tooMany = VARIANTS.find((v) => v.maxPlayers && settings.variants?.includes(v.id) && players.length > v.maxPlayers);
  if (tooMany) fail(`${tooMany.name} gibt es nur für bis zu ${tooMany.maxPlayers} Spieler.`);
  if (settings.variants?.includes('flusslaeufe') && map.seafaring) fail('Flussläufe gibt es nur auf Karten ohne Meerfelder.');
  const rng: RngState = { rng: seed | 0 };
  const { board, robber, bank: bankSize, pirate, fog } = generateBoard(map.id, players.length, rng);
  const topo = getTopology(board);
  const seated = shuffle(rng, players);
  const n = seated.length;
  const deck = shuffle(
    rng,
    Object.entries(devDeckFor(n)).flatMap(([card, count]) => Array<DevCard>(count).fill(card as DevCard)),
  );
  const bank = emptyResources();
  for (const r of RESOURCES) bank[r] = bankSize;

  const state: GameState = {
    version: 0,
    supply: bankSize,
    playedDev: [],
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
    if (fog) state.fog = fog;
  }
  if (hasVariant(state, 'duell')) setUpDuel(state);
  if (hasVariant(state, 'stadtwacht')) {
    for (const c of COMMODITIES) setCount(state.bank, c, GOODS_SUPPLY);
    state.improvements = state.players.map(() => ({ market: 0, council: 0, scholars: 0 }));
    state.metropolis = { market: null, council: null, scholars: null };
    state.walls = [];
    state.guards = topo.vertices.map(() => null);
    state.raiders = { position: 0, attacked: false };
    state.honors = state.players.map(() => 0);
    state.event = null;
    // Keine Entwicklungskarten, dafür Einflusskarten.
    state.devDeck = [];
    state.progress = state.players.map(() => []);
    state.progressDeck = progressDecks();
    state.progressPlayed = [];
    state.progressPoints = state.players.map(() => 0);
  }
  if (hasVariant(state, 'wuerfelstapel')) state.diceDeck = { ...DICE_DECK };
  if (hasVariant(state, 'fischgruende')) setUpFishing(state);
  if (hasVariant(state, 'flusslaeufe')) {
    state.board.rivers = placeRivers(state.board, state);
    state.coins = state.players.map(() => 0);
  }
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
    const owner = phase.owners?.[phase.index] ?? seat;
    const humans = humanCount(s);
    const secondRound = owner === seat && phase.index >= humans && phase.index < 2 * humans;
    // Stadtwacht: Die zweite Startfigur ist eine Stadt.
    const city = secondRound && !!s.improvements;
    s.buildings[vertex] = { owner, type: city ? 'city' : 'settlement' };
    const what = city ? 'eine Stadt' : 'eine Siedlung';
    let text = owner === seat ? `${name(s, seat)} setzt ${what}.` : `${name(s, seat)} setzt ${what} für ${name(s, owner)}.`;
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
      text = `${name(s, seat)} setzt ${what} und erhält ${formatResources(gained)}.`;
    }
    s.phase = { ...phase, step: 'road', settlement: vertex };
    updateLongestRoad(s);
    log(s, seat, text);
    if (owner === seat && touchesRiver(s, [vertex])) earnCoins(s, seat, RIVER_COINS, 'Siedlung am Fluss');
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
    if (isRiverEdge(s, edge)) fail('Über den Fluss geht es nur mit einer Brücke.');
    const owner = phase.owners?.[phase.index] ?? seat;
    s.roads[edge] = owner;
    updateLongestRoad(s);
    log(s, seat, owner === seat ? `${name(s, seat)} baut eine Straße.` : `${name(s, seat)} baut eine Straße für ${name(s, owner)}.`);
    revealFog(s, seat, edge);
    if (owner === seat) roadCoins(s, seat, edge);
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
    rollDice(s, seat, s.diceDeck ? drawDiceCard(s) : ([randomInt(s, 6) + 1, randomInt(s, 6) + 1] as [number, number]));
  },

  loseCity(s, seat, { vertex }) {
    const phase = s.phase;
    if (phase.kind !== 'raid') fail('Gerade fällt keine Stadt.');
    if (!phase.pending[seat]) fail('Du musst keine Stadt abgeben.');
    if (!vulnerableCities(s, seat).includes(vertex)) fail('Wähle eine eigene Stadt, die keine Prachtstadt ist.');
    downgradeCity(s, vertex);
    phase.pending[seat] = 0;
    if (phase.pending.every((n) => n === 0)) afterRoll(s, phase.sum);
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
    if (phase.to === undefined) {
      addTo(s.bank, resources);
      transferAll(s, seatPoint(seat), BANK, resources);
      log(s, seat, `${name(s, seat)} wirft ${due} Karten ab.`);
    } else {
      // Festbankett: Welche Karten es sind, sehen nur Geber und Nehmer.
      addTo(s.players[phase.to].resources, resources);
      for (const k of CARDS) {
        if (count(resources, k)) s.transfers.push({ from: seatPoint(seat), to: seatPoint(phase.to), card: k, count: count(resources, k), hidden: true });
      }
      log(s, seat, `${name(s, seat)} schenkt ${name(s, phase.to)} ${due === 1 ? 'eine Karte' : `${due} Karten`}.`);
    }
    phase.pending[seat] = 0;
    if (phase.pending.every((n) => n === 0)) {
      if (phase.then === 'main') s.phase = { kind: 'main' };
      else robberOrOn(s);
    }
  },

  moveRobber(s, seat, { hex, victim }) {
    const phase = s.phase;
    if (phase.kind !== 'robber') fail('Der Räuber wird gerade nicht versetzt.');
    if (seat !== s.current) fail('Du bist nicht dran.');
    if (!s.board.hexes[hex]) fail('Unbekanntes Feld.');
    if (s.board.hexes[hex].terrain === 'fog') fail('Im Nebel kann niemand stehen.');
    const pirate = s.board.hexes[hex].terrain === 'sea';
    if (pirate && s.pirate === undefined) fail('Auf diesem Brett gibt es kein Kaperschiff.');
    if (hex === (pirate ? s.pirate : s.robber)) fail(pirate ? 'Das Kaperschiff muss auf ein anderes Feld.' : 'Der Räuber muss auf ein anderes Feld.');
    if (!legalRobberHexes(s).includes(hex)) fail('Milder Räuber: Dort stehen Spieler mit höchstens 2 Siegpunkten.');
    const candidates = robberVictims(s, seat, hex);
    if (phase.all && pirate) fail('Der Steuereintreiber geht nur an Land.');
    if (pirate) s.pirate = hex;
    else s.robber = hex;
    if (phase.all) {
      // Steuereintreiber: eine Karte von jedem am Feld.
      for (const v of candidates) steal(s, seat, v);
      log(
        s,
        seat,
        candidates.length
          ? `${name(s, seat)} versetzt den Räuber und zieht bei ${candidates.map((v) => name(s, v)).join(', ')} je eine Karte.`
          : `${name(s, seat)} versetzt den Räuber.`,
      );
    } else if (candidates.length > 0) {
      if (victim === null || !candidates.includes(victim)) fail('Wähle einen Spieler, bei dem du ziehst.');
      steal(s, seat, victim);
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
      revealFog(s, seat, edge);
      roadCoins(s, seat, edge);
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
    revealFog(s, seat, edge);
    roadCoins(s, seat, edge);
    startNeutralStep(s, 'road');
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
    if (s.tokens) gainTokens(s, seat, vertex);
    if (touchesRiver(s, [vertex])) earnCoins(s, seat, RIVER_COINS, 'Siedlung am Fluss');
    startNeutralStep(s, 'settlement');
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
    if (s.tokens) {
      s.tokens[seat]++;
      log(s, seat, `${name(s, seat)} bekommt für den Ritter eine Handelsmarke.`);
    }
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
    if (CARDS.some((r) => count(give, r) > 0 && count(get, r) > 0)) fail('Derselbe Rohstoff kann nicht auf beiden Seiten stehen.');
    // Jedes Kurs-Paket bringt eine Karte; erst prüfen, dann einzeln tauschen (bei einem Fehler bleibt nichts halb).
    const lots = CARDS.flatMap((r) => {
      const rate = tradeRate(s, seat, r);
      if (count(give, r) % rate) fail(`${CARD_NAMES[r]} tauschst du ${rate}:1.`);
      return Array<Card>(count(give, r) / rate).fill(r);
    });
    const wanted = cardList(get);
    if (!lots.length || lots.length !== wanted.length) fail('Das passt nicht zum Kurs der Bank.');
    lots.forEach((r, i) => HANDLERS.bankTrade(s, seat, { type: 'bankTrade', give: r, get: wanted[i] }));
  },

  bankTrade(s, seat, { give, get }) {
    requireTurn(s, seat, 'main');
    if (!CARDS.includes(give) || !CARDS.includes(get) || give === get) fail('Ungültiger Tausch.');
    const rate = tradeRate(s, seat, give);
    const player = s.players[seat];
    if (count(player.resources, give) < rate) fail(`Du brauchst ${rate} ${CARD_NAMES[give]}.`);
    if (count(s.bank, get) < 1) fail(`Die Bank hat kein ${CARD_NAMES[get]} mehr.`);
    addCard(player.resources, give, -rate);
    addCard(s.bank, give, rate);
    addCard(s.bank, get, -1);
    addCard(player.resources, get, 1);
    transfer(s, seatPoint(seat), BANK, give, rate);
    transfer(s, BANK, seatPoint(seat), get, 1);
    log(s, seat, `${name(s, seat)} tauscht ${rate} ${CARD_NAMES[give]} gegen 1 ${CARD_NAMES[get]} mit der Bank.`);
  },

  offerTrade(s, seat, { give, want }) {
    if (s.phase.kind !== 'main') fail('Gehandelt wird nach dem Würfeln.');
    validateCounts(give);
    validateCounts(want);
    if (totalResources(give) === 0 || totalResources(want) === 0) fail('Ein Angebot braucht beide Seiten.');
    if (CARDS.some((r) => count(give, r) > 0 && count(want, r) > 0)) fail('Derselbe Rohstoff kann nicht auf beiden Seiten stehen.');
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
    revealFog(s, seat, edge);
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
    revealFog(s, seat, to);
  },

  spendFish(s, seat, { effect, victim, resource }) {
    if (!s.fish) fail('In diesem Spiel gibt es keine Fische.');
    requireTurn(s, seat, 'main');
    if (!Object.hasOwn(FISH_COSTS, effect)) fail('Unbekannter Fischtausch.');
    const cost = FISH_COSTS[effect];
    if (fishTotal(s, seat) < cost) fail(`Dafür brauchst du Fische im Wert von ${cost}.`);
    switch (effect) {
      case 'robber':
        if (s.robber < 0) fail('Der Räuber ist schon vom Brett.');
        payFish(s, seat, cost);
        s.robber = -1;
        log(s, seat, `${name(s, seat)} gibt ${cost} Fische ab und schickt den Räuber vom Brett.`);
        break;
      case 'steal': {
        if (victim == null || victim === seat || !s.players[victim]) fail('Wähle einen Mitspieler.');
        if (totalResources(s.players[victim].resources) === 0) fail(`${name(s, victim)} hat keine Karten.`);
        payFish(s, seat, cost);
        const pool = cardList(s.players[victim].resources);
        const stolen = pool[randomInt(s, pool.length)];
        addCard(s.players[victim].resources, stolen, -1);
        addCard(s.players[seat].resources, stolen, 1);
        s.transfers.push({ from: seatPoint(victim), to: seatPoint(seat), card: stolen, count: 1, hidden: true });
        log(s, seat, `${name(s, seat)} gibt ${cost} Fische ab und zieht eine Karte bei ${name(s, victim)}.`);
        break;
      }
      case 'bank':
        if (!resource || !isResource(resource)) fail('Wähle einen Rohstoff.');
        if (s.bank[resource] <= 0) fail(`Die Bank hat kein ${RESOURCE_NAMES[resource]} mehr.`);
        payFish(s, seat, cost);
        s.bank[resource]--;
        s.players[seat].resources[resource]++;
        transfer(s, BANK, seatPoint(seat), resource, 1);
        log(s, seat, `${name(s, seat)} gibt ${cost} Fische ab und nimmt 1 ${RESOURCE_NAMES[resource]}.`);
        break;
      case 'road':
        if (!canLayFreePiece(s, seat)) fail('Du kannst gerade keine Straße legen.');
        payFish(s, seat, cost);
        s.phase = { kind: 'roadBuilding', remaining: 1, returnTo: 'main' };
        log(s, seat, `${name(s, seat)} gibt ${cost} Fische ab für eine Straße.`);
        break;
      case 'devCard': {
        if (s.devDeck.length === 0) fail('Es gibt keine Entwicklungskarten mehr.');
        payFish(s, seat, cost);
        const [card] = s.devDeck.splice(randomInt(s, s.devDeck.length), 1);
        s.players[seat].newDevCards.push(card);
        transfer(s, BANK, seatPoint(seat), 'dev', 1);
        log(s, seat, `${name(s, seat)} gibt ${cost} Fische ab für eine Entwicklungskarte.`);
        break;
      }
    }
  },

  passAnchor(s, seat, { to }) {
    if (s.anchor === undefined) fail('In diesem Spiel gibt es keinen Anker.');
    if (s.anchor !== seat) fail('Du hast den Rostigen Anker nicht.');
    requireTurn(s, seat, 'main');
    if (to === seat || !s.players[to]) fail('Unbekannter Spieler.');
    if (victoryPoints(s, to, false) < victoryPoints(s, seat, false)) fail('Den Anker bekommt nur, wer mindestens so viele Punkte hat wie du.');
    s.anchor = to;
    log(s, seat, `${name(s, seat)} gibt den Rostigen Anker an ${name(s, to)} weiter.`);
  },

  placeNeutral(s, seat, { owner, vertex, edge }) {
    const phase = s.phase;
    if (phase.kind !== 'neutral') fail('Gerade wird kein neutrales Teil gesetzt.');
    if (seat !== s.current) fail('Du bist nicht dran.');
    if (!s.players[owner]?.neutral) fail('Wähle einen neutralen Mitspieler.');
    if (phase.piece === 'road') {
      if (edge === undefined || piecesLeft(s, owner, 'road') <= 0 || !canBuildRoad(s, owner, edge)) fail(`Hier kann ${name(s, owner)} keine Straße bauen.`);
      s.roads[edge] = owner;
    } else {
      if (vertex === undefined || piecesLeft(s, owner, 'settlement') <= 0 || !canBuildSettlement(s, owner, vertex)) {
        fail(`Hier kann ${name(s, owner)} keine Siedlung bauen.`);
      }
      s.buildings[vertex] = { owner, type: 'settlement' };
    }
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} setzt ${phase.piece === 'road' ? 'eine Straße' : 'eine Siedlung'} für ${name(s, owner)}.`);
    s.phase = { kind: 'main' };
  },

  spendTokens(s, seat, { effect, give }) {
    if (!s.tokens) fail('In diesem Spiel gibt es keine Handelsmarken.');
    requireTurn(s, seat, 'main');
    const cost = tokenCost(s, seat);
    if (s.tokens[seat] < cost) fail(`Dafür brauchst du ${cost === 1 ? 'eine Handelsmarke' : `${cost} Handelsmarken`}.`);
    const opponent = opponentOf(s, seat);
    if (effect === 'robber') {
      const desert = s.board.hexes.findIndex((h) => h.terrain === 'desert');
      if (desert < 0) fail('Auf diesem Brett gibt es keine Wüste.');
      if (s.robber === desert) fail('Der Räuber steht schon in der Wüste.');
      s.robber = desert;
      log(s, seat, `${name(s, seat)} schickt den Räuber mit ${cost === 1 ? 'einer Handelsmarke' : `${cost} Handelsmarken`} in die Wüste.`);
    } else if (effect === 'trade') {
      if (!give) fail('Wähle 2 Karten, die du abgibst.');
      validateCounts(give);
      const giving = pick(give);
      if (totalResources(giving) !== 2) fail('Wähle 2 Karten, die du abgibst.');
      if (!hasResources(s.players[seat].resources, giving)) fail('So viele Karten hast du nicht.');
      if (totalResources(s.players[opponent].resources) < 2) fail(`${name(s, opponent)} hat keine 2 Karten.`);
      // Erst zwei zufällige Karten nehmen, dann die gewählten abgeben.
      for (let i = 0; i < 2; i++) {
        const pool = cardList(s.players[opponent].resources);
        const taken = pool[randomInt(s, pool.length)];
        addCard(s.players[opponent].resources, taken, -1);
        addCard(s.players[seat].resources, taken, 1);
        s.transfers.push({ from: seatPoint(opponent), to: seatPoint(seat), card: taken, count: 1, hidden: true });
      }
      takeFrom(s.players[seat].resources, giving);
      addTo(s.players[opponent].resources, giving);
      transferAll(s, seatPoint(seat), seatPoint(opponent), giving);
      log(s, seat, `${name(s, seat)} erzwingt einen Tausch: 2 Karten von ${name(s, opponent)} gegen ${formatResources(giving)}.`);
    } else {
      fail('Unbekannte Handelsmarken-Aktion.');
    }
    s.tokens[seat] -= cost;
  },

  buildBridge(s, seat, { edge }) {
    if (!s.coins) fail('In diesem Spiel gibt es keine Flüsse.');
    requireBuilder(s, seat);
    if (piecesLeft(s, seat, 'bridge') <= 0) fail('Du hast keine Brücken mehr.');
    if (!canBuildBridge(s, seat, edge)) fail('Hier kannst du keine Brücke bauen.');
    pay(s, seat, COSTS.bridge, { kind: 'edge', id: edge });
    s.roads[edge] = seat;
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} baut eine Brücke.`);
    earnCoins(s, seat, BRIDGE_COINS, 'Brücke');
  },

  tradeCoins(s, seat, { resource }) {
    if (!s.coins) fail('In diesem Spiel gibt es keine Münzen.');
    requireTurn(s, seat, 'main');
    if (s.coins[seat] < 2) fail('Dafür brauchst du 2 Münzen.');
    if (!isResource(resource)) fail('Wähle einen Rohstoff.');
    if (s.bank[resource] <= 0) fail(`Die Bank hat kein ${RESOURCE_NAMES[resource]} mehr.`);
    s.coins[seat] -= 2;
    s.bank[resource]--;
    s.players[seat].resources[resource]++;
    transfer(s, BANK, seatPoint(seat), resource, 1);
    log(s, seat, `${name(s, seat)} tauscht 2 Münzen gegen 1 ${RESOURCE_NAMES[resource]}.`);
  },

  improveCity(s, seat, { track, vertex }) {
    if (!s.improvements || !s.metropolis) fail('Stadtausbau gibt es nur mit Stadtwacht.');
    requireBuilder(s, seat);
    if (!TRACKS.includes(track)) fail('Unbekannte Ausbaurichtung.');
    const level = s.improvements[seat][track];
    if (level >= 5) fail(`${TRACK_NAMES[track]} ist schon voll ausgebaut.`);
    const cities = s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'city' ? [v] : []));
    if (!cities.length) fail('Für den Ausbau brauchst du eine Stadt.');
    const next = level + 1;
    const cost = emptyResources();
    setCount(cost, TRACK_GOODS[track], improveCost(s, seat, next));
    const target = metropolisGain(s, seat, track, next) ? metropolisCity(s, seat, cities, vertex) : null;
    pay(s, seat, cost);
    if (s.boost?.pulley && s.current === seat) delete s.boost.pulley;
    s.improvements[seat][track] = next;
    log(s, seat, `${name(s, seat)} baut ${TRACK_NAMES[track]} auf Stufe ${next} aus.`);
    if (target !== null) {
      const before = s.metropolis[track];
      const from = before === null ? null : (s.buildings[before]?.owner ?? null);
      s.metropolis[track] = target;
      log(
        s,
        seat,
        from === null
          ? `${name(s, seat)} hat die erste Prachtstadt der Richtung ${TRACK_NAMES[track]}.`
          : `${name(s, seat)} übernimmt die Prachtstadt ${TRACK_NAMES[track]} von ${name(s, from)}.`,
      );
    }
  },

  buildWall(s, seat, { vertex }) {
    if (!s.walls) fail('Palisaden gibt es nur mit Stadtwacht.');
    requireBuilder(s, seat);
    checkWall(s, seat, vertex);
    pay(s, seat, COSTS.wall, { kind: 'vertex', id: vertex });
    s.walls.push(vertex);
    log(s, seat, `${name(s, seat)} baut eine Palisade (Handkartenlimit ${handLimit(s, seat)}).`);
  },

  buildGuard(s, seat, { vertex }) {
    if (!s.guards) fail('Wächter gibt es nur mit Stadtwacht.');
    requireBuilder(s, seat);
    if (guardCount(s, seat, 1) >= GUARDS_PER_LEVEL) fail(`Du hast schon ${GUARDS_PER_LEVEL} einfache Wächter.`);
    if (!canPlaceGuard(s, seat, vertex)) fail('Ein Wächter kommt auf eine freie Ecke an einer eigenen Straße.');
    pay(s, seat, COSTS.guard, { kind: 'vertex', id: vertex });
    s.guards[vertex] = { owner: seat, level: 1, active: false };
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} stellt einen Wächter auf.`);
  },

  upgradeGuard(s, seat, { vertex }) {
    requireBuilder(s, seat);
    const g = ownGuard(s, seat, vertex);
    const next = nextGuardLevel(s, seat, g);
    pay(s, seat, COSTS.guard, { kind: 'vertex', id: vertex });
    g.level = next;
    log(s, seat, `${name(s, seat)} wertet einen Wächter auf Stufe ${next} auf.`);
  },

  activateGuard(s, seat, { vertex }) {
    requireBuilder(s, seat);
    const g = ownGuard(s, seat, vertex);
    if (g.active) fail('Dieser Wächter ist schon einsatzbereit.');
    pay(s, seat, COSTS.activate, { kind: 'vertex', id: vertex });
    g.active = true;
    // Erst ab dem nächsten Zug darf er ziehen, verdrängen oder den Räuber vertreiben.
    g.ready = s.turn + 1;
    log(s, seat, `${name(s, seat)} macht einen Wächter einsatzbereit.`);
  },

  moveGuard(s, seat, { from, to }) {
    requireTurn(s, seat, 'main');
    const g = readyGuard(s, seat, from);
    if (!guardTargets(s, seat, from).includes(to)) fail('Dorthin kommt der Wächter nicht.');
    const other = s.guards![to];
    s.guards![from] = null;
    s.guards![to] = { ...g, active: false };
    if (other) {
      log(s, seat, `${name(s, seat)} verdrängt einen Wächter von ${name(s, other.owner)}.`);
      if (guardSpots(s, other.owner).length) s.phase = { kind: 'displace', seat: other.owner, guard: other };
      else log(s, other.owner, `Der Wächter von ${name(s, other.owner)} findet keinen Platz und geht zurück in den Vorrat.`);
    } else {
      log(s, seat, `${name(s, seat)} zieht einen Wächter.`);
    }
    updateLongestRoad(s);
  },

  placeDisplaced(s, seat, { vertex }) {
    const phase = s.phase;
    if (phase.kind !== 'displace' || phase.seat !== seat) fail('Du musst gerade keinen Wächter umsetzen.');
    const spots = guardSpots(s, seat);
    if (vertex === null) {
      if (spots.length) fail('Wähle einen Platz für den Wächter.');
    } else {
      if (!spots.includes(vertex)) fail('Dort kann der Wächter nicht stehen.');
      s.guards![vertex] = { ...phase.guard };
      log(s, seat, `${name(s, seat)} setzt den verdrängten Wächter um.`);
    }
    s.phase = { kind: 'main' };
    updateLongestRoad(s);
  },

  chaseRobber(s, seat, { vertex }) {
    requireTurn(s, seat, 'main');
    const g = readyGuard(s, seat, vertex);
    if (!robberActive(s)) fail('Der Räuber ist noch nicht im Spiel.');
    if (s.robber < 0 || !getTopology(s.board).hexes[s.robber].corners.includes(vertex)) fail('Der Wächter steht nicht am Feld des Räubers.');
    g.active = false;
    s.phase = { kind: 'robber', returnTo: 'main' };
    log(s, seat, `${name(s, seat)} vertreibt mit einem Wächter den Räuber.`);
  },

  playProgress(s, seat, { progress, card, vertices, hexes, edge, target, dice }) {
    if (!s.progress) fail('Einflusskarten gibt es nur mit Stadtwacht.');
    if (!Object.hasOwn(PROGRESS, progress)) fail('Unbekannte Einflusskarte.');
    // Das Losbuch ersetzt den Wurf, alle anderen kommen nach dem Würfeln.
    requireTurn(s, seat, PROGRESS[progress].beforeRoll ? 'roll' : 'main');
    const hand = s.progress[seat];
    const index = hand.indexOf(progress);
    if (index < 0) fail(`Du hast keine Karte „${PROGRESS[progress].name}“.`);
    hand.splice(index, 1);
    s.progressPlayed!.push(progress);
    PLAY[progress](s, seat, {
      card,
      vertices: Array.isArray(vertices) ? vertices : [],
      hexes: Array.isArray(hexes) ? hexes : [],
      edge,
      target,
      dice,
    });
  },

  takePeek(s, seat, { cards, progress }) {
    const phase = s.phase;
    if (phase.kind !== 'peek' || phase.seat !== seat) fail('Du darfst gerade keine Karten nehmen.');
    const victim = s.players[phase.target];
    if (phase.what === 'cards') {
      if (!cards) fail('Wähle die Karten.');
      validateCounts(cards);
      if (totalResources(cards) !== phase.take) fail(`Nimm genau ${phase.take} Karten.`);
      if (!hasResources(victim.resources, cards)) fail('So viele Karten hat er nicht.');
      takeFrom(victim.resources, cards);
      addTo(s.players[seat].resources, cards);
      for (const k of CARDS) {
        if (count(cards, k)) s.transfers.push({ from: seatPoint(phase.target), to: seatPoint(seat), card: k, count: count(cards, k), hidden: true });
      }
      log(s, seat, `${name(s, seat)} nimmt sich ${phase.take === 1 ? 'eine Karte' : `${phase.take} Karten`} von ${name(s, phase.target)}.`);
    } else {
      const hand = s.progress![phase.target];
      const index = progress ? hand.indexOf(progress) : -1;
      if (index < 0) fail('Wähle eine seiner Einflusskarten.');
      if (s.progress![seat].length >= PROGRESS_LIMIT) fail(`Du hast schon ${PROGRESS_LIMIT} Einflusskarten.`);
      hand.splice(index, 1);
      s.progress![seat].push(progress!);
      log(s, seat, `${name(s, seat)} nimmt sich eine Einflusskarte von ${name(s, phase.target)}.`);
    }
    s.phase = { kind: 'main' };
  },

  pickProgress(s, seat, { track }) {
    const phase = s.phase;
    if (phase.kind !== 'progressPick') fail('Gerade wird keine Einflusskarte gezogen.');
    if (!phase.pending[seat]) fail('Du ziehst gerade keine Einflusskarte.');
    if (!TRACKS.includes(track)) fail('Unbekannte Farbe.');
    if (!progressStackSize(s, track)) fail(`Der Stapel ${TRACK_NAMES[track]} ist leer.`);
    drawProgress(s, seat, track);
    phase.pending[seat] = 0;
    if (phase.pending.every((n) => n === 0)) afterRoll(s, phase.sum);
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
    // Einflusskarten wirken nur im eigenen Zug, nicht in der Sonderbauphase der anderen.
    delete s.boost;
    if (humanCount(s) > 4) {
      const n = humanCount(s);
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
    case 'raid':
    case 'progressPick':
      return phase.pending.flatMap((n, i) => (n > 0 ? [i] : []));
    case 'displace':
    case 'peek':
      return [phase.seat];
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
  vp += coinPoints(s, seat);
  vp += s.honors?.[seat] ?? 0;
  vp += s.progressPoints?.[seat] ?? 0;
  if (s.trader?.owner === seat) vp++;
  if (s.metropolis) vp += TRACKS.filter((t) => s.metropolis![t] !== null && s.buildings[s.metropolis![t]!]?.owner === seat).length * METROPOLIS_POINTS;
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
    !s.guards?.[vertex] &&
    v.neighbors.every((n) => s.buildings[n] === null) &&
    v.hexes.some((h) => isLand(s.board.hexes[h].terrain))
  );
}

export function canBuildSettlement(s: GameState, seat: number, vertex: number): boolean {
  if (!isFreeForSettlement(s, vertex)) return false;
  // Anschluss über eine eigene Straße oder, bei Seewege, über ein eigenes Schiff.
  return getTopology(s.board).vertices[vertex].edges.some((e) => s.roads[e] === seat || s.ships?.[e] === seat);
}

export function canBuildRoad(s: GameState, seat: number, edge: number): boolean {
  return !isRiverEdge(s, edge) && roadFits(s, seat, edge);
}

/** Flussläufe: Brücken liegen auf Flusskanten und schließen an wie Straßen. */
export function canBuildBridge(s: GameState, seat: number, edge: number): boolean {
  return isRiverEdge(s, edge) && roadFits(s, seat, edge);
}

export function legalBridgeEdges(s: GameState, seat: number): number[] {
  return (s.board.rivers ?? []).flatMap((r) => r.edges).filter((e) => canBuildBridge(s, seat, e));
}

/**
 * Freie Landkante, die an ein eigenes Gebäude oder eine eigene Straße anschließt. Fremde Gebäude und
 * (Stadtwacht) fremde Wächter unterbrechen.
 */
function roadFits(s: GameState, seat: number, edge: number): boolean {
  const topo = getTopology(s.board);
  const e = topo.edges[edge];
  if (!e || s.roads[edge] !== null || s.ships?.[edge] != null || !edgeTouchesLand(s, edge)) return false;
  return [e.a, e.b].some((v) => {
    const b = s.buildings[v];
    if (b?.owner === seat) return true;
    if (b) return false;
    const g = s.guards?.[v];
    if (g && g.owner !== seat) return false;
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
  return getTopology(s.board).vertices[phase.settlement].edges.filter((e) => s.roads[e] === null && edgeTouchesLand(s, e) && !isRiverEdge(s, e));
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
      if (owner != null && owner !== seat && handSize(s.players[owner]) > 0) victims.add(owner);
    }
    return [...victims];
  }
  for (const v of topo.hexes[hex].corners) {
    const b = s.buildings[v];
    if (b && b.owner !== seat && handSize(s.players[b.owner]) > 0) victims.add(b.owner);
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
  // Seewege: Statt des Räubers darf man das Kaperschiff auf ein anderes Meerfeld setzen (nicht der Steuereintreiber).
  const tax = s.phase.kind === 'robber' && s.phase.all;
  const pirateHexes = s.pirate !== undefined && !tax ? s.board.hexes.map((_, id) => id).filter((id) => sea(id) && id !== s.pirate) : [];
  return [...landRobberHexes(s), ...pirateHexes];
}

function landRobberHexes(s: GameState): number[] {
  const others = s.board.hexes.map((_, id) => id).filter((id) => id !== s.robber && isLand(s.board.hexes[id].terrain));
  if (!hasVariant(s, 'milderRaeuber')) return others;
  const topo = getTopology(s.board);
  const protectedSeat = s.players.map((p, seat) => !p.neutral && victoryPoints(s, seat, false) <= 2);
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
  const points = s.players.map((p, seat) => (p.neutral ? 0 : harborPoints(s, seat)));
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

export function tradeRate(s: GameState, seat: number, give: Card): number {
  const harbors = vertexHarbors(s.board);
  let rate = 4;
  // Stadtwacht, Markt ab Stufe 3: Güter 2:1 mit der Bank.
  if (isCommodity(give) && (s.improvements?.[seat]?.market ?? 0) >= 3) rate = 2;
  s.buildings.forEach((b, v) => {
    if (b?.owner !== seat) return;
    if (harbors[v] === give) rate = Math.min(rate, 2);
    else if (harbors[v] === 'any') rate = Math.min(rate, 3);
  });
  // Wanderhändler: der Rohstoff seines Feldes 2:1.
  if (s.trader?.owner === seat && s.board.hexes[s.trader.hex]?.terrain === give) rate = Math.min(rate, 2);
  // Frachtkontor (Einflusskarte): diese Kartenart 2:1 bis zum Ende des Zuges.
  if (s.boost?.tradingPost === give && s.current === seat) rate = Math.min(rate, 2);
  return rate;
}

export function piecesLeft(s: GameState, seat: number, piece: 'road' | 'settlement' | 'city' | 'ship' | 'bridge'): number {
  // Brücken liegen in `roads`, zählen aber als eigener Vorrat.
  const used =
    piece === 'road' || piece === 'bridge'
      ? s.roads.filter((r, e) => r === seat && isRiverEdge(s, e) === (piece === 'bridge')).length
      : piece === 'ship'
        ? (s.ships ?? []).filter((r) => r === seat).length
        : s.buildings.filter((b) => b?.owner === seat && b.type === piece).length;
  return PIECE_LIMITS[piece] - used;
}

function isResource(t: string): t is Resource {
  return (RESOURCES as readonly string[]).includes(t);
}

function edgeTouchesLand(s: GameState, edge: number): boolean {
  return getTopology(s.board).edges[edge].hexes.some((h) => isLand(s.board.hexes[h].terrain));
}

/** Bekanntes Land: weder Meer noch Nebel. */
export function isLand(terrain: Terrain): boolean {
  return terrain !== 'sea' && terrain !== 'fog';
}

const TERRAIN_NAMES: Record<Exclude<Terrain, 'fog'>, string> = {
  wood: 'Wald',
  brick: 'Lehmgrube',
  sheep: 'Weideland',
  wheat: 'Acker',
  ore: 'Gebirge',
  desert: 'Wüste',
  gold: 'Goldfluss',
  sea: 'Meer',
  lake: 'See',
};

/** Zieht einen Schlüssel aus einem Zählwerk, gewichtet nach Anzahl, und zählt ihn herunter. */
function drawFrom<K extends string | number>(s: GameState, pool: Partial<Record<K, number>>, allowed: (k: K) => boolean = () => true): K | null {
  const keys = (Object.keys(pool) as K[]).filter((k) => (pool[k] ?? 0) > 0);
  const options = keys.some(allowed) ? keys.filter(allowed) : keys;
  const total = options.reduce((a, k) => a + pool[k]!, 0);
  if (!total) return null;
  let roll = randomInt(s, total);
  for (const k of options) {
    roll -= pool[k]!;
    if (roll < 0) {
      pool[k] = pool[k]! - 1;
      return k;
    }
  }
  return null;
}

/**
 * Im Dunst: Nebelfelder an dieser Kante aufdecken. Gelände und Zahl entscheidet erst jetzt der Zufall
 * (der Host mischt vor jeder Aktion frischen Zufall bei). Wer aufdeckt, bekommt einen Rohstoff des Landes.
 */
function revealFog(s: GameState, seat: number, edge: number): void {
  if (!s.fog) return;
  const topo = getTopology(s.board);
  const fogged = topo.edges[edge].hexes.filter((h) => s.board.hexes[h].terrain === 'fog');
  if (!fogged.length) return;
  // Neues Feld-Array: Die Topologie hängt daran und muss mit dem aufgedeckten Feld neu entstehen.
  const hexes = [...s.board.hexes];
  for (const h of fogged) {
    const terrain: Terrain = drawFrom<Terrain>(s, s.fog.terrain) ?? 'sea';
    let number: number | null = null;
    if (terrain !== 'sea' && terrain !== 'desert') {
      // Keine 6 und 8 nebeneinander, solange der Vorrat noch etwas anderes hergibt.
      const redNear = topo.hexes[h].neighbors.some((m) => hexes[m].number === 6 || hexes[m].number === 8);
      const drawn = drawFrom<string>(s, s.fog.numbers as Record<string, number>, (k) => !redNear || (k !== '6' && k !== '8'));
      number = drawn === null ? null : Number(drawn);
    }
    hexes[h] = { terrain, number };
    const found = number ? `${TERRAIN_NAMES[terrain as Exclude<Terrain, 'fog'>]} (${number})` : TERRAIN_NAMES[terrain as Exclude<Terrain, 'fog'>];
    const res = terrain === 'gold' ? [...RESOURCES].sort((a, b) => s.bank[b] - s.bank[a])[0] : terrain;
    if (isResource(res) && s.bank[res] > 0) {
      s.bank[res]--;
      s.players[seat].resources[res]++;
      transfer(s, { kind: 'hex', id: h }, seatPoint(seat), res, 1);
      log(s, seat, `${name(s, seat)} lichtet den Nebel: ${found}, dafür 1 ${RESOURCE_NAMES[res]}.`);
    } else {
      log(s, seat, `${name(s, seat)} lichtet den Nebel: ${found}.`);
    }
  }
  s.board = { ...s.board, hexes };
}

/** Spieler ohne die neutralen Mitspieler des Duells; die Neutralen sitzen immer hinten. */
export function humanCount(s: GameState): number {
  return s.players.filter((p) => !p.neutral).length;
}

export function neutralSeats(s: GameState): number[] {
  return s.players.flatMap((p, seat) => (p.neutral ? [seat] : []));
}

/** Duell: zwei neutrale Mitspieler hinten anfügen; in der Aufstellung setzt jeder Spieler einen davon. */
function setUpDuel(s: GameState): void {
  const [a, b] = NEUTRALS.map((n, i) => {
    s.players.push({ ...n, resources: emptyResources(), devCards: [], newDevCards: [], knights: 0, neutral: true });
    s.roadLengths.push(0);
    return 2 + i;
  });
  s.phase = { kind: 'setup', order: [0, 1, 1, 0, 1, 0], owners: [0, 1, 1, 0, a, b], index: 0, step: 'settlement', settlement: null };
  s.tokens = s.players.map(() => 0);
}

function opponentOf(s: GameState, seat: number): number {
  return s.players.findIndex((p, i) => i !== seat && !p.neutral);
}

/** Duell: Wer vorn liegt, zahlt zwei Handelsmarken, sonst eine. */
export function tokenCost(s: GameState, seat: number): number {
  return victoryPoints(s, seat, false) > victoryPoints(s, opponentOf(s, seat), false) ? 2 : 1;
}

export function canSpendTokens(s: GameState, seat: number, effect: TokenEffect): boolean {
  if (!s.tokens || s.current !== seat || s.phase.kind !== 'main' || s.tokens[seat] < tokenCost(s, seat)) return false;
  if (effect === 'robber') {
    const desert = s.board.hexes.findIndex((h) => h.terrain === 'desert');
    return desert >= 0 && s.robber !== desert;
  }
  return totalResources(s.players[seat].resources) >= 2 && handSize(s.players[opponentOf(s, seat)]) >= 2;
}

/** Duell: Handelsmarken für eine Siedlung an der Küste und an der Wüste. */
function gainTokens(s: GameState, seat: number, vertex: number): void {
  const v = getTopology(s.board).vertices[vertex];
  let gain = 0;
  if (v.hexes.length < 3 || v.hexes.some((h) => !isLand(s.board.hexes[h].terrain))) gain++;
  if (v.hexes.some((h) => s.board.hexes[h].terrain === 'desert')) gain++;
  if (!gain) return;
  s.tokens![seat] += gain;
  log(s, seat, `${name(s, seat)} bekommt ${gain === 1 ? 'eine Handelsmarke' : `${gain} Handelsmarken`}.`);
}

/** Duell: erlaubte Plätze je neutralem Mitspieler für Straße oder Siedlung, mit Blick auf seinen Vorrat. */
export function neutralSpots(s: GameState, piece: 'road' | 'settlement'): { owner: number; spots: number[] }[] {
  return neutralSeats(s).map((owner) => ({
    owner,
    spots:
      piecesLeft(s, owner, piece) <= 0 ? [] : piece === 'road' ? legalRoadEdges(s, owner) : legalSettlementVertices(s, owner),
  }));
}

/** Duell: nach einem Bau ein Teil für einen Neutralen; geht keine Siedlung, dann eine Straße. */
function startNeutralStep(s: GameState, piece: 'road' | 'settlement'): void {
  if (!s.tokens || s.phase.kind !== 'main') return;
  const possible = (p: 'road' | 'settlement') => neutralSpots(s, p).some((n) => n.spots.length > 0);
  const next = possible(piece) ? piece : piece === 'settlement' && possible('road') ? 'road' : null;
  if (next) s.phase = { kind: 'neutral', piece: next };
}

/** Flussläufe: Liegt diese Kante auf einem Fluss? */
export function isRiverEdge(s: GameState, edge: number): boolean {
  return !!s.board.rivers?.some((r) => r.edges.includes(edge));
}

/** Liegt eine dieser Ecken an einem Fluss (Ende einer Flusskante)? */
function touchesRiver(s: GameState, vertices: number[]): boolean {
  if (!s.board.rivers?.length) return false;
  const topo = getTopology(s.board);
  return s.board.rivers.some((r) => r.edges.some((e) => vertices.includes(topo.edges[e].a) || vertices.includes(topo.edges[e].b)));
}

function roadCoins(s: GameState, seat: number, edge: number): void {
  const e = getTopology(s.board).edges[edge];
  if (touchesRiver(s, [e.a, e.b])) earnCoins(s, seat, RIVER_COINS, 'Straße am Fluss');
}

function earnCoins(s: GameState, seat: number, n: number, why: string): void {
  if (!s.coins || s.players[seat].neutral) return;
  s.coins[seat] += n;
  log(s, seat, `${name(s, seat)} bekommt ${n === 1 ? 'eine Münze' : `${n} Münzen`} (${why}).`);
}

/**
 * Flussläufe: Wer die meisten Münzen hat, bekommt 1 Punkt, wer die wenigsten hat, verliert 2. Bei
 * Gleichstand gilt das für alle Gleichen; haben alle gleich viele, gibt es weder Plus noch Minus.
 */
export function coinPoints(s: GameState, seat: number): number {
  if (!s.coins || s.players[seat].neutral) return 0;
  const counts = s.players.flatMap((p, i) => (p.neutral ? [] : [s.coins![i]]));
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  if (max === min) return 0;
  return s.coins[seat] === max ? 1 : s.coins[seat] === min ? -2 : 0;
}

/** Der Rest eines Wurfs mit festen Zahlenwürfeln (auch für das Losbuch): Ereigniswürfel, Flotte, Ertrag. */
function rollDice(s: GameState, seat: number, dice: [number, number]): void {
  s.dice = dice;
  const sum = dice[0] + dice[1];
  // Stadtwacht: Zuerst der Ereigniswürfel; ein Schiff bringt die Plündererflotte näher.
  if (s.raiders) s.event = EVENT_FACES[randomInt(s, 6)];
  const event = s.raiders ? ` · ${s.event === 'ship' ? 'Schiff' : `Tor ${TRACK_NAMES[s.event as Track]}`}` : '';
  log(s, seat, `${name(s, seat)} würfelt ${sum} (${dice[0]} + ${dice[1]})${event}.`);
  if (s.raiders && s.event === 'ship' && advanceRaiders(s, sum)) return;
  // Ein Tor: Einflusskarten für alle, deren Ausbau in dieser Farbe zum roten Würfel passt.
  if (s.progress && s.event && s.event !== 'ship') drawOnGate(s, s.event, dice[1]);
  afterRoll(s, sum);
}

/** Ereigniswürfel: drei Seiten Schiff, je eine Seite ein Tor. */
const EVENT_FACES: readonly EventFace[] = ['ship', 'ship', 'ship', 'market', 'council', 'scholars'];

/** Stadtwacht: Der Räuber kommt erst nach dem ersten Angriff der Flotte ins Spiel. */
export function robberActive(s: GameState): boolean {
  return !s.raiders || s.raiders.attacked;
}

/** Nach der 7 und dem Abwerfen: Räuber versetzen, oder (Stadtwacht vor dem ersten Angriff) weiter. */
function robberOrOn(s: GameState): void {
  if (robberActive(s)) {
    s.phase = { kind: 'robber', returnTo: 'main' };
  } else {
    log(s, null, 'Der Räuber kommt erst nach dem ersten Angriff der Flotte ins Spiel.');
    s.phase = { kind: 'main' };
  }
}

/** Stärke der Flotte: alle Städte der Spieler, Prachtstädte eingeschlossen. */
export function raiderStrength(s: GameState): number {
  return s.buildings.filter((b) => b?.type === 'city' && !s.players[b.owner].neutral).length;
}

/** Verteidigung je Sitz: Summe der Stufen aller einsatzbereiten Wächter. */
export function defenseOf(s: GameState, seat: number): number {
  return (s.guards ?? []).reduce((n, g) => n + (g && g.owner === seat && g.active ? g.level : 0), 0);
}

/** Städte, die die Flotte nehmen kann: gewöhnliche, keine Prachtstädte. */
export function vulnerableCities(s: GameState, seat: number): number[] {
  return s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'city' && !isMetropolis(s, v) ? [v] : []));
}

function downgradeCity(s: GameState, vertex: number): void {
  const owner = s.buildings[vertex]!.owner;
  s.buildings[vertex] = { owner, type: 'settlement' };
  if (s.walls) s.walls = s.walls.filter((v) => v !== vertex);
  log(s, owner, `${name(s, owner)} verliert eine Stadt an die Plündererflotte.`);
}

/**
 * Die Flotte rückt vor; am Ende der Leiste greift sie an. Liefert true, wenn Spieler eine Stadt
 * wählen müssen (Phase `raid`), sonst geht der Wurf gleich weiter.
 */
function advanceRaiders(s: GameState, sum: number): boolean {
  const r = s.raiders!;
  r.position++;
  if (r.position < RAIDER_TRACK) {
    log(s, null, `Die Plündererflotte rückt vor (${r.position} von ${RAIDER_TRACK}).`);
    return false;
  }
  r.position = 0;
  r.attacked = true;
  const humans = s.players.flatMap((p, i) => (p.neutral ? [] : [i]));
  const strength = raiderStrength(s);
  const contrib = s.players.map((_, i) => defenseOf(s, i));
  const defense = humans.reduce((n, i) => n + contrib[i], 0);
  log(s, null, `Die Plündererflotte greift an: Stärke ${strength} gegen Verteidigung ${defense}.`);
  const pending = s.players.map(() => 0);
  const picks = s.players.map(() => 0);
  if (strength > defense) {
    // Wer am wenigsten beigetragen hat und eine gewöhnliche Stadt besitzt, verliert eine.
    const exposed = humans.filter((i) => vulnerableCities(s, i).length > 0);
    const least = Math.min(...exposed.map((i) => contrib[i]));
    for (const i of exposed.filter((i) => contrib[i] === least)) {
      const cities = vulnerableCities(s, i);
      if (cities.length === 1) downgradeCity(s, cities[0]);
      else pending[i] = 1;
    }
    if (!exposed.length) log(s, null, 'Die Flotte findet keine Stadt, die sie nehmen kann.');
  } else {
    const most = Math.max(...humans.map((i) => contrib[i]));
    const leaders = humans.filter((i) => contrib[i] === most);
    if (most > 0 && leaders.length === 1) {
      s.honors![leaders[0]]++;
      log(s, leaders[0], `${name(s, leaders[0])} hat am meisten verteidigt und bekommt einen Ehrenschild (1 Siegpunkt).`);
    } else if (most > 0 && s.progress) {
      // Gleichstand: Jeder der Besten zieht eine Einflusskarte, die Farbe wählt er selbst.
      log(s, null, 'Die Flotte ist abgewehrt. Mehrere haben gleich viel verteidigt; jeder von ihnen zieht eine Einflusskarte.');
      for (const i of leaders) if (s.progress[i].length < PROGRESS_LIMIT && TRACKS.some((t) => progressStackSize(s, t) > 0)) picks[i] = 1;
    } else {
      log(s, null, 'Die Flotte ist abgewehrt. Mehrere haben gleich viel verteidigt, einen Ehrenschild gibt es diesmal nicht.');
    }
  }
  // Nach jedem Angriff ruhen alle Wächter.
  for (const g of s.guards ?? []) if (g) g.active = false;
  if (pending.some((n) => n > 0)) {
    s.phase = { kind: 'raid', pending, sum };
    return true;
  }
  if (picks.some((n) => n > 0)) {
    s.phase = { kind: 'progressPick', pending: picks, sum };
    return true;
  }
  return false;
}

function guardCount(s: GameState, seat: number, level: 1 | 2 | 3): number {
  return (s.guards ?? []).filter((g) => g?.owner === seat && g.level === level).length;
}

function ownGuard(s: GameState, seat: number, vertex: number): Guard {
  const g = s.guards?.[vertex];
  if (!g || g.owner !== seat) fail('Dort steht kein eigener Wächter.');
  return g;
}

function readyGuard(s: GameState, seat: number, vertex: number): Guard {
  const g = ownGuard(s, seat, vertex);
  if (!g.active) fail('Der Wächter ist nicht einsatzbereit.');
  if ((g.ready ?? 0) > s.turn) fail('Ein gerade bereit gemachter Wächter handelt erst im nächsten Zug.');
  return g;
}

/** Freie Ecke (kein Gebäude, kein Wächter) an einer eigenen Straße. */
export function canPlaceGuard(s: GameState, seat: number, vertex: number): boolean {
  const v = getTopology(s.board).vertices[vertex];
  if (!v || !s.guards || s.buildings[vertex] || s.guards[vertex]) return false;
  return v.edges.some((e) => s.roads[e] === seat);
}

export function legalGuardVertices(s: GameState, seat: number): number[] {
  if (!s.guards || guardCount(s, seat, 1) >= GUARDS_PER_LEVEL) return [];
  return getTopology(s.board).vertices.filter((v) => canPlaceGuard(s, seat, v.id)).map((v) => v.id);
}

/** Wohin ein verdrängter Wächter darf: freie Ecken an den Straßen seines Besitzers. */
export function guardSpots(s: GameState, seat: number): number[] {
  return getTopology(s.board).vertices.filter((v) => canPlaceGuard(s, seat, v.id)).map((v) => v.id);
}

/**
 * Ziele eines Wächters: über eigene Straßen erreichbar, ohne durch fremde Gebäude oder Wächter zu gehen.
 * Frei oder mit einem schwächeren fremden Wächter (der wird verdrängt).
 */
export function guardTargets(s: GameState, seat: number, from: number): number[] {
  const g = s.guards?.[from];
  if (!g || g.owner !== seat) return [];
  const topo = getTopology(s.board);
  const seen = new Set([from]);
  const queue = [from];
  const targets: number[] = [];
  while (queue.length) {
    const v = queue.shift()!;
    for (const e of topo.vertices[v].edges) {
      if (s.roads[e] !== seat) continue;
      const edge = topo.edges[e];
      const w = edge.a === v ? edge.b : edge.a;
      if (seen.has(w)) continue;
      seen.add(w);
      const b = s.buildings[w];
      const other = s.guards![w];
      if (b && b.owner !== seat) continue;
      if (other && other.owner !== seat) {
        if (other.level < g.level) targets.push(w);
        continue;
      }
      if (!b && !other) targets.push(w);
      queue.push(w);
    }
  }
  return targets;
}

/** Handkartenlimit beim Würfeln einer 7: 7, mit Palisaden (Stadtwacht) je 2 mehr. */
export function handLimit(s: GameState, seat: number): number {
  return 7 + 2 * wallsOf(s, seat);
}

/** Kann der Spieler diese Richtung jetzt ausbauen (Stadt, Güter, nicht voll, Platz für eine Prachtstadt)? */
export function canImprove(s: GameState, seat: number, track: Track): boolean {
  if (!s.improvements) return false;
  const next = s.improvements[seat][track] + 1;
  if (next > 5 || count(s.players[seat].resources, TRACK_GOODS[track]) < improveCost(s, seat, next)) return false;
  const cities = s.buildings.some((b) => b?.owner === seat && b.type === 'city');
  if (!cities) return false;
  return !metropolisGain(s, seat, track, next) || metropolisCandidates(s, seat).length > 0;
}

/** Städte ohne Palisade, solange der Spieler noch Palisaden hat. */
export function legalWallVertices(s: GameState, seat: number): number[] {
  if (!s.walls || wallsOf(s, seat) >= MAX_WALLS) return [];
  return s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'city' && !s.walls!.includes(v) ? [v] : []));
}

function wallsOf(s: GameState, seat: number): number {
  return (s.walls ?? []).filter((v) => s.buildings[v]?.owner === seat).length;
}

export function isMetropolis(s: GameState, vertex: number): boolean {
  return !!s.metropolis && TRACKS.some((t) => s.metropolis![t] === vertex);
}

/**
 * Bringt diese Ausbaustufe eine Prachtstadt? Als Erster auf Stufe 4, oder als Erster auf Stufe 5, wenn der
 * Inhaber nur Stufe 4 hat.
 */
export function metropolisGain(s: GameState, seat: number, track: Track, level: number): boolean {
  const at = s.metropolis?.[track];
  if (at === undefined) return false;
  if (level === 4) return at === null;
  if (level !== 5 || at === null) return false;
  const holder = s.buildings[at]?.owner;
  return holder !== undefined && holder !== seat && s.improvements![holder][track] < 5;
}

/** Städte, die Prachtstadt werden können: eigene Städte, die noch keine sind. */
export function metropolisCandidates(s: GameState, seat: number): number[] {
  return s.buildings.flatMap((b, v) => (b?.owner === seat && b.type === 'city' && !isMetropolis(s, v) ? [v] : []));
}

function metropolisCity(s: GameState, seat: number, cities: number[], vertex: number | undefined): number {
  const free = cities.filter((v) => !isMetropolis(s, v));
  if (!free.length) fail('Für die Prachtstadt brauchst du eine Stadt, die noch keine ist.');
  const target = vertex ?? (free.length === 1 ? free[0] : undefined);
  if (target === undefined || !free.includes(target)) fail('Wähle die Stadt, die Prachtstadt wird.');
  return target;
}

/** Siegziel eines Spielers: Wer den Rostigen Anker hat, braucht einen Punkt mehr. */
export function victoryTarget(s: GameState, seat: number): number {
  return s.settings.victoryPoints + (s.anchor === seat ? 1 : 0);
}

/** Fischgründe: Der See ersetzt die Wüste des Räubers, der Räuber beginnt neben dem Brett. */
function setUpFishing(s: GameState): void {
  const lake = s.robber;
  s.board = { ...s.board, hexes: s.board.hexes.map((h, i) => (i === lake ? { terrain: 'lake', number: null } : h)) };
  s.robber = -1;
  s.board.fishing = placeFishingGrounds(s.board, s);
  s.fish = s.players.map(() => []);
  s.fishPool = { ...FISH_POOL };
  s.anchor = null;
}

/** Fischgründe mit der gewürfelten Zahl und der See (2, 3, 11, 12): je Siedlung 1, je Stadt 2 Plättchen. */
function catchFish(s: GameState, sum: number): void {
  const topo = getTopology(s.board);
  const catches = s.players.map(() => 0);
  const credit = (v: number) => {
    const b = s.buildings[v];
    if (b && !s.players[b.owner].neutral) catches[b.owner] += b.type === 'city' ? 2 : 1;
  };
  for (const f of s.board.fishing ?? []) {
    if (f.number !== sum) continue;
    credit(topo.edges[f.edge].a);
    credit(topo.edges[f.edge].b);
  }
  if (LAKE_NUMBERS.includes(sum)) {
    s.board.hexes.forEach((h, id) => {
      if (h.terrain === 'lake' && id !== s.robber) topo.hexes[id].corners.forEach(credit);
    });
  }
  catches.forEach((n, seat) => {
    let caught = 0;
    for (let i = 0; i < n; i++) {
      const token = drawFrom<string>(s, s.fishPool!);
      if (token === null) break;
      if (token === 'anchor') {
        s.anchor = seat;
        log(s, seat, `${name(s, seat)} zieht den Rostigen Anker und braucht jetzt einen Punkt mehr zum Sieg.`);
      } else {
        s.fish![seat].push(Number(token));
        caught++;
      }
    }
    if (caught) log(s, seat, `${name(s, seat)} fängt ${caught === 1 ? 'einen Fisch' : `${caught} Fische`}.`);
  });
}

/** Summe der Fischplättchen eines Spielers. */
export function fishTotal(s: GameState, seat: number): number {
  return (s.fish?.[seat] ?? []).reduce((a, b) => a + b, 0);
}

/** Kann der Spieler das jetzt mit Fischen bezahlen und ausführen? */
export function canSpendFish(s: GameState, seat: number, effect: FishEffect): boolean {
  if (!s.fish || s.current !== seat || s.phase.kind !== 'main' || fishTotal(s, seat) < FISH_COSTS[effect]) return false;
  switch (effect) {
    case 'robber':
      return s.robber >= 0;
    case 'steal':
      return s.players.some((p, i) => i !== seat && handSize(p) > 0);
    case 'bank':
      return RESOURCES.some((r) => s.bank[r] > 0);
    case 'road':
      return canLayFreePiece(s, seat);
    case 'devCard':
      return deckSize(s) > 0;
  }
}

/**
 * Bezahlt mit Fischplättchen: die kleinste Summe ab `cost` (Wechselgeld gibt es nicht), bei gleicher
 * Summe mit möglichst wenigen Plättchen. Die Plättchen gehen zurück in den Stapel.
 */
function payFish(s: GameState, seat: number, cost: number): void {
  const tokens = s.fish![seat];
  const reach = new Map<number, number[]>([[0, []]]);
  tokens.forEach((value, i) => {
    for (const [sum, picked] of [...reach]) {
      const next = [...picked, i];
      const old = reach.get(sum + value);
      if (!old || next.length < old.length) reach.set(sum + value, next);
    }
  });
  let best: number[] | null = null;
  let bestSum = Infinity;
  for (const [sum, picked] of reach) {
    if (sum >= cost && (sum < bestSum || (sum === bestSum && picked.length < best!.length))) {
      best = picked;
      bestSum = sum;
    }
  }
  if (!best) fail(`Dafür brauchst du Fische im Wert von ${cost}.`);
  for (const i of best) s.fishPool![tokens[i]] = (s.fishPool![tokens[i]] ?? 0) + 1;
  s.fish![seat] = tokens.filter((_, i) => !best.includes(i));
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
  if (s.coins && hasResources(res, COSTS.bridge) && piecesLeft(s, seat, 'bridge') > 0 && legalBridgeEdges(s, seat).length > 0) return true;
  if (s.improvements && TRACKS.some((t) => canImprove(s, seat, t))) return true;
  if (s.walls && hasResources(res, COSTS.wall) && legalWallVertices(s, seat).length > 0) return true;
  if (s.guards && hasResources(res, COSTS.guard) && legalGuardVertices(s, seat).length > 0) return true;
  return hasResources(res, COSTS.road) && piecesLeft(s, seat, 'road') > 0 && legalRoadEdges(s, seat).length > 0;
}

// ---------------------------------------------------------------------------
// Stadtwacht III: Einflusskarten

/** Die drei Stapel zu Spielbeginn, als Zählwerk je Farbe. */
export function progressDecks(): Record<Track, Partial<Record<ProgressCard, number>>> {
  const decks: Record<Track, Partial<Record<ProgressCard, number>>> = { market: {}, council: {}, scholars: {} };
  for (const c of PROGRESS_CARDS) decks[PROGRESS[c].track][c] = PROGRESS[c].copies;
  return decks;
}

/** Karten in einem Stapel, auch in einer Sicht ohne Stapelinhalt. */
export function progressStackSize(s: GameState, track: Track): number {
  if (s.hiddenProgressDeck) return s.hiddenProgressDeck[track];
  return Object.values(s.progressDeck?.[track] ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
}

/** Einflusskarten eines Spielers auf der Hand, auch verdeckt. */
export function progressCount(s: GameState, seat: number): number {
  const hidden = s.players[seat]?.hidden?.progress;
  return hidden ? TRACKS.reduce((n, t) => n + hidden[t], 0) : (s.progress?.[seat]?.length ?? 0);
}

/** Zieht ein Spieler bei diesem Tor? Ausbaustufe s zieht bei einem roten Würfel bis s+1. */
export function drawsOnGate(s: GameState, seat: number, track: Track, red: number): boolean {
  const level = s.improvements?.[seat]?.[track] ?? 0;
  return level >= 1 && red <= level + 1;
}

/** Ein Tor auf dem Ereigniswürfel: Ziehen in Zugreihenfolge, beginnend beim aktiven Spieler. */
function drawOnGate(s: GameState, track: Track, red: number): void {
  const n = humanCount(s);
  const seats = Array.from({ length: n }, (_, k) => (s.current + k) % n).filter((i) => drawsOnGate(s, i, track, red));
  if (!seats.length) return;
  for (const seat of seats) {
    if (!progressStackSize(s, track)) {
      log(s, null, `Der Stapel ${TRACK_NAMES[track]} ist leer.`);
      return;
    }
    drawProgress(s, seat, track);
  }
}

/** Eine Einflusskarte ziehen; Punktkarten liegen sofort offen aus, eine volle Hand zieht nicht. */
function drawProgress(s: GameState, seat: number, track: Track): void {
  if (s.progress![seat].length >= PROGRESS_LIMIT) {
    log(s, seat, `${name(s, seat)} hat schon ${PROGRESS_LIMIT} Einflusskarten und zieht keine.`);
    return;
  }
  const card = drawFrom(s, s.progressDeck![track]);
  if (!card) return;
  if (PROGRESS[card].point) {
    s.progressPoints![seat]++;
    s.progressPlayed!.push(card);
    log(s, seat, `${name(s, seat)} zieht ${PROGRESS[card].name} und legt sie aus (1 Siegpunkt).`);
  } else {
    s.progress![seat].push(card);
    log(s, seat, `${name(s, seat)} zieht eine Einflusskarte (${TRACK_NAMES[track]}).`);
  }
}

/** Güter für die nächste Ausbaustufe; der Flaschenzug spart eines. */
export function improveCost(s: GameState, seat: number, level: number): number {
  return Math.max(0, level - (s.boost?.pulley && s.current === seat ? 1 : 0));
}

function checkWall(s: GameState, seat: number, vertex: number): void {
  const b = s.buildings[vertex];
  if (b?.owner !== seat || b.type !== 'city') fail('Eine Palisade kommt nur unter eine eigene Stadt.');
  if (s.walls!.includes(vertex)) fail('Diese Stadt hat schon eine Palisade.');
  if (wallsOf(s, seat) >= MAX_WALLS) fail(`Mehr als ${MAX_WALLS} Palisaden gibt es nicht.`);
}

function nextGuardLevel(s: GameState, seat: number, g: Guard): 2 | 3 {
  if (g.level >= 3) fail('Dieser Wächter hat schon die höchste Stufe.');
  if (g.level === 2 && s.improvements![seat].council < 3) fail('Mächtige Wächter gibt es erst mit dem Rat auf Stufe 3.');
  const next = (g.level + 1) as 2 | 3;
  if (guardCount(s, seat, next) >= GUARDS_PER_LEVEL) fail(`Du hast schon ${GUARDS_PER_LEVEL} Wächter der Stufe ${next}.`);
  return next;
}

/** Kann dieser Wächter jetzt eine Stufe aufsteigen (ohne die Kosten)? */
export function canRaiseGuard(s: GameState, seat: number, vertex: number): boolean {
  const g = s.guards?.[vertex];
  if (!g || g.owner !== seat) return false;
  try {
    nextGuardLevel(s, seat, g);
    return true;
  } catch {
    return false;
  }
}

function steal(s: GameState, seat: number, victim: number): void {
  const pool = cardList(s.players[victim].resources);
  if (!pool.length) return;
  const stolen = pool[randomInt(s, pool.length)];
  addCard(s.players[victim].resources, stolen, -1);
  addCard(s.players[seat].resources, stolen, 1);
  s.transfers.push({ from: seatPoint(victim), to: seatPoint(seat), card: stolen, count: 1, hidden: true });
}

/** Großeinkauf und Zunftrecht: Jeder Mitspieler gibt bis zu `max` Karten dieser Art. */
function collect(s: GameState, seat: number, card: Card, max: number): number {
  let total = 0;
  s.players.forEach((p, i) => {
    if (i === seat || p.neutral) return;
    const n = Math.min(max, count(p.resources, card));
    if (!n) return;
    addCard(p.resources, card, -n);
    total += n;
    transfer(s, seatPoint(i), seatPoint(seat), card, n);
  });
  addCard(s.players[seat].resources, card, total);
  return total;
}

/** Wasserrad und Stollen: 2 Karten je passendem Feld an eigenen Orten, so weit die Bank reicht. */
function harvest(s: GameState, seat: number, r: Resource, card: string): void {
  const topo = getTopology(s.board);
  const hexes = new Set<number>();
  s.buildings.forEach((b, v) => {
    if (b?.owner === seat) for (const h of topo.vertices[v].hexes) if (s.board.hexes[h].terrain === r) hexes.add(h);
  });
  if (!hexes.size) fail(`An deinen Orten liegt kein Feld mit ${RESOURCE_NAMES[r]}.`);
  if (!s.bank[r]) fail(`Die Bank hat kein ${RESOURCE_NAMES[r]} mehr.`);
  let got = 0;
  for (const h of hexes) {
    const n = Math.min(2, s.bank[r]);
    s.bank[r] -= n;
    got += n;
    transfer(s, { kind: 'hex', id: h }, seatPoint(seat), r, n);
  }
  s.players[seat].resources[r] += got;
  log(s, seat, `${name(s, seat)} spielt ${card} und bekommt ${got} ${RESOURCE_NAMES[r]}.`);
}

type ProgressArgs = { card?: Card; vertices: number[]; hexes: number[]; edge?: number; target?: number; dice?: [number, number] };

/** Wanderhändler: Felder mit Rohstoff an eigenen Siedlungen und Städten. */
export function traderHexes(s: GameState, seat: number): number[] {
  const topo = getTopology(s.board);
  return topo.hexes
    .filter((h) => isResource(s.board.hexes[h.id].terrain) && h.corners.some((v) => s.buildings[v]?.owner === seat))
    .map((h) => h.id)
    .filter((h) => !(s.trader?.hex === h && s.trader.owner === seat));
}

/** Schuldschein: Mitspieler mit mehr Siegpunkten und mindestens einer Karte. */
export function richerPlayers(s: GameState, seat: number): number[] {
  const mine = victoryPoints(s, seat, false);
  return s.players.flatMap((p, i) => (i !== seat && !p.neutral && victoryPoints(s, i, false) > mine && handSize(p) > 0 ? [i] : []));
}

/** Kundschafter: Mitspieler mit Einflusskarten. */
export function scoutTargets(s: GameState, seat: number): number[] {
  return s.players.flatMap((p, i) => (i !== seat && !p.neutral && progressCount(s, i) > 0 ? [i] : []));
}

/** Flurbereinigung: Zahlenfelder an Land außer 2, 12, 6 und 8. */
export function reformHexes(s: GameState): number[] {
  return s.board.hexes.flatMap((h, id) => (h.number != null && isLand(h.terrain) && ![2, 12, 6, 8].includes(h.number) ? [id] : []));
}

/**
 * Gesandter: offene Straßen. Mindestens ein Ende stößt an nichts Eigenes (keine Siedlung, Stadt, Wächter
 * oder weitere Straße des Besitzers). Brücken und Straßen der Neutralen bleiben liegen.
 */
export function openRoads(s: GameState): number[] {
  const topo = getTopology(s.board);
  return s.roads.flatMap((owner, e) => {
    if (owner === null || s.players[owner].neutral || isRiverEdge(s, e)) return [];
    const edge = topo.edges[e];
    const loose = [edge.a, edge.b].some(
      (v) =>
        s.buildings[v]?.owner !== owner &&
        s.guards?.[v]?.owner !== owner &&
        !topo.vertices[v].edges.some((o) => o !== e && s.roads[o] === owner),
    );
    return loose ? [e] : [];
  });
}

/** Überläufer: fremde Wächter, deren Stufe der Spieler noch aufstellen darf. */
export function turncoatTargets(s: GameState, seat: number): number[] {
  return (s.guards ?? []).flatMap((g, v) => (g && g.owner !== seat && guardCount(s, seat, g.level) < GUARDS_PER_LEVEL ? [v] : []));
}

/** Ränkespiel: fremde Wächter an einer eigenen Straße. */
export function intrigueTargets(s: GameState, seat: number): number[] {
  const topo = getTopology(s.board);
  return (s.guards ?? []).flatMap((g, v) => (g && g.owner !== seat && topo.vertices[v].edges.some((e) => s.roads[e] === seat) ? [v] : []));
}

/** Einen Wächter vom Brett nehmen; sein Besitzer setzt ihn um, wenn er Platz hat. */
function pushGuard(s: GameState, vertex: number): void {
  const g = s.guards![vertex]!;
  s.guards![vertex] = null;
  if (guardSpots(s, g.owner).length) s.phase = { kind: 'displace', seat: g.owner, guard: g };
  else log(s, g.owner, `Der Wächter von ${name(s, g.owner)} findet keinen Platz und geht zurück in den Vorrat.`);
}

const PLAY: Record<ProgressCard, (s: GameState, seat: number, a: ProgressArgs) => void> = {
  bulkBuy(s, seat, { card }) {
    if (!card || !isResource(card)) fail('Nenne einen Rohstoff.');
    const got = collect(s, seat, card, 2);
    log(s, seat, `${name(s, seat)} spielt Großeinkauf auf ${RESOURCE_NAMES[card]} und bekommt ${got} Karten.`);
  },
  guildRight(s, seat, { card }) {
    if (!card || !isCommodity(card)) fail('Nenne ein Gut.');
    const got = collect(s, seat, card, 1);
    log(s, seat, `${name(s, seat)} spielt Zunftrecht auf ${CARD_NAMES[card]} und bekommt ${got} Karten.`);
  },
  tradingPost(s, seat, { card }) {
    if (!card || !CARDS.includes(card)) fail('Wähle eine Kartenart.');
    s.boost = { ...s.boost, tradingPost: card };
    log(s, seat, `${name(s, seat)} spielt Frachtkontor: ${CARD_NAMES[card]} tauscht sie in diesem Zug 2:1.`);
  },
  charter() {
    fail('Punktkarten liegen schon aus.');
  },
  observatory() {
    fail('Punktkarten liegen schon aus.');
  },
  alarmBell(s, seat) {
    const sleeping = (s.guards ?? []).filter((g): g is Guard => !!g && g.owner === seat && !g.active);
    if (!sleeping.length) fail('Du hast keinen ruhenden Wächter.');
    for (const g of sleeping) {
      g.active = true;
      g.ready = s.turn + 1;
    }
    log(s, seat, `${name(s, seat)} spielt Alarmglocke: ${sleeping.length === 1 ? 'ein Wächter wird' : `${sleeping.length} Wächter werden`} einsatzbereit.`);
  },
  agitator(s, seat) {
    const mine = victoryPoints(s, seat, false);
    const pending = s.players.map((p, i) =>
      i !== seat && !p.neutral && victoryPoints(s, i, false) >= mine ? Math.floor(totalResources(p.resources) / 2) : 0,
    );
    log(s, seat, `${name(s, seat)} spielt Unruhestifter.`);
    if (pending.some((n) => n > 0)) {
      s.phase = { kind: 'discard', pending, then: 'main' };
      const who = pending.flatMap((n, i) => (n > 0 ? [`${name(s, i)} (${n})`] : []));
      log(s, null, `Karten abwerfen müssen: ${who.join(', ')}.`);
    }
  },
  banquet(s, seat) {
    const mine = victoryPoints(s, seat, false);
    const pending = s.players.map((p, i) =>
      i !== seat && !p.neutral && victoryPoints(s, i, false) > mine ? Math.min(2, totalResources(p.resources)) : 0,
    );
    log(s, seat, `${name(s, seat)} spielt Festbankett.`);
    if (pending.some((n) => n > 0)) s.phase = { kind: 'discard', pending, to: seat, then: 'main' };
  },
  taxCollector(s, seat) {
    if (!robberActive(s)) fail('Der Räuber ist noch nicht im Spiel.');
    log(s, seat, `${name(s, seat)} spielt Steuereintreiber.`);
    s.phase = { kind: 'robber', returnTo: 'main', all: true };
  },
  pulley(s, seat) {
    if (s.boost?.pulley) fail('Der Flaschenzug wirkt schon.');
    s.boost = { ...s.boost, pulley: true };
    log(s, seat, `${name(s, seat)} spielt Flaschenzug: Der nächste Ausbau kostet ein Gut weniger.`);
  },
  pileDriver(s, seat, { vertices }) {
    const vertex = vertices[0];
    checkWall(s, seat, vertex);
    s.walls!.push(vertex);
    log(s, seat, `${name(s, seat)} spielt Pfahlramme und baut eine Palisade (Handkartenlimit ${handLimit(s, seat)}).`);
  },
  waterwheel(s, seat) {
    harvest(s, seat, 'wheat', 'Wasserrad');
  },
  gallery(s, seat) {
    harvest(s, seat, 'ore', 'Stollen');
  },
  lodge(s, seat, { vertices }) {
    const vertex = vertices[0];
    const b = s.buildings[vertex];
    if (!b || b.owner !== seat || b.type !== 'settlement') fail('Wähle eine eigene Siedlung.');
    if (piecesLeft(s, seat, 'city') <= 0) fail('Du hast keine Städte mehr.');
    pay(s, seat, COSTS.lodge, { kind: 'vertex', id: vertex });
    b.type = 'city';
    log(s, seat, `${name(s, seat)} spielt Bauhütte und baut eine Stadt.`);
    updateHarborMaster(s);
  },
  surveyor(s, seat) {
    const remaining = Math.min(2, piecesLeft(s, seat, 'road') + (s.ships ? piecesLeft(s, seat, 'ship') : 0));
    if (remaining === 0 || !canLayFreePiece(s, seat)) fail('Du kannst gerade keine Straße bauen.');
    log(s, seat, `${name(s, seat)} spielt Landvermesser.`);
    s.phase = { kind: 'roadBuilding', remaining, returnTo: 'main' };
  },
  peddler(s, seat, { hexes }) {
    const hex = hexes[0];
    if (!traderHexes(s, seat).includes(hex)) fail('Der Händler kommt auf ein Rohstofffeld an deiner Siedlung oder Stadt.');
    const from = s.trader?.owner ?? null;
    s.trader = { hex, owner: seat };
    const what = RESOURCE_NAMES[s.board.hexes[hex].terrain as Resource];
    log(
      s,
      seat,
      from !== null && from !== seat
        ? `${name(s, seat)} holt sich den Händler von ${name(s, from)} (${what} 2:1).`
        : `${name(s, seat)} setzt den Händler (${what} 2:1).`,
    );
  },
  bond(s, seat, { target }) {
    if (target === undefined || !richerPlayers(s, seat).includes(target)) fail('Wähle einen Spieler mit mehr Siegpunkten und Karten.');
    log(s, seat, `${name(s, seat)} spielt Schuldschein und sieht sich die Hand von ${name(s, target)} an.`);
    s.phase = { kind: 'peek', seat, target, what: 'cards', take: Math.min(2, totalResources(s.players[target].resources)) };
  },
  fair(s, seat, { card }) {
    if (!card || !isResource(card)) fail('Nenne einen Rohstoff.');
    const me = s.players[seat];
    let n = 0;
    s.players.forEach((p, i) => {
      if (i === seat || p.neutral || me.resources[card] <= 0) return;
      const goods = cardList(p.resources).filter(isCommodity);
      if (!goods.length) return;
      const good = goods[randomInt(s, goods.length)];
      me.resources[card]--;
      p.resources[card]++;
      addCard(p.resources, good, -1);
      addCard(me.resources, good, 1);
      transfer(s, seatPoint(seat), seatPoint(i), card, 1);
      s.transfers.push({ from: seatPoint(i), to: seatPoint(seat), card: good, count: 1, hidden: true });
      n++;
    });
    log(s, seat, `${name(s, seat)} spielt Jahrmarkt: ${n === 1 ? 'ein Tausch' : `${n} Tausche`} ${RESOURCE_NAMES[card]} gegen Güter.`);
  },
  turncoat(s, seat, { vertices }) {
    const [from, to] = vertices;
    if (!turncoatTargets(s, seat).includes(from)) fail('Wähle einen fremden Wächter, dessen Stufe du noch aufstellen darf.');
    const g = s.guards![from]!;
    s.guards![from] = null;
    if (!canPlaceGuard(s, seat, to)) fail('Dein Wächter kommt auf eine freie Ecke an einer eigenen Straße.');
    s.guards![to] = { owner: seat, level: g.level, active: false };
    updateLongestRoad(s);
    log(s, seat, `${name(s, seat)} spielt Überläufer: Ein Wächter von ${name(s, g.owner)} läuft über.`);
  },
  envoy(s, seat, { edge }) {
    if (edge === undefined || !openRoads(s).includes(edge)) fail('Wähle eine offene Straße.');
    const owner = s.roads[edge]!;
    s.roads[edge] = null;
    updateLongestRoad(s);
    if (owner === seat) {
      log(s, seat, `${name(s, seat)} spielt Gesandter und verlegt eine eigene Straße.`);
      if (canLayFreePiece(s, seat)) s.phase = { kind: 'roadBuilding', remaining: 1, returnTo: 'main' };
    } else {
      log(s, seat, `${name(s, seat)} spielt Gesandter und entfernt eine Straße von ${name(s, owner)}.`);
    }
  },
  intrigue(s, seat, { vertices }) {
    const vertex = vertices[0];
    if (!intrigueTargets(s, seat).includes(vertex)) fail('Wähle einen fremden Wächter an deiner Straße.');
    log(s, seat, `${name(s, seat)} spielt Ränkespiel gegen einen Wächter von ${name(s, s.guards![vertex]!.owner)}.`);
    pushGuard(s, vertex);
    updateLongestRoad(s);
  },
  scout(s, seat, { target }) {
    if (target === undefined || !scoutTargets(s, seat).includes(target)) fail('Wähle einen Mitspieler mit Einflusskarten.');
    if (s.progress![seat].length >= PROGRESS_LIMIT) fail(`Du hast schon ${PROGRESS_LIMIT} Einflusskarten.`);
    log(s, seat, `${name(s, seat)} spielt Kundschafter bei ${name(s, target)}.`);
    s.phase = { kind: 'peek', seat, target, what: 'progress', take: 1 };
  },
  fortune(s, seat, { dice }) {
    if (!Array.isArray(dice) || dice.length !== 2 || !dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) fail('Lege beide Würfel fest (1 bis 6).');
    log(s, seat, `${name(s, seat)} spielt Losbuch.`);
    rollDice(s, seat, [dice[0], dice[1]]);
  },
  landReform(s, seat, { hexes }) {
    const [a, b] = hexes;
    const allowed = reformHexes(s);
    if (a === b || !allowed.includes(a) || !allowed.includes(b)) fail('Wähle zwei Zahlenfelder ohne 2, 12, 6 und 8.');
    s.board.hexes = s.board.hexes.map((h, id) => (id === a ? { ...h, number: s.board.hexes[b].number } : id === b ? { ...h, number: s.board.hexes[a].number } : h));
    log(s, seat, `${name(s, seat)} spielt Flurbereinigung und tauscht die ${s.board.hexes[b].number} gegen die ${s.board.hexes[a].number}.`);
  },
  armory(s, seat, { vertices }) {
    const targets = [...new Set(vertices)];
    if (!targets.length || targets.length > 2) fail('Wähle einen oder zwei deiner Wächter.');
    for (const v of targets) {
      const g = ownGuard(s, seat, v);
      g.level = nextGuardLevel(s, seat, g);
    }
    log(s, seat, `${name(s, seat)} spielt Waffenkammer und wertet ${targets.length === 1 ? 'einen Wächter' : 'zwei Wächter'} auf.`);
  },
};

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
  for (const k of CARDS) setCount(target, k, count(target, k) + count(add, k));
}

function takeFrom(target: ResourceCounts, take: ResourceCounts): void {
  for (const k of CARDS) setCount(target, k, count(target, k) - count(take, k));
}

/** Eine Karte mehr oder weniger. */
function addCard(target: ResourceCounts, card: Card, delta: number): void {
  setCount(target, card, count(target, card) + delta);
}

/** Nur die Kartenfelder übernehmen, damit keine fremden Felder im Spielstand landen. */
function pick(r: ResourceCounts): ResourceCounts {
  const result = emptyResources();
  for (const k of CARDS) setCount(result, k, count(r, k));
  return result;
}

function validateCounts(r: ResourceCounts): void {
  if (!r || CARDS.some((k) => !Number.isInteger(count(r, k)) || count(r, k) < 0)) fail('Ungültige Rohstoffangabe.');
}

/** Alle Karten einer Hand als Liste, z. B. um zufällig eine zu ziehen. */
function cardList(r: ResourceCounts): Card[] {
  return CARDS.flatMap((k) => Array<Card>(count(r, k)).fill(k));
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

function transfer(s: GameState, from: TransferPoint, to: TransferPoint, card: Card | 'dev', n: number): void {
  if (n > 0) s.transfers.push({ from, to, card, count: n });
}

function transferAll(s: GameState, from: TransferPoint, to: TransferPoint, counts: ResourceCounts): void {
  for (const k of CARDS) transfer(s, from, to, k, count(counts, k));
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
  s.playedDev = [...(s.playedDev ?? []), card];
  if (card !== 'knight') log(s, seat, `${name(s, seat)} spielt ${DEV_CARD_NAMES[card]}.`);
  else log(s, seat, `${name(s, seat)} spielt einen Ritter.`);
  return phase;
}

/** Verteilt den Ertrag; liefert, wie viele Rohstoffe jeder aus Goldfeldern noch selbst wählt. */
/** Der Rest eines Wurfs: bei einer 7 abwerfen und Räuber, sonst Ertrag. Mit Stadtwacht erst nach der Flotte. */
function afterRoll(s: GameState, sum: number): void {
  if (sum === 7) {
    const pending = s.players.map((p, i) => {
      const total = totalResources(p.resources);
      return total > handLimit(s, i) ? Math.floor(total / 2) : 0;
    });
    if (pending.some((n) => n > 0)) {
      s.phase = { kind: 'discard', pending };
      const who = pending.flatMap((n, i) => (n > 0 ? [`${name(s, i)} (${n})`] : []));
      log(s, null, `Räuber! Karten abwerfen müssen: ${who.join(', ')}.`);
    } else {
      robberOrOn(s);
    }
    return;
  }
  const { gold, got } = produce(s, sum);
  if (s.fish) catchFish(s, sum);
  // Stadtwacht, Gelehrte ab Stufe 3: Wer nichts bekommt, nimmt sich einen Rohstoff nach Wahl.
  if (s.improvements) {
    let left = RESOURCES.reduce((n, r) => n + s.bank[r], 0) - gold.reduce((a, b) => a + b, 0);
    s.players.forEach((p, i) => {
      if (p.neutral || got[i] || s.improvements![i].scholars < 3 || left <= 0) return;
      gold[i]++;
      left--;
      log(s, i, `${name(s, i)} bekommt nichts und nimmt sich dank der Gelehrten einen Rohstoff.`);
    });
  }
  s.phase = gold.some((n) => n > 0) ? { kind: 'gold', pending: gold } : { kind: 'main' };
}

/**
 * Verteilt den Ertrag; liefert, wie viele Rohstoffe jeder aus Goldfeldern noch selbst wählt, und wer
 * überhaupt etwas bekam. Stadtwacht: Städte auf Wald, Weide und Gebirge liefern 1 Rohstoff und 1 Gut.
 */
function produce(s: GameState, sum: number): { gold: number[]; got: boolean[] } {
  const topo = getTopology(s.board);
  const demand = new Map<Card, number[]>(CARDS.map((c) => [c, s.players.map(() => 0)]));
  const gold = s.players.map(() => 0);
  const sources: { hex: number; seat: number; card: Card; n: number }[] = [];
  const add = (hex: number, seat: number, card: Card, n: number) => {
    demand.get(card)![seat] += n;
    sources.push({ hex, seat, card, n });
  };
  s.board.hexes.forEach((hex, id) => {
    const terrain = hex.terrain;
    if (hex.number !== sum || id === s.robber || (!isResource(terrain) && terrain !== 'gold')) return;
    for (const v of topo.hexes[id].corners) {
      const b = s.buildings[v];
      // Neutrale Mitspieler sammeln nichts.
      if (!b || s.players[b.owner].neutral) continue;
      const n = b.type === 'city' ? 2 : 1;
      if (terrain === 'gold') {
        gold[b.owner] += n;
        continue;
      }
      const good = s.improvements && b.type === 'city' ? TERRAIN_GOODS[terrain] : undefined;
      if (good) {
        add(id, b.owner, terrain, 1);
        add(id, b.owner, good, 1);
      } else {
        add(id, b.owner, terrain, n);
      }
    }
  });

  const gained = s.players.map(() => emptyResources());
  for (const [card, wants] of demand) {
    const total = wants.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const receivers = wants.flatMap((n, seat) => (n > 0 ? [seat] : []));
    if (total <= count(s.bank, card)) {
      receivers.forEach((seat) => setCount(gained[seat], card, wants[seat]));
    } else if (receivers.length === 1) {
      setCount(gained[receivers[0]], card, count(s.bank, card));
    } else {
      log(s, null, `Die Bank hat nicht genug ${CARD_NAMES[card]}, niemand bekommt welches.`);
    }
  }

  // Für die Animation: Karten fliegen von den liefernden Feldern, höchstens so viele wie tatsächlich ausgezahlt.
  const left = gained.map((g) => ({ ...g }));
  for (const { hex, seat, card, n } of sources) {
    const k = Math.min(n, count(left[seat], card));
    addCard(left[seat], card, -k);
    transfer(s, { kind: 'hex', id: hex }, seatPoint(seat), card, k);
  }

  gained.forEach((g, seat) => {
    if (totalResources(g) === 0) return;
    takeFrom(s.bank, g);
    addTo(s.players[seat].resources, g);
    log(s, seat, `${name(s, seat)} erhält ${formatResources(g)}.`);
  });
  // Gold: höchstens so viel, wie die Bank noch an Rohstoffen hat.
  let available = RESOURCES.reduce((n, r) => n + s.bank[r], 0);
  const golds = gold.map((n) => {
    const take = Math.min(n, available);
    available -= take;
    return take;
  });
  return { gold: golds, got: gained.map((g, seat) => totalResources(g) > 0 || golds[seat] > 0) };
}

/** Stadtwacht: welches Gut eine Stadt auf diesem Gelände zusätzlich liefert. */
const TERRAIN_GOODS: Partial<Record<Resource, Commodity>> = { wood: 'paper', sheep: 'cloth', ore: 'coin' };

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
  delete s.boost;
  for (const p of s.players) {
    p.devCards.push(...p.newDevCards);
    p.newDevCards = [];
  }
  // Neutrale Mitspieler sitzen hinten und sind nie am Zug.
  s.current = (s.current + 1) % humanCount(s);
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
  if (vp >= victoryTarget(s, s.current)) {
    s.winner = s.current;
    s.phase = { kind: 'ended' };
    log(s, s.current, `${name(s, s.current)} gewinnt mit ${vp} Siegpunkten!`);
  }
}

function updateLongestRoad(s: GameState): void {
  // Neutrale Straßen blockieren, zählen aber nicht für die längste Handelsstraße.
  s.roadLengths = s.players.map((p, seat) => (p.neutral ? 0 : longestRoad(s, seat)));
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
      const guard = s.guards?.[next];
      if ((blocker && blocker.owner !== seat) || (guard && guard.owner !== seat)) best = Math.max(best, length + 1);
      else walk(next, length + 1, kind);
      visited.delete(e);
    }
  };

  topo.vertices.forEach((v) => {
    if (v.edges.some((e) => kindOf(e))) walk(v.id, 0, null);
  });
  return best;
}
