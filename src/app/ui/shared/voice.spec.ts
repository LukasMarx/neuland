import { describe, expect, it } from 'vitest';
import { VOICE } from './voice';

describe('Sprecher-Katalog', () => {
  const clips = Object.values(VOICE).flatMap((e) => e.clips);

  it('dieselbe Aufnahme hat überall denselben Text und Sprecher', () => {
    const byId = new Map<string, string>();
    for (const c of clips) {
      const key = `${c.speaker}|${c.text}|${c.ext}`;
      expect(byId.get(c.id) ?? key).toBe(key);
      byId.set(c.id, key);
    }
  });
});
