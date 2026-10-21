import { Terrain } from '../../engine';

/**
 * Eigene Feldgrafiken. Dateien nach `public/tiles/` legen und hier eintragen,
 * z. B. `wood: ['tiles/wood-1.png', 'tiles/wood-2.png']`. Mehrere Dateien werden
 * reihum auf die Felder verteilt. Fehlt ein Eintrag, zeichnet das Brett die
 * eingebaute SVG-Grafik. Vorgaben zu Format und Maßen: docs/GRAFIKEN.md.
 */
export const TILE_IMAGES: Partial<Record<Terrain, string[]>> = {
  wood: ['tiles/papiercollage/wood.png'],
  brick: ['tiles/papiercollage/brick.png'],
  sheep: ['tiles/papiercollage/sheep.png'],
  wheat: ['tiles/papiercollage/wheat.png'],
  ore: ['tiles/papiercollage/ore.png'],
  desert: ['tiles/papiercollage/desert.png'],
};
