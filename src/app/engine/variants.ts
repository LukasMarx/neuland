/** Kleine Varianten, in der Lobby zuschaltbar (docs/ERWEITUNGEN.md, Abschnitt 2.1). */
export type VariantId = 'milderRaeuber' | 'hafenvogt' | 'wuerfelstapel' | 'fischgruende';

export interface VariantDef {
  id: VariantId;
  name: string;
  description: string;
  /** Um so viele Punkte steigt das Siegziel, wenn die Variante an ist. */
  victoryPoints?: number;
}

export const VARIANTS: VariantDef[] = [
  {
    id: 'milderRaeuber',
    name: 'Milder Räuber',
    description: 'Der Räuber darf nicht an Spieler mit höchstens 2 Siegpunkten. Geht das nirgends, kommt er in die Wüste.',
  },
  {
    id: 'hafenvogt',
    name: 'Hafenvogt',
    description:
      'Siedlung am Hafen zählt 1 Hafenpunkt, Stadt 2. Wer zuerst 3 hat, bekommt 2 Siegpunkte; wer mehr hat, übernimmt. Siegziel +1.',
    victoryPoints: 1,
  },
  {
    id: 'wuerfelstapel',
    name: 'Würfelstapel',
    description: '36 Karten statt Würfeln, genau mit der Verteilung zweier Würfel. Kurz vor dem Ende wird neu gemischt.',
  },
  {
    id: 'fischgruende',
    name: 'Fischgründe',
    description:
      'Ein See statt Wüste und Fischgründe an der Küste. Fische bringen Räuber weg (2), eine Karte vom Gegner (3), einen Rohstoff (4), eine Straße (5) oder eine Entwicklung (7). Wer den Rostigen Anker hat, braucht einen Punkt mehr.',
  },
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
