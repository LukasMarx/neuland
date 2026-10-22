import { Component, computed, input, OnInit, output } from '@angular/core';
import { Resource } from '../../engine';
import { pieceImage } from '../shared/piece-art';
import { RESOURCE_ART } from '../shared/resource-art';

export type BannerKind = 'win' | 'road' | 'army' | 'harbor' | 'monopoly' | 'plenty' | 'turn';

export interface BannerEvent {
  id: number;
  kind: BannerKind;
  title: string;
  name: string;
  color: string;
  tag: string;
  resource?: Resource;
  resources?: Resource[];
}

interface Prop {
  src: string;
  cls: string;
  delay: number;
  rotate?: number;
  mirror?: boolean;
}

/** Freigestellte Banner-Motive (Papiercollage, siehe output/designs/banner-2026-10-21). */
const MOTIF = (name: 'laurel' | 'star' | 'shield' | 'sword' | 'signpost' | 'chest' | 'coin' | 'basket' | 'horn') =>
  `web/banner/papiercollage/${name}.png`;

/** Gesamtdauer bis zum Ausblenden, danach meldet das Banner `done`. */
export const BANNER_MS = 4100;

/**
 * Breites, halbtransparentes Band über dem Brett. Links und rechts treten freigestellte
 * Motive auf (Lorbeer, Schild, Truhe …) zusammen mit Spielteilen in der Farbe des Spielers.
 */
@Component({
  selector: 'app-event-banner',
  template: `
    <div class="band" [class.win]="event().kind === 'win'" role="status" aria-live="polite">
      <div class="props left">
        @for (p of props().left; track $index) {
          <img [src]="p.src" [class]="p.cls" [style.--d.s]="p.delay" [style.--r.deg]="p.rotate ?? 0" [class.mirror]="p.mirror" alt="" />
        }
      </div>
      <div class="title">
        <b>{{ event().title }}</b>
        <span><i [style.background]="event().color"></i>{{ event().name }} <em>{{ event().tag }}</em></span>
      </div>
      <div class="props right">
        @for (p of props().right; track $index) {
          <img [src]="p.src" [class]="p.cls" [style.--d.s]="p.delay" [style.--r.deg]="p.rotate ?? 0" [class.mirror]="p.mirror" alt="" />
        }
      </div>
    </div>
    @if (event().kind === 'win') {
      <div class="confetti" aria-hidden="true">
        @for (c of confetti; track $index) {
          <i [style.left.%]="c.left" [style.background]="c.color" [style.animation-duration.s]="c.duration" [style.animation-delay.s]="c.delay"></i>
        }
      </div>
    }
  `,
  styleUrl: './event-banner.scss',
})
export class EventBanner implements OnInit {
  readonly event = input.required<BannerEvent>();
  readonly done = output<void>();

  protected readonly confetti = Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    color: ['#d23c3c', '#2f64d6', '#e6c24a', '#2f9a48', '#ee8a1c', '#f4f1e8'][i % 6],
    duration: 2.4 + Math.random() * 1.8,
    delay: Math.random() * 0.8,
  }));

  protected readonly props = computed((): { left: Prop[]; right: Prop[] } => {
    const e = this.event();
    const piece = (kind: 'road' | 'settlement' | 'city' | 'knight') => pieceImage(kind, e.color);
    const list = (n: number, make: (i: number) => Prop | null) =>
      Array.from({ length: n }, (_, i) => make(i)).filter((p): p is Prop => p !== null);
    const at = (src: string | null, cls: string, delay: number, extra: Partial<Prop> = {}): Prop | null =>
      src ? { src, cls, delay, ...extra } : null;

    switch (e.kind) {
      case 'road':
        return {
          left: list(3, (i) => at(piece('road'), 'road lay', 0.3 + i * 0.12, { rotate: i % 2 ? 8 : -8 })),
          right: list(1, () => at(MOTIF('signpost'), 'motif pop', 0.8)),
        };
      case 'harbor':
        // Bis es ein eigenes Motiv gibt: Gebäude des Spielers und Münzen aus dem Hafenhandel.
        return {
          left: list(2, (i) => at(piece(i ? 'city' : 'settlement'), i ? 'city pop' : 'house pop', 0.3 + i * 0.15)),
          right: list(2, (i) => at(MOTIF('coin'), 'motif coin fly-r', 0.4 + i * 0.12, { rotate: i ? 12 : -10 })),
        };
      case 'army':
        // Zwei gespiegelte Schwerter ergeben ein gekreuztes Paar.
        return {
          left: list(1, () => at(MOTIF('shield'), 'motif pop', 0.3)),
          right: [
            { src: MOTIF('sword'), cls: 'motif sword march-r', delay: 0.4, mirror: true },
            { src: MOTIF('sword'), cls: 'motif sword crossed march-r', delay: 0.5 },
          ],
        };
      case 'win':
        // Lorbeerkranz um den Titel, außen je ein Stern.
        return {
          left: [
            { src: MOTIF('star'), cls: 'motif small pop', delay: 0.6 },
            { src: MOTIF('laurel'), cls: 'motif tall pop', delay: 0.3, mirror: true },
          ],
          right: [
            { src: MOTIF('laurel'), cls: 'motif tall pop', delay: 0.3 },
            { src: MOTIF('star'), cls: 'motif small pop', delay: 0.7 },
          ],
        };
      case 'monopoly': {
        const res = e.resource ? RESOURCE_ART[e.resource] : null;
        return {
          left: [
            ...list(2, (i) => at(res, 'res fly-l', 0.2 + i * 0.12)),
            ...list(1, () => at(MOTIF('chest'), 'motif pop', 0.45)),
          ],
          right: list(3, (i) => at(MOTIF('coin'), 'motif coin fly-r', 0.3 + i * 0.12, { rotate: (i - 1) * 14 })),
        };
      }
      case 'plenty': {
        const [a, b] = e.resources ?? [];
        return {
          left: list(1, () => at(MOTIF('basket'), 'motif pop', 0.3)),
          right: [
            ...list(1, () => at(a ? RESOURCE_ART[a] : null, 'res pop', 0.55)),
            ...list(1, () => at(b ? RESOURCE_ART[b] : null, 'res pop', 0.7)),
          ],
        };
      }
      case 'turn':
        return {
          left: list(1, () => at(MOTIF('horn'), 'motif march', 0.2)),
          right: list(1, () => at(piece('knight'), 'knight march-r', 0.35)),
        };
    }
  });

  ngOnInit(): void {
    setTimeout(() => this.done.emit(), BANNER_MS);
  }
}
