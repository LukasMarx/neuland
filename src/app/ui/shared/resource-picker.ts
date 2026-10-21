import { Component, input, model } from '@angular/core';
import { RESOURCE_NAMES, RESOURCES, Resource, ResourceCounts } from '../../engine';
import { CardFace } from './card-face';

/** Mengenauswahl je Rohstoff mit −/+. `max` begrenzt pro Rohstoff, `total` die Summe. */
@Component({
  selector: 'app-resource-picker',
  imports: [CardFace],
  template: `
    @for (r of resources; track r) {
      <div class="cell" [title]="names[r]">
        <app-card-face [kind]="r" />
        <div class="controls">
          <button class="small" type="button" [disabled]="value()[r] <= 0" (click)="change(r, -1)" [attr.aria-label]="names[r] + ' weniger'">−</button>
          <span class="count">{{ value()[r] }}</span>
          <button class="small" type="button" [disabled]="!canAdd(r)" (click)="change(r, 1)" [attr.aria-label]="names[r] + ' mehr'">+</button>
        </div>
        @if (max(); as m) {
          <span class="muted have">von {{ m[r] }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }
    .cell {
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      background: var(--panel-2);
      border-radius: 8px;
      padding: 6px 2px;
    }
    app-card-face {
      width: min(100%, 64px);
    }
    .controls {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 1px;
    }
    .controls button {
      min-width: 0;
      min-height: 28px;
      padding: 2px 0;
      line-height: 1.5;
    }
    .count {
      min-width: 1.2em;
      text-align: center;
      font-weight: 700;
    }
    .have {
      font-size: 0.75em;
    }
    @media (max-width: 360px) {
      :host {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  `,
})
export class ResourcePicker {
  readonly value = model.required<ResourceCounts>();
  readonly max = input<ResourceCounts | null>(null);
  readonly total = input<number | null>(null);

  protected readonly resources = RESOURCES;
  protected readonly names = RESOURCE_NAMES;

  protected canAdd(r: Resource): boolean {
    const max = this.max();
    if (max && this.value()[r] >= max[r]) return false;
    const total = this.total();
    if (total !== null && RESOURCES.reduce((sum, k) => sum + this.value()[k], 0) >= total) return false;
    return true;
  }

  protected change(r: Resource, delta: number): void {
    this.value.update((v) => ({ ...v, [r]: Math.max(0, v[r] + delta) }));
  }
}
