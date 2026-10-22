import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { recentRooms, RoomService } from '../../net/room.service';

@Component({
  selector: 'app-home',
  template: `
    <main>
      <header>
        <div class="logo" aria-hidden="true">⬢</div>
        <h1>Neuland</h1>
        <p class="muted">Siedeln, handeln, bauen – direkt im Browser, für 2 bis 8 Spieler. Kein Login, kein Server.</p>
      </header>

      <section class="panel">
        <label for="name">Dein Name</label>
        <input
          id="name"
          maxlength="20"
          placeholder="z. B. Anna"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
          (keydown.enter)="create()"
        />

        <div class="actions">
          <button class="primary big" [disabled]="!name().trim()" (click)="create()">Neues Spiel eröffnen</button>
        </div>

        <div class="divider"><span>oder beitreten</span></div>

        <div class="row join">
          <input
            aria-label="Raumcode"
            placeholder="Raumcode"
            maxlength="6"
            class="code"
            [value]="code()"
            (input)="code.set($any($event.target).value.toUpperCase())"
            (keydown.enter)="join()"
          />
          <button [disabled]="!name().trim() || code().trim().length !== 6" (click)="join()">Beitreten</button>
        </div>
      </section>

      @if (recent.length) {
        <section class="panel recent">
          <h3>Zuletzt gespielt</h3>
          @for (r of recent; track r.code) {
            <button class="recent-item" [disabled]="!name().trim()" (click)="open(r.code)">
              <strong>{{ r.code }}</strong>
              <span class="muted">{{ r.names.join(', ') }}</span>
              <span class="tag">{{ r.started ? 'läuft' : 'Lobby' }}</span>
            </button>
          }
        </section>
      }
    </main>
  `,
  styles: `
    main {
      max-width: 460px;
      margin: 0 auto;
      padding: 48px 16px;
      display: grid;
      gap: 16px;
    }
    header {
      text-align: center;
    }
    .logo {
      font-size: 56px;
      color: #e6c24a;
      line-height: 1;
      text-shadow: 0 2px 0 #7b4a2a;
    }
    h1 {
      font-size: 2.4rem;
      letter-spacing: 0.02em;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
    }
    #name {
      width: 100%;
    }
    .actions {
      margin-top: 12px;
    }
    .big {
      width: 100%;
      padding: 0.7em;
      font-size: 1.05rem;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      margin: 18px 0 12px;
      font-size: 0.9em;
      &::before,
      &::after {
        content: '';
        flex: 1;
        border-top: 1px solid var(--line);
      }
    }
    .join {
      flex-wrap: nowrap;
    }
    .code {
      flex: 1;
      min-width: 0;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .recent {
      display: grid;
      gap: 6px;
    }
    .recent-item {
      display: flex;
      gap: 10px;
      align-items: center;
      text-align: left;
      span:not(.tag) {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .tag {
      font-size: 0.8em;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 8px;
    }
  `,
})
export class Home {
  private readonly room = inject(RoomService);
  private readonly router = inject(Router);
  protected readonly name = signal(this.room.name());
  protected readonly code = signal('');
  protected readonly recent = recentRooms();

  protected create(): void {
    if (!this.name().trim()) return;
    const code = this.room.create(this.name());
    void this.router.navigate(['/', code]);
  }

  protected join(): void {
    const code = this.code().trim().toUpperCase();
    if (!this.name().trim() || code.length !== 6) return;
    this.open(code);
  }

  protected open(code: string): void {
    this.room.setName(this.name());
    void this.router.navigate(['/', code]);
  }
}
