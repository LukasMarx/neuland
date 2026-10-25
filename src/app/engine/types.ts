export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export const RESOURCES: readonly Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

/** Stadtwacht: Güter aus Städten auf Wald (Schriften), Weide (Stoff) und Gebirge (Silber). */
export type Commodity = 'paper' | 'cloth' | 'coin';
export const COMMODITIES: readonly Commodity[] = ['paper', 'cloth', 'coin'];

/** Alles, was man auf der Hand halten, tauschen, abwerfen und verlieren kann. */
export type Card = Resource | Commodity;
export const CARDS: readonly Card[] = [...RESOURCES, ...COMMODITIES];

/**
 * `sea`, `gold` und `fog` gibt es nur auf Seewege-Karten. Gold liefert einen Rohstoff nach Wahl,
 * `fog` ist ein noch verdecktes Feld (Land oder Meer, entschieden erst beim Aufdecken).
 * `lake` ist der See der Fischgründe: Land statt Wüste, liefert Fische bei 2, 3, 11 und 12.
 */
export type Terrain = Resource | 'desert' | 'sea' | 'gold' | 'fog' | 'lake';
/**
 * Karten auf der Hand oder in der Bank. Güter sind optional: Wo sie fehlen, zählen sie als 0. So bleibt
 * der Stand ohne Stadtwacht genau wie bisher, und alte Spielstände passen weiter.
 */
export type ResourceCounts = Record<Resource, number> & Partial<Record<Commodity, number>>;
export type DevCard = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';
export type HarborType = Resource | 'any';

/** Klassisches Brett: base = bis 4 Spieler (19 Felder), ext = 5–6 Spieler (30 Felder). */
export type Layout = 'base' | 'ext' | 'big';

export interface HexState {
  terrain: Terrain;
  number: number | null;
}

export interface HarborState {
  type: HarborType;
  edge: number;
}

export interface BoardState {
  /** Gewählte Karte (siehe maps.ts); fehlt bei alten Spielständen, dann klassisch. */
  map?: string;
  /** Felder in „doubled coordinates“, zeilenweise; daraus entsteht die Topologie. */
  cells?: [number, number][];
  /** Nur beim klassischen Brett, und bei alten Spielständen statt `cells`. */
  layout?: Layout;
  hexes: HexState[];
  harbors: HarborState[];
  /** Fischgründe (Variante): Küstenkanten mit Zahl. */
  fishing?: FishingGround[];
  /** Flussläufe (Variante): Flüsse von der Quelle zur Mündung. */
  rivers?: River[];
  /** Die Verschollenen: Felder der bewohnten Inseln. Dort siedelt niemand, und sie tragen keine Zahl. */
  tribe?: number[];
  /** Kamelzüge: das Feld der Oase, von der die Karawanen ausgehen. */
  oasis?: number;
}

/** Die Verschollenen: Geschenk an einer Küstenkante; wer dort ein Schiff baut, bekommt es. */
export interface Gift {
  edge: number;
  kind: 'point' | 'dev' | 'harbor';
  /** Nur beim Hafen: welcher. */
  harbor?: HarborType;
}

/** Stoffhandel: Dorf auf einer Küstenkante mit Zahl und Vorrat an Stoffballen. */
export interface Village {
  edge: number;
  number: number;
  stock: number;
}

/** Freibeuterbuchten: Festung auf einer Ecke, die nur ihr Besitzer erobern kann. */
export interface Fortress {
  vertex: number;
  owner: number;
  /** Mauern, die noch stehen; bei 0 ist sie erobert und eine Siedlung ihres Besitzers. */
  walls: number;
}

/** Großbauten: wem ein Bauwerk gehört und wie weit es ist (Stufen 0 bis 4). */
export interface WonderState {
  owner: number | null;
  level: number;
}

/** Wohin es nach einer Zwischenphase weitergeht, die beim Bauen entsteht. */
export type BuildPhase = { kind: 'main' } | { kind: 'specialBuild'; queue: number[] };

/**
 * Ein Fluss: Felder von der Quelle bis zur Küste und die Kanten, über die er fließt. `edges[i]` liegt
 * zwischen `hexes[i]` und `hexes[i + 1]`, die letzte Kante ist die Mündung an der Küste. Auf diesen
 * Kanten gibt es keine Straße, nur eine Brücke.
 */
export interface River {
  hexes: number[];
  edges: number[];
}

export interface FishingGround {
  edge: number;
  number: number;
}

export interface Building {
  owner: number;
  type: 'settlement' | 'city';
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  resources: ResourceCounts;
  devCards: DevCard[];
  /** Diese Runde gekauft, erst ab dem nächsten Zug spielbar. */
  newDevCards: DevCard[];
  knights: number;
  /** Duell: neutraler Mitspieler, der nie am Zug ist; seine Teile setzen die echten Spieler. */
  neutral?: boolean;
  /**
   * Nur in der Sicht eines anderen Spielers (siehe secrets.ts): Handkarten, Entwicklungskarten und Fische
   * sind dann leer, bekannt ist nur, wie viele es sind.
   */
  hidden?: HiddenCounts;
}

export interface HiddenCounts {
  cards: number;
  dev: number;
  fish: number;
  /** Stadtwacht: Einflusskarten je Farbe; die Rückseiten sieht jeder. */
  progress?: Record<Track, number>;
}

export interface TradeOffer {
  id: number;
  from: number;
  /** Aus Sicht von `from`: was er abgibt und was er bekommt. */
  give: ResourceCounts;
  want: ResourceCounts;
  /** Gegenangebot eines Mitspielers an den aktiven Spieler. */
  counter: boolean;
  accepted: number[];
  declined: number[];
}

export type ReturnPhase = 'roll' | 'main';

export type Phase =
  /** `owners[index]`: für wen gesetzt wird, falls nicht für sich selbst (Duell: Teile der Neutralen). */
  | { kind: 'setup'; order: number[]; index: number; step: 'settlement' | 'road'; settlement: number | null; owners?: number[] }
  | { kind: 'roll' }
  /**
   * pending[seat] = Anzahl Karten, die dieser Spieler noch abwerfen muss. Einflusskarten nutzen die Phase
   * auch: `to` bekommt die Karten statt der Bank, und mit `then` geht es danach ohne Räuber weiter.
   */
  | { kind: 'discard'; pending: number[]; to?: number; then?: 'main' }
  /** `all`: Steuereintreiber, zieht bei jedem am Feld eine Karte. */
  | { kind: 'robber'; returnTo: ReturnPhase; all?: boolean }
  | { kind: 'main' }
  | { kind: 'roadBuilding'; remaining: number; returnTo: ReturnPhase }
  /** Sonderbauphase (5–6 Spieler): queue[0] ist gerade dran. */
  | { kind: 'specialBuild'; queue: number[] }
  /** Goldfeld hat geliefert (Seewege): pending[seat] = Rohstoffe, die dieser Spieler noch wählt. */
  | { kind: 'gold'; pending: number[] }
  /** Duell: Nach einem Bau setzt der Spieler ein Teil für einen neutralen Mitspieler. */
  | { kind: 'neutral'; piece: 'road' | 'settlement' }
  /**
   * Stadtwacht: Die Plündererflotte hat gesiegt; pending[seat] = 1, wer noch eine Stadt abgeben muss.
   * Danach geht der Wurf `sum` weiter (Ertrag oder 7).
   */
  | { kind: 'raid'; pending: number[]; sum: number }
  /** Stadtwacht: Ein verdrängter Wächter sucht einen neuen Platz an den Straßen seines Besitzers. */
  | { kind: 'displace'; seat: number; guard: Guard }
  /**
   * Stadtwacht III: Gleichstand bei der Abwehr; pending[seat] = 1, wer noch die Farbe seiner Einflusskarte
   * wählt. Danach geht der Wurf `sum` weiter.
   */
  | { kind: 'progressPick'; pending: number[]; sum: number }
  /**
   * Schuldschein und Kundschafter: `seat` sieht Handkarten oder Einflusskarten von `target` und nimmt sich
   * `take` Karten davon. Nur in dieser Phase zeigt die Sicht von `seat` die fremden Karten.
   */
  | { kind: 'peek'; seat: number; target: number; what: 'cards' | 'progress'; take: number }
  /**
   * Kamelzüge: Nach einem Bau bieten alle verdeckt Getreide und Wolle für das nächste Kamel. `bids[seat]` ist
   * das Gebot, `done[seat]`, ob es abgegeben ist; in der Sicht der anderen fehlt das Gebot. `builder` hat gebaut.
   */
  | { kind: 'camelVote'; builder: number; bids: (ResourceCounts | null)[]; done: boolean[]; resume: BuildPhase }
  /** Kamelzüge: Wer das Gebot gewonnen hat, setzt das Kamel. */
  | { kind: 'camelPlace'; seat: number; resume: BuildPhase }
  /** Freibeuterbuchten: Der Ritter macht aus einem eigenen Schiff ein Kriegsschiff. */
  | { kind: 'warship'; returnTo: ReturnPhase }
  | { kind: 'ended' };

/** Wo eine Karte herkommt oder hingeht, für die Flug-Animation. */
export type TransferPoint =
  | { kind: 'bank' }
  | { kind: 'player'; seat: number }
  | { kind: 'hex'; id: number }
  | { kind: 'vertex'; id: number }
  | { kind: 'edge'; id: number };

export interface Transfer {
  from: TransferPoint;
  to: TransferPoint;
  card: Card | 'dev';
  count: number;
  /** Nur Geber und Nehmer sehen, welche Karte es ist (Räuber). */
  hidden?: boolean;
}

export interface GameSettings {
  victoryPoints: number;
  /** Karte, Vorgabe „klassisch“. */
  map?: string;
  /** Zugeschaltete kleine Varianten (siehe variants.ts). */
  variants?: string[];
}

export interface LogEntry {
  seat: number | null;
  text: string;
}

/** Statistik für den Endstand. Nur öffentlich Bekanntes, damit sie in jeder Sicht stehen darf. */
export interface GameStats {
  /** Würfe je Augensumme, Index = Summe (0 und 1 bleiben leer). */
  dice: number[];
  /** Je Sitz: Rohstoffe aus Feldern (Aufstellung, Würfeln und Gold). */
  produced: number[];
  /** Je Sitz: Erträge, die der Räuber verhindert hat. */
  blocked: number[];
  /** Je Sitz: Karten, die man anderen mit dem Räuber genommen hat, und die einem genommen wurden. */
  stolen: number[];
  robbed: number[];
  /** Je Sitz: bei einer 7 abgeworfene Karten. */
  discarded: number[];
  /** Je Sitz: Tauschgeschäfte mit Mitspielern und an Bank oder Hafen abgegebene Karten. */
  trades: number[];
  bankCards: number[];
  /** Je Sitz: gekaufte Entwicklungskarten. */
  devBought: number[];
  /**
   * Offene Siegpunkte je Sitz nach einem Zug; der letzte Eintrag ist der Endstand mit allen Punkten.
   * Lange Spiele werden ausgedünnt (siehe stats.ts), deshalb steht der Zug dabei.
   */
  vp: { turn: number; points: number[] }[];
}

export interface GameState {
  /** Kennung dieser Partie. Stände verschiedener Partien werden nie über die Version verglichen. */
  id?: string;
  /**
   * Gesetzt, wenn dies nur die Sicht eines Spielers ist (Sitz, -1 für Zuschauer): fremde Karten und der
   * Inhalt des Entwicklungsstapels fehlen. Den vollen Stand hat nur der Host.
   */
  view?: number;
  /** In einer Sicht: Größe des Entwicklungsstapels, dessen Inhalt fehlt. */
  hiddenDeck?: number;
  /** Anfangsvorrat je Rohstoff; damit lassen sich verdeckte Hände wieder aufbauen. */
  supply?: number;
  /** Ausgespielte Entwicklungskarten, offen für alle. */
  playedDev?: DevCard[];
  version: number;
  /**
   * Letzte angewendete Aktion je Client (Sitzung und Laufnummer). Wandert beim Host-Wechsel mit,
   * damit eine erneut gesendete Aktion nie doppelt angewendet wird.
   */
  acks?: Record<string, { s: string; n: number }>;
  rng: number;
  settings: GameSettings;
  board: BoardState;
  players: PlayerState[];
  bank: ResourceCounts;
  devDeck: DevCard[];
  buildings: (Building | null)[];
  roads: (number | null)[];
  robber: number;
  current: number;
  turn: number;
  phase: Phase;
  dice: [number, number] | null;
  devPlayed: boolean;
  longestRoad: number | null;
  roadLengths: number[];
  largestArmy: number | null;
  offers: TradeOffer[];
  nextOfferId: number;
  log: LogEntry[];
  /** Kartenbewegungen der letzten Aktion. */
  transfers: Transfer[];
  winner: number | null;
  /** Fehlt in Spielständen von vor der Statistik. */
  stats?: GameStats;
  /** Hafenvogt (Variante): Sitz mit der Sonderkarte, sonst null. */
  harborMaster?: number | null;
  /** Würfelstapel (Variante): verbleibende Karten je Summe. Keine Reihenfolge, gezogen wird erst beim Würfeln. */
  diceDeck?: Record<number, number>;
  /** Seewege: Schiffe je Kante (Besitzer), parallel zu `roads`. */
  ships?: (number | null)[];
  /** Seewege: Feld des Kaperschiffs (ein Meerfeld). */
  pirate?: number | null;
  /** Seewege: in diesem Zug gebaute Schiffe (dürfen nicht versetzt werden) und ob schon versetzt wurde. */
  shipsBuilt?: number[];
  shipMoved?: boolean;
  /** Seewege: Siegpunkte aus dem Inselbonus je Sitz. */
  islandBonus?: number[];
  /**
   * Seewege „Im Dunst“: was unter den verdeckten Feldern noch liegt, nur als Zählwerk. Welches Feld
   * was wird, entscheidet erst der Zufall beim Aufdecken, deshalb steht es vorher nirgends im Stand.
   */
  fog?: FogPool;
  /** Fischgründe: Fischplättchen (Werte 1–3) je Sitz, der verdeckte Stapel als Zählwerk, Inhaber des Rostigen Ankers. */
  fish?: number[][];
  fishPool?: Record<string, number>;
  anchor?: number | null;
  /** Duell: Handelsmarken je Sitz. */
  tokens?: number[];
  /** Flussläufe: Münzen je Sitz. */
  coins?: number[];
  /** Stadtwacht: Ausbaustufen je Sitz, Prachtstädte je Richtung (Ecke) und Palisaden (Ecken mit Stadt). */
  improvements?: Improvements[];
  metropolis?: Record<Track, number | null>;
  walls?: number[];
  /** Stadtwacht II: Wächter je Ecke, Plündererflotte, Ehrenschilde je Sitz und das Ergebnis des Ereigniswürfels. */
  guards?: (Guard | null)[];
  raiders?: { position: number; attacked: boolean };
  honors?: number[];
  event?: EventFace | null;
  /**
   * Stadtwacht III: Einflusskarten auf der Hand je Sitz, die drei Stapel als Zählwerk, ausgespielte und
   * ausgelegte Karten (offen) und Punkte aus Punktkarten je Sitz.
   */
  progress?: ProgressCard[][];
  progressDeck?: Record<Track, Partial<Record<ProgressCard, number>>>;
  progressPlayed?: ProgressCard[];
  progressPoints?: number[];
  /** In einer Sicht: Größe der Einflussstapel, deren Inhalt fehlt. */
  hiddenProgressDeck?: Record<Track, number>;
  /** Stadtwacht III: Händlerfigur auf einem Feld; ihr Besitzer tauscht dessen Rohstoff 2:1 und hat 1 Punkt. */
  trader?: { hex: number; owner: number } | null;
  /** Was ausgespielte Einflusskarten für den laufenden Zug bewirken. */
  boost?: { pulley?: boolean; tradingPost?: Card };
  /** Die Verschollenen: Geschenke, die noch an der Küste liegen, Punkte daraus und Häfen, die noch gesetzt werden. */
  gifts?: Gift[];
  giftPoints?: number[];
  harborGifts?: HarborType[][];
  /** Stoffhandel: Dörfer mit ihrem Vorrat und die Stoffballen je Sitz (2 Ballen = 1 Siegpunkt). */
  villages?: Village[];
  bales?: number[];
  /**
   * Freibeuterbuchten: Festungen, Kriegsschiffe (Kanten), die feste Route des Kaperschiffs (Meerfelder) und ob
   * in diesem Zug schon eine Festung angegriffen wurde.
   */
  fortresses?: Fortress[];
  warships?: number[];
  pirateRoute?: number[];
  fortressAttacked?: boolean;
  /** Freibeuterbuchten, nur während eines Wurfs: wer das Kaperschiff abgewehrt hat und einen Rohstoff wählt. */
  pirateLoot?: number[];
  /** Großbauten: je Bauwerk Besitzer und Stufe. */
  wonders?: WonderState[];
  /** Kamelzüge: die Karawanen als Kantenlisten von der Oase aus, das letzte Kamel am Ende. */
  caravans?: number[][];
}

/** Stadtwacht: Wächter auf einer Ecke. `ready` = Zug, ab dem er nach dem Aktivieren handeln darf. */
export interface Guard {
  owner: number;
  level: 1 | 2 | 3;
  active: boolean;
  ready?: number;
}

/** Ereigniswürfel: drei Seiten Schiff, je eine Seite ein Tor in der Farbe einer Ausbaurichtung. */
export type EventFace = 'ship' | Track;

/** Stadtwacht: die drei Ausbaurichtungen, bezahlt mit Stoff, Silber und Schriften. */
export type Track = 'market' | 'council' | 'scholars';
export const TRACKS: readonly Track[] = ['market', 'council', 'scholars'];
export type Improvements = Record<Track, number>;
export const TRACK_GOODS: Record<Track, Commodity> = { market: 'cloth', council: 'coin', scholars: 'paper' };
export const TRACK_NAMES: Record<Track, string> = { market: 'Markt', council: 'Rat', scholars: 'Gelehrte' };

/**
 * Stadtwacht III: Einflusskarten, eigene Fassung. Gelb (Markt) handelt, Blau (Rat) regiert, Grün
 * (Gelehrte) baut und forscht. Weitere Karten mit Zielen auf dem Brett kommen später dazu.
 */
export type ProgressCard =
  | 'bulkBuy'
  | 'guildRight'
  | 'tradingPost'
  | 'charter'
  | 'alarmBell'
  | 'agitator'
  | 'banquet'
  | 'taxCollector'
  | 'pulley'
  | 'pileDriver'
  | 'waterwheel'
  | 'gallery'
  | 'lodge'
  | 'observatory'
  | 'surveyor'
  | 'armory'
  | 'peddler'
  | 'bond'
  | 'fair'
  | 'turncoat'
  | 'envoy'
  | 'intrigue'
  | 'scout'
  | 'fortune'
  | 'landReform';

export interface ProgressDef {
  name: string;
  track: Track;
  /** Wie oft die Karte im Stapel liegt. */
  copies: number;
  text: string;
  /** Punktkarte: wird sofort ausgelegt. */
  point?: boolean;
  /** Was beim Ausspielen gewählt wird. */
  target?:
    | 'resource'
    | 'commodity'
    | 'card'
    | 'city'
    | 'settlement'
    | 'guards'
    | 'trader'
    | 'richer'
    | 'player'
    | 'turncoat'
    | 'road'
    | 'enemyGuard'
    | 'dice'
    | 'numbers';
  /** Wird vor dem Würfeln gespielt (statt danach). */
  beforeRoll?: boolean;
}

export const PROGRESS: Record<ProgressCard, ProgressDef> = {
  bulkBuy: { name: 'Großeinkauf', track: 'market', copies: 4, target: 'resource', text: 'Nenne einen Rohstoff. Jeder Mitspieler gibt dir bis zu 2 Karten davon.' },
  guildRight: { name: 'Zunftrecht', track: 'market', copies: 2, target: 'commodity', text: 'Nenne ein Gut. Jeder Mitspieler gibt dir 1 Karte davon, wenn er eine hat.' },
  tradingPost: { name: 'Frachtkontor', track: 'market', copies: 2, target: 'card', text: 'Wähle eine Kartenart. Bis zum Ende deines Zuges tauschst du sie 2:1 mit der Bank.' },
  charter: { name: 'Stadtrecht', track: 'council', copies: 1, point: true, text: '1 Siegpunkt. Wird sofort offen ausgelegt.' },
  alarmBell: { name: 'Alarmglocke', track: 'council', copies: 2, text: 'Alle deine ruhenden Wächter werden kostenlos einsatzbereit.' },
  agitator: { name: 'Unruhestifter', track: 'council', copies: 2, text: 'Wer mindestens so viele Siegpunkte hat wie du, wirft die Hälfte seiner Handkarten ab.' },
  banquet: { name: 'Festbankett', track: 'council', copies: 2, text: 'Wer mehr Siegpunkte hat als du, schenkt dir 2 Handkarten seiner Wahl.' },
  taxCollector: { name: 'Steuereintreiber', track: 'council', copies: 2, text: 'Versetze den Räuber und ziehe bei jedem, der an das Feld grenzt, eine Karte.' },
  pulley: { name: 'Flaschenzug', track: 'scholars', copies: 2, text: 'Dein nächster Stadtausbau in diesem Zug kostet ein Gut weniger.' },
  pileDriver: { name: 'Pfahlramme', track: 'scholars', copies: 1, target: 'city', text: 'Baue kostenlos eine Palisade unter eine deiner Städte.' },
  waterwheel: { name: 'Wasserrad', track: 'scholars', copies: 2, text: 'Je Getreidefeld an deinen Siedlungen und Städten bekommst du 2 Getreide.' },
  gallery: { name: 'Stollen', track: 'scholars', copies: 2, text: 'Je Gebirge an deinen Siedlungen und Städten bekommst du 2 Erz.' },
  lodge: { name: 'Bauhütte', track: 'scholars', copies: 2, target: 'settlement', text: 'Mache eine Siedlung für 2 Erz und 1 Getreide zur Stadt.' },
  observatory: { name: 'Sternwarte', track: 'scholars', copies: 1, point: true, text: '1 Siegpunkt. Wird sofort offen ausgelegt.' },
  surveyor: { name: 'Landvermesser', track: 'scholars', copies: 2, text: 'Baue 2 Straßen kostenlos.' },
  armory: { name: 'Waffenkammer', track: 'scholars', copies: 2, target: 'guards', text: 'Werte bis zu 2 deiner Wächter kostenlos auf.' },
  peddler: { name: 'Wanderhändler', track: 'market', copies: 6, target: 'trader', text: 'Setze den Händler auf ein Feld an deiner Siedlung oder Stadt. Solange er dir gehört, tauschst du dessen Rohstoff 2:1 und hast 1 Siegpunkt.' },
  bond: { name: 'Schuldschein', track: 'market', copies: 2, target: 'richer', text: 'Sieh dir die Hand eines Spielers mit mehr Siegpunkten an und nimm dir 2 Karten davon.' },
  fair: { name: 'Jahrmarkt', track: 'market', copies: 2, target: 'resource', text: 'Nenne einen Rohstoff. Jeder Mitspieler mit Gütern bekommt 1 Karte davon von dir und gibt dir 1 zufälliges Gut.' },
  turncoat: { name: 'Überläufer', track: 'council', copies: 2, target: 'turncoat', text: 'Nimm einen fremden Wächter vom Brett und stelle einen eigenen derselben Stufe an deine Straße.' },
  envoy: { name: 'Gesandter', track: 'council', copies: 2, target: 'road', text: 'Entferne eine offene Straße. Ist es deine eigene, baust du sie gleich kostenlos neu.' },
  intrigue: { name: 'Ränkespiel', track: 'council', copies: 2, target: 'enemyGuard', text: 'Verdränge einen fremden Wächter an deiner Straße. Sein Besitzer setzt ihn um.' },
  scout: { name: 'Kundschafter', track: 'council', copies: 3, target: 'player', text: 'Sieh dir die Einflusskarten eines Mitspielers an und nimm dir eine davon.' },
  fortune: { name: 'Losbuch', track: 'scholars', copies: 2, target: 'dice', beforeRoll: true, text: 'Spiele die Karte statt zu würfeln: Du legst beide Zahlenwürfel selbst fest, der Ereigniswürfel wird geworfen.' },
  landReform: { name: 'Flurbereinigung', track: 'scholars', copies: 2, target: 'numbers', text: 'Tausche zwei Zahlenchips auf dem Brett. 2, 12, 6 und 8 bleiben liegen.' },
};

export const PROGRESS_CARDS = Object.keys(PROGRESS) as ProgressCard[];

/** Duell: wofür man Handelsmarken ausgibt. */
export type TokenEffect = 'trade' | 'robber';

/** Was das Ausgeben von Fischen bringt (Fischgründe). */
export type FishEffect = 'robber' | 'steal' | 'bank' | 'road' | 'devCard';

export const FISH_COSTS: Record<FishEffect, number> = { robber: 2, steal: 3, bank: 4, road: 5, devCard: 7 };

export interface FogPool {
  terrain: Partial<Record<Terrain, number>>;
  numbers: Record<number, number>;
}

export type Action =
  | { type: 'placeSettlement'; vertex: number }
  | { type: 'placeRoad'; edge: number }
  | { type: 'roll' }
  | { type: 'discard'; resources: ResourceCounts }
  | { type: 'moveRobber'; hex: number; victim: number | null }
  | { type: 'buildRoad'; edge: number }
  | { type: 'buildSettlement'; vertex: number }
  | { type: 'buildCity'; vertex: number }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: Card; get: Card }
  /** Mehrere Bank- und Hafentausche auf einmal, ganz oder gar nicht. */
  | { type: 'bankTradeBatch'; give: ResourceCounts; get: ResourceCounts }
  | { type: 'offerTrade'; give: ResourceCounts; want: ResourceCounts }
  | { type: 'respondTrade'; offerId: number; accept: boolean }
  | { type: 'confirmTrade'; offerId: number; partner: number }
  | { type: 'cancelTrade'; offerId: number }
  /** Eigene Angebote zurückziehen; wer am Zug ist, lehnt damit auch alle Gegenangebote ab. */
  | { type: 'withdrawOffers' }
  | { type: 'endTurn' }
  /** Seewege */
  | { type: 'buildShip'; edge: number }
  | { type: 'moveShip'; from: number; to: number }
  | { type: 'chooseGold'; resources: ResourceCounts }
  /** Fischgründe */
  | { type: 'spendFish'; effect: FishEffect; victim?: number | null; resource?: Resource | null }
  | { type: 'passAnchor'; to: number }
  /** Duell */
  | { type: 'placeNeutral'; owner: number; vertex?: number; edge?: number }
  | { type: 'spendTokens'; effect: TokenEffect; give?: ResourceCounts }
  /** Flussläufe */
  | { type: 'buildBridge'; edge: number }
  | { type: 'tradeCoins'; resource: Resource }
  /** Stadtwacht */
  | { type: 'improveCity'; track: Track; vertex?: number }
  | { type: 'buildWall'; vertex: number }
  | { type: 'buildGuard'; vertex: number }
  | { type: 'upgradeGuard'; vertex: number }
  | { type: 'activateGuard'; vertex: number }
  /** Ziehen oder, wenn dort ein schwächerer fremder Wächter steht, verdrängen. */
  | { type: 'moveGuard'; from: number; to: number }
  | { type: 'chaseRobber'; vertex: number }
  | { type: 'loseCity'; vertex: number }
  | { type: 'placeDisplaced'; vertex: number | null }
  /** Stadtwacht III: Einflusskarte ausspielen; `card` = gewählte Kartenart, `vertices` = Ziele auf dem Brett. */
  | { type: 'playProgress'; progress: ProgressCard; card?: Card; vertices?: number[]; hexes?: number[]; edge?: number; target?: number; dice?: [number, number] }
  /** Schuldschein und Kundschafter: die gewählten Karten nehmen. */
  | { type: 'takePeek'; cards?: ResourceCounts; progress?: ProgressCard }
  | { type: 'pickProgress'; track: Track }
  /** Die Verschollenen: einen geschenkten Hafen an eine eigene Küstensiedlung legen (der älteste zuerst). */
  | { type: 'placeHarbor'; edge: number }
  /** Freibeuterbuchten */
  | { type: 'attackFortress'; vertex: number }
  | { type: 'chooseWarship'; edge: number }
  /** Großbauten: Bauwerk beginnen oder eine Stufe weiterbauen. */
  | { type: 'buildWonder'; wonder: number }
  /** Kamelzüge */
  | { type: 'bidCamel'; bid: ResourceCounts }
  | { type: 'placeCamel'; edge: number };

export const RESOURCE_NAMES: Record<Resource, string> = {
  wood: 'Holz',
  brick: 'Lehm',
  sheep: 'Wolle',
  wheat: 'Getreide',
  ore: 'Erz',
};

export const DEV_CARD_NAMES: Record<DevCard, string> = {
  knight: 'Ritter',
  roadBuilding: 'Straßenbau',
  yearOfPlenty: 'Erfindung',
  monopoly: 'Monopol',
  victoryPoint: 'Siegpunkt',
};

export const COSTS = {
  road: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
  devCard: { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 },
  ship: { wood: 1, brick: 0, sheep: 1, wheat: 0, ore: 0 },
  bridge: { wood: 1, brick: 2, sheep: 0, wheat: 0, ore: 0 },
  wall: { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 },
  guard: { wood: 0, brick: 0, sheep: 1, wheat: 0, ore: 1 },
  activate: { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 0 },
  lodge: { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 2 },
} satisfies Record<string, ResourceCounts>;

export const PIECE_LIMITS = { road: 15, settlement: 5, city: 4, ship: 15, bridge: 3 };

export const COMMODITY_NAMES: Record<Commodity, string> = {
  paper: 'Schriften',
  cloth: 'Stoff',
  coin: 'Silber',
};

export const CARD_NAMES: Record<Card, string> = { ...RESOURCE_NAMES, ...COMMODITY_NAMES };

export function emptyResources(): ResourceCounts {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

/** Anzahl einer Kartenart; fehlende Güter zählen als 0. */
export function count(r: ResourceCounts, card: Card): number {
  return r[card] ?? 0;
}

export function isCommodity(card: string): card is Commodity {
  return (COMMODITIES as readonly string[]).includes(card);
}

/** Setzt eine Anzahl; ein Gut, das es in diesem Zählwerk noch nicht gibt, kommt erst bei mehr als 0 dazu. */
export function setCount(r: ResourceCounts, card: Card, value: number): void {
  if (isCommodity(card) && value === 0 && !(card in r)) return;
  r[card] = value;
}

export function totalResources(r: ResourceCounts): number {
  return CARDS.reduce((sum, k) => sum + count(r, k), 0);
}

/** Handkarten eines Spielers, auch wenn sie in dieser Sicht verdeckt sind (siehe secrets.ts). */
export function handSize(p: PlayerState): number {
  return p.hidden?.cards ?? totalResources(p.resources);
}

/** Entwicklungskarten eines Spielers auf der Hand, auch verdeckt. */
export function devCount(p: PlayerState): number {
  return p.hidden?.dev ?? p.devCards.length + p.newDevCards.length;
}

/** Größe des Entwicklungsstapels, auch in einer Sicht. */
export function deckSize(s: Pick<GameState, 'hiddenDeck' | 'devDeck'>): number {
  return s.hiddenDeck ?? s.devDeck.length;
}

export function hasResources(have: ResourceCounts, need: ResourceCounts): boolean {
  return CARDS.every((k) => count(have, k) >= count(need, k));
}

export function formatResources(r: ResourceCounts): string {
  const parts = CARDS.filter((k) => count(r, k) > 0).map((k) => `${count(r, k)} ${CARD_NAMES[k]}`);
  return parts.length ? parts.join(', ') : 'nichts';
}
