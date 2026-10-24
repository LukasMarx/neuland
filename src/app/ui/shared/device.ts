/**
 * Was das Gerät beim Spielen beitragen kann: den Bildschirm wach halten und kurz vibrieren. Beides gibt es
 * nicht überall (Vibration nur unter Android, Safari kann es nicht); fehlt es, passiert einfach nichts.
 */

/** Kurze Muster in Millisekunden: Du bist dran, Würfel gelandet, eigenes Teil gebaut. */
export const BUZZ = {
  turn: [40, 70, 40],
  dice: [15],
  build: [25],
} as const;

export function buzz(pattern: readonly number[]): void {
  try {
    navigator.vibrate?.([...pattern]);
  } catch {
    // Manche Browser werfen ohne vorherige Berührung der Seite; dann eben nicht.
  }
}

/**
 * Hält den Bildschirm an, solange `release` nicht aufgerufen wird. Der Browser gibt die Sperre frei, sobald
 * die Seite im Hintergrund ist; kommt sie zurück, wird sie neu angefordert.
 */
export function keepAwake(): () => void {
  type Lock = { release(): Promise<void> };
  const api = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } }).wakeLock;
  if (!api) return () => {};
  let lock: Lock | null = null;
  let active = true;
  const request = () => {
    if (!active || document.visibilityState !== 'visible') return;
    api.request('screen').then(
      (l) => {
        if (active) lock = l;
        else void l.release();
      },
      () => {
        // Ohne Erlaubnis (etwa im Energiesparmodus) bleibt es beim normalen Verhalten.
      },
    );
  };
  request();
  document.addEventListener('visibilitychange', request);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', request);
    void lock?.release().catch(() => {});
    lock = null;
  };
}
