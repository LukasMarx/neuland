# Neuland – UX/UI-Konzept

Für das gesamte Spiel gilt die festgelegte Schriftfamilie **Nunito Sans**.
Schriftwahl, Verwendung und lokale Einbindung: [TYPOGRAFIE.md](TYPOGRAFIE.md).

## Was am ersten Stand nicht gut ist

Ausgangspunkt ist ein Screenshot aus einer echten Partie (2 Spieler, Lukas am Zug nach einer 7).

| Problem | Warum es stört |
|---|---|
| Würfel sind zwei winzige Unicode-Zeichen in der Kopfzeile | Würfeln ist der emotionale Moment jedes Zugs, und man sieht ihn kaum. Wer nicht hinschaut, verpasst, was gefallen ist. |
| Nach dem Wurf passiert auf dem Brett nichts | Man muss im Verlauf nachlesen, welche Felder geliefert haben und wer was bekommt. |
| Die Hauptaktion wechselt den Ort | „Würfeln“ schwebt über dem Brett, „Zug beenden“ steht rechts in der Seitenleiste. Man sucht jedes Mal. |
| Die Hand steckt klein in der Seitenleiste | Die eigenen Karten sind das Wichtigste, was man selbst hat. Sie gehören groß in den Blick wie bei Kartenspielen. |
| Ausgegraute Bau-Buttons erklären nichts | Man sieht nicht, was fehlt („1 Lehm fehlt“). |
| Bank-Handel aus zehn blassen Mini-Buttons | Schwer zu lesen, nimmt dauerhaft Platz weg, obwohl man ihn selten braucht. |
| Spielerliste mit kryptischen Mini-Icons | Siegpunkte, Kartenzahl und Sonderkarten sind schwer zu erfassen. |
| Kein Moment für „Du bist dran“ | Nur der Tab-Titel ändert sich. |
| Beim Bauen keine Vorschau | Man klickt auf weiße Punkte und sieht erst danach, was entstanden ist. |
| Viel Leerraum links und rechts vom Brett | Das Brett ist breit genug, die Bedienelemente aber gequetscht. |

## Leitlinien

1. **Ein Ort für die nächste Aktion.** Unten rechts sitzt immer der große Hauptknopf: Würfeln → Zug beenden → Fertig (Sonderbauphase). Leertaste löst ihn aus.
2. **Das Brett erzählt, was passiert.** Würfe, Erträge, Räuber und neue Gebäude sieht man auf dem Brett, nicht nur im Verlauf.
3. **Die eigene Hand ist der Star.** Eine Leiste unten wie bei Kartenspielen: große Rohstoffkarten in Feldfarben, Entwicklungskarten daneben, Bauen direkt darunter.
4. **Was nicht geht, sagt warum.** Gesperrte Aktionen zeigen die fehlenden Rohstoffe.
5. **Weniger dauerhaft, mehr bei Bedarf.** Handel öffnet sich als Dialog. Angebote anderer Spieler erscheinen als Karten über dem Brett, dort, wo man ohnehin hinschaut.
6. **Jede Änderung an der Hand ist spürbar.** Neue Karten zeigen kurz „+2“, verlorene „−1“.
7. **Tastatur für Vielspieler.** Leertaste, S/R/C/E für Siedlung, Straße, Stadt, Entwicklung, H für Handel, Esc zum Abbrechen.

## Würfeln

- **Würfel:** zwei große 3D-Würfel mit echten Augen, unten rechts am Brett neben dem Hauptknopf. Wer dran ist, sieht sie leicht wackeln; Klick auf die Würfel oder Leertaste würfelt.
- **Ablauf für alle gleichzeitig:** Die Würfel taumeln etwa eine Sekunde und landen auf dem Ergebnis. Danach erscheint die Summe als Plakette, und die Felder mit dieser Zahl leuchten zwei Sekunden lang auf. So sieht jeder auf einen Blick, wo es Erträge gab.
- **7:** Die Summe wird rot. Das Räuber-Feld blinkt, und der aktive Spieler bekommt die möglichen Ziel-Felder markiert.
- **Ton:** Würfelklappern als Aufnahme, über den Kanal „Effekte“ in den Einstellungen (siehe [AUDIO.md](AUDIO.md)).
- Das Ergebnis steht danach weiter sichtbar neben dem Hauptknopf, bis zum nächsten Wurf.

## Layout

Umgesetzt nach Entwurf **02b · Nachtbühne, ruhig** (`output/designs/ui-2026-10-21/`): ruhiges Dunkel mit flachen Flächen und einem sparsamen sandgoldenen Akzent. Das Brett und seine Grafiken bleiben unverändert.

```
┌─────────────────────────────────────────────────────────────┬──────────────┐
│ Neuland  Raum KX7Q2M   [Mira 4] [Lukas (du) 5] [Paul 5]  …   │ Regeln Einst. │
├─────────────────────────────────────────────────────────────┼──────────────┤
│        ( Du bist dran · Handeln und bauen )                  │ Verlauf│Chat │
│ ┌────┐                                                       │ • …          │
│ │Bank│                 SPIELBRETT                            │ • …          │
│ └────┘                                                       │ [Angebote]   │
├─────────────────────────────────────────────────────────────┴──────────────┤
│ [Holz][Lehm][Wolle][Getreide][Erz] | [Ritter]   Straße Siedlung Stadt   ⚄⚂ 8 │
│                                                 Entw.  Handeln  [Zug beenden]│
└────────────────────────────────────────────────────────────────────────────┘
```

- **Kopfleiste:** Spieler nebeneinander mit Ritter-Avatar in Spielerfarbe, Name, Kartenzahl bzw. „am Zug“ und Siegpunkten. Der aktive Spieler hat eine Fläche und eine goldene Linie.
- **Brett:** Status oben, Bank links mit den Rohstoff-Icons.
- **Seitenleiste:** Verlauf und Chat als Tabs, offene Handelsangebote darunter. Mit » oder der Taste V lässt sie sich zu einer schmalen Leiste einklappen, dann bekommt das Brett die Breite; neue Chatnachrichten zählt die Leiste mit. Der Zustand wird gemerkt.
- **Einstellungen:** Knopf in der Kopfzeile (auf dem Handy nur ⚙), auch in Lobby und auf der Startseite. Reiter „Audio“ mit Musik, Effekten und Sprechern, je An/Aus und Lautstärke.
- **Dock:** Karten, Bauraster mit Figur und Kosten, die 3D-Würfel und der Hauptknopf.
- Unter 1280 px rückt das Bauraster unter die Hand.
- **Handy (bis 960 px, hochkant): wie eine App.** Nichts scrollt. Oben eine einzeilige Kopfzeile (Spieler mit Avatar und Punkten, auf schmalen Handys der Name nur beim Spieler am Zug; Regeln, Einstellungen und Verlassen als Symbole), in der Mitte das Brett, unten eine feste Leiste mit den eigenen Karten (Symbol und Anzahl), Würfeln, Hauptknopf und vier Reitern: **Karten**, **Bauen** und **Verlauf** gehen als Fach über der Leiste auf, **Handeln** öffnet den Tauschtisch. Ein Fach schließt sich, sobald gebaut, gehandelt oder ein Dialog beantwortet wird, oder mit einem Tipp aufs abgedunkelte Brett. Die Höhe der Leiste wird gemessen (`--bar-h`), Brett und Fächer richten sich danach. Die Bank steht nicht auf dem Brett; ihre Bestände zeigt der Tauschtisch.
- Handy quer (bis 520 px hoch): Brett links über die volle Höhe, rechts eine eigene scrollende Spalte mit Würfeln, Hauptknopf, Hand, Bauen und Verlauf; Kopfzeile einzeilig, Bank senkrecht am Brett.
- Dialoge (Abwerfen, Rohstoff wählen, Einstellungen …) gehen auf schmalen Handys als Fach von unten auf, über die volle Breite.
- Ohne Hover (Touch) sind Tastenkürzel ausgeblendet. Langes Drücken auf etwas mit Tooltip zeigt dessen Text als Blase (`touch-hints.ts`); Eingabefelder haben auf Touch mindestens 16 px, sonst zoomt Safari beim Antippen.
- Am Gerät: Installierbar als Web-App (Manifest, Icons, ohne Browserleiste). Während einer Partie bleibt der Bildschirm an (Wake Lock). Mit „Effekte“ an vibriert das Handy kurz, wenn man dran ist, nach dem eigenen Wurf und wenn ein eigenes Teil steht (nur wo das Gerät es kann, nicht unter iOS). Bei Mobilfunk oder „Datensparen“ ist die Musik zunächst aus (3 MB).

## Brett

- **Bau-Vorschau:** Im Baumodus zeigt Hover über einem erlaubten Platz die Figur halbtransparent in der eigenen Farbe. Mit dem Finger wählt der erste Tipp den Platz aus und zeigt dieselbe Vorschau mit „Nochmal tippen“; erst der zweite Tipp auf dieselbe Stelle baut, ein Tipp daneben hebt die Auswahl auf. Gilt für Ecken, Kanten und Felder (Räuber). Trefferflächen sind bei Fingerbedienung größer. Liegen die erlaubten Plätze nah beieinander, zoomt das Brett mit dem Finger von selbst dorthin und danach wieder heraus; ein Doppeltipp neben die Ziele zoomt hinein oder heraus.
- **Treffer:** Felder mit der gewürfelten Zahl leuchten nach dem Wurf kurz auf.
- **Räuber versetzen:** Erlaubte Felder pulsieren, Hover zeigt den Räuber als Vorschau.
- **Zoomen und Verschieben:** Mausrad, Trackpad-Pinch oder zwei Finger zoomen bis 3×, um den Zeiger herum. Gezoomt lässt sich das Brett ziehen. Ein Ziehen löst keinen Bau aus, erst ein Klick ohne Bewegung. Knöpfe unten rechts: +, − und „ganzes Brett“. Gezoomt nutzt der Ausschnitt die volle Breite der Brettfläche.
- **Großes Brett (5–6 Spieler):** Sieben statt fünf Feldreihen machen jedes Feld kleiner. Figuren, Zahlenmarken, Häfen und Räuber werden dort 1,2× größer gezeichnet (`PIECE_SCALE`).
- **Rand:** Der sichtbare Ausschnitt endet knapp hinter Wasser und Hafenschildern.

## Spielerkarten

- Name, Farbe und groß die Siegpunkte.
- Darunter klar beschriftet: Karten auf der Hand, Entwicklungskarten, Ritter, Straßenlänge.
- „Längste Straße“ und „Rittermacht“ als goldene Abzeichen mit Text, nicht nur als Hervorhebung.
- Der aktive Spieler hat einen pulsierenden Rahmen und das Label „am Zug“. Getrennte Spieler werden grau mit „getrennt“.

## Varianten

In der Lobby schaltet der Gastgeber kleine Varianten zu: milder Räuber, Hafenvogt, Würfelstapel. Jede hat einen Satz Erklärung direkt am Schalter. Der Hafenvogt erhöht das Siegziel um 1, das passiert beim Umschalten automatisch. Im Spiel stehen die Varianten im Spielkopf. Der Hafenvogt erscheint wie die längste Handelsstraße in der Spielerkarte, in der Punkte-Übersicht und als Banner. Neben den Würfeln zeigt der Würfelstapel, wie viele Karten bis zum Mischen bleiben. Mit dem milden Räuber leuchten im Räubermodus nur die erlaubten Felder.

## Seewege

- **Brett:** Meerfelder liegen im Wasser, nur ein zarter Umriss zeigt das Raster. Schiffe liegen quer auf ihrer Kante wie Straßen, das Kaperschiff steht dunkel und größer auf seinem Meerfeld.
- **Bauleiste:** zwei zusätzliche Knöpfe, „Schiff“ (Taste B) und „Versetzen“. Versetzen geht in zwei Klicks: erst das Schiff am offenen Ende einer Linie wählen (nur diese leuchten), dann das Ziel. Der Hinweis über dem Brett sagt, welcher Schritt dran ist.
- **Bei einer 7 oder einem Ritter** leuchten Landfelder für den Räuber und Meerfelder für das Kaperschiff zugleich. Ein Klick entscheidet, ohne Extra-Dialog.
- **Gold:** Wie beim Abwerfen erscheint ein Fenster mit dem Rohstoff-Wähler, „Gold! Wähle 2 Rohstoffe“.
- **Neue Insel:** Ein Banner meldet den Inselbonus; die Punkte-Übersicht hat eine Zeile „Inselbonus“.
- **Lobby:** Die Vorschaubilder zeigen Meer blau und Goldfelder gelb.

## Handel

Prototyp: `output/designs/handel-2026-10-21/index.html`. Gehandelt wird im Dock, nicht in einem Dialog: Das Brett bleibt sichtbar.

- **Tauschtisch** (`TradeTable`): „Handeln“ (Taste H) oder ein Klick auf eine Handkarte macht das Dock zum Tisch.
  - Zwei Reihen mit allen fünf Rohstoffen als große Karten: „Du gibst“ und „Du bekommst“. Klick legt eine Karte dazu, das Minus oder ein Rechtsklick nimmt eine weg. Ein Rohstoff liegt immer nur auf einer Seite.
  - Unter „Du gibst“ stehen der eigene Kurs (4:1, 3:1, 2:1) und wie viel man hat. Ein Hinweistext rechnet mit, z. B. „Mit 1 Holz mehr ginge es über die Bank“.
  - Passt das Angebot zu den Kursen, wird „Mit der Bank tauschen“ der Hauptknopf. Mehrere Pakete gehen auf einmal (8 Holz bei 4:1 gegen 2 Karten); die Engine bekommt dafür mehrere `bankTrade`-Aktionen.
  - „Allen anbieten“ schickt ein Angebot. Der Tisch zeigt dann die Antworten: nimmt an (mit „Tauschen“), lehnt ab, überlegt, oder ein Gegenangebot (mit „Annehmen“).
  - Schließen (✕, Esc) zieht das eigene Angebot und alle Gegenangebote zurück. Solange etwas offen ist, bleibt der Tisch offen, auch nach dem Neuladen.
- **Angebotsansicht** (`OfferPanel`) für alle, die nicht am Zug sind: Das Angebot steht ebenso groß im Dock, das man ohnehin gerade nicht zum Bauen braucht.
  - „Mira gibt dir“ und „Mira will von dir“, darunter „du hast 2“ bzw. rot „dir fehlt 1“.
  - Annehmen, Gegenangebot, Ablehnen. Das Gegenangebot öffnet den Tauschtisch gespiegelt vorbefüllt.
  - Eine Zeile zeigt, was die übrigen Mitspieler antworten.
  - Ein neues Angebot meldet sich im Tab-Titel („● Tauschangebot von Mira“), und der Berater sagt es an.
- Wer nicht am Zug ist, kann über „Handeln“ auch von sich aus ein Angebot an den aktiven Spieler schicken.

## Rückmeldung

- **Ereignis-Banner:** Ein breites, halbtransparentes Band läuft über das Brett, links und rechts treten freigestellte Spielteile auf.
  - Anlässe: „Du bist dran“, längste Handelsstraße, größte Rittermacht, Monopol, Erfindung und Sieg.
  - Mehrere Banner laufen nacheinander. Der Siegerdialog erscheint erst, wenn das Sieg-Banner durch ist.
  - Erkannt wird alles aus dem Unterschied zweier Spielstände (`GameView.detectEvents`), die Engine bleibt unverändert.
  - Motive (Papiercollage, `public/banner/papiercollage/`, Web-Fassung 280 px): Sieg mit Lorbeerkranz und Sternen, Handelsstraße mit Straßen und Wegweiser, Rittermacht mit Schild und gekreuzten Schwertern (ein Schwert, gespiegelt), Monopol mit Truhe und Münzen, Erfindung mit Erntekorb, „Du bist dran“ mit Signalhorn und eigener Figur.
- **Hand-Änderungen** zeigen „+n“/„−n“-Plaketten auf den Karten.
- **Fliegende Karten für alle:** Jede Kartenbewegung ist bei allen Spielern als Flug zu sehen.
  - Ertrag fliegt vom Feld zum Spieler, und zwar erst, wenn die Würfel gelandet sind.
  - Baukosten fliegen zum neuen Bauplatz.
  - Bank-Handel, Erfindung und Entwicklungskarten fliegen von oder zur Bank-Anzeige oben links.
  - Handel, Monopol und Räuber fliegen von Spieler zu Spieler.
  - Beim Räuber sehen nur die beiden Beteiligten, welche Karte es war. Alle anderen sehen eine verdeckte Karte.
  - Die Engine protokolliert dafür pro Aktion die Bewegungen (`GameState.transfers`).
- **Geräusche und Sprecher:** Bauen, Handel, Karten, Räuber und Sieg haben eigene Geräusche. Ein Berater kommentiert, was mir gelingt, ein Erzfeind, was die Gegner tun, ein Herold ruft aus, was alle angeht. Alles in [AUDIO.md](AUDIO.md).
- **Siegerbildschirm** mit Konfetti und Statistik (`end-stats.ts`, Daten aus `engine/stats.ts`):
  - Auszeichnungen für den klaren Ersten: Ernteglück, Pechvogel (vom Räuber blockiert), Langfinger, Händlerseele, Bücherwurm.
  - Siegpunkte je Zug als Stufenlinien in Spielerfarbe, beim Darüberfahren der Stand aller nach diesem Zug.
  - Würfelverteilung 2–12 gegen den Erwartungswert.
  - Tabelle je Spieler: Erträge, blockiert, geraubt/verloren, abgeworfen, getauscht, an die Bank, Entwicklung, Ritter, Straße.
  - Gezählt wird nur Öffentliches, die Statistik verrät also keine verdeckten Karten. Lange Spiele werden in der Punktekurve auf höchstens 200 Stände ausgedünnt.
