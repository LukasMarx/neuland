import { describe, expect, it } from 'vitest';
import { gameStartImages } from './image-cache';

describe('Grafiken für den Spielstart', () => {
  const colors = ['#d23c3c', '#2e2b2f'];

  it('Grundspiel: Felder, Meer, Räuber, Karten und Figuren in den Farben im Raum', () => {
    const urls = gameStartImages({ victoryPoints: 10, map: 'klassisch' }, colors);
    expect(urls).toContain('web/tiles/papiercollage/wood.jpg');
    expect(urls).toContain('web/tiles/papiercollage/ocean.jpg');
    expect(urls).toContain('web/pieces/papiercollage/robber.png');
    expect(urls).toContain('web/cards/symbolstark/ore.jpg');
    expect(urls).toContain('web/icons/resources/sheep.png');
    expect(urls).toContain('web/pieces/papiercollage-organic-v2/settlement-red.png');
    expect(urls).toContain('web/pieces/papiercollage-organic-v2/city-black.png');
    expect(urls).toContain('web/pieces/papiercollage/road-black.png');
    expect(urls).toContain('web/pieces/papiercollage/knight-red.png');
    expect(urls.some((u) => u.includes('-blue'))).toBe(false);
    expect(urls.some((u) => /ship|pirate|guard|gold|fog|lake|paper/.test(u))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('Seewege bringen Schiffe, Kaperschiff und Gold mit, Nebelkarten auch den Nebel', () => {
    const sea = gameStartImages({ victoryPoints: 13, map: 'erste-ueberfahrt' }, colors);
    expect(sea).toContain('web/pieces/papiercollage/ship-red.png');
    expect(sea).toContain('web/pieces/papiercollage/pirate.png');
    expect(sea).toContain('web/tiles/papiercollage/gold.jpg');
    expect(sea).not.toContain('web/tiles/papiercollage/fog.png');
    expect(gameStartImages({ victoryPoints: 13, map: 'im-dunst' }, colors)).toContain('web/tiles/papiercollage/fog.png');
  });

  it('Erweiterungen nur, wenn sie gewählt sind', () => {
    const urls = gameStartImages({ victoryPoints: 13, map: 'klassisch', variants: ['stadtwacht', 'duell'] }, colors);
    expect(urls).toContain('web/pieces/papiercollage/guard1-black.png');
    expect(urls).toContain('web/pieces/papiercollage-organic-v2/metropolis-red.png');
    expect(urls).toContain('web/cards/symbolstark/silver.jpg');
    expect(urls).toContain('web/pieces/papiercollage/wall.png');
    expect(urls).toContain('web/pieces/papiercollage/road-grey-light.png');
    expect(urls).not.toContain('web/pieces/papiercollage/bridge-red.png');
  });
});
