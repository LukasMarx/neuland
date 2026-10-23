import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { MapDef, mapById, mapFits, MAPS, mapShape, VariantDef, VARIANTS } from '../../engine';
import { MAX_PLAYERS, PLAYER_COLORS } from '../../net/protocol';
import { LOCAL_MODE, RoomService } from '../../net/room.service';
import { ChatBox } from '../shared/chat-box';
import { gameStartImages, preloadImages } from '../shared/image-cache';
import { MapThumb } from './map-thumb';
import { allChapters, chapterForVariant, ChapterId } from '../rulebook/rule-content';
import { Rulebook } from '../rulebook/rulebook';
import { SettingsDialog } from '../shared/settings-dialog';

@Component({
  selector: 'app-lobby',
  imports: [ChatBox, MapThumb, Rulebook, SettingsDialog],
  template: `
    @let r = room.room()!;
    <main>
      <header class="top">
        <h1>Lobby</h1>
        <div class="invite">
          <span class="muted">Raumcode</span>
          <b class="code">{{ r.code }}</b>
          <button (click)="copy()" [title]="inviteLink">{{ copied() ? 'Link kopiert ✓' : 'Link kopieren' }}</button>
        </div>
        <button (click)="openRules(null)" title="Regelbuch öffnen">Regeln</button>
        <button (click)="settingsOpen.set(true)" title="Musik, Effekte und Sprecher einstellen">Einstellungen</button>
        <button (click)="leave.emit()">Verlassen</button>
      </header>
      @if (settingsOpen()) {
        <app-settings-dialog (close)="settingsOpen.set(false)" />
      }
      @if (rulesOpen()) {
        <app-rulebook [chapters]="ruleChapters" [startChapter]="rulesStart()" (close)="rulesOpen.set(false)" />
      }

      <div class="layout">
        <aside class="side">
          <section class="panel">
            <h3>Spieler <span class="muted">{{ r.players.length }}/{{ maxPlayers }}</span></h3>
            <ul class="players">
              @for (p of r.players; track p.id) {
                <li [class.offline]="!p.peerId && !p.bot">
                  <span class="color-dot" [style.background]="p.color"></span>
                  <span class="name">{{ p.name }}</span>
                  @if (p.id === room.clientId) {
                    <span class="tag">Du</span>
                  }
                  @if (p.id === r.hostId) {
                    <span class="tag">Gastgeber</span>
                  }
                  @if (p.bot) {
                    <span class="tag">🤖 Bot</span>
                    @if (room.isHost()) {
                      <button class="small" (click)="room.removePlayer(p.id)">Entfernen</button>
                    }
                  } @else if (!p.peerId) {
                    <span class="muted small">getrennt</span>
                    @if (room.isHost()) {
                      <button class="small" (click)="room.removePlayer(p.id)">Entfernen</button>
                    }
                  }
                </li>
              }
            </ul>
            @if (room.isHost() && r.players.length < maxPlayers) {
              <button class="small add-bot" (click)="room.addBot()" title="Ein Bot spielt mit, bis ein Mitspieler seinen Platz übernimmt">+ Bot hinzufügen</button>
            }
            @if (r.spectators.length) {
              <p class="muted small">Zuschauer: {{ spectatorNames() }}</p>
            }
            @if (room.me(); as me) {
              <div class="swatches" role="radiogroup" aria-label="Deine Farbe">
                @for (c of colors; track c.hex) {
                  <button
                    class="swatch"
                    role="radio"
                    [attr.aria-checked]="me.color === c.hex"
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

          <section class="panel summary">
            <dl>
              <dt>Karte</dt>
              <dd>{{ map().name }} <span class="muted">· {{ tiles() }}</span></dd>
              <dt>Dazu</dt>
              <dd>{{ activeNames() || 'Grundspiel' }}</dd>
              <dt>Siegpunkte</dt>
              <dd>
                @if (room.isHost()) {
                  <select (change)="setVp($any($event.target).value)" aria-label="Siegpunkte">
                    @for (vp of vpOptions; track vp) {
                      <option [value]="vp" [selected]="vp === r.settings.victoryPoints">{{ vp }}</option>
                    }
                  </select>
                } @else {
                  <strong>{{ r.settings.victoryPoints }}</strong>
                }
              </dd>
            </dl>
            @if (room.isHost()) {
              <button class="primary big" [disabled]="!canStart()" (click)="room.startGame()">Spiel starten</button>
              @if (startHint(); as hint) {
                <p class="muted small">{{ hint }}</p>
              }
            } @else {
              <p class="muted">Warte darauf, dass der Gastgeber das Spiel startet …</p>
            }
          </section>

          <section class="panel chat">
            <h3>Chat</h3>
            <app-chat-box />
          </section>
        </aside>

        <div class="settings">
          <section class="panel">
            <h3>Karte</h3>
            @for (group of mapGroups; track group.name) {
              <h4>
                {{ group.name }}
                @if (group.chapter) {
                  <button class="small more" title="Regeln zu Seewege im Regelbuch lesen" (click)="openRules(group.chapter)">Regeln</button>
                }
              </h4>
              <div class="maps" role="radiogroup" [attr.aria-label]="'Karte, ' + group.name">
                @for (m of group.maps; track m.id) {
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
            }
            <p class="muted small about">
              <b>{{ map().name }}:</b> {{ map().description }}
              @if (present() > 4) {
                Mit 5–6 Spielern gibt es nach jedem Zug eine Sonderbauphase.
              }
            </p>
          </section>

          @for (group of variantGroups; track group.kind) {
            <section class="panel">
              <h3>{{ group.name }} <span class="muted small">{{ group.hint }}</span></h3>
              <div class="variants">
                @for (v of group.variants; track v.id) {
                  @let blocked = blockedReason(v);
                  <div class="variant" [class.on]="variantOn(v)" [class.blocked]="!!blocked">
                    <label>
                      <input type="checkbox" [checked]="variantOn(v)" [disabled]="!room.isHost()" (change)="toggleVariant(v, $any($event.target).checked)" />
                      <span>
                        <b>
                          {{ v.name }}
                          @if (v.victoryPoints) {
                            <span class="tag">+{{ v.victoryPoints }} Punkte</span>
                          }
                        </b>
                        <small>{{ blocked ?? v.short }}</small>
                      </span>
                    </label>
                    <div class="actions">
                      <button class="small more" [attr.aria-expanded]="open().has(v.id)" (click)="toggleOpen(v.id)">{{ open().has(v.id) ? 'weniger' : 'mehr' }}</button>
                      <button class="small more" [title]="'Regeln zu ' + v.name + ' im Regelbuch lesen'" (click)="openRules(chapterFor(v.id))">Regeln</button>
                    </div>
                    @if (open().has(v.id)) {
                      <p class="full">{{ v.description }}</p>
                    }
                  </div>
                }
              </div>
            </section>
          }
        </div>
      </div>
    </main>
  `,
  styles: `
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 20px 16px 48px;
      display: grid;
      gap: 16px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      h1 {
        margin: 0;
        margin-right: auto;
      }
    }
    .invite {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .code {
      font-variant-numeric: tabular-nums;
      font-size: 1.5rem;
      letter-spacing: 0.15em;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      grid-template-areas: 'settings side';
      gap: 16px;
      align-items: start;
    }
    .settings {
      grid-area: settings;
      display: grid;
      gap: 16px;
      min-width: 0;
    }
    .side {
      grid-area: side;
      display: grid;
      gap: 16px;
      position: sticky;
      top: 16px;
    }
    h3 {
      margin: 0 0 10px;
    }
    h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);

      .more {
        padding: 1px 8px;
        font-size: 11px;
        letter-spacing: normal;
        text-transform: none;
      }
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
      font-weight: 600;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 8px;
      white-space: nowrap;
    }
    .small {
      font-size: 0.85em;
    }
.add-bot {
      margin-top: 10px;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      // Hell, damit Schwarz auf dem dunklen Grund einen Umriss hat.
      border: 2px solid rgb(255 255 255 / 0.25);
      padding: 0;
      &.selected {
        outline: 3px solid var(--text);
        outline-offset: 2px;
      }
    }
    .summary {
      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 12px;
        margin: 0 0 14px;
        align-items: center;
      }
      dt {
        color: var(--muted);
        font-size: 0.85em;
      }
      dd {
        margin: 0;
      }
    }
    .big {
      width: 100%;
      padding: 0.7em;
      font-size: 1.05rem;
    }
    .maps {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
      gap: 8px;
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
    .about {
      margin: 12px 0 0;
    }
    .variants {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
    }
    .variant {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      gap: 4px 8px;
      padding: 8px 8px 8px 10px;
      border-radius: 10px;
      border: 1px solid var(--line);

      label {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        cursor: pointer;
      }
      input {
        margin-top: 3px;
      }
      b {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
      small {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .more {
        padding: 1px 8px;
        font-size: 11px;
      }
      .full {
        grid-column: 1 / -1;
        margin: 4px 0 0;
        font-size: 12px;
        line-height: 1.45;
        color: var(--muted);
      }
      &.on {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      &.blocked small {
        color: var(--danger);
      }
    }
    // Schmal: eine Spalte, Spieler und Start zuerst, dann die Einstellungen, der Chat zuletzt.
    @media (max-width: 820px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: none;
      }
      .side {
        display: contents;
      }
      .settings {
        grid-area: auto;
        order: 1;
      }
      .chat {
        order: 2;
      }
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
  protected readonly rulesOpen = signal(false);
  protected readonly settingsOpen = signal(false);
  /** In der Lobby stehen alle Kapitel im Buch, damit man vor dem Einschalten nachlesen kann. */
  protected readonly ruleChapters = allChapters();
  protected readonly rulesStart = signal<ChapterId | null>(null);
  protected readonly chapterFor = chapterForVariant;
  protected readonly inviteLink = `${location.origin}${location.pathname}${LOCAL_MODE ? '?local' : ''}#/${this.room.code()}`;

  protected readonly takenColors = computed(() => new Set(this.room.room()?.players.map((p) => p.color)));
  protected readonly spectatorNames = computed(() => this.room.room()?.spectators.map((p) => p.name).join(', '));
  protected readonly maps = MAPS;
  protected readonly map = computed(() => mapById(this.room.room()?.settings.map));
  /** Verbundene Spieler; mit ihnen wird gestartet. */
  protected readonly present = computed(() => this.room.room()?.players.filter((p) => p.peerId || p.bot).length ?? 0);
  private readonly shape = computed(() => mapShape(this.map(), Math.max(2, this.present()), { rng: 7 }));
  protected readonly tiles = computed(() => {
    const land = this.shape().filter((c) => c.ch !== '~' && c.ch !== '?').length;
    const fog = this.shape().filter((c) => c.ch === '?').length;
    return fog ? `${land} Felder, ${fog} im Nebel` : `${land} Felder`;
  });
  /** Gestartet wird mit allen, die verbunden sind; wer die Lobby verlassen hat, bleibt draußen. */
  protected readonly canStart = computed(() => {
    const n = this.present();
    return n >= 2 && n <= MAX_PLAYERS && this.fitsNow(this.map()) && !this.variantMismatch();
  });

  /** Eine eingeschaltete Variante passt nicht zur Spielerzahl (Duell) oder zur Karte (Flussläufe). */
  protected readonly variantMismatch = computed(() => {
    const n = this.present();
    const sea = !!this.map().seafaring;
    const v = VARIANTS.find(
      (x) => this.variantOn(x) && ((x.players && x.players !== n) || (x.maxPlayers && n > x.maxPlayers) || (x.landOnly && sea)),
    );
    if (!v) return null;
    if (v.players && v.players !== n) return `${v.name} ist nur für ${v.players} Spieler, gerade sind ${n} da.`;
    if (v.maxPlayers && n > v.maxPlayers) return `${v.name} gibt es nur für bis zu ${v.maxPlayers} Spieler, gerade sind ${n} da.`;
    return `${v.name} gibt es nur auf Karten ohne Meerfelder.`;
  });

  constructor() {
    // Grafiken für den Spielstart schon hier holen (im Leerlauf, nach dem Aufbau der Lobby): Wechselt eine
    // Farbe oder die Karte, kommt nur das Neue dazu.
    effect(() => {
      const r = this.room.room();
      if (r) preloadImages(gameStartImages(r.settings, r.players.map((p) => p.color)));
    });
  }

  protected fitsNow(map: MapDef): boolean {
    return mapFits(map, Math.max(2, this.present()));
  }

  /** Karten getrennt nach Land und Meer (Seewege). */
  protected readonly mapGroups = [
    { name: 'Land', maps: MAPS.filter((m) => !m.seafaring), chapter: null },
    { name: 'Meer · Seewege', maps: MAPS.filter((m) => m.seafaring), chapter: 'seewege' as ChapterId },
  ];
  protected readonly variantGroups = [
    { kind: 'expansion', name: 'Erweiterungen', hint: 'neue Teile und Regeln', variants: VARIANTS.filter((v) => v.kind === 'expansion') },
    { kind: 'house', name: 'Hausregeln', hint: 'kleine Änderungen am Grundspiel', variants: VARIANTS.filter((v) => v.kind === 'house') },
  ];
  /** Varianten, deren volle Beschreibung aufgeklappt ist (nur für mich). */
  protected readonly open = signal(new Set<string>());
  protected readonly activeNames = computed(() =>
    VARIANTS.filter((v) => this.variantOn(v))
      .map((v) => v.name)
      .join(', '),
  );
  /** Warum gerade nicht gestartet werden kann. */
  protected readonly startHint = computed(() => {
    const map = this.map();
    if (this.present() < 2) return 'Mindestens 2 Spieler nötig. Schick den Link herum!';
    if (!this.fitsNow(map)) return `${map.name} ist für ${map.players[0]}–${map.players[1]} Spieler, gerade sind ${this.present()} da.`;
    return this.variantMismatch();
  });

  /** Passt eine Variante gerade nicht (Spielerzahl, Karte)? Dann steht der Grund statt der Kurzbeschreibung da. */
  protected blockedReason(v: VariantDef): string | null {
    // Mit nur einem Spieler im Raum ist die Spielerzahl noch offen.
    if (v.players && this.present() >= 2 && v.players !== this.present()) return `Nur für ${v.players} Spieler.`;
    if (v.maxPlayers && this.present() > v.maxPlayers) return `Nur bis ${v.maxPlayers} Spieler.`;
    if (v.landOnly && this.map().seafaring) return 'Nur auf Karten ohne Meer.';
    return null;
  }

  protected toggleOpen(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Karte wählen; das Siegziel folgt dem Vorschlag der Karte (plus Varianten wie dem Hafenvogt). */
  protected setMap(map: MapDef): void {
    const settings = this.room.room()!.settings;
    const bonus = VARIANTS.filter((v) => settings.variants?.includes(v.id)).reduce((n, v) => n + (v.victoryPoints ?? 0), 0);
    this.room.updateSettings({ ...settings, map: map.id, victoryPoints: map.victoryPoints + bonus });
  }

  protected openRules(chapter: ChapterId | null): void {
    this.rulesStart.set(chapter);
    this.rulesOpen.set(true);
  }

  protected variantOn(v: VariantDef): boolean {
    return this.room.room()?.settings.variants?.includes(v.id) ?? false;
  }

  /** Variante an- oder ausschalten; erhöht sie das Siegziel, geht es mit. */
  protected toggleVariant(v: VariantDef, on: boolean): void {
    const settings = this.room.room()!.settings;
    const variants = (settings.variants ?? []).filter((id) => id !== v.id).concat(on ? [v.id] : []);
    const victoryPoints = settings.victoryPoints + (on ? 1 : -1) * (v.victoryPoints ?? 0);
    this.room.updateSettings({ ...settings, variants, victoryPoints });
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
