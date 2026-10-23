import { audioSettings, channelVolume } from './audio-settings';

/**
 * Sprecher: Der Berater (Ritter) kommentiert, was mir gelingt, der Erzfeind, was die Gegner tun.
 * Jeder hört die Ansagen auf seinem Gerät aus seiner Sicht. Aufnahmen: ElevenLabs, public/audio/.
 */

export type Speaker = 'friend' | 'enemy';

export type VoiceEvent =
  | 'myTurn'
  | 'mySetupTurn'
  | 'canBuild'
  | 'mySpecialBuild'
  | 'mustDiscard'
  | 'myLongestRoad'
  | 'myLongestRoadGrows'
  | 'myLargestArmy'
  | 'myMonopoly'
  | 'tradeOffer'
  | 'playerLeft'
  | 'playerBack'
  | 'robbedMe'
  | 'enemyMonopoly'
  | 'enemyLongestRoad'
  | 'enemyLargestArmy'
  | 'enemySettlement'
  | 'enemyRoad'
  | 'idle';

export interface VoiceClip {
  id: string;
  speaker: Speaker;
  text: string;
}

const clip = (speaker: Speaker, id: string, text: string): VoiceClip => ({ id, speaker, text });

export const VOICE: Record<VoiceEvent, { when: string; clips: VoiceClip[] }> = {
  myTurn: {
    when: 'Du bist dran',
    clips: [
      clip('friend', 'zug-sire', 'Nun ist es an Euch, Sire.'),
      clip('friend', 'zug-wohlan', 'Wohlan, Ihr seid am Zug.'),
      clip('friend', 'zug-wuerfel', 'Die Würfel warten auf Euch, Mylord.'),
    ],
  },
  mySetupTurn: {
    when: 'Du bist dran in der Aufbauphase',
    clips: [clip('friend', 'zug-sire', 'Nun ist es an Euch, Sire.'), clip('friend', 'zug-wohlan', 'Wohlan, Ihr seid am Zug.')],
  },
  canBuild: {
    when: 'Nach deinem Wurf, wenn du eine Siedlung oder Stadt bauen kannst (höchstens jeden dritten Zug)',
    clips: [clip('friend', 'bauen-befehl', 'Die Bauleute warten auf Euren Befehl.')],
  },
  mySpecialBuild: { when: 'Deine Sonderbaurunde beginnt', clips: [clip('friend', 'bauen-zeit', 'Wohlan, Zeit für Eure Bauwerke.')] },
  mustDiscard: { when: 'Eine 7 fällt und du musst abwerfen', clips: [clip('friend', 'raeuber-tribut', 'Die Räuber fordern ihren Tribut.')] },
  myLongestRoad: {
    when: 'Du bekommst die längste Handelsstraße',
    clips: [clip('friend', 'handelsstrasse-meister', 'Ein neuer Meister der Handelswege.'), clip('friend', 'handelsstrasse-weiter', 'Kein Handelsweg reicht weiter.')],
  },
  myLongestRoadGrows: {
    when: 'Du baust deine längste Handelsstraße weiter aus',
    clips: [clip('friend', 'handelsstrasse-weiter', 'Kein Handelsweg reicht weiter.')],
  },
  myLargestArmy: {
    when: 'Du bekommst die größte Rittermacht',
    clips: [clip('friend', 'rittermacht-anfuehrer', 'Die größte Streitmacht hat einen neuen Anführer.')],
  },
  myMonopoly: { when: 'Du spielst ein Monopol', clips: [clip('friend', 'monopol', 'Ein Monopol füllt die Schatzkammer.')] },
  tradeOffer: { when: 'Jemand schlägt dir einen Handel vor', clips: [clip('friend', 'handel-vorgeschlagen', 'Ein Handel wurde vorgeschlagen.')] },
  playerLeft: { when: 'Ein Mitspieler verliert die Verbindung', clips: [clip('friend', 'spieler-verlassen', 'Ein Spieler hat das Spiel verlassen.')] },
  playerBack: { when: 'Ein Mitspieler ist wieder da', clips: [clip('friend', 'spieler-zurueck', 'Ein Spieler ist zurückgekehrt.')] },
  robbedMe: { when: 'Ein Gegner raubt dich aus', clips: [clip('enemy', 'vorraete-aufgehoben', 'Eure Vorräte sind bei mir besser aufgehoben.')] },
  enemyMonopoly: { when: 'Ein Gegner spielt ein Monopol gegen dich', clips: [clip('enemy', 'alles-meins', 'Mit Euren Vorräten? Alles meins!')] },
  enemyLongestRoad: {
    when: 'Ein Gegner bekommt die längste Handelsstraße',
    clips: [clip('enemy', 'strassen-reichen-weit', 'Meine Straßen reichen weit. Euer Einfluss endet hier.')],
  },
  enemyLargestArmy: {
    when: 'Ein Gegner bekommt die größte Rittermacht',
    clips: [clip('enemy', 'ritter-bereit', 'Meine Ritter stehen bereit. Wählt Eure nächsten Schritte weise.')],
  },
  enemySettlement: {
    when: 'Ein Gegner baut eine Siedlung (nicht in der Aufbauphase)',
    clips: [clip('enemy', 'land-gehoert-mir', 'Dieses Land gehört nun mir. Ihr hättet schneller sein müssen.')],
  },
  enemyRoad: {
    when: 'Ein Gegner baut eine Straße (nicht in der Aufbauphase, höchstens einmal je Zug)',
    clips: [clip('enemy', 'alle-wege', 'Bald führen alle Wege durch mein Reich.')],
  },
  idle: {
    when: 'Du hast nach deinem Wurf 60 Sekunden lang nichts getan',
    clips: [clip('enemy', 'na-los', 'Na los, deine Straßen bauen sich nicht von allein.')],
  },
};

export const clipUrl = (c: VoiceClip) => `audio/${c.speaker}/${c.id}.mp3`;

/** Bei voll aufgedrehtem Regler; mal der Lautstärke des Kanals „Sprecher“. */
const MAX_VOLUME = 0.95;
/** Ansagen, die so lange warten mussten, kommen nicht mehr: Der Moment ist vorbei. */
const STALE_MS = 4000;
/** Grobe Länge, bis die Datei ihre echte Dauer kennt. */
const GUESS_SECONDS = 3;

/** Spielt Ansagen nacheinander, nie zwei Stimmen gleichzeitig; `onSpeak` bekommt die Dauer (Musik leiser). */
export class Announcer {
  private current: HTMLAudioElement | null = null;
  private queue: { clip: VoiceClip; at: number; volume: number }[] = [];
  private readonly last = new Map<VoiceEvent, string>();

  constructor(private readonly onSpeak: (seconds: number) => void = () => undefined) {}

  /**
   * Eine Ansage zu einem Ereignis, nach `delayMs`, mit der Lautstärke des Kanals „Sprecher“ (aus: still).
   * Bei mehreren Fassungen nie zweimal dieselbe hintereinander.
   */
  say(event: VoiceEvent, delayMs = 0): void {
    if (channelVolume('voice') <= 0) return;
    const clips = VOICE[event].clips;
    const options = clips.length > 1 ? clips.filter((c) => c.id !== this.last.get(event)) : clips;
    const chosen = options[Math.floor(Math.random() * options.length)];
    this.last.set(event, chosen.id);
    setTimeout(() => this.enqueue(chosen, channelVolume('voice')), delayMs);
  }

  /** Probehören: mit der eingestellten Lautstärke, auch wenn der Kanal aus ist. */
  play(clip: VoiceClip): void {
    this.enqueue(clip, audioSettings().voice.volume);
  }

  stop(): void {
    this.queue = [];
    this.current?.pause();
    this.current = null;
  }

  private enqueue(clip: VoiceClip, volume: number): void {
    // Mehr als zwei Ansagen auf Vorrat wären nur noch Geschnatter.
    if (this.queue.length >= 2 || volume <= 0) return;
    this.queue.push({ clip, at: Date.now(), volume });
    if (!this.current) this.next();
  }

  private next(): void {
    let item = this.queue.shift();
    while (item && Date.now() - item.at > STALE_MS) item = this.queue.shift();
    if (!item) {
      this.current = null;
      return;
    }
    const audio = new Audio(clipUrl(item.clip));
    audio.volume = MAX_VOLUME * item.volume;
    this.current = audio;
    const done = () => {
      if (this.current === audio) this.next();
    };
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    audio.addEventListener('loadedmetadata', () => this.onSpeak((audio.duration || GUESS_SECONDS) + 0.3), { once: true });
    // Ohne Klick vorher lässt der Browser keinen Ton zu; dann eben weiter.
    audio.play().catch(done);
  }
}
