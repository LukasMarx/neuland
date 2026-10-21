import { DevCard, Resource } from '../../engine';

export type CardKind = Resource | DevCard | 'back';

/** Text is rendered by the UI; the illustrations contain no labels or counters. */
export const CARD_ART: Record<CardKind, string> = {
  wood: 'cards/symbolstark/wood.png',
  brick: 'cards/symbolstark/brick.png',
  sheep: 'cards/symbolstark/sheep.png',
  wheat: 'cards/symbolstark/wheat.png',
  ore: 'cards/symbolstark/ore.png',
  knight: 'cards/symbolstark/knight.png',
  roadBuilding: 'cards/symbolstark/roadBuilding.png',
  yearOfPlenty: 'cards/symbolstark/yearOfPlenty.png',
  monopoly: 'cards/symbolstark/monopoly.png',
  victoryPoint: 'cards/symbolstark/victoryPoint.png',
  back: 'cards/symbolstark/back.png',
};
