import { NetMessage } from './protocol';
import { Transport, TransportHandlers } from './transport';

type Packet =
  | { k: 'ping'; from: string }
  | { k: 'bye'; from: string }
  | { k: 'data'; from: string; to?: string; msg: NetMessage };

const HEARTBEAT_MS = 1000;
// Großzügig, weil Browser Timer in Hintergrund-Tabs stark drosseln.
const TIMEOUT_MS = 90000;

/**
 * Verbindet Tabs desselben Browsers über BroadcastChannel. Für Entwicklung und Tests
 * ohne Internet, aktiviert mit `?local` in der URL.
 */
export class LocalTransport implements Transport {
  readonly selfId = crypto.randomUUID().slice(0, 8);
  private readonly channel: BroadcastChannel;
  private readonly lastSeen = new Map<string, number>();
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly onPageHide = () => this.post({ k: 'bye', from: this.selfId });

  constructor(
    roomCode: string,
    private readonly handlers: TransportHandlers,
  ) {
    this.channel = new BroadcastChannel(`neuland-local-${roomCode}`);
    this.channel.onmessage = (e: MessageEvent<Packet>) => this.receive(e.data);
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    addEventListener('pagehide', this.onPageHide);
    this.post({ k: 'ping', from: this.selfId });
  }

  send(msg: NetMessage, to?: string): void {
    this.post({ k: 'data', from: this.selfId, to, msg });
  }

  leave(): void {
    this.onPageHide();
    removeEventListener('pagehide', this.onPageHide);
    clearInterval(this.timer);
    this.channel.close();
  }

  private post(packet: Packet): void {
    this.channel.postMessage(packet);
  }

  private heartbeat(): void {
    this.post({ k: 'ping', from: this.selfId });
    const now = Date.now();
    for (const [peer, seen] of this.lastSeen) {
      if (now - seen > TIMEOUT_MS) this.drop(peer);
    }
  }

  private drop(peer: string): void {
    if (this.lastSeen.delete(peer)) this.handlers.onPeerLeave(peer);
  }

  private receive(packet: Packet): void {
    if (packet.from === this.selfId) return;
    if (packet.k === 'bye') {
      this.drop(packet.from);
      return;
    }
    if (!this.lastSeen.has(packet.from)) {
      this.lastSeen.set(packet.from, Date.now());
      // Sofort antworten, damit der Neue uns nicht erst beim nächsten Heartbeat sieht.
      this.post({ k: 'ping', from: this.selfId });
      this.handlers.onPeerJoin(packet.from);
    }
    this.lastSeen.set(packet.from, Date.now());
    if (packet.k === 'data' && (!packet.to || packet.to === this.selfId)) {
      this.handlers.onMessage(packet.msg, packet.from);
    }
  }
}
