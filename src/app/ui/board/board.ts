import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { GameState, getTopology, RESOURCE_NAMES, Terrain } from '../../engine';
import { harborLabel } from '../shared/labels';
import { RESOURCE_ART } from '../shared/resource-art';
import { TerrainDefs } from './terrain-defs';
import { TILE_IMAGES } from './tile-art';
import { pieceImage } from '../shared/piece-art';

const S = 60;
/** Größe der Gebäudegrafiken in Brett-Einheiten, gilt auch für die Bauvorschau. */
const BUILDING_SIZE = { settlement: 32, city: 46 } as const;
/** Auf dem großen Brett sind die Felder kleiner, Figuren und Marken werden dort größer gezeichnet. */
const PIECE_SCALE = { base: 1, ext: 1.2 } as const;
/** Wie weit Wasser und Häfen über die Küste hinausragen, in Feldradien. */
const OCEAN_GROW = 0.8;
const HARBOR_OFFSET = 0.55;
const MAX_ZOOM = 3;
/** Ab so vielen Pixeln Bewegung wird aus einem Klick ein Verschieben. */
const DRAG_THRESHOLD = 5;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

@Component({
  selector: 'app-board',
  imports: [TerrainDefs],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  host: {
    '(wheel)': 'onWheel($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '[class.zoomed]': 'zoom() > 1',
    '[class.panning]': 'panning()',
  },
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
  protected readonly k = computed(() => PIECE_SCALE[this.game().board.layout]);

  /** Zoomstufe (1 = ganzes Brett) und Bildmitte in Brett-Einheiten, null = Brettmitte. */
  protected readonly zoom = signal(1);
  protected readonly maxZoom = MAX_ZOOM;
  private readonly center = signal<{ x: number; y: number } | null>(null);
  protected readonly panning = signal(false);
  private readonly size = signal({ w: 0, h: 0 });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number } | null = null;
  private pinchDistance = 0;
  private suppressClick = false;

  constructor() {
    const destroy = inject(DestroyRef);
    // Vor den Klick-Handlern der Bauplätze, damit Verschieben nichts baut.
    const swallow = (event: MouseEvent) => this.onClickCapture(event);
    this.host.addEventListener('click', swallow, true);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        this.size.set({ w: entry.contentRect.width, h: entry.contentRect.height });
      });
      observer.observe(this.host);
      destroy.onDestroy(() => observer.disconnect());
    });
    destroy.onDestroy(() => this.host.removeEventListener('click', swallow, true));
  }
  protected readonly ghostBuildingImage = computed(() => {
    const kind = this.ghost();
    return kind ? pieceImage(kind, this.ghostColor()) : null;
  });
  protected readonly ghostSize = computed(() => BUILDING_SIZE[this.ghost() ?? 'settlement'] * this.k());
  protected readonly ghostRoadImage = computed(() => pieceImage('road', this.ghostColor()));

  protected readonly topo = computed(() => getTopology(this.game().board.layout));

  /** Alles, was gezeichnet wird: Wasser und Häfen samt Schild, plus ein schmaler Rand. */
  private readonly bounds = computed((): Box => {
    const k = this.k();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of this.oceanPoints()) {
      xs.push(p.x);
      ys.push(p.y);
    }
    for (const h of this.harbors()) {
      xs.push(h.x - 22 * k, h.x + 22 * k);
      ys.push(h.y - 26 * k, h.y + 28 * k);
    }
    const pad = 6;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
  });

  /** Sichtbarer Ausschnitt. Beim Hineinzoomen nutzt er die ganze Fläche, auch wenn das Brett schmaler ist. */
  private readonly view = computed((): Box => {
    const b = this.bounds();
    const { w, h } = this.size();
    const zoom = this.zoom();
    if (!w || !h || zoom === 1) return b;
    const scale = Math.min(w / b.w, h / b.h) * zoom;
    const vw = w / scale;
    const vh = h / scale;
    const c = this.clampCenter(this.center(), vw, vh);
    return { x: c.x - vw / 2, y: c.y - vh / 2, w: vw, h: vh };
  });

  protected readonly viewBox = computed(() => {
    const v = this.view();
    return `${v.x} ${v.y} ${v.w} ${v.h}`;
  });

  private readonly oceanPoints = computed(() => {
    const { coast, edges } = this.topo();
    const coastVertices = coast.map((id, i) => {
      const e = edges[id];
      const next = edges[coast[(i + 1) % coast.length]];
      return e.a === next.a || e.a === next.b ? e.a : e.b;
    });
    const cx = avg(this.topo().hexes.map((h) => h.x));
    const cy = avg(this.topo().hexes.map((h) => h.y));
    return coastVertices.map((id) => {
      const v = this.topo().vertices[id];
      const dx = v.x - cx;
      const dy = v.y - cy;
      const len = Math.hypot(dx, dy);
      return { x: (v.x + (dx / len) * OCEAN_GROW) * S, y: (v.y + (dy / len) * OCEAN_GROW) * S };
    });
  });

  /** Ozean als großes Sechseck um das Brett herum. */
  protected readonly oceanPath = computed(
    () => this.oceanPoints().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z',
  );

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
        image: tileImage(state.terrain, h.id),
        // Jedes zweite Feld gespiegelt, damit gleiche Gelände nicht wie gestempelt aussehen.
        transform: `translate(${(h.x * S).toFixed(1)},${(h.y * S).toFixed(1)})${h.id % 2 ? ' scale(-1,1)' : ''}`,
        number,
        // Marke und Räuber wachsen um ihren eigenen Mittelpunkt.
        tokenTransform: scaleAround(h.x * S, h.y * S + S * 0.05, this.k()),
        robberTransform: `translate(${h.x * S + S * 0.42 * this.k()},${h.y * S + S * 0.1}) scale(${this.k()})`,
        red: number === 6 || number === 8,
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
      const x = (mx + (dx / len) * HARBOR_OFFSET) * S;
      const y = (my + (dy / len) * HARBOR_OFFSET) * S;
      return {
        x,
        y,
        transform: `translate(${x},${y}) scale(${this.k()})`,
        ax: a.x * S,
        ay: a.y * S,
        bx: b.x * S,
        by: b.y * S,
        label: harborLabel(harbor.type),
        image: harbor.type === 'any' ? null : RESOURCE_ART[harbor.type],
        title: harbor.type === 'any' ? 'Hafen 3:1 – alle Rohstoffe' : `Hafen 2:1 ${RESOURCE_NAMES[harbor.type]}`,
      };
    }),
  );

  protected readonly roads = computed(() => {
    const g = this.game();
    return g.roads.flatMap((owner, id) => {
      if (owner === null) return [];
      const player = g.players[owner];
      return [{
        id, ...this.edgeLine(id, 0.08), color: player.color,
        image: pieceImage('road', player.color), title: `${player.name}: Straße`,
      }];
    });
  });

  protected readonly buildings = computed(() => {
    const g = this.game();
    return g.buildings.flatMap((b, id) => {
      if (!b) return [];
      const v = this.topo().vertices[id];
      const player = g.players[b.owner];
      return [{
        id, x: v.x * S, y: v.y * S, city: b.type === 'city', color: player.color,
        size: BUILDING_SIZE[b.type] * this.k(), image: pieceImage(b.type, player.color),
        title: `${player.name}: ${b.type === 'city' ? 'Stadt' : 'Siedlung'}`,
      }];
    });
  });

  protected readonly vertexSpots = computed(() =>
    this.vertexTargets().map((id) => {
      const v = this.topo().vertices[id];
      return { id, x: v.x * S, y: v.y * S };
    }),
  );

  protected readonly edgeSpots = computed(() => this.edgeTargets().map((id) => ({ id, ...this.edgeLine(id, 0.08) })));

  protected readonly hexSpots = computed(() => {
    const targets = new Set(this.hexTargets());
    return this.hexes().filter((h) => targets.has(h.id));
  });

  zoomBy(factor: number, at?: { x: number; y: number }): void {
    const before = this.view();
    const zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom() * factor));
    if (zoom === this.zoom()) return;
    const { w, h } = this.size();
    // Der Punkt unter dem Zeiger bleibt beim Zoomen an seiner Stelle.
    const fx = at && w ? at.x / w : 0.5;
    const fy = at && h ? at.y / h : 0.5;
    const ux = before.x + fx * before.w;
    const uy = before.y + fy * before.h;
    this.zoom.set(zoom);
    const after = this.view();
    this.center.set(this.clampCenter({ x: ux - (fx - 0.5) * after.w, y: uy - (fy - 0.5) * after.h }, after.w, after.h));
  }

  resetZoom(): void {
    this.zoom.set(1);
    this.center.set(null);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    // Trackpad-Pinch meldet sich als Wheel mit ctrlKey und kleinen Schritten.
    const speed = event.ctrlKey ? 0.01 : 0.0015;
    this.zoomBy(Math.exp(-event.deltaY * speed), this.local(event));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointers.set(event.pointerId, this.local(event));
    if (this.pointers.size === 1) this.dragStart = this.local(event);
    if (this.pointers.size === 2) this.pinchDistance = this.pointerDistance();
  }

  protected onPointerMove(event: PointerEvent): void {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    const at = this.local(event);
    this.pointers.set(event.pointerId, at);

    if (this.pointers.size === 2) {
      const distance = this.pointerDistance();
      if (this.pinchDistance) this.zoomBy(distance / this.pinchDistance, this.pointerMidpoint());
      this.pinchDistance = distance;
      this.startPanning(event);
      return;
    }
    if (!this.panning()) {
      const start = this.dragStart;
      if (this.zoom() === 1 || !start || Math.hypot(at.x - start.x, at.y - start.y) < DRAG_THRESHOLD) return;
      this.startPanning(event);
    }
    const v = this.view();
    const unit = v.w / this.size().w;
    const c = { x: v.x + v.w / 2 - (at.x - prev.x) * unit, y: v.y + v.h / 2 - (at.y - prev.y) * unit };
    this.center.set(this.clampCenter(c, v.w, v.h));
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.pinchDistance = 0;
    if (this.pointers.size) return;
    this.dragStart = null;
    if (this.panning()) {
      this.panning.set(false);
      // Der Klick am Ende des Verschiebens soll nichts bauen.
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    }
  }

  private onClickCapture(event: MouseEvent): void {
    if (!this.suppressClick) return;
    event.stopPropagation();
    this.suppressClick = false;
  }

  private startPanning(event: PointerEvent): void {
    if (this.panning()) return;
    this.panning.set(true);
    this.host.setPointerCapture?.(event.pointerId);
  }

  private local(event: MouseEvent): { x: number; y: number } {
    const r = this.host.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pointerMidpoint(): { x: number; y: number } {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Hält den Ausschnitt auf dem Brett; ist er breiter als das Brett, bleibt das Brett mittig. */
  private clampCenter(c: { x: number; y: number } | null, vw: number, vh: number): { x: number; y: number } {
    const b = this.bounds();
    const clamp = (value: number, min: number, size: number, view: number) =>
      view >= size ? min + size / 2 : Math.min(min + size - view / 2, Math.max(min + view / 2, value));
    const p = c ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    return { x: clamp(p.x, b.x, b.w, vw), y: clamp(p.y, b.y, b.h, vh) };
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
    const length = Math.hypot(b.x - a.x, b.y - a.y) * S * (1 - 2 * inset);
    // A horizontal sprite rotates around the edge midpoint; buildings stay upright.
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    return {
      length,
      height: length / 4,
      transform: `translate(${(a.x + b.x) * S / 2},${(a.y + b.y) * S / 2}) rotate(${angle})`,
      x1: lerp(a.x, b.x, inset),
      y1: lerp(a.y, b.y, inset),
      x2: lerp(a.x, b.x, 1 - inset),
      y2: lerp(a.y, b.y, 1 - inset),
    };
  }
}

/** Eigene Grafik für dieses Feld, Varianten reihum verteilt. */
function tileImage(terrain: Terrain, hexId: number): string | null {
  const variants = TILE_IMAGES[terrain];
  return variants?.length ? variants[hexId % variants.length] : null;
}

function scaleAround(x: number, y: number, k: number): string {
  return k === 1 ? '' : `translate(${x},${y}) scale(${k}) translate(${-x},${-y})`;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
