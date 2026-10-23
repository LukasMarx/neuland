import { describe, expect, it } from 'vitest';
import { chaptersFor } from './rule-content';

describe('chaptersFor', () => {
  const ids = (settings: Parameters<typeof chaptersFor>[0], players = 4) =>
    chaptersFor(settings, players).map((c) => c.id);

  it('zeigt im Grundspiel nur das Grundspiel', () => {
    expect(ids({})).toEqual(['grundspiel']);
  });

  it('nimmt Spielerzahl, Seewege-Karte und Erweiterungen dazu', () => {
    expect(ids({ map: 'erste-ueberfahrt', variants: ['stadtwacht', 'fischgruende'] }, 5)).toEqual([
      'grundspiel',
      'grosse-runde',
      'seewege',
      'fischgruende',
      'stadtwacht',
    ]);
  });

  it('zeigt bei den Hausregeln nur die eingeschalteten', () => {
    const [, house] = chaptersFor({ variants: ['wuerfelstapel'] }, 3);
    expect(house.id).toBe('hausregeln');
    expect(house.pages.map((p) => p.variant)).toEqual([undefined, 'wuerfelstapel']);
  });
});
