import { afterNextRender, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { DEV_CARD_NAMES, DevCard } from '../../engine';
import { CardFace } from '../shared/card-face';
import { DEV_CARD_GENERAL, DEV_CARD_RULES } from '../shared/labels';

const FLIP_MS = 650;

/**
 * Vergrößerte Entwicklungskarte: fliegt von ihrer Position in der Hand in die Mitte,
 * dreht sich dabei um und zeigt auf der Rückseite, was sie bewirkt.
 */
@Component({
  selector: 'app-card-inspector',
  imports: [CardFace],
  host: { '(document:keydown.escape)': 'dismiss()' },
  template: `
    <div class="backdrop" #backdrop (click)="dismiss()"></div>
    <div class="stage">
      <div class="card" #flip role="dialog" [attr.aria-label]="name()">
        <div class="face front"><app-card-face [kind]="card()" [large]="true" /></div>
        <div class="face back">
          <span class="kicker">Entwicklungskarte</span>
          <h3>{{ name() }}</h3>
          <p class="rule">{{ rule() }}</p>
          <p class="general">{{ general }}</p>
          <p class="status" [class.ready]="canPlay()">{{ status() }}</p>
          <div class="actions">
            <button type="button" (click)="dismiss()">Schließen</button>
            @if (canPlay()) {
              <button type="button" class="primary" (click)="play.emit()">Spielen</button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(5 10 14 / 0.62);
    }
    .stage {
      position: relative;
      perspective: 1400px;
    }
    .card {
      position: relative;
      width: min(300px, 78vw);
      aspect-ratio: 2 / 3;
      transform-style: preserve-3d;
      transform: rotateY(180deg);
    }
    .face {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      border-radius: 14px;
      box-shadow: 0 24px 60px rgb(0 0 0 / 0.55);
    }
    .front app-card-face {
      height: 100%;
      border-radius: 14px;
    }
    .back {
      transform: rotateY(180deg);
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 26px 22px 20px;
      overflow: auto;
      color: #302312;
      background: linear-gradient(150deg, #fff5df, #ead6ab);
      border: 1px solid #f6e5bd;
      box-shadow:
        0 0 0 3px #b89a66,
        0 24px 60px rgb(0 0 0 / 0.55);
    }
    .kicker {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #7a5f37;
    }
    h3 {
      margin: 0;
      font-size: 26px;
      font-weight: 900;
      line-height: 1.1;
    }
    .rule {
      margin: 0;
      font-size: 15px;
      line-height: 1.45;
    }
    .general {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.4;
      color: #6d5634;
    }
    .status {
      margin: auto 0 0;
      padding: 7px 10px;
      border-radius: 8px;
      background: rgb(84 51 75 / 0.1);
      font-size: 13px;
      font-weight: 800;
      color: #54334b;

      &.ready {
        background: rgb(47 138 70 / 0.14);
        color: #22663a;
      }
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;

      button {
        background: #fffaf0;
        border-color: #c9b385;
        color: #302312;
      }

      button.primary {
        background: #54334b;
        border-color: #54334b;
        color: #fff5df;
      }
    }
  `,
})
export class CardInspector {
  readonly card = input.required<DevCard>();
  /** Position der Karte in der Hand, von dort fliegt sie heraus und zurück. */
  readonly origin = input<DOMRect | null>(null);
  readonly status = input('');
  readonly canPlay = input(false);
  readonly play = output<void>();
  readonly close = output<void>();

  protected readonly general = DEV_CARD_GENERAL;
  protected readonly name = computed(() => DEV_CARD_NAMES[this.card()]);
  protected readonly rule = computed(() => DEV_CARD_RULES[this.card()]);

  private readonly cardEl = viewChild.required<ElementRef<HTMLElement>>('flip');
  private readonly backdropEl = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private closing = false;

  constructor() {
    afterNextRender(() => {
      if (this.reducedMotion) return;
      this.backdropEl().nativeElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      this.cardEl().nativeElement.animate(this.flight(), { duration: FLIP_MS, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' });
    });
  }

  /** Schließt mit der umgekehrten Bewegung zurück in die Hand. */
  dismiss(): void {
    if (this.closing) return;
    this.closing = true;
    if (this.reducedMotion) {
      this.close.emit();
      return;
    }
    this.backdropEl().nativeElement.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FLIP_MS * 0.8, fill: 'forwards' });
    const anim = this.cardEl().nativeElement.animate([...this.flight()].reverse(), {
      duration: FLIP_MS * 0.8,
      easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)',
      fill: 'forwards',
    });
    anim.onfinish = () => this.close.emit();
  }

  /** Bewegung von der Handkarte (Vorderseite) in die Mitte (Rückseite). */
  private flight(): Keyframe[] {
    const from = this.origin();
    const target = this.cardEl().nativeElement.getBoundingClientRect();
    if (!from || !target.width) {
      return [{ transform: 'scale(0.6) rotateY(0deg)', opacity: 0 }, { transform: 'rotateY(180deg)', opacity: 1 }];
    }
    const dx = from.left + from.width / 2 - (target.left + target.width / 2);
    const dy = from.top + from.height / 2 - (target.top + target.height / 2);
    const s = from.width / target.width;
    return [
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotateY(0deg)` },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1.06) rotateY(110deg)`, offset: 0.6 },
      { transform: 'translate(0, 0) scale(1) rotateY(180deg)' },
    ];
  }
}
