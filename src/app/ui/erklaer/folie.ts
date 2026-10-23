import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Card, CARDS } from '../../engine';
import { RuleScene, SceneId } from '../rulebook/rule-scene';
import { CARD_ART } from '../shared/card-art';

/**
 * Eine Erklärfolie, deren Inhalt das Drehbuch als Daten liefert (siehe videos/buehne.mjs). So
 * brauchen die Erweiterungen keine eigene Szene je Regel: Vergleich, Liste, Galerie, Kartenraster
 * oder ein Brettausschnitt aus dem Regelbuch mit Stichpunkten daneben.
 */
export interface Folie {
  kopf: string;
  unter?: string;
  layout: 'vergleich' | 'liste' | 'galerie' | 'karten' | 'bild';
  elemente: FolieElement[];
  /** Spaltenköpfe im Vergleich, Vorgabe „Grundspiel“ und „Jetzt“. */
  vorher?: string;
  nachher?: string;
  /** Bild links bei `bild`: ein Brettausschnitt aus dem Regelbuch oder eine Grafik. */
  szene?: SceneId;
  grafik?: string;
  /** Kasten unten, etwa ein Beispiel oder ein Tipp. */
  notiz?: { label?: string; html: string; takt: number };
  /** Das Element des aktuellen Takts hervorheben, die anderen abdunkeln. */
  fokus?: boolean;
  /** Alle Elemente von Anfang an zeigen; `takt` hebt dann nur noch das jeweilige hervor. */
  alleSichtbar?: boolean;
  /** Viele Zeilen: kleinere Schrift und weniger Abstand. */
  dicht?: boolean;
  /** Galerie und Karten: Abstand, mit dem Elemente desselben Takts nacheinander erscheinen, in ms. */
  staffel?: number;
}

export interface FolieElement {
  bild?: string;
  form?: 'feld' | 'figur' | 'karte' | 'symbol';
  titel?: string;
  /** Eigenes, festes HTML aus dem Drehbuch (nur <b> und <i>). */
  html?: string;
  /** Plakette, etwa „2 : 1“ oder „+2“. */
  wert?: string;
  /** Vergleich: so war es im Grundspiel, so ist es jetzt. */
  vorher?: string;
  nachher?: string;
  /** Baukosten als Karten. */
  kosten?: Partial<Record<Card, number>>;
  /** Ab diesem Takt sichtbar; Vorgabe: der Reihe nach, ab 1. */
  takt?: number;
}

interface Zeile extends FolieElement {
  /** Ab diesem Takt sichtbar. */
  ab: number;
  /** In diesem Takt hervorgehoben. */
  dran: number;
  karten: string[];
}

@Component({
  selector: 'app-erklaer-folie',
  imports: [NgTemplateOutlet, RuleScene],
  templateUrl: './folie.html',
  styleUrl: './folie.scss',
})
export class FolieView {
  readonly folie = input.required<Folie>();
  readonly takt = input(0);

  protected readonly zeilen = computed<Zeile[]>(() =>
    this.folie().elemente.map((e, i) => ({
      ...e,
      ab: this.folie().alleSichtbar ? 0 : (e.takt ?? i + 1),
      dran: e.takt ?? i + 1,
      karten: CARDS.flatMap((c) => Array<string>(e.kosten?.[c] ?? 0).fill(CARD_ART[c])),
    })),
  );

  /** Kartenraster: bis 4 in einer Reihe, sonst zwei Reihen, höchstens 5 Spalten. */
  protected readonly spalten = computed(() => {
    const n = this.zeilen().length;
    return n > 8 ? 5 : n > 4 ? Math.ceil(n / 2) : n;
  });
  /** Fokus gilt, solange noch ein Element dieses Takts kommt; danach stehen alle gleich. */
  protected readonly fokusAn = computed(() => !!this.folie().fokus && this.zeilen().some((z) => z.dran === this.takt()));
}
