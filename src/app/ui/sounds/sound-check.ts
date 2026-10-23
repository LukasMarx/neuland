import { Component, DestroyRef, inject, signal } from '@angular/core';
import { BackgroundMusic } from '../shared/music';
import { fanfare, FANFARE_SECONDS, SOUNDS } from '../shared/sounds';

/** Klangprobe: jeden Ton des Spiels einzeln anhören, bevor er ins Spiel kommt. */
@Component({
  selector: 'app-sound-check',
  template: `
    <main>
      <header>
        <h1>Klangprobe</h1>
        <p class="muted">Alle Töne des Spiels zum Anhören. Ohne Anlass ist ein Ton noch nicht im Spiel.</p>
      </header>

      <section class="panel">
        <ul>
          @for (s of sounds; track s.id) {
            <li>
              <button (click)="s.play()" [attr.aria-label]="s.name + ' abspielen'">▶</button>
              <span>
                <b>{{ s.name }}</b>
                <span class="muted">{{ s.when || 'noch nicht im Spiel' }}</span>
              </span>
            </li>
          }
        </ul>
      </section>

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
            <button (click)="fanfareOverMusic()" [disabled]="!music()" aria-label="Fanfare über der Musik abspielen">▶</button>
            <span>
              <b>Fanfare über der Musik</b>
              <span class="muted">Die Musik wird für die Fanfare leiser (erst Musik starten)</span>
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
  protected readonly music = signal(false);
  private readonly player = new BackgroundMusic();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.player.stop());
  }

  protected toggleMusic(): void {
    this.music.update((m) => !m);
    if (this.music()) this.player.start();
    else this.player.stop();
  }

  protected fanfareOverMusic(): void {
    fanfare('kurz');
    this.player.duck(FANFARE_SECONDS.kurz);
  }
}
