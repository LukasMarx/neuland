import { PROGRESS, PROGRESS_CARDS } from '../../engine';
import { Block, Chapter } from './rule-content';
import { RULE_VIDEOS } from './rule-videos';

/** Was auf einer Buchseite steht: die Blöcke des Inhalts und der Kapitelanfang. */
export type Piece = Block | { kind: 'opening' };

/**
 * Kleinstes Stück, das nicht über eine Seite hinweg umbricht. Listen, Gegenüberstellungen und
 * Kartenlisten zerfallen in einzelne Einträge; auf derselben Seite werden sie wieder zusammengesetzt.
 */
export interface Unit {
  piece: Piece;
  /** Seite im Inhalt (Abschnitt); ein Abschnitt beginnt neu, wenn auf der Seite nur noch wenig Platz ist. */
  section: number;
  /** Herkunftsblock: Stücke mit derselben Herkunft gehören zusammen. */
  source: number;
  /** Bleibt mit dem nächsten Stück auf einer Seite, etwa eine Überschrift. */
  keep: boolean;
}

/** Ein Stück auf seiner Seite; `zoom` unter 1, wenn es verkleinert in den Restplatz passt. */
export interface Placed {
  piece: Piece;
  zoom: number;
  /** Gemessene Höhe in voller Größe. */
  height: number;
}

export interface BookPage {
  pieces: Placed[];
}

export function unitsOf(chapter: Chapter): Unit[] {
  const units: Unit[] = [];
  let source = 0;
  chapter.pages.forEach((page, section) => {
    if (section === 0)
      units.push({ piece: { kind: 'opening' }, section, source: source++, keep: true });
    for (const b of page.blocks) {
      const id = source++;
      const add = (piece: Piece, keep = false) => units.push({ piece, section, source: id, keep });
      if (b.kind === 'list') {
        b.items.forEach((item, k) => add({ ...b, items: [item], start: k + 1 }));
      } else if (b.kind === 'changes') {
        b.rows.forEach((row, k) => add({ ...b, rows: [row], head: k === 0 }));
      } else if (b.kind === 'progress') {
        const cards = PROGRESS_CARDS.filter((c) => PROGRESS[c].track === b.track);
        for (const card of cards) add({ ...b, cards: [card] });
      } else if (b.kind === 'video') {
        if (RULE_VIDEOS[b.video]) add(b);
      } else {
        // Eine Überschrift oder ein Satz, der mit Doppelpunkt auf das Folgende zeigt, bleibt dabei.
        add(b, b.kind === 'h' || (b.kind === 'p' && b.html.trimEnd().endsWith(':')));
      }
    }
  });
  return units;
}

/** Ist weniger als dieser Anteil einer Seite frei, beginnt ein neuer Abschnitt auf der nächsten. */
const SECTION_ROOM = 0.35;
/** So weit dürfen Bilder schrumpfen, damit sie noch auf die Seite passen und keine Lücke bleibt. */
const MIN_ZOOM = 0.65;

interface Slot {
  unit: Unit;
  zoom: number;
  height: number;
}

const shrinks = (piece: Piece | undefined) =>
  piece?.kind === 'scene' || piece?.kind === 'video' || piece?.kind === 'gallery';

/** Verteilt die Stücke auf Seiten mit `room` Pixeln Höhe; `heights[i]` ist die gemessene Höhe von `units[i]`. */
export function paginate(units: Unit[], heights: number[], room: number): BookPage[] {
  const pages: Slot[][] = [];
  let current: Slot[] = [];
  let used = 0;
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };
  units.forEach((unit, i) => {
    if (i > 0 && unit.section !== units[i - 1].section && room - used < room * SECTION_ROOM)
      flush();
    const height = heights[i];
    // Eine Überschrift braucht Platz für sich und wenigstens das nächste Stück.
    const next = units[i + 1];
    if (unit.keep && next?.section === unit.section) {
      const after = heights[i + 1] * (shrinks(next.piece) ? MIN_ZOOM : 1);
      if (used > 0 && used + height + Math.min(after, room - height) > room) flush();
    }
    const free = room - used;
    let zoom = 1;
    if (height > free) {
      // Bilder und Stücke, die selbst größer als eine Seite sind, dürfen schrumpfen.
      const flexible = shrinks(unit.piece) || height > room;
      if (flexible && free >= Math.min(height, room) * MIN_ZOOM) {
        zoom = free / height;
      } else {
        flush();
        zoom = Math.min(1, room / height);
      }
    }
    current.push({ unit, zoom, height });
    used += height * zoom;
  });
  flush();
  return pages.map((page) => ({ pieces: merge(page) }));
}

/** Setzt zerlegte Listen und Tabellen, die auf derselben Seite gelandet sind, wieder zusammen. */
function merge(page: Slot[]): Placed[] {
  const out: Placed[] = [];
  page.forEach(({ unit, zoom, height }, i) => {
    const last = out[out.length - 1]?.piece;
    const piece = unit.piece;
    const continues = i > 0 && page[i - 1].unit.source === unit.source;
    if (continues && last.kind === 'list' && piece.kind === 'list') {
      last.items = [...last.items, ...piece.items];
    } else if (continues && last.kind === 'changes' && piece.kind === 'changes') {
      last.rows = [...last.rows, ...piece.rows];
    } else if (continues && last.kind === 'progress' && piece.kind === 'progress') {
      last.cards = [...(last.cards ?? []), ...(piece.cards ?? [])];
    } else {
      out.push({ piece: { ...piece }, zoom, height });
    }
  });
  return out;
}
