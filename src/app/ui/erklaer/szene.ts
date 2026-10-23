import { Component, input } from '@angular/core';
import { COSTS, Resource, RESOURCES } from '../../engine';
import { CARD_ART } from '../shared/card-art';

/** Erklärbilder zwischen den Spielszenen. Jede Szene baut sich in Takten auf, ein Takt je Satz. */
export type SzeneId = 'rohstoffe' | 'zahlen' | 'punkte' | 'abstand' | 'kosten' | 'handel' | 'entwicklung';

const tile = (name: string) => `web/tiles/papiercollage/${name}.png`;
const building = (name: string) => `web/pieces/papiercollage-organic-v2/${name}.png`;
const piece = (name: string) => `web/pieces/papiercollage/${name}.png`;
const banner = (name: string) => `web/banner/papiercollage/${name}.png`;

const pips = (n: number) => 6 - Math.abs(7 - n);
const karten = (cost: Record<Resource, number>) => RESOURCES.flatMap((r) => Array<string>(cost[r]).fill(CARD_ART[r]));

/** Feldgröße der Abstandsszene: Abstand Mitte–Ecke. */
const R = 140;
const SQ3 = Math.sqrt(3);

interface Ecke {
  x: number;
  y: number;
  /** Kanten bis zur Siedlung: 0 die Siedlung, 1 gesperrt, 2 wieder frei. */
  abstand: number;
}

/** Sieben Felder als Blume, die Siedlung auf einer Ecke des mittleren. Abstände per Breitensuche über die Kanten. */
function abstandsBild() {
  const terrains = ['wheat', 'wood', 'sheep', 'brick', 'ore', 'wheat', 'sheep'];
  const hexes = [{ x: 0, y: 0 }, ...[0, 60, 120, 180, 240, 300].map((a) => ({ x: SQ3 * R * Math.cos((a * Math.PI) / 180), y: SQ3 * R * Math.sin((a * Math.PI) / 180) }))].map(
    (h, i) => ({ ...h, src: tile(terrains[i]) }),
  );
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const points = new Map<string, { x: number; y: number }>();
  const links = new Map<string, Set<string>>();
  for (const h of hexes) {
    const corners = [-90, -30, 30, 90, 150, 210].map((a) => ({ x: h.x + R * Math.cos((a * Math.PI) / 180), y: h.y + R * Math.sin((a * Math.PI) / 180) }));
    corners.forEach((c, i) => {
      const k = key(c.x, c.y);
      points.set(k, c);
      const n = corners[(i + 1) % 6];
      const kn = key(n.x, n.y);
      if (!links.has(k)) links.set(k, new Set());
      if (!links.has(kn)) links.set(kn, new Set());
      links.get(k)!.add(kn);
      links.get(kn)!.add(k);
    });
  }
  // Rechte obere Ecke des mittleren Felds.
  const start = key(R * Math.cos(-Math.PI / 6), R * Math.sin(-Math.PI / 6));
  const dist = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift()!;
    for (const n of links.get(k)!) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(k)! + 1);
        queue.push(n);
      }
    }
  }
  const ecken: Ecke[] = [...dist].filter(([, d]) => d <= 2).map(([k, d]) => ({ ...points.get(k)!, abstand: d }));
  const siedlung = points.get(start)!;
  return { hexes, ecken, siedlung, r: R };
}

@Component({
  selector: 'app-erklaer-szene',
  templateUrl: './szene.html',
  styleUrl: './szene.scss',
})
export class Szene {
  readonly szene = input.required<SzeneId>();
  /** Wie weit die Szene aufgebaut ist; 0 zeigt nur die Überschrift. */
  readonly takt = input(0);

  protected readonly rohstoffe = [
    { feld: tile('wood'), karte: CARD_ART.wood, land: 'Wald', ertrag: 'Holz' },
    { feld: tile('brick'), karte: CARD_ART.brick, land: 'Hügel', ertrag: 'Lehm' },
    { feld: tile('sheep'), karte: CARD_ART.sheep, land: 'Weide', ertrag: 'Wolle' },
    { feld: tile('wheat'), karte: CARD_ART.wheat, land: 'Acker', ertrag: 'Getreide' },
    { feld: tile('ore'), karte: CARD_ART.ore, land: 'Gebirge', ertrag: 'Erz' },
  ];
  protected readonly wueste = tile('desert');

  protected readonly zahlen = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => ({ n, pips: Array(pips(n)), rot: n === 6 || n === 8, selten: n === 2 || n === 12 }));

  protected readonly punkte = [
    { bild: building('settlement-red'), name: 'Siedlung', wert: 1, form: 'klein' },
    { bild: building('city-red'), name: 'Stadt', wert: 2, form: 'figur' },
    { bild: banner('signpost'), name: 'Längste Handelsstraße', wert: 2, form: 'figur' },
    { bild: banner('sword'), name: 'Größte Rittermacht', wert: 2, form: 'figur' },
    { bild: CARD_ART.victoryPoint, name: 'Siegpunktkarte', wert: 1, form: 'karte' },
  ];
  protected readonly lorbeer = banner('laurel');

  protected readonly abstand = abstandsBild();
  protected readonly siedlungRot = building('settlement-red');

  protected readonly kosten = [
    { bild: piece('road-red'), name: 'Straße', karten: karten(COSTS.road), form: 'strasse' },
    { bild: building('settlement-red'), name: 'Siedlung', karten: karten(COSTS.settlement), form: 'figur' },
    { bild: building('city-red'), name: 'Stadt', karten: karten(COSTS.city), form: 'figur' },
    { bild: CARD_ART.back, name: 'Entwicklungskarte', karten: karten(COSTS.devCard), form: 'karte' },
  ];

  protected readonly handel = [
    { name: 'Bank', kurs: '4 : 1', gib: Array<string>(4).fill(CARD_ART.wheat), hinweis: 'immer' },
    { name: 'Hafen', kurs: '3 : 1', gib: Array<string>(3).fill(CARD_ART.wheat), hinweis: 'mit Siedlung am Hafen' },
    { name: 'Spezialhafen', kurs: '2 : 1', gib: Array<string>(2).fill(CARD_ART.sheep), hinweis: 'nur dieser Rohstoff' },
  ];
  protected readonly kartenRuecken = CARD_ART.back;

  protected readonly entwicklung = [
    { bild: CARD_ART.knight, name: 'Ritter', takt: 1 },
    { bild: CARD_ART.roadBuilding, name: 'Straßenbau', takt: 2 },
    { bild: CARD_ART.yearOfPlenty, name: 'Erfindung', takt: 2 },
    { bild: CARD_ART.monopoly, name: 'Monopol', takt: 2 },
    { bild: CARD_ART.victoryPoint, name: 'Siegpunkt', takt: 3 },
  ];
}
