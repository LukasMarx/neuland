import { Component, computed, inject, output, signal } from '@angular/core';
import { MapDef, mapById, mapFits, MAPS, mapShape } from '../../engine';
import { MAX_PLAYERS, PLAYER_COLORS } from '../../net/protocol';
import { LOCAL_MODE, RoomService } from '../../net/room.service';
import { ChatBox } from '../shared/chat-box';
import { MapThumb } from './map-thumb';

@Component({
  selector: 'app-lobby',
  imports: [ChatBox, MapThumb],
  template: `
    @let r = room.room()!;
    <main>
      <header class="row">
        <h1>Lobby</h1>
        <span class="spacer"></span>
        <button (click)="leave.emit()">Verlassen</button>
      </header>

      <section class="panel invite">
        <div>
          <div class="muted">Raumcode</div>
          <div class="code">{{ r.code }}</div>
        </div>
        <div class="link">
          <div class="muted">Link für die anderen</div>
          <div class="row nowrap">
            <input readonly [value]="inviteLink" (focus)="$any($event.target).select()" aria-label="Einladungslink" />
            <button (click)="copy()">{{ copied() ? 'Kopiert ✓' : 'Kopieren' }}</button>
          </div>
        </div>
      </section>

      <div class="grid">
        <section class="panel">
          <h3>Spieler ({{ r.players.length }}/{{ maxPlayers }})</h3>
          <ul class="players">
            @for (p of r.players; track p.id) {
              <li [class.offline]="!p.peerId">
                <span class="color-dot" [style.background]="p.color"></span>
                <span class="name">{{ p.name }}</span>
                @if (p.id === room.clientId) {
                  <span class="tag">Du</span>
                }
                @if (p.id === r.hostId) {
                  <span class="tag">Gastgeber</span>
                }
                @if (!p.peerId) {
                  <span class="muted small">getrennt</span>
                  @if (room.isHost()) {
                    <button class="small" (click)="room.removePlayer(p.id)">Entfernen</button>
                  }
                }
              </li>
            }
          </ul>
          @if (r.spectators.length) {
            <p class="muted small">Zuschauer: {{ spectatorNames() }}</p>
          }

          @if (room.me(); as me) {
            <h3 class="mt">Deine Farbe</h3>
            <div class="row">
              @for (c of colors; track c.hex) {
                <button
                  class="swatch"
                  [style.background]="c.hex"
                  [class.selected]="me.color === c.hex"
                  [disabled]="takenColors().has(c.hex) && me.color !== c.hex"
                  [attr.aria-label]="c.name"
                  [title]="c.name"
                  (click)="room.updateProfile(room.name(), c.hex)"
                ></button>
              }
            </div>
          }
        </section>

        <section class="panel">
          <h3>Einstellungen</h3>
          <label class="row">
            Siegpunkte
            @if (room.isHost()) {
              <select (change)="setVp($any($event.target).value)">
                @for (vp of vpOptions; track vp) {
                  <option [value]="vp" [selected]="vp === r.settings.victoryPoints">{{ vp }}</option>
                }
              </select>
            } @else {
              <strong>{{ r.settings.victoryPoints }}</strong>
            }
          </label>

          <h3 class="mt">Karte</h3>
          <div class="maps" role="radiogroup" aria-label="Karte">
            @for (m of maps; track m.id) {
              @let fits = fitsNow(m);
              <button
                type="button"
                class="map"
                role="radio"
                [attr.aria-checked]="m.id === map().id"
                [class.selected]="m.id === map().id"
                [class.unfit]="!fits"
                [disabled]="!room.isHost() && m.id !== map().id"
                [title]="m.description"
                (click)="room.isHost() && setMap(m)"
              >
                <app-map-thumb [map]="m" [players]="present()" />
                <b>{{ m.name }}</b>
                <small>{{ m.players[0] }}–{{ m.players[1] }} Spieler</small>
              </button>
            }
          </div>
          <p class="muted small">
            <b>{{ map().name }}</b> · {{ tiles() }} Felder · {{ map().description }}
            @if (present() > 4) {
              Mit 5–6 Spielern gibt es nach jedem Zug eine Sonderbauphase.
            }
          </p>

          <div class="start">
            @if (room.isHost()) {
              <button class="primary big" [disabled]="!canStart()" (click)="room.startGame()">Spiel starten</button>
              @if (present() < 2) {
                <p class="muted small">Mindestens 2 Spieler nötig. Schick den Link herum!</p>
              } @else if (!fitsNow(map())) {
                <p class="muted small">{{ map().name }} ist für {{ map().players[0] }}–{{ map().players[1] }} Spieler, gerade sind {{ present() }} da.</p>
              }
            } @else {
              <p class="muted">Warte darauf, dass der Gastgeber das Spiel startet …</p>
            }
          </div>
        </section>

        <section class="panel chat">
          <h3>Chat</h3>
          <app-chat-box />
        </section>
      </div>
    </main>
  `,
  styles: `
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 24px 16px 48px;
      display: grid;
      gap: 16px;
    }
    header h1 {
      margin: 0;
    }
    .spacer {
      flex: 1;
    }
    .invite {
      display: flex;
      gap: 24px;
      align-items: end;
      flex-wrap: wrap;
    }
    .code {
      font-variant-numeric: tabular-nums;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: 0.15em;
    }
    .link {
      flex: 1;
      min-width: 240px;
    }
    .nowrap {
      flex-wrap: nowrap;
      input {
        flex: 1;
        min-width: 0;
      }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      align-items: start;
    }
    .players {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
      li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .offline .name {
        opacity: 0.5;
      }
    }
    .tag {
      font-size: 0.75em;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 8px;
    }
    .small {
      font-size: 0.85em;
    }
    .mt {
      margin-top: 18px;
    }
    .swatch {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 2px solid rgb(0 0 0 / 0.3);
      padding: 0;
      &.selected {
        outline: 3px solid var(--text);
        outline-offset: 2px;
      }
    }
    .start {
      margin-top: 16px;
    }
    .maps {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .map {
      display: grid;
      justify-items: center;
      gap: 2px;
      padding: 8px 6px;
      border-radius: 10px;
      text-align: center;
      line-height: 1.2;

      app-map-thumb {
        width: 58px;
        height: 58px;
        margin-bottom: 4px;
      }
      b {
        font-size: 13px;
      }
      small {
        color: var(--muted);
        font-size: 11px;
      }
      &.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px var(--accent);
      }
      &.unfit {
        opacity: 0.45;
      }
      &:disabled {
        cursor: default;
      }
    }
    .big {
      width: 100%;
      padding: 0.7em;
      font-size: 1.05rem;
    }
  `,
})
export class Lobby {
  protected readonly room = inject(RoomService);
  readonly leave = output<void>();
  protected readonly colors = PLAYER_COLORS;
  protected readonly maxPlayers = MAX_PLAYERS;
  protected readonly vpOptions = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  protected readonly copied = signal(false);
  protected readonly inviteLink = `${location.origin}${location.pathname}${LOCAL_MODE ? '?local' : ''}#/${this.room.code()}`;

  protected readonly takenColors = computed(() => new Set(this.room.room()?.players.map((p) => p.color)));
  protected readonly spectatorNames = computed(() => this.room.room()?.spectators.map((p) => p.name).join(', '));
  protected readonly maps = MAPS;
  protected readonly map = computed(() => mapById(this.room.room()?.settings.map));
  /** Verbundene Spieler; mit ihnen wird gestartet. */
  protected readonly present = computed(() => this.room.room()?.players.filter((p) => p.peerId).length ?? 0);
  protected readonly tiles = computed(() => mapShape(this.map(), Math.max(2, this.present()), { rng: 7 }).length);
  /** Gestartet wird mit allen, die verbunden sind; wer die Lobby verlassen hat, bleibt draußen. */
  protected readonly canStart = computed(() => {
    const n = this.present();
    return n >= 2 && n <= MAX_PLAYERS && this.fitsNow(this.map());
  });

  protected fitsNow(map: MapDef): boolean {
    return mapFits(map, Math.max(2, this.present()));
  }

  /** Karte wählen; das Siegziel folgt dem Vorschlag der Karte. */
  protected setMap(map: MapDef): void {
    const settings = this.room.room()!.settings;
    this.room.updateSettings({ ...settings, map: map.id, victoryPoints: map.victoryPoints });
  }

  protected setVp(value: string): void {
    const settings = this.room.room()!.settings;
    this.room.updateSettings({ ...settings, victoryPoints: Number(value) });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteLink);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.room.showNotice('Kopieren nicht möglich, bitte den Link markieren.');
    }
  }
}
