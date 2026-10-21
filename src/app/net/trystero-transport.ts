import { DataPayload, joinRoom, MessageAction, Room, selfId } from 'trystero';
import { accessPassword } from './access';
import { NetMessage } from './protocol';
import { Transport, TransportHandlers } from './transport';

const APP_ID = 'katan-remote-b7e2c4';

/**
 * Falls in manchen Netzen keine direkte Verbindung zustande kommt, hier einen
 * TURN-Server eintragen (z. B. Cloudflare TURN oder Open Relay von Metered).
 */
const TURN_SERVERS: RTCIceServer[] = [];

export class TrysteroTransport implements Transport {
  readonly selfId = selfId;
  private readonly room: Room;
  private readonly channel: MessageAction<DataPayload>;
  // Beim Schließen des Tabs aktiv abmelden, sonst merken die anderen es erst nach ~15 s.
  private readonly onPageHide = () => void this.room.leave();

  constructor(roomCode: string, handlers: TransportHandlers) {
    this.room = joinRoom(
      {
        appId: APP_ID,
        // Verschlüsselt den Verbindungsaufbau; nur wer das Zugangspasswort kennt, kommt in Räume.
        password: accessPassword() ?? undefined,
        ...(TURN_SERVERS.length ? { turnConfig: TURN_SERVERS } : {}),
      },
      roomCode,
      { onJoinError: (details) => console.warn('Verbindung fehlgeschlagen', details) },
    );
    this.channel = this.room.makeAction<DataPayload>('m');
    this.channel.onMessage = (data, { peerId }) => handlers.onMessage(data as unknown as NetMessage, peerId);
    this.room.onPeerJoin = (peerId) => handlers.onPeerJoin(peerId);
    this.room.onPeerLeave = (peerId) => handlers.onPeerLeave(peerId);
    addEventListener('pagehide', this.onPageHide);
  }

  send(msg: NetMessage, to?: string): void {
    void this.channel.send(msg as unknown as DataPayload, to ? { target: to } : undefined);
  }

  leave(): void {
    removeEventListener('pagehide', this.onPageHide);
    void this.room.leave();
  }
}
