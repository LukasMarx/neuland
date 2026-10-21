import { DevCard, Resource } from '../../engine';

export type CardKind = Resource | DevCard | 'back';

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
};
