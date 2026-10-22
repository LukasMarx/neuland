import { Terrain } from '../../engine';

/**
 * Eigene Feldgrafiken. Dateien nach `public/tiles/` legen und hier eintragen,
 * z. B. `wood: ['tiles/wood-1.png', 'tiles/wood-2.png']`. Mehrere Dateien werden
 * reihum auf die Felder verteilt. Fehlt ein Eintrag, zeichnet das Brett die
 * eingebaute SVG-Grafik. Vorgaben zu Format und Maßen: docs/GRAFIKEN.md.
 */
export const TILE_IMAGES: Partial<Record<Terrain, string[]>> = {
  wood: ['web/tiles/papiercollage/wood.png'],
  brick: ['web/tiles/papiercollage/brick.png'],
  sheep: ['web/tiles/papiercollage/sheep.png'],
  wheat: ['web/tiles/papiercollage/wheat.png'],
  ore: ['web/tiles/papiercollage/ore.png'],
  desert: ['web/tiles/papiercollage/desert.png'],
  gold: ['web/tiles/papiercollage/gold.png'],
  fog: ['web/tiles/papiercollage/fog.png'],
  lake: ['web/tiles/papiercollage/lake.png'],
};
