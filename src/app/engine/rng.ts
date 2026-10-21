/**
 * Mulberry32. Der Zustand liegt im Spielstand, damit ein neuer Host nach einem
 * Host-Wechsel exakt weiterwürfeln kann.
 */
export interface RngState {
  rng: number;
}

export function random(s: RngState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(s: RngState, n: number): number {
  return Math.floor(random(s) * n);
}

export function shuffle<T>(s: RngState, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
