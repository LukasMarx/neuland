import { afterRenderEffect, Component, computed, DestroyRef, effect, ElementRef, inject, isDevMode, output, signal, untracked, viewChild } from '@angular/core';
import {
  actingSeats,
  COSTS,
  DEV_CARD_NAMES,
  DevCard,
  emptyResources,
  GameState,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  legalSetupRoads,
  harborPoints,
  legalRobberHexes,
  legalSetupVertices,
  mapById,
  VARIANTS,
  piecesLeft,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  robberVictims,
  totalResources,
  victoryPoints,
} from '../../engine';
import { AWAY_MS, RoomService } from '../../net/room.service';
import { Board } from '../board/board';
import { ChatBox } from '../shared/chat-box';
import { CardFace } from '../shared/card-face';
import { CARD_ART } from '../shared/card-art';
import { pieceImage } from '../shared/piece-art';
import { RESOURCE_ART } from '../shared/resource-art';
import { DEV_CARD_HELP } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';
import { CardInspector } from './card-inspector';
import { DiceTray, ROLL_DURATION_MS } from './dice-tray';
import { BannerEvent, EventBanner } from './event-banner';
import { FlyLayer } from './fly-layer';
import { hasOfferView, offerFor, OfferPanel } from './offer-panel';
import { TradeTable, withdrawOffers } from './trade-table';

type BuildMode = 'road' | 'settlement' | 'city';
type Dialog = { kind: 'yearOfPlenty' } | { kind: 'monopoly' } | { kind: 'victim'; hex: number; victims: number[] };
type PrimaryAction = { label: string; run: (() => void) | null };

const PLAYABLE: DevCard[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
const HIGHLIGHT_MS = 2600;

@Component({
  selector: 'app-game',
  imports: [Board, CardFace, CardInspector, ChatBox, DiceTray, EventBanner, FlyLayer, OfferPanel, ResourcePicker, TradeTable],
  templateUrl: './game.html',
  styleUrl: './game.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class GameView {
  protected readonly room = inject(RoomService);
  readonly leave = output<void>();

  protected readonly resources = RESOURCES;
  protected readonly cardArt = CARD_ART;
  protected readonly resourceArt = RESOURCE_ART;
  protected readonly resourceNames = RESOURCE_NAMES;
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
      if (!entry || entry.peerId || seat === this.seat()) return [];
      const waited = this.now() - (entry.awaySince ?? this.now());
      return [{ seat, name: g.players[seat].name, color: g.players[seat].color, ready: waited >= AWAY_MS, wait: Math.ceil((AWAY_MS - waited) / 1000) }];
    });
  });
  protected readonly seat = this.room.mySeat;
  protected readonly me = computed(() => this.g().players[this.seat()] ?? null);
  protected readonly myColor = computed(() => this.me()?.color ?? '#ffffff');
  protected readonly myTurn = computed(() => actingSeats(this.g()).includes(this.seat()));
  protected readonly isCurrent = computed(() => this.g().current === this.seat());

  protected readonly buildMode = signal<BuildMode | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly tradeOpen = signal(false);
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
  /** Geöffnete Punkte-Übersicht eines Spielers, verankert unter seinem Eintrag. */
  protected readonly info = signal<{ seat: number; left: number; top: number } | null>(null);
  protected readonly sideTab = signal<'log' | 'chat'>('log');
  // Beim Entwickeln standardmäßig stumm, sonst an, solange man ihn nicht ausschaltet.
  protected readonly sound = signal(
    isDevMode() ? localStorage.getItem('neuland:sound') === 'on' : localStorage.getItem('neuland:sound') !== 'off',
  );
  protected readonly discardPick = signal<ResourceCounts>(emptyResources());
  protected readonly plentyPick = signal<ResourceCounts>(emptyResources());
  protected readonly highlightNumber = signal<number | null>(null);
  /** Ereignis-Banner laufen nacheinander, das vorderste ist sichtbar. */
  private readonly bannerQueue = signal<BannerEvent[]>([]);
  protected readonly banner = computed(() => this.bannerQueue()[0] ?? null);
  private bannerId = 0;
  /** Der Siegerdialog erscheint erst, wenn das Sieg-Banner durchgelaufen ist. */
  protected readonly winnerReady = signal(false);
  /** Kurz eingeblendete Änderungen an der eigenen Hand („+2“, „−1“). */
  protected readonly handDelta = signal<{ values: Partial<Record<Resource, number>>; id: number } | null>(null);

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
      devCard: option(can && afford(COSTS.devCard) && g.devDeck.length > 0, COSTS.devCard, 'Stapel ist leer'),
    };
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
    if (phase.kind === 'roadBuilding') return { ...none, edges: legalRoadEdges(g, seat) };
    switch (this.buildMode()) {
      case 'road':
        return { ...none, edges: legalRoadEdges(g, seat) };
      case 'settlement':
        return { ...none, vertices: legalSettlementVertices(g, seat) };
      case 'city':
        return { ...none, vertices: legalCityVertices(g, seat) };
    }
    return none;
  });

  protected readonly ghost = computed(() => {
    const phase = this.g().phase;
    if (phase.kind === 'setup' && phase.step === 'settlement') return 'settlement';
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
        const round = phase.index < g.players.length ? 1 : 2;
        const what = phase.step === 'settlement' ? 'eine Siedlung' : 'eine Straße';
        return mine ? `Aufbau ${round}/2: Setze ${what}` : `Aufbau ${round}/2: ${name(who)} setzt ${what}`;
      }
      case 'roll':
        return mine ? 'Du bist dran: Würfeln!' : `${name(g.current)} würfelt …`;
      case 'discard': {
        const waiting = phase.pending.flatMap((n, i) => (n > 0 ? [name(i)] : []));
        return mine ? `Räuber! Wirf ${phase.pending[this.seat()]} Karten ab` : `Räuber! Warte auf ${waiting.join(', ')}`;
      }
      case 'robber':
        return this.isCurrent() ? 'Versetze den Räuber: Klicke auf ein Feld' : `${name(g.current)} versetzt den Räuber`;
      case 'main':
        return this.isCurrent() ? 'Handeln und bauen' : `${name(g.current)} ist am Zug`;
      case 'roadBuilding':
        return this.isCurrent()
          ? `Straßenbau: noch ${phase.remaining} kostenlose Straße${phase.remaining > 1 ? 'n' : ''}`
          : `${name(g.current)} baut kostenlose Straßen`;
      case 'specialBuild':
        return mine ? 'Sonderbauphase: Du darfst bauen' : `Sonderbauphase: ${name(phase.queue[0])} baut`;
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
    if (phase === 'roll' && this.isCurrent()) return { label: 'Würfeln', run: () => this.roll() };
    if (phase === 'main' && this.isCurrent()) return { label: 'Zug beenden', run: () => this.endTurn() };
    if (phase === 'specialBuild' && this.myTurn()) return { label: 'Fertig mit Bauen', run: () => this.endTurn() };
    if (phase === 'ended') return { label: 'Spiel beendet', run: null };
    if (this.myTurn()) {
      // Die Aktion passiert auf dem Brett oder in einem Dialog: sagen, was zu tun ist.
      const hint: Partial<Record<typeof phase, string>> = {
        setup: 'Auf dem Brett platzieren',
        robber: 'Feld für den Räuber wählen',
        roadBuilding: 'Straßen auf dem Brett wählen',
        discard: 'Karten abwerfen',
      };
      return { label: hint[phase] ?? 'Du bist dran', run: null };
    }
    const waitingFor = actingSeats(g).map((s) => g.players[s].name);
    return { label: `Warte auf ${waitingFor.join(', ')}`, run: null };
  });

  protected readonly playerRows = computed(() => {
    const g = this.g();
    const members = this.room.room()?.players ?? [];
    return g.players.map((p, seat) => ({
      seat,
      name: p.name,
      color: p.color,
      vp: victoryPoints(g, seat, seat === this.seat() || g.phase.kind === 'ended'),
      cards: totalResources(p.resources),
      dev: p.devCards.length + p.newDevCards.length,
      knights: p.knights,
      road: g.roadLengths[seat],
      longestRoad: g.longestRoad === seat,
      largestArmy: g.largestArmy === seat,
      harborMaster: g.harborMaster === seat,
      active: actingSeats(g).includes(seat),
      online: !!members.find((m) => m.id === p.id)?.peerId,
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
      harborVariant: g.harborMaster !== undefined,
      harborMaster: g.harborMaster === i.seat,
      harborPoints: harborPoints(g, i.seat),
      vpCards: showHidden ? devCards.filter((c) => c === 'victoryPoint').length : null,
      hiddenDev: devCards.length,
      total: victoryPoints(g, i.seat, showHidden),
      cards: totalResources(p.resources),
    };
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

  protected readonly finalRanking = computed(() =>
    [...this.playerRows()].sort((a, b) => victoryPoints(this.g(), b.seat, true) - victoryPoints(this.g(), a.seat, true)),
  );

  protected readonly confetti = Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 2.8 + Math.random() * 2,
    color: ['#d23c3c', '#2f64d6', '#e6c24a', '#2f9a48', '#ee8a1c', '#9bc65a'][i % 6],
    rotate: Math.random() * 360,
  }));

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
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

    let wasMyTurn = false;
    effect(() => {
      const mine = this.myTurn() && this.g().phase.kind !== 'ended';
      if (mine && !wasMyTurn) {
        untracked(() => {
          if (this.sound()) chime();
          const me = this.me();
          if (me) this.pushBanner({ kind: 'turn', title: this.bannerText(), name: me.name, color: me.color, tag: this.g().turn ? `Zug ${this.g().turn}` : 'Aufbauphase' });
        });
      }
      wasMyTurn = mine;
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
      if (pending && pending.id !== lastOfferId && this.sound()) untracked(() => chime());
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
        if (g.phase.kind !== 'ended') this.winnerReady.set(false);
        else if (!lastGame || switched) this.winnerReady.set(true);
        lastGame = g;

        if (current && previous) {
          const values: Partial<Record<Resource, number>> = {};
          for (const r of RESOURCES) if (current[r] !== previous[r]) values[r] = current[r] - previous[r];
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
    if (g.harborMaster != null && g.harborMaster !== prev.harborMaster) {
      const from = prev.harborMaster;
      this.pushBanner({
        kind: 'harbor',
        title: 'Hafenvogt',
        ...who(g.harborMaster),
        tag: from == null ? `+2 Punkte · ${harborPoints(g, g.harborMaster)} Hafenpunkte` : `übernimmt von ${g.players[from].name}`,
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
      this.pushBanner({ kind: 'monopoly', title: `Monopol auf ${RESOURCE_NAMES[t[0].card]}`, ...who(target), tag: `bekommt ${total} Karten`, resource: t[0].card });
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
    this.buildMode.update((m) => (m === mode ? null : mode));
  }

  protected toggleSound(): void {
    this.sound.update((s) => !s);
    localStorage.setItem('neuland:sound', this.sound() ? 'on' : 'off');
  }

  protected onVertex(vertex: number): void {
    const g = this.g();
    if (g.phase.kind === 'setup') this.room.act({ type: 'placeSettlement', vertex });
    else if (this.buildMode() === 'settlement') this.room.act({ type: 'buildSettlement', vertex });
    else if (this.buildMode() === 'city') this.room.act({ type: 'buildCity', vertex });
    this.buildMode.set(null);
  }

  protected onEdge(edge: number): void {
    const g = this.g();
    if (g.phase.kind === 'setup') this.room.act({ type: 'placeRoad', edge });
    else this.room.act({ type: 'buildRoad', edge });
    this.buildMode.set(null);
  }

  protected onHex(hex: number): void {
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

  /** Rohstoffsymbole für die Baukosten, eins pro benötigter Karte. */
  protected costArt(cost: ResourceCounts): { src: string; name: string }[] {
    return RESOURCES.flatMap((r) => Array.from({ length: cost[r] }, () => ({ src: RESOURCE_ART[r], name: RESOURCE_NAMES[r] })));
  }

  protected deltaLabel(n: number | undefined): string {
    return n === undefined ? '' : n > 0 ? `+${n}` : `−${-n}`;
  }

  /** Tastenkürzel: Leertaste = Hauptaktion, S/R/C = bauen, E = Entwicklung, H = Handel, Esc = abbrechen. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select') || event.metaKey || event.ctrlKey || event.altKey) return;
    // Die Kartenansicht schließt sich selbst mit Esc; dahinter soll nichts ausgelöst werden.
    if (this.inspect()) return;
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
        this.buildMode.set(null);
        if (this.showTable()) this.closeTrade();
        if (this.dialog()?.kind !== 'victim') this.dialog.set(null);
        break;
      case 's':
        if (options.settlement.enabled) this.toggleBuild('settlement');
        break;
      case 'r':
        if (options.road.enabled) this.toggleBuild('road');
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
  protected handClick(r: Resource): void {
    if (!this.canTrade() || !this.isCurrent() || !this.me()?.resources[r]) return;
    this.openTrade({ give: { ...emptyResources(), [r]: 1 }, want: emptyResources() });
  }

  private missing(cost: ResourceCounts): string {
    const have = this.me()?.resources ?? emptyResources();
    const parts = RESOURCES.filter((r) => cost[r] > have[r]).map((r) => `${cost[r] - have[r]} ${RESOURCE_NAMES[r]}`);
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

function chime(): void {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.12;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Ohne Audio geht es auch.
  }
}
