import { Terrain } from '../../engine';

/**
 * Eigene Feldgrafiken. Dateien nach `public/tiles/` legen und hier eintragen,
 * z. B. `wood: ['tiles/wood-1.png', 'tiles/wood-2.png']`. Mehrere Dateien werden
 * reihum auf die Felder verteilt. Fehlt ein Eintrag, zeichnet das Brett die
 * eingebaute SVG-Grafik. Vorgaben zu Format und Maßen: docs/GRAFIKEN.md.
 */
// Das Brett schneidet die Felder auf das Sechseck zu; deshalb genügen deckende JPEGs (ein Fünftel der PNG-Größe).
// Nebel bleibt PNG, er liegt auch als halbdurchsichtiger Schleier über anderen Feldern.
export const TILE_IMAGES: Partial<Record<Terrain, string[]>> = {
  wood: ['web/tiles/papiercollage/wood.jpg'],
  brick: ['web/tiles/papiercollage/brick.jpg'],
  sheep: ['web/tiles/papiercollage/sheep.jpg'],
  wheat: ['web/tiles/papiercollage/wheat.jpg'],
  ore: ['web/tiles/papiercollage/ore.jpg'],
  desert: ['web/tiles/papiercollage/desert.jpg'],
  gold: ['web/tiles/papiercollage/gold.jpg'],
  fog: ['web/tiles/papiercollage/fog.png'],
  lake: ['web/tiles/papiercollage/lake.jpg'],
};
