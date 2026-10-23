import { channelVolume } from './audio-settings';

/**
 * Alle Töne des Spiels an einer Stelle. Ohne Angabe gilt die Lautstärke des Kanals „Effekte“
 * (0, wenn er aus ist); die Klangprobe gibt ihre eigene mit. Die Klangprobe (/#/klaenge) spielt jeden einzeln vor;
 * ins Spiel kommt nur, was dort freigegeben ist.
 */

/** Zwei helle Töne; früher bei „Du bist dran“ und Tauschangeboten, heute spricht dort der Berater. */
export function chime(volume = channelVolume('effects')): void {
  if (volume <= 0) return;
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.12;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12 * volume, start + 0.02);
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

/** Würfel klappern über den Tisch (Aufnahme, gut eine Sekunde, wie die Würfelanimation). */
export function rattle(volume = channelVolume('effects')): void {
  if (volume <= 0) return;
  try {
    const audio = new Audio('web/sounds/wuerfel.mp3');
    audio.volume = Math.min(1, volume);
    void audio.play().catch(() => undefined);
  } catch {
    // Ohne Audio geht es auch.
  }
}

export interface SoundInfo {
  id: string;
  name: string;
  /** Wann der Ton im Spiel kommt; leer, wenn er (noch) nicht im Spiel ist. */
  when: string;
  play: (volume: number) => void;
}

export const SOUNDS: SoundInfo[] = [
  { id: 'chime', name: 'Hinweiston', when: '', play: chime },
  { id: 'rattle', name: 'Würfelklappern', when: 'Jemand würfelt', play: rattle },
];
