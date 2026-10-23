import { afterRenderEffect, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RoomService } from '../../net/room.service';
import { uiColor } from './player-color';

@Component({
  selector: 'app-chat-box',
  template: `
    <div class="messages" #list>
      @for (m of room.chat(); track $index) {
        <div class="msg">
          <strong [style.color]="colorOf(m.id)">{{ m.name }}:</strong> {{ m.text }}
        </div>
      } @empty {
        <div class="muted empty">Noch keine Nachrichten.</div>
      }
    </div>
    <form class="row" (submit)="send($event)">
      <input
        aria-label="Chatnachricht"
        placeholder="Nachricht …"
        maxlength="300"
        [value]="draft()"
        (input)="draft.set($any($event.target).value)"
      />
      <button type="submit" [disabled]="!draft().trim()">Senden</button>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    .messages {
      flex: 1;
      min-height: 80px;
      /* Im Spiel füllt der Chat die Seitenleiste, in der Lobby bleibt er kompakt. */
      max-height: var(--chat-max-height, 220px);
      overflow-y: auto;
      font-size: 0.92em;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .msg {
      overflow-wrap: anywhere;
    }
    .empty {
      font-size: 0.9em;
    }
    form {
      flex-wrap: nowrap;
    }
    input {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class ChatBox {
  protected readonly room = inject(RoomService);
  protected readonly draft = signal('');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');

  constructor() {
    afterRenderEffect(() => {
      this.room.chat();
      const el = this.list().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  protected colorOf(id: string): string {
    const color = this.room.room()?.players.find((p) => p.id === id)?.color;
    // Weiß sähe aus wie eine Hervorhebung, Schwarz verschwindet auf dem dunklen Grund.
    return !color || color === '#f4f1e8' ? 'var(--text)' : uiColor(color);
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.room.sendChat(this.draft());
    this.draft.set('');
  }
}
