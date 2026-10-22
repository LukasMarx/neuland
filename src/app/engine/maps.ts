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
  };
}

const rowsMask = (rows: number[]) => {
  const width = Math.max(...rows);
  return rows.map((n) => ' '.repeat(width - n) + Array(n).fill('.').join(' '));
};

export const CLASSIC_BASE = rowsMask([3, 4, 5, 4, 3]);
export const CLASSIC_EXT = rowsMask([3, 4, 5, 6, 5, 4, 3]);

export const MAPS: MapDef[] = [
  {
    id: 'klassisch',
    name: 'Klassisch',
    description: 'Das bekannte Sechseck: 19 Felder bis 4 Spieler, 30 Felder ab 5.',
    tags: [],
    players: [2, 6],
    victoryPoints: 10,
    mask: (p) => (p > 4 ? CLASSIC_EXT : CLASSIC_BASE),
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
    description: 'Seewege: eine Hauptinsel und drei kleine Inseln mit Gold. Wer als Erster drüben siedelt, bekommt 2 Punkte.',
    tags: ['Seewege', 'Schiffe', 'Gold'],
    players: [3, 4],
    victoryPoints: 13,
    seafaring: { islandBonus: 2, setup: 'largest' },
    mask: [
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
    players: [3, 4],
    victoryPoints: 12,
    seafaring: { islandBonus: 2, setup: 'any' },
    mask: [
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
