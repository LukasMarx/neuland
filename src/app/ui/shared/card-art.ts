import { Card, DevCard } from '../../engine';

export type CardKind = Card | DevCard | 'back';

/** Text is rendered by the UI; the illustrations contain no labels or counters. */
export const CARD_ART: Record<CardKind, string> = {
  wood: 'web/cards/symbolstark/wood.jpg',
  brick: 'web/cards/symbolstark/brick.jpg',
  sheep: 'web/cards/symbolstark/sheep.jpg',
  wheat: 'web/cards/symbolstark/wheat.jpg',
  ore: 'web/cards/symbolstark/ore.jpg',
  knight: 'web/cards/symbolstark/knight.jpg',
  roadBuilding: 'web/cards/symbolstark/roadBuilding.jpg',
  yearOfPlenty: 'web/cards/symbolstark/yearOfPlenty.jpg',
  monopoly: 'web/cards/symbolstark/monopoly.jpg',
  victoryPoint: 'web/cards/symbolstark/victoryPoint.jpg',
  back: 'web/cards/symbolstark/back.jpg',
  // Stadtwacht: Güter. Silber heißt im Code `coin`, die Karte `silver`.
  paper: 'web/cards/symbolstark/paper.jpg',
  cloth: 'web/cards/symbolstark/cloth.jpg',
  coin: 'web/cards/symbolstark/silver.jpg',
};

/** Große Fassungen (900 px) für die vergrößerte Kartenansicht, werden erst bei Bedarf geladen. */
export const CARD_ART_LARGE = Object.fromEntries(
  Object.entries(CARD_ART).map(([kind, path]) => [kind, path.replace('web/cards/', 'web/cards-large/')]),
) as Record<CardKind, string>;
