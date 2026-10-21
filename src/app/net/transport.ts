import { NetMessage } from './protocol';

export interface TransportHandlers {
  onPeerJoin(peerId: string): void;
  onPeerLeave(peerId: string): void;
  onMessage(message: NetMessage, peerId: string): void;
}

export interface Transport {
  readonly selfId: string;
  /** Ohne `to` geht die Nachricht an alle Peers im Raum. */
  send(message: NetMessage, to?: string): void;
  leave(): void;
}

export type TransportFactory = (roomCode: string, handlers: TransportHandlers) => Transport;
