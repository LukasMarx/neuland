/**
 * Alle Töne des Spiels an einer Stelle. Die Klangprobe (/#/klaenge) spielt jeden einzeln vor;
 * ins Spiel kommt nur, was dort freigegeben ist.
 */

export type FanfareVariant = 'kurz' | 'lang';

/** Fanfare, wenn man dran ist: Anfang von „Majestic Brass Fanfare“ (luis_humanoide), zwei Schnittfassungen. */
export const FANFARE_SECONDS: Record<FanfareVariant, number> = { kurz: 4.3, lang: 6.3 };
const FANFARE_VOLUME = 0.6;

export function fanfare(variant: FanfareVariant = 'kurz'): void {
  const audio = new Audio(`web/sounds/fanfare-${variant}.m4a`);
  audio.volume = FANFARE_VOLUME;
  // Ohne Klick vorher lässt der Browser keinen Ton zu; dann eben still.
  audio.play().catch(() => undefined);
}

/** Zwei helle Töne: Tauschangebot an mich (früher auch „Du bist dran“). */
export function chime(): void {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.12;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Ohne Audio geht es auch.
  }
}

/** Kurzes Würfelklappern aus gefiltertem Rauschen, ohne Sounddatei. */
export function rattle(): void {
  try {
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const hits = [0, 0.09, 0.16, 0.27, 0.35, 0.5, 0.62, 0.8, 0.95];
    for (const at of hits) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800 + Math.random() * 1600;
      const gain = ctx.createGain();
      gain.gain.value = 0.5 * (1 - at);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(ctx.currentTime + at);
    }
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Ohne Audio geht es auch.
  }
}

export interface SoundInfo {
  id: string;
  name: string;
  /** Wann der Ton im Spiel kommt; leer, wenn er (noch) nicht im Spiel ist. */
  when: string;
  play: () => void;
}

export const SOUNDS: SoundInfo[] = [
  { id: 'fanfare-kurz', name: 'Fanfare, kurz (4,3 s)', when: 'Du bist dran', play: () => fanfare('kurz') },
  { id: 'fanfare-lang', name: 'Fanfare, lang (6,3 s)', when: '', play: () => fanfare('lang') },
  { id: 'chime', name: 'Hinweiston', when: 'Ein Tauschangebot an dich', play: chime },
  { id: 'rattle', name: 'Würfelklappern', when: 'Jemand würfelt', play: rattle },
];
