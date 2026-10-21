import { Component, input, model } from '@angular/core';
import { RESOURCE_NAMES, RESOURCES, Resource, ResourceCounts } from '../../engine';
import { RESOURCE_ICONS } from './labels';

/** Mengenauswahl je Rohstoff mit −/+. `max` begrenzt pro Rohstoff, `total` die Summe. */
@Component({
  selector: 'app-resource-picker',
  template: `
    @for (r of resources; track r) {
      <div class="cell" [title]="names[r]">
        <span class="icon">{{ icons[r] }}</span>
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
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
    }
    .cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: var(--panel-2);
      border-radius: 8px;
      padding: 6px 2px;
    }
    .icon {
      font-size: 22px;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .controls button {
      padding: 0 6px;
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
  `,
})
export class ResourcePicker {
  readonly value = model.required<ResourceCounts>();
  readonly max = input<ResourceCounts | null>(null);
  readonly total = input<number | null>(null);

  protected readonly resources = RESOURCES;
  protected readonly icons = RESOURCE_ICONS;
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
