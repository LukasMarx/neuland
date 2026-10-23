import { Component, computed, input } from '@angular/core';
import { Card, Terrain } from '../../engine';
import { RESOURCE_ART } from '../shared/resource-art';

/** Kleine Brettausschnitte als Beispielbilder im Regelbuch. */
export type SceneId =
  | 'island'
  | 'distance'
  | 'yield'
  | 'robber'
  | 'longestRoad'
  | 'specialBuild'
  | 'ships'
  | 'metropolis'
  | 'raiders'
  | 'river';

/** Feldgröße wie auf dem Brett: Abstand Mitte–Ecke. */
const S = 60;
const SQ3 = Math.sqrt(3);
const SETTLEMENT = 48;
const CITY = 66;

interface Point {
  x: number;
  y: number;
}

interface SceneHex extends Point {
  terrain: Terrain;
  number?: number;
  /** Zahl ist gefallen und leuchtet. */
  hit?: boolean;
  /** Räuber steht drauf, der Chip wird blass. */
  blocked?: boolean;
}

interface Sprite extends Point {
  src: string;
  w: number;
  h: number;
  angle?: number;
}

interface Badge extends Point {
  cards: Card[];
  text?: string;
}

interface Mark extends Point {
  ok: boolean;
}

interface Label extends Point {
  text: string;
}

interface SceneModel {
  viewBox: string;
  sea?: boolean;
  seaHexes?: Point[];
  hexes: SceneHex[];
  river?: string;
  sprites: Sprite[];
  marks?: Mark[];
  badges?: Badge[];
  labels?: Label[];
  /** Freie SVG-Grafik für Szenen ohne Brett (Plündererleiste, Sonderbauphase). */
  track?: { x: number; filled: boolean; attack: boolean }[];
  arrows?: { x1: number; y1: number; x2: number; y2: number }[];
}

/** Mitte eines Feldes in „doubled coordinates“ wie in der Engine. */
const at = (c: number, r: number): Point => ({ x: (c * SQ3 * S) / 2, y: r * 1.5 * S });
/** Ecke k eines Feldes, spitz oben, k = 0 oben, im Uhrzeigersinn. */
const corner = (c: number, r: number, k: number): Point => {
  const m = at(c, r);
  const a = ((-90 + 60 * k) * Math.PI) / 180;
  return { x: m.x + S * Math.cos(a), y: m.y + S * Math.sin(a) };
};

const piece = (name: string) => `web/pieces/papiercollage/${name}.png`;
const building = (name: string) => `web/pieces/papiercollage-organic-v2/${name}.png`;

const settlement = (p: Point, color: string): Sprite => ({
  ...p,
  src: building(`settlement-${color}`),
  w: SETTLEMENT,
  h: SETTLEMENT,
});
const city = (p: Point, color: string): Sprite => ({
  ...p,
  src: building(`city-${color}`),
  w: CITY,
  h: CITY,
});

/** Straße oder Schiff mittig auf der Kante a–b, längs gedreht. */
function onEdge(a: Point, b: Point, src: string, ratio: number, scale = 0.76): Sprite {
  const w = Math.hypot(b.x - a.x, b.y - a.y) * scale;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    src,
    w,
    h: w * ratio,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}
const road = (a: Point, b: Point, color: string) =>
  onEdge(a, b, piece(`road-${color}`), 0.28, 0.86);
const ship = (a: Point, b: Point, color: string) => onEdge(a, b, piece(`ship-${color}`), 0.5, 0.95);

const hex = (
  c: number,
  r: number,
  terrain: Terrain,
  number?: number,
  extra: Partial<SceneHex> = {},
): SceneHex => ({ ...at(c, r), terrain, number, ...extra });

/** Ausschnitt um Felder, Figuren und Beschriftungen mit etwas Rand, als viewBox. */
function frame(m: Omit<SceneModel, 'viewBox'>): string {
  const boxes = [
    ...m.hexes.map((h) => [h.x - (SQ3 / 2) * S, h.y - S, h.x + (SQ3 / 2) * S, h.y + S]),
    ...m.sprites.map((p) => [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2]),
    ...(m.badges ?? []).map((b) => [
      b.x - Math.max(16, b.cards.length * 13 + 4),
      b.y - 17,
      b.x + Math.max(16, b.cards.length * 13 + 4),
      b.y + 17,
    ]),
    ...(m.marks ?? []).map((k) => [k.x - 12, k.y - 12, k.x + 12, k.y + 12]),
    ...(m.labels ?? []).map((l) => [l.x - 12, l.y - 10, l.x + 12, l.y + 10]),
  ];
  const pad = m.sea ? 22 : 6;
  const x0 = Math.min(...boxes.map((b) => b[0])) - pad;
  const y0 = Math.min(...boxes.map((b) => b[1])) - pad;
  const x1 = Math.max(...boxes.map((b) => b[2])) + pad;
  const y1 = Math.max(...boxes.map((b) => b[3])) + pad;
  return `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`;
}

function build(id: SceneId): SceneModel {
  const m = scene(id);
  return { ...m, viewBox: m.viewBox ?? frame(m) };
}

function scene(id: SceneId): Omit<SceneModel, 'viewBox'> & { viewBox?: string } {
  switch (id) {
    case 'island': {
      const hexes = [
        hex(0, 0, 'wheat', 6),
        hex(2, 0, 'wood', 8),
        hex(-2, 0, 'brick', 5),
        hex(1, -1, 'sheep', 4),
        hex(-1, -1, 'ore', 10),
        hex(1, 1, 'wood', 9),
        hex(-1, 1, 'desert'),
      ];
      const robber = at(-1, 1);
      return {
        sea: true,
        hexes,
        sprites: [
          road(corner(0, 0, 1), corner(0, 0, 2), 'red'),
          settlement(corner(0, 0, 1), 'red'),
          road(corner(-2, 0, 0), corner(-2, 0, 5), 'blue'),
          city(corner(-2, 0, 0), 'blue'),
          { ...robber, src: piece('robber'), w: 50, h: 50 },
        ],
      };
    }
    case 'distance': {
      const hexes = [hex(0, 0, 'sheep', 5), hex(2, 0, 'wheat', 9), hex(1, 1, 'wood', 3)];
      const v = corner(0, 0, 2);
      const free = corner(0, 0, 4);
      return {
        hexes,
        sprites: [
          road(v, corner(0, 0, 3), 'red'),
          road(corner(0, 0, 3), free, 'red'),
          settlement(v, 'red'),
        ],
        marks: [
          { ...corner(0, 0, 1), ok: false },
          { ...corner(0, 0, 3), ok: false },
          { ...corner(2, 0, 3), ok: false },
          { ...free, ok: true },
        ],
      };
    }
    case 'yield': {
      const hexes = [
        hex(0, 0, 'wood', 9, { hit: true }),
        hex(2, 0, 'wheat', 4),
        hex(1, 1, 'brick', 9, { hit: true }),
      ];
      const v = corner(0, 0, 2);
      const c = corner(0, 0, 5);
      return {
        hexes,
        sprites: [settlement(v, 'red'), city(c, 'red')],
        badges: [
          { x: v.x + 34, y: v.y + 4, cards: ['wood', 'brick'] },
          { x: c.x - 4, y: c.y - 44, cards: ['wood', 'wood'] },
        ],
      };
    }
    case 'robber': {
      const hexes = [
        hex(0, 0, 'wheat', 6, { blocked: true }),
        hex(2, 0, 'ore', 3),
        hex(1, 1, 'sheep', 11),
      ];
      const robber = at(0, 0);
      return {
        hexes,
        sprites: [
          settlement(corner(0, 0, 0), 'red'),
          city(corner(0, 0, 2), 'blue'),
          { x: robber.x - S * 0.42, y: robber.y + S * 0.12, src: piece('robber'), w: 48, h: 48 },
        ],
      };
    }
    case 'longestRoad': {
      const hexes = [
        hex(0, 0, 'wood', 10),
        hex(2, 0, 'sheep', 6),
        hex(4, 0, 'wheat', 3),
        hex(1, 1, 'ore', 4),
        hex(3, 1, 'brick', 11),
      ];
      const path = [
        corner(0, 0, 5),
        corner(0, 0, 0),
        corner(2, 0, 5),
        corner(2, 0, 0),
        corner(4, 0, 5),
        corner(4, 0, 0),
      ];
      const roads = path.slice(1).map((p, i) => road(path[i], p, 'red'));
      return {
        hexes,
        sprites: [...roads, settlement(path[0], 'red')],
        labels: roads.map((r, i) => ({ x: r.x, y: r.y - 16, text: String(i + 1) })),
      };
    }
    case 'specialBuild': {
      const colors = ['red', 'blue', 'green', 'gold'];
      const sprites = colors.map((color, i) => ({
        x: i * 110,
        y: 0,
        src: piece(`knight-${color}`),
        w: 64,
        h: 64,
      }));
      return {
        viewBox: '-60 -62 450 132',
        hexes: [],
        sprites,
        arrows: [0, 1, 2].map((i) => ({ x1: i * 110 + 34, y1: 4, x2: i * 110 + 76, y2: 4 })),
        labels: [
          { x: 0, y: 54, text: 'Zug beendet' },
          { x: 110, y: 54, text: 'baut' },
          { x: 220, y: 54, text: 'baut' },
          { x: 330, y: 54, text: 'baut' },
        ],
      };
    }
    case 'ships': {
      const hexes = [hex(-2, 0, 'wood', 8), hex(-1, 1, 'sheep', 5), hex(4, 0, 'gold', 10)];
      const seaHexes = [
        at(0, 0),
        at(1, 1),
        at(2, 0),
        at(3, 1),
        at(1, -1),
        at(-1, -1),
        at(3, -1),
        at(-3, 1),
        at(5, 1),
      ];
      const route = [
        corner(0, 0, 4),
        corner(0, 0, 3),
        corner(0, 0, 2),
        corner(2, 0, 3),
        corner(2, 0, 2),
      ];
      const pirate = at(1, -1);
      return {
        sea: true,
        seaHexes,
        hexes,
        sprites: [
          ...route.slice(1).map((p, i) => ship(route[i], p, 'red')),
          settlement(route[0], 'red'),
          settlement(route[4], 'red'),
          { ...pirate, src: piece('pirate'), w: 58, h: 58 },
        ],
        badges: [{ x: route[4].x - 14, y: route[4].y - 46, cards: [], text: '+2' }],
      };
    }
    case 'metropolis':
      return {
        viewBox: '-70 -50 300 100',
        hexes: [],
        sprites: [
          { x: 0, y: 0, src: building('city-red'), w: 72, h: 72 },
          { x: 160, y: -4, src: building('metropolis-red'), w: 86, h: 86 },
        ],
        arrows: [{ x1: 48, y1: 4, x2: 104, y2: 4 }],
        labels: [{ x: 76, y: -12, text: 'Stufe 4' }],
      };
    case 'raiders': {
      const position = 4;
      const track = Array.from({ length: 7 }, (_, i) => ({
        x: i * 52,
        filled: i < position,
        attack: i === 6,
      }));
      return {
        viewBox: '-34 -64 380 112',
        hexes: [],
        track,
        sprites: [{ x: (position - 1) * 52, y: -30, src: piece('raiders'), w: 76, h: 38 }],
        labels: [{ x: 6 * 52, y: 38, text: 'Angriff' }],
      };
    }
    case 'river': {
      const hexes = [
        hex(0, 0, 'wheat', 8),
        hex(2, 0, 'wood', 5),
        hex(1, 1, 'brick', 10),
        hex(-1, 1, 'sheep', 4),
      ];
      const a = corner(0, 0, 2);
      const b = corner(0, 0, 3);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const from = at(0, 0);
      const to = at(1, 1);
      const out = { x: to.x + S * 0.9, y: to.y + S * 0.9 };
      const river =
        `M${from.x - 10},${from.y - 30} ` +
        `C${from.x + 10},${from.y + 4} ${mid.x - 30},${mid.y - 18} ${mid.x},${mid.y} ` +
        `S${to.x - 22},${to.y - 6} ${to.x},${to.y + 8} ` +
        `S${out.x - 30},${out.y - 10} ${out.x},${out.y}`;
      return {
        hexes,
        river,
        sprites: [
          onEdge(a, b, piece('bridge-red'), 0.25, 0.9),
          road(corner(0, 0, 3), corner(0, 0, 4), 'red'),
          settlement(corner(0, 0, 4), 'red'),
        ],
        badges: [{ x: mid.x + 36, y: mid.y - 22, cards: [], text: '+3' }],
      };
    }
  }
}

let nextId = 0;

@Component({
  selector: 'app-rule-scene',
  template: `
    @let m = model();
    <svg [attr.viewBox]="m.viewBox" role="img" [attr.aria-label]="label()">
      <defs>
        <radialGradient [attr.id]="uid + '-token'" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#fffaf0" />
          <stop offset="1" stop-color="#e8d7b0" />
        </radialGradient>
      </defs>

      @if (m.sea) {
        @let box = bounds();
        <image
          href="web/tiles/papiercollage/ocean.jpg"
          [attr.x]="box[0]"
          [attr.y]="box[1]"
          [attr.width]="box[2]"
          [attr.height]="box[3]"
          preserveAspectRatio="xMidYMid slice"
        />
      }
      @for (p of m.seaHexes ?? []; track $index) {
        <polygon class="sea-hex" [attr.points]="hexPoints(p)" />
      }
      @for (h of m.hexes; track $index) {
        <image
          [attr.href]="tile(h.terrain)"
          [attr.x]="h.x - 51.96"
          [attr.y]="h.y - 60"
          width="103.92"
          height="120"
        />
        <polygon class="outline" [attr.points]="hexPoints(h)" />
      }
      @if (m.river) {
        <path class="river-bed" [attr.d]="m.river" />
        <path class="river" [attr.d]="m.river" />
      }
      @for (h of m.hexes; track $index) {
        @if (h.number) {
          <g
            class="token"
            [class.red]="h.number === 6 || h.number === 8"
            [class.hit]="h.hit"
            [class.blocked]="h.blocked"
          >
            <circle class="glow" [attr.cx]="h.x" [attr.cy]="h.y + 3" r="25" />
            <circle
              class="disc"
              [attr.cx]="h.x"
              [attr.cy]="h.y + 3"
              r="18"
              [attr.fill]="'url(#' + uid + '-token)'"
            />
            <circle class="ring" [attr.cx]="h.x" [attr.cy]="h.y + 3" r="15" />
            <text [attr.x]="h.x" [attr.y]="h.y + 3">{{ h.number }}</text>
          </g>
        }
      }
      @for (t of m.track ?? []; track $index) {
        <rect
          class="step"
          [class.filled]="t.filled"
          [class.attack]="t.attack"
          [attr.x]="t.x - 22"
          y="-22"
          width="44"
          height="44"
          rx="6"
        />
        <text class="step-number" [attr.x]="t.x" y="2">{{ $index + 1 }}</text>
      }
      @for (a of m.arrows ?? []; track $index) {
        <path
          class="arrow"
          [attr.d]="'M' + a.x1 + ',' + a.y1 + ' L' + a.x2 + ',' + a.y2 + ' m-9,-7 l9,7 l-9,7'"
        />
      }
      @for (s of m.sprites; track $index) {
        <image
          [attr.href]="s.src"
          [attr.x]="-s.w / 2"
          [attr.y]="-s.h / 2"
          [attr.width]="s.w"
          [attr.height]="s.h"
          [attr.transform]="
            'translate(' + s.x + ',' + s.y + ')' + (s.angle ? ' rotate(' + s.angle + ')' : '')
          "
        />
      }
      @for (mk of m.marks ?? []; track $index) {
        @if (mk.ok) {
          <circle class="mark ok" [attr.cx]="mk.x" [attr.cy]="mk.y" r="11" />
          <path class="mark ok" [attr.d]="'M' + (mk.x - 5) + ',' + mk.y + ' l4,4 l7,-8'" />
        } @else {
          <circle class="mark no" [attr.cx]="mk.x" [attr.cy]="mk.y" r="11" />
          <path
            class="mark no"
            [attr.d]="'M' + (mk.x - 5) + ',' + (mk.y - 5) + ' l10,10 m0,-10 l-10,10'"
          />
        }
      }
      @for (b of m.badges ?? []; track $index) {
        <g class="badge" [attr.transform]="'translate(' + b.x + ',' + b.y + ')'">
          @if (b.text) {
            <circle r="16" />
            <text y="1">{{ b.text }}</text>
          } @else {
            <rect
              [attr.x]="-b.cards.length * 13 - 4"
              y="-17"
              [attr.width]="b.cards.length * 26 + 8"
              height="34"
              rx="17"
            />
            @for (c of b.cards; track $index) {
              <image
                [attr.href]="art[c]"
                [attr.x]="-b.cards.length * 13 + $index * 26"
                y="-13"
                width="26"
                height="26"
              />
            }
          }
        </g>
      }
      @for (l of m.labels ?? []; track $index) {
        <text class="label" [attr.x]="l.x" [attr.y]="l.y">{{ l.text }}</text>
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
      max-height: 190px;
      overflow: hidden;
    }
    .sea-hex {
      fill: none;
      stroke: rgb(255 255 255 / 0.22);
      stroke-width: 1.2;
    }
    .outline {
      fill: none;
      stroke: rgb(60 40 15 / 0.35);
      stroke-width: 1.2;
    }
    .river-bed {
      fill: none;
      stroke: #2d5d78;
      stroke-width: 15;
      stroke-linecap: round;
    }
    .river {
      fill: none;
      stroke: #6fb3d6;
      stroke-width: 10;
      stroke-linecap: round;
    }
    .token {
      .glow {
        fill: none;
      }
      .disc {
        stroke: #8a7550;
        stroke-width: 1.2;
      }
      .ring {
        fill: none;
        stroke: rgb(138 117 80 / 0.4);
      }
      text {
        font-size: 19px;
        font-weight: 800;
        fill: #2b2418;
        text-anchor: middle;
        dominant-baseline: central;
      }
      &.red text {
        fill: #c0281f;
      }
      &.hit .glow {
        fill: rgb(255 236 120 / 0.75);
      }
      &.blocked {
        opacity: 0.45;
      }
    }
    .step {
      fill: rgb(255 248 230 / 0.6);
      stroke: #8a6a3c;
      stroke-width: 1.5;
      &.filled {
        fill: rgb(122 31 22 / 0.18);
      }
      &.attack {
        stroke: #8e2318;
        stroke-width: 2.5;
      }
    }
    .step-number {
      font-size: 15px;
      font-weight: 800;
      fill: #6d5634;
      text-anchor: middle;
      dominant-baseline: central;
    }
    .arrow {
      fill: none;
      stroke: #7a1f16;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .mark {
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      &.no {
        fill: rgb(255 245 235 / 0.9);
        stroke: #a3261b;
      }
      &.ok {
        fill: rgb(240 255 238 / 0.9);
        stroke: #2f7a3c;
      }
      &:is(path) {
        fill: none;
      }
    }
    .badge {
      circle,
      rect {
        fill: #fdf6e3;
        stroke: #8a6a3c;
        stroke-width: 1.5;
      }
      text {
        font-size: 15px;
        font-weight: 900;
        fill: #7a1f16;
        text-anchor: middle;
        dominant-baseline: central;
      }
    }
    .label {
      font-size: 15px;
      font-weight: 800;
      fill: #4a3720;
      text-anchor: middle;
      dominant-baseline: central;
      paint-order: stroke;
      stroke: #f6ead0;
      stroke-width: 4px;
    }
  `,
})
export class RuleScene {
  readonly scene = input.required<SceneId>();
  readonly label = input('');

  protected readonly uid = `scene-${nextId++}`;
  protected readonly art = RESOURCE_ART;
  protected readonly model = computed(() => build(this.scene()));
  /** Der Ausschnitt als Zahlen, für das Meer als ein einziges Bild darunter. */
  protected readonly bounds = computed(() => this.model().viewBox.split(' ').map(Number));

  protected tile(terrain: Terrain): string {
    return `web/tiles/papiercollage/${terrain}.png`;
  }

  protected hexPoints(p: Point): string {
    return Array.from({ length: 6 }, (_, k) => {
      const a = ((-90 + 60 * k) * Math.PI) / 180;
      return `${(p.x + S * Math.cos(a)).toFixed(1)},${(p.y + S * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  }
}
