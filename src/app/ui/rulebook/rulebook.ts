import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  Card,
  CARD_NAMES,
  CARDS,
  count,
  PROGRESS,
  PROGRESS_CARDS,
  ProgressCard,
  ResourceCounts,
  Track,
} from '../../engine';
import { CARD_ART } from '../shared/card-art';
import { RESOURCE_ART } from '../shared/resource-art';
import { BookPage, paginate, unitsOf } from './paginate';
import { Block, Chapter, ChapterId } from './rule-content';
import { RuleScene } from './rule-scene';
import { RULE_VIDEOS, RuleVideo, VIDEO_ORDER, VideoId } from './rule-videos';

/** Ab dieser Breite liegt das Buch aufgeschlagen mit zwei Seiten. */
const SPREAD_QUERY = '(min-width: 900px)';

/** Wo zuletzt gelesen wurde, damit das Buch beim nächsten Öffnen dort aufgeht. */
const lastRead: { chapter: ChapterId; page: number } = { chapter: 'grundspiel', page: 0 };

const ROMAN: [number, string][] = [
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function roman(n: number): string {
  let out = '';
  for (const [value, digits] of ROMAN) {
    while (n >= value) {
      out += digits;
      n -= value;
    }
  }
  return out;
}

interface ShownPage {
  key: string;
  /** Seitenzahl im Kapitel, ab 0; fehlt bei der leeren Schlussseite. */
  index: number | null;
  page: BookPage | null;
  /** Noch nicht gemessen: leeres Blatt ohne „Ende des Kapitels“. */
  pending: boolean;
}

/**
 * Regelbuch als aufgeschlagenes Buch, mit Lesezeichen für die Kapitel dieser Partie. Gescrollt wird
 * nicht: Ein unsichtbares Blatt misst den Inhalt, und `paginate` verteilt ihn auf so viele Seiten,
 * wie bei der jetzigen Größe nötig sind.
 */
@Component({
  selector: 'app-rulebook',
  imports: [NgTemplateOutlet, RuleScene],
  templateUrl: './rulebook.html',
  styleUrl: './rulebook.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class Rulebook implements OnInit {
  readonly chapters = input.required<Chapter[]>();
  /** Gleich bei diesem Kapitel aufschlagen, etwa aus der Lobby bei einer Erweiterung. */
  readonly startChapter = input<ChapterId | null>(null);
  readonly close = output<void>();

  protected readonly cardArt = CARD_ART;
  protected readonly roman = roman;

  protected readonly chapterId = signal<ChapterId>(lastRead.chapter);
  /** Gewünschte erste Seite; `start` begrenzt sie auf das, was es gibt. */
  private readonly first = signal(lastRead.page);
  protected readonly spread = signal(
    typeof matchMedia === 'function' && matchMedia(SPREAD_QUERY).matches,
  );
  /** Gerade laufendes Erklärvideo. */
  protected readonly playing = signal<VideoId | null>(null);
  /** Das laufende Video ist zu Ende: Endkarte mit Weiter-Knopf zeigen. */
  protected readonly ended = signal(false);
  protected readonly videoCount = VIDEO_ORDER.length;
  /** Platz in der Grundspiel-Reihe, 0 für ein Erweiterungsvideo. */
  protected readonly videoNumber = computed(() => VIDEO_ORDER.indexOf(this.playing()!) + 1);
  protected readonly nextVideo = computed(() => (this.videoNumber() ? (VIDEO_ORDER[this.videoNumber()] ?? null) : null));
  private readonly film = viewChild<ElementRef<HTMLVideoElement>>('film');
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  protected readonly chapter = computed(
    () => this.chapters().find((c) => c.id === this.chapterId()) ?? this.chapters()[0],
  );
  protected readonly units = computed(() => unitsOf(this.chapter()));
  private readonly step = computed(() => (this.spread() ? 2 : 1));

  private readonly destroyRef = inject(DestroyRef);
  private readonly measure = viewChild<ElementRef<HTMLElement>>('measure');
  private readonly spreadEl = viewChild<ElementRef<HTMLElement>>('spreadEl');
  /** Zählt bei jeder Größenänderung hoch, damit neu gemessen wird. */
  private readonly resized = signal(0);
  private readonly layout = signal<{ chapter: Chapter; pages: BookPage[] } | null>(null);
  private readonly pages = computed(() => {
    const layout = this.layout();
    return layout?.chapter === this.chapter() ? layout.pages : null;
  });
  private readonly pageCount = computed(() => this.pages()?.length ?? 0);
  private readonly start = computed(() =>
    this.align(Math.max(0, Math.min(this.first(), this.pageCount() - 1))),
  );

  protected readonly shown = computed((): ShownPage[] => {
    const pages = this.pages();
    const id = this.chapter().id;
    return Array.from({ length: this.step() }, (_, k) => {
      const index = this.start() + k;
      const key = `${id}:${index}`;
      if (!pages) return { key, index: null, page: null, pending: true };
      return index < pages.length
        ? { key, index, page: pages[index], pending: false }
        : { key, index: null, page: null, pending: false };
    });
  });

  protected readonly hasPrev = computed(() => this.start() > 0 || this.chapterIndex() > 0);
  protected readonly hasNext = computed(
    () =>
      this.start() + this.step() < this.pageCount() ||
      this.chapterIndex() < this.chapters().length - 1,
  );
  private readonly chapterIndex = computed(() => this.chapters().indexOf(this.chapter()));

  protected readonly pageLabel = computed(() => {
    const pages = this.shown().flatMap((s) => (s.index === null ? [] : [s.index + 1]));
    return pages.length ? `Seite ${pages.join('–')} von ${this.pageCount()}` : '';
  });

  constructor() {
    if (typeof matchMedia === 'function') {
      matchMedia(SPREAD_QUERY).addEventListener('change', (e) => this.spread.set(e.matches));
    }
    effect(() => {
      lastRead.chapter = this.chapter().id;
      lastRead.page = this.start();
    });
    afterNextRender(() => {
      const bump = () => this.resized.update((n) => n + 1);
      const observer = new ResizeObserver(bump);
      observer.observe(this.spreadEl()!.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
      // Bis die Schrift geladen ist, misst das Blatt mit der Ersatzschrift.
      void document.fonts?.ready.then(bump);
    });
    // Nach jedem Zeichnen des Messblatts die Stücke auf Seiten verteilen.
    afterRenderEffect(() => {
      const units = this.units();
      this.resized();
      this.spread();
      const body = this.measure()?.nativeElement.querySelector<HTMLElement>('.body');
      if (!body || body.children.length !== units.length) return;
      const heights = [...body.children].map((c) => c.getBoundingClientRect().height);
      this.layout.set({
        chapter: this.chapter(),
        pages: paginate(units, heights, body.clientHeight),
      });
    });
  }

  ngOnInit(): void {
    const start = this.startChapter();
    if (start && this.chapters().some((c) => c.id === start)) {
      this.open(start);
      return;
    }
    // Ein gemerktes Kapitel, das es in dieser Partie nicht gibt, fällt aufs Grundspiel zurück.
    if (this.chapter().id !== this.chapterId()) {
      this.chapterId.set(this.chapter().id);
      this.first.set(0);
    }
  }

  protected open(id: ChapterId, page = 0): void {
    this.chapterId.set(id);
    this.first.set(page);
  }

  protected next(): void {
    if (this.start() + this.step() < this.pageCount()) {
      this.first.set(this.start() + this.step());
    } else if (this.chapterIndex() < this.chapters().length - 1) {
      this.open(this.chapters()[this.chapterIndex() + 1].id);
    }
  }

  protected prev(): void {
    if (this.start() > 0) {
      this.first.set(this.start() - this.step());
    } else if (this.chapterIndex() > 0) {
      // Die letzte Seite des vorigen Kapitels; `start` begrenzt sie, sobald es gemessen ist.
      this.open(this.chapters()[this.chapterIndex() - 1].id, Number.MAX_SAFE_INTEGER);
    }
  }

  protected playVideo(id: VideoId): void {
    this.ended.set(false);
    this.playing.set(id);
    // Das Buch blättert mit, damit man nach dem Schließen beim passenden Text steht.
    const index = this.pages()?.findIndex((page) =>
      page.pieces.some((p) => p.piece.kind === 'video' && p.piece.video === id),
    );
    if (index !== undefined && index >= 0) this.first.set(index);
  }

  protected videoEnded(): void {
    this.ended.set(true);
    // Mit Enter oder Leertaste gleich weiter.
    setTimeout(() => this.nextButton()?.nativeElement.focus());
  }

  protected replay(): void {
    this.ended.set(false);
    const film = this.film()?.nativeElement;
    if (!film) return;
    film.currentTime = 0;
    void film.play();
  }

  protected closeVideo(): void {
    this.playing.set(null);
    this.ended.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape' && this.playing()) this.closeVideo();
    else if (this.playing()) return;
    else if (event.key === 'Escape') this.close.emit();
    else if (event.key === 'ArrowRight' || event.key === 'PageDown') this.next();
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.prev();
    else return;
    event.preventDefault();
    // Das Spiel dahinter soll die Tasten nicht auch noch auswerten.
    event.stopImmediatePropagation();
  }

  protected progressCards(track: Track, cards?: ProgressCard[]) {
    const ids = cards ?? PROGRESS_CARDS.filter((id) => PROGRESS[id].track === track);
    return ids.map((id) => ({
      id,
      ...PROGRESS[id],
    }));
  }

  /** Initiale und Rest eines Absatzes; alle Kapitelanfänge beginnen mit einem Buchstaben, nicht mit Markup. */
  protected initial(block: Extract<Block, { kind: 'p' }>): [string, string] {
    return [block.html.charAt(0), block.html.slice(1)];
  }

  // Die Stücke kommen über ein ng-template ohne Typ herein; diese Helfer geben ihnen den Typ zurück.
  protected art(card: Card): string {
    return RESOURCE_ART[card];
  }

  protected cardName(card: Card): string {
    return CARD_NAMES[card];
  }

  protected video(id: VideoId): RuleVideo | undefined {
    return RULE_VIDEOS[id];
  }

  protected repeat(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected costCards(cost: ResourceCounts): Card[] {
    return CARDS.flatMap((card) => Array<Card>(count(cost, card)).fill(card));
  }

  /** Im aufgeschlagenen Buch beginnt jede Doppelseite mit einer geraden Seite. */
  private align(page: number): number {
    return page - (page % this.step());
  }
}
