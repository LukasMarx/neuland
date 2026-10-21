import { Component, computed, inject, input, signal } from '@angular/core';
import {
  emptyResources,
  GameState,
  hasResources,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  totalResources,
  tradeRate,
} from '../../engine';
import { RoomService } from '../../net/room.service';
import { RESOURCE_ICONS } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';

@Component({
  selector: 'app-trade-panel',
  imports: [ResourcePicker],
  template: `
    @let g = game();
    @if (isMyMain()) {
      <div class="block">
        <h4>Bank & Häfen</h4>
        <div class="label muted">Gib</div>
        <div class="choices">
          @for (r of resources; track r) {
            <button
              class="choice"
              [class.selected]="bankGive() === r"
              [disabled]="me()!.resources[r] < rates()[r]"
              [title]="rates()[r] + ' ' + names[r]"
              (click)="bankGive.set(r)"
            >
              {{ icons[r] }}<small>{{ rates()[r] }}:1</small>
            </button>
          }
        </div>
        <div class="label muted">Bekomme</div>
        <div class="choices">
          @for (r of resources; track r) {
            <button
              class="choice"
              [class.selected]="bankGet() === r"
              [disabled]="r === bankGive() || g.bank[r] === 0"
              [title]="names[r]"
              (click)="bankGet.set(r)"
            >
              {{ icons[r] }}
            </button>
          }
        </div>
        <button class="primary full" [disabled]="!canBankTrade()" (click)="bankTrade()">Mit der Bank tauschen</button>
      </div>
    }

    @if (canOffer()) {
      <div class="block">
        @if (!composing()) {
          <button class="full" (click)="composing.set(true)">
            {{ isMyMain() ? 'Handel mit Mitspielern anbieten' : 'Gegenangebot an ' + g.players[g.current].name }}
          </button>
        } @else {
          <h4>{{ isMyMain() ? 'Angebot an alle' : 'Angebot an ' + g.players[g.current].name }}</h4>
          <div class="label muted">Ich gebe</div>
          <app-resource-picker [(value)]="give" [max]="me()!.resources" />
          <div class="label muted">Ich möchte</div>
          <app-resource-picker [(value)]="want" />
          <div class="row end">
            <button (click)="resetComposer()">Abbrechen</button>
            <button class="primary" [disabled]="!canSendOffer()" (click)="sendOffer()">Anbieten</button>
          </div>
        }
      </div>
    }

    @for (o of g.offers; track o.id) {
      <div class="offer" [style.border-color]="g.players[o.from].color">
        <div>
          <strong>{{ g.players[o.from].name }}</strong>
          @if (o.counter) {
            <span class="muted"> an {{ g.players[g.current].name }}</span>
          }
          <div class="terms">
            gibt <span class="res">{{ short(o.give) }}</span> · will <span class="res">{{ short(o.want) }}</span>
          </div>
        </div>
        <div class="row">
          @if (!o.counter && o.from === seat()) {
            @for (p of o.accepted; track p) {
              <button class="small primary" (click)="confirm(o.id, p)">Handeln mit {{ g.players[p].name }}</button>
            }
            @if (!o.accepted.length) {
              <span class="muted small">Wartet auf Antworten{{ o.declined.length ? ' (' + o.declined.length + ' abgelehnt)' : '' }}</span>
            }
            <button class="small" (click)="cancel(o.id)">Zurückziehen</button>
          } @else if (!o.counter && seat() >= 0) {
            @if (o.accepted.includes(seat())) {
              <span class="small ok">Angenommen ✓</span>
            } @else if (o.declined.includes(seat())) {
              <span class="small muted">Abgelehnt</span>
            }
            <button class="small" [disabled]="!canAccept(o.want) || o.accepted.includes(seat())" (click)="respond(o.id, true)">Annehmen</button>
            <button class="small" [disabled]="o.declined.includes(seat())" (click)="respond(o.id, false)">Ablehnen</button>
          } @else if (o.counter && seat() === g.current) {
            <button class="small primary" [disabled]="!canAccept(o.want)" (click)="confirm(o.id, o.from)">Annehmen</button>
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
      gap: 10px;
    }
    h4 {
      margin: 0 0 6px;
    }
    .block {
      display: grid;
      gap: 6px;
    }
    .label {
      font-size: 0.8em;
    }
    .choices {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
    }
    .choice {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 0;
      font-size: 20px;
      line-height: 1.1;
      small {
        font-size: 11px;
        color: var(--muted);
      }
      &.selected {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 14%, var(--panel));
      }
    }
    .full {
      width: 100%;
    }
    .end {
      justify-content: flex-end;
    }
    .offer {
      border: 1px solid var(--line);
      border-left-width: 5px;
      border-radius: 8px;
      padding: 8px 10px;
      display: grid;
      gap: 6px;
      background: var(--panel-2);
    }
    .terms {
      font-size: 0.92em;
    }
    .res {
      font-weight: 600;
      white-space: nowrap;
    }
    .small {
      font-size: 0.85em;
    }
    .ok {
      color: var(--ok);
      font-weight: 600;
    }
  `,
})
export class TradePanel {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();

  protected readonly resources = RESOURCES;
  protected readonly icons = RESOURCE_ICONS;
  protected readonly names = RESOURCE_NAMES;

  protected readonly bankGive = signal<Resource | null>(null);
  protected readonly bankGet = signal<Resource | null>(null);
  protected readonly composing = signal(false);
  protected readonly give = signal<ResourceCounts>(emptyResources());
  protected readonly want = signal<ResourceCounts>(emptyResources());

  protected readonly me = computed(() => this.game().players[this.seat()] ?? null);
  protected readonly isMyMain = computed(() => this.game().phase.kind === 'main' && this.game().current === this.seat());
  protected readonly canOffer = computed(() => this.game().phase.kind === 'main' && this.seat() >= 0);
  protected readonly rates = computed(() => {
    const result = {} as Record<Resource, number>;
    for (const r of RESOURCES) result[r] = tradeRate(this.game(), this.seat(), r);
    return result;
  });

  protected readonly canBankTrade = computed(() => {
    const give = this.bankGive();
    const get = this.bankGet();
    const me = this.me();
    return !!give && !!get && give !== get && !!me && me.resources[give] >= this.rates()[give] && this.game().bank[get] > 0;
  });

  protected readonly canSendOffer = computed(() => {
    const give = this.give();
    const want = this.want();
    return (
      totalResources(give) > 0 &&
      totalResources(want) > 0 &&
      RESOURCES.every((r) => !(give[r] > 0 && want[r] > 0)) &&
      !!this.me() &&
      hasResources(this.me()!.resources, give)
    );
  });

  protected bankTrade(): void {
    const give = this.bankGive();
    const get = this.bankGet();
    if (!give || !get) return;
    this.room.act({ type: 'bankTrade', give, get });
  }

  protected sendOffer(): void {
    this.room.act({ type: 'offerTrade', give: this.give(), want: this.want() });
    this.resetComposer();
  }

  protected resetComposer(): void {
    this.composing.set(false);
    this.give.set(emptyResources());
    this.want.set(emptyResources());
  }

  protected respond(offerId: number, accept: boolean): void {
    this.room.act({ type: 'respondTrade', offerId, accept });
  }

  protected confirm(offerId: number, partner: number): void {
    this.room.act({ type: 'confirmTrade', offerId, partner });
  }

  protected cancel(offerId: number): void {
    this.room.act({ type: 'cancelTrade', offerId });
  }

  protected canAccept(need: ResourceCounts): boolean {
    const me = this.me();
    return !!me && hasResources(me.resources, need);
  }

  protected short(r: ResourceCounts): string {
    return RESOURCES.filter((k) => r[k] > 0)
      .map((k) => `${r[k]}${RESOURCE_ICONS[k]}`)
      .join(' ');
  }
}
