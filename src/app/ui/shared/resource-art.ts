import { Card } from '../../engine';
import { GOODS_ICON } from './goods-art';

/** Freigestellte Rohstoffsymbole, passend zu den Papiercollage-Karten; Güter vorerst als Platzhalter. */
export const RESOURCE_ART: Record<Card, string> = {
  wood: 'web/icons/resources/wood.png',
  brick: 'web/icons/resources/brick.png',
  sheep: 'web/icons/resources/sheep.png',
  wheat: 'web/icons/resources/wheat.png',
  ore: 'web/icons/resources/ore.png',
  ...GOODS_ICON,
};
