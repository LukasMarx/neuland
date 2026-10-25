import { Terrain } from './types';

export type MapId = string;

/**
 * Eine Karte: Form als ASCII-Maske in „doubled coordinates“ (jedes Zeichen außer Leerzeichen ist ein
 * Feld, Zeile r, Spalte c, c + r hat überall dieselbe Parität) oder eine zufällig wachsende Form.
 * Siehe docs/KARTEN.md.
 *
 * | Zeichen | Bedeutung |
 * |---|---|
 * | `.` | Landfeld, Gelände aus dem Vorrat |
 * | `~` | Wasser innerhalb der Form (nur Lesehilfe, Seen werden erkannt) |
 * | `h l w g e` | Vorliebe für Holz, Lehm, Wolle, Getreide, Erz |
 * | `x` | Wüstenplatz |
 * | `H L W G E X` | festes Gelände |
 * | `$` | Goldfeld (Seewege) |
 * | `?` | Nebelfeld (Seewege): Land oder Meer, wird erst beim Aufdecken bestimmt |
 * | `t` | Feld einer bewohnten Insel (Die Verschollenen): Gelände ohne Zahl, dort siedelt niemand |
 *
 * Auf Seewege-Karten ist `~` ein echtes Meerfeld mit eigenen Ecken und Kanten.
 */
export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  tags: string[];
  /** Spielerzahl von–bis. */
  players: [number, number];
  /** Vorschlag für das Siegziel. */
  victoryPoints: number;
  mask?: string[] | ((players: number) => string[]);
  /** Zufällige Form mit so vielen Feldern. */
  randomSize?: (players: number) => number;
  /** Seewege: zufällige Insellandschaft, eine Hauptinsel und kleine Inseln mit Gold. */
  archipelago?: (players: number) => { main: number; small: number[]; gold: number };
  /** Feste Hafenzahl statt der Formel. */
  harbors?: number;
  /** Meer als Rahmen um die Form oder als Seekarte (Rechteck), z. B. für die Weltkarte. */
  sea?: 'frame' | 'rect';
  /** Klassisch: Häfen an festen, gleichmäßig verteilten Küstenkanten wie bisher. */
  evenHarbors?: boolean;
  /** Seewege-Szenario: Meerfelder, Schiffe, Kaperschiff, Gold, Inselbonus. */
  seafaring?: {
    /** Siegpunkte für die erste eigene Siedlung auf einer Insel, auf der man noch nichts hat. */
    islandBonus: number;
    /** Wo die Startsiedlungen stehen dürfen: nur auf der größten Insel oder überall. */
    setup: 'largest' | 'any';
    /** Was unter den Nebelfeldern (`?`) liegt: Anteil Meer und Zahl der Goldfelder, der Rest ist Land. */
    fog?: { seaShare: number; gold: number };
    /**
     * Sandmeer: Wüste teilt die Inseln in Gebiete. Die erste eigene Siedlung in einem neuen Gebiet derselben
     * Insel bringt so viele Punkte, auf einer neuen Insel gilt `islandBonus`. Gestartet wird im größten Gebiet.
     */
    regionBonus?: number;
    /** Die Verschollenen: Geschenke an den Küsten der bewohnten Inseln (`t`), je Spielerzahl. */
    gifts?: (players: number) => { point: number; dev: number; harbor: number };
    /** Stoffhandel: Zahlen der Dörfer an den Küsten der kleinen Inseln. */
    villages?: (players: number) => number[];
    /** Freibeuterbuchten: Festungen auf den kleinen Inseln, Kaperschiff auf fester Route, Ritter als Kriegsschiffe. */
    fortresses?: boolean;
    /** Großbauten: Bauwerke mit vier Stufen. */
    wonders?: boolean;
  };
}

const rowsMask = (rows: number[]) => {
  const width = Math.max(...rows);
  return rows.map((n) => ' '.repeat(width - n) + Array(n).fill('.').join(' '));
};

export const CLASSIC_BASE = rowsMask([3, 4, 5, 4, 3]);
export const CLASSIC_EXT = rowsMask([3, 4, 5, 6, 5, 4, 3]);
/** Eigene Erweiterung für 7–8 Spieler: ein breit gezogenes Sechseck mit 44 Feldern. */
export const CLASSIC_BIG = rowsMask([5, 6, 7, 8, 7, 6, 5]);

export const MAPS: MapDef[] = [
  {
    id: 'klassisch',
    name: 'Klassisch',
    description: 'Das bekannte Sechseck: 19 Felder bis 4 Spieler, 30 Felder für 5–6, 44 Felder in die Breite für 7–8.',
    tags: [],
    players: [2, 8],
    victoryPoints: 10,
    mask: (p) => (p > 6 ? CLASSIC_BIG : p > 4 ? CLASSIC_EXT : CLASSIC_BASE),
    evenHarbors: true,
  },
  {
    id: 'langes-tal',
    name: 'Langes Tal',
    description: 'Drei Reihen, acht Felder lang. Weite Wege, umkämpfte Handelsstraße, viele Häfen.',
    tags: ['lange Wege', 'viel Küste'],
    players: [3, 4],
    victoryPoints: 10,
    mask: [' . . . . . . .', '. . . . . . . .', ' . . . . . . .'],
  },
  {
    id: 'kratersee',
    name: 'Kratersee',
    description: 'Ein Ring um einen kleinen See mit Seehafen. Am Kraterrand wird zuerst gesiedelt.',
    tags: ['Binnensee'],
    players: [3, 4],
    victoryPoints: 10,
    mask: ['  . . .', ' . . . .', '. . ~ . .', ' . . . .', '  . . .'],
  },
  {
    id: 'halbmond',
    name: 'Halbmond',
    description: 'Eine Sichel um eine offene Bucht. Die schmale Mitte trennt zwei Hälften.',
    tags: ['Bucht', 'Engstelle'],
    players: [3, 4],
    victoryPoints: 10,
    mask: ['  . . .', ' . . . .', '. . .', ' . .', '. . .', ' . . . .', '  . . .'],
  },
  {
    id: 'atoll',
    name: 'Atoll',
    description: 'Ein Landring um eine Lagune. Häfen liegen außen und an der Lagune.',
    tags: ['Binnensee', 'Ring'],
    players: [5, 6],
    victoryPoints: 10,
    harbors: 12,
    mask: ['   . . . .', '  . . . . .', ' . . ~ ~ . .', '. . ~ ~ ~ . .', ' . . ~ ~ . .', '  . . . . .', '   . . . .'],
  },
  {
    id: 'zwei-reiche',
    name: 'Zwei Reiche',
    description: 'Zwei Kontinente, verbunden durch eine schmale Landbrücke. Wer sie bebaut, sperrt den Weg.',
    tags: ['Landbrücke', 'Engpass'],
    players: [4, 6],
    victoryPoints: 10,
    mask: ['  . .         . .', ' . . .       . . .', '. . . . . . . . . .', ' . . .       . . .', '  . .         . .'],
  },
  {
    id: 'europa',
    name: 'Europa',
    description: 'Stilisiert, mit der Ostsee als Binnensee. Erz bevorzugt in Alpen und Norden.',
    tags: ['Binnensee', 'Klimazonen'],
    players: [5, 6],
    victoryPoints: 11,
    mask: [
      '              h e h',
      '             e   h',
      '            . ~ ~ g',
      '       w . . . g g',
      '  . . w . e e . g .',
      ' l .     .   e .',
      '  x       .   w',
      '           .   w',
    ],
  },
  {
    id: 'weltkarte',
    name: 'Weltkarte',
    description: 'Alle Kontinente als eine Landmasse über Landbrücken. Wüsten in Sahara, Arabien und Australien.',
    tags: ['Landbrücken', 'Klimazonen', 'groß'],
    players: [5, 6],
    victoryPoints: 12,
    sea: 'rect',
    mask: [
      '  h h   . .   h h h',
      '   . . .   w . . . . .',
      '  e g       . e g .',
      '   l       x . x   . g',
      '    .       . l     .',
      '     h       .       .',
      '    . e     h       x w',
      '                   w .',
    ],
  },
  {
    id: 'erste-ueberfahrt',
    name: 'Erste Überfahrt',
    description: 'Seewege: eine Hauptinsel und kleine Inseln mit Gold. Wer als Erster drüben siedelt, bekommt 2 Punkte.',
    tags: ['Seewege', 'Schiffe', 'Gold'],
    players: [3, 6],
    victoryPoints: 13,
    seafaring: { islandBonus: 2, setup: 'largest' },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . ~ ~ ~ . . ~ ~',
            '~ . . . . . ~ ~ . $ ~ ~ ~',
            ' ~ . . x . . ~ ~ ~ ~ ~ ~',
            '~ . . . . . ~ ~ ~ ~ . . ~',
            ' ~ . x . . . ~ ~ ~ $ . ~',
            '~ . . . . . ~ ~ ~ ~ . ~ ~',
            ' ~ . . . . ~ ~ ~ ~ ~ ~ ~',
            '~ ~ ~ ~ ~ ~ ~ ~ . . ~ ~ ~',
            ' ~ ~ . . ~ ~ ~ . $ . ~ ~',
            '~ ~ $ . ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . ~ ~ . . ~ ~',
            '~ . . . . ~ ~ $ ~ ~ ~',
            ' . . x . . ~ ~ ~ ~ ~',
            '~ . . . . ~ ~ ~ ~ . ~',
            ' ~ . . . ~ ~ ~ ~ $ .',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ . . ~ ~',
            '~ ~ ~ ~ ~ ~ ~ $ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'inselquartett',
    name: 'Inselquartett',
    description: 'Seewege: vier gleich große Inseln. Start überall, jede neue Insel bringt 2 Punkte.',
    tags: ['Seewege', 'Schiffe', 'Gold'],
    players: [3, 6],
    victoryPoints: 12,
    seafaring: { islandBonus: 2, setup: 'any' },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . ~ ~ . . . ~',
            '~ . . . . ~ . . . $ ~',
            ' ~ . . . ~ ~ . . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . ~ ~ . . . ~',
            '~ $ . . . ~ . . . . ~',
            ' ~ . . . ~ ~ . . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ . . ~',
            '~ . . . ~ . . $ ~',
            ' ~ . . ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ . . ~',
            '~ $ . . ~ . . . ~',
            ' ~ . . ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'im-dunst',
    name: 'Im Dunst',
    description: 'Seewege: Östlich der Hauptinsel liegt Nebel. Wer ihn mit Straße oder Schiff lichtet, findet Land oder Meer und bekommt einen Rohstoff.',
    tags: ['Seewege', 'Nebel', 'Entdecken'],
    players: [3, 6],
    victoryPoints: 12,
    seafaring: { islandBonus: 2, setup: 'largest', fog: { seaShare: 0.45, gold: 2 } },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . . ~ ? ? ? ? ? ? ~',
            '~ . . . . . . ~ ? ? ? ? ? ? ~',
            ' . . . x . . . ~ ? ? ? ? ? ?',
            '~ . . . . . . ~ ? ? ? ? ? ? ~',
            ' ~ . . . . . ~ ? ? ? ? ? ? ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . ~ ? ? ? ? ? ~',
            '~ . . . . ~ ? ? ? ? ? ~',
            ' . . x . . ~ ? ? ? ? ?',
            '~ . . . . ~ ? ? ? ? ? ~',
            ' ~ . . . ~ ? ? ? ? ? ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'sandmeer',
    name: 'Sandmeer',
    description: 'Seewege: Ein Wüstenstreifen teilt die Hauptinsel. Wer jenseits der Wüste siedelt, bekommt 1 Punkt, auf einer neuen Insel 2.',
    tags: ['Seewege', 'Wüste', 'Gebiete'],
    players: [3, 6],
    victoryPoints: 14,
    seafaring: { islandBonus: 2, regionBonus: 1, setup: 'largest' },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . X . . . ~ ~ . . ~',
            '~ . . . . X . . . . ~ ~ $ ~ ~',
            ' . . . . . X . . . ~ ~ ~ ~ ~',
            '~ . . . . X X X X X ~ ~ . . ~',
            ' . . . . . X . . . ~ ~ $ . ~',
            '~ . . . . X . . . . ~ ~ ~ ~ ~',
            ' ~ . . . . X . . . ~ ~ . $ ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . X . . . ~ . . ~',
            '~ . . . X . . . ~ ~ $ ~ ~',
            ' . . . . X . . . ~ ~ ~ ~',
            '~ . . . X . . . ~ ~ . . ~',
            ' ~ . . . X . . ~ ~ $ . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'die-verschollenen',
    name: 'Die Verschollenen',
    description: 'Seewege: Auf den äußeren Inseln lebt ein fremdes Volk. Wer mit dem Schiff an seine Küsten kommt, bekommt Siegpunkte, Entwicklungskarten und Häfen.',
    tags: ['Seewege', 'Geschenke', 'Häfen'],
    players: [3, 6],
    victoryPoints: 13,
    seafaring: {
      islandBonus: 0,
      setup: 'largest',
      gifts: (p) => (p > 4 ? { point: 6, dev: 5, harbor: 5 } : { point: 4, dev: 4, harbor: 4 }),
    },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ t t ~ ~ ~ ~ ~ ~ ~ ~ t t ~',
            '~ t ~ ~ . . . . . ~ ~ ~ t ~ ~',
            ' ~ ~ ~ . . . . . . ~ ~ ~ ~',
            '~ t t ~ . . . x . . ~ ~ t t ~',
            ' ~ t ~ . . . . . . . ~ ~ t ~',
            '~ ~ ~ ~ . . x . . . ~ ~ ~ ~ ~',
            ' ~ t t ~ . . . . . ~ ~ t t ~',
            '~ t ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ t ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ t t ~ ~ ~ ~ ~ ~ t t ~',
            '~ t ~ ~ . . . . ~ ~ t ~ ~',
            ' ~ ~ ~ . . . . . ~ ~ ~ ~',
            '~ ~ ~ . . . x . . ~ ~ ~ ~',
            ' ~ t ~ . . . . . ~ ~ t ~',
            '~ t t ~ . . . . ~ ~ t t ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'stoffhandel',
    name: 'Stoffhandel',
    description: 'Seewege: Dörfer an den Küsten der kleinen Inseln weben Stoff. Wer per Straße oder Schiff angebunden ist, bekommt bei ihrer Zahl einen Ballen; 2 Ballen sind 1 Punkt.',
    tags: ['Seewege', 'Dörfer', 'Stoff'],
    players: [3, 6],
    victoryPoints: 14,
    seafaring: {
      islandBonus: 0,
      setup: 'largest',
      villages: (p) => (p > 4 ? [3, 4, 5, 6, 8, 9, 10, 11, 4, 10, 5, 9] : [3, 4, 5, 6, 8, 9, 10, 11]),
    },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ ~ ~ . . ~ ~ ~ ~ . . ~',
            '~ . ~ ~ ~ ~ ~ ~ . ~ ~ ~ ~ ~ . ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ . . . . . . . . . ~ ~ ~ ~',
            '~ ~ ~ ~ . . x . . . x . ~ ~ ~ ~ ~',
            ' ~ ~ ~ . . . . . . . . . ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            '~ . ~ ~ ~ ~ ~ ~ . ~ ~ ~ ~ ~ . ~ ~',
            ' ~ . . ~ ~ ~ ~ . . ~ ~ ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ ~ ~ ~ ~ . . ~',
            '~ . ~ ~ ~ ~ ~ ~ ~ ~ . ~ ~',
            ' ~ ~ ~ . . . . . ~ ~ ~ ~',
            '~ ~ ~ . . . x . . ~ ~ ~ ~',
            ' ~ ~ . . . . . . . ~ ~ ~',
            '~ ~ ~ . . . . . . ~ ~ ~ ~',
            ' ~ ~ ~ . . . . . ~ ~ ~ ~',
            '~ . ~ ~ ~ ~ ~ ~ ~ ~ . ~ ~',
            ' ~ . . ~ ~ ~ ~ ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'freibeuterbuchten',
    name: 'Freibeuterbuchten',
    description: 'Seewege: Jeder hat eine Festung auf einer äußeren Insel und muss sie erobern, um zu gewinnen. Das Kaperschiff kreist auf fester Route und greift an; Ritter werden zu Kriegsschiffen.',
    tags: ['Seewege', 'Festungen', 'Kriegsschiffe'],
    players: [3, 6],
    victoryPoints: 10,
    seafaring: { islandBonus: 0, setup: 'largest', fortresses: true },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ ~ ~ . . ~ ~ ~ ~ . . ~',
            '~ . ~ ~ ~ ~ ~ ~ . ~ ~ ~ ~ ~ . ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ . . . . . . . . . ~ ~ ~ ~',
            '~ ~ ~ ~ . . . x . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ . . . . . . . . . ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            '~ . ~ ~ ~ ~ ~ ~ . ~ ~ ~ ~ ~ . ~ ~',
            ' ~ . . ~ ~ ~ ~ . . ~ ~ ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . ~ ~ ~ ~ ~ ~ ~ . . ~',
            '~ . ~ ~ ~ ~ ~ ~ ~ ~ ~ . ~ ~',
            ' ~ ~ ~ ~ . . . . ~ ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ . . . x . . ~ ~ ~ ~',
            '~ ~ ~ ~ . . . . . ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ . . . . ~ ~ ~ ~ ~',
            '~ . ~ ~ ~ ~ ~ ~ ~ ~ ~ . ~ ~',
            ' ~ . . ~ ~ ~ ~ ~ ~ ~ . . ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'grossbauten',
    name: 'Großbauten',
    description: 'Seewege: Jeder kann ein Bauwerk beginnen, wenn er dessen Voraussetzung erfüllt. Jede der vier Stufen bringt 1 Punkt; wer sein Bauwerk vollendet, gewinnt sofort.',
    tags: ['Seewege', 'Bauwerke', 'Gold'],
    players: [3, 6],
    victoryPoints: 12,
    seafaring: { islandBonus: 1, setup: 'largest', wonders: true },
    mask: (p) =>
      p > 4
        ? [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . . ~ ~ ~ . . ~ ~',
            '~ . . . . . . ~ ~ ~ $ . ~ ~',
            ' . . . x . . . ~ ~ ~ ~ ~ ~',
            '~ . . . . . . . ~ ~ ~ . . ~',
            ' . . . . x . . ~ ~ ~ . $ ~',
            '~ . . . . . . ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . . ~ ~ ~ . . ~ ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ $ . ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ]
        : [
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ . . . . ~ ~ ~ . . ~',
            '~ . . . . . ~ ~ ~ $ ~ ~',
            ' . . x . . . ~ ~ ~ ~ ~',
            '~ . . . . . ~ ~ ~ . . ~',
            ' ~ . . . . ~ ~ ~ . $ ~',
            '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ . . ~ ~',
            '~ ~ ~ ~ ~ ~ ~ ~ $ ~ ~ ~',
            ' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
          ],
  },
  {
    id: 'inselwelt',
    name: 'Inselwelt',
    description: 'Seewege: jedes Spiel eine neue Insellandschaft. Eine Hauptinsel, ringsum kleine Inseln, einige mit Gold.',
    tags: ['Seewege', 'jedes Mal neu'],
    players: [3, 6],
    victoryPoints: 13,
    seafaring: { islandBonus: 2, setup: 'largest' },
    archipelago: (p) => (p > 4 ? { main: 28, small: [4, 3, 3, 3, 2, 2], gold: 4 } : { main: 19, small: [4, 3, 3, 2, 2], gold: 3 }),
  },
  {
    id: 'zufallskueste',
    name: 'Zufallsküste',
    description: 'Die Form wächst jedes Spiel neu: kompakt, mit Buchten, manchmal mit Halbinsel oder See.',
    tags: ['jedes Mal neu'],
    players: [2, 6],
    victoryPoints: 10,
    randomSize: (p) => (p > 4 ? 30 : 20),
  },
];

export function mapById(id: MapId | undefined): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export function mapFits(map: MapDef, players: number): boolean {
  return players >= map.players[0] && players <= map.players[1];
}

/** Ein Feld der Maske: Spalte, Zeile und Zeichen (Vorliebe, Wüstenplatz, festes Gelände). */
export interface MaskCell {
  c: number;
  r: number;
  ch: string;
}

/**
 * Liest eine Maske und prüft das Raster. Wasserzeichen `~` sind nur Lesehilfe und fallen weg,
 * außer auf Seewege-Karten (`keepSea`): Dort sind sie Meerfelder.
 */
export function parseMask(rows: string[], keepSea = false): MaskCell[] {
  const cells: MaskCell[] = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] !== ' ') cells.push({ c, r, ch: line[c] });
  });
  const parity = (cells[0].c + cells[0].r) & 1;
  for (const cell of cells) {
    if (((cell.c + cell.r) & 1) !== parity) throw new Error(`Maske: Feld (${cell.c},${cell.r}) liegt nicht im Raster.`);
  }
  return keepSea ? cells : cells.filter((cell) => cell.ch !== '~');
}

export const BIAS: Record<string, Terrain> = { h: 'wood', l: 'brick', w: 'sheep', g: 'wheat', e: 'ore', x: 'desert' };
export const FIXED: Record<string, Terrain> = { H: 'wood', L: 'brick', W: 'sheep', G: 'wheat', E: 'ore', X: 'desert', $: 'gold' };
/** Maskenzeichen, die kein bekanntes Land sind: Meer und Nebel. */
export const WATER_MARKS = new Set(['~', '?']);
