/**
 * Tooltips per langem Druck. Viele Erklärungen stehen nur im `title` eines Elements (warum ein Knopf gesperrt
 * ist, was eine Zahl bedeutet). Mit der Maus erscheinen sie beim Überfahren, mit dem Finger gar nicht. Hier
 * zeigt ein Druck von einer knappen halben Sekunde den Text als Blase über dem Finger; der Klick danach
 * entfällt, damit das Lesen nichts auslöst.
 */
const HOLD_MS = 450;
/** So weit darf der Finger wandern, ohne dass es als Verschieben gilt. */
const SLOP = 10;

export function installTouchHints(doc: Document = document): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let bubble: HTMLElement | null = null;
  let swallowClick = false;

  const hide = () => {
    bubble?.remove();
    bubble = null;
  };
  const cancel = () => {
    clearTimeout(timer);
    start = null;
  };

  const show = (text: string, x: number, y: number) => {
    hide();
    bubble = doc.createElement('div');
    bubble.className = 'touch-hint';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = text;
    doc.body.append(bubble);
    // Über dem Finger, aber im Bild.
    const r = bubble.getBoundingClientRect();
    const view = doc.defaultView!;
    const left = Math.min(Math.max(8, x - r.width / 2), view.innerWidth - r.width - 8);
    const top = y - r.height - 28 < 8 ? y + 28 : y - r.height - 28;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  };

  const down = (event: PointerEvent) => {
    hide();
    if (event.pointerType !== 'touch') return;
    const el = (event.target as Element | null)?.closest<HTMLElement | SVGElement>('[title]');
    const text = el?.getAttribute('title');
    if (!text) return;
    start = { x: event.clientX, y: event.clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!start) return;
      show(text, start.x, start.y);
      swallowClick = true;
    }, HOLD_MS);
  };
  const move = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP) cancel();
  };
  const click = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  // Langes Drücken öffnet sonst das Kontextmenü des Browsers.
  const menu = (event: Event) => {
    if (bubble) event.preventDefault();
  };

  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerup', cancel, true);
  doc.addEventListener('pointercancel', cancel, true);
  doc.addEventListener('click', click, true);
  doc.addEventListener('contextmenu', menu, true);
  doc.addEventListener('scroll', hide, true);
  return () => {
    cancel();
    hide();
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', cancel, true);
    doc.removeEventListener('pointercancel', cancel, true);
    doc.removeEventListener('click', click, true);
    doc.removeEventListener('contextmenu', menu, true);
    doc.removeEventListener('scroll', hide, true);
  };
}
