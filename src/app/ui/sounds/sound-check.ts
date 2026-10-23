import { Component, DestroyRef, inject, signal } from '@angular/core';
import { audioSettings } from '../shared/audio-settings';
import { BackgroundMusic } from '../shared/music';
import { SOUNDS } from '../shared/sounds';
import { Announcer, Speaker, VOICE, VoiceClip } from '../shared/voice';

const SPEAKERS: { id: Speaker; name: string; role: string }[] = [
  { id: 'friend', name: 'Berater', role: 'kommentiert, was dir gelingt' },
  { id: 'enemy', name: 'Erzfeind', role: 'kommentiert, was deine Gegner tun' },
  { id: 'herald', name: 'Herold', role: 'ruft aus, was alle angeht' },
];

/** Jeder Satz einmal, mit allen Anlässen, zu denen er kommt. */
function voiceLines(speaker: Speaker): { clip: VoiceClip; when: string }[] {
  const lines = new Map<string, { clip: VoiceClip; when: string[] }>();
  for (const { when, clips } of Object.values(VOICE)) {
    for (const clip of clips.filter((c) => c.speaker === speaker)) {
      const line = lines.get(clip.id) ?? { clip, when: [] };
      line.when.push(when);
      lines.set(clip.id, line);
    }
  }
  return [...lines.values()].map((l) => ({ clip: l.clip, when: l.when.join(' · ') }));
}

/** Klangprobe: jeden Ton des Spiels einzeln anhören, bevor er ins Spiel kommt. */
@Component({
  selector: 'app-sound-check',
  template: `
    <main>
      <header>
        <h1>Klangprobe</h1>
        <p class="muted">Alle Töne des Spiels zum Anhören, mit den Lautstärken aus den Einstellungen. Ohne Anlass ist ein Ton noch nicht im Spiel.</p>
      </header>

      <section class="panel">
        <ul>
          @for (s of sounds; track s.id) {
            <li>
              <button (click)="s.play(effectsVolume())" [attr.aria-label]="s.name + ' abspielen'">▶</button>
              <span>
                <b>{{ s.name }}</b>
                <span class="muted">{{ s.when || 'noch nicht im Spiel' }}</span>
              </span>
            </li>
          }
        </ul>
      </section>

      @for (s of speakers; track s.id) {
        <section class="panel">
          <h2>{{ s.name }} <span class="muted">{{ s.role }}</span></h2>
          <ul>
            @for (l of s.lines; track l.clip.id) {
              <li>
                <button (click)="voice.play(l.clip)" [attr.aria-label]="'„' + l.clip.text + '“ abspielen'">▶</button>
                <span>
                  <b>{{ l.clip.text }}</b>
                  <span class="muted">{{ l.when }}</span>
                </span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="panel">
        <ul>
          <li>
            <button (click)="toggleMusic()" [attr.aria-label]="music() ? 'Musik anhalten' : 'Musik abspielen'">{{ music() ? '■' : '▶' }}</button>
            <span>
              <b>Musik</b>
              <span class="muted">Hintergrundmusik, im Spiel über „Musik an“</span>
            </span>
          </li>
          <li>
            <button (click)="voiceOverMusic()" [disabled]="!music()" aria-label="Sprecher über der Musik abspielen">▶</button>
            <span>
              <b>Sprecher über der Musik</b>
              <span class="muted">Die Musik wird leiser, solange jemand spricht (erst Musik starten)</span>
            </span>
          </li>
        </ul>
      </section>

      <a href="#/">Zurück</a>
    </main>
  `,
  styles: `
    main {
      max-width: 560px;
      margin: 0 auto;
      padding: 48px 16px;
      display: grid;
      gap: 16px;
    }
    h1 {
      font-size: 2rem;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 1.1rem;

      .muted {
        font-size: 0.85rem;
        font-weight: 400;
        margin-left: 6px;
      }
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 12px;

      > span {
        display: grid;
      }
    }
    button {
      width: 40px;
      height: 40px;
      padding: 0;
      flex: none;
    }
  `,
})
export class SoundCheck {
  protected readonly sounds = SOUNDS;
  protected readonly speakers = SPEAKERS.map((s) => ({ ...s, lines: voiceLines(s.id) }));
  protected readonly music = signal(false);
  protected readonly effectsVolume = () => audioSettings().effects.volume;
  private readonly player = new BackgroundMusic();
  protected readonly voice = new Announcer((seconds) => this.player.duck(seconds));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.player.stop();
      this.voice.stop();
    });
  }

  protected toggleMusic(): void {
    this.music.update((m) => !m);
    this.player.setLevel(audioSettings().music.volume);
    if (this.music()) this.player.start();
    else this.player.stop();
  }

  protected voiceOverMusic(): void {
    const clips = VOICE.myTurn.clips;
    this.voice.play(clips[Math.floor(Math.random() * clips.length)]);
  }
}
