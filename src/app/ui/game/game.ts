import { afterRenderEffect, Component, computed, DestroyRef, effect, ElementRef, inject, isDevMode, output, signal, untracked, viewChild } from '@angular/core';
import {
  actingSeats,
  canSpendFish,
  Card,
  CARD_NAMES,
  CARDS,
  count,
  COSTS,
  isCommodity,
  deckSize,
  devCount,
  handSize,
  DEV_CARD_NAMES,
  DevCard,
  emptyResources,
  FISH_COSTS,
  FishEffect,
  fishTotal,
  GameState,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  legalSetupRoads,
  harborPoints,
  legalRobberHexes,
  legalShipEdges,
  movableShips,
  neutralSpots,
  legalSetupVertices,
  mapById,
  VARIANTS,
  piecesLeft,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  robberVictims,
  canSpendTokens,
  coinPoints,
  defenseOf,
  getTopology,
  guardSpots,
  guardTargets,
  legalGuardVertices,
  RAIDER_TRACK,
  raiderStrength,
  robberActive,
  vulnerableCities,
  legalWallVertices,
  metropolisCandidates,
  Track,
  TRACK_NAMES,
  TRACKS,
  legalBridgeEdges,
  TokenEffect,
  tokenCost,
  totalResources,
  victoryPoints,
  victoryTarget,
  canRaiseGuard,
  intrigueTargets,
  openRoads,
  reformHexes,
  richerPlayers,
  scoutTargets,
  traderHexes,
  turncoatTargets,
  COMMODITIES,
  PROGRESS,
  PROGRESS_LIMIT,
  ProgressCard,
  progressCount,
  progressStackSize,
} from '../../engine';
import { BOT_TAKEOVER_MS, RoomService } from '../../net/room.service';
import { Board } from '../board/board';
import { ChatBox } from '../shared/chat-box';
import { CardFace } from '../shared/card-face';
import { CARD_ART } from '../shared/card-art';
import { pieceImage } from '../shared/piece-art';
import { RESOURCE_ART } from '../shared/resource-art';
import { DEV_CARD_HELP } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';
import { CardInspector } from './card-inspector';
import { EndStats } from './end-stats';
import { BackgroundMusic } from '../shared/music';
import { fanfare, FANFARE_SECONDS } from '../shared/sounds';
import { Announcer } from '../shared/voice';
import { voiceEvents } from './announcer';
import { DiceTray, ROLL_DURATION_MS } from './dice-tray';
import { BannerEvent, EventBanner } from './event-banner';
import { FlyLayer } from './fly-layer';
import { hasOfferView, offerFor, OfferPanel } from './offer-panel';
import { TradeTable, withdrawOffers } from './trade-table';
import { CityPanel } from './city-panel';
import { chaptersFor } from '../rulebook/rule-content';
import { Rulebook } from '../rulebook/rulebook';

type BuildMode = 'road' | 'settlement' | 'city' | 'ship' | 'moveShip' | 'bridge' | 'wall' | 'metropolis' | 'guards' | 'guardMove' | 'progress';
type Dialog =
  | { kind: 'yearOfPlenty' }
  | { kind: 'monopoly' }
  | { kind: 'victim'; hex: number; victims: number[] }
  | { kind: 'fish'; step: 'menu' | 'steal' | 'bank' }
  | { kind: 'tokens'; step: 'menu' | 'trade' }
  | { kind: 'coins' }
  | { kind: 'guard'; vertex: number }
  | { kind: 'progress'; card: ProgressCard };

/** So lange darf man im eigenen Zug zögern, bevor der Erzfeind stichelt. */
const IDLE_TAUNT_MS = 45_000;

const FISH_EFFECTS: { effect: FishEffect; label: string }[] = [
  { effect: 'robber', label: 'Räuber vom Brett nehmen' },
  { effect: 'steal', label: 'Eine Karte bei einem Mitspieler ziehen' },
  { effect: 'bank', label: 'Einen Rohstoff aus der Bank nehmen' },
  { effect: 'road', label: 'Eine Straße kostenlos bauen' },
  { effect: 'devCard', label: 'Eine Entwicklungskarte kostenlos ziehen' },
];
type PrimaryAction = { label: string; run: (() => void) | null };

/** Trennstellen für die schmalen Einflusskarten in der Hand. */
const PROGRESS_BREAKS: Record<ProgressCard, string> = {
  bulkBuy: 'Groß\u00adeinkauf',
  guildRight: 'Zunft\u00adrecht',
  tradingPost: 'Fracht\u00adkontor',
  charter: 'Stadt\u00adrecht',
  alarmBell: 'Alarm\u00adglocke',
  agitator: 'Unruhe\u00adstifter',
  banquet: 'Fest\u00adbankett',
  taxCollector: 'Steuer\u00adeintreiber',
  pulley: 'Flaschen\u00adzug',
  pileDriver: 'Pfahl\u00adramme',
  waterwheel: 'Wasser\u00adrad',
  gallery: 'Stollen',
  lodge: 'Bau\u00adhütte',
  observatory: 'Stern\u00adwarte',
  surveyor: 'Land\u00advermesser',
  armory: 'Waffen\u00adkammer',
  peddler: 'Wander\u00adhändler',
  bond: 'Schuld\u00adschein',
  fair: 'Jahr\u00admarkt',
  turncoat: 'Über\u00adläufer',
  envoy: 'Gesandter',
  intrigue: 'Ränke\u00adspiel',
  scout: 'Kund\u00adschafter',
  fortune: 'Los\u00adbuch',
  landReform: 'Flur\u00adbereinigung',
};

/** Einflusskarten, deren Ziel auf dem Brett gewählt wird. */
const BOARD_TARGETS = ['city', 'settlement', 'guards', 'trader', 'numbers', 'road', 'enemyGuard', 'turncoat'];

const PLAYABLE: DevCard[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
const HIGHLIGHT_MS = 2600;
/** Wer am Zug ist und so lange nicht würfelt, für den würfelt sein eigener Client. */
const AUTO_ROLL_MS = 5000;

@Component({
  selector: 'app-game',
  imports: [Board, CardFace, CardInspector, ChatBox, CityPanel, DiceTray, EndStats, EventBanner, FlyLayer, OfferPanel, ResourcePicker, Rulebook, TradeTable],
  templateUrl: './game.html',
  styleUrl: './game.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class GameView {
  protected readonly room = inject(RoomService);
  readonly leave = output<void>();

  protected readonly resources = RESOURCES;
  /** Karten auf der Hand und in der Bank: Rohstoffe, mit Stadtwacht auch Güter. */
  protected readonly handCards = computed((): readonly Card[] => (this.g().improvements ? CARDS : RESOURCES));
  protected readonly n = count;
  protected readonly cardArt = CARD_ART;
  protected readonly resourceArt = RESOURCE_ART;
  protected readonly resourceNames = CARD_NAMES;
  protected readonly devNames = DEV_CARD_NAMES;
  protected readonly devHelp = DEV_CARD_HELP;
  protected readonly costs = COSTS;
  protected readonly pieceImage = pieceImage;

  protected readonly g = computed(() => this.room.game()!);
  protected readonly mapName = computed(() => mapById(this.g().board.map).name);
  /** Würfelstapel: verbleibende Karten bis zum Mischen. */
  protected readonly diceDeckLeft = computed(() => {
    const deck = this.g().diceDeck;
    return deck ? Object.values(deck).reduce((a, b) => a + b, 0) : null;
  });
  protected readonly variantNames = computed(() =>
    VARIANTS.filter((v) => this.g().settings.variants?.includes(v.id)).map((v) => v.name),
  );

  /** Sekundentakt für Wartezeiten (abwesende Spieler, Verbindungsanzeige). */
  private readonly now = signal(Date.now());
  private readonly reconnectingSince = signal<number | null>(null);
  private readonly pendingSince = signal<number | null>(null);

  /** Hinweis, solange das Spiel ohne erreichbaren Host oder ohne Mehrheit ist. */
  protected readonly connection = computed(() => {
    if (this.room.status() !== 'reconnecting') return null;
    const since = this.reconnectingSince() ?? this.now();
    return {
      text: this.room.isHost()
        ? 'Nur ein Teil der Spieler ist verbunden. Es geht weiter, sobald die Mehrheit wieder da ist.'
        : 'Verbindung zum Spiel unterbrochen. Verbinde neu …',
      // Erst nach einer Weile anbieten: neu verbinden lädt den Raum frisch.
      retry: !this.room.isHost() && this.now() - since > 15000,
    };
  });

  /** Eigener Zug ist unterwegs und noch nicht bestätigt (nach kurzer Zeit sichtbar). */
  protected readonly sending = computed(() => {
    const since = this.pendingSince();
    return since !== null && this.now() - since > 1000;
  });

  /** Spieler, auf die das Spiel gerade wartet, die aber nicht verbunden sind. */
  protected readonly absent = computed(() => {
    const g = this.g();
    const room = this.room.room();
    if (!room || this.seat() < 0 || g.phase.kind === 'ended') return [];
    return actingSeats(g).flatMap((seat) => {
      const entry = room.players.find((p) => p.id === g.players[seat].id);
      if (!entry || entry.peerId || entry.bot || seat === this.seat()) return [];
      // Nach BOT_TAKEOVER_MS spielt beim Host ein Bot für ihn weiter (siehe RoomService.runBot).
      const waited = this.now() - (entry.awaySince ?? this.now());
      return [{ seat, name: g.players[seat].name, color: g.players[seat].color, bot: waited >= BOT_TAKEOVER_MS, wait: Math.max(1, Math.ceil((BOT_TAKEOVER_MS - waited) / 1000)) }];
    });
  });
  protected readonly seat = this.room.mySeat;
  protected readonly me = computed(() => this.g().players[this.seat()] ?? null);
  protected readonly myColor = computed(() => this.me()?.color ?? '#ffffff');
  protected readonly myTurn = computed(() => actingSeats(this.g()).includes(this.seat()));
  protected readonly isCurrent = computed(() => this.g().current === this.seat());

  protected readonly buildMode = signal<BuildMode | null>(null);
  /** Schiff versetzen: das gewählte Schiff, danach kommt das Ziel. */
  protected readonly moveFrom = signal<number | null>(null);
  protected readonly goldPick = signal<ResourceCounts>(emptyResources());
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly tradeOpen = signal(false);
  /** Stadtwacht: Ausbau-Tafel im Dock und die Richtung, für die gerade eine Prachtstadt gewählt wird. */
  protected readonly cityOpen = signal(false);
  protected readonly metroTrack = signal<Track | null>(null);
  protected readonly cityWatch = computed(() => !!this.g().improvements);
  /** Stadtwacht III: Einflusskarte, für die gerade Ziele auf dem Brett gewählt werden, und gewählte Wächter. */
  protected readonly progressCard = signal<ProgressCard | null>(null);
  protected readonly progressPicks = signal<number[]>([]);
  protected readonly progressDefs = PROGRESS;
  protected readonly trackNames = TRACK_NAMES;
  protected readonly progressLimit = PROGRESS_LIMIT;
  /** Eigene Einflusskarten, nach Farbe sortiert. */
  protected readonly myProgress = computed(() => {
    const g = this.g();
    const cards = g.progress?.[this.seat()] ?? [];
    const order = (c: ProgressCard) => TRACKS.indexOf(PROGRESS[c].track);
    return [...cards].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map((card) => ({ card, ...PROGRESS[card], short: PROGRESS_BREAKS[card] }));
  });
  protected readonly canPlayProgress = computed(() => this.isCurrent() && (this.g().phase.kind === 'main' || this.g().phase.kind === 'roll'));
  /** Losbuch: die beiden Zahlenwürfel, die der Spieler festlegt. */
  protected readonly fortuneDice = signal<[number, number]>([3, 4]);
  protected readonly dieFaces = [1, 2, 3, 4, 5, 6];
  /** Was das Brett bei Feldzielen als Vorschau zeigt. */
  protected readonly hexGhost = computed(() => {
    if (this.buildMode() !== 'progress') return 'robber';
    return this.progressCard() === 'peddler' ? 'trader' : null;
  });
  /** Schuldschein und Kundschafter: was ich beim anderen sehe und nehmen darf. */
  protected readonly peek = computed(() => {
    const g = this.g();
    const phase = g.phase;
    if (phase.kind !== 'peek' || phase.seat !== this.seat()) return null;
    const target = g.players[phase.target];
    const cards = (g.progress?.[phase.target] ?? []).map((card) => ({ card, ...PROGRESS[card] }));
    return { ...phase, name: target.name, resources: target.resources, cards };
  });
  protected readonly peekPick = signal<ResourceCounts>(emptyResources());
  /** Die drei Stapel mit ihrer Größe, für die Bankleiste und die Farbwahl. */
  protected readonly progressStacks = computed(() => {
    const g = this.g();
    if (!g.progress) return null;
    return TRACKS.map((track) => ({ track, name: TRACK_NAMES[track], size: progressStackSize(g, track) }));
  });
  /** Gleichstand bei der Abwehr: Ich wähle die Farbe meiner Einflusskarte. */
  protected readonly progressPickDue = computed(() => {
    const phase = this.g().phase;
    return phase.kind === 'progressPick' && !!phase.pending[this.seat()];
  });
  /** Inhalt des Karten-Dialogs: Text, Ziele und ob die Karte jetzt geht. */
  protected readonly progressDialog = computed(() => {
    const d = this.dialog();
    if (d?.kind !== 'progress') return null;
    const def = PROGRESS[d.card];
    const g = this.g();
    const options: Card[] = def.target === 'resource' ? [...RESOURCES] : def.target === 'commodity' ? [...COMMODITIES] : def.target === 'card' ? [...this.handCards()] : [];
    const board = BOARD_TARGETS.includes(def.target ?? '');
    const seat = this.seat();
    const players = def.target === 'richer' ? richerPlayers(g, seat) : def.target === 'player' ? scoutTargets(g, seat) : null;
    let reason: string | null = null;
    if (!this.isCurrent()) reason = def.beforeRoll ? 'Spielbar in deinem Zug statt zu würfeln.' : 'Spielbar in deinem Zug nach dem Würfeln.';
    else if (def.beforeRoll && g.phase.kind !== 'roll') reason = 'Das Losbuch spielst du statt zu würfeln.';
    else if (!def.beforeRoll && g.phase.kind !== 'main') reason = g.phase.kind === 'roll' ? 'Erst würfeln, dann spielen.' : 'Gerade nicht spielbar.';
    else if (players && !players.length) reason = def.target === 'richer' ? 'Niemand hat mehr Siegpunkte als du und Karten.' : 'Kein Mitspieler hat Einflusskarten.';
    return { card: d.card, ...def, options, board, reason, players: players?.map((i) => ({ seat: i, name: g.players[i].name, color: g.players[i].color })) ?? null };
  });
  /** Stadtwacht II: Wächter, von dem aus gerade ein Ziel gewählt wird. */
  protected readonly guardFrom = signal<number | null>(null);
  /** Plündererflotte: Stand der Leiste, Stärke gegen Verteidigung, ob der Räuber schon da ist. */
  protected readonly raiders = computed(() => {
    const g = this.g();
    if (!g.raiders) return null;
    const humans = g.players.flatMap((p, i) => (p.neutral ? [] : [i]));
    return {
      position: g.raiders.position,
      steps: Array.from({ length: RAIDER_TRACK }, (_, i) => i < g.raiders!.position),
      strength: raiderStrength(g),
      defense: humans.reduce((n, i) => n + defenseOf(g, i), 0),
      robber: robberActive(g),
    };
  });
  protected readonly eventFace = computed(() => {
    const e = this.g().event;
    if (!e) return null;
    if (e === 'ship') return { cls: 'ship', image: 'web/icons/city/event-ship.png', title: 'Ereigniswürfel: Schiff' };
    // Stufe s zieht bei einem roten Würfel bis s+1.
    const red = this.g().dice?.[1] ?? 1;
    const from = Math.max(1, red - 1);
    return { cls: e, image: `web/icons/city/event-${e}.png`, title: `Ereigniswürfel: Tor ${TRACK_NAMES[e]}. Roter Würfel ${red}: Einflusskarten für alle mit ${TRACK_NAMES[e]} ab Stufe ${from}.` };
  });
  /** Was ein eigener Wächter gerade tun kann (für den Dialog). */
  protected readonly guardOptions = computed(() => {
    const d = this.dialog();
    const g = this.g();
    const seat = this.seat();
    if (d?.kind !== 'guard') return null;
    const guard = g.guards?.[d.vertex];
    if (!guard || guard.owner !== seat) return null;
    const me = this.me();
    const can = this.canBuildNow() && !!me;
    const afford = (cost: ResourceCounts) => !!me && hasResources(me.resources, cost);
    const turn = g.phase.kind === 'main' && g.current === seat;
    const ready = guard.active && (guard.ready ?? 0) <= g.turn && turn;
    const nextLevel = guard.level + 1;
    const levelFull = (g.guards ?? []).filter((x) => x?.owner === seat && x.level === nextLevel).length >= 2;
    const atRobber = g.robber >= 0 && getTopology(g.board).hexes[g.robber]?.corners.includes(d.vertex);
    return {
      vertex: d.vertex,
      level: guard.level,
      active: guard.active,
      activate: can && !guard.active && afford(COSTS.activate),
      upgrade: can && guard.level < 3 && !levelFull && afford(COSTS.guard) && (guard.level < 2 || (g.improvements?.[seat].council ?? 0) >= 3),
      move: ready && guardTargets(g, seat, d.vertex).length > 0,
      chase: ready && robberActive(g) && !!atRobber,
      upgradeHint: guard.level === 2 && (g.improvements?.[seat].council ?? 0) < 3 ? 'Stufe 3 erst mit dem Rat auf Stufe 3' : null,
    };
  });
  /** Vorbefüllung des Tauschtischs, z. B. das gespiegelte Angebot für ein Gegenangebot. */
  protected readonly tradePrefill = signal<{ give: ResourceCounts; want: ResourceCounts } | null>(null);
  /** Der Tisch bleibt offen, solange für den aktiven Spieler Angebote laufen, auch nach dem Neuladen. */
  protected readonly showTable = computed(
    () =>
      this.canTrade() &&
      (this.tradeOpen() || (this.isCurrent() && this.g().offers.some((o) => o.from === this.seat() || o.counter))),
  );
  /** Angebot des aktiven Spielers (oder das eigene an ihn) steht groß im Dock. */
  protected readonly offerView = computed(() => hasOfferView(this.g(), this.seat()));
  /** Vergrößert angesehene Entwicklungskarte samt Ausgangsposition in der Hand. */
  protected readonly inspect = signal<{ card: DevCard; origin: DOMRect } | null>(null);
  protected readonly rulesOpen = signal(false);
  /** Regelbuch: Grundspiel und alles, was in dieser Partie dazukommt. */
  protected readonly ruleChapters = computed(() => chaptersFor(this.g().settings, this.g().players.filter((p) => !p.neutral).length));
  /** Automatisch würfeln: Zeitpunkt, zu dem gewürfelt wird, und die verbleibenden Sekunden für die Anzeige. */
  protected readonly rollDeadline = signal<number | null>(null);
  private readonly rollTick = signal(Date.now());
  protected readonly autoRollMs = AUTO_ROLL_MS;
  protected readonly rollSeconds = computed(() => {
    const deadline = this.rollDeadline();
    return deadline === null ? null : Math.max(0, Math.ceil((deadline - this.rollTick()) / 1000));
  });
  /** Geöffnete Punkte-Übersicht eines Spielers, verankert unter seinem Eintrag. */
  protected readonly info = signal<{ seat: number; left: number; top: number } | null>(null);
  protected readonly sideTab = signal<'log' | 'chat'>('log');
  /** Verlauf und Chat aufgeklappt; zugeklappt bekommt das Brett die Breite. */
  protected readonly sideOpen = signal(localStorage.getItem('neuland:side') !== 'closed');
  /** Chatnachrichten, die ich schon gesehen habe (Chat-Reiter offen); der Zähler zeigt nur neue. */
  private readonly chatSeen = signal(0);
  protected readonly unreadChat = computed(() => Math.max(0, this.room.chat().length - this.chatSeen()));
  // Beim Entwickeln standardmäßig stumm, sonst an, solange man ihn nicht ausschaltet.
  protected readonly sound = signal(
    isDevMode() ? localStorage.getItem('neuland:sound') === 'on' : localStorage.getItem('neuland:sound') !== 'off',
  );
  /** Hintergrundmusik, standardmäßig aus. */
  protected readonly music = signal(localStorage.getItem('neuland:music') === 'on');
  private readonly player = new BackgroundMusic();
  /** Berater und Erzfeind; die Musik wird leiser, solange einer spricht. */
  private readonly announcer = new Announcer((seconds) => this.player.duck(seconds));
  /** Zug, in dem der Berater zuletzt ans Bauen erinnert hat. */
  private buildHintTurn = -Infinity;
  protected readonly discardPick = signal<ResourceCounts>(emptyResources());
  protected readonly plentyPick = signal<ResourceCounts>(emptyResources());
  protected readonly tokenPick = signal<ResourceCounts>(emptyResources());

  /** Duell: für welchen Neutralen gesetzt wird; ohne Wahl der erste mit freiem Platz. */
  protected readonly neutralOwner = signal<number | null>(null);
  protected readonly neutralChoice = computed(() => {
    const g = this.g();
    const phase = g.phase;
    if (phase.kind !== 'neutral' || !this.isCurrent()) return null;
    const options = neutralSpots(g, phase.piece).filter((n) => n.spots.length);
    const active = options.find((n) => n.owner === this.neutralOwner()) ?? options[0];
    return active ? { piece: phase.piece, options, active } : null;
  });

  /** Farbe der Bauvorschau: beim Setzen für einen Neutralen dessen Farbe. */
  protected readonly ghostTint = computed(() => {
    const g = this.g();
    const phase = g.phase;
    if (phase.kind === 'setup') return g.players[phase.owners?.[phase.index] ?? phase.order[phase.index]]?.color ?? this.myColor();
    const nc = this.neutralChoice();
    return nc ? g.players[nc.active.owner].color : this.myColor();
  });

  /** Flussläufe: eigene Münzen; 2 Münzen sind ein Rohstoff. */
  protected readonly myCoins = computed(() => this.g().coins?.[this.seat()] ?? null);
  protected readonly canTradeCoins = computed(() => (this.myCoins() ?? 0) >= 2 && this.isCurrent() && this.g().phase.kind === 'main');

  /** Duell: Handelsmarken und was sie gerade kosten. */
  protected readonly myTokens = computed(() => this.g().tokens?.[this.seat()] ?? null);
  protected readonly tokenOptions = computed(() => {
    const g = this.g();
    const seat = this.seat();
    if (!g.tokens || seat < 0) return [];
    const cost = tokenCost(g, seat);
    const options: { effect: TokenEffect; label: string }[] = [
      { effect: 'trade', label: 'Tausch erzwingen: 2 zufällige Karten vom Gegner gegen 2 deiner Wahl' },
      { effect: 'robber', label: 'Räuber zurück in die Wüste' },
    ];
    return options.map((o) => ({ ...o, cost, enabled: canSpendTokens(g, seat, o.effect) }));
  });
  protected readonly highlightNumber = signal<number | null>(null);
  /** Ereignis-Banner laufen nacheinander, das vorderste ist sichtbar. */
  private readonly bannerQueue = signal<BannerEvent[]>([]);
  protected readonly banner = computed(() => this.bannerQueue()[0] ?? null);
  private bannerId = 0;
  /** Der Siegerdialog erscheint erst, wenn das Sieg-Banner durchgelaufen ist. */
  protected readonly winnerReady = signal(false);
  /** Kurz eingeblendete Änderungen an der eigenen Hand („+2“, „−1“). */
  protected readonly handDelta = signal<{ values: Partial<Record<Card, number>>; id: number } | null>(null);

  private readonly logList = viewChild<ElementRef<HTMLElement>>('logList');
  private readonly fly = viewChild(FlyLayer);

  protected readonly rollKey = computed(() => {
    const g = this.g();
    return g.dice ? `${g.turn}:${g.dice.join('-')}` : null;
  });

  /** Darf ich gerade bauen (eigener Zug nach dem Würfeln oder Sonderbauphase)? */
  protected readonly canBuildNow = computed(() => {
    const g = this.g();
    const phase = g.phase;
    if (phase.kind === 'main') return g.current === this.seat();
    return phase.kind === 'specialBuild' && phase.queue[0] === this.seat();
  });

  protected readonly buildOptions = computed(() => {
    const g = this.g();
    const seat = this.seat();
    const me = this.me();
    const can = this.canBuildNow() && !!me;
    const afford = (cost: ResourceCounts) => !!me && hasResources(me.resources, cost);
    const option = (enabled: boolean, cost: ResourceCounts, blocked: string) => ({
      enabled,
      reason: enabled ? null : !this.canBuildNow() ? 'Gerade nicht dran' : !afford(cost) ? this.missing(cost) : blocked,
    });
    return {
      road: option(
        can && afford(COSTS.road) && piecesLeft(g, seat, 'road') > 0 && legalRoadEdges(g, seat).length > 0,
        COSTS.road,
        piecesLeft(g, seat, 'road') <= 0 ? 'Keine Straßen mehr' : 'Kein freier Platz',
      ),
      settlement: option(
        can && afford(COSTS.settlement) && piecesLeft(g, seat, 'settlement') > 0 && legalSettlementVertices(g, seat).length > 0,
        COSTS.settlement,
        piecesLeft(g, seat, 'settlement') <= 0 ? 'Keine Siedlungen mehr' : 'Kein Bauplatz an deinen Straßen',
      ),
      city: option(
        can && afford(COSTS.city) && piecesLeft(g, seat, 'city') > 0 && legalCityVertices(g, seat).length > 0,
        COSTS.city,
        piecesLeft(g, seat, 'city') <= 0 ? 'Keine Städte mehr' : 'Keine Siedlung zum Ausbauen',
      ),
      devCard: option(can && afford(COSTS.devCard) && deckSize(g) > 0, COSTS.devCard, 'Stapel ist leer'),
      ship: option(
        can && !!g.ships && afford(COSTS.ship) && piecesLeft(g, seat, 'ship') > 0 && legalShipEdges(g, seat).length > 0,
        COSTS.ship,
        piecesLeft(g, seat, 'ship') <= 0 ? 'Keine Schiffe mehr' : 'Kein Platz an deinen Küsten und Schiffen',
      ),
      guards: (() => {
        const own = (g.guards ?? []).some((x) => x?.owner === seat);
        const enabled = can && (own || (afford(COSTS.guard) && legalGuardVertices(g, seat).length > 0));
        return { enabled, reason: enabled ? null : !this.canBuildNow() ? 'Gerade nicht dran' : !afford(COSTS.guard) ? this.missing(COSTS.guard) : 'Kein freier Platz an deinen Straßen' };
      })(),
      wall: option(
        can && !!g.walls && afford(COSTS.wall) && legalWallVertices(g, seat).length > 0,
        COSTS.wall,
        'Keine Stadt ohne Palisade (höchstens 3)',
      ),
      bridge: option(
        can && !!g.coins && afford(COSTS.bridge) && piecesLeft(g, seat, 'bridge') > 0 && legalBridgeEdges(g, seat).length > 0,
        COSTS.bridge,
        piecesLeft(g, seat, 'bridge') <= 0 ? 'Keine Brücken mehr' : 'Keine Flusskante an deinen Straßen',
      ),
      moveShip: (() => {
        const enabled = g.phase.kind === 'main' && g.current === seat && movableShips(g, seat).length > 0;
        const reason = g.shipMoved ? 'Schon ein Schiff versetzt' : 'Kein Schiff am offenen Ende einer Linie';
        return { enabled, reason: enabled ? null : reason };
      })(),
    };
  });

  protected readonly buildHint = computed(() => {
    switch (this.buildMode()) {
      case 'road':
        return 'Wähle eine Kante für die Straße';
      case 'settlement':
        return 'Wähle eine Ecke für die Siedlung';
      case 'city':
        return 'Wähle eine Siedlung für die Stadt';
      case 'ship':
        return 'Wähle eine Kante am Meer für das Schiff';
      case 'bridge':
        return 'Wähle eine Flusskante für die Brücke';
      case 'wall':
        return 'Wähle eine eigene Stadt für die Palisade';
      case 'guards':
        return 'Freie Ecke: neuer Wächter. Eigener Wächter: bereit machen, aufwerten, ziehen';
      case 'guardMove':
        return 'Wähle das Ziel: freie Ecke an deinen Straßen oder ein schwächerer fremder Wächter';
      case 'metropolis':
        return `Wähle die Stadt, die Prachtstadt ${TRACK_NAMES[this.metroTrack() ?? 'market']} wird`;
      case 'moveShip':
        return this.moveFrom() === null ? 'Wähle das Schiff, das du versetzt' : 'Wähle, wohin das Schiff fährt';
      case 'progress': {
        const card = this.progressCard();
        if (!card) return '';
        const target = PROGRESS[card].target;
        const name = PROGRESS[card].name;
        if (target === 'city') return `${name}: Wähle die Stadt für die Palisade`;
        if (target === 'settlement') return `${name}: Wähle die Siedlung, die Stadt wird`;
        if (target === 'trader') return `${name}: Wähle ein Feld an deiner Siedlung oder Stadt`;
        if (target === 'numbers') return `${name}: Wähle zwei Zahlenfelder (${this.progressPicks().length} gewählt)`;
        if (target === 'road') return `${name}: Wähle eine offene Straße`;
        if (target === 'enemyGuard') return `${name}: Wähle einen fremden Wächter an deiner Straße`;
        if (target === 'turncoat') return this.progressPicks().length ? `${name}: Wähle den Platz für deinen Wächter` : `${name}: Wähle den fremden Wächter`;
        return `${name}: Wähle bis zu zwei Wächter (${this.progressPicks().length} gewählt)`;
      }
      default:
        return '';
    }
  });

  /** Seewege: Gibt es auf diesem Brett Schiffe? */
  protected readonly seafaring = computed(() => !!this.g().ships);

  protected readonly goldDue = computed(() => {
    const phase = this.g().phase;
    return phase.kind === 'gold' ? phase.pending[this.seat()] ?? 0 : 0;
  });

  /** Vorschau an Kanten: Schiff beim Schiffsbau und Versetzen, sonst Straße. */
  protected readonly edgeGhost = computed(() => {
    const mode = this.buildMode();
    if (mode === 'progress') return 'none';
    return mode === 'ship' || mode === 'moveShip' ? 'ship' : 'road';
  });

  protected readonly canTrade = computed(() => this.g().phase.kind === 'main' && this.seat() >= 0);

  protected readonly targets = computed(() => {
    const g = this.g();
    const seat = this.seat();
    const phase = g.phase;
    const none = { vertices: [] as number[], edges: [] as number[], hexes: [] as number[] };
    if (!this.myTurn()) return none;
    if (phase.kind === 'setup') {
      return phase.step === 'settlement' ? { ...none, vertices: legalSetupVertices(g) } : { ...none, edges: legalSetupRoads(g) };
    }
    if (phase.kind === 'robber' && !this.dialog()) {
      return { ...none, hexes: legalRobberHexes(g) };
    }
    if (phase.kind === 'roadBuilding') return { ...none, edges: [...legalRoadEdges(g, seat), ...legalShipEdges(g, seat)] };
    if (phase.kind === 'raid') return { ...none, vertices: phase.pending[seat] ? vulnerableCities(g, seat) : [] };
    if (phase.kind === 'displace') return { ...none, vertices: phase.seat === seat ? guardSpots(g, seat) : [] };
    if (phase.kind === 'neutral') {
      const nc = this.neutralChoice();
      if (!nc) return none;
      return phase.piece === 'road' ? { ...none, edges: nc.active.spots } : { ...none, vertices: nc.active.spots };
    }
    switch (this.buildMode()) {
      case 'road':
        return { ...none, edges: legalRoadEdges(g, seat) };
      case 'ship':
        return { ...none, edges: legalShipEdges(g, seat) };
      case 'bridge':
        return { ...none, edges: legalBridgeEdges(g, seat) };
      case 'wall':
        return { ...none, vertices: legalWallVertices(g, seat) };
      case 'guards': {
        const own = (g.guards ?? []).flatMap((x, v) => (x?.owner === seat ? [v] : []));
        const me = this.me();
        const free = me && hasResources(me.resources, COSTS.guard) ? legalGuardVertices(g, seat) : [];
        return { ...none, vertices: [...free, ...own] };
      }
      case 'guardMove': {
        const from = this.guardFrom();
        return { ...none, vertices: from === null ? [] : guardTargets(g, seat, from) };
      }
      case 'metropolis':
        return { ...none, vertices: metropolisCandidates(g, seat) };
      case 'moveShip': {
        const from = this.moveFrom();
        if (from === null) return { ...none, edges: movableShips(g, seat) };
        const without = { ...g, ships: g.ships!.map((o, e) => (e === from ? null : o)) };
        return { ...none, edges: legalShipEdges(without, seat).filter((e) => e !== from) };
      }
      case 'settlement':
        return { ...none, vertices: legalSettlementVertices(g, seat) };
      case 'city':
        return { ...none, vertices: legalCityVertices(g, seat) };
      case 'progress': {
        const target = PROGRESS[this.progressCard() ?? 'pulley'].target;
        const picks = this.progressPicks();
        if (target === 'city') return { ...none, vertices: legalWallVertices(g, seat) };
        if (target === 'settlement') return { ...none, vertices: legalCityVertices(g, seat) };
        if (target === 'trader') return { ...none, hexes: traderHexes(g, seat) };
        if (target === 'numbers') return { ...none, hexes: reformHexes(g).filter((h) => !picks.includes(h)) };
        if (target === 'road') return { ...none, edges: openRoads(g) };
        if (target === 'enemyGuard') return { ...none, vertices: intrigueTargets(g, seat) };
        if (target === 'turncoat') {
          if (!picks.length) return { ...none, vertices: turncoatTargets(g, seat) };
          // Der übergelaufene Wächter macht seine Ecke frei.
          const without = { ...g, guards: g.guards!.map((x, v) => (v === picks[0] ? null : x)) };
          return { ...none, vertices: guardSpots(without, seat) };
        }
        const chosen = this.progressPicks();
        const own = (g.guards ?? []).flatMap((x, v) => (x?.owner === seat && (chosen.includes(v) || canRaiseGuard(g, seat, v)) ? [v] : []));
        return { ...none, vertices: chosen.length >= 2 ? chosen : own };
      }
    }
    return none;
  });

  protected readonly ghost = computed(() => {
    const phase = this.g().phase;
    if (phase.kind === 'setup' && phase.step === 'settlement') return 'settlement';
    if (phase.kind === 'neutral' && phase.piece === 'settlement') return 'settlement';
    const mode = this.buildMode();
    return mode === 'settlement' || mode === 'city' ? mode : null;
  });

  protected readonly status = computed(() => {
    const g = this.g();
    const phase = g.phase;
    const name = (seat: number) => g.players[seat].name;
    const mine = this.myTurn();
    switch (phase.kind) {
      case 'setup': {
        const who = phase.order[phase.index];
        const humans = g.players.filter((p) => !p.neutral).length;
        const rounds = phase.owners ? 3 : 2;
        const round = phase.index < humans ? 1 : phase.index < 2 * humans ? 2 : 3;
        const owner = phase.owners?.[phase.index] ?? who;
        const what = (phase.step === 'settlement' ? 'eine Siedlung' : 'eine Straße') + (owner !== who ? ` für ${name(owner)}` : '');
        return mine ? `Aufbau ${round}/${rounds}: Setze ${what}` : `Aufbau ${round}/${rounds}: ${name(who)} setzt ${what}`;
      }
      case 'roll':
        return mine ? 'Du bist dran: Würfeln!' : `${name(g.current)} würfelt …`;
      case 'discard': {
        const waiting = phase.pending.flatMap((n, i) => (n > 0 ? [name(i)] : []));
        const due = phase.pending[this.seat()];
        if (phase.to !== undefined) return mine ? `Festbankett: Schenke ${name(phase.to)} ${due} Karten` : `Festbankett: Warte auf ${waiting.join(', ')}`;
        const why = phase.then === 'main' ? 'Unruhe!' : 'Räuber!';
        return mine ? `${why} Wirf ${due} Karten ab` : `${why} Warte auf ${waiting.join(', ')}`;
      }
      case 'peek':
        return phase.seat === this.seat()
          ? `Nimm dir ${phase.take === 1 ? 'eine Karte' : `${phase.take} Karten`} von ${name(phase.target)}`
          : `${name(phase.seat)} sieht sich die ${phase.what === 'cards' ? 'Hand' : 'Einflusskarten'} von ${name(phase.target)} an`;
      case 'progressPick': {
        const waiting = phase.pending.flatMap((n, i) => (n > 0 ? [name(i)] : []));
        return phase.pending[this.seat()] ? 'Gleichstand bei der Abwehr: Wähle die Farbe deiner Einflusskarte' : `Einflusskarten: Warte auf ${waiting.join(', ')}`;
      }
      case 'gold': {
        const waiting = phase.pending.flatMap((n, i) => (n > 0 ? [name(i)] : []));
        const due = phase.pending[this.seat()];
        return mine ? `Gold! Wähle ${due} Rohstoff${due > 1 ? 'e' : ''}` : `Gold: Warte auf ${waiting.join(', ')}`;
      }
      case 'robber':
        if (phase.all) {
          return this.isCurrent() ? 'Steuereintreiber: Versetze den Räuber, du ziehst bei jedem am Feld' : `${name(g.current)} treibt Steuern ein`;
        }
        if (g.pirate !== undefined) {
          return this.isCurrent()
            ? 'Versetze Räuber (Land) oder Kaperschiff (Meer): Klicke auf ein Feld'
            : `${name(g.current)} versetzt Räuber oder Kaperschiff`;
        }
        return this.isCurrent() ? 'Versetze den Räuber: Klicke auf ein Feld' : `${name(g.current)} versetzt den Räuber`;
      case 'main':
        return this.isCurrent() ? 'Handeln und bauen' : `${name(g.current)} ist am Zug`;
      case 'roadBuilding':
        return this.isCurrent()
          ? `Straßenbau: noch ${phase.remaining} kostenlose Straße${phase.remaining > 1 ? 'n' : ''}`
          : `${name(g.current)} baut kostenlose Straßen`;
      case 'specialBuild':
        return mine ? 'Sonderbauphase: Du darfst bauen' : `Sonderbauphase: ${name(phase.queue[0])} baut`;
      case 'raid':
        return phase.pending[this.seat()]
          ? 'Die Flotte plündert: Wähle die Stadt, die du verlierst'
          : `Die Flotte plündert: Warte auf ${phase.pending.flatMap((n, i) => (n ? [name(i)] : [])).join(', ')}`;
      case 'displace':
        return phase.seat === this.seat() ? 'Dein Wächter wurde verdrängt: Wähle einen neuen Platz' : `${name(phase.seat)} setzt einen verdrängten Wächter um`;
      case 'neutral': {
        const what = phase.piece === 'road' ? 'eine Straße' : 'eine Siedlung';
        const nc = this.neutralChoice();
        return mine && nc ? `Setze ${what} für ${name(nc.active.owner)}` : `${name(g.current)} setzt ${what} für einen Neutralen`;
      }
      case 'ended':
        return g.winner !== null ? `${name(g.winner)} hat gewonnen!` : 'Spiel beendet';
    }
  });

  /** Farbe der Statuspille: der Spieler, auf den gerade alle warten. */
  protected readonly statusColor = computed(() => {
    const g = this.g();
    const seat = actingSeats(g)[0] ?? g.winner ?? g.current;
    return g.players[seat]?.color ?? 'transparent';
  });

  protected readonly primary = computed((): PrimaryAction => {
    const g = this.g();
    const phase = g.phase.kind;
    if (this.seat() < 0) return { label: 'Zuschauer', run: null };
    if (phase === 'roll' && this.isCurrent()) {
      const seconds = this.rollSeconds();
      return { label: seconds === null ? 'Würfeln' : `Würfeln · ${seconds}`, run: () => this.roll() };
    }
    if (phase === 'main' && this.isCurrent()) return { label: 'Zug beenden', run: () => this.endTurn() };
    if (phase === 'specialBuild' && this.myTurn()) return { label: 'Fertig mit Bauen', run: () => this.endTurn() };
    if (phase === 'ended') return { label: 'Endstand zeigen', run: this.winnerHidden() ? () => this.winnerHidden.set(false) : null };
    if (this.myTurn()) {
      // Die Aktion passiert auf dem Brett oder in einem Dialog: sagen, was zu tun ist.
      const hint: Partial<Record<typeof phase, string>> = {
        setup: 'Auf dem Brett platzieren',
        robber: 'Feld für den Räuber wählen',
        roadBuilding: 'Straßen auf dem Brett wählen',
        neutral: 'Neutrales Teil setzen',
        raid: 'Stadt auf dem Brett wählen',
        displace: 'Neuen Platz wählen',
        discard: g.phase.kind === 'discard' && g.phase.to !== undefined ? 'Karten verschenken' : 'Karten abwerfen',
        progressPick: 'Farbe wählen',
        peek: 'Karten nehmen',
      };
      return { label: hint[phase] ?? 'Du bist dran', run: null };
    }
    const waitingFor = actingSeats(g).map((s) => g.players[s].name);
    // Die Uhr der anderen ist nur ein Hinweis: Würfeln tut der Client des Spielers am Zug. Ist er getrennt oder
    // hält ein Dialog seine Uhr an, steht hier nach Ablauf wieder „Warte auf …“.
    const seconds = this.rollSeconds();
    const online = !!this.room.room()?.players.find((p) => p.id === g.players[g.current].id)?.peerId;
    if (phase === 'roll' && seconds && online) return { label: `${g.players[g.current].name} würfelt in ${seconds}`, run: null };
    // Bei vielen Wartenden (etwa beim Abwerfen nach einer 7) nur die Anzahl, sonst wird der Knopf zu breit.
    return { label: waitingFor.length > 2 ? `Warte auf ${waitingFor.length} Spieler` : `Warte auf ${waitingFor.join(', ')}`, run: null };
  });

  protected readonly playerRows = computed(() => {
    const g = this.g();
    const members = this.room.room()?.players ?? [];
    return g.players.map((p, seat) => ({
      seat,
      name: p.name,
      color: p.color,
      vp: victoryPoints(g, seat, seat === this.seat() || g.phase.kind === 'ended'),
      cards: handSize(p),
      dev: devCount(p),
      knights: p.knights,
      road: g.roadLengths[seat],
      longestRoad: g.longestRoad === seat,
      largestArmy: g.largestArmy === seat,
      harborMaster: g.harborMaster === seat,
      anchor: g.anchor === seat,
      neutral: !!p.neutral,
      tokens: g.tokens?.[seat] ?? null,
      progress: g.progress ? progressCount(g, seat) : null,
      trader: g.trader?.owner === seat,
      coinRank: coinPoints(g, seat),
      honors: g.honors?.[seat] ?? 0,
      active: actingSeats(g).includes(seat),
      // Beim Abwerfen sind mehrere „dran“; dort zählt die Kartenzahl, also kein „am Zug“.
      discarding: g.phase.kind === 'discard' && (g.phase.pending[seat] ?? 0) > 0,
      online: !!members.find((m) => m.id === p.id)?.peerId,
      bot: (() => {
        const m = members.find((x) => x.id === p.id);
        return !!m && !m.peerId && (!!m.bot || this.now() - (m.awaySince ?? this.now()) >= BOT_TAKEOVER_MS) && g.phase.kind !== 'ended';
      })(),
      // Bot aus der Lobby: ist nie verbunden, gilt aber nicht als „getrennt“.
      lobbyBot: !!members.find((x) => x.id === p.id)?.bot,
      me: seat === this.seat(),
    }));
  });

  /** Plätze, die ich als Zuschauer übernehmen darf: getrennte Spieler oder mein eigener Name. */
  protected readonly claimable = computed(() => {
    if (this.seat() >= 0) return [];
    const myName = this.room.name();
    return (this.room.room()?.players ?? []).filter((p) => !p.peerId || p.name === myName);
  });

  protected readonly myDevCards = computed(() => {
    const me = this.me();
    if (!me) return [];
    const cards: DevCard[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'];
    return cards
      .map((card) => ({
        card,
        ready: me.devCards.filter((c) => c === card).length,
        fresh: me.newDevCards.filter((c) => c === card).length,
      }))
      .filter((c) => c.ready + c.fresh > 0);
  });

  /** Status und Spielbarkeit der gerade vergrößerten Karte. */
  protected readonly inspected = computed(() => {
    const i = this.inspect();
    const me = this.me();
    if (!i || !me) return null;
    const ready = me.devCards.includes(i.card);
    const canPlay = this.isPlayable(i.card) && ready && this.canPlayDev();
    let status: string;
    if (i.card === 'victoryPoint') status = 'Zählt bereits als Siegpunkt.';
    else if (!ready) status = 'Neu gekauft: ab deinem nächsten Zug spielbar.';
    else if (canPlay) status = 'Jetzt spielbar.';
    else if (this.g().devPlayed && this.isCurrent()) status = 'In diesem Zug hast du schon eine Karte gespielt.';
    else if (!this.isCurrent()) status = 'Spielbar, wenn du am Zug bist.';
    else status = 'Gerade nicht spielbar.';
    return { ...i, status, canPlay };
  });

  /** Woraus sich die Siegpunkte eines Spielers zusammensetzen. Verdeckte Punkte sieht nur der Spieler selbst. */
  protected readonly infoData = computed(() => {
    const i = this.info();
    if (!i) return null;
    const g = this.g();
    const p = g.players[i.seat];
    if (!p) return null;
    const own = (type: 'settlement' | 'city') => g.buildings.filter((b) => b?.owner === i.seat && b.type === type).length;
    const showHidden = i.seat === this.seat() || g.phase.kind === 'ended';
    const devCards = [...p.devCards, ...p.newDevCards];
    return {
      ...i,
      name: p.name,
      color: p.color,
      me: i.seat === this.seat(),
      settlements: own('settlement'),
      cities: own('city'),
      longestRoad: g.longestRoad === i.seat,
      road: g.roadLengths[i.seat],
      largestArmy: g.largestArmy === i.seat,
      knights: p.knights,
      islandBonus: g.islandBonus?.[i.seat] ?? null,
      harborVariant: g.harborMaster !== undefined,
      harborMaster: g.harborMaster === i.seat,
      harborPoints: harborPoints(g, i.seat),
      fishing: !!g.fish,
      fishCount: p.hidden?.fish ?? g.fish?.[i.seat].length ?? 0,
      coins: g.coins?.[i.seat] ?? null,
      improvements: g.improvements?.[i.seat] ?? null,
      defense: g.guards ? defenseOf(g, i.seat) : null,
      honors: g.honors?.[i.seat] ?? 0,
      progressPoints: g.progressPoints?.[i.seat] ?? 0,
      trader: g.trader?.owner === i.seat,
      progressCards: g.progress ? progressCount(g, i.seat) : null,
      metropolises: g.metropolis ? TRACKS.filter((t) => g.metropolis![t] !== null && g.buildings[g.metropolis![t]!]?.owner === i.seat).length : 0,
      coinPoints: coinPoints(g, i.seat),
      anchor: g.anchor === i.seat,
      target: victoryTarget(g, i.seat),
      vpCards: showHidden ? devCards.filter((c) => c === 'victoryPoint').length : null,
      hiddenDev: devCount(p),
      total: victoryPoints(g, i.seat, showHidden),
      cards: handSize(p),
    };
  });

  /** Fischgründe: eigene Plättchen, was man damit gerade tun kann, an wen der Anker darf. */
  protected readonly fishing = computed(() => !!this.g().fish);
  protected readonly myFish = computed(() => [...(this.g().fish?.[this.seat()] ?? [])].sort((a, b) => b - a));
  protected readonly myFishTotal = computed(() => fishTotal(this.g(), this.seat()));
  protected readonly holdsAnchor = computed(() => this.g().anchor === this.seat());
  protected readonly fishOptions = computed(() => {
    const g = this.g();
    const seat = this.seat();
    return FISH_EFFECTS.map((e) => ({ ...e, cost: FISH_COSTS[e.effect], enabled: seat >= 0 && canSpendFish(g, seat, e.effect) }));
  });
  protected readonly fishVictims = computed(() => {
    const g = this.g();
    return g.players.flatMap((p, i) => (i !== this.seat() && handSize(p) > 0 ? [i] : []));
  });
  protected readonly anchorTargets = computed(() => {
    const g = this.g();
    const seat = this.seat();
    if (g.anchor !== seat || !this.isCurrent() || g.phase.kind !== 'main') return [];
    const mine = victoryPoints(g, seat, false);
    return g.players.flatMap((_, i) => (i !== seat && victoryPoints(g, i, false) >= mine ? [i] : []));
  });

  protected readonly canPlayDev = computed(() => {
    const g = this.g();
    return this.isCurrent() && (g.phase.kind === 'roll' || g.phase.kind === 'main') && !g.devPlayed;
  });

  protected readonly discardDue = computed(() => {
    const phase = this.g().phase;
    return phase.kind === 'discard' ? phase.pending[this.seat()] ?? 0 : 0;
  });

  protected readonly logEntries = computed(() =>
    this.g().log.map((e) => ({ text: e.text, color: e.seat !== null ? this.g().players[e.seat].color : 'transparent' })),
  );

  /** Endstand: der Sieger zuerst (bei Punktgleichstand gewinnt, wer am Zug war), dann nach Punkten. */
  protected readonly finalRanking = computed(() => {
    const g = this.g();
    return [...this.playerRows()].sort(
      (a, b) => Number(b.seat === g.winner) - Number(a.seat === g.winner) || victoryPoints(g, b.seat, true) - victoryPoints(g, a.seat, true),
    );
  });
  /** Endstand weggeklickt, um das Brett anzusehen. */
  protected readonly winnerHidden = signal(false);

  protected readonly confetti = Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 2.8 + Math.random() * 2,
    color: ['#d23c3c', '#2f64d6', '#e6c24a', '#2f9a48', '#ee8a1c', '#9bc65a'][i % 6],
    rotate: Math.random() * 360,
  }));

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(clock);
      this.player.stop();
      this.announcer.stop();
    });

    effect(() => (this.music() ? this.player.start() : this.player.stop()));

    effect(() => {
      const count = this.room.chat().length;
      if (this.sideOpen() && this.sideTab() === 'chat') untracked(() => this.chatSeen.set(count));
    });

    // Automatisch würfeln: Steht der Wurf an, läuft eine Uhr (bei allen sichtbar). Ein offener Dialog hält sie
    // an, danach beginnt sie von vorn. Würfeln tut nur der Client dessen, der am Zug ist.
    let rollKey: string | null = null;
    let rollTimer: ReturnType<typeof setTimeout> | undefined;
    let rollTicker: ReturnType<typeof setInterval> | undefined;
    const stopRollClock = () => {
      clearTimeout(rollTimer);
      clearInterval(rollTicker);
    };
    inject(DestroyRef).onDestroy(stopRollClock);
    effect(() => {
      const g = this.g();
      // Dialoge und Banner halten die Uhr an; danach beginnt sie von vorn.
      const waiting = g.phase.kind === 'roll' && !this.dialog() && !this.inspect() && !this.banner();
      const key = waiting ? `${g.id}:${g.turn}:${g.current}` : null;
      untracked(() => {
        if (key === rollKey) return;
        rollKey = key;
        stopRollClock();
        if (!key) {
          this.rollDeadline.set(null);
          return;
        }
        this.rollDeadline.set(Date.now() + AUTO_ROLL_MS);
        this.rollTick.set(Date.now());
        rollTicker = setInterval(() => this.rollTick.set(Date.now()), 200);
        rollTimer = setTimeout(() => {
          clearInterval(rollTicker);
          // Läuft schon eine eigene Aktion (etwa ein Klick auf „Würfeln“ bei langsamer Verbindung), nicht nachlegen.
          if (this.isCurrent() && this.g().phase.kind === 'roll' && !this.dialog() && !this.inspect() && this.room.pending() === 0) this.roll();
        }, AUTO_ROLL_MS);
      });
    });
    effect(() => {
      const reconnecting = this.room.status() === 'reconnecting';
      untracked(() => this.reconnectingSince.set(reconnecting ? (this.reconnectingSince() ?? Date.now()) : null));
    });
    effect(() => {
      const pending = this.room.pending() > 0;
      untracked(() => this.pendingSince.set(pending ? (this.pendingSince() ?? Date.now()) : null));
    });

    // Baumodus verlassen, sobald sich die Phase ändert oder man nicht mehr dran ist.
    effect(() => {
      this.g().phase.kind;
      if (!this.canBuildNow()) untracked(() => this.buildMode.set(null));
    });

    effect(() => {
      if (!this.canTrade()) untracked(() => this.tradeOpen.set(false));
    });

    effect(() => {
      this.discardDue();
      untracked(() => this.discardPick.set(emptyResources()));
    });

    effect(() => {
      this.goldDue();
      untracked(() => this.goldPick.set(emptyResources()));
    });

    let wasMyTurn = false;
    effect(() => {
      const mine = this.myTurn() && this.g().phase.kind !== 'ended';
      if (mine && !wasMyTurn) {
        untracked(() => {
          if (this.sound()) {
            fanfare('kurz');
            this.player.duck(FANFARE_SECONDS.kurz);
            // In der Aufbauphase wird nicht gewürfelt, da passt keiner der Sätze.
            if (this.g().turn > 0) this.announcer.say('myTurn', (FANFARE_SECONDS.kurz - 1) * 1000);
          }
          const me = this.me();
          if (me) this.pushBanner({ kind: 'turn', title: this.bannerText(), name: me.name, color: me.color, tag: this.g().turn ? `Zug ${this.g().turn}` : 'Aufbauphase' });
        });
      }
      wasMyTurn = mine;
    });

    // Zögern im eigenen Zug: Nach 45 Sekunden ohne neuen Spielstand stichelt der Erzfeind, einmal je Zug.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTurn = -1;
    effect(() => {
      const g = this.g();
      const waiting = this.myTurn() && g.phase.kind === 'main' && g.turn !== idleTurn;
      clearTimeout(idleTimer);
      if (!waiting) return;
      idleTimer = setTimeout(() => {
        idleTurn = g.turn;
        if (this.sound()) this.announcer.say('idle');
      }, IDLE_TAUNT_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(idleTimer));

    // Mitspieler verlieren die Verbindung oder kommen zurück (Bots zählen nicht).
    let wasOnline: Map<number, boolean> | null = null;
    effect(() => {
      const online = new Map(
        this.playerRows()
          .filter((p) => !p.neutral && !p.lobbyBot && p.seat !== this.seat())
          .map((p) => [p.seat, p.online] as const),
      );
      untracked(() => {
        if (wasOnline && this.sound() && this.g().phase.kind !== 'ended') {
          for (const [seat, on] of online) {
            const before = wasOnline.get(seat);
            if (before === true && !on) this.announcer.say('playerLeft');
            else if (before === false && on) this.announcer.say('playerBack');
          }
        }
        wasOnline = online;
      });
    });

    // Ein neues Tauschangebot an mich meldet sich wie „Du bist dran“, im Tab-Titel und mit Ton.
    let lastOfferId: number | null = null;
    effect(() => {
      const g = this.g();
      const offer = offerFor(g, this.seat());
      const countered = g.offers.some((o) => o.counter && o.from === this.seat());
      const pending = offer && !offer.accepted.includes(this.seat()) && !countered ? offer : null;
      const mine = this.myTurn() && g.phase.kind !== 'ended';
      document.title = mine
        ? '● Du bist dran – Neuland'
        : pending
          ? `● Tauschangebot von ${g.players[g.current].name} – Neuland`
          : 'Neuland';
      if (pending && pending.id !== lastOfferId && this.sound()) untracked(() => this.announcer.say('tradeOffer'));
      lastOfferId = pending?.id ?? lastOfferId;
    });

    // Bei jedem neuen Spielstand: Karten fliegen lassen und die Änderung an der eigenen Hand anzeigen.
    // Nach einem Wurf erst, wenn die Würfel gelandet sind.
    let lastVersion: number | null = null;
    let lastGame: GameState | null = null;
    let lastRollKey: string | null = null;
    let previous: ResourceCounts | null = null;
    let deltaTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const g = this.g();
      const rollKey = this.rollKey();
      const current = this.me()?.resources ?? null;
      untracked(() => {
        // Ein anderer Spielstand derselben Runde (neue Partie, Host-Wechsel) zählt nicht als Spielzug:
        // keine Flüge, keine Banner, nur Vorwärtsschritte derselben Partie.
        const switched = lastGame !== null && lastGame.id !== g.id;
        if (switched) previous = null;
        const isNew = !switched && lastVersion !== null && g.version > lastVersion;
        const rolled = rollKey !== null && rollKey !== lastRollKey;
        const delay = rolled ? ROLL_DURATION_MS + 150 : 0;
        lastVersion = g.version;
        lastRollKey = rollKey;
        if (isNew) this.fly()?.play(g.transfers ?? [], this.seat(), delay);
        if (isNew && lastGame) this.detectEvents(lastGame, g, delay);
        if (isNew && lastGame && this.sound()) this.announce(lastGame, g, rolled, delay);
        if (g.phase.kind !== 'ended') {
          this.winnerReady.set(false);
          this.winnerHidden.set(false);
        } else if (!lastGame || switched) this.winnerReady.set(true);
        lastGame = g;

        if (current && previous) {
          const values: Partial<Record<Card, number>> = {};
          for (const r of CARDS) if (count(current, r) !== count(previous, r)) values[r] = count(current, r) - count(previous, r);
          if (Object.keys(values).length) {
            clearTimeout(deltaTimer);
            // Das „+n“ erscheint, wenn die Karten ankommen.
            deltaTimer = setTimeout(() => {
              this.handDelta.set({ values, id: Date.now() });
              deltaTimer = setTimeout(() => this.handDelta.set(null), 1800);
            }, isNew && (g.transfers ?? []).length ? delay + 650 : 0);
          }
        }
        previous = current ? { ...current } : null;
      });
    });

    afterRenderEffect(() => {
      this.logEntries();
      this.sideTab();
      this.sideOpen();
      const el = this.logList()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected nextBanner(): void {
    if (this.bannerQueue()[0]?.kind === 'win') this.winnerReady.set(true);
    this.bannerQueue.update((q) => q.slice(1));
  }

  private pushBanner(event: Omit<BannerEvent, 'id'>, delay = 0): void {
    const push = () => this.bannerQueue.update((q) => [...q, { ...event, id: ++this.bannerId }]);
    if (delay) setTimeout(push, delay);
    else push();
  }

  /** Erkennt Ereignisse aus dem Unterschied zwischen zwei Spielständen und stellt Banner dafür an. */
  /** Berater und Erzfeind kommentieren den neuen Spielstand; nach einem Wurf erst, wenn die Würfel liegen. */
  private announce(prev: GameState, g: GameState, rolled: boolean, delay: number): void {
    for (const event of voiceEvents(prev, g, this.seat())) this.announcer.say(event, delay);
    // Nach dem eigenen Wurf: Gibt es etwas zu bauen, mahnt der Berater, aber nicht jeden Zug.
    const seat = this.seat();
    if (rolled && prev.current === seat && g.phase.kind === 'main' && g.turn - this.buildHintTurn >= 3) {
      setTimeout(() => {
        const options = this.buildOptions();
        if (this.myTurn() && Object.values(options).some((o) => o.enabled)) {
          this.buildHintTurn = this.g().turn;
          this.announcer.say('canBuild');
        }
      }, delay);
    }
  }

  private detectEvents(prev: GameState, g: GameState, delay: number): void {
    const who = (seat: number) => ({ name: g.players[seat].name, color: g.players[seat].color });

    if (g.longestRoad !== null && g.longestRoad !== prev.longestRoad) {
      const from = prev.longestRoad;
      this.pushBanner({
        kind: 'road',
        title: 'Längste Handelsstraße',
        ...who(g.longestRoad),
        tag: from === null ? `+2 Punkte · ${g.roadLengths[g.longestRoad]} Straßen` : `übernimmt von ${g.players[from].name}`,
      });
    }
    for (const [seat, bonus] of (g.islandBonus ?? []).entries()) {
      const before = prev.islandBonus?.[seat] ?? 0;
      if (bonus > before) {
        this.pushBanner({ kind: 'island', title: 'Neue Insel', ...who(seat), tag: `+${bonus - before} Punkte` });
      }
    }
    if (g.harborMaster != null && g.harborMaster !== prev.harborMaster) {
      const from = prev.harborMaster;
      this.pushBanner({
        kind: 'harbor',
        title: 'Hafenvogt',
        ...who(g.harborMaster),
        tag: from == null ? `+2 Punkte · ${harborPoints(g, g.harborMaster)} Hafenpunkte` : `übernimmt von ${g.players[from].name}`,
      });
    }
    // Fischgründe: Der Rostige Anker wechselt den Besitzer.
    if (g.anchor != null && g.anchor !== prev.anchor) {
      const from = prev.anchor ?? null;
      this.pushBanner({
        kind: 'anchor',
        title: 'Rostiger Anker',
        ...who(g.anchor),
        tag: from === null ? 'braucht einen Punkt mehr zum Sieg' : `bekommt ihn von ${g.players[from].name}`,
      });
    }
    // Stadtwacht: Die Flotte hat angegriffen (Leiste wieder bei 0, vorher am Ende).
    if (g.raiders && prev.raiders && g.raiders.position === 0 && prev.raiders.position === RAIDER_TRACK - 1 && g.event === 'ship') {
      const lost = g.buildings.some((b, v) => b?.type === 'settlement' && prev.buildings[v]?.type === 'city');
      const shield = (g.honors ?? []).findIndex((h, i) => h > (prev.honors?.[i] ?? 0));
      this.pushBanner({
        kind: 'raid',
        title: lost ? 'Die Flotte plündert' : 'Flotte abgewehrt',
        ...(shield >= 0 ? who(shield) : { name: 'Alle', color: '#d4b06a' }),
        tag: shield >= 0 ? 'Ehrenschild, +1 Punkt' : lost ? 'Städte fallen' : 'Gleichstand bei der Verteidigung',
      });
    }
    if (g.largestArmy !== null && g.largestArmy !== prev.largestArmy) {
      const from = prev.largestArmy;
      this.pushBanner({
        kind: 'army',
        title: 'Größte Rittermacht',
        ...who(g.largestArmy),
        tag: from === null ? `+2 Punkte · ${g.players[g.largestArmy].knights} Ritter` : `übernimmt von ${g.players[from].name}`,
      });
    }

    // Monopol und Erfindung erkennt man an ihren Kartenbewegungen.
    const t = g.transfers ?? [];
    const target = t[0]?.to.kind === 'player' ? t[0].to.seat : null;
    const allTo = target !== null && t.every((x) => x.to.kind === 'player' && x.to.seat === target);
    if (allTo && t.every((x) => x.from.kind === 'player' && !x.hidden && x.card === t[0].card) && t[0].card !== 'dev') {
      const total = t.reduce((n, x) => n + x.count, 0);
      const card = t[0].card;
      this.pushBanner({ kind: 'monopoly', title: `Monopol auf ${CARD_NAMES[card]}`, ...who(target), tag: `bekommt ${total} Karten`, resource: isCommodity(card) ? undefined : card });
    } else if (allTo && t.every((x) => x.from.kind === 'bank' && x.card !== 'dev') && t.reduce((n, x) => n + x.count, 0) === 2 && prev.devPlayed !== g.devPlayed) {
      const resources = t.flatMap((x) => Array<Resource>(x.count).fill(x.card as Resource));
      this.pushBanner({ kind: 'plenty', title: 'Erfindung', ...who(target), tag: resources.map((r) => RESOURCE_NAMES[r]).join(' und '), resources });
    }

    if (g.phase.kind === 'ended' && prev.phase.kind !== 'ended') {
      if (g.winner === null) this.winnerReady.set(true);
      else {
        const vp = victoryPoints(g, g.winner, true);
        this.pushBanner({ kind: 'win', title: `${g.players[g.winner].name} gewinnt!`, ...who(g.winner), tag: `${vp} Siegpunkte` }, delay);
      }
    }
  }

  protected onLanded(sum: number): void {
    if (sum === 7) return;
    this.highlightNumber.set(sum);
    setTimeout(() => this.highlightNumber.update((n) => (n === sum ? null : n)), HIGHLIGHT_MS);
  }

  protected inspectCard(card: DevCard, event: MouseEvent): void {
    const el = (event.currentTarget as HTMLElement).querySelector('app-card-face') ?? (event.currentTarget as HTMLElement);
    this.inspect.set({ card, origin: el.getBoundingClientRect() });
  }

  protected playInspected(): void {
    const card = this.inspect()?.card;
    this.inspect.set(null);
    if (card) this.play(card);
  }

  protected toggleInfo(seat: number, event: MouseEvent): void {
    if (this.info()?.seat === seat) {
      this.info.set(null);
      return;
    }
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.info.set({ seat, left: Math.min(r.left, innerWidth - 300), top: r.bottom + 8 });
  }

  protected toggleBuild(mode: BuildMode): void {
    this.moveFrom.set(null);
    this.buildMode.update((m) => (m === mode ? null : mode));
  }

  protected toggleSide(): void {
    this.sideOpen.update((o) => !o);
    localStorage.setItem('neuland:side', this.sideOpen() ? 'open' : 'closed');
  }

  protected toggleMusic(): void {
    this.music.update((m) => !m);
    localStorage.setItem('neuland:music', this.music() ? 'on' : 'off');
  }

  protected toggleSound(): void {
    this.sound.update((s) => !s);
    localStorage.setItem('neuland:sound', this.sound() ? 'on' : 'off');
  }

  protected onVertex(vertex: number): void {
    const g = this.g();
    const nc = this.neutralChoice();
    if (g.phase.kind === 'raid') {
      this.room.act({ type: 'loseCity', vertex });
      return;
    }
    if (g.phase.kind === 'displace') {
      this.room.act({ type: 'placeDisplaced', vertex });
      return;
    }
    if (this.buildMode() === 'progress') {
      this.progressVertex(vertex);
      return;
    }
    if (this.buildMode() === 'guards' && g.guards?.[vertex]?.owner === this.seat()) {
      this.dialog.set({ kind: 'guard', vertex });
      return;
    }
    if (this.buildMode() === 'guardMove' && this.guardFrom() !== null) {
      this.room.act({ type: 'moveGuard', from: this.guardFrom()!, to: vertex });
      this.guardFrom.set(null);
      this.buildMode.set(null);
      return;
    }
    if (nc) this.room.act({ type: 'placeNeutral', owner: nc.active.owner, vertex });
    else if (this.buildMode() === 'guards') this.room.act({ type: 'buildGuard', vertex });
    else if (this.buildMode() === 'wall') this.room.act({ type: 'buildWall', vertex });
    else if (this.buildMode() === 'metropolis' && this.metroTrack()) {
      this.room.act({ type: 'improveCity', track: this.metroTrack()!, vertex });
      this.metroTrack.set(null);
    }
    else if (g.phase.kind === 'setup') this.room.act({ type: 'placeSettlement', vertex });
    else if (this.buildMode() === 'settlement') this.room.act({ type: 'buildSettlement', vertex });
    else if (this.buildMode() === 'city') this.room.act({ type: 'buildCity', vertex });
    this.buildMode.set(null);
  }

  protected onEdge(edge: number): void {
    const g = this.g();
    const mode = this.buildMode();
    if (mode === 'progress') {
      this.finishProgress({ edge });
      return;
    }
    if (mode === 'moveShip') {
      const from = this.moveFrom();
      if (from === null) {
        // Erst das Schiff wählen, dann das Ziel.
        this.moveFrom.set(edge);
        return;
      }
      this.room.act({ type: 'moveShip', from, to: edge });
    } else if (mode === 'bridge') {
      this.room.act({ type: 'buildBridge', edge });
    } else if (this.neutralChoice()) {
      this.room.act({ type: 'placeNeutral', owner: this.neutralChoice()!.active.owner, edge });
    } else if (g.phase.kind === 'setup') {
      this.room.act({ type: 'placeRoad', edge });
    } else if (mode === 'ship' || (g.phase.kind === 'roadBuilding' && !legalRoadEdges(g, this.seat()).includes(edge))) {
      this.room.act({ type: 'buildShip', edge });
    } else {
      this.room.act({ type: 'buildRoad', edge });
    }
    this.moveFrom.set(null);
    this.buildMode.set(null);
  }

  protected chooseGold(): void {
    this.room.act({ type: 'chooseGold', resources: this.goldPick() });
  }

  protected onHex(hex: number): void {
    const phase = this.g().phase;
    const card = this.progressCard();
    if (this.buildMode() === 'progress' && card) {
      if (card === 'peddler') return this.finishProgress({ hexes: [hex] });
      const picks = [...this.progressPicks(), hex];
      if (picks.length < 2) this.progressPicks.set(picks);
      else this.finishProgress({ hexes: picks });
      return;
    }
    // Steuereintreiber: Gezogen wird bei allen am Feld, keine Wahl.
    if (phase.kind === 'robber' && phase.all) {
      this.room.act({ type: 'moveRobber', hex, victim: null });
      return;
    }
    const victims = robberVictims(this.g(), this.seat(), hex);
    if (victims.length > 1) this.dialog.set({ kind: 'victim', hex, victims });
    else this.room.act({ type: 'moveRobber', hex, victim: victims[0] ?? null });
  }

  protected chooseVictim(victim: number): void {
    const d = this.dialog();
    if (d?.kind !== 'victim') return;
    this.room.act({ type: 'moveRobber', hex: d.hex, victim });
    this.dialog.set(null);
  }

  protected roll(): void {
    this.room.act({ type: 'roll' });
  }

  protected endTurn(): void {
    this.buildMode.set(null);
    this.room.act({ type: 'endTurn' });
  }

  protected buyDevCard(): void {
    this.room.act({ type: 'buyDevCard' });
  }

  protected play(card: DevCard): void {
    switch (card) {
      case 'knight':
        this.room.act({ type: 'playKnight' });
        break;
      case 'roadBuilding':
        this.room.act({ type: 'playRoadBuilding' });
        break;
      case 'yearOfPlenty':
        this.plentyPick.set(emptyResources());
        this.dialog.set({ kind: 'yearOfPlenty' });
        break;
      case 'monopoly':
        this.dialog.set({ kind: 'monopoly' });
        break;
    }
  }

  /** Wächter-Dialog: einfache Aktionen gleich, Ziehen über das Brett. */
  protected guardAct(kind: 'activate' | 'upgrade' | 'move' | 'chase'): void {
    const o = this.guardOptions();
    if (!o) return;
    this.dialog.set(null);
    if (kind === 'activate') this.room.act({ type: 'activateGuard', vertex: o.vertex });
    else if (kind === 'upgrade') this.room.act({ type: 'upgradeGuard', vertex: o.vertex });
    else if (kind === 'chase') {
      this.buildMode.set(null);
      this.room.act({ type: 'chaseRobber', vertex: o.vertex });
    } else {
      this.guardFrom.set(o.vertex);
      this.buildMode.set('guardMove');
    }
  }

  protected openProgress(card: ProgressCard): void {
    this.dialog.set({ kind: 'progress', card });
  }

  /** Einflusskarte ausspielen: ohne Ziel sofort, mit Kartenart aus dem Dialog, mit Brettzielen über die Hinweisleiste. */
  protected playProgress(card: ProgressCard, choice: Card | null = null): void {
    const target = PROGRESS[card].target;
    this.dialog.set(null);
    if (BOARD_TARGETS.includes(target ?? '')) {
      this.progressCard.set(card);
      this.progressPicks.set([]);
      this.cityOpen.set(false);
      this.buildMode.set('progress');
      return;
    }
    this.room.act(choice ? { type: 'playProgress', progress: card, card: choice } : { type: 'playProgress', progress: card });
  }

  private progressVertex(vertex: number): void {
    const card = this.progressCard();
    if (!card) return;
    if (PROGRESS[card].target === 'turncoat') {
      const picks = [...this.progressPicks(), vertex];
      if (picks.length < 2) this.progressPicks.set(picks);
      else this.finishProgress({ vertices: picks });
      return;
    }
    if (PROGRESS[card].target === 'guards') {
      // Wächter sammeln; mit zweien geht es gleich los, mit einem über „Aufwerten“ in der Hinweisleiste.
      const chosen = this.progressPicks();
      const next = chosen.includes(vertex) ? chosen.filter((v) => v !== vertex) : [...chosen, vertex];
      this.progressPicks.set(next);
      if (next.length === 2) this.confirmProgressGuards();
      return;
    }
    this.room.act({ type: 'playProgress', progress: card, vertices: [vertex] });
    this.progressCard.set(null);
    this.buildMode.set(null);
  }

  protected confirmProgressGuards(): void {
    const card = this.progressCard();
    const vertices = this.progressPicks();
    if (!card || !vertices.length) return;
    this.room.act({ type: 'playProgress', progress: card, vertices });
    this.progressCard.set(null);
    this.progressPicks.set([]);
    this.buildMode.set(null);
  }

  /** Brettziel gewählt: Karte mit diesen Zielen spielen und den Modus verlassen. */
  private finishProgress(args: { vertices?: number[]; hexes?: number[]; edge?: number }): void {
    const card = this.progressCard();
    if (card) this.room.act({ type: 'playProgress', progress: card, ...args });
    this.progressCard.set(null);
    this.progressPicks.set([]);
    this.buildMode.set(null);
  }

  protected playOnPlayer(card: ProgressCard, target: number): void {
    this.dialog.set(null);
    this.peekPick.set(emptyResources());
    this.room.act({ type: 'playProgress', progress: card, target });
  }

  protected playFortune(): void {
    this.dialog.set(null);
    this.room.act({ type: 'playProgress', progress: 'fortune', dice: this.fortuneDice() });
  }

  protected setDie(index: 0 | 1, value: number): void {
    this.fortuneDice.update((d) => (index === 0 ? [value, d[1]] : [d[0], value]));
  }

  protected takePeekCards(): void {
    this.room.act({ type: 'takePeek', cards: this.peekPick() });
    this.peekPick.set(emptyResources());
  }

  protected takePeekProgress(progress: ProgressCard): void {
    this.room.act({ type: 'takePeek', progress });
  }

  protected pickProgress(track: Track): void {
    this.room.act({ type: 'pickProgress', track });
  }

  /** Prachtstadt: Die Ausbau-Tafel schließt, die Wahl der Stadt passiert auf dem Brett. */
  protected chooseMetropolis(track: Track): void {
    this.metroTrack.set(track);
    this.cityOpen.set(false);
    this.buildMode.set('metropolis');
  }

  protected tradeCoins(resource: Resource): void {
    this.room.act({ type: 'tradeCoins', resource });
    this.dialog.set(null);
  }

  protected openTokens(): void {
    this.dialog.set({ kind: 'tokens', step: 'menu' });
  }

  protected spendTokens(effect: TokenEffect): void {
    if (effect === 'trade') {
      this.tokenPick.set(emptyResources());
      this.dialog.set({ kind: 'tokens', step: 'trade' });
      return;
    }
    this.room.act({ type: 'spendTokens', effect });
    this.dialog.set(null);
  }

  protected confirmTokenTrade(): void {
    this.room.act({ type: 'spendTokens', effect: 'trade', give: this.tokenPick() });
    this.dialog.set(null);
  }

  protected openFish(): void {
    this.dialog.set({ kind: 'fish', step: 'menu' });
  }

  protected spendFish(effect: FishEffect): void {
    if (effect === 'steal' || effect === 'bank') {
      this.dialog.set({ kind: 'fish', step: effect });
      return;
    }
    this.room.act({ type: 'spendFish', effect });
    this.dialog.set(null);
  }

  protected fishSteal(victim: number): void {
    this.room.act({ type: 'spendFish', effect: 'steal', victim });
    this.dialog.set(null);
  }

  protected fishBank(resource: Resource): void {
    this.room.act({ type: 'spendFish', effect: 'bank', resource });
    this.dialog.set(null);
  }

  protected passAnchor(to: number): void {
    this.room.act({ type: 'passAnchor', to });
    this.dialog.set(null);
  }

  protected confirmPlenty(): void {
    const pick = this.plentyPick();
    const chosen = RESOURCES.flatMap((r) => Array<Resource>(pick[r]).fill(r));
    if (chosen.length !== 2) return;
    this.room.act({ type: 'playYearOfPlenty', resources: [chosen[0], chosen[1]] });
    this.dialog.set(null);
  }

  protected monopoly(resource: Resource): void {
    this.room.act({ type: 'playMonopoly', resource });
    this.dialog.set(null);
  }

  protected discard(): void {
    this.room.act({ type: 'discard', resources: this.discardPick() });
  }

  protected isPlayable(card: DevCard): boolean {
    return PLAYABLE.includes(card);
  }

  protected total(r: ResourceCounts): number {
    return totalResources(r);
  }

  /** Handkarten eines Mitspielers; fremde Hände kennen wir nur als Anzahl. */
  protected cards(seat: number): number {
    const p = this.g().players[seat];
    return p ? handSize(p) : 0;
  }

  protected readonly deckSize = deckSize;

  /** Rohstoffsymbole für die Baukosten, eins pro benötigter Karte. */
  protected costArt(cost: ResourceCounts): { src: string; name: string }[] {
    return CARDS.flatMap((r) => Array.from({ length: count(cost, r) }, () => ({ src: RESOURCE_ART[r], name: CARD_NAMES[r] })));
  }

  protected deltaLabel(n: number | undefined): string {
    return n === undefined ? '' : n > 0 ? `+${n}` : `−${-n}`;
  }

  /** Tastenkürzel: Leertaste = Hauptaktion, S/R/C = bauen, E = Entwicklung, H = Handel, V = Verlauf, Esc = abbrechen. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select') || event.metaKey || event.ctrlKey || event.altKey) return;
    // Kartenansicht und Regelbuch schließen sich selbst mit Esc; dahinter soll nichts ausgelöst werden.
    if (this.inspect() || this.rulesOpen()) return;
    if (event.key === 'Escape' && this.info()) {
      this.info.set(null);
      return;
    }
    const options = this.buildOptions();
    switch (event.key.toLowerCase()) {
      case ' ':
        if (target?.closest('button')) return;
        event.preventDefault();
        this.primary().run?.();
        break;
      case 'escape':
        this.cityOpen.set(false);
        this.buildMode.set(null);
        this.moveFrom.set(null);
        if (this.showTable()) this.closeTrade();
        if (this.dialog()?.kind !== 'victim') this.dialog.set(null);
        break;
      case 's':
        if (options.settlement.enabled) this.toggleBuild('settlement');
        break;
      case 'r':
        if (options.road.enabled) this.toggleBuild('road');
        break;
      case 'b':
        if (options.ship.enabled) this.toggleBuild('ship');
        break;
      case 'c':
        if (options.city.enabled) this.toggleBuild('city');
        break;
      case 'e':
        if (options.devCard.enabled) this.buyDevCard();
        break;
      case 'h':
        if (this.showTable()) this.closeTrade();
        else if (this.canTrade()) this.openTrade();
        break;
      case 'v':
        this.toggleSide();
        break;
    }
  }

  protected openTrade(prefill: { give: ResourceCounts; want: ResourceCounts } | null = null): void {
    this.buildMode.set(null);
    this.tradePrefill.set(prefill);
    this.tradeOpen.set(true);
  }

  /** Wer am Zug ist, zieht beim Schließen sein offenes Angebot samt Gegenangeboten zurück. */
  protected closeTrade(): void {
    if (this.isCurrent()) withdrawOffers(this.room, this.g(), this.seat());
    this.tradeOpen.set(false);
    this.tradePrefill.set(null);
  }

  /** Klick auf eine Handkarte öffnet den Tauschtisch mit dieser Karte auf „Du gibst“. */
  protected handClick(r: Card): void {
    if (!this.canTrade() || !this.isCurrent() || !count(this.me()?.resources ?? emptyResources(), r)) return;
    this.openTrade({ give: { ...emptyResources(), [r]: 1 }, want: emptyResources() });
  }

  private missing(cost: ResourceCounts): string {
    const have = this.me()?.resources ?? emptyResources();
    const parts = CARDS.filter((r) => count(cost, r) > count(have, r)).map((r) => `${count(cost, r) - count(have, r)} ${CARD_NAMES[r]}`);
    return `Fehlt: ${parts.join(', ')}`;
  }

  private bannerText(): string {
    switch (this.g().phase.kind) {
      case 'discard':
        return 'Räuber! Karten abwerfen';
      case 'specialBuild':
        return 'Sonderbauphase';
      default:
        return 'Du bist dran!';
    }
  }
}
