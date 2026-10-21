import { afterRenderEffect, Component, computed, effect, ElementRef, inject, isDevMode, output, signal, untracked, viewChild } from '@angular/core';
import {
  actingSeats,
  COSTS,
  DEV_CARD_NAMES,
  DevCard,
  emptyResources,
  hasResources,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
  piecesLeft,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  robberVictims,
  totalResources,
  victoryPoints,
} from '../../engine';
import { RoomService } from '../../net/room.service';
import { Board } from '../board/board';
import { ChatBox } from '../shared/chat-box';
import { DEV_CARD_HELP, DEV_CARD_ICONS, RESOURCE_ICONS, TERRAIN_COLORS } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';
import { DiceTray } from './dice-tray';
import { OfferList } from './offer-list';
import { TradeDialog } from './trade-dialog';

type BuildMode = 'road' | 'settlement' | 'city';
type Dialog = { kind: 'yearOfPlenty' } | { kind: 'monopoly' } | { kind: 'victim'; hex: number; victims: number[] };
type PrimaryAction = { label: string; run: (() => void) | null };

const PLAYABLE: DevCard[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
const HIGHLIGHT_MS = 2600;

@Component({
  selector: 'app-game',
  imports: [Board, ChatBox, DiceTray, OfferList, ResourcePicker, TradeDialog],
  templateUrl: './game.html',
  styleUrl: './game.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class GameView {
  protected readonly room = inject(RoomService);
  readonly leave = output<void>();

  protected readonly resources = RESOURCES;
  protected readonly resourceIcons = RESOURCE_ICONS;
  protected readonly resourceNames = RESOURCE_NAMES;
  protected readonly terrainColors = TERRAIN_COLORS;
  protected readonly devIcons = DEV_CARD_ICONS;
  protected readonly devNames = DEV_CARD_NAMES;
  protected readonly devHelp = DEV_CARD_HELP;
  protected readonly costs = COSTS;

  protected readonly g = computed(() => this.room.game()!);
  protected readonly seat = this.room.mySeat;
  protected readonly me = computed(() => this.g().players[this.seat()] ?? null);
  protected readonly myColor = computed(() => this.me()?.color ?? '#ffffff');
  protected readonly myTurn = computed(() => actingSeats(this.g()).includes(this.seat()));
  protected readonly isCurrent = computed(() => this.g().current === this.seat());

  protected readonly buildMode = signal<BuildMode | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly tradeOpen = signal(false);
  protected readonly sideTab = signal<'log' | 'chat'>('log');
  // Beim Entwickeln standardmäßig stumm, sonst an, solange man ihn nicht ausschaltet.
  protected readonly sound = signal(
    isDevMode() ? localStorage.getItem('katan:sound') === 'on' : localStorage.getItem('katan:sound') !== 'off',
  );
  protected readonly discardPick = signal<ResourceCounts>(emptyResources());
  protected readonly plentyPick = signal<ResourceCounts>(emptyResources());
  protected readonly highlightNumber = signal<number | null>(null);
  protected readonly banner = signal<{ text: string; id: number } | null>(null);
  /** Kurz eingeblendete Änderungen an der eigenen Hand („+2“, „−1“). */
  protected readonly handDelta = signal<{ values: Partial<Record<Resource, number>>; id: number } | null>(null);

  private readonly logList = viewChild<ElementRef<HTMLElement>>('logList');

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
      return { ...none, hexes: g.board.hexes.map((_, i) => i).filter((i) => i !== g.robber) };
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
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const mine = this.myTurn() && this.g().phase.kind !== 'ended';
      document.title = mine ? '● Du bist dran – Katan' : 'Katan';
      if (mine && !wasMyTurn) {
        untracked(() => {
          if (this.sound()) chime();
          this.banner.set({ text: this.bannerText(), id: Date.now() });
          clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => this.banner.set(null), 1800);
        });
      }
      wasMyTurn = mine;
    });

    let previous: ResourceCounts | null = null;
    let deltaTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const current = this.me()?.resources ?? null;
      untracked(() => {
        if (current && previous) {
          const values: Partial<Record<Resource, number>> = {};
          for (const r of RESOURCES) if (current[r] !== previous[r]) values[r] = current[r] - previous[r];
          if (Object.keys(values).length) {
            this.handDelta.set({ values, id: Date.now() });
            clearTimeout(deltaTimer);
            deltaTimer = setTimeout(() => this.handDelta.set(null), 1800);
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

  protected onLanded(sum: number): void {
    if (sum === 7) return;
    this.highlightNumber.set(sum);
    setTimeout(() => this.highlightNumber.update((n) => (n === sum ? null : n)), HIGHLIGHT_MS);
  }

  protected toggleBuild(mode: BuildMode): void {
    this.buildMode.update((m) => (m === mode ? null : mode));
  }

  protected toggleSound(): void {
    this.sound.update((s) => !s);
    localStorage.setItem('katan:sound', this.sound() ? 'on' : 'off');
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

  protected costIcons(cost: ResourceCounts): string[] {
    return RESOURCES.flatMap((r) => Array<string>(cost[r]).fill(RESOURCE_ICONS[r]));
  }

  protected deltaLabel(n: number | undefined): string {
    return n === undefined ? '' : n > 0 ? `+${n}` : `−${-n}`;
  }

  /** Tastenkürzel: Leertaste = Hauptaktion, S/R/C = bauen, E = Entwicklung, H = Handel, Esc = abbrechen. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select') || event.metaKey || event.ctrlKey || event.altKey) return;
    const options = this.buildOptions();
    switch (event.key.toLowerCase()) {
      case ' ':
        if (target?.closest('button')) return;
        event.preventDefault();
        this.primary().run?.();
        break;
      case 'escape':
        this.buildMode.set(null);
        this.tradeOpen.set(false);
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
        if (this.canTrade()) this.tradeOpen.update((o) => !o);
        break;
    }
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
