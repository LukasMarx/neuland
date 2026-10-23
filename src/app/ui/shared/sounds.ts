import { cachedUrl, preload } from './audio-cache';
import { audioSettings, channelVolume } from './audio-settings';

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

const DICE_URL = 'web/sounds/wuerfel.mp3';
const effectUrl = (id: Effect) => `web/sounds/${id}.m4a`;

/** Lädt Würfel und alle Geräusche im Leerlauf vor (nur bei eingeschalteten Effekten); zusammen gut 250 KB. */
export function preloadEffects(): void {
  if (audioSettings().effects.on) preload([DICE_URL, ...(Object.keys(EFFECTS) as Effect[]).map(effectUrl)]);
}

/** Würfel klappern über den Tisch (Aufnahme, gut eine Sekunde, wie die Würfelanimation). */
export function rattle(volume = channelVolume('effects')): void {
  if (volume <= 0) return;
  try {
    const audio = new Audio(cachedUrl(DICE_URL));
    audio.volume = Math.min(1, volume);
    void audio.play().catch(() => undefined);
  } catch {
    // Ohne Audio geht es auch.
  }
}

/** Geräusche aus Aufnahmen (Pixabay), zugeschnitten und angeglichen; Dateien in public/web/sounds. */
export type Effect = 'strasse' | 'siedlung' | 'stadt' | 'karten' | 'muenzen' | 'muenze' | 'pergament' | 'schwert' | 'raeuber' | 'horn' | 'sieg';

export const EFFECTS: Record<Effect, { name: string; when: string; seconds: number }> = {
  strasse: { name: 'Hammerschlag', when: 'Jemand baut eine Straße oder ein Schiff', seconds: 0.45 },
  siedlung: { name: 'Hämmern', when: 'Jemand baut eine Siedlung', seconds: 1.15 },
  stadt: { name: 'Schweres Hämmern', when: 'Jemand baut eine Stadt', seconds: 1.4 },
  karten: { name: 'Kartenrascheln', when: 'Du bekommst Rohstoffe aus Feldern', seconds: 0.43 },
  muenzen: { name: 'Münzen', when: 'Zwei Spieler tauschen', seconds: 1.2 },
  muenze: { name: 'Eine Münze', when: 'Jemand handelt mit Bank oder Hafen', seconds: 0.95 },
  pergament: { name: 'Pergament', when: 'Jemand kauft eine Entwicklungskarte', seconds: 1.3 },
  schwert: { name: 'Schwert', when: 'Jemand spielt einen Ritter', seconds: 0.85 },
  raeuber: { name: 'Holzfigur', when: 'Der Räuber wird versetzt', seconds: 0.7 },
  horn: { name: 'Horn', when: 'Längste Handelsstraße oder größte Rittermacht wechselt', seconds: 2.55 },
  sieg: { name: 'Siegesfanfare', when: 'Jemand gewinnt', seconds: 3.4 },
};

export function effect(id: Effect, volume = channelVolume('effects')): void {
  if (volume <= 0) return;
  try {
    const audio = new Audio(cachedUrl(effectUrl(id)));
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
  ...(Object.entries(EFFECTS) as [Effect, (typeof EFFECTS)[Effect]][]).map(([id, e]) => ({ id, name: e.name, when: e.when, play: (v: number) => effect(id, v) })),
];
