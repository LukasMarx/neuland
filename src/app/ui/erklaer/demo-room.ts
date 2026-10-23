import { Injectable } from '@angular/core';
import { Action, applyAction, GameState } from '../../engine';
import { randomInt } from '../../engine/rng';
import { LobbyPlayer } from '../../net/protocol';
import { RoomService } from '../../net/room.service';

/**
 * Raum für die Erklärvideos: kein Netz, kein Host-Wechsel, keine Bots. Der Spielstand kommt fertig
 * aus einem Drehbuch (siehe clips.ts), eigene Klicks wendet er direkt an, Züge der anderen setzt
 * das Drehbuch über `actAs`. Der Zufall bleibt fest, die Würfel lassen sich vorgeben.
 */
@Injectable()
export class DemoRoom extends RoomService {
  /** Nächster Wurf; ohne Vorgabe würfelt der Spielstand selbst (fester Seed). */
  private nextDice: [number, number] | null = null;
  /** Hält das automatische Würfeln der Spielansicht an, bis das Video würfeln will. */
  private rollLocked = true;

  load(state: GameState, mySeat: number): void {
    // Die Spielansicht erkennt den eigenen Platz an der Client-ID dieses Browsers.
    state = { ...state, players: state.players.map((p, seat) => (seat === mySeat ? { ...p, id: this.clientId } : p)) };
    const players: LobbyPlayer[] = state.players.map((p, seat) =>
      seat === mySeat ? { id: p.id, name: p.name, color: p.color, peerId: 'erklaer' } : { id: p.id, name: p.name, color: p.color, peerId: null, bot: true },
    );
    // Nur das Signal, nicht setName: Der gespeicherte Spielername des Browsers bleibt unberührt.
    this.name.set(state.players[mySeat].name);
    this.room.set({ code: 'ERKLÄR', hostId: this.clientId, epoch: 0, players, spectators: [], settings: state.settings });
    this.isHost.set(true);
    this.status.set('connected');
    this.game.set(state);
  }

  /** Erlaubt den nächsten Wurf und legt optional die Augen fest. */
  allowRoll(dice?: [number, number]): void {
    this.rollLocked = false;
    this.nextDice = dice ?? null;
  }

  override act(action: Action): void {
    this.actAs(this.mySeat(), action);
  }

  actAs(seat: number, action: Action): void {
    let s = this.game();
    if (!s) return;
    if (action.type === 'roll') {
      if (this.rollLocked) return;
      if (this.nextDice) s = { ...s, rng: rngFor(this.nextDice) };
      this.rollLocked = true;
      this.nextDice = null;
    }
    try {
      this.game.set(applyAction(s, seat, action));
    } catch (e) {
      console.warn('[erklaer]', (e as Error).message, action);
    }
  }
}

/** Ein Zufallszustand, aus dem die nächsten beiden Würfe genau diese Augen ergeben. */
function rngFor([a, b]: [number, number]): number {
  for (let r = 1; ; r++) {
    const s = { rng: r };
    if (randomInt(s, 6) + 1 === a && randomInt(s, 6) + 1 === b) return r;
  }
}
