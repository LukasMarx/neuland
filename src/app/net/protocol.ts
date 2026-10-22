import { Action, GameSettings, GameState } from '../engine';

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  /** Aktuelle WebRTC-Peer-ID, null wenn nicht verbunden. */
  peerId: string | null;
  /** Seit wann (Uhrzeit des Hosts) der Spieler nicht verbunden ist. */
  awaySince?: number | null;
}

/**
 * Version des Protokolls. Peers mit anderer Version spielen nicht zusammen, weil sich
 * Spielstand oder Nachrichten unterscheiden können; sie bekommen einen Hinweis zum Neuladen.
 */
export const PROTOCOL_VERSION = 7;

export interface RoomInfo {
  code: string;
  hostId: string;
  /** Wird bei jedem Host-Wechsel erhöht. */
  epoch: number;
  /**
   * Wird bei jedem Start und jeder Rückkehr in die Lobby erhöht. So verliert ein Stand
   * aus einer früheren Runde immer gegen die laufende, egal wie weit er fortgeschritten war.
   */
  round?: number;
  players: LobbyPlayer[];
  spectators: LobbyPlayer[];
  settings: GameSettings;
}

export type NetMessage =
  | { t: 'hello'; id: string; name: string; proto?: number }
  | { t: 'room'; room: RoomInfo; game: GameState | null }
  /** Lebenszeichen des Hosts mit seinem Rang; wer zurückliegt, fragt per `sync` nach. */
  | { t: 'tick'; rank: number[]; gameId: string | null }
  | { t: 'sync' }
  /** Ein Client kennt einen neueren Stand derselben Partie und bietet ihn dem Host an. */
  | { t: 'offer'; game: GameState }
  | { t: 'profile'; name: string; color: string }
  | { t: 'claim'; playerId: string }
  /** Aktion mit Sitzung `s` und Laufnummer `n`; der Host wendet jede genau einmal an und bestätigt sie. */
  | { t: 'action'; action: Action; s: string; n: number }
  | { t: 'ack'; s: string; n: number }
  | { t: 'reject'; error: string; s?: string; n?: number }
  /** Wem ein Client gerade folgt (null: keinem erreichbaren Host). Hosts erkennen so Rivalen. */
  | { t: 'follow'; hostId: string | null; rank: number[] }
  /** Für einen nicht verbundenen Spieler einen automatischen Zug machen. */
  | { t: 'standIn'; seat: number }
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
 * Rang eines Raumzustands: Runde (eine neuere Runde schlägt jeden Stand einer älteren),
 * laufendes Spiel, Spielstand-Version (ein veralteter Stand darf nie gewinnen), Epoche, Spielerzahl.
 */
export function roomRank(x: { room: RoomInfo; game: GameState | null }): number[] {
  return [x.room.round ?? 0, x.game ? 1 : 0, x.game?.version ?? 0, x.room.epoch, x.room.players.length];
}

export function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Totale Ordnung über konkurrierende Raumzustände. Treffen zwei Hosts aufeinander,
 * gewinnt der höhere Rang (siehe `roomRank`), bei Gleichstand die kleinere Host-ID.
 */
export function compareRoom(
  a: { room: RoomInfo; game: GameState | null },
  b: { room: RoomInfo; game: GameState | null },
): number {
  const d = compareRank(roomRank(a), roomRank(b));
  if (d) return d;
  return a.room.hostId === b.room.hostId ? 0 : a.room.hostId < b.room.hostId ? 1 : -1;
}
