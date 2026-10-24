import { signal } from '@angular/core';

/** Die drei Klangkanäle: Hintergrundmusik, Effekte (Würfel, Hinweiston) und die Sprecher. */
export type AudioChannel = 'music' | 'effects' | 'voice';

export interface ChannelSettings {
  on: boolean;
  /** 0 bis 1. */
  volume: number;
}

export type AudioSettings = Record<AudioChannel, ChannelSettings>;

const KEY = 'neuland:audio';

/**
 * Alles an; die Musik setzt mit dem ersten Klick ein, vorher lässt der Browser keinen Ton zu. Unterwegs
 * (Mobilfunk oder „Datensparen“) bleibt die Musik zunächst aus: Sie lädt rund 3 MB nach.
 */
function defaults(): AudioSettings {
  return { music: { on: !meteredConnection(), volume: 0.6 }, effects: { on: true, volume: 0.8 }, voice: { on: true, volume: 1 } };
}

/** Verbindung mit begrenztem Datenvolumen? Nur Chrome unter Android meldet die Art; sonst gilt: nein. */
function meteredConnection(): boolean {
  const connection = (globalThis.navigator as (Navigator & { connection?: { saveData?: boolean; type?: string } }) | undefined)?.connection;
  return !!connection && (connection.saveData === true || connection.type === 'cellular');
}

function load(): AudioSettings {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (saved) {
      for (const c of Object.keys(base) as AudioChannel[]) if (saved[c]) base[c] = { ...base[c], ...saved[c] };
      return base;
    }
    // Die früheren Schalter „Ton“ und „Musik“ gelten weiter.
    const sound = localStorage.getItem('neuland:sound');
    if (sound) base.effects.on = base.voice.on = sound === 'on';
    if (localStorage.getItem('neuland:music')) base.music.on = localStorage.getItem('neuland:music') === 'on';
  } catch {
    // Ohne Speicher gelten die Vorgaben.
  }
  return base;
}

/** Für alle Seiten dieselben Einstellungen; jede Änderung wird gespeichert. */
export const audioSettings = signal<AudioSettings>(load());

export function setChannel(channel: AudioChannel, change: Partial<ChannelSettings>): void {
  audioSettings.update((s) => ({ ...s, [channel]: { ...s[channel], ...change } }));
  try {
    localStorage.setItem(KEY, JSON.stringify(audioSettings()));
  } catch {
    // Dann eben nur für diese Sitzung.
  }
}

/** Lautstärke eines Kanals, 0 wenn er aus ist. */
export function channelVolume(channel: AudioChannel): number {
  const c = audioSettings()[channel];
  return c.on ? c.volume : 0;
}
