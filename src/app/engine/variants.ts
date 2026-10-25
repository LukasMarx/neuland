import { ResourceCounts } from './types';

/** Kleine Varianten, in der Lobby zuschaltbar (docs/ERWEITUNGEN.md, Abschnitt 2.1). */
export type VariantId = 'milderRaeuber' | 'hafenvogt' | 'wuerfelstapel' | 'fischgruende' | 'duell' | 'flusslaeufe' | 'stadtwacht' | 'kamelzuege';

export interface VariantDef {
  id: VariantId;
  name: string;
  /** Hausregel (kleine Änderung am Grundspiel) oder Erweiterung (neue Teile und Regeln). */
  kind: 'house' | 'expansion';
  /** Eine Zeile für die Lobby; die volle Beschreibung gibt es auf Nachfrage. */
  short: string;
  description: string;
  /** Um so viele Punkte steigt das Siegziel, wenn die Variante an ist. */
  victoryPoints?: number;
  /** Nur mit genau so vielen Spielern. */
  players?: number;
  /** Höchstens so viele Spieler (die Erweiterungen sind für bis zu 6 gebaut). */
  maxPlayers?: number;
  /** Mindestens so viele Spieler. */
  minPlayers?: number;
  /** Nur auf Karten ohne Meerfelder (keine Seewege). */
  landOnly?: boolean;
  /** Varianten, mit denen diese nicht zusammen geht. */
  excludes?: VariantId[];
}

export const VARIANTS: VariantDef[] = [
  {
    id: 'milderRaeuber',
    kind: 'house',
    short: 'Der Räuber verschont Spieler mit höchstens 2 Punkten.',
    name: 'Milder Räuber',
    description: 'Der Räuber darf nicht an Spieler mit höchstens 2 Siegpunkten. Geht das nirgends, kommt er in die Wüste.',
  },
  {
    id: 'hafenvogt',
    kind: 'house',
    short: 'Häfen bringen Hafenpunkte, die meisten geben 2 Siegpunkte.',
    name: 'Hafenvogt',
    description:
      'Siedlung am Hafen zählt 1 Hafenpunkt, Stadt 2. Wer zuerst 3 hat, bekommt 2 Siegpunkte; wer mehr hat, übernimmt. Siegziel +1.',
    victoryPoints: 1,
  },
  {
    id: 'wuerfelstapel',
    kind: 'house',
    short: 'Karten statt Würfel, mit fairer Verteilung.',
    name: 'Würfelstapel',
    description: '36 Karten statt Würfeln, genau mit der Verteilung zweier Würfel. Kurz vor dem Ende wird neu gemischt.',
  },
  {
    id: 'fischgruende',
    kind: 'expansion',
    maxPlayers: 6,
    short: 'Fische an der Küste als zweite Währung.',
    name: 'Fischgründe',
    description:
      'Ein See statt Wüste und Fischgründe an der Küste. Fische bringen Räuber weg (2), eine Karte vom Gegner (3), einen Rohstoff (4), eine Straße (5) oder eine Entwicklung (7). Wer den Rostigen Anker hat, braucht einen Punkt mehr.',
  },
  {
    id: 'duell',
    kind: 'expansion',
    short: 'Für zwei, mit zwei neutralen Mitspielern zum Blockieren.',
    name: 'Duell',
    players: 2,
    description:
      'Für zwei: Zwei neutrale Mitspieler blockieren. Wer eine Straße oder Siedlung baut, setzt auch eine für einen Neutralen. Handelsmarken (Küste, Wüste, Ritter) erzwingen einen Tausch oder schicken den Räuber in die Wüste; der Führende zahlt doppelt.',
  },
  {
    id: 'flusslaeufe',
    kind: 'expansion',
    maxPlayers: 6,
    short: 'Flüsse, Brücken und Münzen.',
    name: 'Flussläufe',
    landOnly: true,
    description:
      'Zwei Flüsse laufen zur Küste. Über den Fluss geht es nur mit Brücken (2 Lehm, 1 Holz). Bauen am Fluss bringt Münzen, 2 Münzen sind ein Rohstoff. Die meisten Münzen geben +1 Punkt, die wenigsten −2.',
  },
  {
    id: 'stadtwacht',
    kind: 'expansion',
    maxPlayers: 6,
    short: 'Güter, Stadtausbau, Wächter gegen die Flotte, Einflusskarten.',
    name: 'Stadtwacht',
    victoryPoints: 3,
    description:
      'Städte auf Wald, Weide und Gebirge liefern Güter (Schriften, Stoff, Silber). Damit baut man die Stadt in drei Richtungen aus; wer zuerst Stufe 4 erreicht, bekommt eine Prachtstadt (+2). Palisaden erhöhen das Handkartenlimit. Eine Plündererflotte greift die Städte an; Wächter verteidigen. Der Räuber kommt erst nach dem ersten Angriff. Zeigt der Ereigniswürfel ein Tor, gibt es Einflusskarten für alle, deren Ausbau in dieser Farbe zum roten Würfel passt. Zweite Startfigur ist eine Stadt, keine Entwicklungskarten.',
  },
  {
    id: 'kamelzuege',
    kind: 'expansion',
    minPlayers: 3,
    maxPlayers: 6,
    excludes: ['fischgruende', 'duell'],
    short: 'Karawanen aus der Oase, Kamele per verdecktem Gebot.',
    name: 'Kamelzüge',
    victoryPoints: 2,
    description:
      'Aus der Oase in der Wüste ziehen drei Karawanen. Nach jeder neuen Siedlung oder Stadt bieten alle verdeckt Getreide und Wolle; wer am meisten bietet, setzt das nächste Kamel. Jedes Gebäude an einer Karawane zählt 1 Punkt mehr, Straßen unter Kamelen zählen doppelt für die längste Straße. Siegziel +2.',
  },
];

/** Kamelzüge: so viele Kamele gibt es, die drei an der Oase eingerechnet. */
export const CAMELS = 22;

/** Die Verschollenen: Punkte für ein Punkt-Geschenk. */
export const GIFT_POINTS = 1;

/** Stoffhandel: Ballen je Dorf zu Beginn und Ballen je Siegpunkt. */
export const VILLAGE_STOCK = 5;
export const BALES_PER_POINT = 2;

/** Freibeuterbuchten: Mauern einer Festung. */
export const FORTRESS_WALLS = 3;

/** Großbauten: Stufen eines Bauwerks; wer die letzte baut, gewinnt sofort. */
export const WONDER_LEVELS = 4;

export type WonderNeed = 'harbor' | 'cities' | 'islands' | 'route' | 'ships';

export interface WonderDef {
  name: string;
  /** Voraussetzung, um das Bauwerk zu beginnen. */
  need: WonderNeed;
  requirement: string;
  /** Kosten jeder Stufe. */
  cost: ResourceCounts;
}

/** Großbauten: fünf Bauwerke, jedes mit eigener Voraussetzung und eigenen Kosten je Stufe. */
export const WONDERS: WonderDef[] = [
  { name: 'Leuchtturm', need: 'harbor', requirement: 'eine Siedlung oder Stadt an einem Hafen', cost: { wood: 1, brick: 1, sheep: 1, wheat: 0, ore: 2 } },
  { name: 'Kathedrale', need: 'cities', requirement: 'zwei Städte', cost: { wood: 0, brick: 2, sheep: 0, wheat: 1, ore: 2 } },
  { name: 'Großer Markt', need: 'islands', requirement: 'Gebäude auf zwei Inseln', cost: { wood: 1, brick: 0, sheep: 2, wheat: 2, ore: 0 } },
  { name: 'Wehrturm', need: 'route', requirement: 'eine Handelsroute von mindestens 5', cost: { wood: 1, brick: 2, sheep: 0, wheat: 0, ore: 2 } },
  { name: 'Werft', need: 'ships', requirement: 'fünf Schiffe', cost: { wood: 2, brick: 1, sheep: 1, wheat: 0, ore: 1 } },
];

/** Stadtwacht: Güter in der Bank je Sorte, Palisaden je Spieler, Punkte für eine Prachtstadt. */
export const GOODS_SUPPLY = 12;
export const MAX_WALLS = 3;
export const METROPOLIS_POINTS = 2;
/** Stadtwacht II: Felder der Plündererleiste bis zum Angriff, Wächter je Stufe und Spieler. */
export const RAIDER_TRACK = 7;
export const GUARDS_PER_LEVEL = 2;
/** Stadtwacht III: Einflusskarten auf der Hand, Punktkarten nicht mitgezählt. */
export const PROGRESS_LIMIT = 4;

/** Flussläufe: Münzen für eine Brücke und für Straße oder Siedlung am Fluss. */
export const BRIDGE_COINS = 3;
export const RIVER_COINS = 1;

/** Duell: die beiden neutralen Mitspieler. */
export const NEUTRALS = [
  { id: 'neutral-1', name: 'Neutral 1', color: '#9aa1a8' },
  { id: 'neutral-2', name: 'Neutral 2', color: '#5d646c' },
];

/** Fischplättchen im Stapel: Werte 1 bis 3 und der Rostige Anker. */
export const FISH_POOL: Record<string, number> = { 1: 11, 2: 10, 3: 8, anchor: 1 };

/** Der See liefert bei diesen Würfen Fische. */
export const LAKE_NUMBERS = [2, 3, 11, 12];

/** Die 36 Karten des Würfelstapels: so oft jede Summe, wie zwei Würfel sie ergeben. */
export const DICE_DECK: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Bei so wenigen Karten wird neu gemischt, damit das Ende nicht vorhersehbar ist. */
export const DICE_DECK_RESHUFFLE = 5;

/** Ab so vielen Hafenpunkten gibt es den Hafenvogt. */
export const HARBOR_MASTER_POINTS = 3;
