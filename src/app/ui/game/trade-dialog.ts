import { Component, computed, inject, input, output, signal } from '@angular/core';
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
import { CardFace } from '../shared/card-face';
import { ResourcePicker } from '../shared/resource-picker';

@Component({
  selector: 'app-trade-dialog',
  imports: [CardFace, ResourcePicker],
  template: `
    @let g = game();
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal trade" (click)="$event.stopPropagation()">
        <header class="row">
          <h3>Handeln</h3>
          <span class="spacer"></span>
          <button class="small" (click)="close.emit()" aria-label="Schließen">✕</button>
        </header>

        @if (isMyMain()) {
          <section>
            <h4>Bank & Häfen</h4>
            <div class="label muted">Ich gebe</div>
            <div class="cards">
              @for (r of resources; track r) {
                <button
                  class="rcard"
                  [class.selected]="bankGive() === r"
                  [attr.aria-pressed]="bankGive() === r"
                  [disabled]="me()!.resources[r] < rates()[r]"
                  [title]="'Du hast ' + me()!.resources[r] + ' ' + names[r]"
                  (click)="bankGive.set(r)"
                >
                  <app-card-face [kind]="r"><span class="rate">{{ rates()[r] }}:1</span></app-card-face>
                </button>
              }
            </div>
            <div class="label muted">Ich bekomme</div>
            <div class="cards">
              @for (r of resources; track r) {
                <button
                  class="rcard"
                  [class.selected]="bankGet() === r"
                  [attr.aria-pressed]="bankGet() === r"
                  [disabled]="r === bankGive() || g.bank[r] === 0"
                  [title]="names[r] + (g.bank[r] === 0 ? ' (Bank leer)' : '')"
                  (click)="bankGet.set(r)"
                >
                  <app-card-face [kind]="r" />
                </button>
              }
            </div>
            <button class="primary full" [disabled]="!canBankTrade()" (click)="bankTrade()">
              @if (canBankTrade()) {
                {{ rates()[bankGive()!] }} {{ icons[bankGive()!] }} gegen 1 {{ icons[bankGet()!] }} tauschen
              } @else {
                Wähle, was du gibst und was du bekommst
              }
            </button>
          </section>
        }

        <section>
          <h4>{{ isMyMain() ? 'Mit Mitspielern' : 'Gegenangebot an ' + g.players[g.current].name }}</h4>
          <div class="label muted">Ich gebe</div>
          <app-resource-picker [(value)]="give" [max]="me()!.resources" />
          <div class="label muted">Ich möchte</div>
          <app-resource-picker [(value)]="want" />
          <button class="primary full" [disabled]="!canSendOffer()" (click)="sendOffer()">
            {{ isMyMain() ? 'Allen anbieten' : 'Angebot schicken' }}
          </button>
          <p class="muted hint">Offene Angebote erscheinen oben rechts über dem Brett.</p>
        </section>
      </div>
    </div>
  `,
  styles: `
    .trade {
      width: min(520px, 100%);
      display: grid;
      gap: 18px;
    }
    header h3 {
      margin: 0;
    }
    .spacer {
      flex: 1;
    }
    h4 {
      margin: 0 0 6px;
    }
    section {
      display: grid;
      gap: 8px;
    }
    .label {
      font-size: 0.8em;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }
    .rcard {
      min-width: 0;
      padding: 0;
      border-radius: 10px;
      border: 2px solid transparent;
      background: transparent;
      .rate {
        font-size: 11px;
        font-weight: 700;
      }
      &.selected {
        border-color: var(--accent);
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      &:hover:not(:disabled) {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
    }
    .full {
      width: 100%;
      padding: 0.6em;
    }
    .hint {
      font-size: 0.82em;
      margin: 0;
    }
    @media (max-width: 360px) {
      .cards {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  `,
})
export class TradeDialog {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();
  readonly close = output<void>();

  protected readonly resources = RESOURCES;
  protected readonly icons = RESOURCE_ICONS;
  protected readonly names = RESOURCE_NAMES;

  protected readonly bankGive = signal<Resource | null>(null);
  protected readonly bankGet = signal<Resource | null>(null);
  protected readonly give = signal<ResourceCounts>(emptyResources());
  protected readonly want = signal<ResourceCounts>(emptyResources());

  protected readonly me = computed(() => this.game().players[this.seat()] ?? null);
  protected readonly isMyMain = computed(() => this.game().phase.kind === 'main' && this.game().current === this.seat());
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
    // Auswahl behalten, damit man mehrfach hintereinander tauschen kann, solange es reicht.
    if (this.me()!.resources[give] - this.rates()[give] < this.rates()[give]) this.bankGive.set(null);
  }

  protected sendOffer(): void {
    this.room.act({ type: 'offerTrade', give: this.give(), want: this.want() });
    this.close.emit();
  }
}
