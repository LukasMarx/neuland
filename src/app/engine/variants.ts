/** Kleine Varianten, in der Lobby zuschaltbar (docs/ERWEITUNGEN.md, Abschnitt 2.1). */
export type VariantId = 'milderRaeuber' | 'hafenvogt' | 'wuerfelstapel';

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
];

/** Die 36 Karten des Würfelstapels: so oft jede Summe, wie zwei Würfel sie ergeben. */
export const DICE_DECK: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Bei so wenigen Karten wird neu gemischt, damit das Ende nicht vorhersehbar ist. */
export const DICE_DECK_RESHUFFLE = 5;

/** Ab so vielen Hafenpunkten gibt es den Hafenvogt. */
export const HARBOR_MASTER_POINTS = 3;
