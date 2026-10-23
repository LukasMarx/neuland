import { Component, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { Transfer, TransferPoint } from '../../engine';
import { CARD_ART } from '../shared/card-art';

const FLIGHT_MS = 780;
/** Mehr Karten pro Bewegung werden nicht einzeln gezeigt, sonst wird es unübersichtlich. */
const MAX_CARDS = 6;

/**
 * Lässt Karten zwischen Feldern, Spielern, Bank und Bauplätzen fliegen. Die Positionen
 * kommen aus `data-*`-Ankern im DOM, damit Brett und Seitenleiste nichts davon wissen müssen.
 */
@Component({
  selector: 'app-fly-layer',
  template: '',
  styles: `
    app-fly-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 40;
    }
    .fly-card {
      position: fixed;
      width: 30px;
      height: 42px;
      margin: -21px 0 0 -15px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 17px;
      background: #235563 center / cover no-repeat;
      border: 1px solid #e6d2a4;
      box-shadow: 0 6px 14px rgb(0 0 0 / 0.3);
      will-change: transform, opacity;
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class FlyLayer {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  play(transfers: Transfer[], mySeat: number, delay = 0): void {
    if (this.reducedMotion) return;
    let slot = 0;
    for (const t of transfers) {
      const cards = Math.min(t.count, MAX_CARDS);
      for (let i = 0; i < cards; i++) {
        setTimeout(() => this.launch(t, mySeat), delay + slot * 70);
        slot++;
      }
      slot += 1;
    }
  }

  private launch(t: Transfer, mySeat: number): void {
    const from = this.anchor(t.from, t, mySeat);
    const to = this.anchor(t.to, t, mySeat);
    if (!from || !to) return;
    const a = center(from);
    const b = center(to);

    const card = document.createElement('div');
    card.className = 'fly-card';
    const secret = t.hidden && !involves(t, mySeat);
    const artwork = secret || t.card === 'dev' ? CARD_ART.back : CARD_ART[t.card];
    card.style.backgroundImage = `url("${artwork}")`;
    card.setAttribute('aria-hidden', 'true');
    card.style.left = `${a.x}px`;
    card.style.top = `${a.y}px`;
    this.host.appendChild(card);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Leichter Bogen nach oben, wirkt mehr nach Werfen als nach Schieben.
    const lift = -Math.min(90, 30 + Math.hypot(dx, dy) * 0.15);
    const animation = card.animate(
      [
        { transform: 'translate(0, 0) scale(0.4) rotate(-10deg)', opacity: 0 },
        { transform: 'translate(0, 0) scale(1.1) rotate(0deg)', opacity: 1, offset: 0.15 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(1) rotate(8deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.8) rotate(0deg)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0, 0.35, 1)' },
    );
    animation.onfinish = () => {
      card.remove();
      if (to instanceof HTMLElement) {
        // Ein Spielereintrag steht in der waagerecht scrollenden Kopfzeile. Wüchse er als Ganzes, ragte er am Rand
        // über die Reihe hinaus, kurz erschiene eine Scrollleiste und alles darunter spränge. Darum wachsen nur
        // seine Teile, innerhalb des Eintrags.
        const bumped = to.hasAttribute('data-seat') ? [...to.children] : [to];
        for (const el of bumped) {
          el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 220 });
        }
      }
    };
  }

  /** Element, zu dem eine Karte fliegt oder von dem sie kommt. Die eigene Hand zielt auf die passende Karte. */
  private anchor(point: TransferPoint, t: Transfer, mySeat: number): Element | null {
    switch (point.kind) {
      case 'bank':
        return document.querySelector(`[data-bank="${t.card}"]`) ?? document.querySelector('[data-anchor="bank"]');
      case 'player':
        if (point.seat === mySeat) {
          return document.querySelector(`[data-hand="${t.card}"]`) ?? document.querySelector(`[data-seat="${point.seat}"]`);
        }
        return document.querySelector(`[data-seat="${point.seat}"]`);
      case 'hex':
        return document.querySelector(`[data-hex="${point.id}"] .token`) ?? document.querySelector(`[data-hex="${point.id}"]`);
      case 'vertex':
        return document.querySelector(`[data-vertex="${point.id}"]`);
      case 'edge':
        return document.querySelector(`[data-edge="${point.id}"]`);
    }
  }
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function involves(t: Transfer, seat: number): boolean {
  return (t.from.kind === 'player' && t.from.seat === seat) || (t.to.kind === 'player' && t.to.seat === seat);
}
