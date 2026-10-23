import { describe, expect, it } from 'vitest';
import { paginate, unitsOf } from './paginate';
import { Chapter } from './rule-content';

const chapter: Chapter = {
  id: 'grundspiel',
  tab: 'Test',
  title: 'Test',
  emblem: '',
  pages: [
    {
      blocks: [
        { kind: 'h', text: 'Liste' },
        { kind: 'list', numbered: true, items: ['a', 'b', 'c', 'd'] },
      ],
    },
    { blocks: [{ kind: 'p', html: 'Neuer Abschnitt' }] },
  ],
};

describe('paginate', () => {
  const units = unitsOf(chapter);

  it('zerlegt Listen in Einträge und beginnt mit dem Kapitelanfang', () => {
    expect(units.map((u) => u.piece.kind)).toEqual([
      'opening',
      'h',
      'list',
      'list',
      'list',
      'list',
      'p',
    ]);
  });

  it('bricht Listen zwischen Einträgen um und setzt sie auf der Seite wieder zusammen', () => {
    // Kapitelanfang 40, Überschrift 20, Einträge je 30, Abschnitt 2: 10; Platz 130.
    // Auf Seite 2 ist danach viel Platz, Abschnitt 2 rückt mit auf sie.
    const pages = paginate(units, [40, 20, 30, 30, 30, 30, 10], 130);
    expect(pages.map((p) => p.pieces.map((x) => x.piece.kind))).toEqual([
      ['opening', 'h', 'list'],
      ['list', 'p'],
    ]);
    expect(pages[0].pieces[2].piece).toMatchObject({ items: ['a', 'b'], start: 1 });
    expect(pages[1].pieces[0].piece).toMatchObject({ items: ['c', 'd'], start: 3 });
  });

  it('beginnt einen Abschnitt neu, wenn auf der Seite wenig Platz bleibt', () => {
    const pages = paginate(units, [40, 20, 30, 30, 30, 30, 10], 100);
    expect(pages.map((p) => p.pieces.map((x) => x.piece.kind))).toEqual([
      ['opening', 'h', 'list'],
      ['list'],
      ['p'],
    ]);
  });

  it('lässt eine Überschrift nicht allein unten stehen', () => {
    const pages = paginate(units, [100, 20, 30, 30, 30, 30, 10], 125);
    expect(pages[0].pieces.map((x) => x.piece.kind)).toEqual(['opening']);
    expect(pages[1].pieces[0].piece.kind).toBe('h');
  });

  it('verkleinert ein Stück, das allein nicht auf die Seite passt', () => {
    const pages = paginate(units, [200, 20, 30, 30, 30, 30, 10], 100);
    expect(pages[0].pieces[0].zoom).toBeCloseTo(0.5);
  });

  it('lässt ein Bild schrumpfen, statt eine Lücke zu lassen', () => {
    const figure: Chapter = {
      ...chapter,
      pages: [
        {
          blocks: [
            { kind: 'p', html: 'Text' },
            { kind: 'scene', scene: 'island', caption: '' },
          ],
        },
      ],
    };
    const pages = paginate(unitsOf(figure), [20, 40, 100], 140);
    expect(pages).toHaveLength(1);
    expect(pages[0].pieces[2].zoom).toBeCloseTo(0.8);
  });
});
