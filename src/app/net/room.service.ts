import { computed, inject, Injectable, InjectionToken, isDevMode, signal } from '@angular/core';
import * as engine from '../engine';
import { Action, applyAction, autoAction, createGame, GameSettings, GameState, mapById, RuleError, VARIANTS } from '../engine';
import { LocalTransport } from './local-transport';
import {
  compareRank,
  compareRoom,
  LobbyPlayer,
  MAX_PLAYERS,
  NetMessage,
  PLAYER_COLORS,
  PROTOCOL_VERSION,
  RoomInfo,
  roomRank,
} from './protocol';
import { Transport, TransportFactory, TransportHandlers } from './transport';
import { TrysteroTransport } from './trystero-transport';

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  at: number;
}

interface SavedRoom {
  room: RoomInfo;
  game: GameState | null;
  savedAt: number;
}

/**
 * `reconnecting`: im Raum, aber gerade ohne erreichbaren Host, oder als Host ohne Mehrheit.
 * Dann sind keine Züge möglich, bis die Verbindung wieder steht.
 */
export type RoomStatus = 'idle' | 'searching' | 'connected' | 'reconnecting';

/** Alles, was der RoomService von außen braucht; Tests setzen hier Uhr, Speicher und Netz ein. */
export interface NetEnv {
  /** Spielstände (`localStorage`). */
  storage: Storage;
  /** Spieler-ID und Name: pro Browser oder pro Tab. */
  identity: Storage;
  factory: TransportFactory;
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  randomId(): string;
  /** Frischer Zufall (32 Bit), den der Host vor jeder Aktion einmischt. */
  entropy(): number;
}

export const NET_ENV = new InjectionToken<NetEnv>('NET_ENV');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** So lange wartet ein Beitretender auf einen Host, bevor er gespeicherte Spiele selbst fortsetzt. */
const SEARCH_TIMEOUT_MS = 12000;
/** Ohne Host darf nach dieser Zeit auch wählen, wer nicht Kandidat ist. */
const RE_ELECT_MS = 8000;
/** Takt des Lebenszeichens vom Host und der Meldungen, wem man folgt. */
const TICK_MS = 3000;
/** Kommt so lange nichts vom Host, gilt er als weg (schneller als WebRTC, das ~15 s braucht). */
const HOST_SILENCE_MS = 9000;
/** Eine Meldung „ich folge Host X“ gilt so lange; so frisch muss auch sein, wer bei einer Wahl zählt. */
const FOLLOW_FRESH_MS = 7000;
/**
 * Für einen schon bestehenden Host zählt ein Mitspieler länger als erreichbar. Browser drosseln Timer in
 * Hintergrund-Tabs stark (bis zu einmal pro Minute); wer kurz in ein anderes Fenster wechselt, soll das
 * Spiel nicht anhalten. Einen harten Abbruch meldet ohnehin die Verbindung selbst.
 */
const PRESENCE_MS = 90000;
/** Ohne Bestätigung wird eine Aktion nach dieser Zeit erneut gesendet. */
const ACK_TIMEOUT_MS = 4000;
/** Länger unbestätigte Aktionen verfallen mit Hinweis, statt viel später überraschend zu wirken. */
const OUTBOX_MAX_MS = 30000;
/** Ab dann darf jeder Mitspieler für einen nicht verbundenen Spieler weiterspielen. */
export const AWAY_MS = 20000;
/** In diesem Fenster wird dieselbe Aktion auf denselben Stand nur einmal geschickt (Doppelklick). */
const DUPLICATE_MS = 1500;
/** Beim Host ändert sich der Stand sofort; ein Doppelklick ist dann nur noch an der Zeit zu erkennen. */
const DOUBLE_CLICK_MS = 400;
const NO_QUORUM = 'Gerade ist nur ein Teil der Spieler verbunden. Weiter geht es, sobald die Mehrheit wieder da ist.';

const params = new URLSearchParams(globalThis.location?.search ?? '');
/** Lokaler Testmodus (`?local`): Tabs verbinden sich per BroadcastChannel statt P2P. */
export const LOCAL_MODE = params.has('local') || globalThis.sessionStorage?.getItem('neuland:local') === '1';
/** Jeder Tab ein eigener Spieler (`?tab` oder `?local`), sonst ist ein Browser ein Spieler. */
const PER_TAB = LOCAL_MODE || params.has('tab') || globalThis.sessionStorage?.getItem('neuland:tab') === '1';
if (LOCAL_MODE) sessionStorage.setItem('neuland:local', '1');
if (PER_TAB) sessionStorage.setItem('neuland:tab', '1');

function browserEnv(): NetEnv {
  return {
    storage: localStorage,
    identity: PER_TAB ? sessionStorage : localStorage,
    factory: LOCAL_MODE ? (code, h) => new LocalTransport(code, h) : (code, h) => new TrysteroTransport(code, h),
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    randomId: () => crypto.randomUUID(),
    entropy: () => crypto.getRandomValues(new Uint32Array(1))[0] | 0,
  };
}

interface Outgoing {
  n: number;
  action: Action;
  queuedAt: number;
  sentAt: number;
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly env = inject(NET_ENV, { optional: true }) ?? browserEnv();

  readonly clientId = storedValue(this.env.identity, 'neuland:clientId', () => this.env.randomId());
  readonly name = signal(this.env.identity.getItem('neuland:name') ?? '');
  readonly status = signal<RoomStatus>('idle');
  readonly room = signal<RoomInfo | null>(null);
  readonly game = signal<GameState | null>(null);
  readonly isHost = signal(false);
  readonly chat = signal<ChatMessage[]>([]);
  readonly notice = signal<{ text: string; at: number } | null>(null);
  readonly searchSlow = signal(false);
  readonly connectedPeers = signal<ReadonlySet<string>>(new Set());
  /** Eigene Aktionen, die der Host noch nicht bestätigt hat. */
  readonly pending = signal(0);

  readonly code = computed(() => this.room()?.code ?? this.pendingCode());
  readonly mySeat = computed(() => this.game()?.players.findIndex((p) => p.id === this.clientId) ?? -1);
  readonly me = computed(() => this.room()?.players.find((p) => p.id === this.clientId) ?? null);

  private readonly pendingCode = signal<string | null>(null);
  private transport: Transport | null = null;
  private hostPeer: string | null = null;
  private readonly peerClients = new Map<string, string>();
  private timers: unknown[] = [];
  private tickTimer: unknown = null;
  private watchTimer: unknown = null;
  private electTimer: unknown = null;
  /** Seit wann wir ohne Host sind; danach darf auch wählen, wer nicht Kandidat ist. */
  private hostlessSince: number | null = null;
  private lastHostSignal = 0;
  private lastFollowSent = 0;
  /** Peers mit anderer Protokollversion: deren Nachrichten werden nicht verarbeitet. */
  private readonly mismatched = new Set<string>();
  /** Wem die anderen gerade folgen; verhindert, dass bei einem einseitigen Abbruch ein zweiter Host entsteht. */
  private readonly follows = new Map<string, { hostId: string | null; rank: number[]; at: number }>();
  /**
   * Wann zuletzt etwas von einem Peer kam. WebRTC meldet einen harten Abbruch erst nach ~15 s;
   * erreichbar ist für die Mehrheitsprüfung nur, wer in den letzten Sekunden etwas geschickt hat.
   */
  private readonly lastHeard = new Map<string, number>();
  private lastAction: { key: string; version: number; at: number } | null = null;
  /** Sitzung dieser Seite: Laufnummern gelten pro Sitzung, ein Neuladen beginnt eine neue. */
  private readonly session = this.env.randomId();
  private seq = 0;
  private outbox: Outgoing[] = [];

  constructor() {
    // Zum Debuggen in der Browser-Konsole, nur im Entwicklungsmodus.
    if (isDevMode()) Object.assign(globalThis, { neuland: { room: this, engine } });
    // Kommt die Seite aus dem Zurück-Cache, wurde die Verbindung beim Verlassen (pagehide) beendet.
    globalThis.addEventListener?.('pageshow', (event) => {
      if ((event as PageTransitionEvent).persisted) this.reconnect();
    });
  }

  /** Neuen Raum eröffnen, der Ersteller ist Host. */
  create(name: string): string {
    this.setName(name);
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[(this.env.entropy() >>> 0) % CODE_ALPHABET.length]).join('');
    this.connect(code);
    this.becomeHost(this.freshRoom(code), null);
    return code;
  }

  /** Einem Raum beitreten. Antwortet kein Host, kann man ihn selbst (wieder) eröffnen. */
  join(code: string, name: string): void {
    if (this.code() === code && this.status() !== 'idle') return;
    this.setName(name);
    this.search(code);
  }

  /** Verbindung neu aufbauen, z. B. nach dem Zurück-Cache oder per Knopf. */
  reconnect(): void {
    const code = this.code();
    if (code) this.search(code);
  }

  /** Selbst Host werden: mit gespeichertem Stand, falls vorhanden, sonst mit leerer Lobby. */
  openAsHost(): void {
    const code = this.code();
    if (!code) return;
    const saved = loadSaved(code, this.env.storage);
    if (saved) {
      this.becomeHost({ ...saved.room, epoch: saved.room.epoch + 1 }, saved.game);
    } else {
      this.becomeHost(this.freshRoom(code), null);
    }
  }

  leave(): void {
    this.transport?.leave();
    this.transport = null;
    this.timers.forEach((t) => this.env.clearTimeout(t));
    this.timers = [];
    this.stopTicking();
    for (const t of [this.watchTimer, this.electTimer]) if (t) this.env.clearTimeout(t);
    this.watchTimer = this.electTimer = null;
    this.hostPeer = null;
    this.hostlessSince = null;
    this.peerClients.clear();
    this.mismatched.clear();
    this.follows.clear();
    this.lastHeard.clear();
    this.lastAction = null;
    this.clearOutbox();
    this.isHost.set(false);
    this.status.set('idle');
    this.room.set(null);
    this.game.set(null);
    this.chat.set([]);
    this.pendingCode.set(null);
    this.searchSlow.set(false);
    this.connectedPeers.set(new Set());
  }

  setName(name: string): void {
    const trimmed = name.trim().slice(0, 20);
    this.name.set(trimmed);
    this.env.identity.setItem('neuland:name', trimmed);
  }

  updateProfile(name: string, color: string): void {
    this.setName(name);
    if (this.isHost()) this.applyProfile(this.clientId, this.name(), color);
    else this.toHost({ t: 'profile', name: this.name(), color });
  }

  updateSettings(settings: GameSettings): void {
    if (!this.isHost()) return;
    this.mutateRoom((r) => ({ ...r, settings }));
  }

  /** Als Zuschauer einen Platz übernehmen, z. B. nach einem Geräte- oder Browserwechsel. */
  claimSeat(playerId: string): void {
    if (this.isHost()) this.applyClaim(this.clientId, playerId, this.transport?.selfId ?? null);
    else this.toHost({ t: 'claim', playerId });
  }

  removePlayer(id: string): void {
    if (!this.isHost() || this.game()) return;
    this.mutateRoom((r) => ({ ...r, players: r.players.filter((p) => p.id !== id) }));
  }

  /** Startet mit allen, die gerade verbunden sind; wer die Lobby verlassen hat, würde sonst das Spiel blockieren. */
  startGame(): void {
    const room = this.room();
    if (!this.isHost() || !room) return;
    const present = room.players.filter((p) => p.id === this.clientId || p.peerId);
    if (present.length < 2) {
      this.showNotice('Es sind weniger als zwei Spieler verbunden.');
      return;
    }
    const fixed = VARIANTS.find((v) => v.players && room.settings.variants?.includes(v.id) && v.players !== present.length);
    if (fixed) {
      this.showNotice(`${fixed.name} ist nur für ${fixed.players} Spieler.`);
      return;
    }
    const landOnly = VARIANTS.find((v) => v.landOnly && room.settings.variants?.includes(v.id) && mapById(room.settings.map).seafaring);
    if (landOnly) {
      this.showNotice(`${landOnly.name} gibt es nur auf Karten ohne Meerfelder.`);
      return;
    }
    const gone = room.players.filter((p) => !present.includes(p));
    if (gone.length) this.showNotice(`Ohne ${gone.map((p) => p.name).join(', ')} gestartet, nicht verbunden.`);
    const players = present.map(({ id, name, color }) => ({ id, name, color }));
    const seed = this.env.entropy() >>> 1;
    this.room.set(nextRound({ ...room, players: present }));
    this.game.set({ ...createGame(players, room.settings, seed), id: this.env.randomId() });
    this.broadcast();
  }

  /** Zurück in die Lobby, z. B. für eine neue Runde. */
  backToLobby(): void {
    const room = this.room();
    if (!this.isHost() || !room) return;
    this.room.set(nextRound(room));
    this.game.set(null);
    this.broadcast();
  }

  act(action: Action): void {
    // Doppelklick: dieselbe Aktion auf denselben Stand kurz hintereinander nur einmal schicken.
    const key = JSON.stringify(action);
    const version = this.game()?.version ?? -1;
    const last = this.lastAction;
    const age = last && last.key === key ? this.env.now() - last.at : Infinity;
    if (age < DOUBLE_CLICK_MS || (age < DUPLICATE_MS && last!.version === version)) return;
    this.lastAction = { key, version, at: this.env.now() };
    if (this.isHost()) {
      this.applyFrom(this.clientId, action, null);
      return;
    }
    const item: Outgoing = { n: ++this.seq, action, queuedAt: this.env.now(), sentAt: 0 };
    this.outbox.push(item);
    this.pending.set(this.outbox.length);
    if (!this.sendAction(item)) this.showNotice('Keine Verbindung zum Gastgeber. Der Zug geht raus, sobald sie wieder steht.');
  }

  /** Für einen Spieler, der länger nicht verbunden ist, einen automatischen Zug machen lassen. */
  standIn(seat: number): void {
    if (this.isHost()) this.applyStandIn(this.clientId, seat, null);
    else this.toHost({ t: 'standIn', seat });
  }

  sendChat(text: string): void {
    const msg = text.trim().slice(0, 300);
    if (!msg || !this.transport) return;
    const message: NetMessage = { t: 'chat', id: this.clientId, name: this.name(), text: msg };
    this.transport.send(message);
    this.receiveChat(message);
  }

  showNotice(text: string): void {
    this.notice.set({ text, at: this.env.now() });
  }

  // -------------------------------------------------------------------------

  private search(code: string): void {
    this.connect(code);
    this.status.set('searching');
    this.later(4000, () => this.status() === 'searching' && this.searchSlow.set(true));
    this.later(SEARCH_TIMEOUT_MS, () => {
      // Ein beendetes Spiel wird nicht von selbst wieder eröffnet.
      const saved = loadSaved(code, this.env.storage)?.game;
      if (this.status() === 'searching' && saved && saved.phase.kind !== 'ended') this.openAsHost();
    });
  }

  private connect(code: string): void {
    this.leave();
    this.pendingCode.set(code);
    // Späte Ereignisse eines schon verlassenen Raums werden verworfen.
    let transport: Transport | null = null;
    const live = () => transport !== null && this.transport === transport;
    const handlers: TransportHandlers = {
      onPeerJoin: (peer) => live() && this.onPeerJoin(peer),
      onPeerLeave: (peer) => live() && this.onPeerLeave(peer),
      onMessage: (msg, peer) => live() && this.onMessage(msg, peer),
    };
    transport = this.env.factory(code, handlers);
    this.transport = transport;
    this.scheduleWatch();
  }

  private freshRoom(code: string): RoomInfo {
    return {
      code,
      hostId: this.clientId,
      epoch: 0,
      round: 0,
      players: [],
      spectators: [],
      settings: { victoryPoints: 10 },
    };
  }

  private becomeHost(room: RoomInfo, game: GameState | null): void {
    const selfPeer = this.transport?.selfId ?? null;
    const peers = this.connectedPeers();
    const now = this.env.now();
    const markConnected = (p: LobbyPlayer): LobbyPlayer => {
      if (p.id === this.clientId) return { ...p, peerId: selfPeer, awaySince: null };
      const peer = [...this.peerClients].find(([, id]) => id === p.id)?.[0];
      const connected = !!peer && peers.has(peer);
      return { ...p, peerId: connected ? peer : null, awaySince: connected ? null : (p.awaySince ?? now) };
    };
    let next: RoomInfo = {
      ...room,
      hostId: this.clientId,
      players: room.players.map(markConnected),
      spectators: room.spectators.map(markConnected),
    };
    next = this.withMember(next, game, this.clientId, this.name(), selfPeer);
    this.isHost.set(true);
    this.hostPeer = null;
    this.hostlessSince = null;
    this.searchSlow.set(false);
    this.room.set(next);
    this.game.set(game);
    this.updateHostStatus();
    this.broadcast();
    this.startTicking();
    // Eigene Züge, die beim alten Host nicht mehr angekommen sind, wendet der neue Host jetzt selbst an.
    const unsent = this.outbox;
    this.clearOutbox();
    for (const item of unsent) this.applyFrom(this.clientId, item.action, null, { s: this.session, n: item.n });
  }

  /** Als Host zurücktreten, weil über einen Mitspieler ein Host mit höherem Rang zu sehen ist. */
  private stepDown(): void {
    this.isHost.set(false);
    this.stopTicking();
    this.hostLost();
  }

  private onPeerJoin(peer: string): void {
    this.lastHeard.set(peer, this.env.now());
    this.connectedPeers.update((s) => new Set(s).add(peer));
    this.sendHello(peer);
    if (this.isHost()) this.sendRoom(peer);
  }

  private onPeerLeave(peer: string): void {
    this.connectedPeers.update((s) => {
      const next = new Set(s);
      next.delete(peer);
      return next;
    });
    this.follows.delete(peer);
    this.lastHeard.delete(peer);
    if (this.isHost()) {
      const now = this.env.now();
      const clear = (p: LobbyPlayer) => (p.peerId === peer ? { ...p, peerId: null, awaySince: now } : p);
      this.mutateRoom((r) => ({ ...r, players: r.players.map(clear), spectators: r.spectators.map(clear) }));
      this.updateHostStatus();
    } else if (peer === this.hostPeer) {
      this.hostLost();
    }
  }

  /** Der Host ist nicht mehr erreichbar: den anderen melden und eine Wahl anstoßen. */
  private hostLost(): void {
    this.hostPeer = null;
    this.hostlessSince ??= this.env.now();
    if (this.room()) this.status.set('reconnecting');
    this.sendFollow();
    this.scheduleElect(0);
  }

  private scheduleElect(ms: number): void {
    if (this.electTimer) this.env.clearTimeout(this.electTimer);
    this.electTimer = this.env.setTimeout(() => this.electHost(), ms);
  }

  /**
   * Ohne Host: Der verbundene Spieler mit dem kleinsten Sitzplatz übernimmt, nach RE_ELECT_MS
   * darf jeder, damit es nicht hängt. Host wird aber nur, wer die Mehrheit der Spieler erreicht
   * und wenn kein Mitspieler mehr einem lebenden Host folgt (sonst ist nur die eigene Leitung weg).
   */
  private electHost(): void {
    this.electTimer = null;
    const room = this.room();
    if (!room || this.isHost() || this.hostPeer) return;
    const waitedLongEnough = this.env.now() - (this.hostlessSince ?? this.env.now()) >= RE_ELECT_MS;
    if (!this.liveHostElsewhere() && this.hasQuorum(FOLLOW_FRESH_MS) && (waitedLongEnough || this.isCandidate(room))) {
      this.becomeHost({ ...room, epoch: room.epoch + 1 }, this.game());
      this.showNotice('Der Gastgeber ist weg. Du leitest jetzt das Spiel.');
      return;
    }
    this.scheduleElect(1000);
  }

  private isCandidate(room: RoomInfo): boolean {
    const order = (this.game()?.players.map((p) => p.id) ?? room.players.map((p) => p.id)).concat(
      room.spectators.map((s) => s.id),
    );
    const candidate = order.find((id) => id !== room.hostId && (id === this.clientId || this.isConnectedId(id, FOLLOW_FRESH_MS)));
    return candidate === this.clientId;
  }

  /** Folgt ein erreichbarer Mitspieler gerade einem anderen Host, von dem er noch etwas hört? */
  private liveHostElsewhere(): boolean {
    const now = this.env.now();
    return [...this.follows].some(
      ([peer, f]) => !!f.hostId && f.hostId !== this.clientId && now - f.at < FOLLOW_FRESH_MS && this.connectedPeers().has(peer),
    );
  }

  /** Mehrheit der Sitzplätze erreichbar (sich selbst eingerechnet), bei Gleichstand die Hälfte mit Sitz 0. */
  /**
   * Mehrheit erreichbar? Für eine Wahl zählt nur, wer gerade etwas geschickt hat (`FOLLOW_FRESH_MS`), damit
   * sich ein abgeschnittener Spieler nicht selbst zum Host macht; ein bestehender Host ist großzügiger.
   */
  private hasQuorum(window = PRESENCE_MS): boolean {
    const game = this.game();
    if (!game) return true;
    // Neutrale Mitspieler (Duell) zählen nicht mit, sie sind nie verbunden.
    const ids = game.players.filter((p) => !p.neutral).map((p) => p.id);
    const reachable = (id: string) => id === this.clientId || this.isConnectedId(id, window);
    const n = ids.filter(reachable).length;
    return 2 * n > ids.length || (2 * n === ids.length && reachable(ids[0]));
  }

  private isConnectedId(id: string, window: number): boolean {
    const peers = this.connectedPeers();
    const now = this.env.now();
    return [...this.peerClients].some(
      ([peer, client]) => client === id && peers.has(peer) && now - (this.lastHeard.get(peer) ?? 0) < window,
    );
  }

  private updateHostStatus(): void {
    if (this.isHost()) this.status.set(this.hasQuorum() ? 'connected' : 'reconnecting');
  }

  private onMessage(msg: NetMessage, peer: string): void {
    if (this.mismatched.has(peer) && msg.t !== 'chat') return;
    this.lastHeard.set(peer, this.env.now());
    // Wer Nachrichten schickt, ist verbunden, auch wenn vorher eine verspätete Abmeldung kam.
    if (!this.connectedPeers().has(peer) && msg.t !== 'hello') {
      this.connectedPeers.update((s) => new Set(s).add(peer));
      this.sendHello(peer);
    }
    // Der Host führt so jemanden auch wieder als verbunden, sonst gälte er als abwesend.
    const id = this.peerClients.get(peer);
    const room = this.room();
    if (this.isHost() && id && room && [...room.players, ...room.spectators].some((p) => p.id === id && !p.peerId)) {
      this.mutateRoom((r) => this.withMember(r, this.game(), id, '', peer));
      this.updateHostStatus();
    }
    switch (msg.t) {
      case 'hello':
        if ((msg.proto ?? 1) !== PROTOCOL_VERSION) {
          this.mismatched.add(peer);
          this.showNotice(`${msg.name || 'Jemand'} nutzt eine andere Version von Neuland. Bitte alle die Seite neu laden.`);
          if (this.isHost()) this.transport?.send({ t: 'reject', error: 'Andere Version von Neuland: bitte die Seite neu laden.' }, peer);
          break;
        }
        this.peerClients.set(peer, msg.id);
        if (this.isHost()) {
          this.mutateRoom((r) => this.withMember(r, this.game(), msg.id, msg.name, peer));
          this.updateHostStatus();
        }
        break;
      case 'room':
        this.onRoom(msg.room, msg.game, peer);
        break;
      case 'claim': {
        const id = this.peerClients.get(peer);
        if (this.isHost() && id) this.applyClaim(id, msg.playerId, peer);
        break;
      }
      case 'profile': {
        const id = this.peerClients.get(peer);
        if (this.isHost() && id) this.applyProfile(id, msg.name, msg.color);
        break;
      }
      case 'action': {
        const id = this.peerClients.get(peer);
        if (this.isHost() && id) this.applyFrom(id, msg.action, peer, { s: msg.s, n: msg.n });
        break;
      }
      case 'ack':
        if (msg.s === this.session) this.confirmUpTo(msg.n);
        break;
      case 'reject':
        if (msg.s === this.session && msg.n !== undefined) this.dropOutgoing(msg.n);
        this.showNotice(msg.error);
        break;
      case 'chat':
        this.receiveChat(msg);
        break;
      case 'tick':
        this.onTick(msg.rank, msg.gameId, peer);
        break;
      case 'sync':
        if (this.isHost()) this.sendRoom(peer);
        break;
      case 'offer':
        this.onOffer(msg.game, peer);
        break;
      case 'follow':
        this.onFollow(msg.hostId, msg.rank, peer);
        break;
      case 'standIn': {
        const id = this.peerClients.get(peer);
        if (this.isHost() && id) this.applyStandIn(id, msg.seat, peer);
        break;
      }
    }
  }

  private onRoom(room: RoomInfo, game: GameState | null, peer: string): void {
    // Nur der Host selbst verteilt seinen Stand; weitergereichte oder untergeschobene Stände zählen nicht.
    if (this.peerClients.get(peer) !== room.hostId) return;
    const current = this.room();
    const order = current ? compareRoom({ room, game }, { room: current, game: this.game() }) : 1;
    if (this.isHost()) {
      if (order <= 0) {
        // Wir haben den höheren Rang, der andere soll zurücktreten.
        this.sendRoom(peer);
        return;
      }
      this.isHost.set(false);
      this.stopTicking();
    } else if (order < 0) {
      // Älterer Stand: vom eigenen Host verspätet (Nachrichten können sich überholen) oder von
      // einem neuen Host, dem der letzte Stand fehlt. Dem bieten wir unseren an.
      if (peer === this.hostPeer) this.lastHostSignal = this.env.now();
      else if (this.hostPeer === null && this.offerNewer(peer, game)) this.followHost(peer);
      // Ohne Host und mit demselben Stand übernehmen wir seinen Raum (siehe onTick).
      if (peer === this.hostPeer || this.hostPeer !== null || !this.sameStand(game)) return;
    } else if (order === 0 && peer !== this.hostPeer && this.hostPeer !== null) {
      return;
    }
    // Beim Beitritt: Ist der eigene Speicherstand derselben Partie neuer, bekommt ihn der Host.
    const saved = current ? null : loadSaved(room.code, this.env.storage)?.game;
    const switched = game?.id !== this.game()?.id;
    this.room.set(room);
    this.game.set(game);
    if (switched) this.clearOutbox();
    this.followHost(peer);
    this.confirmFromState(game);
    if (saved && game && saved.id && saved.id === game.id && saved.version > game.version) {
      this.transport?.send({ t: 'offer', game: saved }, peer);
    } else {
      save(this.env.storage, room, game);
    }
    // Falls der Host uns noch nicht kennt (z. B. nach einem Host-Wechsel), melden wir uns an.
    const known = [...room.players, ...room.spectators].some((p) => p.id === this.clientId && p.peerId);
    if (!known) this.sendHello(peer);
  }

  /** Ab jetzt ist `peer` unser Host: Status setzen und Unbestätigtes dorthin (erneut) schicken. */
  private followHost(peer: string): void {
    const changed = this.hostPeer !== peer;
    this.hostPeer = peer;
    this.hostlessSince = null;
    this.lastHostSignal = this.env.now();
    this.status.set('connected');
    this.searchSlow.set(false);
    if (this.electTimer) this.env.clearTimeout(this.electTimer);
    this.electTimer = null;
    if (changed) {
      this.outbox.forEach((item) => this.sendAction(item));
      this.sendFollow();
    }
  }

  /** Lebenszeichen eines Hosts: Liegen wir zurück, holen wir den vollen Stand; sind wir weiter, bieten wir ihn an. */
  private onTick(rank: number[], gameId: string | null, peer: string): void {
    const room = this.room();
    if (!room) return;
    const d = compareRank(rank, roomRank({ room, game: this.game() }));
    if (peer === this.hostPeer) {
      this.lastHostSignal = this.env.now();
      if (d > 0) this.transport?.send({ t: 'sync' }, peer);
      else if (d < 0 && gameId && gameId === this.game()?.id) this.offerNewer(peer, { id: gameId, version: rank[2] });
      return;
    }
    // Ein anderer Host mit höherem Rang: Stand holen, onRoom entscheidet dann über den Wechsel.
    // Sind wir selbst Host mit höherem Rang, schicken wir unseren, damit er zurücktritt.
    // Sind wir ohne Host und dieser kennt dieselbe Partie nur älter: ihm unseren Stand geben und ihm folgen.
    if (d > 0 && this.peerClients.has(peer)) this.transport?.send({ t: 'sync' }, peer);
    else if (d < 0 && this.isHost()) this.sendRoom(peer);
    else if (d === 0 && this.hostPeer === null && !this.isHost() && this.peerClients.get(peer) === room.hostId) this.followHost(peer);
    else if (d < 0 && this.hostPeer === null) {
      const theirs = gameId ? { id: gameId, version: rank[2] } : null;
      if (this.offerNewer(peer, theirs)) this.followHost(peer);
      // Gleicher Stand, nur eine ältere Wahl: Unser neuerer Host ist weg, also dem lebenden folgen.
      else if (this.sameStand(theirs) && this.peerClients.has(peer)) this.transport?.send({ t: 'sync' }, peer);
    }
  }

  private sameStand(theirs: Pick<GameState, 'id' | 'version'> | null): boolean {
    const mine = this.game();
    return !!mine?.id && !!theirs && theirs.id === mine.id && theirs.version === mine.version;
  }

  /** Meldung eines Mitspielers, wem er folgt. Folgt er einem Host mit höherem Rang als wir, treten wir zurück. */
  private onFollow(hostId: string | null, rank: number[], peer: string): void {
    this.follows.set(peer, { hostId, rank, at: this.env.now() });
    const room = this.room();
    if (!this.isHost() || !room) return;
    // Antwort sofort aus dem Nachrichtenereignis: So bleibt der Host lebendig, auch wenn sein eigener
    // Takt im Hintergrund-Tab gedrosselt läuft.
    this.transport?.send({ t: 'tick', rank: roomRank({ room, game: this.game() }), gameId: this.game()?.id ?? null }, peer);
    if (!hostId || hostId === this.clientId) return;
    const d = compareRank(rank, roomRank({ room, game: this.game() }));
    if (d > 0 || (d === 0 && hostId < this.clientId)) this.stepDown();
  }

  /** Bietet dem Host den eigenen Stand an, wenn er dieselbe Partie weiter fortgeschritten zeigt. */
  private offerNewer(peer: string, theirs: Pick<GameState, 'id' | 'version'> | null): boolean {
    const mine = this.game();
    if (!mine?.id || !theirs || mine.id !== theirs.id || mine.version <= theirs.version) return false;
    this.transport?.send({ t: 'offer', game: mine }, peer);
    return true;
  }

  /** Ein Client kennt einen neueren Stand derselben Partie (verpasster Broadcast, Speicherstand). */
  private onOffer(game: GameState, peer: string): void {
    const mine = this.game();
    if (!this.isHost() || !mine?.id || !this.peerClients.has(peer)) return;
    if (game?.id !== mine.id || !(game.version > mine.version)) return;
    this.game.set(game);
    this.broadcast();
  }

  private applyFrom(clientId: string, action: Action, peer: string | null, env?: { s: string; n: number }): void {
    const game = this.game();
    if (!game) return;
    // Schon angewendet (erneut gesendet, z. B. nach einem Host-Wechsel): nur bestätigen.
    const done = env ? game.acks?.[clientId] : undefined;
    if (env && done && done.s === env.s && env.n <= done.n) {
      if (peer) this.transport?.send({ t: 'ack', ...env }, peer);
      return;
    }
    const seat = game.players.findIndex((p) => p.id === clientId);
    try {
      if (seat < 0) throw new RuleError('Zuschauer können nicht mitspielen.');
      if (!this.hasQuorum()) throw new RuleError(NO_QUORUM);
      const mixed = this.withFreshRandomness(game);
      let next = applyAction(mixed, seat, action);
      // Aktionen ohne Wirkung (z. B. ein schon erledigtes Zurückziehen) erzeugen keinen neuen Stand.
      if (next !== mixed) {
        if (env) next = { ...next, acks: { ...next.acks, [clientId]: env } };
        this.game.set(next);
        this.broadcast();
      }
      if (env && peer) this.transport?.send({ t: 'ack', ...env }, peer);
    } catch (e) {
      const error = e instanceof RuleError ? e.message : 'Unerwarteter Fehler.';
      if (!(e instanceof RuleError)) console.error(e);
      if (peer) this.transport?.send({ t: 'reject', error, ...env }, peer);
      else this.showNotice(error);
    }
  }

  /** Automatischer Zug für einen Sitz, dessen Spieler seit AWAY_MS nicht verbunden ist. */
  private applyStandIn(requesterId: string, seat: number, peer: string | null): void {
    const game = this.game();
    const target = game?.players[seat];
    const entry = this.room()?.players.find((p) => p.id === target?.id);
    if (!game || !target || !entry) return;
    if (!game.players.some((p) => p.id === requesterId)) return this.reject(peer, 'Zuschauer können nicht mitspielen.');
    if (entry.peerId) return this.reject(peer, `${target.name} ist wieder verbunden.`);
    if (this.env.now() - (entry.awaySince ?? this.env.now()) < AWAY_MS) {
      return this.reject(peer, `Noch kurz warten, vielleicht kommt ${target.name} gleich zurück.`);
    }
    if (!this.hasQuorum()) return this.reject(peer, NO_QUORUM);
    const action = autoAction(game, seat);
    if (!action) return this.reject(peer, `${target.name} ist gerade nicht dran.`);
    try {
      this.game.set(applyAction(this.withFreshRandomness(game), seat, action));
      this.broadcast();
    } catch (e) {
      this.reject(peer, e instanceof RuleError ? e.message : 'Unerwarteter Fehler.');
    }
  }

  /**
   * Der Zufallszustand steht im Spielstand, den alle sehen. Damit niemand den nächsten Wurf oder die
   * nächste Karte vorausrechnen kann, mischt der Host vor jeder Aktion frischen Zufall ein.
   */
  private withFreshRandomness(game: GameState): GameState {
    return { ...game, rng: (game.rng ^ this.env.entropy()) | 0 };
  }

  private applyClaim(claimantId: string, playerId: string, peer: string | null): void {
    const room = this.room();
    const game = this.game();
    const claimant = room?.spectators.find((p) => p.id === claimantId);
    const target = room?.players.find((p) => p.id === playerId);
    const seat = game?.players.findIndex((p) => p.id === playerId) ?? -1;
    if (!room || !game || !claimant || !target || seat < 0) return;
    // Nur freie Plätze: Wer verbunden ist, kann nicht von jemand anderem verdrängt werden, auch nicht mit gleichem Namen.
    if (target.peerId) {
      this.reject(peer, `${target.name} ist noch verbunden.`);
      return;
    }
    const next = structuredClone(game);
    next.players[seat].id = claimantId;
    next.version++;
    this.game.set(next);
    this.mutateRoom((r) => ({
      ...r,
      players: r.players.map((p) =>
        p.id === playerId ? { ...p, id: claimantId, peerId: claimant.peerId, awaySince: null } : p,
      ),
      spectators: r.spectators.filter((p) => p.id !== claimantId),
    }));
  }

  private reject(peer: string | null, error: string): void {
    if (peer) this.transport?.send({ t: 'reject', error }, peer);
    else this.showNotice(error);
  }

  private applyProfile(id: string, name: string, color: string): void {
    const trimmed = name.trim().slice(0, 20) || 'Gast';
    this.mutateRoom((r) => {
      const colorTaken = r.players.some((p) => p.id !== id && p.color === color);
      const validColor = PLAYER_COLORS.some((c) => c.hex === color);
      const players = r.players.map((p) =>
        p.id !== id ? p : { ...p, name: trimmed, color: !this.game() && validColor && !colorTaken ? color : p.color },
      );
      return { ...r, players, spectators: r.spectators.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) };
    });
    const game = this.game();
    if (game) {
      const seat = game.players.findIndex((p) => p.id === id);
      if (seat >= 0 && game.players[seat].name !== trimmed) {
        const next = structuredClone(game);
        next.players[seat].name = trimmed;
        next.version++;
        this.game.set(next);
        this.broadcast();
      }
    }
  }

  /** Spieler (oder Zuschauer, wenn das Spiel läuft oder voll ist) hinzufügen bzw. als verbunden markieren. */
  private withMember(room: RoomInfo, game: GameState | null, id: string, name: string, peer: string | null): RoomInfo {
    const update = (p: LobbyPlayer) => (p.id === id ? { ...p, peerId: peer, awaySince: null, name: name || p.name } : p);
    // Im laufenden Spiel behält ein Platz seinen Namen, auch wenn ihn jemand mit anderem Namen übernommen hat.
    const reconnect = (p: LobbyPlayer) => (p.id === id ? { ...p, peerId: peer, awaySince: null } : p);
    if (room.players.some((p) => p.id === id)) return { ...room, players: room.players.map(game ? reconnect : update) };
    if (room.spectators.some((p) => p.id === id)) return { ...room, spectators: room.spectators.map(update) };
    const member: LobbyPlayer = { id, name: name || 'Gast', color: '', peerId: peer };
    if (game || room.players.length >= MAX_PLAYERS) {
      return { ...room, spectators: [...room.spectators, member] };
    }
    const color = PLAYER_COLORS.find((c) => !room.players.some((p) => p.color === c.hex))!.hex;
    return { ...room, players: [...room.players, { ...member, color }] };
  }

  private mutateRoom(fn: (room: RoomInfo) => RoomInfo): void {
    const room = this.room();
    if (!room) return;
    this.room.set(fn(room));
    this.broadcast();
  }

  private broadcast(): void {
    const room = this.room();
    if (!room || !this.isHost()) return;
    this.transport?.send({ t: 'room', room, game: this.game() });
    save(this.env.storage, room, this.game());
  }

  private sendRoom(peer: string): void {
    const room = this.room();
    if (room) this.transport?.send({ t: 'room', room, game: this.game() }, peer);
  }

  private sendHello(peer: string): void {
    this.transport?.send({ t: 'hello', id: this.clientId, name: this.name(), proto: PROTOCOL_VERSION }, peer);
  }

  /** Allen sagen, wem wir folgen; nur solange vom Host auch etwas kommt. */
  private sendFollow(): void {
    const room = this.room();
    if (!this.transport || !room || this.isHost()) return;
    const live = this.hostPeer !== null && this.env.now() - this.lastHostSignal < TICK_MS + 1500;
    this.lastFollowSent = this.env.now();
    this.transport.send({ t: 'follow', hostId: live ? room.hostId : null, rank: roomRank({ room, game: this.game() }) });
  }

  private sendAction(item: Outgoing): boolean {
    if (!this.transport || !this.hostPeer) return false;
    item.sentAt = this.env.now();
    this.transport.send({ t: 'action', action: item.action, s: this.session, n: item.n }, this.hostPeer);
    return true;
  }

  private confirmFromState(game: GameState | null): void {
    const ack = game?.acks?.[this.clientId];
    if (ack && ack.s === this.session) this.confirmUpTo(ack.n);
  }

  private confirmUpTo(n: number): void {
    this.outbox = this.outbox.filter((item) => item.n > n);
    this.pending.set(this.outbox.length);
  }

  private dropOutgoing(n: number): void {
    this.outbox = this.outbox.filter((item) => item.n !== n);
    this.pending.set(this.outbox.length);
  }

  private clearOutbox(): void {
    this.outbox = [];
    this.pending.set(0);
  }

  private startTicking(): void {
    this.stopTicking();
    const tick = () => {
      const room = this.room();
      if (!this.isHost() || !this.transport || !room) return;
      const game = this.game();
      this.transport.send({ t: 'tick', rank: roomRank({ room, game }), gameId: game?.id ?? null });
      this.updateHostStatus();
      this.tickTimer = this.env.setTimeout(tick, TICK_MS);
    };
    this.tickTimer = this.env.setTimeout(tick, TICK_MS);
  }

  private stopTicking(): void {
    if (this.tickTimer) this.env.clearTimeout(this.tickTimer);
    this.tickTimer = null;
  }

  /**
   * Wächter jede Sekunde: schweigender Host, unbestätigte Aktionen erneut senden oder verwerfen,
   * und regelmäßig melden, wem wir folgen.
   */
  private scheduleWatch(): void {
    this.watchTimer = this.env.setTimeout(() => {
      this.watch();
      if (this.transport) this.scheduleWatch();
    }, 1000);
  }

  private watch(): void {
    const now = this.env.now();
    if (this.isHost() || !this.room()) return;
    if (this.hostPeer && now - this.lastHostSignal > HOST_SILENCE_MS) this.hostLost();
    const expired = this.outbox.filter((item) => now - item.queuedAt > OUTBOX_MAX_MS);
    if (expired.length) {
      this.outbox = this.outbox.filter((item) => !expired.includes(item));
      this.pending.set(this.outbox.length);
      this.showNotice('Ein Zug ist nicht beim Gastgeber angekommen. Bitte noch einmal versuchen.');
    }
    if (this.hostPeer && this.outbox.length && now - this.outbox[0].sentAt > ACK_TIMEOUT_MS) {
      this.outbox.forEach((item) => this.sendAction(item));
    }
    if (now - this.lastFollowSent >= TICK_MS) this.sendFollow();
  }

  private toHost(msg: NetMessage): boolean {
    if (!this.transport || !this.hostPeer) return false;
    this.transport.send(msg, this.hostPeer);
    return true;
  }

  private receiveChat(msg: Extract<NetMessage, { t: 'chat' }>): void {
    this.chat.update((list) => [...list.slice(-99), { id: msg.id, name: msg.name, text: msg.text, at: this.env.now() }]);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.env.setTimeout(fn, ms));
  }
}

function nextRound(room: RoomInfo): RoomInfo {
  return { ...room, round: (room.round ?? 0) + 1 };
}

function storedValue(storage: Storage, key: string, create: () => string): string {
  let value = storage.getItem(key);
  if (!value) {
    value = create();
    storage.setItem(key, value);
  }
  return value;
}

function save(storage: Storage, room: RoomInfo, game: GameState | null): void {
  try {
    const data: SavedRoom = { room, game, savedAt: Date.now() };
    storage.setItem(`neuland:save:${room.code}`, JSON.stringify(data));
  } catch {
    // Speicher voll oder gesperrt: Spielen geht trotzdem.
  }
}

export function loadSaved(code: string, storage: Storage = localStorage): SavedRoom | null {
  try {
    const raw = storage.getItem(`neuland:save:${code}`);
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

export function recentRooms(
  storage: Storage = localStorage,
): { code: string; savedAt: number; started: boolean; names: string[] }[] {
  const result = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('neuland:save:')) continue;
    const saved = loadSaved(key.slice('neuland:save:'.length), storage);
    if (saved) {
      result.push({
        code: saved.room.code,
        savedAt: saved.savedAt,
        started: !!saved.game && saved.game.phase.kind !== 'ended',
        names: saved.room.players.map((p) => p.name),
      });
    }
  }
  return result.sort((a, b) => b.savedAt - a.savedAt).slice(0, 5);
}
