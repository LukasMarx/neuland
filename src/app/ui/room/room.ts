import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { loadSaved, RoomService } from '../../net/room.service';
import { GameView } from '../game/game';
import { Lobby } from '../lobby/lobby';

@Component({
  selector: 'app-room',
  imports: [Lobby, GameView],
  template: `
    @if (!joined()) {
      <main class="center">
        <section class="panel card">
          <h2>Spiel {{ code }} beitreten</h2>
          <label for="name">Dein Name</label>
          <div class="row">
            <input
              id="name"
              maxlength="20"
              placeholder="z. B. Anna"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
              (keydown.enter)="join()"
            />
            <button class="primary" [disabled]="!name().trim()" (click)="join()">Beitreten</button>
          </div>
        </section>
      </main>
    } @else if (room.status() === 'searching') {
      <main class="center">
        <section class="panel card">
          <div class="spinner" aria-hidden="true"></div>
          <h2>Verbinde mit {{ code }} …</h2>
          <p class="muted">Suche nach den anderen Spielern. Das dauert meist ein paar Sekunden.</p>
          @if (room.searchSlow()) {
            <p>Noch niemand gefunden.</p>
            <div class="row">
              <button class="primary" (click)="room.openAsHost()">
                {{ hasSave ? 'Gespeichertes Spiel fortsetzen' : 'Raum selbst eröffnen' }}
              </button>
              <button (click)="leave()">Zurück</button>
            </div>
          }
        </section>
      </main>
    } @else if (room.game()) {
      <app-game (leave)="leave()" />
    } @else if (room.room()) {
      <app-lobby (leave)="leave()" />
    }
  `,
  styles: `
    .center {
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .card {
      width: min(440px, 100%);
      text-align: center;
    }
    label {
      display: block;
      text-align: left;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .row {
      flex-wrap: nowrap;
      justify-content: center;
    }
    input {
      flex: 1;
      min-width: 0;
    }
    .spinner {
      width: 36px;
      height: 36px;
      margin: 4px auto 14px;
      border: 4px solid var(--line);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class RoomPage implements OnInit {
  protected readonly room = inject(RoomService);
  private readonly router = inject(Router);
  protected readonly code = (inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '').toUpperCase();
  protected readonly name = signal(this.room.name());
  protected readonly hasSave = !!loadSaved(this.code);
  private readonly started = signal(false);
  protected readonly joined = computed(() => this.started() || this.room.code() === this.code);

  ngOnInit(): void {
    if (this.room.code() === this.code && this.room.status() !== 'idle') return;
    if (this.room.name()) this.join();
  }

  protected join(): void {
    if (!this.name().trim()) return;
    this.started.set(true);
    this.room.join(this.code, this.name());
  }

  protected leave(): void {
    this.room.leave();
    void this.router.navigate(['/']);
  }
}
