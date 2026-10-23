import { Action, GameSettings, GameState, Secret } from '../engine';

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  /** Aktuelle WebRTC-Peer-ID, null wenn nicht verbunden. */
  peerId: string | null;
  /** Seit wann (Uhrzeit des Hosts) der Spieler nicht verbunden ist. */
  awaySince?: number | null;
  /** Ein Bot, den der Host in der Lobby dazugenommen hat; er spielt beim Host, nie verbunden. */
  bot?: boolean;
}

/**
 * Version des Protokolls. Peers mit anderer Version spielen nicht zusammen, weil sich
 * Spielstand oder Nachrichten unterscheiden können; sie bekommen einen Hinweis zum Neuladen.
 */
export const PROTOCOL_VERSION = 17;

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
  /** Neuer Host mit nur einer Sicht bittet um die eigenen Karten jedes Spielers (siehe engine/secrets.ts). */
  | { t: 'secretRequest'; gameId: string }
  | { t: 'secret'; gameId: string; version: number; secret: Secret }
  | { t: 'chat'; id: string; name: string; text: string };

export const PLAYER_COLORS = [
  { hex: '#d23c3c', name: 'Rot' },
  { hex: '#2f64d6', name: 'Blau' },
  { hex: '#f4f1e8', name: 'Weiß' },
  { hex: '#ee8a1c', name: 'Orange' },
  { hex: '#2f9a48', name: 'Grün' },
  // Schwarz und Pink statt Braun und Gold (23.10.2026): Braun verschwand auf Lehm und neben Rot,
  // Gold lag zu nah an Orange. Figuren in den alten Farben gibt es weiter für gespeicherte Spiele.
  { hex: '#2e2b2f', name: 'Schwarz' },
  // Für 7–8 Spieler.
  { hex: '#e0569f', name: 'Pink' },
  { hex: '#8152b3', name: 'Violett' },
];

export const MAX_PLAYERS = 8;

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
