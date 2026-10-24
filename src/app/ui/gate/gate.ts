import { Component, signal } from '@angular/core';
import { unlock } from '../../net/access';

/** Sperrseite vor der App. Das Passwort wird pro Browser gemerkt. */
@Component({
  selector: 'app-gate',
  template: `
    <main>
      <form class="panel" (submit)="submit($event)">
        <div class="logo" aria-hidden="true">⬢</div>
        <h1>Neuland</h1>
        <p class="muted">Privates Spiel. Bitte gib das Passwort ein.</p>
        <input
          type="password"
          aria-label="Passwort"
          placeholder="Passwort"
          autocomplete="current-password"
          autofocus
          [class.wrong]="wrong()"
          [value]="value()"
          (input)="value.set($any($event.target).value); wrong.set(false)"
        />
        @if (wrong()) {
          <p class="error">Das Passwort stimmt nicht.</p>
        }
        <button class="primary" type="submit" [disabled]="!value().trim() || checking()">Weiter</button>
      </form>
    </main>
  `,
  styles: `
    main {
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    form {
      width: min(360px, 100%);
      display: grid;
      gap: 12px;
      text-align: center;
      padding: 28px 24px;
    }
    .logo {
      font-size: 52px;
      color: #e6c24a;
      line-height: 1;
      text-shadow: 0 2px 0 #7b4a2a;
    }
    h1,
    p {
      margin: 0;
    }
    input.wrong {
      border-color: var(--danger);
      animation: shake 0.3s;
    }
    .error {
      color: var(--danger);
      font-size: 0.9em;
    }
    button {
      padding: 0.65em;
    }
    @keyframes shake {
      25% {
        transform: translateX(-6px);
      }
      75% {
        transform: translateX(6px);
      }
    }
  `,
})
export class Gate {
  protected readonly value = signal('');
  protected readonly wrong = signal(false);
  protected readonly checking = signal(false);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.checking.set(true);
    const ok = await unlock(this.value());
    this.checking.set(false);
    this.wrong.set(!ok);
  }
}
