import { describe, expect, it } from 'vitest';
import { VARIANTS } from '../../engine/variants';
import { allChapters, chapterForVariant, chaptersFor } from './rule-content';

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

describe('Regelbuch in der Lobby', () => {
  it('enthält alle Kapitel und alle Hausregeln', () => {
    const chapters = allChapters();
    expect(chapters.map((c) => c.id)).toEqual(['grundspiel', 'grosse-runde', 'seewege', 'stadtwacht', 'fischgruende', 'flusslaeufe', 'duell', 'hausregeln']);
    const house = chapters.at(-1)!;
    expect(house.pages.map((p) => p.variant)).toEqual([undefined, 'milderRaeuber', 'hafenvogt', 'wuerfelstapel']);
  });

  it('findet zu jeder Variante ein Kapitel im Buch', () => {
    const ids = new Set(allChapters().map((c) => c.id));
    for (const v of VARIANTS) expect(ids.has(chapterForVariant(v.id))).toBe(true);
    expect(chapterForVariant('stadtwacht')).toBe('stadtwacht');
    expect(chapterForVariant('hafenvogt')).toBe('hausregeln');
  });
});
