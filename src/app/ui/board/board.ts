import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, linkedSignal, output, signal } from '@angular/core';
import { GameState, getTopology, LAKE_NUMBERS, mapById, NEIGHBOR_STEPS, RESOURCE_NAMES, Terrain, Topology, TRACK_NAMES, TRACKS } from '../../engine';
import { harborLabel } from '../shared/labels';
import { RESOURCE_ART } from '../shared/resource-art';
import { TerrainDefs } from './terrain-defs';
import { TILE_IMAGES } from './tile-art';
import { pieceImage } from '../shared/piece-art';

const S = 60;
/** Größe der Gebäudegrafiken in Brett-Einheiten, gilt auch für die Bauvorschau. */
const BUILDING_SIZE = { settlement: 40, city: 58 } as const;
/** Auf großen Brettern sind die Felder kleiner, Figuren und Marken werden dort größer gezeichnet. */
const PIECE_SCALE = { base: 1, ext: 1.2 } as const;
const MAX_PIECE_SCALE = 1.4;
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
  protected readonly k = computed(() => {
    const layout = this.game().board.layout;
    if (layout) return PIECE_SCALE[layout];
    // Andere Karten: nach der Ausdehnung, die im Querformat die Größe begrenzt (19 Felder = 1, 30 Felder = 1,2).
    const hexes = this.topo().hexes;
    const width = (Math.max(...hexes.map((h) => h.x)) - Math.min(...hexes.map((h) => h.x)) + Math.sqrt(3)) / 1.6;
    const height = Math.max(...hexes.map((h) => h.y)) - Math.min(...hexes.map((h) => h.y)) + 2;
    const extent = Math.max(width, height);
    return Math.min(MAX_PIECE_SCALE, Math.max(1, 1 + ((extent - 8) * 0.2) / 3));
  });

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
  protected readonly ghostShipImage = computed(() => pieceImage('ship', this.ghostColor()));
  /** Was im Baumodus an Kanten als Vorschau erscheint: Straße oder Schiff. */
  readonly edgeGhost = input<'road' | 'ship'>('road');

  protected readonly topo = computed(() => getTopology(this.game().board));

  /** Im Dunst: Felder, die mit dem letzten Stand aus dem Nebel kamen, für die Umdreh-Animation. */
  private readonly revealed = linkedSignal<GameState, Set<number>>({
    source: this.game,
    computation: (game, previous) => {
      const before = previous?.source.board.hexes;
      if (!before || before.length !== game.board.hexes.length) return new Set();
      return new Set(game.board.hexes.flatMap((h, i) => (before[i].terrain === 'fog' && h.terrain !== 'fog' ? [i] : [])));
    },
  });
  private readonly map = computed(() => mapById(this.game().board.map));

  /** Alles, was gezeichnet wird: Wasser und Häfen samt Schild, plus ein schmaler Rand. */
  private readonly bounds = computed((): Box => {
    const k = this.k();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of this.ocean().points) {
      xs.push(p.x);
      ys.push(p.y);
    }
    for (const h of [...this.harbors(), ...this.fishingGrounds()]) {
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

  /**
   * Meer: Beim klassischen Brett ein großes Sechseck wie gewohnt. Bei anderen Karten folgt es der Form
   * (Land plus ein Feld Rand, Buchten und Seen gefüllt, weich gerundet) oder ist eine Seekarte als Rechteck.
   */
  private readonly ocean = computed((): { path: string; points: { x: number; y: number }[] } => {
    const topo = this.topo();
    if (this.game().board.layout || this.map().id === 'klassisch') {
      const points = classicOcean(topo);
      return { path: toPath(points), points };
    }
    const water = getTopology({ cells: waterCells(topo) });
    const loops = water.coastLoops.filter((l) => !l.lake).map((l) => chaikin(loopPoints(water, l.edges), 3));
    const all = loops.flat();
    if (this.map().sea !== 'rect') return { path: loops.map(toPath).join(' '), points: all };
    const pad = 10;
    const x = Math.min(...all.map((p) => p.x)) - pad;
    const y = Math.min(...all.map((p) => p.y)) - pad;
    const X = Math.max(...all.map((p) => p.x)) + pad;
    const Y = Math.max(...all.map((p) => p.y)) + pad;
    const r = 40;
    return {
      path: `M${x + r},${y}H${X - r}Q${X},${y} ${X},${y + r}V${Y - r}Q${X},${Y} ${X - r},${Y}H${x + r}Q${x},${Y} ${x},${Y - r}V${y + r}Q${x},${y} ${x + r},${y}Z`,
      points: [
        { x, y },
        { x: X, y: Y },
      ],
    };
  });

  protected readonly oceanPath = computed(() => this.ocean().path);

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
        sea: state.terrain === 'sea',
        fog: state.terrain === 'fog',
        lake: state.terrain === 'lake',
        revealed: this.revealed().has(h.id),
        image: tileImage(state.terrain, h.id),
        // Jedes zweite Feld gespiegelt, damit gleiche Gelände nicht wie gestempelt aussehen.
        transform: `translate(${(h.x * S).toFixed(1)},${(h.y * S).toFixed(1)})${h.id % 2 ? ' scale(-1,1)' : ''}`,
        number,
        // Marke und Räuber wachsen um ihren eigenen Mittelpunkt.
        tokenTransform: scaleAround(h.x * S, h.y * S + S * 0.05, this.k()),
        robberTransform: `translate(${h.x * S + S * 0.42 * this.k()},${h.y * S + S * 0.1}) scale(${this.k()})`,
        red: number === 6 || number === 8,
        robber: g.robber === h.id,
        hit:
          (number !== null && number === this.highlightNumber()) ||
          (state.terrain === 'lake' && LAKE_NUMBERS.includes(this.highlightNumber() ?? 0)),
      };
    });
  });

  /**
   * Punkt vor einer Küstenkante, auf der Wasserseite, dazu die beiden Ecken. Mit `awayFrom` rückt der Punkt
   * von dieser Ecke weg und weiter hinaus, damit er ein Hafenschild an derselben Ecke nicht verdeckt.
   */
  private coastSpot(edge: number, awayFrom: number | null = null) {
    const e = this.topo().edges[edge];
    const hex = this.topo().hexes[e.hexes.find((h) => !this.topo().hexes[h].sea) ?? e.hexes[0]];
    const a = this.topo().vertices[e.a];
    const b = this.topo().vertices[e.b];
    let mx = (a.x + b.x) / 2;
    let my = (a.y + b.y) / 2;
    const len = Math.hypot(mx - hex.x, my - hex.y);
    let out = HARBOR_OFFSET;
    if (awayFrom !== null) {
      const [from, to] = awayFrom === e.a ? [a, b] : [b, a];
      mx += (to.x - from.x) * 0.35;
      my += (to.y - from.y) * 0.35;
      out = HARBOR_OFFSET + 0.3;
    }
    const x = (mx + ((mx - hex.x) / len) * out) * S;
    const y = (my + ((my - hex.y) / len) * out) * S;
    return { x, y, ax: a.x * S, ay: a.y * S, bx: b.x * S, by: b.y * S, transform: `translate(${x},${y}) scale(${this.k()})` };
  }

  /** Fischgründe (Variante): Plättchen mit Zahl vor der Küste, leuchten bei einem Treffer auf. */
  protected readonly fishingGrounds = computed(() => {
    const topo = this.topo();
    const harborCorners = new Set(this.game().board.harbors.flatMap((h) => [topo.edges[h.edge].a, topo.edges[h.edge].b]));
    return (this.game().board.fishing ?? []).map((f) => ({
      ...this.coastSpot(f.edge, [topo.edges[f.edge].a, topo.edges[f.edge].b].find((v) => harborCorners.has(v)) ?? null),
      number: f.number,
      red: f.number === 6 || f.number === 8,
      hit: f.number === this.highlightNumber(),
      title: `Fischgrund ${f.number}: Siedlungen an den beiden Ecken fangen 1 Fisch, Städte 2`,
    }));
  });

  protected readonly harbors = computed(() =>
    this.game().board.harbors.map((harbor) => {
      const e = this.topo().edges[harbor.edge];
      // Das Landfeld der Kante (bei Seewege liegt auf der anderen Seite ein Meerfeld).
      const hex = this.topo().hexes[e.hexes.find((h) => !this.topo().hexes[h].sea) ?? e.hexes[0]];
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
    const riverEdges = new Set((g.board.rivers ?? []).flatMap((r) => r.edges));
    return g.roads.flatMap((owner, id) => {
      if (owner === null) return [];
      const player = g.players[owner];
      const bridge = riverEdges.has(id);
      return [{
        id, ...this.edgeLine(id, 0.08), color: player.color, bridge,
        image: pieceImage('road', player.color), title: `${player.name}: ${bridge ? 'Brücke' : 'Straße'}`,
      }];
    });
  });

  /** Umrisse aller Landfelder: Flüsse enden genau an der Küste und ragen nicht ins Meer. */
  protected readonly landOutline = computed(() => this.hexes().filter((h) => !h.sea && !h.fog).map((h) => h.points));

  /**
   * Flussläufe: je Fluss ein gewundener Lauf von der Quelle bis zur Küste, schmal an der Quelle und als
   * Trichter an der Mündung. Gezeichnet zwischen Gelände und Zahlen, mit Ufer, Schatten und Papierstruktur.
   */
  protected readonly riverShapes = computed(() =>
    (this.game().board.rivers ?? []).map((river, i) => {
      const { points, widths } = riverLine(this.topo(), river);
      const spring = points[0];
      return {
        id: i,
        clip: `river-clip-${i}`,
        meadow: ribbon(points, widths.map((w) => w + 22)),
        bank: ribbon(points, widths.map((w) => w + 8)),
        water: ribbon(points, widths),
        shine: points
          .slice(2, -2)
          .map((p, k) => `${k ? 'L' : 'M'}${(p.x - 0.8).toFixed(1)},${(p.y - 1).toFixed(1)}`)
          .join(' '),
        spring: { x: spring.x, y: spring.y, r: widths[0] * 1.1 + 2 },
      };
    }),
  );

  /** Seewege: Schiffe liegen quer auf ihrer Kante wie Straßen, gedreht nach der Kante. */
  protected readonly ships = computed(() => {
    const g = this.game();
    return (g.ships ?? []).flatMap((owner, id) => {
      if (owner === null) return [];
      const player = g.players[owner];
      const line = this.edgeLine(id, 0.08);
      // Schiff aus der Draufsicht, Bug in Kantenrichtung; Bild im Seitenverhältnis 2:1.
      const width = line.length * 1.05 * this.k();
      return [{
        id, transform: `${line.transform} scale(${this.k()})`, color: player.color, title: `${player.name}: Schiff`,
        image: pieceImage('ship', player.color), imageTransform: line.transform, width, height: width / 2,
      }];
    });
  });

  protected readonly pirate = computed(() => {
    const g = this.game();
    if (g.pirate == null) return null;
    const h = this.topo().hexes[g.pirate];
    return { transform: `translate(${h.x * S},${h.y * S}) scale(${1.25 * this.k()})`, x: h.x * S, y: h.y * S, size: 54 * this.k() };
  });

  /** Stadtwacht: Wächter auf Ecken, Stufe als Ringe, ruhende Wächter gedämpft. */
  protected readonly guards = computed(() => {
    const g = this.game();
    return (g.guards ?? []).flatMap((guard, id) => {
      if (!guard) return [];
      const v = this.topo().vertices[id];
      const player = g.players[guard.owner];
      const level = ['einfacher', 'erfahrener', 'mächtiger'][guard.level - 1];
      return [{
        id, x: v.x * S, y: v.y * S, color: player.color, level: guard.level, active: guard.active,
        r: 11 * this.k(), rings: Array.from({ length: guard.level }, (_, i) => i),
        title: `${player.name}: ${level} Wächter, ${guard.active ? 'einsatzbereit' : 'ruht'}`,
      }];
    });
  });

  protected readonly buildings = computed(() => {
    const g = this.game();
    return g.buildings.flatMap((b, id) => {
      if (!b) return [];
      const v = this.topo().vertices[id];
      const player = g.players[b.owner];
      // Stadtwacht: Palisade unter der Stadt, Prachtstadt mit einem Abzeichen in der Farbe der Richtung.
      const metro = TRACKS.find((t) => g.metropolis?.[t] === id) ?? null;
      const wall = g.walls?.includes(id) ?? false;
      const what = metro ? `Prachtstadt ${TRACK_NAMES[metro]}` : b.type === 'city' ? 'Stadt' : 'Siedlung';
      return [{
        id, x: v.x * S, y: v.y * S, city: b.type === 'city', color: player.color,
        size: BUILDING_SIZE[b.type] * this.k(), image: pieceImage(b.type, player.color),
        title: `${player.name}: ${what}${wall ? ' mit Palisade' : ''}`,
        wall, metro, metroLabel: metro ? TRACK_NAMES[metro][0] : '',
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

/** Klassisches Meer: jede Küstenecke vom Schwerpunkt aus ein Stück nach außen. */
function classicOcean(topo: Topology): { x: number; y: number }[] {
  const { coast, edges } = topo;
  const cx = avg(topo.hexes.map((h) => h.x));
  const cy = avg(topo.hexes.map((h) => h.y));
  return coast.map((id, i) => {
    const e = edges[id];
    const next = edges[coast[(i + 1) % coast.length]];
    const v = topo.vertices[e.a === next.a || e.a === next.b ? e.a : e.b];
    const dx = v.x - cx;
    const dy = v.y - cy;
    const len = Math.hypot(dx, dy);
    return { x: (v.x + (dx / len) * OCEAN_GROW) * S, y: (v.y + (dy / len) * OCEAN_GROW) * S };
  });
}

/** Wasserfläche: Land plus ein Feld Rand und Seen; schmale Kerben und eingeschlossene Lücken gefüllt. */
function waterCells(topo: Topology): [number, number][] {
  const key = (c: number, r: number) => `${c},${r}`;
  const area = new Set<string>();
  for (const h of topo.hexes) {
    area.add(key(h.c, h.r));
    for (const [dc, dr] of NEIGHBOR_STEPS) area.add(key(h.c + dc, h.r + dr));
  }
  for (const k of topo.water.lake) area.add(k);
  const cs = topo.hexes.map((h) => h.c);
  const rs = topo.hexes.map((h) => h.r);
  const minC = Math.min(...cs) - 6;
  const maxC = Math.max(...cs) + 6;
  const minR = Math.min(...rs) - 3;
  const maxR = Math.max(...rs) + 3;
  const parity = (topo.hexes[0].c + topo.hexes[0].r) & 1;
  const grid: [number, number][] = [];
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) if (((c + r) & 1) === parity) grid.push([c, r]);
  const around = (c: number, r: number) => NEIGHBOR_STEPS.filter(([dc, dr]) => area.has(key(c + dc, r + dr))).length;
  for (let pass = 0; pass < 2; pass++) {
    grid.filter(([c, r]) => !area.has(key(c, r)) && around(c, r) >= 4).forEach(([c, r]) => area.add(key(c, r)));
  }
  const outside = new Set([key(...grid[0])]);
  const stack = [grid[0]];
  const inBox = (c: number, r: number) => c >= minC && c <= maxC && r >= minR && r <= maxR;
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of NEIGHBOR_STEPS) {
      const k = key(c + dc, r + dr);
      if (!inBox(c + dc, r + dr) || outside.has(k) || area.has(k)) continue;
      outside.add(k);
      stack.push([c + dc, r + dr]);
    }
  }
  for (const [c, r] of grid) if (!outside.has(key(c, r))) area.add(key(c, r));
  return [...area].map((k) => k.split(',').map(Number) as [number, number]);
}

function loopPoints(topo: Topology, loop: number[]): { x: number; y: number }[] {
  return loop.map((id, i) => {
    const e = topo.edges[id];
    const next = topo.edges[loop[(i + 1) % loop.length]];
    const v = topo.vertices[e.a === next.a || e.a === next.b ? e.a : e.b];
    return { x: v.x * S, y: v.y * S };
  });
}

/** Ecken weich runden (Chaikin). */
type Pt = { x: number; y: number };

/**
 * Mittellinie eines Flusses in Brett-Einheiten: je Feld eine S-Kurve zwischen den Kantenmitten, die an
 * den Kantenmitten (dort liegen die Brücken) und in der Feldmitte die gerade Linie kreuzt. Dazu die
 * Breite je Punkt: schmal an der Quelle, breiter zur Küste, an der Mündung fächert der Fluss auf.
 */
function riverLine(topo: Topology, river: { hexes: number[]; edges: number[] }): { points: Pt[]; widths: number[] } {
  const center = (h: number): Pt => ({ x: topo.hexes[h].x * S, y: topo.hexes[h].y * S });
  const mid = (e: number): Pt => {
    const { a, b } = topo.edges[e];
    return { x: ((topo.vertices[a].x + topo.vertices[b].x) / 2) * S, y: ((topo.vertices[a].y + topo.vertices[b].y) / 2) * S };
  };
  const points: Pt[] = [];
  const STEPS = 14;
  river.hexes.forEach((h, i) => {
    const c = center(h);
    const a = i === 0 ? c : mid(river.edges[i - 1]);
    const b = mid(river.edges[i]);
    const ctrl = i === 0 ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : c;
    // Fester Schwung je Feld, damit der Lauf bei jedem Neuzeichnen gleich aussieht.
    const amp = S * (0.12 + 0.03 * (h % 3)) * (h % 2 ? 1 : -1);
    for (let k = i === 0 ? 0 : 1; k <= STEPS; k++) {
      const t = k / STEPS;
      const u = 1 - t;
      const p = { x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y };
      const tx = 2 * u * (ctrl.x - a.x) + 2 * t * (b.x - ctrl.x);
      const ty = 2 * u * (ctrl.y - a.y) + 2 * t * (b.y - ctrl.y);
      const len = Math.hypot(tx, ty) || 1;
      const off = amp * Math.sin(2 * Math.PI * t);
      points.push({ x: p.x - (ty / len) * off, y: p.y + (tx / len) * off });
    }
  });
  const inland = points.length;
  // Ein kurzes Stück über die Küste hinaus; das schneidet die Landmaske genau an der Küstenlinie ab.
  const last = points[points.length - 1];
  const c = center(river.hexes[river.hexes.length - 1]);
  const out = { x: last.x - c.x, y: last.y - c.y };
  const outLen = Math.hypot(out.x, out.y);
  for (let k = 1; k <= 2; k++) points.push({ x: last.x + (out.x / outLen) * S * 0.1 * k, y: last.y + (out.y / outLen) * S * 0.1 * k });
  // Breite: schmal an der Quelle, langsam breiter, auf dem letzten Stück ein Trichter zum Meer hin.
  const flare = Math.floor(STEPS * 0.6);
  const widths = points.map((_, i) => {
    const base = 4.5 + 6.5 * Math.min(1, i / (inland - 1));
    const f = Math.max(0, (i - (inland - 1 - flare)) / flare);
    return base + 14 * f * f;
  });
  return { points, widths };
}

/** Umriss eines Bands entlang der Punkte mit der jeweiligen Breite, als geschlossener Pfad. */
function ribbon(points: Pt[], widths: number[]): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = widths[i] / 2;
    left.push({ x: p.x + nx * half, y: p.y + ny * half });
    right.push({ x: p.x - nx * half, y: p.y - ny * half });
  });
  return toPath([...left, ...right.reverse()]);
}

function chaikin(points: { x: number; y: number }[], rounds: number): { x: number; y: number }[] {
  let p = points;
  for (let k = 0; k < rounds; k++) {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    p = out;
  }
  return p;
}

function toPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
