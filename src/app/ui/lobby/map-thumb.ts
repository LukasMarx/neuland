import { Component, computed, input } from '@angular/core';
import { MapDef, mapShape } from '../../engine';

const SQ3 = Math.sqrt(3);

/** Umriss einer Karte als kleines Vorschaubild: Landfelder als Sechsecke, Wüstenplätze heller. */
@Component({
  selector: 'app-map-thumb',
  template: `
    <svg [attr.viewBox]="shape().viewBox" aria-hidden="true">
      @for (h of shape().hexes; track $index) {
        <polygon [attr.points]="h.points" [class.desert]="h.desert" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    polygon {
      fill: #7c9a5a;
      stroke: #1b2a33;
      stroke-width: 0.18;
    }
    .desert {
      fill: #d9b878;
    }
  `,
})
export class MapThumb {
  readonly map = input.required<MapDef>();
  readonly players = input(4);

  protected readonly shape = computed(() => {
    // Zufällige Formen zeigen ein festes Beispiel.
    const cells = mapShape(this.map(), this.players(), { rng: 7 });
    const corners = (cx: number, cy: number) =>
      Array.from({ length: 6 }, (_, k) => {
        const a = ((60 * k - 90) * Math.PI) / 180;
        return `${(cx + Math.cos(a)).toFixed(2)},${(cy + Math.sin(a)).toFixed(2)}`;
      }).join(' ');
    const hexes = cells.map((m) => ({ points: corners((m.c * SQ3) / 2, m.r * 1.5), desert: m.ch === 'x' || m.ch === 'X' }));
    const xs = cells.map((m) => (m.c * SQ3) / 2);
    const ys = cells.map((m) => m.r * 1.5);
    const minX = Math.min(...xs) - 1.2;
    const minY = Math.min(...ys) - 1.2;
    const w = Math.max(...xs) + 1.2 - minX;
    const h = Math.max(...ys) + 1.2 - minY;
    // Quadratischer Ausschnitt, damit alle Kacheln gleich groß wirken.
    const size = Math.max(w, h);
    return { hexes, viewBox: `${minX - (size - w) / 2} ${minY - (size - h) / 2} ${size} ${size}` };
  });
}
