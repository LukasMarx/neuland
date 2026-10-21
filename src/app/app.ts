import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { accessPassword } from './net/access';
import { RoomService } from './net/room.service';
import { Gate } from './ui/gate/gate';

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
      background: #2b2418;
      color: #fff;
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
  protected readonly unlocked = computed(() => accessPassword() !== null);

  constructor() {
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
