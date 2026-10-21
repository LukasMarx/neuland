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
import { RESOURCE_ICONS, TERRAIN_COLORS } from '../shared/labels';
import { ResourcePicker } from '../shared/resource-picker';

@Component({
  selector: 'app-trade-dialog',
  imports: [ResourcePicker],
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
                  [style.--c]="colors[r]"
                  [class.selected]="bankGive() === r"
                  [disabled]="me()!.resources[r] < rates()[r]"
                  [title]="'Du hast ' + me()!.resources[r] + ' ' + names[r]"
                  (click)="bankGive.set(r)"
                >
                  <span class="icon">{{ icons[r] }}</span>
                  <span class="rate">{{ rates()[r] }}:1</span>
                </button>
              }
            </div>
            <div class="label muted">Ich bekomme</div>
            <div class="cards">
              @for (r of resources; track r) {
                <button
                  class="rcard"
                  [style.--c]="colors[r]"
                  [class.selected]="bankGet() === r"
                  [disabled]="r === bankGive() || g.bank[r] === 0"
                  [title]="names[r] + (g.bank[r] === 0 ? ' (Bank leer)' : '')"
                  (click)="bankGet.set(r)"
                >
                  <span class="icon">{{ icons[r] }}</span>
                  <span class="rate">{{ names[r] }}</span>
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
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
    }
    .rcard {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 0 6px;
      border-radius: 10px;
      border: 2px solid transparent;
      background: color-mix(in srgb, var(--c) 30%, #fff);
      .icon {
        font-size: 26px;
        line-height: 1.1;
      }
      .rate {
        font-size: 11px;
        font-weight: 700;
      }
      &.selected {
        border-color: var(--text);
        background: color-mix(in srgb, var(--c) 60%, #fff);
        box-shadow: 0 3px 10px rgb(0 0 0 / 0.15);
      }
      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--c) 45%, #fff);
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
  protected readonly colors = TERRAIN_COLORS;

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
