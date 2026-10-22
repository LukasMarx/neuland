# Neuland – Ausgefallene Karten

Stand: 22.10.2026. **Umgesetzt:** alle Karten aus Abschnitt 3 einschließlich Zufallsküste, Generator mit Bewertung, Meer aus der Form, Kartenwahl in der Lobby (`src/app/engine/maps.ts`, `board.ts`, `src/app/ui/lobby/map-thumb.ts`). Entscheidungen zu den offenen Fragen: Klassisch behält die festen Hafenplätze und das gewohnte Meer, die Kartenwahl setzt das Siegziel auf den Vorschlag der Karte, Klimazonen bleiben weiche Vorlieben. Noch offen: Vorschau und Neuwürfeln in der Lobby, Startzonen, eigene Masken.

Klickbarer Prototyp mit allen Karten, echtem Generator und Prüfungen:
`output/designs/karten-2026-10-21/index.html` (lokal: http://localhost:4310/output/designs/karten-2026-10-21/index.html).
Der Link merkt sich Karte, Spielerzahl und Seed, z. B. `#weltkarte/6/424242`.

## 1. Ziel

Heute ist das Brett immer das klassische Sechseck: 19 Felder bis 4 Spieler, 30 Felder ab 5 (`src/app/engine/board.ts:5-8`).
Der Gastgeber soll in der Lobby eine andere Karte wählen können, etwa eine stilisierte Weltkarte, einen Ring um einen Binnensee
oder eine jedes Mal neu gewachsene Küste. Regeln, Bauen und Handel bleiben gleich. Neu sind nur Form, Vorräte und
die Verteilung von Gelände, Zahlen und Häfen.

## 2. Rahmenbedingungen

- **Eine Landmasse.** Ohne Schiffe muss jedes Landfeld über Land erreichbar sein, sonst sitzt jemand fest. Inseln und
  Archipele gibt es erst mit der Erweiterung „Seewege“ (`docs/ERWEITUNGEN.md`, Abschnitt 2.2), siehe Abschnitt 9.
  In einem Sechseckraster berühren sich zwei Felder nie nur an einer Ecke. Es genügt deshalb, den Zusammenhang über
  Feld-Nachbarschaften zu prüfen.
- **Balance.** Feldzahl passend zur Spielerzahl (rund 19 für 3–4, 30 für 5–6, mehr nur mit höherem Siegziel),
  übliche Geländemischung, Zahlenchips 2–12 ohne 7, keine 6/8 nebeneinander, möglichst keine gleichen Zahlen nebeneinander,
  Häfen über alle Küsten verteilt, genug gute Startplätze für die Schlangenrunde.
- **Feste Form, zufällige Belegung** ist der Normalfall. Handgemachte Karten mit fester Belegung (Szenarien) gehen
  mit demselben Datenformat.
- **Rechtliches.** Keine Marken- oder Szenarionamen des Originals. Alle Namen hier sind beschreibend
  (Weltkarte, Atoll, Zwei Reiche …).

## 3. Die Karten

Alle Zahlen stammen aus dem Generator des Prototyps.

| Karte | Felder | Spieler | Wüsten | Häfen (2:1 / 3:1) | Küstenkanten | Ecken mit 3 Landfeldern | Karten je Rohstoff | Siegpunkte |
|---|---|---|---|---|---|---|---|---|
| Klassisch | 19 / 30 | 2–4 / 5–6 | 1 / 2 | 9 (5/4) / 11 (6/5) | 30 / 38 | 24 / 42 | 19 / 24 | 10 |
| Kratersee | 18 | 3–4 | 1 | 9 (5/4), einer am See | 30 + 6 See | 18 | 19 | 10 |
| Langes Tal | 22 | 3–4 | 1 | 10 (6/4) | 38 | 26 | 20 | 10 |
| Halbmond | 22 | 3–4 | 1 | 10 (6/4) | 42 | 24 | 20 | 10 |
| Atoll | 30 | 5–6 | 2 | 12 (7/5) | 42 + 18 Lagune | 30 | 24 | 10 |
| Zwei Reiche | 30 | 4–6 | 2 | 12 (7/5) | 58 | 32 | 24 | 10 |
| Europa | 32 | 5–6 | 2 | 14 (8/6) | 74 + 12 Ostsee | 21 | 25 | 11 |
| Weltkarte | 42 | 5–6 | 3 | 16 (9/7) | 110 | 30 | 29 | 12 |
| Zufallsküste | 20 / 30 | 2–4 / 5–6 | 1 / 2 | ca. 9 / 11–12 | wechselnd | wechselnd | 19 / 24 | 10 |

„Ecken mit 3 Landfeldern“ ist die wichtigste Kennzahl für die Form: Nur dort entstehen starke Startplätze.
Als Faustregel sollten es mindestens 4 je Spieler sein. Kratersee (4,5 bei 4 Spielern) und Europa (3,5 bei 6 Spielern)
liegen knapp darüber bzw. darunter und zeigen im Prototyp gelegentlich die Warnung „zu wenige gute Startplätze“.

### Klassisch
Das heutige Brett als Maske. Gleiche Vorräte, gleiche Ecken- und Kanten-IDs wie heute (Abschnitt 6.2), damit
alte Spielstände gültig bleiben.

### Kratersee (18 Felder, 3–4)
```
  . . .
 . . . .
. . ~ . .
 . . . .
  . . .
```
Ein Ring um einen Ein-Feld-See. Die sechs Ecken am Kraterrand berühren je zwei Landfelder, eine davon liegt am Seehafen.
Dort wird zuerst gesiedelt. Testet die Erkennung innerer Küsten mit kleinstem Aufwand.

### Langes Tal (22 Felder, 3–4)
```
 . . . . . . .
. . . . . . . .
 . . . . . . .
```
Drei Reihen, acht Felder lang. Weite Wege, umkämpfte längste Handelsstraße, viele Häfen. Die einfachste unregelmäßige
Form und ein guter erster Test für die Darstellung (sehr breites Seitenverhältnis).

### Halbmond (22 Felder, 3–4)
```
  . . .
 . . . .
. . .
 . .
. . .
 . . . .
  . . .
```
Eine Sichel um eine offene Bucht, die Mitte ist nur zwei Felder breit. Testet nach innen gewölbte Küsten:
Das heutige Ozean-Polygon würde die Bucht falsch zeichnen (Abschnitt 7.2).

### Atoll (30 Felder, 5–6)
```
   . . . .
  . . . . .
 . . ~ ~ . .
. . ~ ~ ~ . .
 . . ~ ~ . .
  . . . . .
   . . . .
```
Ein Landring um eine Lagune aus sieben Wasserfeldern. 12 Häfen (fest eingestellt statt 13 nach Formel),
davon etwa ein Drittel an der Lagune. Wer innen baut, erreicht schnell den ganzen Ring.

### Zwei Reiche (30 Felder, 4–6)
```
  . .         . .
 . . .       . . .
. . . . . . . . . .
 . . .       . . .
  . .         . .
```
Zwei Kontinente aus je 14 Feldern, verbunden durch eine Landbrücke aus zwei Feldern. Wer die Brücke bebaut, sperrt den
Weg nach drüben. Optionale Startregel: je eine Startsiedlung pro Reich (Abschnitt 4.4).

### Europa (32 Felder, 5–6, Siegziel 11)
```
              h e h
             e   h
            . ~ ~ g
       w . . . g g
  . . w . e e . g .
 l .     .   e .
  x       .   w
           .   w
```
Stilisiert: Skandinavien und Finnland umschließen die Ostsee als Binnensee (3 Felder), Iberien, Italien und Griechenland
ragen ins Mittelmeer. Kleinbuchstaben sind Vorlieben („Klimazonen“, Abschnitt 4.2): Erz in Alpen und Norden,
Getreide im Osten, eine Wüste in Iberien. Großbritannien fehlt bewusst und kommt erst mit Schiffen als Insel dazu.

### Weltkarte (42 Felder, 5–6, Siegziel 12)
```
  h h   . .   h h h
   . . .   w . . . . .
  e g       . e g .
   l       x . x   . g
    .       . l     .
     h       .       .
    . e     h       x w
                   w .
```
Alle Kontinente als eine Landmasse: Nordamerika hängt über Grönland und Island an Europa, Mittelamerika verbindet
Nord- und Südamerika, Afrika hängt an Europa und Arabien, Australien über Indonesien an Asien. Die drei Wüsten liegen
fest in Sahara, Arabien und Australien (`x`). Erz bevorzugt in Rocky Mountains, Anden und Himalaya, Holz in Kanada und
Sibirien, Getreide in Prärie und Ukraine, Wolle in Australien. Das Meer wird als Seekarte mit abgerundetem Rechteck
gezeichnet (`sea: 'rect'`), sonst sähe der offene Atlantik wie ein Loch aus.

### Zufallsküste (20 oder 30 Felder, 2–6)
Die Form wächst bei jedem Spiel neu aus der Mitte (Abschnitt 5.7): kompakt, mit Buchten, manchmal einer kurzen
Halbinsel oder einem kleinen See. Nadelspitzen (Felder mit nur einem Nachbarn) werden nach innen verlegt.

## 4. Karten als Daten

### 4.1 Schreibweise: ASCII-Maske

Karten werden als Maske in „doubled coordinates“ geschrieben: jedes Zeichen außer Leerzeichen ist ein Feld,
gerade Zeilen stehen auf geraden Spalten, ungerade auf ungeraden. So sieht die Maske in einem Monospace-Editor
fast aus wie das Brett. Der Parser prüft die Parität und meldet verrutschte Zeichen.

| Zeichen | Bedeutung |
|---|---|
| `.` | Landfeld, Gelände aus dem Vorrat |
| `~` | Wasser innerhalb der Form (nur Lesehilfe, Seen werden automatisch erkannt) |
| `h l w g e` | Vorliebe für Holz, Lehm, Wolle, Getreide, Erz (Gewicht ×5 beim Ziehen) |
| `x` | Wüstenplatz (Wüsten landen zuerst hier) |
| `H L W G E X` | festes Gelände |

Umrechnung in axiale Koordinaten: `r = Zeile`, `q = (Spalte − Zeile) / 2`. Mittelpunkt in Feldradien:
`x = √3 · (q + r/2)`, `y = 1,5 · r`, wie heute in `board.ts:105-106`.

### 4.2 Kartendefinition

Die Maske ist nur Schreibweise. Beim Laden entsteht daraus die Feldliste der `MapDef` aus `docs/ERWEITUNGEN.md`,
Abschnitt 3.3. Für Landkarten reicht folgende Teilmenge:

```ts
export interface LandMapDef {
  id: MapId;                         // 'klassisch' | 'weltkarte' | 'atoll' | 'zufallskueste' …
  name: string;
  players: [min: number, max: number];
  victoryPoints: number;             // Vorschlag, Host kann ändern
  shape:
    | { mask: string[] | ((players: number) => string[]) }
    | { random: { size: (players: number) => number } };
  terrainPool?: Partial<Record<Terrain, number>>; // sonst Formel (5.2)
  numberPool?: number[];                          // sonst Formel (5.2)
  numbers?: Record<string, number>;               // feste Zahlen je 'q,r' (Szenarien)
  deserts?: number;                               // sonst round(N / 15), mindestens 1
  harbors?: number | { edge: [q: number, r: number, side: 0|1|2|3|4|5]; type: HarborType | 'pool' }[];
  sea?: 'frame' | 'rect';                         // Darstellung des Meers (7.2)
  setup?: { zones?: Record<string, string[]>; rule?: 'onePerZone' }; // optionale Startregel
}
```

Die Karten liegen als TypeScript-Daten in `src/app/engine/maps/` (eine Datei je Karte, plus `index.ts` mit der Liste).

### 4.3 Was im Spielstand liegt

`BoardState` bekommt `map: MapId` und `cells: [q, r][]`. Die Feldliste wird immer mitgespeichert, weil die Zufallsküste
nicht aus der ID rekonstruiert werden kann. Das sind bei 42 Feldern unter 1 KB. Die Topologie (Ecken, Kanten, Küsten)
wird wie heute nicht gespeichert, sondern aus `cells` berechnet und zwischengespeichert.

### 4.4 Optionale Startregeln

Für Karten mit klaren Gebieten (Zwei Reiche, später Inseln) kann eine Karte Zonen aus Feldern definieren. Mit
`rule: 'onePerZone'` muss die zweite Startsiedlung in einer anderen Zone stehen als die erste. Das ist eine kleine
Prüfung in `placeSettlement` während `setup` und gehört nicht in den ersten Meilenstein.

## 5. Erzeugung und Ausgleich

Der Prototyp enthält den kompletten Generator als reines JavaScript ohne DOM (Abschnitt „Kartengenerator“ im Skript).
Er nutzt denselben Zufallsgenerator wie die Engine (Mulberry32, `src/app/engine/rng.ts`) und lässt sich fast
unverändert nach TypeScript übernehmen.

### 5.1 Form prüfen und Topologie bauen

1. Maske einlesen, Parität prüfen, Felder zeilenweise und von links nach rechts sortieren.
2. Topologie wie heute in `buildTopology` (`board.ts:74-142`), nur über die Feldliste statt über `ROWS`.
3. **Wasser einteilen:** Rahmen um die Form legen, von außen per Flutfüllung über Nicht-Land laufen. Was dabei nicht
   erreicht wird, ist Binnensee.
4. **Küstenschleifen:** Alle Kanten mit nur einem Landfeld sind Küste. Jede Küstenecke hat genau zwei Küstenkanten
   (eine Ecke hat drei Nachbarfelder, davon ein oder zwei Land). Darum zerfällt die Küste immer in geschlossene
   Schleifen: eine äußere und je eine pro See. Der heutige Lauf in `orderCoast` (`board.ts:144-158`) bleibt
   gleich, er wird nur so lange wiederholt, bis alle Küstenkanten verbraucht sind. Jede Schleife wird als Außenküste
   oder Seeufer markiert (Wasserfeld hinter der ersten Kante nachschlagen).
5. **Validator:** zusammenhängend, keine doppelten Felder, jedes Feld mindestens ein Nachbar, Vorräte passen zur
   Feldzahl, feste Häfen liegen auf Küstenkanten und teilen keine Ecke. Warnung bei weniger als 4 Ecken mit drei
   Landfeldern je Spieler.

### 5.2 Vorräte aus der Feldzahl

Ohne Vorgabe der Karte gilt (N = Landfelder, D = Wüsten):

- **Wüsten:** `D = max(1, round(N / 15))`.
- **Gelände:** `N − D` Felder im Verhältnis Holz 4 : Wolle 4 : Getreide 4 : Lehm 3 : Erz 3, verteilt nach der
  Methode des größten Rests. Gleichstände entscheidet der Seed.
- **Zahlen:** `N − D` Chips mit Gewicht 1 für 2 und 12, Gewicht 2 für 3–6 und 8–11, ebenfalls größter Rest.
- **Häfen:** `H = round(9 + (N − 19)·2/11 + min(3, max(0, K − 6,9·√N) / 14))`, höchstens `floor(K/3)`, mindestens 5.
  K ist die Zahl aller Küstenkanten, `6,9·√N` die Küstenlänge einer kompakten Insel gleicher Größe. Eine
  zerklüftete Küste bringt also bis zu drei Häfen mehr.
- **Hafenarten:** `max(5, round(5H/9))` Häfen 2:1 (Reihenfolge Holz, Lehm, Wolle, Getreide, Erz, dann Wolle,
  Getreide, Holz, Erz, Lehm), der Rest 3:1.
- **Bank:** `max(19, round(19 + (N − 19)·5/11))` Karten je Rohstoff.

Für 19 und 30 Felder ergeben diese Formeln exakt die heutigen Mengen aus `board.ts:10-25`
(Gelände, Zahlen, 9 bzw. 11 Häfen mit der zweiten Wolle, Bank 19 bzw. 24). Das ist im Prototyp geprüft.

### 5.3 Gelände verteilen

1. Feste Felder (Großbuchstaben) setzen.
2. Wüsten: zuerst auf `x`-Plätze, dann zufällig, nie zwei nebeneinander.
3. Übrige Felder in zufälliger Reihenfolge, Felder mit Vorliebe zuerst. Gewicht je Geländeart =
   Restvorrat × (5 bei passender Vorliebe, sonst 1) × Klumpenfaktor (1 ohne gleichen Nachbarn, 0,45 bei einem,
   0,08 bei zweien). So entstehen kaum Dreiergruppen gleicher Landschaft, und die Klimazonen bleiben weich.

### 5.4 Zahlen verteilen

Heute wird bis zu 2000-mal gemischt, bis keine 6/8 nebeneinander liegen (`board.ts:168-172`). Findet die Schleife
nichts, nimmt sie stillschweigend den letzten, regelwidrigen Versuch. Beim klassischen Brett kommt das praktisch nie
vor, bei schmalen Formen kann es passieren.

Neu, mit Neustart statt Mischen:

1. Erst die roten Zahlen (6, 8), dann alle übrigen, jeweils gemischt.
2. Jede Zahl kommt auf ein zufälliges freies Feld, auf dem sie keine Regel verletzt:
   keine 6/8 neben 6/8 (hart), keine gleiche Zahl neben gleicher Zahl.
3. Gibt es kein erlaubtes Feld mehr, beginnt der Versuch neu (bis 400-mal). Danach ein zweiter Durchgang ohne
   die Regel „keine gleichen Zahlen“. Schlägt auch der fehl, meldet der Validator die Karte als unspielbar,
   statt ein regelwidriges Brett auszuliefern.

### 5.5 Häfen über alle Küsten

1. Häfen auf die Küstenschleifen nach Länge aufteilen. Ein Seeufer bekommt höchstens einen Hafen je 6 Kanten.
2. Je Schleife gleichmäßige Abstände mit zufälligem Versatz. Um jede Sollposition werden die Kanten ±1 geprüft:
   Die Kante darf weder eine Ecke mit einem anderen Hafen teilen noch an eine Hafenecke angrenzen.
   Bevorzugt werden Kanten, deren Ecken an zwei Landfelder grenzen.
3. Bis zu 40 Versätze probieren und den mit den meisten platzierten Häfen nehmen. Fehlt danach noch ein Hafen, kommt
   er an die freie Kante mit dem größten Abstand zum nächsten Hafen.
4. Hafenarten mischen und zuweisen.

Für „Klassisch“ empfehle ich, die heutigen festen Hafenkanten (`board.ts:134-139`) als Sonderfall `'coast-even'`
beizubehalten, damit das gewohnte Bild bleibt (offene Frage 2).

### 5.6 Bewertung und Auswahl

Der Generator baut 24 vollständige Varianten (Gelände, Zahlen, Häfen) und nimmt die mit der niedrigsten Wertung:

| Kriterium | Wie gemessen | Gewicht |
|---|---|---|
| 6/8 nebeneinander | Paare | 100 (darf nie vorkommen) |
| Gleiche Zahlen nebeneinander | Paare | 6 |
| Klumpen | Größe der größten Gruppe gleicher Landschaft über 2 | 4 |
| Gute Startplätze | Fehlbetrag zu 2 × Spieler; gezählt werden Ecken mit mindestens 8 Punkten, die sich nach der Abstandsregel nicht stören | 3 |
| Fairness der Startrunde | Spanne zwischen bestem und schlechtestem Spieler in einer simulierten Schlangenrunde (jeder nimmt gierig die beste freie Ecke) | 1,5 |
| Rohstoffbalance | größte relative Abweichung des Ertrags je Feld (Wahrscheinlichkeitspunkte) vom Mittel | 30 |

Punkte sind die üblichen Wahrscheinlichkeitspunkte (2 und 12 = 1 … 6 und 8 = 5). Alles läuft deterministisch aus dem
Seed, Host und Clients kommen auf dasselbe Brett.

**Ergebnis im Prototyp:** 2700 Bretter (9 Karten × Spielerzahl 2–6 × 60 Seeds), im Mittel 1,3 ms je Brett
einschließlich aller 24 Varianten. Harte Regeln (Zusammenhang, 6/8, Hafenabstand, Hafenzahl, Räuber auf Wüste)
in allen Fällen erfüllt, gleiche Zahlen nebeneinander nie. Zu wenige gute Startplätze nur bei Kratersee (7 von 120)
und Europa (5 von 120), Spanne der Startrunde höchstens 4 Punkte.

### 5.7 Zufallsküste

1. Start mit dem Mittelfeld. Mit 45 % Wahrscheinlichkeit wird ein Feld im Abstand 2 als See freigehalten.
2. Wiederholt ein Randfeld hinzufügen. Gewicht = (Landnachbarn)² × Zufall (0,4–1,4) / (1 + 0,25 · Abstand zur Mitte),
   mit leichter Streckung in x oder y. Felder mit nur einem Landnachbarn bekommen gelegentlich (18 %) einen Bonus,
   so entstehen Halbinseln.
3. Nadelspitzen (nur ein Nachbar) werden entfernt und an der Stelle mit den meisten Landnachbarn wieder angesetzt.
4. Danach weiter wie bei festen Formen. Die Form wird mit dem Brett gespeichert (4.3).

## 6. Änderungen an der Engine

### 6.1 Typen

- `Layout` (`src/app/engine/types.ts:9-10`) wird durch `MapId = string` ersetzt.
- `BoardState` (`types.ts:22-26`): neu `map: MapId` und `cells: [number, number][]`, `layout` bleibt optional zum
  Lesen alter Stände.
- `GameSettings` (`types.ts:87-89`): neu `map?: MapId`, Vorgabe `'klassisch'`. Passt zu `scenario` aus
  `docs/ERWEITUNGEN.md` 3.1: Die Landkarten sind Karten des Szenarios „klassisch“, Seewege-Szenarien bringen eigene.

### 6.2 Topologie (`src/app/engine/board.ts`)

- `ROWS`, `TERRAINS`, `NUMBERS`, `HARBORS`, `BANK_SIZE` (`board.ts:5-25`) wandern in die Kartendefinitionen bzw.
  in die Formeln aus 5.2.
- `Topology` (`board.ts:52-60`): `layout` → `key`, `coast: number[]` → `coastLoops: { edges: number[]; lake: boolean }[]`,
  `harborEdges` nur noch für `'coast-even'`.
- `getTopology(layout)` (`board.ts:62-72`) → `getTopology(board)`, Zwischenspeicher nach `map` plus Feldliste.
  Alle Aufrufer übergeben künftig `s.board` statt `s.board.layout`, rein mechanisch:
  `rules.ts:48, 127, 147, 453, 459, 463, 475, 481, 485, 489, 498, 617, 715` und `src/app/ui/board/board.ts:93`.
  Ein kleiner Helfer `topoOf(s)` hält das lesbar.
- Feldschleife (`board.ts:103-121`) über die sortierte Feldliste statt über `ROWS`. **Pflichttest:** Für
  `klassisch` mit 4 und 6 Spielern entstehen exakt dieselben Ecken- und Kanten-IDs wie heute, sonst passen
  `buildings[vertex]` und `roads[edge]` alter Spielstände nicht mehr. Im Prototyp geprüft: gleiche Reihenfolge,
  gleiche Mittelpunkte bis auf eine Verschiebung.
- `orderCoast` (`board.ts:144-158`) → `coastLoops` (5.1, Schritt 4). Heute findet die Funktion nur einen Ring,
  ein Binnensee bliebe unerkannt.
- `generateBoard(layout, rng)` (`board.ts:160-181`) → `generateBoard(map, players, rng)` mit den Schritten aus
  Abschnitt 5. Der Räuber startet wie heute auf der ersten Wüste (`board.ts:180`), bei der Weltkarte in der Sahara.
- `vertexHarbors` (`board.ts:189-198`) bleibt unverändert, Häfen stehen schon heute mit Kante im Spielstand.

### 6.3 Regeln (`src/app/engine/rules.ts`)

- `createGame` (`rules.ts:43-56`): Karte aus `settings.map` statt `players.length > 4 ? 'ext' : 'base'` (`rules.ts:46`).
  Liegt die Spielerzahl außerhalb des Bereichs der Karte, Fehler „Diese Karte ist für 5–6 Spieler.“
- `DEV_DECK` (`rules.ts:30-33`) hängt künftig an der Spielerzahl (bis 4: 25 Karten, ab 5: 34), nicht am Layout.
  Für 42 Felder reicht das nach meiner Einschätzung (offene Frage 8).
- Bank (`rules.ts:56`) aus der Formel in 5.2 bzw. aus der Karte.
- Siegziel: `settings.victoryPoints` bleibt maßgeblich (`rules.ts:688-689`). Die Lobby setzt bei Kartenwahl den
  Vorschlag der Karte, solange der Host die Siegpunkte nicht selbst geändert hat.
- Sonderbauphase (`rules.ts:411`) hängt schon heute an der Spielerzahl und bleibt.

### 6.4 Tests

- `board.spec.ts:34-36` und `:107-154` laufen heute über `['base', 'ext']`. Künftig über alle Karten und
  Spielerzahlen: Topologie-Invarianten, Vorräte, 6/8, Hafenabstand, Determinismus je Seed.
- Neu: Snapshot der klassischen IDs, Erkennung von Seen (Kratersee: eine Schleife mit 6 Kanten), Zusammenhang,
  Validator-Fehler für kaputte Masken, Migration alter Spielstände.

## 7. Änderungen an der Oberfläche

### 7.1 Lobby (`src/app/ui/lobby/lobby.ts`)

- Im Einstellungs-Panel (`lobby.ts:77-97`) über den Siegpunkten ein Feld „Karte“: Kacheln mit Vorschaubild
  (Umriss aus `cells`, Wasser und Seen, wie in der Liste des Prototyps), Name, „30 Felder · 5–6 Spieler“ und Stichworten.
- Nur der Host wählt (wie heute `setVp`, `lobby.ts:226-229`), alle anderen sehen die gewählte Kachel.
- Passt die Karte nicht zur aktuellen Spielerzahl, steht das auf der Kachel („für 5–6 Spieler“) und „Spiel starten“
  ist mit Begründung gesperrt (`canStart`). Leitlinie 4 aus `UX-KONZEPT.md`: „Was nicht geht, sagt warum.“
- Der feste Hinweistext zu 19/30 Feldern (`lobby.ts:91-97`) wird zur Beschreibung der gewählten Karte.
- Später möglich: Der Host würfelt das Brett schon in der Lobby und sieht es vor dem Start (offene Frage 4).

### 7.2 Brett (`src/app/ui/board/board.ts`, `board.html`)

- **Meer:** Heute wird jede Küstenecke vom Schwerpunkt aus um 0,8 Radien nach außen geschoben
  (`board.ts:15`, `:132-153`, `board.html:3-4`). Bei Buchten und Engstellen überschneidet sich das Polygon,
  ein Binnensee fehlt ganz. Neu wie im Prototyp: Wasserfläche = Land plus ein Feld Rand plus Seen, schmale Kerben
  und eingeschlossene Lücken gefüllt, Umriss über dieselbe Schleifenlogik, mit Chaikin-Glättung weich gerundet.
  Bei `sea: 'rect'` ein abgerundetes Rechteck als Seekarte. Seen liegen innerhalb der Fläche und brauchen keinen
  eigenen Pfad, die Landfelder liegen darüber. Dazu ein heller Brandungsstrich entlang jeder Küstenschleife,
  auch am Seeufer.
- **Ausschnitt:** `bounds` (`board.ts:96-112`) aus der neuen Wasserfläche und den Hafenschildern. Zoom und
  Verschieben funktionieren unverändert, bei Weltkarte und Europa sind sie wichtig.
- **Figurengröße:** `PIECE_SCALE` (`board.ts:13`, `:58`) hängt am Layout. Neu aus der Ausdehnung in Feldern ableiten,
  z. B. `k = clamp(1 + 0,2 · (Breite in Feldern − 5), 1, 1,5)`, kalibriert auf heute 1,0 (19 Felder) und 1,2 (30 Felder).
- **Häfen:** Position aus Kantenmitte und Landfeld (`board.ts:180-206`) funktioniert auch an Seeufern, weil eine
  Küstenkante ohne Meerfelder genau ein Landfeld hat. Erst mit Seewege muss das Landfeld gesucht werden.
- **Räuber:** unverändert.
- **Spielkopf:** Kartenname neben „bis 12“ (`src/app/ui/game/game.html:6`).

## 8. Spielstand und Protokoll

- `GameSettings.map` ist optional. Räume und Stände ohne das Feld gelten als `'klassisch'`. `RoomInfo.settings`
  (`src/app/net/protocol.ts:18`) trägt die Einstellung schon heute zu allen Clients, die Nachrichtenform ändert sich nicht.
  Die Vorgabe beim Erstellen eines Raums steht in `src/app/net/room.service.ts:203`.
- Alte Spielstände: `board.layout` ohne `board.map` wird beim Laden übersetzt (`'base'` → klassisch/4, `'ext'` →
  klassisch/6, `cells` aus den Reihen). Dank gleicher IDs bleiben Gebäude und Straßen gültig.
- Alte App-Version: Ein Client mit zwischengespeicherter alter Version kennt `map` und `cells` nicht und würde bei
  einer neuen Karte abstürzen. Abhilfe ist die Versionierung aus `docs/ERWEITUNGEN.md` 3.5 (`GameState.schema`,
  Protokollversion in `hello`, Hinweis „Bitte Seite neu laden“). Bis dahin: neue Karten erst anbieten, wenn alle
  Spieler im Raum die neue Version melden. Klassische Bretter behalten `layout` zusätzlich, damit alte Clients
  sie weiter darstellen.
- Größe: plus höchstens 42 Koordinatenpaare, unter 1 KB.

## 9. Inseln und Archipele (Abhängigkeit Seewege)

Alles in diesem Dokument ist Land ohne Schiffe. Mit der Erweiterung „Seewege“ (`docs/ERWEITUNGEN.md` 2.2 und 3.3)
kommen Meerfelder mit eigenen Ecken und Kanten hinzu. Dann werden möglich:

- Weltkarte ohne Landbrücken: Amerika, Eurasien-Afrika und Australien als eigene Inseln, Grönland und Island als
  kleine Inseln.
- Europa mit Großbritannien und Irland.
- Zwei Reiche ohne Brücke, die Überfahrt kostet Schiffe.
- Ein „Archipel“ aus vier bis sechs kleinen Inseln und eine Zufallsküste mit Inseln.

Das Maskenformat ist dafür schon vorbereitet: `~` wird dann zum echten Meerfeld, der Validator prüft statt
„zusammenhängend über Land“ nur noch „jede Insel über Meer erreichbar, Startinsel groß genug“.

**Umgesetzt:** Seewege-Karten Erste Überfahrt, Inselquartett, Im Dunst (mit Nebel `?`) und Inselwelt (zufälliges
Archipel, `MapDef.archipelago`), siehe `docs/ERWEITUNGEN.md` 2.2.

## 10. Aufwand und erster Meilenstein

| Schritt | Inhalt | Aufwand |
|---|---|---|
| **M1 „Formen“** | Typen und Migration, Topologie aus Feldliste mit ID-Snapshot, Küstenschleifen, Vorräte nach Formel, neue Zahlen- und Hafenverteilung, Meer aus Form, Figurengröße, Kartenwahl in der Lobby (einfache Kacheln), Karten **Klassisch**, **Langes Tal**, **Atoll**, **Weltkarte**, Tests | ca. 5–6 Tage |
| M2 „Mehr Karten“ | Kratersee, Halbmond, Zwei Reiche, Europa, Bewertung mit 24 Varianten, Vorschaubilder, Kartenname im Spielkopf | ca. 3 Tage |
| M3 „Zufall“ | Zufallsküste, Validator für eigene Masken, optional Startzonen | ca. 2–3 Tage |
| M4 „Inseln“ | erst mit Seewege (Fundament II in `ERWEITUNGEN.md`) | dort geschätzt |

**Empfehlung für M1:** Die vier Karten decken je einen neuen Fall ab: Klassisch (nichts darf sich ändern),
Langes Tal (unregelmäßige Form, breites Bild), Atoll (Binnensee, Häfen innen), Weltkarte (Wunschkarte des Eigentümers,
groß, Klimazonen, Seekarte). Abnahme: alle bisherigen Tests grün, ein altes gespeichertes Spiel lässt sich
fortsetzen, ein 3er-Spiel auf Langes Tal und ein 6er-Spiel auf der Weltkarte per Bot durchgespielt.

Liegt M1 aus `ERWEITUNGEN.md` (Einstellungen und Versionierung) vorher, wird M1 hier etwa einen Tag kleiner.

## 11. Offene Fragen an den Eigentümer

1. Welche Karten zuerst? Die Weltkarte ist mit 42 Feldern eine 5–6-Spieler-Karte. Soll es eine kleine Fassung für
   3–4 Spieler geben (rund 26 Felder, dann deutlich weniger erkennbar)?
2. Klassisch: Häfen weiter an festen Kanten wie heute, oder auch dort die neue Verteilung?
3. Soll die Kartenwahl die Siegpunkte automatisch auf den Vorschlag der Karte setzen (Weltkarte 12, Europa 11)?
4. Soll der Host das Brett schon in der Lobby sehen und neu würfeln können, bevor das Spiel startet?
5. Klimazonen: weiche Vorlieben wie im Prototyp, oder feste Regionen (z. B. immer Erz in den Anden)?
6. Zufallsküste: Seen und Halbinseln erlauben? Eine Größenwahl (klein, mittel, groß)?
7. Große Karten: 15 Straßen reichen auf der Weltkarte für die längste Straße knapper. Mehr Straßen für große Karten?
8. Entwicklungskarten bei 42 Feldern bei 34 lassen oder aufstocken?
9. Zwei Reiche: Startregel „je eine Siedlung pro Reich“ als Pflicht, als Option oder gar nicht?
10. Sind die Namen recht (Kratersee, Langes Tal, Halbmond, Atoll, Zwei Reiche, Europa, Weltkarte, Zufallsküste)?
11. Eigene Karten: Sollen Spieler später eine Maske einfügen können (Text in der Lobby), oder bleiben Karten fest im Code?
