import { Component, computed, inject, output, signal } from '@angular/core';
import { MAX_PLAYERS, PLAYER_COLORS } from '../../net/protocol';
import { LOCAL_MODE, RoomService } from '../../net/room.service';
import { ChatBox } from '../shared/chat-box';

@Component({
  selector: 'app-lobby',
  imports: [ChatBox],
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
          <p class="muted small">
            @if (r.players.length > 4) {
              5–6 Spieler: großes Brett mit 30 Feldern und Sonderbauphase nach jedem Zug.
            } @else {
              Bis 4 Spieler: klassisches Brett mit 19 Feldern. Ab 5 Spielern wird automatisch das große Brett genutzt.
            }
          </p>

          <div class="start">
            @if (room.isHost()) {
              <button class="primary big" [disabled]="!canStart()" (click)="room.startGame()">Spiel starten</button>
              @if (r.players.length < 2) {
                <p class="muted small">Mindestens 2 Spieler nötig. Schick den Link herum!</p>
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
      font-family: ui-monospace, monospace;
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
  protected readonly canStart = computed(() => {
    const n = this.room.room()?.players.length ?? 0;
    return n >= 2 && n <= MAX_PLAYERS;
  });

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
