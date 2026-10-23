import { audioSettings, channelVolume } from './audio-settings';

/**
 * Sprecher: Der Berater (Ritter) kommentiert, was mir gelingt, der Erzfeind, was die Gegner tun.
 * Jeder hört die Ansagen auf seinem Gerät aus seiner Sicht. Aufnahmen: ElevenLabs, public/audio/.
 */

export type Speaker = 'friend' | 'enemy';

export type VoiceEvent =
  | 'gameStart'
  | 'myTurn'
  | 'mySetupTurn'
  | 'canBuild'
  | 'mySpecialBuild'
  | 'mustDiscard'
  | 'myCity'
  | 'bigHarvest'
  | 'iRobbed'
  | 'tradeOffer'
  | 'tradeDone'
  | 'myLongestRoad'
  | 'myLongestRoadGrows'
  | 'lostLongestRoad'
  | 'myLargestArmy'
  | 'lostLargestArmy'
  | 'myMonopoly'
  | 'myMatchPoint'
  | 'myWin'
  | 'playerLeft'
  | 'playerBack'
  | 'robbedMe'
  | 'robberOnMyHex'
  | 'enemyMonopoly'
  | 'enemyLongestRoad'
  | 'enemyLargestArmy'
  | 'enemySettlement'
  | 'enemyCity'
  | 'enemyRoad'
  | 'tradeRejected'
  | 'enemyMatchPoint'
  | 'enemyWin'
  | 'idle';

export interface VoiceClip {
  id: string;
  speaker: Speaker;
  text: string;
  /** Die ersten Aufnahmen (aus der ElevenLabs-Oberfläche) sind MP3, die über die API erzeugten AAC. */
  ext: 'mp3' | 'm4a';
}

const clip = (speaker: Speaker, id: string, text: string, ext: VoiceClip['ext'] = 'm4a'): VoiceClip => ({ id, speaker, text, ext });
const first = (speaker: Speaker, id: string, text: string) => clip(speaker, id, text, 'mp3');

const SIRE = first('friend', 'zug-sire', 'Nun ist es an Euch, Sire.');
const WOHLAN = first('friend', 'zug-wohlan', 'Wohlan, Ihr seid am Zug.');
const KEIN_WEG = first('friend', 'handelsstrasse-weiter', 'Kein Handelsweg reicht weiter.');

export const VOICE: Record<VoiceEvent, { when: string; clips: VoiceClip[] }> = {
  gameStart: { when: 'Das Spiel beginnt', clips: [clip('friend', 'reich-gedeihen', 'Möge Euer Reich gedeihen.')] },
  myTurn: {
    when: 'Du bist dran',
    clips: [SIRE, WOHLAN, first('friend', 'zug-wuerfel', 'Die Würfel warten auf Euch, Mylord.')],
  },
  mySetupTurn: { when: 'Du bist dran in der Aufbauphase', clips: [SIRE, WOHLAN] },
  canBuild: {
    when: 'Nach deinem Wurf, wenn du eine Siedlung oder Stadt bauen kannst (höchstens jeden dritten Zug)',
    clips: [first('friend', 'bauen-befehl', 'Die Bauleute warten auf Euren Befehl.'), clip('friend', 'bauen-vorraete', 'Eure Vorräte reichen für ein neues Bauwerk.')],
  },
  mySpecialBuild: { when: 'Deine Sonderbaurunde beginnt', clips: [first('friend', 'bauen-zeit', 'Wohlan, Zeit für Eure Bauwerke.')] },
  mustDiscard: {
    when: 'Eine 7 fällt und du musst abwerfen',
    clips: [first('friend', 'raeuber-tribut', 'Die Räuber fordern ihren Tribut.'), clip('friend', 'raeuber-anteil', 'Die Räuber nehmen sich ihren Anteil.')],
  },
  myCity: {
    when: 'Du baust eine Stadt',
    clips: [clip('friend', 'stadt-erhebt', 'Eine Stadt erhebt sich.'), clip('friend', 'stadt-siedlung', 'Aus Eurer Siedlung wird eine Stadt.')],
  },
  bigHarvest: {
    when: 'Ein Wurf bringt dir 5 oder mehr Rohstoffe',
    clips: [clip('friend', 'ernte-reich', 'Eine reiche Ernte, Mylord!'), clip('friend', 'ernte-speicher', 'Die Speicher füllen sich.')],
  },
  iRobbed: { when: 'Du raubst jemandem eine Karte', clips: [clip('friend', 'fang-lohnend', 'Ein lohnender Fang.')] },
  tradeOffer: {
    when: 'Jemand schlägt dir einen Handel vor',
    clips: [
      first('friend', 'handel-vorgeschlagen', 'Ein Handel wurde vorgeschlagen.'),
      clip('friend', 'handel-gehoer', 'Ein Händler bittet um Gehör.'),
      clip('friend', 'handel-angebot', 'Man bietet Euch einen Handel an, Mylord.'),
    ],
  },
  tradeDone: { when: 'Ein Tausch mit dir kommt zustande', clips: [clip('friend', 'geschaeft-gut', 'Ein gutes Geschäft.')] },
  myLongestRoad: {
    when: 'Du bekommst die längste Handelsstraße',
    clips: [first('friend', 'handelsstrasse-meister', 'Ein neuer Meister der Handelswege.'), KEIN_WEG],
  },
  myLongestRoadGrows: { when: 'Du baust deine längste Handelsstraße weiter aus', clips: [KEIN_WEG] },
  lostLongestRoad: { when: 'Du verlierst die längste Handelsstraße', clips: [clip('friend', 'handelsstrasse-verloren', 'Wir haben die Handelsstraße verloren!')] },
  myLargestArmy: {
    when: 'Du bekommst die größte Rittermacht',
    clips: [first('friend', 'rittermacht-anfuehrer', 'Die größte Streitmacht hat einen neuen Anführer.')],
  },
  lostLargestArmy: { when: 'Du verlierst die größte Rittermacht', clips: [clip('friend', 'ritter-schwaecher', 'Unsere Ritter sind nicht mehr die stärksten.')] },
  myMonopoly: { when: 'Du spielst ein Monopol', clips: [first('friend', 'monopol', 'Ein Monopol füllt die Schatzkammer.')] },
  myMatchPoint: {
    when: 'Dir fehlt nur noch ein Siegpunkt',
    clips: [clip('friend', 'thron-nah', 'Der Thron ist zum Greifen nah, Mylord.'), clip('friend', 'schritt-krone', 'Nur noch ein Schritt bis zur Krone.')],
  },
  myWin: {
    when: 'Du gewinnst',
    clips: [clip('friend', 'sieg-koenig', 'Lang lebe der König!'), clip('friend', 'sieg-reich', 'Der Sieg ist Euer, Mylord. Das Reich gehört Euch.')],
  },
  playerLeft: { when: 'Ein Mitspieler verliert die Verbindung', clips: [first('friend', 'spieler-verlassen', 'Ein Spieler hat das Spiel verlassen.')] },
  playerBack: { when: 'Ein Mitspieler ist wieder da', clips: [first('friend', 'spieler-zurueck', 'Ein Spieler ist zurückgekehrt.')] },
  robbedMe: {
    when: 'Ein Gegner raubt dich aus',
    clips: [
      first('enemy', 'vorraete-aufgehoben', 'Eure Vorräte sind bei mir besser aufgehoben.'),
      clip('enemy', 'danke-gabe', 'Danke für die Gabe.'),
      clip('enemy', 'nehme-mit', 'Das nehme ich mit.'),
    ],
  },
  robberOnMyHex: { when: 'Ein Gegner setzt den Räuber an dein Feld, ohne dich auszurauben', clips: [clip('enemy', 'felder-brach', 'Eure Felder liegen nun brach.')] },
  enemyMonopoly: { when: 'Ein Gegner spielt ein Monopol gegen dich', clips: [first('enemy', 'alles-meins', 'Mit Euren Vorräten? Alles meins!')] },
  enemyLongestRoad: {
    when: 'Ein Gegner bekommt die längste Handelsstraße',
    clips: [first('enemy', 'strassen-reichen-weit', 'Meine Straßen reichen weit. Euer Einfluss endet hier.')],
  },
  enemyLargestArmy: {
    when: 'Ein Gegner bekommt die größte Rittermacht',
    clips: [first('enemy', 'ritter-bereit', 'Meine Ritter stehen bereit. Wählt Eure nächsten Schritte weise.')],
  },
  enemySettlement: {
    when: 'Ein Gegner baut eine Siedlung (nicht in der Aufbauphase)',
    clips: [
      first('enemy', 'land-gehoert-mir', 'Dieses Land gehört nun mir. Ihr hättet schneller sein müssen.'),
      clip('enemy', 'dorf-banner', 'Ein neues Dorf unter meinem Banner.'),
      clip('enemy', 'volk-breitet', 'Mein Volk breitet sich aus.'),
    ],
  },
  enemyCity: { when: 'Ein Gegner baut eine Stadt', clips: [clip('enemy', 'mauern-wachsen', 'Meine Mauern wachsen.')] },
  enemyRoad: {
    when: 'Ein Gegner baut eine Straße (nicht in der Aufbauphase, höchstens einmal je Zug)',
    clips: [
      first('enemy', 'alle-wege', 'Bald führen alle Wege durch mein Reich.'),
      clip('enemy', 'wege-grenzen', 'Meine Wege reichen schon bis an Eure Grenzen.'),
      clip('enemy', 'noch-eine-strasse', 'Noch eine Straße. Und noch eine.'),
    ],
  },
  tradeRejected: { when: 'Ein Gegner lehnt dein Tauschangebot ab (nur der erste je Angebot)', clips: [clip('enemy', 'handle-nicht', 'Mit Euch handle ich nicht.')] },
  enemyMatchPoint: {
    when: 'Einem Gegner fehlt nur noch ein Siegpunkt',
    clips: [clip('enemy', 'nur-ein-schritt', 'Nur noch ein Schritt, und alles ist mein.'), clip('enemy', 'ende-nah', 'Spürt Ihr es? Das Ende ist nah.')],
  },
  enemyWin: {
    when: 'Ein Gegner gewinnt',
    clips: [clip('enemy', 'reich-gefallen', 'Euer Reich ist gefallen. Es gehört nun mir.'), clip('enemy', 'kniet-nieder', 'Kniet nieder vor Eurem neuen Herrscher!')],
  },
  idle: {
    when: 'Du hast nach deinem Wurf 60 Sekunden lang nichts getan',
    clips: [clip('enemy', 'na-los', 'Na los, Eure Straßen bauen sich nicht von allein.'), clip('enemy', 'zoegert-nur', 'Zögert nur. Ich habe Zeit.')],
  },
};

export const clipUrl = (c: VoiceClip) => `audio/${c.speaker}/${c.id}.${c.ext}`;

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
