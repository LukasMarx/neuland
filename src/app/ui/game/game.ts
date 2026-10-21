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
import { DEV_CARD_HELP, DEV_CARD_ICONS, RESOURCE_ICONS } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';
import { TradePanel } from './trade-panel';

type BuildMode = 'road' | 'settlement' | 'city';
type Dialog = { kind: 'yearOfPlenty' } | { kind: 'monopoly' } | { kind: 'victim'; hex: number; victims: number[] };

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const PLAYABLE: DevCard[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'];

@Component({
  selector: 'app-game',
  imports: [Board, ChatBox, ResourcePicker, TradePanel],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class GameView {
  protected readonly room = inject(RoomService);
  readonly leave = output<void>();

  protected readonly resources = RESOURCES;
  protected readonly resourceIcons = RESOURCE_ICONS;
  protected readonly resourceNames = RESOURCE_NAMES;
  protected readonly devIcons = DEV_CARD_ICONS;
  protected readonly devNames = DEV_CARD_NAMES;
  protected readonly devHelp = DEV_CARD_HELP;
  protected readonly costs = COSTS;

  protected readonly g = computed(() => this.room.game()!);
  protected readonly seat = this.room.mySeat;
  protected readonly me = computed(() => this.g().players[this.seat()] ?? null);
  protected readonly myTurn = computed(() => actingSeats(this.g()).includes(this.seat()));
  protected readonly isCurrent = computed(() => this.g().current === this.seat());

  protected readonly buildMode = signal<BuildMode | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly sideTab = signal<'log' | 'chat'>('log');
  // Beim Entwickeln standardmäßig stumm, sonst an, solange man ihn nicht ausschaltet.
  protected readonly sound = signal(
    isDevMode() ? localStorage.getItem('katan:sound') === 'on' : localStorage.getItem('katan:sound') !== 'off',
  );
  protected readonly discardPick = signal<ResourceCounts>(emptyResources());
  protected readonly plentyPick = signal<ResourceCounts>(emptyResources());

  private readonly logList = viewChild<ElementRef<HTMLElement>>('logList');

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
    return {
      road: can && afford(COSTS.road) && piecesLeft(g, seat, 'road') > 0 && legalRoadEdges(g, seat).length > 0,
      settlement: can && afford(COSTS.settlement) && piecesLeft(g, seat, 'settlement') > 0 && legalSettlementVertices(g, seat).length > 0,
      city: can && afford(COSTS.city) && piecesLeft(g, seat, 'city') > 0 && legalCityVertices(g, seat).length > 0,
      devCard: can && afford(COSTS.devCard) && g.devDeck.length > 0,
    };
  });

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
        return mine ? `Aufbau, Runde ${round}: Setze ${what}.` : `Aufbau, Runde ${round}: ${name(who)} setzt ${what}.`;
      }
      case 'roll':
        return mine ? 'Du bist dran. Würfle oder spiele vorher eine Entwicklungskarte.' : `${name(g.current)} würfelt …`;
      case 'discard': {
        const waiting = phase.pending.flatMap((n, i) => (n > 0 ? [name(i)] : []));
        return mine ? `Räuber! Wirf ${phase.pending[this.seat()]} Karten ab.` : `Warte aufs Abwerfen: ${waiting.join(', ')}`;
      }
      case 'robber':
        return this.isCurrent() ? 'Klicke auf ein Feld, um den Räuber zu versetzen.' : `${name(g.current)} versetzt den Räuber.`;
      case 'main':
        return this.isCurrent() ? 'Handeln und bauen. Danach „Zug beenden“.' : `${name(g.current)} ist am Zug.`;
      case 'roadBuilding':
        return this.isCurrent()
          ? `Straßenbau: Baue noch ${phase.remaining} kostenlose Straße${phase.remaining > 1 ? 'n' : ''}.`
          : `${name(g.current)} baut kostenlose Straßen.`;
      case 'specialBuild':
        return mine ? 'Sonderbauphase: Du darfst jetzt bauen.' : `Sonderbauphase: ${name(phase.queue[0])} darf bauen.`;
      case 'ended':
        return g.winner !== null ? `${name(g.winner)} hat gewonnen!` : 'Spiel beendet.';
    }
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

  protected readonly diceFaces = computed(() => this.g().dice?.map((d) => DICE_FACES[d - 1]) ?? null);
  protected readonly diceSum = computed(() => (this.g().dice ? this.g().dice![0] + this.g().dice![1] : null));

  protected readonly logEntries = computed(() =>
    this.g().log.map((e) => ({ text: e.text, color: e.seat !== null ? this.g().players[e.seat].color : 'transparent' })),
  );

  protected readonly finalRanking = computed(() =>
    [...this.playerRows()].sort((a, b) => victoryPoints(this.g(), b.seat, true) - victoryPoints(this.g(), a.seat, true)),
  );

  constructor() {
    // Baumodus verlassen, sobald sich die Phase ändert oder man nicht mehr dran ist.
    effect(() => {
      this.g().phase.kind;
      if (!this.canBuildNow()) untracked(() => this.buildMode.set(null));
    });

    effect(() => {
      this.discardDue();
      untracked(() => this.discardPick.set(emptyResources()));
    });

    let wasMyTurn = false;
    effect(() => {
      const mine = this.myTurn() && this.g().phase.kind !== 'ended';
      document.title = mine ? '● Du bist dran – Katan' : 'Katan';
      if (mine && !wasMyTurn && untracked(this.sound)) beep();
      wasMyTurn = mine;
    });

    afterRenderEffect(() => {
      this.logEntries();
      const el = this.logList()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
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

  protected costLabel(cost: ResourceCounts): string {
    return RESOURCES.flatMap((r) => Array(cost[r]).fill(RESOURCE_ICONS[r])).join('');
  }
}

function beep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // Ohne Audio geht es auch.
  }
}
