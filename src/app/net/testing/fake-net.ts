import { Injector, runInInjectionContext } from '@angular/core';
import { Action, actingSeats, applyAction, emptyResources, GameState, legalCityVertices, legalRoadEdges } from '../../engine';
import { autoAction, legalBridgeEdges, legalRobberHexes, legalSettlementVertices, legalSetupRoads, legalSetupVertices, legalShipEdges, movableShips, RESOURCES, robberVictims } from '../../engine';
import { NetMessage } from '../protocol';
import { NET_ENV, NetEnv, RoomService } from '../room.service';
import { TransportHandlers } from '../transport';

/**
 * Testumgebung für den RoomService: virtuelle Uhr, eigener Speicher pro Tab und ein Netz im
 * Speicher mit Latenz, harten Abbrüchen, Partitionen, Umordnung, Verlust und Duplikaten.
 * Entstanden aus der Prüfung der Mehrspielerlogik vom 21.10.2026.
 */

export class Clock {
  now = 1_000_000;
  private queue: { at: number; seq: number; id: number; fn: () => void }[] = [];
  private seq = 0;
  private nextId = 1;

  schedule(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.queue.push({ at: this.now + Math.max(0, ms | 0), seq: this.seq++, id, fn });
    return id;
  }

  cancel(id: unknown): void {
    this.queue = this.queue.filter((t) => t.id !== id);
  }

  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.queue[0];
      if (!next || next.at > end) break;
      this.queue.shift();
      this.now = next.at;
      next.fn();
    }
    this.now = end;
  }
}

export class MemStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

interface Node {
  id: string;
  sim: Sim;
  code: string;
  handlers: TransportHandlers;
  alive: boolean;
}

const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class Net {
  latency = 20;
  joinDelay = 300;
  detectDelay = 15000;
  readonly nodes = new Map<string, Node>();
  private readonly links = new Map<string, number>();
  private readonly blocked = new Set<string>();
  private generation = 0;
  /** Pro Nachricht: Zusatzverzögerung in ms, -1 verwirft sie. */
  tamper: ((from: string, to: string, msg: NetMessage) => number) | null = null;
  /** Pro Nachricht: true schickt sie doppelt. */
  duplicate: ((msg: NetMessage) => boolean) | null = null;

  constructor(readonly clock: Clock) {}

  transport(sim: Sim, code: string, handlers: TransportHandlers) {
    const node: Node = { id: sim.pageId, sim, code, handlers, alive: true };
    this.nodes.set(node.id, node);
    for (const other of this.nodes.values()) {
      if (other !== node && other.alive && other.code === code) this.connectLater(node, other);
    }
    return {
      selfId: node.id,
      send: (msg: NetMessage, to?: string) => this.send(node, msg, to),
      leave: () => this.leave(node),
    };
  }

  private connectLater(a: Node, b: Node, delay = this.joinDelay): void {
    this.clock.schedule(() => {
      const key = pair(a.id, b.id);
      if (!a.alive || !b.alive || this.links.has(key) || this.blocked.has(key)) return;
      if (this.nodes.get(a.id) !== a || this.nodes.get(b.id) !== b) return;
      this.links.set(key, ++this.generation);
      b.handlers.onPeerJoin(a.id);
      a.handlers.onPeerJoin(b.id);
    }, delay);
  }

  private send(from: Node, msg: NetMessage, to?: string): void {
    if (!from.alive) return;
    const targets = to ? [to] : [...this.nodes.values()].filter((n) => n !== from && n.alive).map((n) => n.id);
    for (const id of targets) {
      const key = pair(from.id, id);
      const generation = this.links.get(key);
      if (generation === undefined) continue;
      const target = this.nodes.get(id)!;
      const payload = JSON.stringify(msg);
      let delay = this.latency;
      if (this.tamper) {
        const extra = this.tamper(from.sim.name, target.sim.name, msg);
        if (extra < 0) continue;
        delay += extra;
      }
      const copies = this.duplicate?.(msg) ? 2 : 1;
      for (let i = 0; i < copies; i++) {
        this.clock.schedule(() => {
          if (this.links.get(key) !== generation || !target.alive) return;
          target.handlers.onMessage(JSON.parse(payload), from.id);
        }, delay + i);
      }
    }
  }

  private leave(node: Node): void {
    if (!node.alive) return;
    node.alive = false;
    for (const key of [...this.links.keys()]) {
      const [a, b] = key.split('|');
      if (a !== node.id && b !== node.id) continue;
      this.links.delete(key);
      const other = this.nodes.get(a === node.id ? b : a);
      if (other?.alive) this.clock.schedule(() => other.handlers.onPeerLeave(node.id), this.latency);
    }
    if (this.nodes.get(node.id) === node) this.nodes.delete(node.id);
  }

  /** Harter Abbruch zwischen zwei Tabs ohne Abmeldung; jede Seite merkt es nach eigener Verzögerung. */
  cut(a: Sim, b: Sim, detectA = this.detectDelay, detectB = this.detectDelay): void {
    const key = pair(a.pageId, b.pageId);
    this.blocked.add(key);
    if (!this.links.delete(key)) return;
    const na = this.nodes.get(a.pageId);
    const nb = this.nodes.get(b.pageId);
    if (na) this.clock.schedule(() => na.alive && na.handlers.onPeerLeave(b.pageId), detectA);
    if (nb) this.clock.schedule(() => nb.alive && nb.handlers.onPeerLeave(a.pageId), detectB);
  }

  isolate(s: Sim, detect = this.detectDelay): void {
    for (const other of [...this.nodes.values()]) if (other.sim !== s) this.cut(s, other.sim, detect, detect);
  }

  heal(a: Sim): void {
    const na = this.nodes.get(a.pageId);
    for (const other of this.nodes.values()) {
      if (other.sim === a) continue;
      this.blocked.delete(pair(a.pageId, other.id));
      if (na) this.connectLater(na, other);
    }
  }
}

let pages = 0;
let netRandom = seeded(1);

/** Seiten-Nummern und Zufall der simulierten Tabs zurücksetzen, damit ein Lauf wiederholbar ist. */
export function resetNet(seed: number): void {
  pages = 0;
  netRandom = seeded(seed);
}

/** Ein simulierter Browser-Tab mit eigenem RoomService. */
export class Sim {
  readonly pageId = `p${++pages}`;
  readonly svc: RoomService;
  /** Hintergrund-Tab: Der Browser lässt Timer höchstens einmal pro Minute laufen. */
  throttled = false;

  constructor(
    readonly name: string,
    readonly net: Net,
    readonly storage = new MemStorage(),
  ) {
    const clock = net.clock;
    let ids = 0;
    const env: NetEnv = {
      storage,
      identity: storage,
      factory: (code, handlers) => net.transport(this, code, handlers),
      now: () => clock.now,
      setTimeout: (fn, ms) => clock.schedule(fn, this.throttled ? Math.max(ms, 60000) : ms),
      clearTimeout: (handle) => clock.cancel(handle),
      randomId: () => `${this.pageId}-${++ids}-${netRandom().toString(36).slice(2, 8)}`,
      entropy: () => Math.floor(netRandom() * 2 ** 32) | 0,
    };
    const injector = Injector.create({ providers: [{ provide: NET_ENV, useValue: env }] });
    this.svc = runInInjectionContext(injector, () => new RoomService());
  }

  get game(): GameState {
    return this.svc.game()!;
  }
  get v(): number | null {
    return this.svc.game()?.version ?? null;
  }
  get host(): boolean {
    return this.svc.isHost();
  }
  get seat(): number {
    return this.svc.mySeat();
  }
  /** Neu laden: neue Seite, gleicher Speicher. */
  reopen(): Sim {
    return new Sim(this.name, this.net, this.storage);
  }
  close(): void {
    this.svc.leave();
  }
}

export function setup(names: string[], clock = new Clock()) {
  const net = new Net(clock);
  const sims = names.map((n) => new Sim(n, net));
  const code = sims[0].svc.create(sims[0].name);
  clock.advance(1000);
  for (const s of sims.slice(1)) {
    s.svc.join(code, s.name);
    clock.advance(1000);
  }
  return { sims, code, net, clock };
}

export const hostOf = (sims: Sim[]) => sims.find((s) => s.host);
export const bySeat = (sims: Sim[], g: GameState, seat: number) => sims.find((s) => s.svc.clientId === g.players[seat].id);

/** Spielt n legale Züge; jeder Zug geht über act() des Tabs, der dran ist. */
export function play(sims: Sim[], n: number, random: () => number, pause = 200): void {
  for (let i = 0; i < n; i++) {
    const g = hostOf(sims)?.game;
    if (!g || g.phase.kind === 'ended') return;
    const step = botStep(g, random);
    const who = step && bySeat(sims, g, step.seat);
    if (!step || !who) return;
    who.svc.act(step.action);
    sims[0].net.clock.advance(pause);
  }
}

export function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

/** Eine legale, zufällige Aktion für den Sitz, der dran ist; baut auch, damit Stände wachsen. */
export function botStep(g: GameState, random: () => number): { seat: number; action: Action } | null {
  const seat = actingSeats(g)[0];
  if (seat === undefined) return null;
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const legal = (a: Action) => {
    try {
      applyAction(g, seat, a);
      return true;
    } catch {
      return false;
    }
  };
  const p = g.phase;
  switch (p.kind) {
    case 'setup':
      return p.step === 'settlement'
        ? { seat, action: { type: 'placeSettlement', vertex: pick(legalSetupVertices(g)) } }
        : { seat, action: { type: 'placeRoad', edge: pick(legalSetupRoads(g)) } };
    case 'roll':
      return { seat, action: { type: 'roll' } };
    case 'discard': {
      const left = { ...g.players[seat].resources };
      const out = emptyResources();
      for (let i = 0; i < p.pending[seat]; i++) {
        const r = RESOURCES.find((k) => left[k] > 0)!;
        left[r]--;
        out[r]++;
      }
      return { seat, action: { type: 'discard', resources: out } };
    }
    case 'robber': {
      const hex = pick(legalRobberHexes(g));
      return { seat, action: { type: 'moveRobber', hex, victim: robberVictims(g, seat, hex)[0] ?? null } };
    }
    case 'roadBuilding':
    case 'gold':
    case 'neutral':
      return { seat, action: autoAction(g, seat, random)! };
    case 'specialBuild':
      return { seat, action: { type: 'endTurn' } };
    case 'main': {
      // Mögliche Züge erst nur benennen, dann in zufälliger Reihenfolge prüfen, bis einer erlaubt ist.
      // Alle vorab zu prüfen wäre auf großen Karten mit Schiffen sehr langsam.
      const candidates: (() => Action | null)[] = [
        ...legalCityVertices(g, seat).map((vertex) => () => ({ type: 'buildCity', vertex }) as Action),
        ...legalSettlementVertices(g, seat).map((vertex) => () => ({ type: 'buildSettlement', vertex }) as Action),
        ...legalRoadEdges(g, seat).map((edge) => () => ({ type: 'buildRoad', edge }) as Action),
        () => ({ type: 'buyDevCard' }),
        ...legalShipEdges(g, seat).map((edge) => () => ({ type: 'buildShip', edge }) as Action),
        // Flussläufe: Brücken bauen und Münzen tauschen.
        ...legalBridgeEdges(g, seat).map((edge) => () => ({ type: 'buildBridge', edge }) as Action),
        ...(g.coins && g.coins[seat] >= 2 ? [() => ({ type: 'tradeCoins', resource: pick([...RESOURCES]) }) as Action] : []),
        // Fischgründe: Fische ausgeben oder den Anker weiterreichen.
        ...(g.fish && g.fish[seat].length
          ? (['robber', 'steal', 'bank', 'road', 'devCard'] as const).map((effect) => () =>
              ({ type: 'spendFish', effect, victim: pick(g.players.map((_, i) => i).filter((i) => i !== seat)), resource: pick([...RESOURCES]) }) as Action)
          : []),
        ...(g.anchor === seat ? g.players.map((_, to) => () => ({ type: 'passAnchor', to }) as Action) : []),
        // Duell: Handelsmarken für Räuber oder erzwungenen Tausch.
        ...(g.tokens?.[seat]
          ? [
              () => ({ type: 'spendTokens', effect: 'robber' }) as Action,
              () => {
                const hand = RESOURCES.flatMap((r) => Array(g.players[seat].resources[r]).fill(r) as string[]);
                const give = emptyResources();
                for (const r of hand.slice(0, 2)) give[r as keyof typeof give]++;
                return { type: 'spendTokens', effect: 'trade', give } as Action;
              },
            ]
          : []),
        ...movableShips(g, seat).map((from) => () => {
          const to = legalShipEdges({ ...g, ships: g.ships!.map((o, e) => (e === from ? null : o)) }, seat).filter((e) => e !== from);
          return to.length ? ({ type: 'moveShip', from, to: pick(to) } as Action) : null;
        }),
      ];
      // Brücken sind selten erlaubt und teuer: wenn es geht, meistens bauen, damit die Partien sie abdecken.
      // Zufall nur ziehen, wenn es Brücken gibt, damit Partien ohne Flüsse genauso laufen wie vorher.
      const bridges = legalBridgeEdges(g, seat);
      if (bridges.length && random() < 0.7) {
        const edge = pick(bridges);
        if (legal({ type: 'buildBridge', edge })) return { seat, action: { type: 'buildBridge', edge } };
      }
      if (random() < 0.8) {
        for (let tries = 0; tries < 12 && candidates.length; tries++) {
          const [make] = candidates.splice(Math.floor(random() * candidates.length), 1);
          const action = make();
          if (action && legal(action)) return { seat, action };
        }
      }
      return { seat, action: { type: 'endTurn' } };
    }
    default:
      return null;
  }
}
