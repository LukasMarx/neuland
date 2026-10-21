import { Component, computed, input } from '@angular/core';
import { DEV_CARD_NAMES, RESOURCE_NAMES } from '../../engine';
import { CARD_ART, CARD_ART_LARGE, CardKind } from './card-art';

/** Shared, non-interactive card face for the hand and selection dialogs. */
@Component({
  selector: 'app-card-face',
  template: `
    <img [src]="(large() ? artLarge : art)[kind()]" alt="" draggable="false" />
    @if (badge() !== null) {
      <span class="badge">{{ badge() }}</span>
    }
    <span class="caption">
      <span class="name">{{ name() }}</span>
      <ng-content />
    </span>
  `,
  styleUrl: './card-face.scss',
})
export class CardFace {
  readonly kind = input.required<CardKind>();
  readonly badge = input<string | number | null>(null);
  /** Große Bildfassung, z. B. für die vergrößerte Kartenansicht. */
  readonly large = input(false);
  protected readonly artLarge = CARD_ART_LARGE;
  protected readonly art = CARD_ART;
  protected readonly name = computed(() => ({ ...RESOURCE_NAMES, ...DEV_CARD_NAMES, back: 'Neuland' })[this.kind()]);
}
