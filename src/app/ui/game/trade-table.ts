import { Component, computed, effect, inject, input, OnInit, output, signal, untracked } from '@angular/core';
import {
  emptyResources,
  GameState,
  RESOURCE_NAMES,
  RESOURCES,
  Resource,
  ResourceCounts,
  totalResources,
  TradeOffer,
  tradeRate,
} from '../../engine';
import { RoomService } from '../../net/room.service';
import { CARD_ART } from '../shared/card-art';
import { CardFace } from '../shared/card-face';

type Side = 'give' | 'want';

interface Answer {
  seat: number;
  name: string;
  color: string;
  state: 'pending' | 'accepted' | 'declined' | 'counter';
  counter?: TradeOffer;
  canDeal: boolean;
}

/**
 * Tauschtisch im Dock. Wer am Zug ist, stellt hier ein Angebot zusammen und tauscht mit der Bank
 * oder bietet es allen an; die Antworten erscheinen am selben Ort. Wer nicht am Zug ist, schickt
 * von hier ein Angebot an den aktiven Spieler.
 */
@Component({
  selector: 'app-trade-table',
  imports: [CardFace],
  template: `
    @let g = game();
    <div class="rows">
      @for (row of rows; track row.side) {
        <div class="trow">
          <b>
            {{ row.side === 'give' ? 'Du gibst' : 'Du bekommst' }}
            <small>{{ row.side === 'give' ? (mine() ? 'aus deiner Hand' : 'an ' + targetName()) : (mine() ? 'von Bank oder Mitspielern' : 'von ' + targetName()) }}</small>
          </b>
          <div class="slots">
            @for (r of resources; track r) {
              @let n = shown()[row.side][r];
              <span class="slotwrap">
                <button
                  type="button"
                  class="slot"
                  [class.on]="n > 0"
                  [attr.data-hand]="row.side === 'give' ? r : null"
                  [disabled]="locked() || (n === 0 && n >= max(row.side, r))"
                  [title]="names[r] + ': Klick legt eine dazu, Rechtsklick nimmt eine weg'"
                  (click)="add(row.side, r)"
                  (contextmenu)="$event.preventDefault(); remove(row.side, r)"
                >
                  <app-card-face [kind]="r" />
                  @if (row.side === 'give' && mine()) {
                    <span class="rate" [class.good]="rates()[r] < 3">{{ rates()[r] }}:1</span>
                  }
                  @if (n > 0) {
                    <span class="count">{{ n }}</span>
                    @if (!locked()) {
                      <span class="minus" role="button" aria-label="Eine weniger" (click)="$event.stopPropagation(); remove(row.side, r)">−</span>
                    }
                  }
                </button>
                <small>
                  @if (row.side === 'give') {
                    du hast {{ hand()[r] }}
                  } @else if (mine()) {
                    Bank {{ g.bank[r] }}
                  } @else {
                    &nbsp;
                  }
                </small>
              </span>
            }
          </div>
        </div>
      }
    </div>

    <div class="act">
      @if (mine() && answers().length) {
        <div class="answers" [class.many]="answers().length > 3">
          @for (a of answers(); track a.seat) {
            <div class="answer" [style.--c]="a.color">
              <span class="dot"></span>
              <b>{{ a.name }}</b>
              @switch (a.state) {
                @case ('accepted') {
                  <span class="state ok">nimmt an</span>
                  <button class="primary" [disabled]="!a.canDeal" (click)="deal(a)">Tauschen</button>
                }
                @case ('declined') {
                  <span class="state bad">lehnt ab</span>
                  <span></span>
                }
                @case ('counter') {
                  <span class="state">
                    gibt
                    <span class="stack">@for (c of cards(a.counter!.give); track $index) {<img [src]="art[c]" [alt]="names[c]" [title]="names[c]" />}</span>
                    für
                    <span class="stack">@for (c of cards(a.counter!.want); track $index) {<img [src]="art[c]" [alt]="names[c]" [title]="names[c]" />}</span>
                  </span>
                  <button [disabled]="!a.canDeal" (click)="deal(a)">Annehmen</button>
                }
                @default {
                  <span class="state wait">überlegt</span>
                  <span></span>
                }
              }
            </div>
          }
        </div>
      }
      @if (mine() && myOffer()) {
        <div class="buttons">
          <button (click)="withdraw()">Zurückziehen</button>
        </div>
      } @else {
        <p class="hint" [class.good]="hint().good" [innerHTML]="hint().html"></p>
        <div class="buttons">
          @if (mine()) {
            <button [class.primary]="bank().ok" [disabled]="!bank().ok" (click)="bankTrade()">Mit der Bank tauschen</button>
            <button [class.primary]="!bank().ok" [disabled]="!offerable()" (click)="offer()">Allen anbieten</button>
          } @else {
            <button class="primary" [disabled]="!offerable()" (click)="offer()">Angebot an {{ targetName() }}</button>
          }
          <button [disabled]="!total(give()) && !total(want())" (click)="clear()">Leeren</button>
        </div>
      }
    </div>

    <button class="close" title="Schließen (Esc)" aria-label="Schließen" (click)="close.emit()">✕</button>
  `,
  styleUrl: './trade.scss',
})
export class TradeTable implements OnInit {
  private readonly room = inject(RoomService);
  readonly game = input.required<GameState>();
  readonly seat = input.required<number>();
  /** Vorbefüllung, z. B. das gespiegelte Angebot für ein Gegenangebot. */
  readonly prefill = input<{ give: ResourceCounts; want: ResourceCounts } | null>(null);
  readonly close = output<void>();

  protected readonly resources = RESOURCES;
  protected readonly names = RESOURCE_NAMES;
  protected readonly art = CARD_ART;
  protected readonly rows: { side: Side }[] = [{ side: 'give' }, { side: 'want' }];
  protected readonly total = totalResources;

  protected readonly give = signal<ResourceCounts>(emptyResources());
  protected readonly want = signal<ResourceCounts>(emptyResources());

  protected readonly mine = computed(() => this.game().current === this.seat());
  protected readonly targetName = computed(() => this.game().players[this.game().current].name);
  protected readonly hand = computed(() => this.game().players[this.seat()]?.resources ?? emptyResources());
  protected readonly myOffer = computed(() => this.game().offers.find((o) => o.from === this.seat()) ?? null);
  /** Solange das eigene Angebot offen ist, zeigt der Tisch dessen Bedingungen und lässt sich nicht ändern. */
  protected readonly locked = computed(() => this.myOffer() !== null && this.mine());
  protected readonly shown = computed(() => {
    const offer = this.myOffer();
    return offer && this.mine() ? { give: offer.give, want: offer.want } : { give: this.give(), want: this.want() };
  });

  protected readonly rates = computed(() => {
    const result = {} as Record<Resource, number>;
    for (const r of RESOURCES) result[r] = tradeRate(this.game(), this.seat(), r);
    return result;
  });

  /** Passt das Angebot zu den Kursen von Bank und Häfen? Wie viele Karten gäbe es dafür? */
  protected readonly bank = computed(() => {
    const give = this.give();
    const want = this.want();
    let lots = 0;
    const off: { r: Resource; rest: number; add: number }[] = [];
    for (const r of RESOURCES) {
      if (!give[r]) continue;
      const rest = give[r] % this.rates()[r];
      if (rest) off.push({ r, rest, add: this.rates()[r] - rest });
      else lots += give[r] / this.rates()[r];
    }
    const overlap = RESOURCES.some((r) => give[r] > 0 && want[r] > 0);
    const bankHas = RESOURCES.every((r) => this.game().bank[r] >= want[r]);
    return { lots, off, overlap, ok: !overlap && !off.length && lots > 0 && totalResources(want) === lots && bankHas };
  });

  protected readonly offerable = computed(
    () => totalResources(this.give()) > 0 && totalResources(this.want()) > 0 && !this.bank().overlap,
  );

  protected readonly hint = computed((): { html: string; good?: boolean } => {
    const give = this.give();
    const want = this.want();
    const g = totalResources(give);
    const w = totalResources(want);
    if (!this.mine()) {
      return g && w
        ? { html: `${esc(this.targetName())} bekommt <b>${words(give)}</b> und gibt dir <b>${words(want)}</b>.` }
        : { html: 'Klick auf eine Karte legt eine dazu, <b>−</b> oder Rechtsklick nimmt eine weg.' };
    }
    if (!g && !w) return { html: 'Klick auf die Karten, um ein Angebot zusammenzustellen. Unter „Du gibst“ steht dein Kurs bei Bank und Häfen.' };
    const b = this.bank();
    if (b.overlap) return { html: 'Ein Rohstoff kann nicht auf beiden Seiten liegen.' };
    if (b.ok) return { good: true, html: `<b>Passt für die Bank:</b> ${words(give)} gegen ${words(want)}. Mitspieler kannst du trotzdem fragen.` };
    if (!g) return { html: 'Lege noch fest, was du dafür gibst.' };
    if (b.off.length) {
      const o = b.off[0];
      const canAdd = this.hand()[o.r] - give[o.r] >= o.add;
      const fix = canAdd ? `${o.add} ${RESOURCE_NAMES[o.r]} mehr` : `${o.rest} ${RESOURCE_NAMES[o.r]} weniger`;
      return {
        html: `Bank und Häfen tauschen ${RESOURCE_NAMES[o.r]} <b>${this.rates()[o.r]}:1</b>. Mit ${fix} ginge es über die Bank.${w ? ' An Mitspieler kannst du es so anbieten.' : ''}`,
      };
    }
    if (w < b.lots) return { html: `Die Bank gibt dir dafür <b>${b.lots} ${b.lots === 1 ? 'Karte' : 'Karten'}</b>. Wähle noch ${b.lots - w} aus, die du bekommst.` };
    if (w === b.lots) return { html: 'Die Bank hat davon nicht mehr genug. An Mitspieler kannst du es so anbieten.' };
    return { html: `Die Bank gibt dafür nur ${b.lots}. An Mitspieler kannst du es so anbieten.` };
  });

  protected readonly answers = computed((): Answer[] => {
    const g = this.game();
    const offer = this.myOffer();
    if (!this.mine()) return [];
    return g.players.flatMap((p, seat): Answer[] => {
      if (seat === this.seat() || p.neutral) return [];
      const counter = g.offers.find((o) => o.counter && o.from === seat);
      const base = { seat, name: p.name, color: p.color };
      if (counter) {
        const canDeal = covers(this.hand(), counter.want) && covers(p.resources, counter.give);
        return [{ ...base, state: 'counter', counter, canDeal }];
      }
      // Ohne eigenes Angebot zeigt der Tisch nur Angebote, die andere von sich aus geschickt haben.
      if (!offer) return [];
      if (offer.accepted.includes(seat)) {
        return [{ ...base, state: 'accepted', canDeal: covers(this.hand(), offer.give) && covers(p.resources, offer.want) }];
      }
      return [{ ...base, state: offer.declined.includes(seat) ? 'declined' : 'pending', canDeal: false }];
    });
  });

  private clearAfter: number | null = null;

  constructor() {
    effect(() => {
      const version = this.game().version;
      if (this.clearAfter !== null && version > this.clearAfter) {
        this.clearAfter = null;
        untracked(() => this.clear());
      }
    });
  }

  ngOnInit(): void {
    const p = this.prefill();
    if (!p) return;
    // Nur was man auch hat, landet auf „Du gibst“.
    this.give.set(Object.fromEntries(RESOURCES.map((r) => [r, Math.min(p.give[r], this.hand()[r])])) as ResourceCounts);
    this.want.set({ ...p.want });
  }

  protected max(side: Side, r: Resource): number {
    // Wie viel man bekommen kann, prüfen Bank-Kurs bzw. die Mitspieler; die Grenze ist nur der Kartenvorrat.
    return side === 'give' ? this.hand()[r] : 19;
  }

  protected add(side: Side, r: Resource): void {
    if (this.locked()) return;
    const current = this[side]()[r];
    if (current >= this.max(side, r)) return;
    this[side].update((c) => ({ ...c, [r]: c[r] + 1 }));
    // Ein Rohstoff liegt nur auf einer Seite: wer ihn auf die andere legt, nimmt ihn hier weg.
    const other: Side = side === 'give' ? 'want' : 'give';
    if (this[other]()[r]) this[other].update((c) => ({ ...c, [r]: 0 }));
  }

  /** Von außen, z. B. beim Klick auf eine Handkarte. */
  addGive(r: Resource): void {
    this.add('give', r);
  }

  protected remove(side: Side, r: Resource): void {
    if (this.locked()) return;
    this[side].update((c) => ({ ...c, [r]: Math.max(0, c[r] - 1) }));
  }

  protected clear(): void {
    this.give.set(emptyResources());
    this.want.set(emptyResources());
  }

  protected bankTrade(): void {
    if (!this.bank().ok) return;
    // Alle Kurs-Pakete in einer Aktion: ganz oder gar nicht.
    this.room.act({ type: 'bankTradeBatch', give: this.give(), get: this.want() });
    this.clearWhenApplied();
  }

  protected offer(): void {
    if (!this.offerable()) return;
    this.room.act({ type: 'offerTrade', give: this.give(), want: this.want() });
    // Ein Angebot an den aktiven Spieler läuft in der Angebotsansicht weiter.
    if (!this.mine()) this.close.emit();
  }

  protected withdraw(): void {
    withdrawOffers(this.room, this.game(), this.seat());
  }

  protected deal(a: Answer): void {
    const offer = a.counter ?? this.myOffer();
    if (!offer) return;
    // Übrige Angebote räumt die Engine mit dem Abschluss selbst ab.
    this.room.act({ type: 'confirmTrade', offerId: offer.id, partner: a.seat });
    this.clearWhenApplied();
  }

  /** Erst leeren, wenn der Host die Aktion angenommen hat; bei einer Ablehnung bleibt die Auswahl stehen. */
  private clearWhenApplied(): void {
    this.clearAfter = this.game().version;
  }

  protected cards(c: ResourceCounts): Resource[] {
    return RESOURCES.flatMap((r) => Array<Resource>(c[r]).fill(r));
  }
}

/** Zieht das eigene Angebot zurück; wer am Zug ist, lehnt damit auch alle Gegenangebote ab. */
export function withdrawOffers(room: RoomService, g: GameState, seat: number): void {
  if (g.offers.some((o) => o.from === seat || (o.counter && g.current === seat))) room.act({ type: 'withdrawOffers' });
}

function covers(have: ResourceCounts, need: ResourceCounts): boolean {
  return RESOURCES.every((r) => have[r] >= need[r]);
}

function words(c: ResourceCounts): string {
  return RESOURCES.filter((r) => c[r])
    .map((r) => `${c[r]} ${RESOURCE_NAMES[r]}`)
    .join(', ');
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}
