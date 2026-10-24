import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Announcer, VOICE } from './voice';

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

describe('Sprecher: Warteschlange', () => {
  /** Ersatz für Audio: merkt sich, was gespielt wird, und endet erst, wenn der Test es sagt. */
  class FakeAudio extends EventTarget {
    static played: FakeAudio[] = [];
    volume = 1;
    duration = 1;
    constructor(readonly src: string) {
      super();
    }
    play(): Promise<void> {
      FakeAudio.played.push(this);
      return Promise.resolve();
    }
    pause(): void {}
    end(): void {
      this.dispatchEvent(new Event('ended'));
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudio.played = [];
    vi.stubGlobal('Audio', FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('eine wartende Ansage entfällt, wenn ihr Anlass erledigt ist, bevor sie an der Reihe ist', () => {
    const announcer = new Announcer();
    let open = true;
    announcer.say('gameStart');
    announcer.say('tradeOffer', 0, () => open);
    vi.advanceTimersByTime(0);
    expect(FakeAudio.played).toHaveLength(1);
    // Das Angebot ist abgelehnt, während noch der Herold spricht.
    open = false;
    FakeAudio.played[0].end();
    expect(FakeAudio.played).toHaveLength(1);
  });

  it('und kommt, solange der Anlass noch gilt', () => {
    const announcer = new Announcer();
    announcer.say('gameStart');
    announcer.say('tradeOffer', 0, () => true);
    vi.advanceTimersByTime(0);
    FakeAudio.played[0].end();
    expect(FakeAudio.played).toHaveLength(2);
    expect(VOICE.tradeOffer.clips.some((c) => FakeAudio.played[1].src.includes(c.id))).toBe(true);
  });
});
