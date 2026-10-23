import { audioSettings, channelVolume } from './audio-settings';

/**
 * Sprecher: Der Berater (Ritter) kommentiert, was mir gelingt, der Erzfeind, was die Gegner tun, und der Herold
 * ruft aus, was alle angeht.
 * Jeder hört die Ansagen auf seinem Gerät aus seiner Sicht. Aufnahmen: ElevenLabs, public/audio/.
 */

export type Speaker = 'friend' | 'enemy' | 'herald';

export type VoiceEvent =
  | 'gameStart'
  | 'setupDone'
  | 'specialBuildStart'
  | 'bankEmpty'
  | 'diceReshuffle'
  | 'anyWin'
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
  | 'idle'
  // Erweiterungen und Hausregeln
  | 'islandAny'
  | 'myIsland'
  | 'enemyIsland'
  | 'fogLifted'
  | 'pirateMoved'
  | 'enemyPirateNearMe'
  | 'myShip'
  | 'enemyShip'
  | 'myGold'
  | 'enemyGold'
  | 'raidersNear'
  | 'raidersAttack'
  | 'raidersRepelled'
  | 'myGuardsHeld'
  | 'myCityRaided'
  | 'raidGloat'
  | 'myImprovement'
  | 'metropolisAny'
  | 'myMetropolis'
  | 'enemyMetropolis'
  | 'bridgeBuilt'
  | 'myCoinLead'
  | 'myFish'
  | 'myAnchor'
  | 'anchorFromEnemy'
  | 'myHarborMaster'
  | 'enemyHarborMaster'
  | 'myRoadBuilding'
  | 'myInvention'
  | 'tradeAccepted'
  | 'neutralBlocks';

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
/** Zugbeginn ohne Würfel: passen auch in der Aufbauphase. */
const TURN_ANYTIME = [
  SIRE,
  WOHLAN,
  clip('friend', 'zug-volk', 'Euer Volk erwartet Eure Befehle.'),
  clip('friend', 'zug-reich', 'Das Reich wartet auf Euch, Mylord.'),
  clip('friend', 'zug-stunde', 'Eure Stunde ist gekommen.'),
  clip('friend', 'zug-wort', 'Ihr habt das Wort, Mylord.'),
  clip('friend', 'zug-glueck', 'Möge das Glück Euch hold sein.'),
  clip('friend', 'zug-herrscht', 'Zeigt ihnen, wer hier herrscht.'),
];
const KEIN_WEG = first('friend', 'handelsstrasse-weiter', 'Kein Handelsweg reicht weiter.');

export const VOICE: Record<VoiceEvent, { when: string; clips: VoiceClip[] }> = {
  gameStart: { when: 'Das Spiel beginnt', clips: [clip('herald', 'spiel-beginnt', 'Hört, hört! Das Land ist verteilt. Das Spiel beginnt!')] },
  setupDone: { when: 'Die Aufbauphase ist vorbei', clips: [clip('herald', 'wuerfel-sprechen', 'Die Siedlungen stehen. Nun sprechen die Würfel!')] },
  specialBuildStart: { when: 'Eine Sonderbaurunde beginnt', clips: [clip('herald', 'sonderbaurunde', 'Die Sonderbaurunde ist eröffnet!')] },
  bankEmpty: { when: 'Ein Rohstoff ist in der Bank ausgegangen (höchstens alle 10 Züge)', clips: [clip('herald', 'bank-leer', 'Die Speicher der Bank sind leer!')] },
  diceReshuffle: { when: 'Würfelstapel: Die Karten werden neu gemischt', clips: [clip('herald', 'neu-gemischt', 'Die Karten werden neu gemischt!')] },
  anyWin: { when: 'Jemand gewinnt (vor Berater oder Erzfeind)', clips: [clip('herald', 'neuer-herrscher', 'Hört, hört! Das Land hat einen neuen Herrscher!')] },
  myTurn: {
    when: 'Du bist dran',
    clips: [
      ...TURN_ANYTIME,
      first('friend', 'zug-wuerfel', 'Die Würfel warten auf Euch, Mylord.'),
      clip('friend', 'zug-wuerfel-glueck', 'Nehmt die Würfel, Sire. Das Glück ist mit Euch.'),
      clip('friend', 'zug-neues', 'Auf ein Neues, Mylord.'),
    ],
  },
  mySetupTurn: {
    when: 'Du bist dran in der Aufbauphase',
    clips: [...TURN_ANYTIME, clip('friend', 'reich-gedeihen', 'Möge Euer Reich gedeihen.')],
  },
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
    when: 'Dir fehlt nur noch ein Siegpunkt (höchstens alle 6 Züge)',
    clips: [clip('friend', 'thron-nah', 'Der Thron ist zum Greifen nah, Mylord.'), clip('friend', 'schritt-krone', 'Nur noch ein Schritt bis zur Krone.')],
  },
  myWin: {
    when: 'Du gewinnst',
    clips: [clip('friend', 'sieg-koenig', 'Lang lebe der König!'), clip('friend', 'sieg-reich', 'Der Sieg ist Euer, Mylord. Das Reich gehört Euch.')],
  },
  playerLeft: { when: 'Ein Mitspieler verliert die Verbindung', clips: [clip('herald', 'spieler-verlassen', 'Hört, hört! Ein Spieler hat die Tafel verlassen.')] },
  playerBack: { when: 'Ein Mitspieler ist wieder da', clips: [clip('herald', 'spieler-zurueck', 'Ein Spieler ist an die Tafel zurückgekehrt!')] },
  robbedMe: {
    when: 'Ein Gegner raubt dich aus',
    clips: [
      first('enemy', 'vorraete-aufgehoben', 'Eure Vorräte sind bei mir besser aufgehoben.'),
      clip('enemy', 'danke-gabe', 'Danke für die Gabe.'),
      clip('enemy', 'nehme-mit', 'Das nehme ich mit.'),
    ],
  },
  robberOnMyHex: { when: 'Ein Gegner setzt den Räuber an dein Feld, ohne dich auszurauben', clips: [clip('enemy', 'felder-brach', 'Eure Felder liegen nun brach.')] },
  enemyMonopoly: {
    when: 'Ein Gegner spielt ein Monopol gegen dich',
    clips: [first('enemy', 'alles-meins', 'Mit Euren Vorräten? Alles meins!'), clip('enemy', 'alles-ihr-habt', 'Alles, was Ihr habt, gehört nun mir.')],
  },
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
    when: 'Einem Gegner fehlt nur noch ein Siegpunkt (höchstens alle 6 Züge)',
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

  // Entwicklungskarten und Handel
  myRoadBuilding: { when: 'Du spielst Straßenbau', clips: [clip('friend', 'strassenbauer', 'Die Straßenbauer stehen bereit.')] },
  myInvention: { when: 'Du spielst Erfindung', clips: [clip('friend', 'erfindung', 'Eine kluge Erfindung, Mylord.')] },
  tradeAccepted: { when: 'Ein Gegner nimmt dein Tauschangebot an (nur der erste je Angebot)', clips: [clip('enemy', 'nehme-angebot', 'Gut. Ich nehme, was Ihr bietet.')] },

  // Seewege
  islandAny: { when: 'Seewege: Jemand siedelt auf einer neuen Insel', clips: [clip('herald', 'neues-land', 'Neues Land in Sicht!')] },
  myIsland: { when: 'Seewege: deine erste Siedlung auf einer neuen Insel (nach dem Herold)', clips: [clip('friend', 'neues-land-reich', 'Neues Land für Euer Reich!')] },
  enemyIsland: { when: 'Seewege: Ein Gegner besiedelt eine neue Insel (nach dem Herold)', clips: [clip('enemy', 'insel-mir', 'Diese Insel gehört mir.')] },
  myShip: { when: 'Seewege: Du baust ein Schiff (höchstens einmal je Zug)', clips: [clip('friend', 'schiff-stapel', 'Ein Schiff läuft vom Stapel.')] },
  enemyShip: { when: 'Seewege: Ein Gegner baut ein Schiff (höchstens einmal je Zug)', clips: [clip('enemy', 'schiffe-meer', 'Meine Schiffe beherrschen das Meer.')] },
  myGold: { when: 'Seewege: Gold für dich', clips: [clip('friend', 'gold-waehlt', 'Gold, Mylord! Wählt weise.')] },
  enemyGold: { when: 'Seewege: Gold für einen Gegner', clips: [clip('enemy', 'gold-mich', 'Gold! Und alles für mich.')] },
  pirateMoved: { when: 'Seewege: Das Kaperschiff wird versetzt', clips: [clip('herald', 'kaperschiff', 'Das Kaperschiff kreuzt vor der Küste!')] },
  enemyPirateNearMe: {
    when: 'Seewege: Ein Gegner setzt das Kaperschiff an deine Küste (statt des Herolds)',
    clips: [clip('enemy', 'kaperschiff-ladung', 'Mein Kaperschiff wartet auf Eure Ladung.')],
  },
  fogLifted: { when: 'Im Dunst: Der Nebel wird aufgedeckt', clips: [clip('herald', 'nebel', 'Der Nebel lichtet sich!')] },

  // Stadtwacht
  raidersNear: { when: 'Stadtwacht: Die Flotte steht ein Feld vor dem Angriff', clips: [clip('herald', 'pluenderer-naeher', 'Die Plünderer segeln näher!')] },
  raidersAttack: { when: 'Stadtwacht: Die Flotte greift an', clips: [clip('herald', 'pluenderer-landen', 'Die Plünderer landen! Zu den Waffen!')] },
  raidersRepelled: { when: 'Stadtwacht: Angriff abgewehrt', clips: [clip('herald', 'pluenderer-zurueck', 'Die Plünderer sind zurückgeschlagen!')] },
  myGuardsHeld: { when: 'Stadtwacht: Du verteidigst am meisten (Ehrenschild)', clips: [clip('friend', 'waechter-gehalten', 'Unsere Wächter haben die Stadt gehalten!')] },
  myCityRaided: { when: 'Stadtwacht: Du verlierst beim Angriff eine Stadt', clips: [clip('friend', 'stadt-verwuestet', 'Die Plünderer haben unsere Stadt verwüstet!')] },
  raidGloat: { when: 'Stadtwacht: nach dem Berater, wenn du eine Stadt verlierst', clips: [clip('enemy', 'mauern-schwach', 'Eure Mauern waren zu schwach.')] },
  myImprovement: { when: 'Stadtwacht: Du baust deine Stadt aus', clips: [clip('friend', 'stadt-gedeiht', 'Eure Stadt gedeiht.')] },
  metropolisAny: { when: 'Stadtwacht: Eine Prachtstadt entsteht', clips: [clip('herald', 'prachtstadt', 'Eine Prachtstadt erhebt sich über das Land!')] },
  myMetropolis: {
    when: 'Stadtwacht: deine Prachtstadt (nach dem Herold)',
    clips: [clip('friend', 'prachtstadt-euer', 'Eine Prachtstadt, Mylord! Das ganze Land blickt auf Euch.')],
  },
  enemyMetropolis: { when: 'Stadtwacht: Prachtstadt eines Gegners (nach dem Herold)', clips: [clip('enemy', 'prachtstadt-zittert', 'Seht meine Prachtstadt und zittert!')] },

  // Fischgründe, Flussläufe, Hafenvogt, Duell
  myFish: { when: 'Fischgründe: Du fängst Fisch', clips: [clip('friend', 'fang-ufer', 'Ein guter Fang am Ufer.')] },
  myAnchor: { when: 'Fischgründe: Du ziehst den Rostigen Anker', clips: [clip('friend', 'anker-euch', 'Der Rostige Anker hängt nun an Euch, Mylord.')] },
  anchorFromEnemy: { when: 'Fischgründe: Ein Gegner gibt dir den Rostigen Anker', clips: [clip('enemy', 'anker-wuerde', 'Tragt den Anker mit Würde.')] },
  bridgeBuilt: { when: 'Flussläufe: Jemand baut eine Brücke', clips: [clip('herald', 'bruecke', 'Eine Brücke spannt sich über den Fluss.')] },
  myCoinLead: { when: 'Flussläufe: Du hast allein die meisten Münzen', clips: [clip('friend', 'reichster-fluss', 'Ihr seid der reichste Herr am Fluss.')] },
  myHarborMaster: { when: 'Hafenvogt: Du bekommst die Sonderkarte', clips: [clip('friend', 'herr-haefen', 'Ihr seid nun Herr der Häfen.')] },
  enemyHarborMaster: { when: 'Hafenvogt: Ein Gegner bekommt die Sonderkarte', clips: [clip('enemy', 'haefen-mir', 'Die Häfen gehören jetzt mir.')] },
  neutralBlocks: {
    when: 'Duell: Ein Gegner setzt eine neutrale Figur an deine Straßen',
    clips: [clip('enemy', 'hindernis', 'Ein Hindernis auf Eurem Weg? Wie bedauerlich.')],
  },
};

export const clipUrl = (c: VoiceClip) => `audio/${c.speaker}/${c.id}.${c.ext}`;

/** Bei voll aufgedrehtem Regler; mal der Lautstärke des Kanals „Sprecher“. */
const MAX_VOLUME = 0.95;
/** Ansagen, die so lange warten mussten, kommen nicht mehr: Der Moment ist vorbei. Etwas länger als der längste Satz. */
const STALE_MS = 6500;
/** Grobe Länge, bis die Datei ihre echte Dauer kennt. */
const GUESS_SECONDS = 3;

/** Spielt Ansagen nacheinander, nie zwei Stimmen gleichzeitig; `onSpeak` bekommt die Dauer (Musik leiser). */
export class Announcer {
  private current: HTMLAudioElement | null = null;
  private queue: { clip: VoiceClip; at: number; volume: number }[] = [];
  /** Zuletzt gespielte Fassungen je Ereignis, neueste zuerst. */
  private readonly recent = new Map<VoiceEvent, string[]>();

  constructor(private readonly onSpeak: (seconds: number) => void = () => undefined) {}

  /**
   * Eine Ansage zu einem Ereignis, nach `delayMs`, mit der Lautstärke des Kanals „Sprecher“ (aus: still).
   * Eine Fassung kommt erst wieder, wenn mindestens die Hälfte der anderen gelaufen ist.
   */
  say(event: VoiceEvent, delayMs = 0): void {
    if (channelVolume('voice') <= 0) return;
    const clips = VOICE[event].clips;
    const recent = this.recent.get(event) ?? [];
    const blocked = new Set(recent.slice(0, Math.max(1, Math.floor(clips.length / 2))));
    const options = clips.length > 1 ? clips.filter((c) => !blocked.has(c.id)) : clips;
    const chosen = options[Math.floor(Math.random() * options.length)];
    this.recent.set(event, [chosen.id, ...recent.filter((id) => id !== chosen.id)].slice(0, clips.length));
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
