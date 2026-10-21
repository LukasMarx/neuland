import { computed, Injectable, isDevMode, signal } from '@angular/core';
import * as engine from '../engine';
import { Action, applyAction, createGame, GameSettings, GameState, RuleError } from '../engine';
import { LocalTransport } from './local-transport';
import { compareRoom, LobbyPlayer, MAX_PLAYERS, NetMessage, PLAYER_COLORS, RoomInfo } from './protocol';
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

export type RoomStatus = 'idle' | 'searching' | 'connected';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** So lange wartet ein Beitretender auf einen Host, bevor er gespeicherte Spiele selbst fortsetzt. */
const SEARCH_TIMEOUT_MS = 12000;
const RE_ELECT_MS = 8000;
/** Lokaler Testmodus (`?local`): Tabs verbinden sich per BroadcastChannel statt P2P. */
const params = new URLSearchParams(location.search);
/** Lokaler Testmodus (`?local`): Tabs verbinden sich per BroadcastChannel statt P2P. */
export const LOCAL_MODE = params.has('local') || sessionStorage.getItem('neuland:local') === '1';
/** Jeder Tab ein eigener Spieler (`?tab` oder `?local`), sonst ist ein Browser ein Spieler. */
const PER_TAB = LOCAL_MODE || params.has('tab') || sessionStorage.getItem('neuland:tab') === '1';
if (LOCAL_MODE) sessionStorage.setItem('neuland:local', '1');
if (PER_TAB) sessionStorage.setItem('neuland:tab', '1');
const identity: Storage = PER_TAB ? sessionStorage : localStorage;

@Injectable({ providedIn: 'root' })
export class RoomService {
  readonly clientId = storedValue('neuland:clientId', () => crypto.randomUUID());
  readonly name = signal(identity.getItem('neuland:name') ?? '');
  readonly status = signal<RoomStatus>('idle');
  readonly room = signal<RoomInfo | null>(null);
  readonly game = signal<GameState | null>(null);
  readonly isHost = signal(false);
  readonly chat = signal<ChatMessage[]>([]);
  readonly notice = signal<{ text: string; at: number } | null>(null);
  readonly searchSlow = signal(false);
  readonly connectedPeers = signal<ReadonlySet<string>>(new Set());

  readonly code = computed(() => this.room()?.code ?? this.pendingCode());
  readonly mySeat = computed(() => this.game()?.players.findIndex((p) => p.id === this.clientId) ?? -1);
  readonly me = computed(() => this.room()?.players.find((p) => p.id === this.clientId) ?? null);

  private readonly pendingCode = signal<string | null>(null);
  private transport: Transport | null = null;
  private hostPeer: string | null = null;
  private readonly peerClients = new Map<string, string>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly factory: TransportFactory = LOCAL_MODE
    ? (code, h) => new LocalTransport(code, h)
    : (code, h) => new TrysteroTransport(code, h);

  constructor() {
    // Zum Debuggen in der Browser-Konsole, nur im Entwicklungsmodus.
    if (isDevMode()) Object.assign(window, { neuland: { room: this, engine } });
  }

  /** Neuen Raum eröffnen, der Ersteller ist Host. */
  create(name: string): string {
    this.setName(name);
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    this.connect(code);
    this.becomeHost(this.freshRoom(code), null);
    return code;
  }

  /** Einem Raum beitreten. Antwortet kein Host, kann man ihn selbst (wieder) eröffnen. */
  join(code: string, name: string): void {
    if (this.code() === code && this.status() !== 'idle') return;
    this.setName(name);
    this.connect(code);
    this.status.set('searching');
    this.later(4000, () => this.status() === 'searching' && this.searchSlow.set(true));
    this.later(SEARCH_TIMEOUT_MS, () => {
      if (this.status() === 'searching' && loadSaved(code)?.game) this.openAsHost();
    });
  }

  /** Selbst Host werden: mit gespeichertem Stand, falls vorhanden, sonst mit leerer Lobby. */
  openAsHost(): void {
    const code = this.code();
    if (!code) return;
    const saved = loadSaved(code);
    if (saved) {
      this.becomeHost({ ...saved.room, epoch: saved.room.epoch + 1 }, saved.game);
    } else {
      this.becomeHost(this.freshRoom(code), null);
    }
  }

  leave(): void {
    this.transport?.leave();
    this.transport = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.hostPeer = null;
    this.peerClients.clear();
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
    identity.setItem('neuland:name', trimmed);
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

  startGame(): void {
    const room = this.room();
    if (!this.isHost() || !room) return;
    const players = room.players.map(({ id, name, color }) => ({ id, name, color }));
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.game.set(createGame(players, room.settings, seed));
    this.broadcast();
  }

  /** Zurück in die Lobby, z. B. für eine neue Runde. */
  backToLobby(): void {
    if (!this.isHost()) return;
    this.game.set(null);
    this.broadcast();
  }

  act(action: Action): void {
    if (this.isHost()) {
      this.applyFrom(this.clientId, action, null);
    } else if (!this.toHost({ t: 'action', action })) {
      this.showNotice('Keine Verbindung zum Gastgeber.');
    }
  }

  sendChat(text: string): void {
    const msg = text.trim().slice(0, 300);
    if (!msg || !this.transport) return;
    const message: NetMessage = { t: 'chat', id: this.clientId, name: this.name(), text: msg };
    this.transport.send(message);
    this.receiveChat(message);
  }

  showNotice(text: string): void {
    this.notice.set({ text, at: Date.now() });
  }

  // -------------------------------------------------------------------------

  private connect(code: string): void {
    this.leave();
    this.pendingCode.set(code);
    const handlers: TransportHandlers = {
      onPeerJoin: (peer) => this.onPeerJoin(peer),
      onPeerLeave: (peer) => this.onPeerLeave(peer),
      onMessage: (msg, peer) => this.onMessage(msg, peer),
    };
    this.transport = this.factory(code, handlers);
  }

  private freshRoom(code: string): RoomInfo {
    return {
      code,
      hostId: this.clientId,
      epoch: 0,
      players: [],
      spectators: [],
      settings: { victoryPoints: 10 },
    };
  }

  private becomeHost(room: RoomInfo, game: GameState | null): void {
    const selfPeer = this.transport?.selfId ?? null;
    const peers = this.connectedPeers();
    const markConnected = (p: LobbyPlayer): LobbyPlayer => {
      if (p.id === this.clientId) return { ...p, peerId: selfPeer };
      const peer = [...this.peerClients].find(([, id]) => id === p.id)?.[0];
      return { ...p, peerId: peer && peers.has(peer) ? peer : null };
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
    this.status.set('connected');
    this.searchSlow.set(false);
    this.room.set(next);
    this.game.set(game);
    this.broadcast();
  }

  private onPeerJoin(peer: string): void {
    this.connectedPeers.update((s) => new Set(s).add(peer));
    this.transport?.send({ t: 'hello', id: this.clientId, name: this.name() }, peer);
    if (this.isHost()) this.sendRoom(peer);
  }

  private onPeerLeave(peer: string): void {
    this.connectedPeers.update((s) => {
      const next = new Set(s);
      next.delete(peer);
      return next;
    });
    if (this.isHost()) {
      const clear = (p: LobbyPlayer) => (p.peerId === peer ? { ...p, peerId: null } : p);
      this.mutateRoom((r) => ({ ...r, players: r.players.map(clear), spectators: r.spectators.map(clear) }));
    } else if (peer === this.hostPeer) {
      this.hostPeer = null;
      this.electHost();
    }
  }

  /**
   * Der Host ist weg. Der verbundene Spieler mit dem kleinsten Sitzplatz übernimmt.
   * Kommt danach länger kein neuer Host, übernimmt man selbst; Konflikte löst compareRoom.
   */
  private electHost(): void {
    const room = this.room();
    if (!room) return;
    const peers = this.connectedPeers();
    const order = this.game()?.players.map((p) => p.id) ?? room.players.map((p) => p.id);
    const members = [...room.players, ...room.spectators];
    const candidate = order
      .concat(room.spectators.map((s) => s.id))
      .find((id) => {
        if (id === room.hostId) return false;
        if (id === this.clientId) return true;
        const peer = members.find((m) => m.id === id)?.peerId;
        return !!peer && peers.has(peer);
      });
    if (candidate === this.clientId) {
      this.becomeHost({ ...room, epoch: room.epoch + 1 }, this.game());
      this.showNotice('Der Gastgeber ist weg. Du leitest jetzt das Spiel.');
      return;
    }
    this.later(RE_ELECT_MS, () => {
      if (!this.isHost() && this.hostPeer === null && this.room()) {
        this.becomeHost({ ...this.room()!, epoch: this.room()!.epoch + 1 }, this.game());
      }
    });
  }

  private onMessage(msg: NetMessage, peer: string): void {
    switch (msg.t) {
      case 'hello':
        this.peerClients.set(peer, msg.id);
        if (this.isHost()) {
          this.mutateRoom((r) => this.withMember(r, this.game(), msg.id, msg.name, peer));
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
        if (this.isHost() && id) this.applyFrom(id, msg.action, peer);
        break;
      }
      case 'reject':
        this.showNotice(msg.error);
        break;
      case 'chat':
        this.receiveChat(msg);
        break;
    }
  }

  private onRoom(room: RoomInfo, game: GameState | null, peer: string): void {
    const current = this.room();
    const incoming = { room, game };
    if (this.isHost()) {
      if (current && compareRoom(incoming, { room: current, game: this.game() }) <= 0) {
        // Wir haben den höheren Rang, der andere soll zurücktreten.
        this.sendRoom(peer);
        return;
      }
      this.isHost.set(false);
    } else if (current && peer !== this.hostPeer && this.hostPeer !== null) {
      if (compareRoom(incoming, { room: current, game: this.game() }) <= 0) return;
    }
    this.hostPeer = peer;
    this.peerClients.set(peer, room.hostId);
    this.status.set('connected');
    this.searchSlow.set(false);
    this.room.set(room);
    this.game.set(game);
    save(room, game);
    // Falls der Host uns noch nicht kennt (z. B. nach einem Host-Wechsel), melden wir uns an.
    const known = [...room.players, ...room.spectators].some((p) => p.id === this.clientId && p.peerId);
    if (!known) this.transport?.send({ t: 'hello', id: this.clientId, name: this.name() }, peer);
  }

  private applyFrom(clientId: string, action: Action, peer: string | null): void {
    const game = this.game();
    if (!game) return;
    const seat = game.players.findIndex((p) => p.id === clientId);
    try {
      if (seat < 0) throw new RuleError('Zuschauer können nicht mitspielen.');
      this.game.set(applyAction(game, seat, action));
      this.broadcast();
    } catch (e) {
      const error = e instanceof RuleError ? e.message : 'Unerwarteter Fehler.';
      if (!(e instanceof RuleError)) console.error(e);
      this.reject(peer, error);
    }
  }

  private applyClaim(claimantId: string, playerId: string, peer: string | null): void {
    const room = this.room();
    const game = this.game();
    const claimant = room?.spectators.find((p) => p.id === claimantId);
    const target = room?.players.find((p) => p.id === playerId);
    const seat = game?.players.findIndex((p) => p.id === playerId) ?? -1;
    if (!room || !game || !claimant || !target || seat < 0) return;
    if (target.peerId && target.name !== claimant.name) {
      this.reject(peer, `${target.name} ist noch verbunden.`);
      return;
    }
    const next = structuredClone(game);
    next.players[seat].id = claimantId;
    next.version++;
    this.game.set(next);
    this.mutateRoom((r) => ({
      ...r,
      players: r.players.map((p) => (p.id === playerId ? { ...p, id: claimantId, peerId: claimant.peerId } : p)),
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
    const update = (p: LobbyPlayer) => (p.id === id ? { ...p, peerId: peer, name: name || p.name } : p);
    // Im laufenden Spiel behält ein Platz seinen Namen, auch wenn ihn jemand mit anderem Namen übernommen hat.
    const reconnect = (p: LobbyPlayer) => (p.id === id ? { ...p, peerId: peer } : p);
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
    save(room, this.game());
  }

  private sendRoom(peer: string): void {
    const room = this.room();
    if (room) this.transport?.send({ t: 'room', room, game: this.game() }, peer);
  }

  private toHost(msg: NetMessage): boolean {
    if (!this.transport || !this.hostPeer) return false;
    this.transport.send(msg, this.hostPeer);
    return true;
  }

  private receiveChat(msg: Extract<NetMessage, { t: 'chat' }>): void {
    this.chat.update((list) => [...list.slice(-99), { id: msg.id, name: msg.name, text: msg.text, at: Date.now() }]);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }
}

function storedValue(key: string, create: () => string): string {
  let value = identity.getItem(key);
  if (!value) {
    value = create();
    identity.setItem(key, value);
  }
  return value;
}

function save(room: RoomInfo, game: GameState | null): void {
  try {
    const data: SavedRoom = { room, game, savedAt: Date.now() };
    localStorage.setItem(`neuland:save:${room.code}`, JSON.stringify(data));
  } catch {
    // Speicher voll oder gesperrt: Spielen geht trotzdem.
  }
}

export function loadSaved(code: string): SavedRoom | null {
  try {
    const raw = localStorage.getItem(`neuland:save:${code}`);
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

export function recentRooms(): { code: string; savedAt: number; started: boolean; names: string[] }[] {
  const result = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('neuland:save:')) continue;
    const saved = loadSaved(key.slice('neuland:save:'.length));
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
