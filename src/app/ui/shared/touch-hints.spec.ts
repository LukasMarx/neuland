import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTouchHints } from './touch-hints';

function pointer(type: string, target: Element, pointerType: string, x = 50, y = 200): void {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType, clientX: x, clientY: y });
  target.dispatchEvent(event);
}

describe('Tooltips per langem Druck', () => {
  let uninstall: () => void;
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button title="Dafür fehlt 1 Lehm"><span>Straße</span></button>';
    button = document.querySelector('button')!;
    uninstall = installTouchHints();
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  it('zeigt den title nach einem langen Druck mit dem Finger und schluckt den Klick danach', () => {
    const clicks = vi.fn();
    button.addEventListener('click', clicks);
    pointer('pointerdown', button.querySelector('span')!, 'touch');
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.touch-hint')?.textContent).toBe('Dafür fehlt 1 Lehm');
    pointer('pointerup', button, 'touch');
    button.click();
    expect(clicks).not.toHaveBeenCalled();
    // Der nächste Tipp schließt die Blase und klickt normal.
    pointer('pointerdown', button, 'touch');
    expect(document.querySelector('.touch-hint')).toBeNull();
    pointer('pointerup', button, 'touch');
    button.click();
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it('nicht bei kurzem Tippen, beim Verschieben oder mit der Maus', () => {
    pointer('pointerdown', button, 'touch');
    vi.advanceTimersByTime(200);
    pointer('pointerup', button, 'touch');
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.touch-hint')).toBeNull();

    pointer('pointerdown', button, 'touch');
    pointer('pointermove', button, 'touch', 50, 240);
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.touch-hint')).toBeNull();

    pointer('pointerdown', button, 'mouse');
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.touch-hint')).toBeNull();
  });
});
