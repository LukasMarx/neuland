import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { accessPassword } from './net/access';
import { RoomService } from './net/room.service';
import { Gate } from './ui/gate/gate';
import { audioSettings } from './ui/shared/audio-settings';
import { backgroundMusic } from './ui/shared/music';

@Component({
  selector: 'app-root',
  imports: [Gate, RouterOutlet],
  template: `
    @if (unlocked()) {
      <router-outlet />
    } @else {
      <app-gate />
    }
    @if (toast(); as text) {
      <div class="toast" role="status">{{ text }}</div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: var(--text);
      color: var(--bg);
      font-weight: 600;
      padding: 10px 18px;
      border-radius: 999px;
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
      z-index: 100;
      max-width: calc(100vw - 32px);
    }
  `,
})
export class App {
  private readonly roomService = inject(RoomService);
  protected readonly toast = signal<string | null>(null);
  /** Die Erklärbühne zeigt nur feste Spielstände ohne Verbindung, dafür braucht es kein Passwort. */
  protected readonly unlocked = computed(() => accessPassword() !== null || location.hash.startsWith('#/erklaer'));

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: '/' },
  );

  constructor() {
    // Musik von der Startseite über die Lobby bis ins Spiel, ohne Bruch. Die Klangprobe hat ihre eigene
    // Musikprobe, dort schweigt sie; ebenso vor dem Passwort.
    effect(() => {
      const music = audioSettings().music;
      backgroundMusic.setLevel(music.volume);
      if (music.on && this.unlocked() && !this.url().startsWith('/klaenge')) backgroundMusic.start();
      else backgroundMusic.stop();
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const notice = this.roomService.notice();
      if (!notice) return;
      this.toast.set(notice.text);
      clearTimeout(timer);
      timer = setTimeout(() => this.toast.set(null), 3500);
    });
  }
}
