import { Action, GameSettings, GameState } from '../engine';

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  /** Aktuelle WebRTC-Peer-ID, null wenn nicht verbunden. */
  peerId: string | null;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  /** Wird bei jedem Host-Wechsel erhöht. */
  epoch: number;
  players: LobbyPlayer[];
  spectators: LobbyPlayer[];
  settings: GameSettings;
}

export type NetMessage =
  | { t: 'hello'; id: string; name: string }
  | { t: 'room'; room: RoomInfo; game: GameState | null }
  | { t: 'profile'; name: string; color: string }
  | { t: 'claim'; playerId: string }
  | { t: 'action'; action: Action }
  | { t: 'reject'; error: string }
  | { t: 'chat'; id: string; name: string; text: string };

export const PLAYER_COLORS = [
  { hex: '#d23c3c', name: 'Rot' },
  { hex: '#2f64d6', name: 'Blau' },
  { hex: '#f4f1e8', name: 'Weiß' },
  { hex: '#ee8a1c', name: 'Orange' },
  { hex: '#2f9a48', name: 'Grün' },
  { hex: '#7b4a2a', name: 'Braun' },
];

export const MAX_PLAYERS = 6;

/**
 * Totale Ordnung über konkurrierende Raumzustände. Treffen zwei Hosts aufeinander,
 * gewinnt der höhere Rang: laufendes Spiel, dann Spielstand-Version (ein veralteter
 * Spielstand darf nie gewinnen), dann Epoche, dann Spielerzahl, dann die kleinere Host-ID.
 */
export function compareRoom(
  a: { room: RoomInfo; game: GameState | null },
  b: { room: RoomInfo; game: GameState | null },
): number {
  const keys = (x: typeof a) => [x.game ? 1 : 0, x.game?.version ?? 0, x.room.epoch, x.room.players.length];
  const ka = keys(a);
  const kb = keys(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.room.hostId === b.room.hostId ? 0 : a.room.hostId < b.room.hostId ? 1 : -1;
}
