import {
  Card,
  COSTS,
  FISH_COSTS,
  GameSettings,
  mapById,
  ProgressCard,
  ResourceCounts,
  Track,
  VariantId,
  VARIANTS,
} from '../../engine';
import { CARD_ART } from '../shared/card-art';
import { SceneId } from './rule-scene';
import { VideoId } from './rule-videos';

/** Ein Kapitel des Regelbuchs, im Buch ein Lesezeichen. */
export type ChapterId =
  | 'grundspiel'
  | 'grosse-runde'
  | 'seewege'
  | 'stadtwacht'
  | 'fischgruende'
  | 'flusslaeufe'
  | 'duell'
  | 'hausregeln';

export interface GalleryItem {
  src: string;
  label: string;
  /** Bestimmt Größe und Rahmen: Karte hochkant, Feld als Sechseck, Figur und Symbol frei. */
  shape: 'card' | 'tile' | 'piece' | 'icon';
}

export interface CostRow {
  label: string;
  image: string;
  cost: ResourceCounts;
  note?: string;
}

export interface TradeRow {
  label: string;
  give: Card | 'any';
  count: number;
  note: string;
}

/** Eine Regel, die eine Erweiterung gegenüber dem Grundspiel ändert. */
export interface ChangeRow {
  topic: string;
  before: string;
  after: string;
}

/** Texte sind eigenes, festes HTML (nur <b> und <i>), daher unbedenklich für innerHTML. */
export type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; html: string; initial?: boolean }
  /** `start`: Nummer des ersten Eintrags, wenn eine Liste auf der vorigen Seite begonnen hat. */
  | { kind: 'list'; items: string[]; numbered?: boolean; start?: number }
  /** Hervorgehobener Kasten; ohne `label` heißt er „Merke“. */
  | { kind: 'note'; html: string; label?: string }
  | { kind: 'scene'; scene: SceneId; caption: string }
  /** Erklärvideo; erscheint nur, wenn es in rule-videos.ts eingetragen ist. */
  | { kind: 'video'; video: VideoId; caption: string }
  | { kind: 'gallery'; items: GalleryItem[]; caption?: string }
  | { kind: 'costs'; rows: CostRow[] }
  | { kind: 'trades'; rows: TradeRow[] }
  /** Gegenüberstellung Grundspiel und Erweiterung; `now` ist die Überschrift der rechten Seite. */
  | { kind: 'changes'; now: string; rows: ChangeRow[]; head?: boolean }
  /** Ohne `cards` alle Karten der Farbe; auf mehrere Seiten verteilt nur ein Teil davon. */
  | { kind: 'progress'; track: Track; cards?: ProgressCard[] };

export interface Page {
  blocks: Block[];
  /** Nur zeigen, wenn diese Hausregel an ist. */
  variant?: VariantId;
}

export interface Chapter {
  id: ChapterId;
  /** Kurzname auf dem Lesezeichen. */
  tab: string;
  title: string;
  /** Vignette über dem Kapitelanfang und auf dem Lesezeichen. */
  emblem: string;
  pages: Page[];
}

const piece = (name: string) => `web/pieces/papiercollage/${name}.png`;
const building = (name: string) => `web/pieces/papiercollage-organic-v2/${name}.png`;
const tile = (name: string) => `web/tiles/papiercollage/${name}.png`;
const icon = (path: string) => `web/icons/${path}.png`;
const banner = (name: string) => `web/banner/papiercollage/${name}.png`;
const progressArt = (name: string) => `web/cards/progress/${name}.jpg`;

const GRUNDSPIEL: Chapter = {
  id: 'grundspiel',
  tab: 'Grundspiel',
  title: 'Das Grundspiel',
  emblem: banner('island'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Eine Insel, auf der noch niemand wohnt. Ihr seid die ersten Siedler. Jeder beginnt mit zwei kleinen Siedlungen und baut daraus nach und nach ein eigenes Reich aus Straßen, Siedlungen und Städten.',
        },
        { kind: 'h', text: 'Worum es geht' },
        { kind: 'video', video: 'worum-gehts', caption: 'Das Spiel in einer Minute' },
        {
          kind: 'p',
          html: 'Für das, was du baust, bekommst du <b>Siegpunkte</b>. Wer zuerst das Siegziel erreicht, meist 10 Punkte, gewinnt. Bauen kostet <b>Rohstoffe</b>: Holz, Lehm, Wolle, Getreide und Erz. Die liefert dir das Land rund um deine Siedlungen.',
        },
        {
          kind: 'scene',
          scene: 'island',
          caption:
            'Die Insel besteht aus sechseckigen Feldern, jedes mit einer Landschaft und einer Zahl. Rot hat hier eine Siedlung mit Straße, Blau eine Stadt.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Das Spielbrett lesen' },
        {
          kind: 'gallery',
          items: [
            { src: tile('wood'), label: 'Wald · Holz', shape: 'tile' },
            { src: tile('brick'), label: 'Hügel · Lehm', shape: 'tile' },
            { src: tile('sheep'), label: 'Weide · Wolle', shape: 'tile' },
            { src: tile('wheat'), label: 'Acker · Getreide', shape: 'tile' },
            { src: tile('ore'), label: 'Gebirge · Erz', shape: 'tile' },
            { src: tile('desert'), label: 'Wüste · nichts', shape: 'tile' },
          ],
        },
        {
          kind: 'p',
          html: 'Jede Landschaft liefert genau einen Rohstoff. Die Wüste liefert nichts, dort steht zu Beginn der Räuber.',
        },
        {
          kind: 'p',
          html: 'Gebaut wird an den Rändern der Felder: Siedlungen und Städte stehen auf den <b>Ecken</b>, Straßen liegen auf den <b>Kanten</b>. Eine Siedlung grenzt so an bis zu drei Felder und bekommt von allen dreien Rohstoffe.',
        },
        {
          kind: 'p',
          html: 'Die <b>Zahl</b> auf einem Feld sagt, bei welchem Wurf es liefert. Mit zwei Würfeln kommen 6 und 8 am häufigsten, deshalb sind sie rot. 2 und 12 fallen nur selten.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Wie man Rohstoffe bekommt' },
        { kind: 'video', video: 'wuerfeln', caption: 'Würfeln und Rohstoffe' },
        {
          kind: 'p',
          html: 'Jeder Zug beginnt mit einem Wurf. Alle Felder mit der gewürfelten Zahl liefern, und zwar an <b>jeden</b>, der an ihnen gebaut hat. Du sammelst also auch, wenn gerade jemand anderes dran ist.',
        },
        {
          kind: 'scene',
          scene: 'yield',
          caption:
            'Es fällt eine 9. Wald und Hügel liefern. Die Siedlung bekommt 1 Holz und 1 Lehm, die Stadt am Wald 2 Holz. Der Acker mit der 4 liefert nichts.',
        },
        {
          kind: 'list',
          items: [
            'Eine <b>Siedlung</b> bekommt 1 Karte vom Feld.',
            'Eine <b>Stadt</b> bekommt 2 Karten vom Feld.',
          ],
        },
        {
          kind: 'p',
          html: 'Deine Karten liegen unten in deiner Hand. Was die anderen haben, siehst du nur als Anzahl.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Der Anfang' },
        { kind: 'video', video: 'aufbau', caption: 'So setzt du deine ersten Siedlungen' },
        {
          kind: 'p',
          html: 'Bevor es losgeht, setzt jeder <b>zwei Siedlungen mit je einer Straße</b> aufs Brett. Erst setzt jeder reihum seine erste. Dann geht es rückwärts: Wer zuletzt dran war, setzt gleich seine zweite. So gleicht sich aus, wer sich zuerst einen Platz aussuchen durfte.',
        },
        {
          kind: 'p',
          html: 'Für die zweite Siedlung bekommst du sofort je einen Rohstoff von den Feldern daneben. Das ist dein Startkapital.',
        },
        {
          kind: 'scene',
          scene: 'distance',
          caption:
            'Die Abstandsregel: Zwischen zwei Siedlungen muss immer eine freie Ecke liegen. Auf die rot markierten Ecken darf niemand bauen, auch du nicht. Die grüne Ecke ist frei, und die Straße führt schon hin.',
        },
        {
          kind: 'note',
          label: 'Tipp',
          html: 'Wähle Plätze an verschiedenen Rohstoffen und an häufigen Zahlen. Für die ersten Straßen und Siedlungen brauchst du vor allem Holz und Lehm.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Dein Zug' },
        {
          kind: 'list',
          numbered: true,
          items: [
            '<b>Würfeln.</b> Alle bekommen Rohstoffe von den Feldern mit dieser Zahl. Bei einer 7 kommt der Räuber, dazu gleich mehr.',
            '<b>Handeln.</b> Tausche Karten, die du übrig hast, gegen solche, die dir fehlen.',
            '<b>Bauen.</b> Gib Rohstoffe für Straßen, Siedlungen, Städte oder Entwicklungskarten aus.',
          ],
        },
        {
          kind: 'p',
          html: 'Nach dem Würfeln darfst du handeln und bauen, so oft du willst und in beliebiger Reihenfolge. Wenn du fertig bist, klickst du auf <b>„Zug beenden“</b>, und der Nächste würfelt.',
        },
        {
          kind: 'note',
          html: 'Über dem Brett steht immer, wer gerade dran ist und was als Nächstes zu tun ist. Wenn du nicht weiterweißt, schau dort nach.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Bauen' },
        { kind: 'video', video: 'bauen', caption: 'Straßen, Siedlungen und Städte bauen' },
        {
          kind: 'costs',
          rows: [
            { label: 'Straße', image: piece('road-red'), cost: COSTS.road, note: '0 Punkte' },
            {
              label: 'Siedlung',
              image: building('settlement-red'),
              cost: COSTS.settlement,
              note: '1 Punkt',
            },
            { label: 'Stadt', image: building('city-red'), cost: COSTS.city, note: '2 Punkte' },
            {
              label: 'Entwicklung',
              image: CARD_ART.back,
              cost: COSTS.devCard,
              note: 'eine Karte vom Stapel',
            },
          ],
        },
        {
          kind: 'list',
          items: [
            '<b>Straßen</b> bringen dich zu neuen Bauplätzen. Eine neue Straße muss an eine eigene Straße, Siedlung oder Stadt anschließen.',
            '<b>Siedlungen</b> brauchen eine eigene Straße, die zu ihnen führt. Die Abstandsregel gilt das ganze Spiel über.',
            '<b>Städte</b> entstehen aus einer eigenen Siedlung. Sie zählen 2 Punkte und bekommen doppelt so viele Rohstoffe.',
          ],
        },
        {
          kind: 'note',
          html: 'Jeder hat 15 Straßen, 5 Siedlungen und 4 Städte. Wird eine Siedlung zur Stadt, bekommst du die Siedlung zurück und kannst sie neu bauen.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Handeln' },
        { kind: 'video', video: 'handeln', caption: 'Handeln mit Mitspielern, Bank und Häfen' },
        {
          kind: 'p',
          html: 'Selten passen deine Karten genau zu dem, was du bauen willst. Dann hilft Handel. Wenn du dran bist, hast du drei Möglichkeiten.',
        },
        {
          kind: 'p',
          html: '<b>Mit den Mitspielern:</b> Du sagst, was du gibst und was du dafür willst. Die anderen nehmen an, lehnen ab oder schlagen dir etwas anderes vor. Wie viel wofür, handelt ihr frei aus.',
        },
        {
          kind: 'p',
          html: '<b>Mit der Bank und an Häfen</b> gelten feste Kurse:',
        },
        {
          kind: 'trades',
          rows: [
            {
              label: 'Bank',
              give: 'any',
              count: 4,
              note: '4 gleiche Karten gegen 1 beliebige. Geht immer.',
            },
            {
              label: 'Hafen 3:1',
              give: 'any',
              count: 3,
              note: '3 gleiche gegen 1, wenn du eine Siedlung oder Stadt an diesem Hafen hast.',
            },
            {
              label: 'Hafen 2:1',
              give: 'sheep',
              count: 2,
              note: '2 vom abgebildeten Rohstoff gegen 1, hier Wolle.',
            },
          ],
        },
        {
          kind: 'note',
          html: 'Wer nicht am Zug ist, handelt nur mit dem, der gerade dran ist. Ein Klick auf eine Handkarte öffnet den Tauschtisch.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Die Sieben und der Räuber' },
        { kind: 'video', video: 'raeuber', caption: 'Was bei einer 7 passiert' },
        {
          kind: 'p',
          html: 'Die 7 ist der häufigste Wurf, aber kein Feld trägt sie. Wird eine 7 gewürfelt, bekommt niemand etwas. Stattdessen passiert zweierlei:',
        },
        {
          kind: 'list',
          numbered: true,
          items: [
            'Wer mehr als 7 Karten hat, gibt die Hälfte ab, abgerundet. Viele Karten zu horten ist also riskant.',
            'Wer gewürfelt hat, stellt den <b>Räuber</b> auf ein anderes Feld und nimmt einem Spieler, der dort gebaut hat, eine zufällige Karte.',
          ],
        },
        {
          kind: 'scene',
          scene: 'robber',
          caption:
            'Der Räuber steht auf dem Acker. Die 6 dort liefert nichts mehr, solange er bleibt. Wer ihn hingestellt hat, nimmt Rot oder Blau eine Karte.',
        },
        {
          kind: 'p',
          html: 'Der Räuber bleibt stehen, bis die nächste 7 fällt oder jemand einen Ritter ausspielt.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Entwicklungskarten' },
        { kind: 'video', video: 'entwicklung', caption: 'Entwicklungskarten kaufen und spielen' },
        {
          kind: 'p',
          html: 'Für 1 Wolle, 1 Getreide und 1 Erz ziehst du eine verdeckte Karte. Was du bekommst, siehst du erst danach. Es gibt fünf Sorten:',
        },
        {
          kind: 'gallery',
          items: [
            { src: CARD_ART.knight, label: 'Ritter', shape: 'card' },
            { src: CARD_ART.roadBuilding, label: 'Straßenbau', shape: 'card' },
            { src: CARD_ART.yearOfPlenty, label: 'Erfindung', shape: 'card' },
            { src: CARD_ART.monopoly, label: 'Monopol', shape: 'card' },
            { src: CARD_ART.victoryPoint, label: 'Siegpunkt', shape: 'card' },
          ],
        },
        {
          kind: 'list',
          items: [
            '<b>Ritter:</b> Du versetzt den Räuber wie bei einer 7 und nimmst eine Karte.',
            '<b>Straßenbau:</b> Du baust 2 Straßen, ohne zu bezahlen.',
            '<b>Erfindung:</b> Du nimmst dir 2 Rohstoffe deiner Wahl aus der Bank.',
            '<b>Monopol:</b> Du nennst einen Rohstoff, und alle geben dir ihre Karten davon.',
            '<b>Siegpunkt:</b> zählt 1 Punkt. Die anderen sehen ihn erst am Ende.',
          ],
        },
        {
          kind: 'note',
          html: 'Pro Zug darfst du eine Karte ausspielen, auch schon vor dem Würfeln. Eine frisch gekaufte Karte musst du bis zu deinem nächsten Zug aufheben.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Punkte und Sieg' },
        { kind: 'video', video: 'sieg', caption: 'Punkte sammeln und gewinnen' },
        {
          kind: 'list',
          items: [
            'Siedlung <b>1 Punkt</b>, Stadt <b>2 Punkte</b>',
            'Siegpunktkarte <b>1 Punkt</b>',
            '<b>Längste Straße</b> 2 Punkte: für den Ersten mit 5 zusammenhängenden Straßen',
            '<b>Größte Rittermacht</b> 2 Punkte: für den Ersten mit 3 ausgespielten Rittern',
          ],
        },
        {
          kind: 'scene',
          scene: 'longestRoad',
          caption:
            'Fünf Straßen am Stück reichen für die Längste Straße. Eine fremde Siedlung dazwischen würde sie unterbrechen.',
        },
        {
          kind: 'p',
          html: 'Die beiden Sonderwertungen wandern weiter, sobald jemand eine längere Straße oder mehr Ritter hat. Wer in seinem Zug das Siegziel erreicht, gewinnt sofort. Das Spiel zählt für dich mit.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Kniffe am Spieltisch' },
        {
          kind: 'list',
          items: [
            'Die <b>Leertaste</b> löst die hervorgehobene Aktion aus, etwa Würfeln oder Zug beenden.',
            '<b>S</b> Siedlung, <b>R</b> Straße, <b>C</b> Stadt, <b>E</b> Entwicklung, <b>H</b> Handel. <b>Esc</b> bricht ab.',
            'Ein Klick auf einen Mitspieler zeigt, was über ihn bekannt ist.',
            'Ein Klick auf eine Entwicklungskarte dreht sie um und zeigt, was sie kann.',
            'Wer die Verbindung verliert, kommt über denselben Link auf seinen Platz zurück. Nach 30 Sekunden spielt so lange ein Bot für ihn.',
          ],
        },
      ],
    },
  ],
};

const GROSSE_RUNDE: Chapter = {
  id: 'grosse-runde',
  tab: '5–8 Spieler',
  title: 'Die große Runde',
  emblem: banner('laurel'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Die Nachricht von der Insel hat sich herumgesprochen. Immer mehr Siedler kommen an, und das Land wird größer, damit alle Platz finden.',
        },
        { kind: 'video', video: 'grosse-runde', caption: 'Was sich mit 5 bis 8 Spielern ändert' },
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Ab 5 Spielern',
          rows: [
            {
              topic: 'Insel',
              before: '19 Felder, 1 Wüste',
              after: '30 Felder, 2 Wüsten (7–8 Spieler: 44, 3 Wüsten)',
            },
            {
              topic: 'Bank',
              before: '19 Karten je Rohstoff',
              after: '24 je Rohstoff (7–8 Spieler: 30)',
            },
            {
              topic: 'Entwicklungskarten',
              before: '25 im Stapel',
              after: '34 im Stapel (7–8 Spieler: 44)',
            },
            {
              topic: 'Nach jedem Zug',
              before: 'der Nächste würfelt',
              after: 'erst die <b>Sonderbauphase</b>',
            },
          ],
        },
        {
          kind: 'note',
          html: 'Alles andere bleibt wie im Grundspiel, auch das Siegziel. Die großen Werte gelten auf der klassischen Karte, andere Karten haben ihre eigene Größe.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Neu: die Sonderbauphase' },
        {
          kind: 'p',
          html: 'Mit vielen Spielern dauert es lange, bis du wieder dran bist. Damit du deine Karten in der Zeit nicht an eine 7 verlierst, darfst du zwischendurch bauen.',
        },
        {
          kind: 'scene',
          scene: 'specialBuild',
          caption: 'Rot hat den Zug beendet. Jetzt dürfen Blau, Grün und Gelb nacheinander bauen.',
        },
        {
          kind: 'list',
          items: [
            'Nach jedem Zug kommen alle anderen der Reihe nach einmal dran.',
            'Erlaubt ist nur <b>Bauen</b> und <b>Entwicklungskarten kaufen</b>.',
            'Handeln und Karten ausspielen geht in dieser Phase nicht.',
            'Wer sich nichts leisten kann, wird automatisch übersprungen.',
          ],
        },
      ],
    },
  ],
};

const SEEWEGE: Chapter = {
  id: 'seewege',
  tab: 'Seewege',
  title: 'Seewege',
  emblem: banner('ship'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Von der Küste aus sieht man am Horizont weitere Inseln. Die ersten Boote liegen bereit, und wer sich zuerst hinüberwagt, kann dort Land für sich beanspruchen.',
        },
        { kind: 'video', video: 'seewege', caption: 'Schiffe, Inseln und was auf dem Meer wartet' },
        { kind: 'h', text: 'Was neu dazukommt' },
        {
          kind: 'list',
          items: [
            '<b>Meer</b> zwischen mehreren Inseln.',
            '<b>Schiffe</b>: Sie führen übers Wasser, so wie Straßen übers Land.',
            'Das <b>Kaperschiff</b>, ein Räuber für das Meer.',
            '<b>Goldfelder</b>, die Rohstoffe nach Wahl liefern.',
            'Der <b>Inselbonus</b> für jede neu besiedelte Insel.',
            '<b>Nebel</b> auf manchen Karten, unter dem Land oder Meer liegt.',
          ],
        },
        {
          kind: 'scene',
          scene: 'ships',
          caption:
            'Von der Siedlung an der Küste führen Schiffe zur Nachbarinsel. Dort steht schon die nächste Siedlung und bringt 2 Punkte Inselbonus.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Mit Seewege',
          rows: [
            { topic: 'Siegziel', before: '10 Punkte', after: '12 oder 13, je nach Karte' },
            {
              topic: 'Aufbau',
              before: 'überall auf der Insel',
              after: 'meist nur auf der großen Hauptinsel',
            },
            {
              topic: 'Bei einer 7 oder einem Ritter',
              before: 'Räuber versetzen',
              after: 'Räuber <b>oder</b> Kaperschiff versetzen',
            },
            {
              topic: 'Längste Straße',
              before: 'nur Straßen',
              after: '<b>Längste Handelsroute</b> aus Straßen und Schiffen',
            },
            {
              topic: 'Straßenbau-Karte',
              before: '2 Straßen',
              after: '2 Straßen oder Schiffe, auch gemischt',
            },
          ],
        },
        {
          kind: 'note',
          html: 'Für die Längste Handelsroute zählen Straßen und Schiffe zusammen, wenn sie an einer eigenen Siedlung oder Stadt ineinander übergehen.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Schiffe bauen' },
        {
          kind: 'costs',
          rows: [
            {
              label: 'Schiff',
              image: piece('ship-red'),
              cost: COSTS.ship,
              note: '15 Schiffe je Spieler',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Ein Schiff liegt auf einer Kante am Wasser, also an der Küste oder zwischen zwei Meerfeldern. Wie Straßen baust du Schiffe Stück für Stück von deiner Siedlung aus zu einer <b>Schiffslinie</b>. Wo die Linie an eine Küste stößt, darfst du eine Siedlung gründen.',
        },
        {
          kind: 'p',
          html: 'Straße und Schiff gehen nur an einer eigenen Siedlung oder Stadt ineinander über. Eine Straße kann also nicht direkt an der Küste in ein Schiff wechseln.',
        },
        { kind: 'h', text: 'Schiffe versetzen' },
        {
          kind: 'p',
          html: 'Einmal pro Zug darfst du ein Schiff umsetzen, wenn du dich verfahren hast. Erlaubt ist das letzte Schiff einer offenen Linie, an deren Ende noch keine Siedlung steht. Ein Schiff, das du in diesem Zug gebaut hast, bleibt liegen.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was auf dem Meer wartet' },
        {
          kind: 'gallery',
          items: [
            { src: piece('pirate'), label: 'Kaperschiff', shape: 'piece' },
            { src: tile('gold'), label: 'Goldfeld', shape: 'tile' },
            { src: tile('fog'), label: 'Nebel', shape: 'tile' },
            { src: icon('seewege/island-bonus'), label: 'Inselbonus', shape: 'icon' },
          ],
        },
        {
          kind: 'list',
          items: [
            '<b>Kaperschiff:</b> Es steht auf einem Meerfeld. An dessen Kanten darf niemand Schiffe bauen oder hinsetzen. Wer es versetzt, nimmt einem Spieler mit einem Schiff an diesem Feld eine Karte.',
            '<b>Goldfeld:</b> Fällt seine Zahl, wählt jeder dort Rohstoffe aus der Bank, 1 je Siedlung und 2 je Stadt.',
            '<b>Inselbonus:</b> Deine erste Siedlung auf einer Insel, auf der du noch nichts hast, bringt 2 Punkte extra.',
            '<b>Nebel:</b> Baust du eine Straße oder ein Schiff an ein Nebelfeld, wird es aufgedeckt. Ist es Land, bekommst du als Entdecker einen Rohstoff davon.',
          ],
        },
      ],
    },
  ],
};

const STADTWACHT: Chapter = {
  id: 'stadtwacht',
  tab: 'Stadtwacht',
  title: 'Stadtwacht',
  emblem: banner('shield'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Die Städte der Insel blühen auf, und ihr Reichtum spricht sich herum. Draußen auf dem Meer sammelt sich eine Flotte von Plünderern. Nur wenn die Städte gemeinsam Wächter aufstellen, halten sie dem Angriff stand.',
        },
        { kind: 'video', video: 'stadtwacht', caption: 'Alles zur Stadtwacht, mit allen Einflusskarten' },
        { kind: 'h', text: 'Was neu dazukommt' },
        {
          kind: 'list',
          items: [
            '<b>Güter</b>: Schriften, Stoff und Silber, wertvolle Karten aus Städten.',
            '<b>Stadtausbau</b> in drei Richtungen, mit Fähigkeiten und <b>Prachtstädten</b>.',
            'Ein dritter Würfel, der <b>Ereigniswürfel</b>.',
            'Die <b>Plündererflotte</b>, die immer wieder angreift.',
            '<b>Wächter</b>, die eure Städte verteidigen.',
            '<b>Einflusskarten</b> in drei Farben.',
            '<b>Palisaden</b>, mit denen du mehr Karten halten darfst.',
          ],
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Mit Stadtwacht',
          rows: [
            { topic: 'Siegziel', before: '10 Punkte', after: '3 Punkte mehr, meist 13' },
            {
              topic: 'Aufbau',
              before: '2 Siedlungen',
              after: '1 Siedlung und 1 <b>Stadt</b>',
            },
            {
              topic: 'Stadt an Wald, Weide, Gebirge',
              before: '2 Rohstoffe',
              after: '1 Rohstoff und 1 <b>Gut</b>',
            },
            { topic: 'Würfel', before: '2 Würfel', after: 'weiß, rot und der Ereigniswürfel' },
            {
              topic: 'Entwicklungskarten',
              before: 'kaufen',
              after: 'gibt es nicht, dafür <b>Einflusskarten</b>',
            },
            {
              topic: 'Ritter',
              before: 'Größte Rittermacht',
              after: 'gibt es nicht, dafür <b>Wächter</b>',
            },
            {
              topic: 'Räuber',
              before: 'von Anfang an',
              after: 'erst nach dem ersten Angriff der Flotte',
            },
            {
              topic: 'Kartenlimit bei einer 7',
              before: '7 Karten',
              after: '7, plus 2 je Palisade',
            },
          ],
        },
        {
          kind: 'note',
          html: 'Auch vor dem ersten Angriff gilt bei einer 7: Wer zu viele Karten hat, gibt die Hälfte ab. Nur der Räuber bleibt noch weg.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Güter' },
        {
          kind: 'gallery',
          items: [
            { src: CARD_ART.paper, label: 'Schriften aus dem Wald', shape: 'card' },
            { src: CARD_ART.cloth, label: 'Stoff von der Weide', shape: 'card' },
            { src: CARD_ART.coin, label: 'Silber aus dem Gebirge', shape: 'card' },
          ],
        },
        {
          kind: 'p',
          html: 'Güter entstehen nur in <b>Städten</b>. Steht eine Stadt an Wald, Weide oder Gebirge, bekommt sie bei einem Treffer 1 Rohstoff und 1 Gut. An Hügel und Acker bleibt es bei 2 Rohstoffen. Siedlungen liefern wie gewohnt.',
        },
        {
          kind: 'p',
          html: 'Du brauchst Güter für den <b>Stadtausbau</b>. Ansonsten verhalten sie sich wie Rohstoffe: Sie zählen zu deiner Hand, du kannst sie handeln, und der Räuber kann sie stehlen.',
        },
        {
          kind: 'note',
          label: 'Tipp',
          html: 'Baue früh Städte an Wald, Weide oder Gebirge. Ohne Güter kommst du beim Ausbau nicht voran.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Stadtausbau' },
        {
          kind: 'gallery',
          items: [
            { src: icon('city/market'), label: 'Markt · mit Stoff', shape: 'icon' },
            { src: icon('city/council'), label: 'Rat · mit Silber', shape: 'icon' },
            { src: icon('city/scholars'), label: 'Gelehrte · mit Schriften', shape: 'icon' },
          ],
        },
        {
          kind: 'p',
          html: 'Deine Städte kannst du in drei Richtungen ausbauen, jede hat 5 Stufen. Jede Stufe kostet so viele Güter, wie ihre Zahl sagt: Stufe 1 kostet 1 Gut, Stufe 2 kostet 2 und so weiter. Dafür brauchst du mindestens eine Stadt.',
        },
        {
          kind: 'note',
          label: 'Beispiel',
          html: 'Um den Rat von 0 auf Stufe 3 zu bringen, zahlst du nacheinander 1, 2 und 3 Silber, zusammen 6.',
        },
        {
          kind: 'p',
          html: 'Ab <b>Stufe 3</b> bekommst du eine Fähigkeit dazu:',
        },
        {
          kind: 'list',
          items: [
            '<b>Markt:</b> Güter tauschst du 2:1 mit der Bank.',
            '<b>Rat:</b> Deine Wächter dürfen bis Stufe 3 aufsteigen.',
            '<b>Gelehrte:</b> Bekommst du bei einem Wurf außer der 7 nichts, nimmst du dir einen Rohstoff deiner Wahl.',
          ],
        },
        {
          kind: 'scene',
          scene: 'metropolis',
          caption:
            'Wer in einer Richtung zuerst Stufe 4 erreicht, macht eine Stadt zur Prachtstadt: 2 Punkte extra, und die Flotte kann sie nicht nehmen. Wer später Stufe 5 erreicht, nimmt sie einem Inhaber ab, der nur Stufe 4 hat.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Der Ereigniswürfel' },
        {
          kind: 'gallery',
          items: [
            { src: icon('city/event-ship'), label: 'Schiff (3 Seiten)', shape: 'icon' },
            { src: icon('city/event-market'), label: 'Gelbes Tor', shape: 'icon' },
            { src: icon('city/event-council'), label: 'Blaues Tor', shape: 'icon' },
            { src: icon('city/event-scholars'), label: 'Grünes Tor', shape: 'icon' },
          ],
        },
        {
          kind: 'p',
          html: 'Bei jedem Wurf rollt ein dritter Würfel mit. Zeigt er ein <b>Schiff</b>, kommt die Flotte näher. Zeigt er ein <b>Tor</b>, gibt es Einflusskarten in dieser Farbe. Die beiden Zahlenwürfel liefern wie gewohnt, der rote spielt bei den Einflusskarten eine Rolle.',
        },
        { kind: 'h', text: 'Die Plündererflotte' },
        {
          kind: 'scene',
          scene: 'raiders',
          caption:
            'Jedes Schiff auf dem Ereigniswürfel rückt die Flotte ein Feld vor. Auf dem siebten greift sie an, noch bevor die Felder liefern.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Der Angriff' },
        {
          kind: 'p',
          html: 'Beim Angriff werden zwei Zahlen verglichen. Die <b>Flotte</b> ist so stark, wie es Städte auf der Insel gibt, Prachtstädte mitgezählt. Die <b>Verteidigung</b> ist die Summe der Stufen aller einsatzbereiten Wächter, von allen Spielern zusammen.',
        },
        {
          kind: 'list',
          items: [
            '<b>Die Flotte ist stärker:</b> Wer am wenigsten zur Verteidigung beigetragen hat, verliert eine Stadt, sie wird wieder zur Siedlung. Das trifft nur Spieler mit einer gewöhnlichen Stadt. Prachtstädte sind sicher.',
            '<b>Die Verteidigung hält:</b> Wer am meisten beigetragen hat, bekommt einen <b>Ehrenschild</b>, 1 Siegpunkt. Bei Gleichstand zieht jeder der Besten eine Einflusskarte.',
          ],
        },
        {
          kind: 'note',
          label: 'Beispiel',
          html: 'Auf der Insel stehen 5 Städte, die Flotte hat Stärke 5. Rot hat einsatzbereite Wächter der Stufen 2 und 1, Blau einen der Stufe 2. Das ergibt 5, Gleichstand reicht zur Abwehr. Rot hat mit 3 am meisten beigetragen und bekommt den Ehrenschild.',
        },
        {
          kind: 'p',
          html: 'Nach jedem Angriff ruhen alle Wächter und müssen neu bereit gemacht werden. Die Flotte fängt wieder vorn an.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Wächter' },
        {
          kind: 'gallery',
          items: [
            { src: piece('guard1-red'), label: 'Stufe 1', shape: 'piece' },
            { src: piece('guard2-red'), label: 'Stufe 2', shape: 'piece' },
            { src: piece('guard3-red'), label: 'Stufe 3', shape: 'piece' },
          ],
        },
        {
          kind: 'costs',
          rows: [
            {
              label: 'Aufstellen',
              image: piece('guard1-red'),
              cost: COSTS.guard,
              note: 'auf eine Ecke an deiner Straße',
            },
            {
              label: 'Aufwerten',
              image: icon('city/guard-upgrade'),
              cost: COSTS.guard,
              note: 'eine Stufe höher',
            },
            {
              label: 'Bereit machen',
              image: icon('city/guard-activate'),
              cost: COSTS.activate,
              note: 'nur bereite Wächter verteidigen',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Ein neuer Wächter ruht erst einmal. Erst wenn du ihn <b>bereit machst</b>, zählt er für die Verteidigung. Ab deinem nächsten Zug kann er dann außerdem einmal handeln und ruht danach wieder:',
        },
        {
          kind: 'list',
          items: [
            'entlang deiner Straßen auf eine andere Ecke <b>ziehen</b>,',
            'einen schwächeren fremden Wächter <b>verdrängen</b>,',
            'den <b>Räuber</b> von einem Feld daneben vertreiben.',
          ],
        },
        {
          kind: 'note',
          html: 'Wächter besetzen ihre Ecke, dort darf niemand bauen. Fremde Straßen werden an einem Wächter unterbrochen. Je Stufe hat jeder 2 Wächter.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Einflusskarten' },
        {
          kind: 'gallery',
          items: [
            { src: progressArt('back-market'), label: 'Markt', shape: 'card' },
            { src: progressArt('back-council'), label: 'Rat', shape: 'card' },
            { src: progressArt('back-scholars'), label: 'Gelehrte', shape: 'card' },
          ],
        },
        {
          kind: 'p',
          html: 'Einflusskarten ersetzen die Entwicklungskarten. Kaufen kannst du sie nicht. Du bekommst sie, wenn der Ereigniswürfel ein Tor zeigt: Dann zieht jeder eine Karte dieser Farbe, dessen Ausbau in dieser Richtung hoch genug ist für den <b>roten Würfel</b>.',
        },
        {
          kind: 'note',
          label: 'Beispiel',
          html: 'Das blaue Tor fällt, der rote Würfel zeigt 3. Wer den Rat auf Stufe 2 oder höher hat, zieht eine blaue Karte. Mit Stufe 1 bräuchte es eine rote 1 oder 2, ohne Rat gibt es keine Karte.',
        },
        {
          kind: 'list',
          items: [
            'Du hältst höchstens 4 Karten. Wer 4 hat, zieht keine weitere.',
            'Punktkarten legst du sofort offen aus.',
            'Gespielt wird in deinem Zug nach dem Würfeln, so viele du willst. Nur das Losbuch spielst du statt zu würfeln.',
          ],
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Palisade und Händler' },
        {
          kind: 'gallery',
          items: [
            { src: piece('wall'), label: 'Palisade', shape: 'piece' },
            { src: piece('trader-red'), label: 'Händler', shape: 'piece' },
          ],
        },
        {
          kind: 'costs',
          rows: [
            {
              label: 'Palisade',
              image: piece('wall'),
              cost: COSTS.wall,
              note: 'unter eine eigene Stadt, höchstens 3',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Jede Palisade erlaubt dir bei einer 7 zwei Karten mehr auf der Hand. Verlierst du die Stadt an die Flotte, ist auch die Palisade weg.',
        },
        {
          kind: 'p',
          html: 'Den <b>Händler</b> setzt du mit der Karte Wanderhändler auf ein Feld an deiner Siedlung oder Stadt. Solange er dir gehört, tauschst du den Rohstoff dieses Feldes 2:1 und hast 1 Punkt mehr. Spielt jemand anderes die Karte, nimmt er dir den Händler ab.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Die Karten des Markts' },
        { kind: 'progress', track: 'market' },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Die Karten des Rats' },
        { kind: 'progress', track: 'council' },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Die Karten der Gelehrten' },
        { kind: 'progress', track: 'scholars' },
      ],
    },
  ],
};

const FISCHGRUENDE: Chapter = {
  id: 'fischgruende',
  tab: 'Fischgründe',
  title: 'Fischgründe',
  emblem: banner('fish'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Die Fischer der Insel kennen die besten Stellen an der Küste und im See. Wer dort siedelt, bringt Fang nach Hause und kann ihn gegen allerlei Gefälligkeiten eintauschen.',
        },
        { kind: 'video', video: 'fischgruende', caption: 'Fische fangen und ausgeben' },
        { kind: 'h', text: 'Was neu dazukommt' },
        {
          kind: 'gallery',
          items: [
            { src: tile('lake'), label: 'See', shape: 'tile' },
            { src: icon('fishing/ground'), label: 'Fischgrund', shape: 'icon' },
            { src: icon('fishing/fish-2'), label: 'Fischplättchen', shape: 'icon' },
            { src: icon('fishing/anchor'), label: 'Rostiger Anker', shape: 'icon' },
          ],
        },
        {
          kind: 'list',
          items: [
            '<b>Fische</b> als zweite Währung neben den Rohstoffen.',
            'Ein <b>See</b> und mehrere <b>Fischgründe</b>, die Fische liefern.',
            'Der <b>Rostige Anker</b>, ein Plättchen, das niemand haben will.',
          ],
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Mit Fischgründen',
          rows: [
            {
              topic: 'Wüste',
              before: 'liefert nichts',
              after: 'wird zum <b>See</b>, der Fische liefert',
            },
            { topic: 'Räuber', before: 'startet in der Wüste', after: 'startet neben dem Brett' },
            { topic: 'Küste', before: 'nur Häfen', after: 'dazu Fischgründe mit Zahlen' },
          ],
        },
        { kind: 'h', text: 'Fische fangen' },
        {
          kind: 'p',
          html: 'Der <b>See</b> liefert bei den seltenen Würfen 2, 3, 11 und 12 an alle Siedlungen und Städte um ihn herum. Jeder <b>Fischgrund</b> an der Küste hat eine eigene Zahl und beliefert die beiden Ecken neben sich.',
        },
        {
          kind: 'p',
          html: 'Bei einem Treffer zieht jede Siedlung dort ein verdecktes Fischplättchen, jede Stadt zwei. Auf den Plättchen sind 1 bis 3 Fische. Die anderen sehen nur, wie viele Plättchen du hast.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Fische ausgeben' },
        {
          kind: 'p',
          html: 'In deinem Zug kannst du nach dem Würfeln Fische eintauschen. Die Fische auf deinen Plättchen werden zusammengezählt.',
        },
        {
          kind: 'list',
          items: [
            `<b>${FISH_COSTS.robber} Fische:</b> den Räuber vom Brett nehmen`,
            `<b>${FISH_COSTS.steal} Fische:</b> einem Mitspieler eine Karte wegnehmen`,
            `<b>${FISH_COSTS.bank} Fische:</b> einen Rohstoff aus der Bank`,
            `<b>${FISH_COSTS.road} Fische:</b> eine Straße bauen, ohne zu bezahlen`,
            `<b>${FISH_COSTS.devCard} Fische:</b> eine Entwicklungskarte, ohne zu bezahlen`,
          ],
        },
        {
          kind: 'note',
          label: 'Beispiel',
          html: 'Du hast Plättchen mit 3 und 2 Fischen und willst einen Rohstoff für 4. Du gibst beide ab, den übrigen Fisch bekommst du nicht zurück. Wechselgeld gibt es nicht.',
        },
        { kind: 'h', text: 'Der Rostige Anker' },
        {
          kind: 'p',
          html: 'Unter den Plättchen liegt ein Anker. Wer ihn zieht, braucht <b>einen Punkt mehr</b> zum Sieg. Du darfst ihn an jemanden weitergeben, der gleich viele oder mehr Punkte hat als du.',
        },
      ],
    },
  ],
};

const FLUSSLAEUFE: Chapter = {
  id: 'flusslaeufe',
  tab: 'Flussläufe',
  title: 'Flussläufe',
  emblem: banner('coin'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Zwei Flüsse ziehen sich durch das Land. An ihren Ufern wird Handel getrieben, und wer Brücken schlägt, verdient gut daran.',
        },
        { kind: 'video', video: 'flusslaeufe', caption: 'Brücken und Münzen' },
        { kind: 'h', text: 'Was neu dazukommt' },
        {
          kind: 'list',
          items: [
            'Zwei <b>Flüsse</b>, die von der Inselmitte zur Küste laufen.',
            '<b>Brücken</b>, der einzige Weg über das Wasser.',
            '<b>Münzen</b> für alles, was du am Fluss baust.',
          ],
        },
        {
          kind: 'scene',
          scene: 'river',
          caption:
            'Der Fluss läuft quer über die Kante zwischen Acker und Hügel. Dort liegt keine Straße, nur eine Brücke. Sie bringt 3 Münzen.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Mit Flussläufen',
          rows: [
            {
              topic: 'Kanten mit Fluss',
              before: 'Straße möglich',
              after: 'nur eine <b>Brücke</b>',
            },
            {
              topic: 'Bauen am Fluss',
              before: 'nichts extra',
              after: 'bringt <b>Münzen</b>',
            },
            {
              topic: 'Punkte',
              before: 'nur fürs Bauen',
              after: 'reichster Spieler +1, ärmster −2',
            },
          ],
        },
        {
          kind: 'costs',
          rows: [
            {
              label: 'Brücke',
              image: piece('bridge-red'),
              cost: COSTS.bridge,
              note: '3 je Spieler, zählt als Straße',
            },
          ],
        },
        { kind: 'h', text: 'Münzen' },
        {
          kind: 'list',
          items: [
            'Straße oder Siedlung am Fluss: <b>1 Münze</b>. Brücke: <b>3 Münzen</b>.',
            'In deinem Zug tauschst du <b>2 Münzen</b> gegen einen Rohstoff aus der Bank.',
          ],
        },
        {
          kind: 'gallery',
          items: [
            { src: icon('rivers/rich'), label: 'Reichster · +1 Punkt', shape: 'icon' },
            { src: icon('rivers/poor'), label: 'Bettler · −2 Punkte', shape: 'icon' },
          ],
          caption:
            'Bei Gleichstand gilt es für alle Gleichen. Haben alle gleich viele Münzen, gibt es weder Bonus noch Abzug.',
        },
      ],
    },
  ],
};

const DUELL: Chapter = {
  id: 'duell',
  tab: 'Duell',
  title: 'Duell',
  emblem: banner('sword'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Nur zwei Siedler sind auf der Insel gelandet. Doch sie sind nicht allein: Zwei Sippen, die schon länger hier leben, breiten sich mit aus und machen das Land eng.',
        },
        { kind: 'video', video: 'duell', caption: 'Zu zweit mit den Neutralen' },
        { kind: 'h', text: 'Was neu dazukommt' },
        {
          kind: 'gallery',
          items: [
            { src: building('settlement-grey-light'), label: 'Neutral 1', shape: 'piece' },
            { src: building('settlement-grey-dark'), label: 'Neutral 2', shape: 'piece' },
            { src: icon('duel/token'), label: 'Handelsmarke', shape: 'icon' },
          ],
        },
        {
          kind: 'list',
          items: [
            'Zwei <b>neutrale Mitspieler</b> in Grau. Sie sind nie am Zug, bekommen keine Rohstoffe und können nicht gewinnen. Sie nehmen euch nur Platz weg.',
            '<b>Handelsmarken</b>, mit denen du einen Tausch erzwingen oder den Räuber vertreiben kannst.',
          ],
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Was sich ändert' },
        {
          kind: 'changes',
          now: 'Im Duell',
          rows: [
            { topic: 'Spieler', before: '2 bis 8', after: 'genau 2, dazu 2 Neutrale' },
            {
              topic: 'Aufbau',
              before: '2 Siedlungen je Spieler',
              after: 'danach setzt jeder noch 1 Siedlung mit Straße für einen Neutralen',
            },
            {
              topic: 'Straße oder Siedlung kaufen',
              before: 'du baust sie',
              after: 'du setzt zusätzlich ein gleiches Teil für einen Neutralen, gratis',
            },
            {
              topic: 'Ritter ausspielen',
              before: 'Räuber versetzen',
              after: 'dazu 1 Handelsmarke',
            },
          ],
        },
        {
          kind: 'note',
          html: 'Gibt es für den Neutralen keinen Platz für eine Siedlung, bekommt er eine Straße. Neutrale zählen nicht für die Längste Straße.',
        },
      ],
    },
    {
      blocks: [
        { kind: 'h', text: 'Handelsmarken' },
        {
          kind: 'p',
          html: 'Eine Marke bekommst du für jede Siedlung an der Küste, jede Siedlung an der Wüste und jeden ausgespielten Ritter. In deinem Zug kannst du sie nach dem Würfeln einsetzen:',
        },
        {
          kind: 'list',
          items: [
            '<b>Tausch erzwingen:</b> Du nimmst dem Gegner 2 zufällige Karten und gibst ihm 2 Karten deiner Wahl.',
            '<b>Räuber vertreiben:</b> Der Räuber geht zurück in die Wüste.',
          ],
        },
        {
          kind: 'note',
          html: 'Wer mehr Punkte hat, zahlt 2 Marken, sonst kostet es 1. So kann der Zurückliegende leichter aufholen.',
        },
      ],
    },
  ],
};

const HAUSREGELN: Chapter = {
  id: 'hausregeln',
  tab: 'Hausregeln',
  title: 'Hausregeln',
  emblem: banner('horn'),
  pages: [
    {
      blocks: [
        {
          kind: 'p',
          initial: true,
          html: 'Jede Runde am Lagerfeuer hat ihre eigenen Bräuche. Hausregeln sind kleine Änderungen am Grundspiel. Ihr habt sie in der Lobby eingeschaltet, und auf den nächsten Seiten steht, was sie bewirken.',
        },
        { kind: 'video', video: 'hausregeln', caption: 'Milder Räuber, Hafenvogt und Würfelstapel' },
      ],
    },
    {
      variant: 'milderRaeuber',
      blocks: [
        { kind: 'h', text: 'Milder Räuber' },
        {
          kind: 'gallery',
          items: [{ src: piece('robber'), label: 'Der Räuber', shape: 'piece' }],
        },
        {
          kind: 'p',
          html: 'Wer schlecht gestartet ist, soll nicht auch noch ausgeraubt werden.',
        },
        {
          kind: 'changes',
          now: 'Milder Räuber',
          rows: [
            {
              topic: 'Wohin der Räuber darf',
              before: 'auf jedes andere Feld',
              after: 'nicht an Felder von Spielern mit <b>höchstens 2 Punkten</b>',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Gibt es kein erlaubtes Feld, kommt der Räuber in die Wüste.',
        },
      ],
    },
    {
      variant: 'hafenvogt',
      blocks: [
        { kind: 'h', text: 'Hafenvogt' },
        {
          kind: 'gallery',
          items: [{ src: icon('variants/harbor-master'), label: 'Der Hafenvogt', shape: 'icon' }],
        },
        {
          kind: 'p',
          html: 'Häfen werden wertvoller, weil sie Punkte bringen können.',
        },
        {
          kind: 'changes',
          now: 'Hafenvogt',
          rows: [
            { topic: 'Siegziel', before: '10 Punkte', after: '1 Punkt mehr' },
            {
              topic: 'Bauen am Hafen',
              before: 'nur günstiger Tausch',
              after: 'dazu Hafenpunkte: Siedlung 1, Stadt 2',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Wer zuerst <b>3 Hafenpunkte</b> hat, wird Hafenvogt und bekommt <b>2 Siegpunkte</b>. Hat später jemand mehr Hafenpunkte, übernimmt er das Amt samt Punkten.',
        },
      ],
    },
    {
      variant: 'wuerfelstapel',
      blocks: [
        { kind: 'h', text: 'Würfelstapel' },
        {
          kind: 'gallery',
          items: [
            { src: 'web/cards/dice-deck-back.jpg', label: 'Rückseite', shape: 'card' },
            { src: 'web/cards/dice-deck-front.jpg', label: 'Vorderseite', shape: 'card' },
          ],
        },
        {
          kind: 'p',
          html: 'Mit Würfeln kann eine Zahl lange ausbleiben. Der Stapel sorgt dafür, dass über das Spiel jede Zahl so oft kommt, wie sie soll.',
        },
        {
          kind: 'changes',
          now: 'Würfelstapel',
          rows: [
            {
              topic: 'Würfeln',
              before: 'zwei Würfel',
              after: 'eine Karte aus einem Stapel mit 36 Karten',
            },
          ],
        },
        {
          kind: 'p',
          html: 'Im Stapel ist jede Summe so oft, wie zwei Würfel sie ergeben können: eine 2, zwei 3er und so weiter bis zu sechs 7ern. Bei 5 übrigen Karten wird neu gemischt, damit niemand das Ende ausrechnen kann.',
        },
      ],
    },
  ],
};

export const CHAPTERS: Record<ChapterId, Chapter> = {
  grundspiel: GRUNDSPIEL,
  'grosse-runde': GROSSE_RUNDE,
  seewege: SEEWEGE,
  stadtwacht: STADTWACHT,
  fischgruende: FISCHGRUENDE,
  flusslaeufe: FLUSSLAEUFE,
  duell: DUELL,
  hausregeln: HAUSREGELN,
};

/** Alle Kapitel mit allen Hausregeln, zum Nachlesen in der Lobby, bevor etwas eingeschaltet ist. */
export function allChapters(): Chapter[] {
  return Object.values(CHAPTERS);
}

/** Das Kapitel, das eine Variante aus der Lobby erklärt. */
export function chapterForVariant(id: VariantId): ChapterId {
  return id in CHAPTERS ? (id as ChapterId) : 'hausregeln';
}

/** Die Kapitel, die in dieser Partie gelten: immer das Grundspiel, dazu Karte, Spielerzahl und Varianten. */
export function chaptersFor(
  settings: Pick<GameSettings, 'map' | 'variants'>,
  players: number,
): Chapter[] {
  const on = new Set(settings.variants ?? []);
  const ids: ChapterId[] = ['grundspiel'];
  if (players > 4) ids.push('grosse-runde');
  if (mapById(settings.map).seafaring) ids.push('seewege');
  for (const v of VARIANTS) if (v.kind === 'expansion' && on.has(v.id)) ids.push(v.id as ChapterId);
  const chapters = ids.map((id) => CHAPTERS[id]);
  // Die Einleitung der Hausregeln steht immer da, danach nur die eingeschalteten.
  const house = HAUSREGELN.pages.filter((p) => !p.variant || on.has(p.variant));
  if (house.some((p) => p.variant)) chapters.push({ ...HAUSREGELN, pages: house });
  return chapters;
}
