import { Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { Action, actingSeats, botAction } from '../../engine';
import { RoomService } from '../../net/room.service';
import { GameView } from '../game/game';
import { DemoRoom } from './demo-room';
import { Folie, FolieView } from './folie';
import { BLENDE_MS, Hexblende } from './hexblende';
import { SPIELSTAENDE } from './spielstand';
import { Szene, SzeneId } from './szene';

export interface Karte {
  art: 'intro' | 'outro';
  titel: string;
  unter?: string;
  /** Kopfzeile über dem Titel; Vorgabe je nach Art („Grundspiel erklärt“, „Viel Spaß beim Spielen“). */
  zeile?: string;
}

/** `spiel: null` kehrt zum geladenen Spielstand zurück, ohne ihn neu aufzubauen. */
type Inhalt = { szene: SzeneId } | { folie: Folie } | { spiel: string | null } | null;

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Die Karte steigt nach der Blende auf und braucht dafür so lange. */
const KARTE_MS = 700;

/**
 * Bühne für die Erklärvideos (`#/erklaer`). Ein Aufnahme-Skript steuert sie über `window.erklaer`:
 * Titelkarten, Erklärszenen und die echte Spielansicht mit festem Spielstand, verbunden durch die
 * Sechseck-Blende. Jede Methode kehrt erst zurück, wenn ihr Übergang fertig ist.
 */
@Component({
  selector: 'app-erklaer',
  imports: [FolieView, GameView, Hexblende, Szene],
  providers: [DemoRoom, { provide: RoomService, useExisting: DemoRoom }],
  templateUrl: './erklaer.html',
  styleUrl: './erklaer.scss',
  // Die Bühne stellt auch den Mauszeiger der Aufnahme um, der außerhalb der Komponente hängt.
  encapsulation: ViewEncapsulation.None,
})
export class ErklaerPage {
  private readonly room = inject(DemoRoom);

  protected readonly inhalt = signal<Inhalt>(null);
  protected readonly takt = signal(0);
  protected readonly karte = signal<Karte | null>(null);
  protected readonly zu = signal(false);
  protected readonly spielId = signal(0);
  /** Was das Drehbuch des geladenen Spielstands vorbereitet hat (Felder, Ecken, Kanten). */
  private plan: Record<string, unknown> = {};

  constructor() {
    document.documentElement.classList.add('erklaer');
    const api = {
      karte: (k: Karte) => this.zeigeKarte(k),
      szene: (id: SzeneId) => this.wechsle({ szene: id }),
      /** Eine Folie aus Daten des Drehbuchs (siehe folie.ts). */
      folie: (f: Folie) => this.wechsle({ folie: f }),
      /** Lädt einen Spielstand aus spielstand.ts; ohne Kennung zurück zum laufenden. */
      spiel: (id?: string) => this.wechsle({ spiel: id ?? null }),
      takt: (n?: number) => {
        this.takt.update((t) => n ?? t + 1);
        return warte(0);
      },
      /** Erlaubt den nächsten Wurf, auf Wunsch mit festen Augen. */
      wurf: (a?: number, b?: number) => this.room.allowRoll(a && b ? [a, b] : undefined),
      /** Zug eines Mitspielers aus dem Drehbuch. */
      zug: (name: string, action: Action) => {
        const seat = this.room.game()?.players.findIndex((p) => p.name === name) ?? -1;
        if (seat < 0) throw new Error(`Kein Spieler ${name}`);
        this.room.actAs(seat, action);
      },
      /** Was der Bot an Maras Stelle jetzt täte, etwa eine gute Ecke für die Siedlung. */
      vorschlag: () => {
        const g = this.room.game();
        return g ? botAction(g, this.room.mySeat()) : null;
      },
      /** Lässt die Mitspieler ziehen, bis Mara wieder dran ist; ein Schritt alle `ms`. */
      andere: (ms = 600) => this.andereSpielen(ms),
      plan: () => this.plan,
      stand: () => this.room.game(),
    };
    Object.assign(window, { erklaer: api });
    inject(DestroyRef).onDestroy(() => {
      document.documentElement.classList.remove('erklaer', 'erklaer-ohne-zeiger');
      delete (window as { erklaer?: unknown }).erklaer;
    });
    this.zeiger(false);
  }

  protected szeneId(i: Inhalt): SzeneId | null {
    return i && 'szene' in i ? i.szene : null;
  }

  protected folieVon(i: Inhalt): Folie | null {
    return i && 'folie' in i ? i.folie : null;
  }

  protected istSpiel(i: Inhalt): boolean {
    return !!i && 'spiel' in i;
  }

  /** Titelkarte über allem; die Blende schließt sich darunter. */
  private async zeigeKarte(k: Karte): Promise<void> {
    this.zeiger(false);
    if (!this.zu()) {
      this.zu.set(true);
      await warte(BLENDE_MS);
    }
    this.karte.set(k);
    await warte(KARTE_MS);
  }

  /** Neuer Inhalt hinter der Blende: zu, umbauen, auf. */
  private async wechsle(next: Exclude<Inhalt, null>): Promise<void> {
    if (this.karte()) {
      this.karte.set(null);
      await warte(300);
    } else if (!this.zu()) {
      this.zu.set(true);
      await warte(BLENDE_MS);
    }
    this.takt.set(0);
    if ('spiel' in next && next.spiel) {
      const make = SPIELSTAENDE[next.spiel];
      if (!make) throw new Error(`Unbekannter Spielstand ${next.spiel}`);
      const { state, seat, plan } = make();
      this.room.load(state, seat);
      this.plan = plan ?? {};
      // Neuer Stand, neue Spielansicht: keine Reste aus dem vorigen Stand (Banner, Dialoge).
      this.spielId.update((n) => n + 1);
    }
    this.inhalt.set(next);
    await warte(250);
    this.zu.set(false);
    this.zeiger('spiel' in next);
    await warte(BLENDE_MS);
  }

  private async andereSpielen(ms: number): Promise<void> {
    const me = this.room.mySeat();
    for (let i = 0; i < 200; i++) {
      const g = this.room.game();
      if (!g || g.phase.kind === 'ended') return;
      const seat = actingSeats(g).find((s) => s !== me);
      if (seat === undefined) return;
      const action = botAction(g, seat);
      if (!action) return;
      if (action.type === 'roll') this.room.allowRoll();
      this.room.actAs(seat, action);
      await warte(ms);
    }
  }

  /** Den Mauszeiger der Aufnahme nur zeigen, wenn im Spiel geklickt wird. */
  private zeiger(an: boolean): void {
    document.documentElement.classList.toggle('erklaer-ohne-zeiger', !an);
  }
}
