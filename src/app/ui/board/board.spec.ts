import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, GameState, getTopology } from '../../engine';
import { PLAYER_COLORS } from '../../net/protocol';
import { Board } from './board';

function fixtureGame(): GameState {
  const game = createGame(PLAYER_COLORS.map((color, i) => ({
    id: String(i), name: color.name, color: color.hex,
  })), { victoryPoints: 10 }, 123);
  for (let seat = 0; seat < PLAYER_COLORS.length; seat++) {
    game.buildings[seat * 2] = { owner: seat, type: 'settlement' };
    game.buildings[seat * 2 + 1] = { owner: seat, type: 'city' };
  }
  game.roads = game.roads.map((_, i) => i % PLAYER_COLORS.length);
  return game;
}

describe('Papierfiguren auf dem Brett', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Board] }).compileComponents();
  });

  function render(game = fixtureGame()) {
    const fixture = TestBed.createComponent(Board);
    fixture.componentRef.setInput('game', game);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, game };
  }

  it('zeigt Stadt, Siedlung und Straßen für alle acht Lobbyfarben', () => {
    const { element, game } = render();
    for (const color of ['red', 'blue', 'white', 'orange', 'green', 'black', 'pink', 'purple']) {
      expect(element.querySelectorAll(`.building image[href$="city-${color}.png"]`)).toHaveLength(1);
      expect(element.querySelectorAll(`.building image[href$="settlement-${color}.png"]`)).toHaveLength(1);
      expect(element.querySelector(`.road image[href$="road-${color}.png"]`)).not.toBeNull();
    }
    expect(element.querySelectorAll('.road image')).toHaveLength(game.roads.length);
    expect(element.querySelectorAll('.building path')).toHaveLength(0);
  });

  it('zentriert und dreht jede Straße entlang ihrer tatsächlichen Brettkante', () => {
    const { element, game } = render();
    const topology = getTopology(game.board);
    const angles = new Set<number>();
    for (const road of element.querySelectorAll<SVGGElement>('.road')) {
      const edge = topology.edges[Number(road.dataset['edge'])];
      const a = topology.vertices[edge.a], b = topology.vertices[edge.b];
      const transform = road.querySelector('image')!.getAttribute('transform')!;
      const values = transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
      expect(values[0]).toBeCloseTo((a.x + b.x) * 30);
      expect(values[1]).toBeCloseTo((a.y + b.y) * 30);
      const radians = values[2] * Math.PI / 180;
      expect(Math.cos(radians) * (b.y - a.y) - Math.sin(radians) * (b.x - a.x)).toBeCloseTo(0);
      angles.add(Math.round((values[2] + 360) % 180));
    }
    expect(angles.size).toBeGreaterThanOrEqual(3);
  });

  it('erhält die anklickbaren Flächen für Bauvorschauen und emittiert die richtigen IDs', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('vertexTargets', [4]);
    fixture.componentRef.setInput('edgeTargets', [8]);
    fixture.componentRef.setInput('ghost', 'settlement');
    fixture.componentRef.setInput('ghostColor', '#2f64d6');
    fixture.detectChanges();

    expect(element.querySelector('.vertex-target image')!.getAttribute('href')).toContain('settlement-blue.png');
    expect(element.querySelector('.edge-target image')!.getAttribute('href')).toContain('road-blue.png');
    const vertices: number[] = [], edges: number[] = [];
    fixture.componentInstance.vertexPick.subscribe(id => vertices.push(id));
    fixture.componentInstance.edgePick.subscribe(id => edges.push(id));
    element.querySelector('.vertex-target .hit')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.querySelector('.edge-target .hit')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(vertices).toEqual([4]);
    expect(edges).toEqual([8]);

    fixture.componentRef.setInput('ghost', 'city');
    fixture.componentRef.setInput('ghostColor', '#d23c3c');
    fixture.detectChanges();
    expect(element.querySelector('.vertex-target image')!.getAttribute('href')).toContain('city-red.png');
    expect(element.querySelector('.edge-target image')!.getAttribute('href')).toContain('road-red.png');
  });

  it('behält für unbekannte gespeicherte Farben die ursprüngliche SVG-Darstellung bei', () => {
    const game = fixtureGame();
    game.players[0].color = '#123456';
    const { fixture, element } = render(game);
    expect(element.querySelector('.building[data-vertex="0"] path')!.getAttribute('fill')).toBe('#123456');
    expect(element.querySelector('.road[data-edge="0"] .road-fill')!.getAttribute('stroke')).toBe('#123456');
    expect(element.querySelector('.building[data-vertex="0"] image')).toBeNull();

    fixture.componentRef.setInput('vertexTargets', [0]);
    fixture.componentRef.setInput('edgeTargets', [0]);
    fixture.componentRef.setInput('ghost', 'city');
    fixture.componentRef.setInput('ghostColor', '#123456');
    fixture.detectChanges();
    expect(element.querySelector('.vertex-target path')!.getAttribute('fill')).toBe('#123456');
    expect(element.querySelector('.edge-target line.ghost-road')!.getAttribute('stroke')).toBe('#123456');
  });

  it('zeigt eine neue Stadt auch nach einem reaktiven Spielstandwechsel auf dem Basisbrett', () => {
    const game = createGame(PLAYER_COLORS.slice(0, 4).map((p, i) => ({
      id: String(i), name: p.name, color: p.hex,
    })), { victoryPoints: 10 }, 1);
    game.buildings[0] = { owner: game.players.findIndex(p => p.color === '#d23c3c'), type: 'settlement' };
    const { fixture, element } = render(game);
    expect(element.querySelector('.building image')!.getAttribute('href')).toContain('settlement-red.png');
    const upgraded = structuredClone(game);
    upgraded.buildings[0] = { owner: game.players.findIndex(p => p.color === '#2f64d6'), type: 'city' };
    fixture.componentRef.setInput('game', upgraded);
    fixture.detectChanges();
    expect(element.querySelectorAll('.building image')).toHaveLength(1);
    expect(element.querySelector('.building image')!.getAttribute('href')).toContain('city-blue.png');
    expect(element.querySelector('.building title')!.textContent).toContain('Blau: Stadt');
  });

  it('Räuberzug: Das eigene Feld des Räubers ist kein Ziel und sagt beim Klick, warum', () => {
    const { fixture, element, game } = render();
    const others = game.board.hexes.map((_, id) => id).filter((id) => id !== game.robber);
    fixture.componentRef.setInput('hexTargets', others);
    fixture.detectChanges();
    const picks: number[] = [];
    fixture.componentInstance.hexPick.subscribe((id) => picks.push(id));

    const stay = element.querySelector<SVGGElement>('.robber-stay')!;
    expect(stay.dataset['hex']).toBe(String(game.robber));
    expect(element.querySelector(`.hex-target[data-hex="${game.robber}"]`)).toBeNull();
    expect(element.querySelector('.robber-note')).toBeNull();
    // Auch die Figur, die ins Nachbarfeld ragt, gehört zu ihrem Feld.
    stay.querySelector('.figure')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.robber-note')!.textContent).toContain('Der Räuber muss auf ein anderes Feld');
    expect(picks).toEqual([]);

    // Ohne Räuberzug (keine Feldziele) und bei anderen Feldzielen keine Markierung.
    fixture.componentRef.setInput('hexTargets', []);
    fixture.detectChanges();
    expect(element.querySelector('.robber-stay')).toBeNull();
    fixture.componentRef.setInput('hexTargets', others);
    fixture.componentRef.setInput('hexGhost', 'trader');
    fixture.detectChanges();
    expect(element.querySelector('.robber-stay')).toBeNull();
  });

  it('Finger: Der erste Tipp zeigt die Vorschau, erst der zweite baut; daneben tippen hebt die Auswahl auf', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('vertexTargets', [4, 6]);
    fixture.componentRef.setInput('ghost', 'settlement');
    fixture.detectChanges();
    const picked: number[] = [];
    fixture.componentInstance.vertexPick.subscribe(id => picked.push(id));
    const press = (el: Element, pointerType: string) => {
      const down = new Event('pointerdown', { bubbles: true });
      Object.assign(down, { pointerType, pointerId: 1, button: 0, clientX: 0, clientY: 0 });
      el.dispatchEvent(down);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
    };
    const target = (id: number) => element.querySelector(`.vertex-target[data-vertex="${id}"] .hit`)!;

    press(target(4), 'touch');
    expect(picked).toEqual([]);
    expect(element.querySelector('.vertex-target.armed')?.getAttribute('data-vertex')).toBe('4');
    expect(element.querySelector('.confirm-note')).not.toBeNull();

    // Ein anderer Platz wechselt nur die Auswahl, ein Tipp daneben hebt sie auf.
    press(target(6), 'touch');
    expect(element.querySelector('.vertex-target.armed')?.getAttribute('data-vertex')).toBe('6');
    press(element.querySelector('svg')!, 'touch');
    expect(element.querySelector('.armed')).toBeNull();

    press(target(4), 'touch');
    press(target(4), 'touch');
    expect(picked).toEqual([4]);
    expect(element.querySelector('.armed')).toBeNull();

    // Maus: ein Klick genügt.
    press(target(6), 'mouse');
    expect(picked).toEqual([4, 6]);
  });

  it('Pinch: Während der Geste bleibt die viewBox stehen und ein Transform folgt dem Finger, danach umgekehrt', () => {
    const { fixture, element } = render();
    // In jsdom misst niemand die Größe; das Brett braucht sie für Zoom und Transform.
    (fixture.componentInstance as unknown as { size: { set(v: { w: number; h: number }): void } }).size.set({ w: 300, h: 300 });
    fixture.detectChanges();
    const svg = element.querySelector('svg')!;
    const before = svg.getAttribute('viewBox');
    const pointer = (type: string, id: number, x: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: id, pointerType: 'touch', clientX: x, clientY: 150, button: 0 });
      element.dispatchEvent(event);
    };
    pointer('pointerdown', 1, 140);
    pointer('pointerdown', 2, 160);
    for (let i = 1; i <= 5; i++) {
      pointer('pointermove', 1, 140 - i * 10);
      pointer('pointermove', 2, 160 + i * 10);
    }
    fixture.detectChanges();
    expect(svg.getAttribute('viewBox')).toBe(before);
    expect(svg.style.transform).toContain('scale(');
    // Das Brett außerhalb des alten Ausschnitts bleibt sichtbar, sonst entsteht ein leerer Streifen.
    expect(svg.style.overflow).toBe('visible');

    pointer('pointerup', 2, 210);
    pointer('pointerup', 1, 90);
    fixture.detectChanges();
    expect(svg.getAttribute('viewBox')).not.toBe(before);
    expect(svg.style.transform).toBe('');
    expect(svg.style.overflow).toBe('');
  });
});

