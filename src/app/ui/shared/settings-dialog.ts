import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { AudioChannel, audioSettings, setChannel } from './audio-settings';
import { rattle } from './sounds';
import { Announcer, VOICE } from './voice';

const CHANNELS: { id: AudioChannel; name: string; hint: string }[] = [
  { id: 'music', name: 'Musik', hint: 'Mittelalterliche Hintergrundmusik' },
  { id: 'effects', name: 'Effekte', hint: 'Fanfare, wenn du dran bist, und Würfel' },
  { id: 'voice', name: 'Sprecher', hint: 'Berater und Erzfeind kommentieren das Spiel' },
];

/** Einstellungen mit Reitern; vorerst nur „Audio“. Alles wird sofort übernommen und gespeichert. */
@Component({
  selector: 'app-settings-dialog',
  host: { '(document:keydown.escape)': 'close.emit()' },
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal settings" role="dialog" aria-labelledby="settings-title" (click)="$event.stopPropagation()">
        <h2 id="settings-title">Einstellungen</h2>
        <div class="tabs" role="tablist">
          <button role="tab" class="on" aria-selected="true">Audio</button>
        </div>

        <div role="tabpanel" aria-label="Audio">
          @for (c of channels; track c.id) {
            @let s = settings()[c.id];
            <div class="channel" [class.off]="!s.on">
              <label class="switch">
                <input type="checkbox" [checked]="s.on" [attr.aria-label]="c.name" (change)="set(c.id, { on: $any($event.target).checked })" />
                <span class="name">{{ c.name }}</span>
              </label>
              <span class="hint muted">{{ c.hint }}</span>
              <div class="level">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  [value]="s.volume * 100"
                  [attr.aria-label]="'Lautstärke ' + c.name"
                  (input)="set(c.id, { volume: +$any($event.target).value / 100 })"
                />
                <span class="value">{{ round(s.volume * 100) }} %</span>
                @if (c.id !== 'music') {
                  <button class="small" (click)="probe(c.id)" [attr.aria-label]="c.name + ' probehören'">Probe</button>
                }
              </div>
            </div>
          }
        </div>

        <div class="row end">
          <a class="muted" href="#/klaenge" target="_blank" rel="noopener">Alle Töne in der Klangprobe</a>
          <button class="primary" (click)="close.emit()">Fertig</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .settings {
      width: min(480px, 100%);
    }
    h2 {
      margin: 0 0 12px;
    }
    .tabs {
      display: flex;
      gap: 18px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--line);

      button {
        padding: 6px 0 9px;
        border: none;
        border-radius: 0;
        background: none;
        color: var(--text);
        font-weight: 600;
        box-shadow: inset 0 -2px 0 var(--accent);
      }
    }
    .channel {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 4px 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);

      &.off .level {
        opacity: 0.45;
      }
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;

      input {
        width: 18px;
        height: 18px;
        accent-color: var(--accent);
      }
      .name {
        font-weight: 700;
      }
    }
    .hint {
      font-size: 13px;
    }
    .level {
      grid-column: 1 / -1;
      display: grid;
      // Feste Spalten: Alle Regler gleich lang, auch ohne Probe-Knopf (Musik).
      grid-template-columns: minmax(0, 1fr) 44px 64px;
      align-items: center;
      gap: 10px;

      input {
        accent-color: var(--accent);
      }
      .value {
        width: 44px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: var(--muted);
        font-size: 13px;
      }
    }
    .row.end {
      margin-top: 16px;
      align-items: center;

      a {
        margin-right: auto;
        font-size: 13px;
      }
    }
  `,
})
export class SettingsDialog {
  readonly close = output<void>();

  protected readonly channels = CHANNELS;
  protected readonly settings = audioSettings;
  protected readonly round = Math.round;
  private readonly voice = new Announcer();
  private readonly probeTurn = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.voice.stop());
  }

  protected set(channel: AudioChannel, change: { on?: boolean; volume?: number }): void {
    setChannel(channel, change);
  }

  /** Kurz anhören, mit der eingestellten Lautstärke, auch wenn der Kanal aus ist. */
  protected probe(channel: AudioChannel): void {
    const volume = audioSettings()[channel].volume;
    if (channel === 'effects') rattle(volume);
    if (channel === 'voice') {
      const clips = VOICE.myTurn.clips;
      this.probeTurn.update((n) => n + 1);
      this.voice.play(clips[this.probeTurn() % clips.length]);
    }
  }
}
