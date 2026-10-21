import { Component, computed, input, output } from '@angular/core';
import { GameState, getTopology, RESOURCE_NAMES } from '../../engine';
import { harborLabel, RESOURCE_ICONS } from '../shared/labels';
import { TerrainDefs } from './terrain-defs';

const S = 60;

@Component({
  selector: 'app-board',
  imports: [TerrainDefs],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  readonly game = input.required<GameState>();
  readonly vertexTargets = input<number[]>([]);
  readonly edgeTargets = input<number[]>([]);
  readonly hexTargets = input<number[]>([]);
  /** Felder mit dieser Zahl leuchten kurz auf (nach dem Würfeln). */
  readonly highlightNumber = input<number | null>(null);
  /** Was beim Darüberfahren als Vorschau in der eigenen Farbe erscheint. */
  readonly ghost = input<'settlement' | 'city' | null>(null);
  readonly ghostColor = input('#ffffff');
  readonly vertexPick = output<number>();
  readonly edgePick = output<number>();
  readonly hexPick = output<number>();

  protected readonly S = S;

  protected readonly topo = computed(() => getTopology(this.game().board.layout));

  protected readonly viewBox = computed(() => {
    const vs = this.topo().vertices;
    const xs = vs.map((v) => v.x * S);
    const ys = vs.map((v) => v.y * S);
    const pad = S * 1.15;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`;
  });

  /** Ozean als großes Sechseck um das Brett herum. */
  protected readonly oceanPath = computed(() => {
    const { coast, edges } = this.topo();
    const coastVertices = coast.map((id, i) => {
      const e = edges[id];
      const next = edges[coast[(i + 1) % coast.length]];
      return e.a === next.a || e.a === next.b ? e.a : e.b;
    });
    const cx = avg(this.topo().hexes.map((h) => h.x));
    const cy = avg(this.topo().hexes.map((h) => h.y));
    const grow = 0.95;
    return (
      coastVertices
        .map((id, i) => {
          const v = this.topo().vertices[id];
          const dx = v.x - cx;
          const dy = v.y - cy;
          const len = Math.hypot(dx, dy);
          const x = (v.x + (dx / len) * grow) * S;
          const y = (v.y + (dy / len) * grow) * S;
          return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ') + ' Z'
    );
  });

  protected readonly hexes = computed(() => {
    const g = this.game();
    return this.topo().hexes.map((h) => {
      const state = g.board.hexes[h.id];
      const number = state.number;
      return {
        id: h.id,
        x: h.x * S,
        y: h.y * S,
        points: h.corners.map((c) => this.point(c)).join(' '),
        terrain: state.terrain,
        // Jedes zweite Feld gespiegelt, damit gleiche Gelände nicht wie gestempelt aussehen.
        transform: `translate(${(h.x * S).toFixed(1)},${(h.y * S).toFixed(1)})${h.id % 2 ? ' scale(-1,1)' : ''}`,
        number,
        red: number === 6 || number === 8,
        pips: number ? 6 - Math.abs(7 - number) : 0,
        robber: g.robber === h.id,
        hit: number !== null && number === this.highlightNumber(),
      };
    });
  });

  protected readonly harbors = computed(() =>
    this.game().board.harbors.map((harbor) => {
      const e = this.topo().edges[harbor.edge];
      const hex = this.topo().hexes[e.hexes[0]];
      const a = this.topo().vertices[e.a];
      const b = this.topo().vertices[e.b];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = mx - hex.x;
      const dy = my - hex.y;
      const len = Math.hypot(dx, dy);
      const x = (mx + (dx / len) * 0.62) * S;
      const y = (my + (dy / len) * 0.62) * S;
      return {
        x,
        y,
        ax: a.x * S,
        ay: a.y * S,
        bx: b.x * S,
        by: b.y * S,
        label: harborLabel(harbor.type),
        icon: harbor.type === 'any' ? '?' : RESOURCE_ICONS[harbor.type],
        title: harbor.type === 'any' ? 'Hafen 3:1' : `Hafen 2:1 ${RESOURCE_NAMES[harbor.type]}`,
      };
    }),
  );

  protected readonly roads = computed(() => {
    const g = this.game();
    return g.roads.flatMap((owner, id) => (owner === null ? [] : [{ id, ...this.edgeLine(id, 0.14), color: g.players[owner].color }]));
  });

  protected readonly buildings = computed(() => {
    const g = this.game();
    return g.buildings.flatMap((b, id) => {
      if (!b) return [];
      const v = this.topo().vertices[id];
      return [{ id, x: v.x * S, y: v.y * S, city: b.type === 'city', color: g.players[b.owner].color }];
    });
  });

  protected readonly vertexSpots = computed(() =>
    this.vertexTargets().map((id) => {
      const v = this.topo().vertices[id];
      return { id, x: v.x * S, y: v.y * S };
    }),
  );

  protected readonly edgeSpots = computed(() => this.edgeTargets().map((id) => ({ id, ...this.edgeLine(id, 0.2) })));

  protected readonly hexSpots = computed(() => {
    const targets = new Set(this.hexTargets());
    return this.hexes().filter((h) => targets.has(h.id));
  });

  protected pipsArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  private point(vertex: number): string {
    const v = this.topo().vertices[vertex];
    return `${(v.x * S).toFixed(1)},${(v.y * S).toFixed(1)}`;
  }

  private edgeLine(edge: number, inset: number) {
    const e = this.topo().edges[edge];
    const a = this.topo().vertices[e.a];
    const b = this.topo().vertices[e.b];
    const lerp = (p: number, q: number, t: number) => (p + (q - p) * t) * S;
    return {
      x1: lerp(a.x, b.x, inset),
      y1: lerp(a.y, b.y, inset),
      x2: lerp(a.x, b.x, 1 - inset),
      y2: lerp(a.y, b.y, 1 - inset),
    };
  }
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
