import { Component, input } from '@angular/core';

/** Breite und Höhe der Bühne, auf die die Videos aufgenommen werden. */
const W = 1920;
const H = 1080;
/** Abstand Mitte–Ecke eines Blendenfelds. */
const R = 78;
const SQ3 = Math.sqrt(3);

/** Wie lange ein Feld zum Auf- oder Zuklappen braucht und wie lange die Welle über die Bühne läuft. */
export const BLENDE_FELD_MS = 380;
export const BLENDE_WELLE_MS = 520;
export const BLENDE_MS = BLENDE_FELD_MS + BLENDE_WELLE_MS;

/** Gedämpfte Geländefarben der Insel; die meisten Felder bleiben dunkel wie der Spieltisch. */
const DUNKEL = ['#121c24', '#15212a', '#18242e', '#1b2833'];
const GELAENDE = ['#3f5f3a', '#8a5236', '#7c8f4a', '#a8893f', '#5f6670', '#b39a62'];

interface Feld {
  points: string;
  fill: string;
  delay: number;
}

/** Fester Pseudozufall, damit jede Aufnahme dasselbe Muster zeigt. */
function zufall(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function felder(): Feld[] {
  const out: Feld[] = [];
  const dx = SQ3 * R;
  const dy = 1.5 * R;
  let i = 0;
  for (let row = -1; row * dy < H + R; row++) {
    for (let col = -1; col * dx < W + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      const corners = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 180) * (60 * k - 90);
        return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
      });
      const r = zufall(i++);
      const fill = r < 0.16 ? GELAENDE[Math.floor(zufall(i * 7) * GELAENDE.length)] : DUNKEL[Math.floor(r * 97) % DUNKEL.length];
      // Die Welle läuft schräg von links unten nach rechts oben, mit etwas Unruhe wie gelegte Plättchen.
      const t = (cx / W) * 0.78 + (1 - cy / H) * 0.22;
      out.push({ points: corners.join(' '), fill, delay: Math.round(Math.max(0, t) * BLENDE_WELLE_MS + zufall(i * 3) * 60) });
    }
  }
  return out;
}

/**
 * Übergang im Neuland-Stil: Sechseckplättchen klappen in einer Welle über die Bühne auf und
 * wieder weg. `zu` deckt die Bühne ab, darunter kann der Inhalt wechseln.
 */
@Component({
  selector: 'app-hexblende',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="xMidYMid slice" [class.zu]="zu()" aria-hidden="true">
      @for (f of felder; track $index) {
        <polygon [attr.points]="f.points" [attr.fill]="f.fill" [style.transition-delay.ms]="f.delay" />
      }
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 20;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    polygon {
      transform-box: fill-box;
      transform-origin: center;
      transform: scale(0) rotate(-30deg);
      stroke: #0d151b;
      stroke-width: 3;
      transition: transform ${BLENDE_FELD_MS}ms cubic-bezier(0.65, 0, 0.3, 1);
    }
    .zu polygon {
      transform: scale(1.04) rotate(0deg);
    }
  `,
})
export class Hexblende {
  readonly zu = input(false);
  protected readonly w = W;
  protected readonly h = H;
  protected readonly felder = felder();
}
