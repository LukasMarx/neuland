import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { rattle } from '../shared/sounds';

/** Rotation des Würfels, damit die jeweilige Seite nach vorne zeigt. Gegenüberliegende Seiten ergeben 7. */
const FACE_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

/** Augen-Positionen im 3×3-Raster (1 = oben links, 9 = unten rechts). */
const PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export const ROLL_DURATION_MS = 1100;

@Component({
  selector: 'app-dice-tray',
  template: `
    <button
      class="tray"
      type="button"
      [class.can-roll]="canRoll()"
      [class.rolling]="rolling()"
      [disabled]="!canRoll()"
      [attr.aria-label]="canRoll() ? 'Würfeln' : 'Würfel: ' + (sum() ?? 'noch nicht gewürfelt')"
      (click)="roll.emit()"
    >
      @for (die of rotations(); track $index) {
        <div class="scene" [class.red]="redSecond() && $index === 1" [style.animation-delay]="$index * 60 + 'ms'">
          <div class="die" [style.transform]="'rotateX(' + die[0] + 'deg) rotateY(' + die[1] + 'deg)'" [class.instant]="instant()">
            <!-- Innerer, etwas kleinerer Würfel: Hinter jeder Kante liegt so eine geschlossene Fläche. -->
            @for (face of faces; track face) {
              <div class="inner" [class]="'side-' + face"></div>
            }
            @for (face of faces; track face) {
              <div class="face" [class]="'face-' + face">
                @for (cell of cells; track cell) {
                  <span class="cell">
                    @if (pips[face].includes(cell)) {
                      <i class="pip"></i>
                    }
                  </span>
                }
              </div>
            }
          </div>
        </div>
      }
    </button>
    @if (showSum() && sum(); as total) {
      <div class="sum" [class.seven]="total === 7">{{ total }}</div>
    }
  `,
  styleUrl: './dice-tray.scss',
})
export class DiceTray {
  readonly dice = input<[number, number] | null>(null);
  /** Ändert sich bei jedem neuen Wurf, auch wenn dieselben Augen fallen. */
  readonly rollKey = input<string | null>(null);
  readonly canRoll = input(false);
  readonly sound = input(false);
  /** Stadtwacht: Der zweite Würfel ist rot, er entscheidet bei einem Tor, wer Einflusskarten zieht. */
  readonly redSecond = input(false);
  readonly roll = output<void>();
  readonly landed = output<number>();

  protected readonly faces = [1, 2, 3, 4, 5, 6];
  protected readonly cells = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  protected readonly pips = PIPS;

  protected readonly rotations = signal<[number, number][]>([
    [-18, 22],
    [-18, -28],
  ]);
  protected readonly rolling = signal(false);
  protected readonly instant = signal(true);
  protected readonly showSum = signal(false);
  protected readonly sum = computed(() => {
    const d = this.dice();
    return d ? d[0] + d[1] : null;
  });

  private lastKey: string | null | undefined = undefined;
  private spins = [0, 0];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const key = this.rollKey();
      const dice = this.dice();
      untracked(() => this.update(key, dice));
    });
  }

  private update(key: string | null, dice: [number, number] | null): void {
    if (key === this.lastKey) return;
    const first = this.lastKey === undefined;
    this.lastKey = key;
    clearTimeout(this.timer);
    if (!dice) {
      this.showSum.set(false);
      return;
    }
    if (first) {
      // Beim Laden kein Wurf-Theater, nur das Ergebnis zeigen.
      this.instant.set(true);
      this.rotations.set(dice.map((d) => this.target(d, 0)) as [number, number][]);
      this.showSum.set(true);
      return;
    }
    this.instant.set(false);
    this.showSum.set(false);
    this.rolling.set(true);
    this.spins = this.spins.map((s) => s + 2 + Math.floor(Math.random() * 2));
    this.rotations.set(dice.map((d, i) => this.target(d, this.spins[i], i)) as [number, number][]);
    if (this.sound()) rattle();
    this.timer = setTimeout(() => {
      this.rolling.set(false);
      this.showSum.set(true);
      this.landed.emit(dice[0] + dice[1]);
    }, ROLL_DURATION_MS);
  }

  /** Zielrotation plus ganze Umdrehungen, damit der Würfel sichtbar taumelt. Leichte Schräglage für den 3D-Eindruck. */
  private target(face: number, spins: number, index = 0): [number, number] {
    const [x, y] = FACE_ROTATION[face];
    const tiltX = -14;
    const tiltY = index === 0 ? 16 : -20;
    return [x + spins * 360 + tiltX, y + spins * 360 * (index === 0 ? 1 : -1) + tiltY];
  }
}
