import { Component, inject, input } from '@angular/core';
import { GameState, hasResources, RESOURCES, ResourceCounts } from '../../engine';
import { RoomService } from '../../net/room.service';
import { RESOURCE_ICONS } from '../shared/labels';

/** Offene Handelsangebote als Karten über dem Brett. */
@Component({
  selector: 'app-offer-list',
  template: `
    @let g = game();
    @for (o of g.offers; track o.id) {
      <div class="offer" [style.--c]="g.players[o.from].color">
        <div class="head">
          <span class="color-dot" [style.background]="g.players[o.from].color"></span>
          <strong>{{ o.from === seat() ? 'Dein Angebot' : g.players[o.from].name }}</strong>
          @if (o.counter) {
            <span class="muted">→ {{ o.from === seat() ? g.players[g.current].name : g.current === seat() ? 'dich' : g.players[g.current].name }}</span>
          }
        </div>
        <div class="terms">
          <span class="side">
            <small class="muted">gibt</small>
            <span class="res">{{ short(o.give) }}</span>
          </span>
          <span class="arrow">⇄</span>
          <span class="side">
            <small class="muted">will</small>
            <span class="res">{{ short(o.want) }}</span>
          </span>
        </div>
        <div class="row actions">
          @if (!o.counter && o.from === seat()) {
            @for (p of o.accepted; track p) {
              <button class="small primary" (click)="confirm(o.id, p)">Handeln mit {{ g.players[p].name }}</button>
            }
            @if (!o.accepted.length) {
              <span class="muted small">
                Wartet auf Antworten{{ o.declined.length ? ' · ' + o.declined.length + '× abgelehnt' : '' }}
              </span>
            }
            <button class="small" (click)="cancel(o.id)">Zurückziehen</button>
          } @else if (!o.counter && seat() >= 0) {
            @if (o.accepted.includes(seat())) {
              <span class="small ok">Angenommen ✓</span>
            } @else {
              <button class="small primary" [disabled]="!canAfford(o.want)" (click)="respond(o.id, true)">Annehmen</button>
              <button class="small" [disabled]="o.declined.includes(seat())" (click)="respond(o.id, false)">
                {{ o.declined.includes(seat()) ? 'Abgelehnt' : 'Ablehnen' }}
              </button>
            }
          } @else if (o.counter && seat() === g.current) {
            <button class="small primary" [disabled]="!canAfford(o.want)" (click)="confirm(o.id, o.from)">Annehmen</button>
            <button class="small" (click)="cancel(o.id)">Ablehnen</button>
          } @else if (o.counter && o.from === seat()) {
            <button class="small" (click)="cancel(o.id)">Zurückziehen</button>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
      width: 290px;
    }
    .offer {
      background: var(--panel);
      border: 1px solid var(--line);
      border-top: 4px solid var(--c);
      border-radius: 12px;
      box-shadow: 0 6px 20px rgb(40 25 5 / 0.18);
      padding: 10px 12px;
      display: grid;
      gap: 8px;
      animation: slide-in 0.25s ease-out;
    }
    .head {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .terms {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .side {
      display: flex;
      flex-direction: column;
    }
    .res {
      font-size: 20px;
      white-space: nowrap;
    }
    .arrow {
      color: var(--muted);
      font-size: 18px;
    }
    .small {
      font-size: 0.85em;
    }
    .ok {
      color: var(--ok);
      font-weight: 700;
    }
    @keyframes slide-in {
      from {
        transform: translateX(20px);
        opacity: 0;
      }
    }
  `,
})
export class OfferList {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();

  protected respond(offerId: number, accept: boolean): void {
    this.room.act({ type: 'respondTrade', offerId, accept });
  }

  protected confirm(offerId: number, partner: number): void {
    this.room.act({ type: 'confirmTrade', offerId, partner });
  }

  protected cancel(offerId: number): void {
    this.room.act({ type: 'cancelTrade', offerId });
  }

  protected canAfford(need: ResourceCounts): boolean {
    const me = this.game().players[this.seat()];
    return !!me && hasResources(me.resources, need);
  }

  protected short(r: ResourceCounts): string {
    return RESOURCES.filter((k) => r[k] > 0)
      .map((k) => `${r[k]}${RESOURCE_ICONS[k]}`)
      .join(' ');
  }
}
