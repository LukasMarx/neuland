import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Audio-Einstellungen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('ohne gespeicherte Wahl ist alles an', async () => {
    const { audioSettings } = await import('./audio-settings');
    expect(audioSettings()).toEqual({ music: { on: true, volume: 0.6 }, effects: { on: true, volume: 0.8 }, voice: { on: true, volume: 1 } });
  });

  it('die früheren Schalter „Ton aus“ und „Musik aus“ gelten weiter', async () => {
    localStorage.setItem('neuland:sound', 'off');
    localStorage.setItem('neuland:music', 'off');
    const { audioSettings } = await import('./audio-settings');
    expect(audioSettings().effects.on).toBe(false);
    expect(audioSettings().voice.on).toBe(false);
    expect(audioSettings().music.on).toBe(false);
  });

  it('eine gespeicherte Wahl geht vor', async () => {
    localStorage.setItem('neuland:audio', JSON.stringify({ music: { on: false, volume: 0.2 } }));
    const { audioSettings } = await import('./audio-settings');
    expect(audioSettings().music).toEqual({ on: false, volume: 0.2 });
    expect(audioSettings().voice.on).toBe(true);
  });
});
