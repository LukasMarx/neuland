import { Component, computed, inject, input, output } from '@angular/core';
import { emptyResources, GameState, RESOURCE_NAMES, RESOURCES, Resource, ResourceCounts, TradeOffer } from '../../engine';
import { RoomService } from '../../net/room.service';
import { CardFace } from '../shared/card-face';

/**
 * Angebot des aktiven Spielers an alle, groß im Dock derer, die nicht am Zug sind.
 * Hat man selbst ein Angebot an den aktiven Spieler geschickt, steht hier dessen Stand.
 */
@Component({
  selector: 'app-offer-panel',
  imports: [CardFace],
  template: `
    @if (view(); as v) {
      <div class="rows">
        <div class="trow">
          <b>{{ v.mineSent ? 'Du gibst' : v.from + ' gibt dir' }}</b>
          <div class="slots">
            @for (r of present(v.top); track r) {
              <span class="slotwrap">
                <span class="slot on static" [attr.data-hand]="v.mineSent ? r : null">
                  <app-card-face [kind]="r" />
                  <span class="count">{{ v.top[r] }}</span>
                </span>
                <small>&nbsp;</small>
              </span>
            }
          </div>
        </div>
        <div class="trow">
          <b>{{ v.mineSent ? 'Du bekommst' : v.from + ' will' }}@if (!v.mineSent) {<small>von dir</small>}</b>
          <div class="slots">
            @for (r of present(v.bottom); track r) {
              @let lack = v.mineSent ? 0 : Math.max(0, v.bottom[r] - hand()[r]);
              <span class="slotwrap">
                <span class="slot on static" [class.short]="lack > 0" [attr.data-hand]="v.mineSent ? null : r">
                  <app-card-face [kind]="r" />
                  <span class="count">{{ v.bottom[r] }}</span>
                </span>
                @if (v.mineSent) {
                  <small>&nbsp;</small>
                } @else if (lack) {
                  <small class="lack">dir fehlt {{ lack }}</small>
                } @else {
                  <small>du hast {{ hand()[r] }}</small>
                }
              </span>
            }
          </div>
        </div>
      </div>

      <div class="act" [style.--c]="v.color">
        <p class="head">
          <span class="dot"></span>{{ v.mineSent ? 'Dein Angebot an ' + v.from : v.from }}
          @if (!v.mineSent) {
            <span>bietet einen Tausch an</span>
          }
        </p>
        @if (v.mineSent || v.accepted) {
          <p class="hint">
            <b>{{ v.mineSent ? 'Angebot geschickt.' : 'Du hast angenommen.' }}</b>
            <span class="wait"> {{ v.from }} entscheidet{{ v.accepted ? ', mit wem getauscht wird' : '' }}</span>
          </p>
        } @else if (missing().length) {
          <p class="hint">Dir fehlt <b>{{ missing().join(', ') }}</b>. Mach ein Gegenangebot, das für dich passt.</p>
        } @else {
          <p class="hint">Du hast alles, was {{ v.from }} will. Mit Annehmen bist du im Rennen, {{ v.from }} wählt dann aus.</p>
        }
        @if (others().length) {
          <div class="others">
            @for (o of others(); track o.seat) {
              <span [style.--c]="o.color">
                <i></i>{{ o.name }}
                @switch (o.state) {
                  @case ('accepted') { <b class="ok">nimmt an</b> }
                  @case ('declined') { <b class="bad">lehnt ab</b> }
                  @case ('counter') { <b>macht ein Gegenangebot</b> }
                  @default { <span class="wait">überlegt</span> }
                }
              </span>
            }
          </div>
        }
        <div class="buttons">
          @if (v.mineSent) {
            <button (click)="withdraw()">Zurückziehen</button>
          } @else if (v.accepted) {
            <button (click)="respond(false)">Doch nicht</button>
          } @else {
            <button [class.primary]="!missing().length" [disabled]="missing().length > 0" (click)="respond(true)">Annehmen</button>
            <button [class.primary]="missing().length > 0" (click)="counterOffer()">Gegenangebot</button>
            <button (click)="respond(false)">Ablehnen</button>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './trade.scss',
})
export class OfferPanel {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();
  /** Gegenangebot: öffnet den Tauschtisch, vorbefüllt mit dem gespiegelten Angebot. */
  readonly counter = output<{ give: ResourceCounts; want: ResourceCounts }>();

  protected readonly Math = Math;
  protected readonly hand = computed(() => this.game().players[this.seat()]?.resources ?? emptyResources());

  /** Offenes Angebot des aktiven Spielers an alle. */
  private readonly offer = computed(() => offerFor(this.game(), this.seat()));
  private readonly mySent = computed(() => this.game().offers.find((o) => o.counter && o.from === this.seat()) ?? null);

  protected readonly view = computed(() => {
    const g = this.game();
    const from = g.players[g.current];
    const sent = this.mySent();
    if (sent) return { from: from.name, color: from.color, mineSent: true, accepted: false, top: sent.give, bottom: sent.want };
    const offer = this.offer();
    if (!offer) return null;
    return { from: from.name, color: from.color, mineSent: false, accepted: offer.accepted.includes(this.seat()), top: offer.give, bottom: offer.want };
  });

  protected readonly missing = computed(() => {
    const offer = this.offer();
    if (!offer) return [];
    return RESOURCES.filter((r) => offer.want[r] > this.hand()[r]).map((r) => `${offer.want[r] - this.hand()[r]} ${RESOURCE_NAMES[r]}`);
  });

  /** Was die übrigen Mitspieler auf das Angebot des aktiven Spielers antworten. */
  protected readonly others = computed(() => {
    const g = this.game();
    const offer = this.offer();
    if (!offer) return [];
    return g.players.flatMap((p, seat) => {
      if (seat === this.seat() || seat === g.current || p.neutral) return [];
      const state = g.offers.some((o) => o.counter && o.from === seat)
        ? 'counter'
        : offer.accepted.includes(seat)
          ? 'accepted'
          : offer.declined.includes(seat)
            ? 'declined'
            : 'pending';
      return [{ seat, name: p.name, color: p.color, state }];
    });
  });

  protected present(c: ResourceCounts): Resource[] {
    return RESOURCES.filter((r) => c[r] > 0);
  }

  protected respond(accept: boolean): void {
    const offer = this.offer();
    if (offer) this.room.act({ type: 'respondTrade', offerId: offer.id, accept });
  }

  protected withdraw(): void {
    const sent = this.mySent();
    if (sent) this.room.act({ type: 'cancelTrade', offerId: sent.id });
  }

  protected counterOffer(): void {
    const offer = this.offer();
    if (offer) this.counter.emit({ give: offer.want, want: offer.give });
  }
}

/** Das Angebot des aktiven Spielers, das `seat` noch beantworten kann (nicht abgelehnt). */
export function offerFor(g: GameState, seat: number): TradeOffer | null {
  if (g.phase.kind !== 'main' || seat < 0 || seat === g.current) return null;
  return g.offers.find((o) => !o.counter && o.from === g.current && !o.declined.includes(seat)) ?? null;
}

/** Ob die Angebotsansicht für `seat` gerade etwas zu zeigen hat. */
export function hasOfferView(g: GameState, seat: number): boolean {
  if (g.phase.kind !== 'main' || seat < 0 || seat === g.current) return false;
  return offerFor(g, seat) !== null || g.offers.some((o) => o.counter && o.from === seat);
}
