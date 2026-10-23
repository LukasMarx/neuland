import { Component, computed, input, signal } from '@angular/core';
import { GameState, victoryPoints } from '../../engine';

/** Wahrscheinlichkeit jeder Augensumme mit zwei Würfeln, in Sechsunddreißigsteln. */
const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

// Zeichenfläche der beiden Diagramme (SVG-Einheiten).
const W = 420;
const H = 200;
const PAD = { left: 28, right: 12, top: 12, bottom: 24 };

interface Row {
  seat: number;
  name: string;
  color: string;
  vp: number;
  produced: number;
  blocked: number;
  stolen: number;
  robbed: number;
  discarded: number;
  trades: number;
  bankCards: number;
  devBought: number;
  knights: number;
  road: number;
}

/** Statistik im Endstand: Auszeichnungen, Siegpunkte im Verlauf, Würfelverteilung und eine Tabelle je Spieler. */
@Component({
  selector: 'app-end-stats',
  template: `
    @if (awards().length) {
      <ul class="awards">
        @for (a of awards(); track a.title) {
          <li [style.--c]="a.color">
            <span class="icon" aria-hidden="true">{{ a.icon }}</span>
            <span>
              <b>{{ a.title }}</b>
              {{ a.name }} · {{ a.detail }}
            </span>
          </li>
        }
      </ul>
    }

    <div class="charts">
      <figure>
        <figcaption>Siegpunkte im Verlauf</figcaption>
        <div class="legend">
          @for (r of rows(); track r.seat) {
            <span><i [style.background]="r.color"></i>{{ r.name }}</span>
          }
        </div>
        <div class="plot">
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="'Siegpunkte je Zug, bis Zug ' + lastTurn()" (mousemove)="hoverVp($event)" (mouseleave)="vpHover.set(null)">
            @for (t of vpTicks(); track t) {
              <line class="grid" [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="vpY(t)" [attr.y2]="vpY(t)" />
              <text class="axis" [attr.x]="PAD.left - 6" [attr.y]="vpY(t) + 4" text-anchor="end">{{ t }}</text>
            }
            <text class="axis" [attr.x]="PAD.left" [attr.y]="H - 6">Zug 1</text>
            <text class="axis" [attr.x]="W - PAD.right" [attr.y]="H - 6" text-anchor="end">Zug {{ lastTurn() }}</text>
            @for (l of vpLines(); track l.seat) {
              <path class="line" [attr.d]="l.d" [style.stroke]="l.color" [class.winner]="l.seat === game().winner" />
            }
            @if (vpHover(); as h) {
              <line class="cross" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="PAD.top" [attr.y2]="H - PAD.bottom" />
              @for (p of h.points; track p.seat) {
                <circle class="dot" [attr.cx]="h.x" [attr.cy]="vpY(p.vp)" r="4" [style.fill]="p.color" />
              }
            }
          </svg>
          @if (vpHover(); as h) {
            <div class="tip" [style.left.%]="(h.x / W) * 100" [class.flip]="h.x > W * 0.6">
              <b>Nach Zug {{ h.turn }}</b>
              @for (p of h.points; track p.seat) {
                <span><i [style.background]="p.color"></i>{{ p.name }} <strong>{{ p.vp }}</strong></span>
              }
            </div>
          }
        </div>
      </figure>

      <figure>
        <figcaption>Würfe ({{ rolls() }})</figcaption>
        <div class="legend">
          <span><i class="bar-key"></i>gewürfelt</span>
          <span><i class="expect-key"></i>erwartet</span>
        </div>
        <div class="plot">
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Wie oft jede Augensumme fiel, verglichen mit dem Erwartungswert">
            @for (t of diceTicks(); track t) {
              <line class="grid" [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="diceY(t)" [attr.y2]="diceY(t)" />
              <text class="axis" [attr.x]="PAD.left - 6" [attr.y]="diceY(t) + 4" text-anchor="end">{{ t }}</text>
            }
            @for (b of diceBars(); track b.sum) {
              <g class="bar-hit" (mouseenter)="diceHover.set(b.sum)" (mouseleave)="diceHover.set(null)">
                <rect class="hit" [attr.x]="b.x - b.w / 2 - 2" [attr.y]="PAD.top" [attr.width]="b.w + 4" [attr.height]="H - PAD.top - PAD.bottom" />
                <path class="bar" [class.on]="diceHover() === b.sum" [class.seven]="b.sum === 7" [attr.d]="b.d" />
                <line class="expect" [attr.x1]="b.x - b.w / 2 - 3" [attr.x2]="b.x + b.w / 2 + 3" [attr.y1]="b.ey" [attr.y2]="b.ey" />
                <text class="axis" [attr.x]="b.x" [attr.y]="H - 6" text-anchor="middle">{{ b.sum }}</text>
              </g>
            }
          </svg>
          @if (diceTip(); as t) {
            <div class="tip" [style.left.%]="(t.x / W) * 100" [class.flip]="t.x > W * 0.6">
              <b>{{ t.sum }}</b>
              <span>{{ t.count }}× gewürfelt</span>
              <span class="muted">erwartet {{ t.expected }}</span>
            </div>
          }
        </div>
      </figure>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Spieler</th>
            <th title="Siegpunkte am Ende">Punkte</th>
            <th title="Rohstoffe aus Feldern">Erträge</th>
            <th title="Erträge, die der Räuber verhindert hat">Vom Räuber blockiert</th>
            <th title="Mit dem Räuber genommen / an den Räuber verloren">Geraubt / verloren</th>
            <th title="Bei einer 7 abgeworfen">Abgeworfen</th>
            <th title="Tauschgeschäfte mit Mitspielern">Getauscht</th>
            <th title="An Bank und Häfen abgegebene Karten">An die Bank</th>
            <th title="Gekaufte Entwicklungskarten">Entwicklung</th>
            <th>Ritter</th>
            <th title="Längste eigene Straße">Straße</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.seat) {
            <tr [class.winner]="r.seat === game().winner">
              <th scope="row"><i [style.background]="r.color"></i>{{ r.name }}</th>
              <td>{{ r.vp }}</td>
              <td>{{ r.produced }}</td>
              <td>{{ r.blocked }}</td>
              <td>{{ r.stolen }} / {{ r.robbed }}</td>
              <td>{{ r.discarded }}</td>
              <td>{{ r.trades }}</td>
              <td>{{ r.bankCards }}</td>
              <td>{{ r.devBought }}</td>
              <td>{{ r.knights }}</td>
              <td>{{ r.road }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      text-align: left;
      font-size: 13px;
    }
    .awards {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 8px;
        border-radius: 999px;
        background: var(--panel-2);
        border: 1px solid var(--line);
        box-shadow: inset 3px 0 0 var(--c);
      }
      .icon {
        font-size: 18px;
      }
      b {
        margin-right: 4px;
      }
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    figure {
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    figcaption {
      font-weight: 700;
      margin-bottom: 4px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    i {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 5px;
      border-radius: 50%;
      vertical-align: 1px;
    }
    .bar-key {
      border-radius: 2px;
      background: var(--accent);
    }
    .expect-key {
      width: 12px;
      height: 2px;
      border-radius: 1px;
      background: var(--text);
      vertical-align: 3px;
    }
    .plot {
      position: relative;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .grid {
      stroke: var(--line);
      stroke-width: 1;
    }
    .axis {
      fill: var(--muted);
      font-size: 11px;
    }
    .line {
      fill: none;
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
      &.winner {
        stroke-width: 3;
      }
    }
    .cross {
      stroke: var(--muted);
      stroke-dasharray: 3 3;
    }
    .dot {
      stroke: var(--panel-2);
      stroke-width: 2;
    }
    .hit {
      fill: transparent;
    }
    .bar {
      fill: var(--accent);
      opacity: 0.85;
      &.seven {
        opacity: 0.55;
      }
      &.on {
        opacity: 1;
      }
    }
    .expect {
      stroke: var(--text);
      stroke-width: 2;
      stroke-linecap: round;
      pointer-events: none;
    }
    .tip {
      position: absolute;
      top: 0;
      transform: translateX(12px);
      display: grid;
      gap: 2px;
      min-width: 120px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
      font-size: 12px;
      pointer-events: none;
      white-space: nowrap;
      &.flip {
        transform: translateX(calc(-100% - 12px));
      }
      strong {
        float: right;
        margin-left: 12px;
      }
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--line);
      text-align: right;
      white-space: nowrap;
    }
    thead th {
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
      white-space: normal;
      vertical-align: bottom;
    }
    th:first-child {
      text-align: left;
    }
    tbody th {
      font-weight: 600;
    }
    tr.winner td,
    tr.winner th {
      background: rgb(255 255 255 / 0.04);
    }
  `,
})
export class EndStats {
  readonly game = input.required<GameState>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;

  protected readonly vpHover = signal<{ x: number; turn: number; points: { seat: number; name: string; color: string; vp: number }[] } | null>(null);
  protected readonly diceHover = signal<number | null>(null);

  /** Neutrale Mitspieler (Duell) zählen nicht mit. */
  private readonly seats = computed(() => this.game().players.flatMap((p, seat) => (p.neutral ? [] : [seat])));

  protected readonly rows = computed((): Row[] => {
    const g = this.game();
    const st = g.stats!;
    const order = (seat: number) => Number(seat === g.winner) * 1000 + victoryPoints(g, seat, true);
    const seats = [...this.seats()].sort((a, b) => order(b) - order(a));
    return seats.map((seat) => ({
      seat,
      name: g.players[seat].name,
      color: g.players[seat].color,
      vp: victoryPoints(g, seat, true),
      produced: st.produced[seat],
      blocked: st.blocked[seat],
      stolen: st.stolen[seat],
      robbed: st.robbed[seat],
      discarded: st.discarded[seat],
      trades: st.trades[seat],
      bankCards: st.bankCards[seat],
      devBought: st.devBought[seat],
      knights: g.players[seat].knights,
      road: g.roadLengths[seat],
    }));
  });

  /** Kleine Titel für die Auffälligsten; nur wenn es einen klaren Ersten gibt. */
  protected readonly awards = computed(() => {
    const rows = this.rows();
    const top = (value: (r: Row) => number) => {
      const sorted = [...rows].sort((a, b) => value(b) - value(a));
      const best = sorted[0];
      return best && value(best) > 0 && (sorted.length < 2 || value(sorted[1]) < value(best)) ? best : null;
    };
    const list: { icon: string; title: string; name: string; color: string; detail: string }[] = [];
    const add = (icon: string, title: string, value: (r: Row) => number, detail: (n: number) => string) => {
      const r = top(value);
      if (r) list.push({ icon, title, name: r.name, color: r.color, detail: detail(value(r)) });
    };
    add('🌾', 'Ernteglück', (r) => r.produced, (n) => `${n} Rohstoffe geerntet`);
    add('🌧️', 'Pechvogel', (r) => r.blocked, (n) => `${n} Erträge an den Räuber verloren`);
    add('🦝', 'Langfinger', (r) => r.stolen, (n) => `${n} Karten geraubt`);
    add('🤝', 'Händlerseele', (r) => r.trades, (n) => `${n} Tauschgeschäfte`);
    add('📜', 'Bücherwurm', (r) => r.devBought, (n) => `${n} Entwicklungskarten`);
    return list;
  });

  // --- Siegpunkte im Verlauf

  private readonly vpEntries = computed(() => this.game().stats!.vp);
  protected readonly lastTurn = computed(() => this.vpEntries().at(-1)?.turn ?? 1);
  private readonly vpMax = computed(() => Math.max(this.game().settings.victoryPoints, ...this.vpEntries().flatMap((e) => e.points)));
  protected readonly vpTicks = computed(() => {
    const max = this.vpMax();
    const step = max > 12 ? 4 : 2;
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  });

  private vpX(turn: number): number {
    const last = Math.max(2, this.lastTurn());
    return PAD.left + ((turn - 1) / (last - 1)) * (W - PAD.left - PAD.right);
  }

  protected vpY(vp: number): number {
    return H - PAD.bottom - (vp / this.vpMax()) * (H - PAD.top - PAD.bottom);
  }

  /** Stufenlinien: Punkte ändern sich sprunghaft, nicht stetig. Der Sieger wird zuletzt (oben) gezeichnet. */
  protected readonly vpLines = computed(() => {
    const entries = this.vpEntries();
    const winner = this.game().winner;
    return this.rows()
      .map((r) => {
        let d = '';
        entries.forEach((e, i) => {
          const x = this.vpX(e.turn).toFixed(1);
          const y = this.vpY(e.points[r.seat]).toFixed(1);
          d += i === 0 ? `M${x},${y}` : `H${x}V${y}`;
        });
        return { seat: r.seat, color: r.color, d };
      })
      .sort((a, b) => Number(a.seat === winner) - Number(b.seat === winner));
  });

  protected hoverVp(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    const entries = this.vpEntries();
    if (!entries.length) return;
    const e = entries.reduce((best, cur) => (Math.abs(this.vpX(cur.turn) - x) < Math.abs(this.vpX(best.turn) - x) ? cur : best));
    const points = this.rows()
      .map((r) => ({ seat: r.seat, name: r.name, color: r.color, vp: e.points[r.seat] }))
      .sort((a, b) => b.vp - a.vp);
    this.vpHover.set({ x: this.vpX(e.turn), turn: e.turn, points });
  }

  // --- Würfe

  protected readonly rolls = computed(() => this.game().stats!.dice.reduce((a, b) => a + b, 0));
  private readonly diceMax = computed(() => {
    const dice = this.game().stats!.dice;
    const expected = (this.rolls() * 6) / 36;
    return Math.max(1, ...dice, Math.ceil(expected));
  });
  protected readonly diceTicks = computed(() => {
    // Etwa vier Linien in runden Schritten.
    const max = this.diceMax();
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((s) => max / s <= 5) ?? 1000;
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  });

  protected diceY(n: number): number {
    return H - PAD.bottom - (n / this.diceMax()) * (H - PAD.top - PAD.bottom);
  }

  protected readonly diceBars = computed(() => {
    const dice = this.game().stats!.dice;
    const slot = (W - PAD.left - PAD.right) / 11;
    const w = Math.min(22, slot - 6);
    const base = H - PAD.bottom;
    return Array.from({ length: 11 }, (_, i) => {
      const sum = i + 2;
      const x = PAD.left + slot * (i + 0.5);
      const top = this.diceY(dice[sum]);
      const r = Math.min(4, (base - top) / 2, w / 2);
      // Oben gerundet, unten gerade auf der Grundlinie.
      const d =
        base - top < 0.5
          ? ''
          : `M${x - w / 2},${base}V${top + r}Q${x - w / 2},${top} ${x - w / 2 + r},${top}H${x + w / 2 - r}Q${x + w / 2},${top} ${x + w / 2},${top + r}V${base}Z`;
      return { sum, x, w, d, ey: this.diceY((this.rolls() * WAYS[sum]) / 36) };
    });
  });

  protected readonly diceTip = computed(() => {
    const sum = this.diceHover();
    if (sum === null) return null;
    const bar = this.diceBars()[sum - 2];
    const expected = ((this.rolls() * WAYS[sum]) / 36).toLocaleString('de-DE', { maximumFractionDigits: 1 });
    return { sum, x: bar.x, count: this.game().stats!.dice[sum], expected };
  });
}
