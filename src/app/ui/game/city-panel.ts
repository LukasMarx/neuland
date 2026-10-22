import { Component, computed, inject, input, output } from '@angular/core';
import {
  canImprove,
  CARD_NAMES,
  count,
  GameState,
  metropolisCandidates,
  metropolisGain,
  Track,
  TRACK_GOODS,
  TRACK_NAMES,
  TRACKS,
} from '../../engine';
import { RoomService } from '../../net/room.service';
import { RESOURCE_ART } from '../shared/resource-art';

/** Was die dritte Stufe einer Richtung freischaltet. */
const ABILITY: Record<Track, string> = {
  market: 'Güter 2:1 mit der Bank tauschen',
  council: 'Wächter auf die höchste Stufe heben (kommt mit den Wächtern)',
  scholars: 'Bekommst du bei einem Wurf nichts, nimmst du dir einen Rohstoff',
};

/**
 * Stadtausbau im Dock (Stadtwacht): drei Richtungen mit je fünf Stufen. Stufe n kostet n Güter der
 * Richtung; wer zuerst Stufe 4 erreicht, macht eine Stadt zur Prachtstadt.
 */
@Component({
  selector: 'app-city-panel',
  template: `
    <div class="tracks">
      @for (t of tracks(); track t.track) {
        <section class="track" [attr.data-track]="t.track">
          <header>
            <img [src]="art[t.good]" alt="" />
            <b>{{ t.name }}</b>
            <small>zahlt mit {{ t.goodName }}</small>
          </header>
          <ol class="levels" [attr.aria-label]="t.name + ': Stufe ' + t.level + ' von 5'">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <li [class.done]="n <= t.level" [class.next]="n === t.level + 1">{{ n }}</li>
            }
          </ol>
          <p class="ability" [class.on]="t.level >= 3"><b>Ab Stufe 3:</b> {{ t.ability }}</p>
          <p class="metro">
            @if (t.holder !== null) {
              Prachtstadt: <b>{{ t.holder }}</b>
            } @else {
              Prachtstadt: noch frei, ab Stufe 4
            }
          </p>
          @if (t.level < 5) {
            <button class="primary" [disabled]="!t.can" [title]="t.reason ?? ''" (click)="improve(t.track, t.gain)">
              Stufe {{ t.level + 1 }} für {{ t.level + 1 }} {{ t.goodName }}
              @if (t.gain) {
                <small>· Prachtstadt</small>
              }
            </button>
          } @else {
            <span class="muted">voll ausgebaut</span>
          }
        </section>
      }
    </div>
    <div class="row end">
      <button (click)="close.emit()">Schließen <kbd>Esc</kbd></button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }
    .tracks {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .track {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border-radius: 10px;
      background: var(--panel-2);
      border-top: 3px solid var(--tc);
    }
    .track[data-track='market'] {
      --tc: #e3b84f;
    }
    .track[data-track='council'] {
      --tc: #5b8bd8;
    }
    .track[data-track='scholars'] {
      --tc: #5aa66a;
    }
    header {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    header img {
      width: 24px;
      height: 24px;
    }
    header small {
      margin-left: auto;
      opacity: 0.7;
    }
    .levels {
      display: flex;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .levels li {
      flex: 1;
      text-align: center;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 3px 0;
      border-radius: 5px;
      background: rgb(255 255 255 / 0.06);
      color: rgb(255 255 255 / 0.5);
    }
    .levels li.done {
      background: var(--tc);
      color: #1b2832;
    }
    .levels li.next {
      outline: 1px dashed var(--tc);
    }
    .ability,
    .metro {
      margin: 0;
      font-size: 0.78rem;
      opacity: 0.75;
    }
    .ability.on {
      opacity: 1;
    }
    button small {
      opacity: 0.8;
    }
    @media (max-width: 720px) {
      .tracks {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CityPanel {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();
  readonly close = output<void>();
  /** Mehrere Städte kommen für die Prachtstadt in Frage: Die Wahl passiert auf dem Brett. */
  readonly chooseCity = output<Track>();

  protected readonly art = RESOURCE_ART;

  protected readonly tracks = computed(() => {
    const g = this.game();
    const seat = this.seat();
    const mine = g.improvements?.[seat];
    const hand = g.players[seat]?.resources;
    const cities = g.buildings.some((b) => b?.owner === seat && b.type === 'city');
    return TRACKS.map((track) => {
      const level = mine?.[track] ?? 0;
      const good = TRACK_GOODS[track];
      const at = g.metropolis?.[track] ?? null;
      const holderSeat = at === null ? null : (g.buildings[at]?.owner ?? null);
      const can = canImprove(g, seat, track) && this.myTurn();
      let reason: string | null = null;
      if (!can) {
        if (!this.myTurn()) reason = 'Ausbauen kannst du in deinem Zug nach dem Würfeln.';
        else if (!cities) reason = 'Für den Ausbau brauchst du eine Stadt.';
        else if (!hand || count(hand, good) < level + 1) reason = `Dafür brauchst du ${level + 1} ${CARD_NAMES[good]}.`;
        else reason = 'Für die Prachtstadt fehlt dir eine Stadt, die noch keine ist.';
      }
      return {
        track,
        good,
        level,
        can,
        reason,
        name: TRACK_NAMES[track],
        goodName: CARD_NAMES[good],
        ability: ABILITY[track],
        holder: holderSeat === null ? null : g.players[holderSeat].name + (holderSeat === seat ? ' (du)' : ''),
        gain: level < 5 && metropolisGain(g, seat, track, level + 1),
      };
    });
  });

  private myTurn(): boolean {
    const g = this.game();
    const phase = g.phase;
    if (phase.kind === 'main') return g.current === this.seat();
    return phase.kind === 'specialBuild' && phase.queue[0] === this.seat();
  }

  protected improve(track: Track, gain: boolean): void {
    // Bringt der Ausbau eine Prachtstadt und gibt es mehrere Städte dafür, wählt man sie auf dem Brett.
    if (gain && metropolisCandidates(this.game(), this.seat()).length > 1) {
      this.chooseCity.emit(track);
      return;
    }
    this.room.act({ type: 'improveCity', track });
  }
}
