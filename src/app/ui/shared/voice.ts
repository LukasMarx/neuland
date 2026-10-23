import { audioSettings, channelVolume } from './audio-settings';

/**
 * Sprecher: Der Berater (Ritter) kommentiert, was mir gelingt, der Erzfeind, was die Gegner tun.
 * Jeder hört die Ansagen auf seinem Gerät aus seiner Sicht. Aufnahmen: ElevenLabs, public/audio/.
 */

export type Speaker = 'friend' | 'enemy';

export type VoiceEvent =
  | 'myTurn'
  | 'canBuild'
  | 'mySeven'
  | 'myLongestRoad'
  | 'myLargestArmy'
  | 'myMonopoly'
  | 'tradeOffer'
  | 'playerLeft'
  | 'playerBack'
  | 'robbedMe'
  | 'enemyMonopoly'
  | 'enemyLongestRoad'
  | 'enemyLargestArmy'
  | 'enemySettlesNearMe'
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
    when: 'Du bist dran (nach der Fanfare)',
    clips: [
      clip('friend', 'zug-sire', 'Nun ist es an Euch, Sire.'),
      clip('friend', 'zug-wohlan', 'Wohlan, Ihr seid am Zug.'),
      clip('friend', 'zug-wuerfel', 'Die Würfel warten auf Euch, Mylord.'),
    ],
  },
  canBuild: {
    when: 'Nach deinem Wurf, wenn du etwas bauen kannst (höchstens jeden dritten Zug)',
    clips: [
      clip('friend', 'bauen-befehl', 'Die Bauleute warten auf Euren Befehl.'),
      clip('friend', 'bauen-zeit', 'Wohlan, Zeit für Eure Bauwerke.'),
    ],
  },
  mySeven: { when: 'Du würfelst eine 7', clips: [clip('friend', 'raeuber-tribut', 'Die Räuber fordern ihren Tribut.')] },
  myLongestRoad: {
    when: 'Du bekommst die längste Handelsstraße',
    clips: [clip('friend', 'handelsstrasse-meister', 'Ein neuer Meister der Handelswege.'), clip('friend', 'handelsstrasse-weiter', 'Kein Handelsweg reicht weiter.')],
  },
  myLargestArmy: {
    when: 'Du bekommst die größte Rittermacht',
    clips: [clip('friend', 'rittermacht-anfuehrer', 'Die größte Streitmacht hat einen neuen Anführer.')],
  },
  myMonopoly: { when: 'Du spielst ein Monopol', clips: [clip('friend', 'monopol', 'Ein Monopol füllt die Schatzkammer.')] },
  tradeOffer: { when: 'Ein Tauschangebot an dich', clips: [clip('friend', 'handel-vorgeschlagen', 'Ein Handel wurde vorgeschlagen.')] },
  playerLeft: { when: 'Ein Mitspieler verliert die Verbindung', clips: [clip('friend', 'spieler-verlassen', 'Ein Spieler hat das Spiel verlassen.')] },
  playerBack: { when: 'Ein Mitspieler ist wieder da', clips: [clip('friend', 'spieler-zurueck', 'Ein Spieler ist zurückgekehrt.')] },
  robbedMe: {
    when: 'Ein Gegner raubt dir eine Karte',
    clips: [clip('enemy', 'vorraete-aufgehoben', 'Eure Vorräte sind bei mir besser aufgehoben.'), clip('enemy', 'alles-meins', 'Mit Euren Vorräten? Alles meins!')],
  },
  enemyMonopoly: { when: 'Ein Gegner nimmt dir mit einem Monopol Karten ab', clips: [clip('enemy', 'alles-meins', 'Mit Euren Vorräten? Alles meins!')] },
  enemyLongestRoad: {
    when: 'Ein Gegner bekommt die längste Handelsstraße',
    clips: [clip('enemy', 'strassen-reichen-weit', 'Meine Straßen reichen weit. Euer Einfluss endet hier.')],
  },
  enemyLargestArmy: {
    when: 'Ein Gegner bekommt die größte Rittermacht',
    clips: [clip('enemy', 'ritter-bereit', 'Meine Ritter stehen bereit. Wählt Eure nächsten Schritte weise.')],
  },
  enemySettlesNearMe: {
    when: 'Ein Gegner siedelt an einer deiner Straßen',
    clips: [clip('enemy', 'land-gehoert-mir', 'Dieses Land gehört nun mir. Ihr hättet schneller sein müssen.')],
  },
  enemyRoad: { when: 'Ein Gegner baut eine Straße (ab und zu)', clips: [clip('enemy', 'alle-wege', 'Bald führen alle Wege durch mein Reich.')] },
  idle: { when: 'Du zögerst in deinem Zug länger als 45 Sekunden', clips: [clip('enemy', 'na-los', 'Na los, deine Straßen bauen sich nicht von allein.')] },
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
