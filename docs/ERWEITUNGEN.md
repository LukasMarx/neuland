# Neuland – Konzept für Erweiterungen

Stand: 21.10.2026 · Entwurf zur Abstimmung, noch nichts davon ist umgesetzt.

## 1. Überblick

Neuland spielt heute das komplette Grundspiel für 2–6 Spieler, ab 5 Spielern mit großem Brett und Sonderbauphase (siehe [KONZEPT.md](KONZEPT.md)). Dieses Dokument beschreibt, wie die bekannten Erweiterungen dazukommen können: was sich an Regeln, Engine, Brett und Oberfläche, Netzwerk und Grafiken ändert, wie aufwendig das ist und in welcher Reihenfolge wir vorgehen sollten.

### Wie der Auftrag ausgelegt wurde

Der Auftrag lautete „die gängigen Erweiterungen“. Wir verstehen darunter die offiziellen Erweiterungen des Vorbilds, die tatsächlich verbreitet gespielt werden, jeweils mit ihren 5–6-Spieler-Ergänzungen:

| Arbeitstitel (Neuland) | Kurz | Kern |
|---|---|---|
| **Seewege** | SW | Meer auf dem Brett, Schiffe, Inseln, Goldgrund, Nebel |
| **Stadtwacht** | ST | Güter, Stadtausbau in drei Richtungen, Wächter, Plündererflotte |
| **Fernhandel** | FH | Sammlung kleiner Szenarien und Varianten (Fischgründe, Flussläufe, Kamelzüge, Küstenüberfall, Warenzüge, Duell für zwei) |
| **Ferne Küsten** | FK | Schiffe mit Bewegungspunkten, Entdecken, Aufträge, Kaperschiffe |
| **Kleine Varianten** | KV | Würfelstapel statt Würfel, Milder Räuber, Hafenvogt, Duell für zwei |

Die kleinen Varianten stammen zum großen Teil aus der Fernhandel-Schachtel, werden hier aber gesondert geführt, weil sie sich mit fast allem kombinieren lassen und die schnellsten Gewinne sind. Szenario-Erweiterungen, Jubiläumsausgaben, Sonderbretter und Ableger (Kartenspiel, Würfelspiel, historische Szenarien) sind bewusst nicht enthalten. Wenn der Eigentümer etwas anderes gemeint hat, siehe offene Fragen in Abschnitt 7.

### Rechtlicher Rahmen

Neuland heißt bewusst nicht wie das Vorbild. Für alle Erweiterungen gilt dasselbe:

- Spielmechaniken setzen wir um. Namen, Regeltexte, Kartentexte, Grafiken und eigene Begriffe des Vorbilds übernehmen wir nicht.
- Jede Erweiterung hat einen eigenen deutschen Arbeitstitel, jedes neue Spielteil einen eigenen Namen (Glossar in Abschnitt 2.6). Die Originalnamen stehen je Erweiterung genau einmal in einer Zeile „Referenz“, nur damit wir wissen, worüber wir reden. In der App, in Grafik-Prompts, Commit-Nachrichten und Dateinamen tauchen sie nicht auf.
- Regeln beschreiben wir in eigenen Worten und nur so weit, wie wir sie zum Programmieren brauchen. Kartentexte schreiben wir selbst neu.
- Zahlen in diesem Dokument (Kosten, Punkte, Mengen) stammen aus dem Gedächtnis und einer kurzen Recherche. Vor der Umsetzung jeder Erweiterung prüfen wir sie einmal gegen die Originalregel. Stellen, bei denen wir unsicher sind, sind mit **(prüfen)** markiert.
- Hinweis: [KONZEPT.md](KONZEPT.md) nennt unter „Später denkbar“ noch zwei Originalnamen. Das sollte bei Gelegenheit auf die Arbeitstitel umgestellt werden (dieses Dokument ändert andere Dateien nicht).

### Aufwandsskala

| Stufe | Grob | Bedeutung |
|---|---|---|
| S | bis 3 Tage | Eine Regel-Hook, ein Schalter in der Lobby, ein paar Tests |
| M | ca. 1–2 Wochen | Neue Aktionen und Zustände, neue UI-Elemente, wenige Grafiken |
| L | ca. 3–5 Wochen | Neue Spielteile auf dem Brett, mehrere Phasen, eigener Grafiksatz |
| XL | 6 Wochen und mehr | Grundlegend neues Spielsystem oder Umbau von Brett und Engine |

Die Schätzungen gelten für eine Person mit KI-Unterstützung und setzen voraus, dass das Fundament aus Abschnitt 3 steht. Das Fundament selbst ist eigens geschätzt.

---

## 2. Die Erweiterungen im Einzelnen

### 2.1 Kleine Varianten (KV)

Referenz (nur zur Orientierung): Varianten aus der Schachtel, die hier als Fernhandel (2.4) geführt wird, sowie ein separat erschienenes Kartenset als Würfelersatz.

> **Umgesetzt am 22.10.2026:** Milder Räuber, Hafenvogt und Würfelstapel (ohne Ereigniskarten) als Varianten in `src/app/engine/variants.ts`, zuschaltbar in der Lobby (`GameSettings.variants`). Aus Abschnitt 4 ist Maßnahme A umgesetzt: frischer Zufall vom Host vor jeder Aktion, Entwicklungskarten werden zufällig gezogen. Noch offen: Ereigniskarten im Würfelstapel, ein eigenes Banner-Motiv für den Hafenvogt, Duell für zwei.

#### Würfelstapel statt Würfel

**Regel:** Ein Stapel aus 36 Karten ersetzt die zwei Würfel. Die Karten bilden genau die Verteilung zweier Würfel ab (eine 2, zwei 3er … sechs 7er … eine 12). Wer würfeln müsste, deckt die oberste Karte auf. Einige Karten tragen zusätzlich ein kleines Ereignis (z. B. „jeder mit den meisten Rittern bekommt einen Rohstoff“, „Handel ist diese Runde nur mit der Bank erlaubt“). Etwa fünf Karten vor dem Ende wird neu gemischt, damit das Ende nicht vorhersagbar ist. Die Karte kann außerdem die Einzelwerte zweier Würfel angeben, damit Stadtwacht (roter Würfel) weiter funktioniert.

**Engine:**
- Neuer Zustand `ext.diceDeck: { remaining: Record<number, number>; drawn: number }`. Der Stapel wird als Zählwerk gespeichert und erst beim Ziehen zufällig bestimmt (siehe Abschnitt 4). Damit gibt es keine Reihenfolge, die man im Spielstand nachlesen könnte.
- Hook `rollSource` ersetzt die Würfelzeile in `roll` (`src/app/engine/rules.ts:167`). Ereignisse als eigene kleine Effekt-Funktionen, je Ereignis ein Test.
- `GameState.dice` bleibt `[number, number]`, die Karte liefert passende Einzelwerte.

**Brett/UI:** Die 3D-Würfel (`dice-tray.ts`) bekommen eine Kartenvariante: Karte dreht sich auf, Summe als Plakette wie bisher. Ereignistext als Ereignis-Banner. Neben dem Würfelplatz ein kleiner Zähler „noch 23 Karten bis zum Mischen“.

**Netzwerk:** Kein Problem, wenn der Stapel als Zählwerk geführt wird. Würde die Reihenfolge im Stand stehen, könnten alle die nächsten Würfe lesen.

**Grafik:** Kartenrückseite „Würfelstapel“, eine Vorderseite mit Platz für die Zahl als echten Text, 6–8 kleine Ereignismotive.

**Aufwand:** S–M. Die Mechanik ist klein, die Ereignisse brauchen eigene Texte und Tests.

**Risiken:** Ereignistexte dürfen keine Originaltexte sein, wir schreiben eigene. Wenig Risiko sonst.

**Kompatibilität:** Mit allen Erweiterungen. Mit Stadtwacht muss die Karte den Wert des roten Würfels ausweisen, der Ereigniswürfel bleibt ein echter Würfel. 5–6 Spieler: unverändert.

#### Milder Räuber

**Regel:** Der Räuber (und in Seewege das Kaperschiff) darf nicht auf ein Feld, an dem ein Gebäude eines Spielers mit höchstens 2 Siegpunkten steht. Gibt es kein erlaubtes Feld, geht er in die Wüste.

**Engine:** Hook `robberTargets` filtert die Zielfelder. Heute prüft `moveRobber` nur „anderes Feld“ (`rules.ts:211`), die UI zeigt alle anderen Felder (`src/app/ui/game/game.ts:165-167`). Beides muss dieselbe Abfrage `legalRobberHexes(s, seat)` nutzen.

**UI:** Nur ein Schalter in der Lobby. Im Räubermodus leuchten weniger Felder.

**Netzwerk/Grafik:** Nichts.

**Aufwand:** S. Gut als erster Test der Modul-Hooks.

**Kompatibilität:** Mit allem. In Stadtwacht ist der Räuber bis zum ersten Angriff ohnehin vom Brett.

#### Hafenvogt

**Regel:** Siedlung an einem Hafen zählt 1 Hafenpunkt, Stadt 2. Wer zuerst 3 Hafenpunkte hat, bekommt eine Sonderkarte mit 2 Siegpunkten. Wer mehr Hafenpunkte hat als der Inhaber, übernimmt sie. Das Siegziel steigt um 1.

**Engine:** Neues `ext.harborMaster: number | null`, Prüfung im Hook `onBuild` (analog `updateLongestRoad`, `rules.ts:696-712`), Siegpunkte über Hook `victoryPoints` (`rules.ts:440-450`). Hafen je Ecke liefert schon `vertexHarbors` (`src/app/engine/board.ts:189-198`).

**UI:** Neues Abzeichen in der Spielerkarte neben „Längste Straße“ (`game.html`, Kopfleiste), Banner bei Wechsel über `detectEvents` (`game.ts:465`).

**Grafik:** Ein Banner-Motiv und ein Abzeichen-Icon (Hafenvogt-Fahne oder Laterne im Collage-Stil).

**Aufwand:** S.

**Kompatibilität:** Mit Grundspiel, Seewege, Stadtwacht. Ferne Küsten hat keine klassischen Häfen, dort sinnlos.

#### Duell für zwei

> **Umgesetzt am 22.10.2026** als Variante `duell` (nur mit genau 2 Spielern, Lobby und Host prüfen das). Eigene Regeln, nicht das Original: Zwei neutrale Mitspieler sitzen hinten in `players` (`neutral: true`) und sind nie am Zug. In der Aufstellung setzt nach der normalen Runde jeder Spieler eine Siedlung samt Straße für einen Neutralen (`phase.owners`). Nach jeder bezahlten Straße oder Siedlung folgt die Phase `neutral`: ein kostenloses Teil derselben Art für einen Neutralen nach Wahl, geht keine Siedlung, dann eine Straße. Neutrale ernten nichts und zählen nicht für längste Straße, Hafenvogt oder die Mehrheit im Netz. Handelsmarken gibt es für Siedlungen an Küste (1) und Wüste (1) und für jeden gespielten Ritter (1); damit erzwingt man einen Tausch (2 zufällige Karten vom Gegner gegen 2 gewählte) oder schickt den Räuber in die Wüste. Wer vorn liegt, zahlt 2 Marken, sonst 1. Nicht übernommen: zweimal würfeln pro Zug. Neutrale Figuren sind noch einfarbige SVG-Platzhalter in Grau.

**Regel (Kurzfassung, Details prüfen):** Zwei neutrale Mitspieler bekommen bei der Aufstellung Siedlungen und Straßen. Baut ein echter Spieler eine Straße oder Siedlung, baut er zusätzlich ein Teil für einen neutralen Spieler. Handelsmarken erhält man für Bauen an Wüste oder Küste oder für das Abgeben eines Ritters. Mit Marken kann man zum Beispiel einen Tausch mit dem Gegner erzwingen oder den Räuber zurück in die Wüste schicken. Der Führende zahlt dafür mehr Marken als der Zurückliegende.

**Engine:** Neutrale Spieler als eigene Sitze mit Flag `neutral: true`, die nie am Zug sind (`actingSeats`, `rules.ts:424-438`, und `nextTurn`, `rules.ts:672-683`, müssen sie überspringen). Neue Aktionen `placeNeutral`, `spendTradeTokens`. Viele Stellen gehen heute davon aus, dass jeder Sitz ein Mensch ist (Kopfleiste, Siegerwertung, Wiedereinstieg).

**UI:** Neutrale Spieler in grauer Farbe in der Kopfleiste, nicht anklickbar. Nach jedem Bau ein zweiter Platzierungsschritt („Setze ein neutrales Teil“). Markenzähler in der Hand.

**Grafik:** Figuren in einer neutralen Farbe (graue Variante über die bestehende Masken-Pipeline `scripts/build-piece-assets.py`), Handelsmarken-Icon.

**Aufwand:** M. Die neutralen Sitze berühren viele Stellen.

**Kompatibilität:** Nur 2 Spieler. Mit Seewege und Stadtwacht laut Original spielbar (prüfen). Da Neuland 2 Spieler schon zulässt, ist das für kleine Teams wertvoll.

---

### 2.2 Seewege (SW)

Referenz (nur zur Orientierung): „Die Seefahrer“.

> **Umgesetzt am 22.10.2026 (Seewege I):** Szenarien „Erste Überfahrt“ und „Inselquartett“ für 3–4 Spieler (`src/app/engine/maps.ts`).
> - **Meer und Häfen:** Meerfelder haben eigene Ecken und Kanten, Häfen liegen an allen Inselküsten.
> - **Schiffe und Kaperschiff:** Schiffe werden gebaut und versetzt, sie gehen auch über die Straßenbau-Karte. Wer am Ende einer Schiffslinie siedelt, ist angeschlossen. Das Kaperschiff wird statt des Räubers über ein Meerfeld versetzt.
> - **Gold und Inselbonus:** Goldfelder mit Rohstoffwahl (Phase `gold`), Inselbonus 2 Punkte.
> - **Route:** Längste Route aus Straßen und Schiffen, Wechsel nur an eigenen Gebäuden.
> - **Vereinfachung:** Gold in der Aufstellung liefert automatisch den Rohstoff, von dem die Bank am meisten hat.
> - **Grafiken:** Schiff, Kaperschiff und Goldfeld sind SVG-Platzhalter, der Auftrag für den Bild-Agenten liegt in `output/designs/seewege-2026-10-22/grafik-auftrag.md`.
> - **Noch offen:** weitere Szenarien (Sandmeer, Die Verschollenen, Stoffhandel, Freibeuterbuchten, Großbauten).
>
> **Umgesetzt am 22.10.2026 (Seewege II):**
> - **Im Dunst:** Nebelfelder (`?` in der Maske, Gelände `fog`). Im Spielstand steht nur ein Zählwerk (`GameState.fog`), Gelände und Zahl zieht der Zufall erst beim Aufdecken. Aufgedeckt wird, wenn eine Straße oder ein Schiff an das Feld gebaut oder ein Schiff dorthin versetzt wird. Land bringt dem Entdecker einen Rohstoff (Gold: den, von dem die Bank am meisten hat). Keine 6 neben einer 8, solange der Vorrat anderes hergibt. Bis zum Aufdecken gilt Nebel als Wasser für Inseln und Küsten, aber weder Straße noch Schiff noch Räuber dürfen hinein. Häfen liegen nur an bekannter Küste. Auf dem Brett dreht sich ein aufgedecktes Feld um.
> - **Inselwelt** (freie Karte): Hauptinsel aus dem Generator der Zufallsküste, ringsum kleine Inseln mit mindestens einem Meerfeld Abstand, einige mit Gold, Meer nur rund um das Land und in den Durchfahrten.
> - **5–6 Spieler:** größere Masken für Erste Überfahrt, Inselquartett und Im Dunst, alle Seewege-Karten für 3–6 Spieler.
> - **Nebenbei:** Die Topologie wird zusätzlich je Feld-Array zwischengespeichert. Das macht Partien auf großen Karten mehrfach schneller.
> - Nebelfeld ist noch ein SVG-Platzhalter, `tiles/papiercollage/fog.png` steht im Grafik-Auftrag.

#### Regeln in Kürze

- **Meer auf dem Brett:** Die Karte besteht aus Land- und Meerfeldern. Es gibt eine Hauptinsel und mehrere kleine Inseln. Karten sind je Szenario vorgegeben, teils mit zufälliger Belegung.
- **Schiffe:** Kosten 1 Holz + 1 Wolle. Ein Schiff liegt auf einer Kante, die an mindestens ein Meerfeld grenzt (Küste oder offenes Meer). Es muss an ein eigenes Gebäude oder an ein eigenes Schiff anschließen. Übergang zwischen Straße und Schiff nur über ein eigenes Gebäude. 15 Schiffe je Spieler.
- **Schiffe versetzen:** Einmal pro Zug darf man das letzte Schiff einer offenen Schiffslinie (Ende ohne Gebäude) an eine andere erlaubte Stelle versetzen, nicht ein Schiff, das in diesem Zug gebaut wurde.
- **Längste Handelsroute:** Straßen und Schiffe zählen zusammen, wenn sie über ein eigenes Gebäude verbunden sind.
- **Kaperschiff:** Liegt auf einem Meerfeld. Bei einer 7 oder einem Ritter wählt man: Räuber oder Kaperschiff versetzen. An den Kanten des Kaperschiff-Felds darf niemand Schiffe bauen oder versetzen. Gezogen wird bei Spielern mit einem Schiff an diesem Feld.
- **Goldgrund:** Landfeld mit Zahl. Bei einem Treffer wählt der Spieler je Siedlung 1, je Stadt 2 beliebige Rohstoffe.
- **Inselbonus:** Die erste eigene Siedlung auf einer neuen Insel bringt Sonderpunkte (je Szenario 1 oder 2, prüfen).
- **Nebel (einige Szenarien):** Felder liegen verdeckt. Baut man daneben eine Straße oder ein Schiff, wird das Feld aufgedeckt, bei Land mit Zahl. Wer aufdeckt, bekommt einen Rohstoff dieses Landes.
- **Siegziel:** je Szenario, meist 12–14 (prüfen).

#### Szenarien (eigene Namen)

| Neuland-Name | Idee | Braucht |
|---|---|---|
| Erste Überfahrt | Hauptinsel und kleine Inseln, Inselbonus | Karte, Schiffe, Kaperschiff, Goldgrund |
| Inselquartett | Vier gleich große Inseln, Start auf zwei davon | wie oben |
| Im Dunst | Ein Teil der Karte liegt im Nebel | Nebel, Aufdecken |
| Sandmeer | Wüstenstreifen trennt die Insel in Gebiete | Gebiets-Bonus statt Insel-Bonus |
| Die Verschollenen | Fremde Siedlungen am Rand liefern Siegpunkte und Häfen | Sonderteile, die man „besucht“ |
| Stoffhandel | Kleine Dörfer liefern Stoffballen, 2 Ballen = 1 Punkt | eigene Ware, Dorf-Felder |
| Freibeuterbuchten | Festungen erobern, Kaperschiff als Gegner | Kampfwerte, feste Schiffsroute |
| Großbauten | Jeder baut an einem Bauwerk mit mehreren Stufen | Bauwerks-Leiste |
| Freie Karte | Zufällig erzeugte Insellandschaft | Generator |

Empfehlung: zuerst nur „Erste Überfahrt“ und „Inselquartett“, dann „Im Dunst“, dann „Freie Karte“. Die übrigen Szenarien bringen jeweils eigene Sonderregeln und sind spätere Bausteine.

#### Engine

- **Topologie verallgemeinern (der große Brocken):** Heute entsteht das Brett aus festen Reihenlängen (`board.ts:5-8`, `board.ts:103-121`), die Küste ist genau ein Ring (`orderCoast`, `board.ts:144-158`) und Häfen werden gleichmäßig auf diesen Ring verteilt (`board.ts:134-139`). Mit Inseln gibt es viele Küsten, und Meer ist ein Feld wie jedes andere. Lösung: Karten als Daten mit axialen Koordinaten (Abschnitt 3.3), Meerfelder als `terrain: 'sea'` mit eigenen Ecken und Kanten.
- **Typen:** `Terrain` (`src/app/engine/types.ts:4`) um `'sea' | 'gold'` erweitern, `HexState` um `fog?: boolean` und `island?: number`. Inselnummern werden beim Laden der Karte per Flutfüllung über Landfelder berechnet.
- **Kantenbelegung:** `roads: (number | null)[]` (`types.ts` in `GameState`, Zeile 105) wird zu `edges: (EdgePiece | null)[]` mit `{ owner, kind: 'road' | 'ship' }` plus `builtTurn` für die Versetzregel.
- **Regeln:** `canBuildRoad` (`rules.ts:462-472`) darf Straßen nur an Kanten mit Land erlauben, neues `canBuildShip`. Neue Aktionen `buildShip`, `moveShip`, `moveRobber` bekommt `target: 'robber' | 'pirate'`. `robberVictims` (`rules.ts:496-503`) unterscheidet Gebäude (Räuber) und Schiffe (Kaperschiff).
- **Ertrag:** `produce` (`rules.ts:616-660`) geht davon aus, dass Gelände gleich Rohstoff ist (`rules.ts:621-622`). Für Goldgrund entsteht eine neue Phase `goldChoice { pending: number[] }`, ähnlich `discard` (`types.ts:62`): alle Betroffenen wählen gleichzeitig. Auch die Startrohstoffe in `placeSettlement` (`rules.ts:125-137`) müssen Meer und Gold beachten (Gold in der Aufstellung: Wahl, prüfen).
- **Längste Route:** `longestRoad` (`rules.ts:714-737`) läuft heute nur über Straßen. Neu: Straße und Schiff dürfen nur an einem eigenen Gebäude ineinander übergehen.
- **Inselbonus:** `ext.islandBonus: Record<seat, number[]>` (welche Inseln schon besiedelt), Siegpunkte über Hook.
- **Nebel:** Feldart und Zahl werden erst beim Aufdecken aus einem Zählwerk gezogen (Abschnitt 4). Neue Phase entfällt, das Aufdecken passiert direkt im Bauhandler.
- **Häfen:** je Karte fest oder „zufällig an geeigneten Küsten“. `HarborState.edge` bleibt.
- **Bank und Teile:** `PIECE_LIMITS` (`types.ts:167`) bekommt `ship: 15`. Bankgröße und Siegziel kommen aus der Karte statt aus `BANK_SIZE` (`board.ts:25`).

#### Brett und UI

- **Brett:** Meerfelder als eigene Sechsecke mit der vorhandenen Wassertextur. Der heutige Ozean ist ein einzelnes Polygon um die Küste (`src/app/ui/board/board.ts:132-153`, `board.html:3-4`). Künftig: ein Rechteck als Wasserfläche unter allem, Landfelder darüber, Meerfelder nur als dünne Umrisse für Klickziele. Die Hafenposition nimmt heute `e.hexes[0]` als Landfeld an (`board.ts:183`), das muss das Landfeld der Kante suchen.
- **Größere Karten:** `PIECE_SCALE` (`board.ts:13`) hängt heute am Layout. Besser aus der Feldanzahl bzw. Kartengröße ableiten. Zoom und Verschieben gibt es schon, das hilft sehr.
- **Bauraster:** Fünfter Knopf „Schiff“ (Taste `B` für Boot) neben Straße/Siedlung/Stadt/Entwicklung. Bei schmalem Dock rutscht das Raster schon heute unter die Hand. `buildOptions` (`game.ts:124-152`) ist heute fest auf vier Einträge geschrieben und sollte aus einer Liste kommen.
- **Schiff versetzen:** Klick auf ein eigenes bewegliches Schiff (leicht pulsierend markiert), dann Zielkante. Abbruch mit Esc wie beim Bauen.
- **Räuber oder Kaperschiff:** Nach der 7 kurzer Auswahldialog mit zwei großen Figuren. Alternativ beide Zielmengen gleichzeitig zeigen: Landfelder für den Räuber, Meerfelder für das Kaperschiff. Zweiteres spart einen Klick und passt zu „Das Brett erzählt, was passiert“.
- **Goldwahl:** Bestehenden `resource-picker` wiederverwenden, im Dock wie beim Abwerfen.
- **Rückmeldung:** Banner „Neue Insel besiedelt“ mit Punktzahl, Aufdecken als Umdreh-Animation, Flug „Rohstoff vom aufgedeckten Feld zum Spieler“ über `transfers` mit `{ kind: 'hex' }`, das gibt es schon (`types.ts:71-76`).
- **Spielerkarte:** zusätzlich Schiffslänge in der Route, Inselbonus-Punkte.

#### Netzwerk und verdeckte Informationen

- Nebel ist die einzige echte Geheimsache. Wird das Feld erst beim Aufdecken gezogen, steht es vorher nirgends im Spielstand. Dafür muss der Zufall für Clients unvorhersagbar sein (Abschnitt 4, Maßnahme A).
- Spielstände werden größer (bis ca. 60–80 Felder), bleiben aber unter 50 KB. Kein Umbau nötig.

#### Neue Grafiken (Papiercollage)

| Datei (Vorschlag) | Inhalt | Hinweise |
|---|---|---|
| `tiles/papiercollage/gold.png` | Goldgrund: Flussbett mit Goldkörnern zwischen Steinen | wie die übrigen Gelände, Mitte frei für den Chip |
| `tiles/papiercollage/fog.png` | Verdecktes Feld: Nebelschwaden aus weißem Seidenpapier über Wasser | ohne Zahl, leicht unterscheidbar von Meer |
| `tiles/papiercollage/sea.png` (optional) | Meerfeld als eigenes Sechseck | nur falls die durchgehende Wassertextur nicht reicht |
| `pieces/papiercollage/ship-<farbe>.png` | Schiff, Seitenansicht, liegt quer wie die Straße | Grundbild + Maske für 8 Farben, Format wie `road-*` (lang und flach) |
| `pieces/papiercollage/pirate.png` | Kaperschiff, dunkel, schwarze Segel | neutral, eine Datei |
| `icons/island-bonus.png` | Fähnchen auf kleiner Insel | für Spielerkarte und Banner |
| Banner-Motive | Schiff, Kaperschiff, Insel mit Fahne | Auftrag wie `output/designs/banner-2026-10-21/` |
| Kartenmotiv „Schiff“ | Kostenkarte im Bauraster | nur falls das Raster Bilder statt Figuren zeigt |

#### Aufwand

**L** für Erste Überfahrt und Inselquartett, wenn das Fundament steht, **XL** inklusive Topologie-Umbau und Nebel. Begründung: Die Regeln selbst sind überschaubar. Teuer sind die Verallgemeinerung der Topologie, die Neuberechnung der längsten Route und das Brett mit Meerfeldern, die alle Grundspiel-Tests weiter bestehen müssen.

#### Risiken

- Längste Route mit Schiffen ist fehleranfällig (Übergänge, Unterbrechungen durch fremde Gebäude). Viele gezielte Tests nötig.
- „Offene Schiffslinie“ sauber zu bestimmen ist knifflig, wenn Linien sich verzweigen.
- Kartendaten mit Fehlern (unerreichbare Ecken, falsche Hafenkanten): ein Validator für Karten gehört dazu.
- Große Karten auf dem Handy: ohne Zoom kaum bedienbar.

#### Kompatibilität

- **5–6 Spieler:** Eigene größere Karten je Szenario, mehr Teile, Sonderbauphase mit Schiffen (Schiffe bauen ja, versetzen nein, prüfen).
- **Stadtwacht:** offiziell kombinierbar. Wächter stehen nur auf Land. Plündererflotte und Kaperschiff existieren nebeneinander.
- **Fernhandel:** Fischgründe und Kamelzüge sind mit Seewege spielbar, andere Szenarien eher nicht.
- **Ferne Küsten:** nicht kombinierbar, nutzt aber dieselbe Meer-Topologie.

---

### 2.3 Stadtwacht (ST)

Referenz (nur zur Orientierung): „Städte & Ritter“.

> **Umgesetzt am 22.10.2026 (Stadtwacht I, Variante `stadtwacht`, in der Lobby „Stadtwacht (in Arbeit)“):** Güter Schriften, Stoff, Silber (`Commodity`, in `ResourceCounts` als optionale Felder, damit das Grundspiel und alte Stände unverändert bleiben); Städte auf Wald, Weide, Gebirge liefern 1 Rohstoff + 1 Gut. Güter zählen zum Limit, werden abgeworfen, geraubt und gehandelt (Bank 4:1, 3:1-Häfen, mit Markt ab Stufe 3 2:1). Stadtausbau in drei Richtungen mit fünf Stufen (Stufe n kostet n Güter, braucht eine Stadt), Prachtstadt für den Ersten auf Stufe 4, Übernahme mit Stufe 5 gegen einen Inhaber auf Stufe 4 (+2 Punkte), Gelehrte ab Stufe 3 (Rohstoff nach Wahl, wenn man sonst nichts bekommt). Palisade (2 Lehm, unter eigener Stadt, höchstens 3, Limit je +2). Zweite Startfigur ist eine Stadt, keine Entwicklungskarten, Siegziel +3. Verdeckte Hände und Wiederaufbau kennen die Güter. Noch offen nach Stadtwacht I: Ereigniswürfel-Tore und Einflusskarten (Stadtwacht III).
>
> **Umgesetzt am 22.10.2026 (Stadtwacht II):** Ereigniswürfel bei jedem Wurf (drei Schiffe, drei Tore; die Tore wirken erst mit den Einflusskarten). Plündererflotte auf einer Leiste mit 7 Feldern, Angriff vor dem Ertrag: Stärke = alle Städte, Verteidigung = Stufen aller bereiten Wächter. Ist die Flotte stärker, verliert, wer am wenigsten beigetragen hat und eine gewöhnliche Stadt besitzt, eine Stadt (Phase `raid`, bei mehreren Städten mit Wahl; Palisade geht mit). Sonst bekommt der alleinige stärkste Verteidiger einen Ehrenschild (+1); bei Gleichstand gibt es diesmal nichts (Einflusskarten folgen). Danach ruhen alle Wächter. Der Räuber kommt erst nach dem ersten Angriff ins Spiel. Wächter (`guards` je Ecke): aufstellen 1 Wolle + 1 Erz an der eigenen Straße, aufwerten ebenso (Stufe 3 erst mit Rat 3), bereit machen 1 Getreide (handelt ab dem nächsten Zug), einmal ziehen über eigene Straßen, schwächere fremde Wächter verdrängen (Phase `displace`), Räuber vom angrenzenden Feld vertreiben; je zwei pro Stufe. Wächter blockieren die Ecke und unterbrechen fremde Straßen. Grafik-Auftrag: `output/designs/stadtwacht-2026-10-22/grafik-auftrag.md`.

> **Umgesetzt am 22.10.2026 (Stadtwacht III-a, Einflusskarten):** Drei Stapel als Zählwerk (`progressDeck`), Hände je Sitz (`progress`), ausgespielte Karten offen (`progressPlayed`), Punktkarten je Sitz (`progressPoints`). Zeigt der Ereigniswürfel ein Tor, zieht in Zugreihenfolge jeder mit Ausbaustufe s in dieser Farbe, wenn der rote Würfel (zweiter Würfel) höchstens s+1 zeigt. Eigene Vereinfachung: Wer schon 4 Einflusskarten hält, zieht nicht (kein Abwerfen). Punktkarten liegen sofort offen aus. Gespielt wird im eigenen Zug nach dem Würfeln, beliebig viele. Gleichstand bei der Abwehr: Jeder der Besten zieht eine Karte aus einem Stapel seiner Wahl (Phase `progressPick`). Verdeckt: fremde Hände nur als Anzahl je Farbe, Stapel nur als Größe; der Wiederaufbau kennt die Karten. 16 Karten mit eigenen Namen:
>
> | Farbe | Karte | Anzahl | Wirkung |
> |---|---|---|---|
> | Gelb (Markt) | Großeinkauf | 4 | Rohstoff nennen, jeder gibt bis zu 2 |
> | | Zunftrecht | 2 | Gut nennen, jeder gibt 1 |
> | | Frachtkontor | 2 | eine Kartenart 2:1 bis Zugende |
> | Blau (Rat) | Stadtrecht | 1 | 1 Siegpunkt |
> | | Alarmglocke | 2 | alle ruhenden Wächter kostenlos bereit |
> | | Unruhestifter | 2 | wer mindestens gleich viele Punkte hat, wirft die Hälfte ab |
> | | Festbankett | 2 | wer mehr Punkte hat, schenkt 2 Karten seiner Wahl |
> | | Steuereintreiber | 2 | Räuber versetzen, bei jedem am Feld 1 Karte (erst nach dem ersten Angriff) |
> | Grün (Gelehrte) | Flaschenzug | 2 | nächster Ausbau im Zug ein Gut billiger |
> | | Pfahlramme | 1 | Palisade kostenlos |
> | | Wasserrad | 2 | 2 Getreide je Getreidefeld an eigenen Orten |
> | | Stollen | 2 | 2 Erz je Gebirge an eigenen Orten |
> | | Bauhütte | 2 | Stadt für 2 Erz + 1 Getreide |
> | | Sternwarte | 1 | 1 Siegpunkt |
> | | Landvermesser | 2 | 2 Straßen kostenlos |
> | | Waffenkammer | 2 | bis zu 2 Wächter kostenlos aufwerten |
>
> **Umgesetzt am 22.10.2026 (Stadtwacht III-b, Stadtwacht damit komplett):** die Karten mit Zielen auf dem Brett oder in fremden Händen. Die Stapel haben jetzt je 18 Karten, in der Lobby heißt die Variante nur noch „Stadtwacht“.
>
> | Farbe | Karte | Anzahl | Wirkung (eigene Fassung) |
> |---|---|---|---|
> | Gelb (Markt) | Wanderhändler | 6 | Händlerfigur auf ein Rohstofffeld an eigenem Ort: dessen Rohstoff 2:1, +1 Punkt solange man ihn hält (`trader`) |
> | | Schuldschein | 2 | Hand eines Spielers mit mehr Punkten ansehen, 2 Karten nehmen (Phase `peek`) |
> | | Jahrmarkt | 2 | Rohstoff nennen; jeder mit Gütern bekommt 1 davon und gibt 1 zufälliges Gut |
> | Blau (Rat) | Überläufer | 2 | fremden Wächter entfernen, eigenen derselben Stufe an die eigene Straße |
> | | Gesandter | 2 | offene Straße entfernen (keine Brücken, keine Neutralen); eigene gleich kostenlos neu |
> | | Ränkespiel | 2 | fremden Wächter an eigener Straße verdrängen (Phase `displace`) |
> | | Kundschafter | 3 | Einflusskarten eines Mitspielers ansehen, eine nehmen (Phase `peek`) |
> | Grün (Gelehrte) | Losbuch | 2 | statt zu würfeln: Zahlenwürfel selbst festlegen, Ereigniswürfel wird geworfen |
> | | Flurbereinigung | 2 | zwei Zahlenchips tauschen, 2, 12, 6, 8 bleiben |
>
> Verdeckt: In der Phase `peek` zeigt nur die Sicht des Nachsehenden die fremden Karten. Vereinfachungen gegenüber dem Original: Beim Überläufer wählt der Spielende den fremden Wächter, beim Jahrmarkt ist das abgegebene Gut zufällig.

#### Regeln in Kürze

- **Drei Würfel:** zwei Zahlenwürfel (einer davon farbig markiert) und ein Ereigniswürfel. Der Ereigniswürfel zeigt auf drei Seiten ein Schiff, auf den anderen je ein Stadttor in Gelb, Blau oder Grün.
- **Güter:** Städte auf Wald, Weide und Gebirge liefern 1 Rohstoff + 1 Gut statt 2 Rohstoffe. Eigene Namen: **Schriften** (Wald), **Stoff** (Weide), **Silber** (Gebirge). Hügel und Acker liefern bei Städten weiterhin 2 Rohstoffe. Güter zählen zum Handkartenlimit und werden wie Rohstoffe gehandelt.
- **Stadtausbau:** drei Richtungen mit je 5 Stufen: **Markt** (zahlt mit Stoff), **Rat** (Silber), **Gelehrte** (Schriften). Stufe n kostet n Güter der Sorte. Ab Stufe 1 braucht man mindestens eine Stadt.
  - Stufe 3 schaltet eine Fähigkeit frei: Markt: Güter 2:1 mit der Bank tauschen. Rat: Wächter auf die höchste Stufe heben. Gelehrte: wer bei einem Wurf (außer 7) nichts bekommt, nimmt sich einen Rohstoff nach Wahl.
  - Wer als Erster Stufe 4 einer Richtung erreicht, macht eine Stadt zur **Prachtstadt** (+2 Punkte). Wer später als Erster Stufe 5 erreicht, nimmt sie dem Inhaber ab, wenn dieser nur Stufe 4 hat. Höchstens drei Prachtstädte, eine je Richtung.
- **Einflusskarten** (ersetzen die Entwicklungskarten): drei Stapel in den Ausbaufarben. Zeigt der Ereigniswürfel ein Tor, zieht jeder, dessen Ausbaustufe in dieser Farbe hoch genug für den Wert des farbigen Würfels ist (Stufe s zieht bei Wert ≤ s+1). Höchstens 4 Karten auf der Hand, Punktkarten werden sofort ausgelegt. Einflusskarten dürfen im eigenen Zug nach dem Würfeln gespielt werden, eine davon (Würfel bestimmen) auch davor. Mehrere pro Zug sind erlaubt.
- **Wächter:** Figuren auf Ecken, drei Stufen (schlicht, erfahren, mächtig), je Spieler zwei pro Stufe. Aufstellen: 1 Wolle + 1 Erz, Aufwerten: 1 Wolle + 1 Erz, Einsatzbereit machen: 1 Getreide. Ein einsatzbereiter Wächter kann einmal pro Zug: entlang eigener Straßen ziehen, einen schwächeren fremden Wächter verdrängen oder den Räuber von einem angrenzenden Feld vertreiben. Danach ist er wieder inaktiv. Wächter unterbrechen fremde Straßen für die längste Route.
- **Plündererflotte:** Zeigt der Ereigniswürfel das Schiff, rückt die Flotte ein Feld auf einer 7-stufigen Leiste vor. Am Ende greift sie an: Stärke der Flotte = Anzahl aller Städte und Prachtstädte, Stärke der Verteidigung = Summe der Stufen aller einsatzbereiten Wächter.
  - Flotte stärker: Wer am wenigsten beigetragen hat und eine gewöhnliche Stadt besitzt, verliert eine Stadt (wird zur Siedlung). Prachtstädte sind sicher.
  - Verteidigung stärker: Der stärkste Beitrag bekommt einen **Ehrenschild** (1 Punkt). Bei Gleichstand zieht jeder Gleichstehende eine Einflusskarte nach Wahl der Farbe.
  - Danach werden alle Wächter inaktiv, die Flotte beginnt von vorn.
- **Räuber:** kommt erst nach dem ersten Angriff ins Spiel. Bis dahin wirft man bei einer 7 trotzdem ab.
- **Palisade:** 2 Lehm, unter einer Stadt, erhöht das Handkartenlimit um 2, höchstens 3. Geht verloren, wenn die Stadt fällt.
- **Händlerfigur:** über eine Einflusskarte auf ein Feld an eigener Siedlung/Stadt gesetzt: 2:1-Tausch für dessen Rohstoff, +1 Punkt solange man sie hält.
- **Aufstellung:** Die zweite Startfigur ist eine Stadt statt einer Siedlung.
- **Kein** größte Rittermacht, **keine** Entwicklungskarten. Siegziel 13.
- **Einflusskarten-Inhalt (eigene Fassung):** Gelb (Handel), Blau (Politik), Grün (Wissenschaft) mit je 18 Karten. Wir schreiben eigene Kartennamen und -texte. Funktional abzudecken sind u. a.: Würfelergebnis selbst bestimmen, zwei Zahlenchips tauschen, Stadtausbau verbilligen, kostenlose Straßen, kostenlose Wächter-Aufwertung, Rohstoff- und Gütermonopol, Händlerfigur setzen, Tausch 2:1 für eine Runde, fremde Wächter versetzen oder entfernen, Einflusskarte bei Gegner ziehen, Straße eines Gegners entfernen, Räuber-ähnliche Effekte gegen Führende, je eine Punktkarte in Blau und Grün. Die genaue Liste mit Mengen prüfen wir vor der Umsetzung gegen das Original und benennen alles neu.

#### Engine

- **Kartenarten:** `Resource` und `ResourceCounts` (`types.ts:1-5`) werden zu `Card = Resource | Commodity` mit `CardCounts`. Betroffen sind praktisch alle Hilfsfunktionen: `validateCounts`, `pick`, `addTo`, `takeFrom`, `transferAll` (`rules.ts:545-585`), Handel (`rules.ts:329-400`), Abwerfen (`rules.ts:189-204`), `Transfer.card` (`types.ts:81`). Empfehlung: `CARDS` als Liste aus den aktiven Modulen ableiten, Zählwerke enthalten immer alle Schlüssel mit 0.
- **Ertrag:** Hook `production(s, hex, building)` liefert ein `CardCounts` statt der festen Regel 1/2 (`rules.ts:626`). Gelehrte-Fähigkeit als Nachbearbeitung („wer nichts bekam“) mit eigener Wahlphase, die man mit der Goldwahl aus Seewege teilen kann.
- **Würfel:** `dice` wird `{ white: number; red: number; event: EventFace } | null`. Die Würfelphase ruft der Reihe nach: Ereigniswürfel (Flotte, Einflusskarten), dann Ertrag bzw. 7.
- **Neue Zustände:**
  - `ext.cityImprovements: Record<seat, { market: 0..5; council: 0..5; scholars: 0..5 }>`
  - `ext.metropolis: { market: vertex | null; council: …; scholars: … }`
  - `ext.raiders: { position: 0..7; attacked: boolean }`
  - `ext.progress: { decks: Record<Color, Record<CardId, number>>; hands: Record<seat, CardId[]>; vpCards: Record<seat, CardId[]> }`
  - `ext.walls: boolean[]` je Ecke, `ext.merchant: { hex: number; owner: number } | null`, `ext.defenders: Record<seat, number>`
- **Eckbelegung:** `Building` (`types.ts:28-31`) bekommt Geschwister: Ecken tragen künftig `VertexPiece = { owner; kind: 'settlement' | 'city' } | { owner; kind: 'guard'; level: 1|2|3; active: boolean; movedTurn?: number }`. Wächter und Gebäude schließen sich auf einer Ecke aus. Abstandsregel (`rules.ts:452-455`) gilt nur für Gebäude, Wächter blockieren aber den Bauplatz.
- **Neue Phasen:** `raidResolution` (Stadtverlust: Betroffene wählen gleichzeitig, welche Stadt), `progressDiscard` (über 4 Einflusskarten), `guardDisplace` (verdrängter Wächter wählt neuen Platz), mehrere Kartenphasen für Effekte, die Mitspieler betreffen.
- **Neue Aktionen:** `buildGuard`, `upgradeGuard`, `activateGuard`, `moveGuard`, `chaseRobber`, `improveCity`, `buildWall`, `playProgress { card; args }`, `chooseCity`, `discardProgress`.
- **Siegpunkte:** Hook für Prachtstadt (+2), Ehrenschilde, Punktkarten, Händler.
- **Längste Route:** fremde Wächter unterbrechen (`rules.ts:726-728` prüft heute nur Gebäude).
- **Abschaffen:** Entwicklungskarten und größte Rittermacht werden durch das Modul abgeschaltet (Bauoption, Kartenstapel `rules.ts:30-33`, `playKnight`).
- **Sonderbauphase:** `canBuildAnything` (`rules.ts:525-531`) muss die neuen Bauoptionen kennen. Sinnvoll als Hook, den jedes Modul ergänzt.

#### Brett und UI

- **Hand:** drei zusätzliche Güterkarten rechts neben den fünf Rohstoffen, durch einen schmalen Trenner abgesetzt. Einflusskarten ersetzen den Bereich der Entwicklungskarten, farbig gerandet, mit eigenem Inspektor (`card-inspector.ts` lässt sich übernehmen). Unter 1280 px wird es eng: Güter als halb so breite Karten oder zweite Zeile.
- **Stadtausbau-Tafel:** neuer Dock-Modus wie der Tauschtisch (`TradeTable`): drei Spalten mit fünf Stufen, aktuelle Stufe hervorgehoben, Kosten und Fähigkeit der Stufe, Prachtstadt-Zustand. Öffnet über einen Knopf „Ausbau“ im Bauraster (Taste `A`).
- **Plündererleiste:** schmale Leiste am oberen Rand der Brettfläche, rechts neben der Statuspille oder unter der Bank-Anzeige links. Zeigt Position der Flotte, Flottenstärke gegen Verteidigungsstärke als Zahl. Beim Angriff Ereignis-Banner mit Ergebnis.
- **Würfel:** dritter Würfel mit Symbolen im `dice-tray`. Ein Zahlenwürfel bekommt eine Akzentfarbe.
- **Wächter auf dem Brett:** neue Figur mit Stufenkennung (1–3 Ringe oder Wimpel) und Zustand aktiv/inaktiv (aufrecht/gedimmt). Aktionen über Klick auf eigenen Wächter: kleines Kontextmenü am Brett „Ziehen · Verdrängen · Räuber vertreiben · Aufwerten · Bereit machen“.
- **Palisade und Prachtstadt:** Palisade als Ring unter der Stadtfigur, Prachtstadt als eigene, größere Figur.
- **Spielerkarte:** Ausbaustufen als drei Mini-Balken, Anzahl Einflusskarten, Verteidigungsstärke, Ehrenschilde.
- **Bauraster:** Straße, Siedlung, Stadt, Palisade, Wächter, Ausbau. Sechs Einträge, das Raster braucht zwei Zeilen.
- **Interaktive Karten:** Viele Einflusskarten verlangen Ziele (Spieler, Feld, Kante, Rohstoff). Ein einheitlicher „Ziel wählen“-Modus mit Hinweisleiste über dem Brett (wie `board-hint` heute) hält das im Rahmen.

#### Netzwerk und verdeckte Informationen

- Einflusskarten auf der Hand sind geheim und deutlich spielentscheidender als die Entwicklungskarten heute. Mit dem jetzigen Vollversand sieht jeder in den Entwicklertools alle Hände und, falls der Stapel als Liste geführt wird, die nächsten Karten.
- Mindestens nötig: Stapel als Zählwerk und unvorhersagbarer Zufall (Abschnitt 4, Maßnahme A). Empfohlen vor Stadtwacht: Schwärzen pro Empfänger (Maßnahme B).

#### Neue Grafiken (Papiercollage)

| Gruppe | Dateien | Hinweise |
|---|---|---|
| Güterkarten | `cards/symbolstark/scrolls.png`, `cloth.png`, `silver.png` | Stil wie die Rohstoffkarten, textfrei |
| Güter-Icons | `icons/resources/scrolls.png` usw. | für Hand, Kosten, Bank |
| Einflusskarten | 3 Rückseiten (gelb, blau, grün) + ca. 20 Motive | Motive dürfen sich wiederholen, Text kommt als echter Text dazu |
| Wächter | `guard1-<farbe>`, `guard2-…`, `guard3-…` | Maskenpipeline wie die Figuren, inaktiv per CSS-Filter |
| Prachtstadt | `metropolis-<farbe>` | größer als Stadt |
| Palisade | `wall.png` neutral oder je Farbe | flacher Ring, unter der Stadt |
| Plündererflotte | `raiders.png` + Leistenhintergrund | Langschiff, dunkle Segel |
| Händlerfigur | `trader-<farbe>` | |
| Ereigniswürfel | 4 Symbole: Schiff, drei Tore | klein, gut lesbar |
| Ehrenschild | Icon + Banner-Motiv | |
| Banner | Angriff abgewehrt, Stadt gefallen, Prachtstadt | |

#### Aufwand

**XL.** Begründung: neues Kartensystem mit drei Stapeln und rund 25 verschiedenen Karteneffekten (jede mit Zielwahl, Validierung, Tests, UI), drei Würfel, neue Figuren auf Ecken mit Zuständen, Angriffsauflösung, viele neue Phasen. Der Umbau `Resource` → `Card` zieht sich durch Engine und UI.

#### Risiken

- Kartenvielfalt: Jede Karte ist ein kleines Feature. Ohne Modulstruktur wächst `rules.ts` hier auf das Mehrfache.
- Gleichzeitige Entscheidungen mehrerer Spieler (Stadt verlieren, Karten abwerfen, verdrängte Wächter) brauchen saubere Wartephasen. Muster gibt es mit `discard` schon.
- Spieldauer: deutlich länger. Für Remote-Teams ist Speichern/Fortsetzen hier besonders wichtig.
- Viel UI-Fläche nötig: Hand, Ausbau, Leiste, Würfel. Mobile wird schwierig.

#### Kompatibilität

- **5–6 Spieler:** größere Karte, mehr Figuren und Karten, Sonderbauphase erlaubt auch Wächter und Ausbau (Einzelheiten prüfen).
- **Seewege:** offiziell kombinierbar.
- **Fernhandel:** einzelne Szenarien mit Anpassungen (z. B. Kamelzüge mit anderen Abstimmungsrohstoffen).
- **Würfelstapel:** möglich, wenn die Karte den farbigen Würfel ausweist.
- **Milder Räuber:** sinnvoll erst nach dem ersten Angriff.

---

### 2.4 Fernhandel (FH)

Referenz (nur zur Orientierung): „Händler & Barbaren“.

Eine Sammlung voneinander unabhängiger Szenarien für 3–4 Spieler. Die enthaltenen kleinen Varianten stehen in 2.1. Jedes Szenario ist ein eigenes Modul.

#### Fischgründe

> **Umgesetzt am 22.10.2026** als Variante `fischgruende` (Lobby-Schalter, auf allen Karten): See statt der Wüste des Räubers (Fische bei 2, 3, 11, 12), Räuber beginnt neben dem Brett (`robber = -1`), 6 Fischgründe an der Küste (8 auf großen Karten), Fischplättchen 1–3 als Zählwerk mit Rostigem Anker, Ausgeben mit `spendFish` nur im eigenen Zug nach dem Würfeln (kleinste passende Summe, kein Wechselgeld), Anker mit `passAnchor` an Gleichstarke oder Stärkere. Fischwerte liegen wie alles andere offen im Spielstand, angezeigt wird bei Mitspielern nur die Anzahl. Grafiken (See, Fischgrund, Plättchen, Anker) sind SVG-Platzhalter.

**Regel:** An der Küste liegen sechs Fischgründe mit Zahl, dazu ein See auf einem Binnenfeld (statt Wüste). Wer daran baut, zieht bei einem Treffer verdeckte Fischplättchen (Wert 1–3). Fische ausgeben: 2 = Räuber zurück in die Wüste, 3 = einen Rohstoff bei einem Mitspieler ziehen, 4 = Rohstoff aus der Bank, 5 = kostenlose Straße, 7 = kostenlose Entwicklungskarte. Unter den Plättchen ist ein **Rostiger Anker**: wer ihn hat, braucht einen Punkt mehr zum Sieg und darf ihn an jemanden weitergeben, der gleich viele oder mehr Punkte hat.

**Engine:** Fischgründe als Objekte auf Küstenkanten mit Zahl (`ext.fishingGrounds`), See als Feldart `'lake'`. Fischstapel als Zählwerk. Neue Aktionen `spendFish { effect }`, `passAnchor`. Hook `production`, Hook `victoryTarget` für den Anker.

**UI:** Fisch als eigene Kartengruppe in der Hand (Summe sichtbar), Ausgeben über ein kleines Menü mit den fünf Effekten. Fischgründe als halbrunde Plättchen mit Zahl an der Küste.

**Netzwerk:** Fischwerte auf der Hand sind geheim (nur Anzahl öffentlich). Gering spielentscheidend.

**Grafik:** Fischgrund-Plättchen, See-Feld, Fischplättchen (1, 2, 3), Rostiger Anker.

**Aufwand:** M. **Kompatibel** mit Grundspiel, 5–6 (eigene Ergänzung, prüfen), Seewege.

#### Flussläufe

> **Umgesetzt am 22.10.2026** als Variante `flusslaeufe` (nur auf Karten ohne Meerfelder). Eigene Umsetzung: Zwei Flüsse laufen von einer Quelle im Inland über die Felder zur Küste (`board.rivers`), gezeichnet als Linien über den Feldern, also ohne Feldgrafiken je Flussrichtung. Auf den Kanten, die ein Fluss quert, gibt es keine Straße, nur eine Brücke (2 Lehm, 1 Holz, 3 je Spieler); Brücken liegen in `roads` und zählen für die längste Straße. Münzen: Straße oder Siedlung am Fluss 1, Brücke 3; 2 Münzen sind ein Rohstoff aus der Bank. Die meisten Münzen geben +1 Punkt, die wenigsten −2, bei Gleichstand für alle Gleichen; haben alle gleich viele, gilt beides nicht. Grafiken für Brücke, Münze und Abzeichen: `output/designs/fernhandel-2026-10-22/grafik-auftrag.md`.

**Regel:** Zwei Flüsse ersetzen einige Felder. Wer an einem Fluss eine Straße oder Siedlung baut, bekommt eine Münze. Brücken über den Fluss kosten 2 Lehm + 1 Holz und bringen 3 Münzen. Wer die meisten Münzen hat, bekommt +1 Punkt, wer die wenigsten hat, −2 Punkte (bei Gleichstand gelten die Regeln des Originals, prüfen). 2 Münzen tauschen gegen 1 Rohstoff.

**Engine:** Flussfelder in der Kartendefinition (Felder mit Flusskanten), `edge.kind: 'bridge'`, `ext.coins: number[]`, Aktion `buildBridge`, Hooks `onBuild` und `victoryPoints`. Setzt Karten als Daten voraus.

**UI:** Münzzähler in Hand und Spielerkarte, Brücke als Bauoption, „Reichster/Ärmster“ als Abzeichen.

**Grafik:** Flussfelder (mehrere Varianten je nach Flussrichtung, das ist der aufwendige Teil), Brücke je Farbe, Münz-Icon.

**Aufwand:** M (L wegen der Flussgrafiken). **Kompatibel** mit Grundspiel, nicht sinnvoll mit Seewege-Karten.

#### Kamelzüge

**Regel:** In der Mitte liegt eine Oase. Von dort führen drei Kamelrouten. Nach jedem Siedlungs- oder Stadtbau stimmen alle ab, wo das nächste Kamel hinkommt; jede Stimme kostet 1 Getreide oder 1 Wolle. Gebäude an einer Kamelroute sind +1 Punkt wert, Straßen mit Kamel zählen doppelt für die längste Route.

**Engine:** `ext.camels: number[]` (Kanten), Abstimmungsphase `camelVote { bids: Record<seat, number> }`, gleichzeitige verdeckte Gebote. Hooks `victoryPoints`, `longestRoad` (Kantengewicht).

**UI:** Abstimmungsdialog im Dock, Kamele als Figuren auf Kanten.

**Netzwerk:** Gebote sind bis zur Auflösung geheim. Heute würde jeder sehen, wer was geboten hat. Mit Maßnahme B lösbar, sonst offen abstimmen (Hausregel).

**Grafik:** Oase-Feld, Kamelfigur, Banner.

**Aufwand:** M–L. **Kompatibel** mit Grundspiel, Seewege, Stadtwacht (andere Rohstoffe).

#### Küstenüberfall

**Regel:** Nach jedem Siedlungs- oder Stadtbau landen drei Plünderer auf zufälligen Küstenfeldern. Ein Feld mit drei Plünderern ist besetzt und liefert nichts. Spieler stellen Ritterfiguren auf Kanten (Kosten prüfen), ziehen sie 3 Kanten weit (für 1 Getreide 5) und vertreiben Plünderer, wenn sie um ein Feld in der Überzahl sind. Je zwei gefangene Plünderer sind 1 Punkt.

**Engine:** `ext.raidersOnHex: number[]`, Ritter auf Kanten (`EdgePiece.kind: 'knight'`), Kampfauflösung, Bewegung über Kanten mit Kosten. Ersetzt den Räuber teilweise.

**UI:** Plünderer-Figuren auf Feldern, Ritter auf Kanten, Bewegungsmodus mit Reichweite.

**Grafik:** Plünderer-Figur (neutral), Ritterfigur für Kanten je Farbe (kann aus der vorhandenen `knight-<farbe>` abgeleitet werden), Burg-Feld in der Mitte.

**Aufwand:** L. **Kompatibel** nur mit Grundspiel (prüfen).

#### Warenzüge

**Regel (Hauptszenario):** Drei Handelsstätten an der Küste (Burg, Steinbruch, Glashütte, eigene Namen festlegen). Jeder Spieler hat einen Wagen, der Waren zwischen ihnen transportiert. Bewegung kostet Punkte: eigene Straße 1, fremde Straße 1 plus Gebühr an den Besitzer, Gelände ohne Straße 2, Fluss ohne Brücke 3, Plünderer auf dem Weg +2. Für 1 Getreide gibt es 2 Bewegungspunkte mehr. Jede Lieferung bringt 1 Punkt und Münzen. Wagen lassen sich aufwerten (mehr Bewegung, letzte Stufe +1 Punkt). Drei Plünderer blockieren Wege und werden mit der 7 versetzt.

**Engine:** Wagen als Figur auf Ecken mit Ladung, Wegsuche mit Kosten (Dijkstra über Ecken), Aufträge als Kartenzählwerk, Münzen, Flüsse und Brücken aus Flussläufe. Größtes Szenario der Schachtel.

**UI:** Wagenfigur mit Ladungsanzeige, Bewegungsmodus mit erreichbaren Ecken (Kostenzahl an jeder Ecke), Auftragskarten.

**Grafik:** drei Sonderfelder, Wagen je Farbe in drei Stufen, Warenplättchen (vier Sorten), Plünderer.

**Aufwand:** L–XL. **Kompatibel** nur mit Grundspiel.

#### Gesamturteil Fernhandel

Die Schachtel ist ein Baukasten. Fischgründe und Flussläufe sind gute Zwischenschritte nach Seewege, weil sie Küstenobjekte, Sonderfelder und Kartendaten nutzen. Küstenüberfall und Warenzüge sind teuer für ihren Spielwert in Remote-Runden und kommen zuletzt.

---

### 2.5 Ferne Küsten (FK)

Referenz (nur zur Orientierung): „Entdecker & Piraten“.

#### Regeln in Kürze

- **Wachsende Karte:** Man startet auf einer Heimatinsel, der Rest liegt verdeckt. Je Szenario sind 30–80 Felder im Spiel.
- **Zugablauf in drei Abschnitten:** Ertrag, Handeln und Bauen, Bewegen.
- **Schiffe als Fahrzeuge:** Schiffe fahren auf Kanten (wie Straßen) mit 4 Bewegungspunkten pro Zug, für 1 Wolle gibt es 2 mehr. Ein Schiff trägt einen großen Gegenstand (Siedlertrupp) oder zwei kleine (Matrosen, Fisch, Gewürz). Laden und Entladen kostet nichts. Begrenzte Anzahl Schiffe je Spieler (prüfen).
- **Entdecken:** Endet ein Schiff neben einem verdeckten Feld, wird es aufgedeckt (Land bekommt eine Zahl). Ein Siedlertrupp an Bord darf dort eine Siedlung gründen.
- **Hafenorte statt Städte:** Eine Küstensiedlung wird zum Hafenort ausgebaut (2 Punkte). Nur dort entstehen Schiffe und Siedlertrupps. Keine Städte, keine Häfen im klassischen Sinn: Bank tauscht 3:1, Gold 2:1.
- **Gold:** Wer bei einem Wurf (außer 7) nichts bekommt, erhält 1 Gold. Gold zahlt Abgaben an Kaperschiffe und lässt sich tauschen.
- **Kaperschiff statt Räuber:** Bei einer 7 wird es versetzt und der Werfende zieht bei einem angrenzenden Spieler. Wer neben dem Kaperschiff fährt, zahlt Abgabe. Vertreiben per Würfel.
- **Aufträge** (je Szenario), Fortschritt auf Leisten mit Punkten:
  - **Schlupfwinkel:** drei Matrosen auf einen Schlupfwinkel bringen, um ihn auszuheben. Beteiligte bekommen Gold und Fortschritt.
  - **Fischzug:** Fisch an Fischgründen aufnehmen und zum Inselrat bringen.
  - **Gewürzroute:** mit Matrosen Gewürz in Dörfern holen und zum Inselrat bringen. Dörfer verleihen Dauerfähigkeiten (+1 Bewegung, besser vertreiben, Gold gegen Rohstoff).
- **Szenarien (eigene Namen):** Land voraus (8 Punkte), Schlupfwinkel (12), Fischzug (15), Gewürzroute (15), Große Fahrt (alles, 17). Punktwerte prüfen.

#### Engine

- **Nutzt Seewege-Topologie** und Nebel-Mechanik. Ohne Abschnitt 3.3 nicht machbar.
- **Neuer Zugabschnitt** `move` nach `main`: `Phase` (`types.ts:58-68`) bekommt `{ kind: 'move' }`, `endTurn` (`rules.ts:402-418`) geht erst von `main` nach `move`.
- **Fahrzeuge:** `ext.vessels: { id; owner; edge; cargo: CargoItem[]; movesLeft }[]`. Bewegung schrittweise (eine Aktion pro Kante) oder als Pfad (eine Aktion mit Kantenliste, Engine prüft). Pfad ist netzwerkfreundlicher, schrittweise einfacher in der UI. Empfehlung: Pfad.
- **Figuren an Land:** Siedlertrupp, Matrosen als Fracht oder auf Feldern/Ecken.
- **Hafenorte:** `VertexPiece.kind: 'harborTown'`, keine Städte.
- **Kein** Räuber, keine längste Route, keine Rittermacht, keine Entwicklungskarten (alles über Modul abschaltbar).
- **Aufträge** als eigene Untermodule mit eigenen Leisten in `ext.missions`.
- **Würfelaktionen** (Vertreiben, Fischfang) sind Zufall auf dem Host, der Ausgang steht im Log.

#### Brett und UI

- Karte wächst: Ausschnitt und Zoom müssen mitwachsen. Der Kartenrahmen sollte von Anfang an das ganze Szenario umfassen (verdeckte Felder als Nebel), damit das Brett nicht springt.
- Bewegungsmodus: Schiff anklicken, erreichbare Kanten mit Restpunkten markieren, Ziel anklicken. Fracht als kleine Symbole auf dem Schiff, Laden/Entladen über Mini-Menü am Schiff.
- Neuer Hauptknopf-Ablauf: Würfeln → Weiter zum Bewegen → Zug beenden. Der Hauptknopf ist schon zentral (`primary`, `game.ts:227-247`), er braucht nur den neuen Zustand.
- Auftragsleisten in der Seitenleiste über dem Verlauf oder als dritter Tab „Aufträge“.
- Inselrat als Sonderfeld.

#### Netzwerk und verdeckte Informationen

- Verdeckte Felder, ihre Zahlen und die Lage von Schlupfwinkeln, Fischgründen und Dörfern sind Geheimnisse. Mit Ziehen-beim-Aufdecken (Abschnitt 4) bleibt nichts Geheimes im Spielstand.
- Spielstand bis ca. 80 Felder, weiterhin klein.

#### Neue Grafiken (Papiercollage)

Großes Schiff mit Ladefläche je Farbe, Siedlertrupp, Matrose, Hafenort je Farbe, Kaperschiff (aus Seewege), Schlupfwinkel-Feld, Fischgrund-Feld, Dorf-Feld mit Gewürz, Inselrat-Feld, Gold-Icon, Fisch- und Gewürzplättchen, drei Auftragsleisten, Nebel-Feld (aus Seewege), Banner „Land entdeckt“, „Schlupfwinkel ausgehoben“.

#### Aufwand

**XL.** Begründung: eigenes Spielsystem mit Bewegung, Fracht, wachsender Karte und drei Auftragsmodulen. Wenig Wiederverwendung vom Grundspiel außer Ertrag und Handel.

#### Risiken

- Rundenlänge: Bewegungen mehrerer Schiffe ziehen Züge in die Länge. Für Remote-Runden muss die Bedienung sehr flüssig sein.
- Regelunsicherheit: Hier waren unsere Quellen am widersprüchlichsten (Schiffsanzahl, Kosten). Gründliche Prüfung vor dem Start.
- Hoher Grafikbedarf.

#### Kompatibilität

- **5–6 Spieler:** eigene Ergänzung mit größerer Karte (Einzelheiten prüfen).
- Nicht mit Stadtwacht oder Fernhandel kombinierbar. Kleine Varianten: Würfelstapel ja, Milder Räuber sinngemäß für das Kaperschiff, Hafenvogt nein.

---

### 2.6 Glossar der eigenen Begriffe

| Neuland-Begriff | Bedeutung | gehört zu |
|---|---|---|
| Seewege | Seefahrt-Erweiterung | SW |
| Kaperschiff | zweiter Räuber auf dem Meer | SW, FK |
| Goldgrund | Feld mit Rohstoff nach Wahl | SW |
| Nebel | verdecktes Feld | SW, FK |
| Inselbonus | Sonderpunkte für neue Insel | SW |
| Stadtwacht | Städte-Erweiterung | ST |
| Schriften, Stoff, Silber | Güter aus Wald, Weide, Gebirge | ST |
| Markt, Rat, Gelehrte | die drei Ausbaurichtungen | ST |
| Prachtstadt | Stadt mit +2 Punkten durch Ausbau | ST |
| Einflusskarten | Karten der drei Ausbaurichtungen | ST |
| Wächter | Figuren auf Ecken, drei Stufen | ST |
| Plündererflotte | Angreifer auf der Leiste | ST |
| Ehrenschild | Punktkarte für beste Verteidigung | ST |
| Palisade | Stadtbefestigung, +2 Handlimit | ST |
| Fernhandel | Szenario-Sammlung | FH |
| Rostiger Anker | Malus-Plättchen in Fischgründe | FH |
| Würfelstapel | Karten statt Würfel | KV |
| Milder Räuber | Räuber schont Zurückliegende | KV |
| Hafenvogt | Sonderkarte für Hafenpunkte | KV |
| Duell für zwei | Zwei-Spieler-Variante | KV |
| Ferne Küsten | Erkundungs-Erweiterung | FK |
| Siedlertrupp, Matrosen, Hafenort, Inselrat, Schlupfwinkel | Spielteile | FK |

---

## 3. Querschnitt: Engine erweiterbar machen

Ziel: Jede Erweiterung lebt in einem eigenen Ordner, das Grundspiel bleibt lesbar, Kombinationen ergeben sich aus der Konfiguration. `rules.ts` (heute 737 Zeilen, ein großes `HANDLERS`-Objekt in `rules.ts:116-419`) darf nicht mit `if (settings.citiesAndKnights)` durchsetzt werden.

### 3.1 Spieleinstellungen

Heute: `GameSettings` hat nur `victoryPoints` (`types.ts:87-89`), Vorgabe in `room.service.ts:197-205`, Lobby-Auswahl in `src/app/ui/lobby/lobby.ts:77-96` und `:227-228`. Die Brettgröße folgt allein aus der Spielerzahl (`rules.ts:46`).

Vorschlag:

```ts
export interface GameSettings {
  victoryPoints: number;          // Vorgabe kommt aus Szenario + Modulen, Host darf ändern
  scenario: ScenarioId;           // 'klassisch' | 'sw.ersteUeberfahrt' | 'fh.fischgruende' …
  modules: ModuleId[];            // z. B. ['milderRaeuber', 'hafenvogt', 'wuerfelstapel']
  options?: Record<string, number | boolean | string>; // z. B. Inselbonus 1 oder 2
}
```

- Ein **Szenario** legt Karte, Pflichtmodule, Spielerzahlen und Siegziel fest. „klassisch“ wählt wie heute je nach Spielerzahl die Karte für 3–4 oder 5–6.
- **Module** sind frei zuschaltbar, soweit verträglich. Jedes Modul nennt `requires`, `conflicts`, `players`.
- Die Lobby zeigt Szenario-Auswahl plus Schalter für verträgliche Module. Unverträgliche Kombinationen sind ausgegraut mit Begründung (Leitlinie 4: „Was nicht geht, sagt warum“).
- Alte Spielstände ohne `scenario` werden beim Laden zu `{ scenario: 'klassisch', modules: [] }`.

### 3.2 Regelmodule mit Hooks

```ts
export interface RuleModule {
  id: ModuleId;
  requires?: ModuleId[];
  conflicts?: ModuleId[];
  players?: [min: number, max: number];

  /** Eigener Zustandsteil unter state.ext[id]. */
  setup?(s: GameState, ctx: SetupContext): void;
  /** Neue Aktionen, z. B. buildShip. Gleiche Signatur wie die heutigen Handler. */
  actions?: Partial<Record<string, Handler>>;
  /** Neue Phasen mit eigener Wer-ist-dran-Logik (actingSeats). */
  phases?: Record<string, PhaseSpec>;

  hooks?: {
    rollSource?(s: GameState): DiceResult;                       // Würfelstapel, Stadtwacht
    afterRoll?(s: GameState, dice: DiceResult): void;           // Flotte, Einflusskarten
    production?(s: GameState, hex: number, piece: VertexPiece, base: CardCounts): CardCounts;
    afterProduction?(s: GameState, gained: CardCounts[]): void; // Gelehrte, Gold bei Nullertrag
    buildOptions?(s: GameState, seat: number): BuildOption[];   // Bauraster und Sonderbauphase
    robberTargets?(s: GameState, seat: number, hexes: number[]): number[];
    tradeRate?(s: GameState, seat: number, card: Card, rate: number): number;
    onBuild?(s: GameState, seat: number, piece: PieceRef): void; // Hafenvogt, Inselbonus, Münzen
    victoryPoints?(s: GameState, seat: number, vp: number, hidden: boolean): number;
    victoryTarget?(s: GameState, seat: number, target: number): number; // Rostiger Anker
    routeWeight?(s: GameState, edge: number): number;            // Kamele
    beforeEndTurn?(s: GameState): Phase | null;                 // Ferne Küsten: Bewegen
    redact?(s: GameState, viewer: number): void;                 // verdeckte Infos (Abschnitt 4)
  };
}
```

Umsetzung in Schritten, damit jederzeit alle 102 Tests grün bleiben:

1. **Grundspiel als Modul `basis`.** Die heutigen Handler aus `rules.ts:116-419` wandern unverändert in `engine/modules/basis/`. `applyAction` (`rules.ts:102-112`) sucht den Handler zuerst bei den aktiven Modulen, dann bei `basis`. Fester Punkt bleibt `structuredClone`, Versionszähler und `checkWinner`.
2. **Hook-Aufrufe** an den Stellen einbauen, an denen das Grundspiel heute feste Annahmen trifft:

| Annahme heute | Stelle | Hook |
|---|---|---|
| zwei W6 | `rules.ts:167` | `rollSource` |
| 7 = Abwerfen + Räuber | `rules.ts:171-184` | `afterRoll`, Räuber-Modul |
| Gelände = Rohstoff, Siedlung 1/Stadt 2 | `rules.ts:620-628` | `production` |
| Startrohstoffe nur ohne Wüste | `rules.ts:127-134` | `production` (Aufstellung) |
| Räuber darf überall hin | `rules.ts:211`, `game.ts:165-167` | `robberTargets` |
| Tauschkurs 4/3/2 | `rules.ts:505-514` | `tradeRate` |
| Siegpunkte fest | `rules.ts:440-450` | `victoryPoints` |
| Siegziel fest | `rules.ts:689` | `victoryTarget` |
| vier Bauoptionen | `rules.ts:525-531`, `game.ts:124-152` | `buildOptions` |
| Teilelimits | `types.ts:167`, `rules.ts:516-522` | aus Szenario + Modulen |
| Entwicklungsstapel nach Layout | `rules.ts:30-33` | Modul `entwicklung` (abschaltbar) |
| Sonderbauphase ab 5 Spielern | `rules.ts:411` | Szenario-Option |
| längste Route nur Straßen | `rules.ts:714-737` | `routeWeight`, Kanten-Arten |

3. **Zustand je Modul unter `state.ext`.** Gemeinsame Felder bleiben oben (`players`, `bank`, `phase`). Alles Erweiterungsspezifische liegt in `ext[moduleId]` mit eigenem Typ. So bleiben Spielstände des Grundspiels unverändert und Module stören sich nicht.
4. **Phasen öffnen.** `Phase` (`types.ts:58-68`) bekommt eine generische Variante `{ kind: 'module'; module: ModuleId; step: string; data: unknown }` oder Module erweitern die Union per Typ-Zusammenführung. `actingSeats` (`rules.ts:424-438`) fragt bei Modulphasen das Modul. Bewährtes Muster für „alle gleichzeitig“ ist `discard` (`pending` je Sitz).
5. **UI-Seite spiegeln.** Statustext (`game.ts:187-219`), Hauptknopf (`game.ts:227-247`), Zielauswahl (`game.ts:156-178`) und Ereignis-Erkennung (`game.ts:465-505`) bekommen ebenfalls eine Registrierung je Modul in `ui/modules/<id>/`. Sonst wächst `game.ts` (733 Zeilen) genauso wie `rules.ts`.

### 3.3 Karten und Szenarien als Daten

Heute ist das Brett Code: Reihenlängen, Gelände- und Zahlenmengen, Häfen (`board.ts:5-23`), Topologie aus Reihen (`board.ts:103-121`), ein einziger Küstenring (`board.ts:144-158`), Cache nach Layout (`board.ts:62-72`), Räuber in der ersten Wüste (`board.ts:180`).

Vorschlag:

```ts
export interface MapDef {
  id: string;                       // 'klassisch-4', 'klassisch-6', 'sw.ersteUeberfahrt-4' …
  players: number[];
  hexes: {
    q: number; r: number;           // axiale Koordinaten
    terrain: Terrain | 'pool' | 'fog'; // 'pool' = aus dem Vorrat ziehen
    number?: number | 'pool';
    tag?: string;                   // 'heimat', 'oase', 'fischgrund' …
  }[];
  terrainPool?: Partial<Record<Terrain, number>>;
  numberPool?: number[];
  harbors: { edge: [q: number, r: number, side: 0|1|2|3|4|5]; type: HarborType | 'pool' }[] | 'coast-even';
  harborPool?: HarborType[];
  bankSize: number;
  victoryPoints: number;
  robber?: 'desert' | { q: number; r: number } | null;
  pirate?: { q: number; r: number };
  constraints?: { redApart?: boolean; sameNumberApart?: boolean };
}
```

- `getTopology(mapId)` baut Ecken und Kanten aus der Feldliste. Der Algorithmus in `buildTopology` (`board.ts:74-142`) lässt sich fast übernehmen: statt Reihen eine Schleife über `hexes`, Pixelposition aus `q, r`. Meerfelder bekommen ebenfalls Ecken und Kanten.
- `coast` wird zur Menge aller Kanten zwischen Land und Meer bzw. Land und Rand, nicht mehr ein geordneter Ring. Für „Häfen gleichmäßig verteilen“ beim klassischen Brett bleibt der Ring als Sonderfall erhalten (`'coast-even'`), damit sich bestehende Bretter nicht ändern.
- Klassische Bretter werden die ersten zwei `MapDef`s. Ein Test stellt sicher, dass `klassisch-4` und `klassisch-6` exakt dieselben Ecken- und Kanten-IDs wie heute erzeugen. Dann bleiben alte Spielstände gültig (`roads[edge]` und `buildings[vertex]` hängen an diesen IDs).
- `BoardState.layout` (`types.ts:22-26`) wird zu `mapId`, mit Lese-Übersetzung `'base' → 'klassisch-4'`, `'ext' → 'klassisch-6'`.
- Szenario = `MapDef` + Pflichtmodule + Optionen. Ablage als TypeScript-Daten in `engine/scenarios/`, mit Validator (alle Felder erreichbar, Hafenkanten an Land, Zahlenmengen passen).
- Brett-UI: `topo` (`board.ts:93`) und `PIECE_SCALE` (`board.ts:13`) lesen aus der Karte. Ozeanfläche als Rechteck statt Küstenpolygon (`board.ts:132-153`).

### 3.4 Spielteile verallgemeinern

| Heute | Vorschlag |
|---|---|
| `buildings: (Building \| null)[]` mit `'settlement' \| 'city'` (`types.ts:28-31`, `:104`) | `vertices: (VertexPiece \| null)[]` mit `kind` aus Modulen (Siedlung, Stadt, Prachtstadt, Hafenort, Wächter, Wagen) |
| `roads: (number \| null)[]` (`types.ts:105`) | `edges: (EdgePiece \| null)[]` mit `kind` (Straße, Schiff, Brücke, Kantenritter) und `builtTurn` |
| `robber: number` (`types.ts:106`) | `blockers: { kind: 'robber' \| 'pirate' \| …; hex: number }[]` |
| `Resource`, `ResourceCounts` (`types.ts:1-5`) | `Card` und `CardCounts`, Kartenarten aus den Modulen |
| `Transfer.card: Resource \| 'dev'` (`types.ts:81`) | `Card \| 'dev' \| 'progress' \| 'fish' …` |
| `COSTS` fest (`types.ts:160-165`) | Kosten je Bauoption aus `buildOptions` |

Wichtig: Die Umbenennung `buildings` → `vertices` und `roads` → `edges` betrifft auch UI (`board.ts:208-232`) und viele Tests. Sie lohnt sich nur zusammen mit Seewege bzw. Stadtwacht. Bis dahin können Module ihre Teile unter `ext` halten.

### 3.5 Spielstand- und Protokoll-Versionierung

Heute:
- Gespeicherte Spiele haben kein Formatfeld (`room.service.ts:465-481`).
- `room`-Nachrichten tragen den Spielstand ohne Formatangabe (`protocol.ts:21-28`).
- Ein neuer Host kann eine ältere App-Version haben und dann einen Spielstand mit unbekannten Modulen verwalten.

Vorschlag:
- `GameState.schema: number` und eine Funktion `migrate(state)` in der Engine, die alte Stände Schritt für Schritt hebt. Aufruf in `loadSaved` (`room.service.ts:474-481`) und in `onRoom` (`room.service.ts:317-341`).
- `hello` bekommt `app: { proto: number; modules: ModuleId[] }`. Der Host zeigt in der Lobby, wer eine alte Version hat („Bitte Seite neu laden“), und erlaubt nur Module, die alle kennen.
- Host-Wahl (`electHost`, `room.service.ts:256-280`) bevorzugt Clients, die alle aktiven Module kennen. Kann niemand übernehmen, pausiert das Spiel mit Hinweis.
- `compareRoom` (`protocol.ts:46-55`) bleibt, bekommt aber `schema` als ersten Schlüssel nach „laufendes Spiel“, damit ein neueres Format nie von einem älteren überschrieben wird.

### 3.6 Tests

- `rules.spec.ts` (1330 Zeilen) bleibt der Regressionstest für das Grundspiel. Er muss nach jedem Umbauschritt unverändert grün sein.
- Je Modul eine eigene Spec-Datei mit Testkarten (kleine `MapDef`s mit 3–7 Feldern), damit Szenarien ohne Zufall prüfbar sind.
- Ein Kombinationstest spielt für jede erlaubte Modul-Kombination ein Zufallsspiel mit Bots bis zum Ende (die Bots aus den bisherigen Durchspieltests wiederverwenden). Findet Abstürze und Endlosphasen.

### 3.7 Aufwand Fundament

**M–L.** Einstellungen, Modul-Registrierung, Hooks im Grundspiel, Versionierung: M. Karten als Daten mit identischen IDs für die klassischen Bretter und neuer Ozean im Brett: zusätzlich M. Beides zusammen etwa 3–4 Wochen, verteilt auf die ersten Meilensteine.

---

## 4. Verdeckte Informationen

### Ausgangslage

Der Host schickt nach jeder Aktion den vollständigen `GameState` an alle (`broadcast`, `room.service.ts:429-434`, und `sendRoom`, `:436-439`). Damit hat jeder im Browser:

- alle Handkarten und Entwicklungskarten aller Spieler,
- den Entwicklungsstapel in fester Reihenfolge (`devDeck`, `types.ts:103`): die nächste gekaufte Karte ist bekannt,
- den Zufallszustand (`rng`, `types.ts:98`): Wer die Engine nachrechnet, kennt den nächsten Wurf und die Karte, die der Räuber ziehen wird,
- bei Räuber-Transfers die eigentlich verdeckte Karte (`Transfer.hidden`, `types.ts:83-84`, wird nur in der Oberfläche versteckt, `fly-layer.ts:66-67`).

KONZEPT.md nimmt das bewusst in Kauf. Für das Grundspiel ist das vertretbar. Mehrere Erweiterungen hängen aber stärker an Geheimnissen:

| Geheimnis | Erweiterung | Bedeutung |
|---|---|---|
| Verdeckte Felder (Nebel) | SW, FK | hoch: ganzer Reiz des Entdeckens |
| Einflusskarten auf der Hand, Stapelreihenfolge | ST | hoch: viele Angriffskarten |
| Fischwerte auf der Hand | FH | niedrig |
| Verdeckte Gebote | FH Kamelzüge | mittel |
| Würfelstapel-Reihenfolge | KV | hoch: sonst sind alle Würfe bekannt |
| Lage von Schlupfwinkeln, Dörfern | FK | hoch |

### Maßnahme A: Nichts Geheimes im Spielstand ablegen (empfohlen, sofort)

Viele Geheimnisse verschwinden, wenn wir sie erst im Moment des Gebrauchs auswürfeln:

- **Stapel als Zählwerk:** Statt einer gemischten Liste speichern wir `Record<Karte, Anzahl>`. Gezogen wird beim Ziehen mit Zufall. Das gilt für Entwicklungskarten, Einflusskarten, Würfelstapel, Fischplättchen, Nebelfelder und deren Zahlen.
- **Zufall für Clients unvorhersagbar machen:** Der Host mischt vor jeder Aktion frische Zufallsbits aus `crypto.getRandomValues` in `state.rng`, bevor er `applyAction` aufruft (in `applyFrom`, `room.service.ts:343-354`). Die Engine bleibt rein und mit festem Seed testbar. Ein neuer Host macht einfach mit eigenem Zufall weiter. Der Host-Wechsel braucht keine deterministische Fortsetzung.
- **Gezogene Karte bei Räuber-Transfers** im versendeten Stand weglassen (siehe Maßnahme B, minimal: `card: 'hidden'` für alle außer Geber und Nehmer).

Vorteile: kleiner Eingriff (S), deckt Nebel, Stapel und Würfel vollständig ab, Host-Wechsel bleibt unverändert.
Nachteile: Handkarten bleiben sichtbar. Der Host selbst kann weiterhin alles sehen und beeinflussen (für ein Kollegenspiel akzeptiert).

### Maßnahme B: Schwärzen pro Empfänger

> **Umgesetzt am 22.10.2026** (`src/app/engine/secrets.ts`, `room.service.ts`). Der Host hält den vollen Stand und schickt jedem Spieler mit `viewFor` seine Sicht: fremde Rohstoffe, Entwicklungskarten und Fischwerte nur als Anzahl (`PlayerState.hidden`), der Entwicklungsstapel nur als Größe (`hiddenDeck`), der Fischstapel gar nicht, bei Räuber-Transfers die Karte nur für Geber und Nehmer; am Spielende sieht jeder alles. Der Host speichert den vollen Stand, alle anderen ihre Sicht. Neu im Stand: Anfangsvorrat je Rohstoff (`supply`) und die ausgespielten Entwicklungskarten (`playedDev`). Hat ein neuer Host nur eine Sicht (Host-Wechsel, Fortsetzen aus dem Speicher, neuerer Stand per `offer`), fragt er mit `secretRequest` die eigenen Karten aller ab und wartet bis zu 1,5 s; solange ruhen Senden und Züge, die Züge werden danach angewendet. `rebuild` übernimmt eine gemeldete Hand nur, wenn die Anzahlen stimmen und die Karten noch zu haben sind (Vorrang: Meldungen zum aktuellen Stand). Wer fehlt, bekommt aus dem Rest passend neu ausgeteilt, das steht im Verlauf. Tests: Sicht, Wiederaufbau, Erhaltung aller Karten (auch in den Chaos-Läufen), kein fremdes Blatt im Netz.

Der Host hält den vollen Stand, schickt aber jedem eine eigene Sicht: `viewFor(state, seat)` ersetzt fremde Handkarten durch Anzahlen, fremde Einflusskarten durch Rückseiten, geheime Gebote durch „hat geboten“. Jedes Modul liefert seinen Teil über den Hook `redact`.

Folgen:
- `broadcast` wird zu einer Schleife über die Verbindungen mit je eigener Nachricht. Bei höchstens 6 Spielern und wenigen KB unproblematisch. Zuschauer bekommen die Sicht ohne Geheimnisse.
- Die Oberfläche muss mit unbekannten Werten umgehen. Heute rechnet sie mit fremden Ressourcen (z. B. Karten zählen, `game.ts:257`, Siegpunkte mit verdeckten Punktkarten, `game.ts:256`). Besser: `PlayerState` trennt öffentliche Felder (`cardCount`, `devCount`) von privaten.
- Client-Vorprüfungen mit der Engine (welche Knöpfe erlaubt sind) funktionieren weiter, weil jeder seine eigenen Karten kennt.
- **Host-Wechsel:** Der neue Host hat nur seine Sicht. Lösung „Wiederaufbau“:
  1. Öffentliches bleibt (Brett, Punkte, Anzahlen, Stapelgrößen und -zusammensetzung).
  2. Jeder Client schickt dem neuen Host seinen privaten Teil (neue Nachricht `secret`).
  3. Der Host prüft gegen die öffentlichen Zahlen (Kartenanzahl je Spieler, Gesamtzahl je Kartenart ≤ Vorrat) und ergänzt Stapel aus „Gesamt minus Bekanntes“.
  4. Wer nicht verbunden ist, bekommt seine Hand beim Wiedereinstieg zurück, wenn sein Browser sie gespeichert hat. Sonst würfelt der Host eine Hand passender Größe aus dem Restvorrat aus und schreibt das ins Log.
- **Spielstand sichern:** Jeder Browser speichert nur seine Sicht. Wird ein Spiel aus dem Speicher fortgesetzt, gilt derselbe Wiederaufbau.

Vorteile: Entwicklertools zeigen keine fremden Hände mehr. Keine Infrastruktur nötig.
Nachteile: M–L Aufwand, mehr Sonderfälle beim Host-Wechsel. Ein Spieler kann beim Wiederaufbau über seine eigene Hand lügen, solange Anzahl und Gesamtmengen passen. Der Host sieht weiterhin alles.

### Maßnahme C: Kryptografische Verfahren

Gemischte Stapel mit verschlüsselten Karten, die nur gemeinsam aufgedeckt werden können („mentales Kartenspiel“). Ohne vertrauenswürdige Spielleitung sicher, aber sehr aufwendig, langsam bei jedem Zug und schwer mit Wiedereinstieg zu verbinden. **Nicht empfohlen.**

### Maßnahme D: Eigener Server als Spielleitung

Ein kleiner Relay-Dienst (z. B. Durable Objects) hält die Geheimnisse. Löst alles, widerspricht aber der Entscheidung „kein eigener Server“. Nur falls das Projekt ohnehin einen Relay bekommt (KONZEPT.md nennt ihn als Rückfall).

### Empfehlung

1. **Maßnahme A sofort**, unabhängig von Erweiterungen. Sie schließt auch für das Grundspiel die größten Lücken (Würfelvorhersage, Stapel).
2. **Maßnahme B vor Stadtwacht**, weil dort Kartenhände spielentscheidend sind. Für Seewege und Ferne Küsten reicht A.
3. C und D nicht weiter verfolgen, solange es ein Spiel unter Kollegen bleibt.

---

## 5. Reihenfolge der Umsetzung

| # | Paket | Inhalt | Aufwand | Warum jetzt |
|---|---|---|---|---|
| 1 | **Fundament I** | `GameSettings.scenario/modules`, Modul-Registrierung mit Hooks, `schema` + `migrate`, Versionsfeld im `hello`, Lobby-Schalter, Maßnahme A | M | Alles weitere baut darauf auf. Maßnahme A verbessert sofort das Grundspiel. |
| 2 | **Kleine Varianten** | Milder Räuber, Hafenvogt, Würfelstapel | S + S + S–M | Schnelle Gewinne, beweisen die Hooks an echten Regeln. |
| 3 | **Fundament II** | Karten als Daten, axiale Topologie, neuer Ozean im Brett, Kartenvalidator | M | Voraussetzung für alle Szenarien mit Meer, Flüssen, Sonderfeldern. |
| 4 | **Seewege I** | Erste Überfahrt, Inselquartett, 3–4 Spieler: Schiffe, Kaperschiff, Goldgrund, Inselbonus, Route mit Schiffen | L | Beliebteste Erweiterung, nutzt das Fundament voll. |
| 5 | **Seewege II** | Im Dunst (Nebel), Freie Karte, 5–6-Karten | M | Nebel mit Maßnahme A ohne Netzwerkumbau. |
| 6 | **Fernhandel I** | Fischgründe, Flussläufe, Duell für zwei | M + M + M | Nutzt Sonderfelder und Kantenarten aus 3–5. Duell lohnt sich für kleine Teams. |
| 7 | **Verdeckte Infos** | Maßnahme B mit Wiederaufbau beim Host-Wechsel (umgesetzt) | M–L | Pflicht vor Stadtwacht. |
| 8 | **Stadtwacht** | komplett inkl. 5–6 | XL | Größter Spielwert nach Seewege, aber auch größter Brocken. In Teilschritte zerlegen (Güter + Ausbau → Flotte + Wächter → Einflusskarten). |
| 9 | **Fernhandel II** | Kamelzüge, Küstenüberfall, Warenzüge | M–L je | Nischig, nach Bedarf. |
| 10 | **Ferne Küsten** | Land voraus, dann Aufträge | XL | Eigenes System, profitiert von allem davor. |

Nach jedem Paket: Grundspiel-Tests grün, ein Durchspieltest mit Bots über das Netzwerk, kurzer Abschnitt in KONZEPT.md „Stand der Umsetzung“.

### Erster Meilenstein (M1)

**„Hausregeln an, Grundspiel unverändert.“** Umfang:

- `GameSettings` mit `scenario: 'klassisch'` und `modules`, Migration alter Spielstände und gespeicherter Räume.
- Modul-Registrierung und die Hooks `robberTargets`, `onBuild`, `victoryPoints`, `victoryTarget`.
- Module **Milder Räuber** und **Hafenvogt** mit Tests und Lobby-Schaltern (nur der Host kann sie ändern, wie heute die Siegpunkte).
- Abzeichen und Banner für den Hafenvogt.
- Maßnahme A: Host mischt frischen Zufall vor jeder Aktion. Entwicklungsstapel als Zählwerk mit Migration.
- `hello` mit Protokollversion, Hinweis bei veralteten Clients.

Abnahme: Alle bisherigen Tests unverändert grün. Ein 3er- und ein 6er-Spiel mit beiden Modulen per Bot durchgespielt. Ein gespeichertes Spiel aus der alten Version lässt sich fortsetzen.

Aufwand M1: ca. 1–1,5 Wochen. Danach ist klar, ob die Hook-Struktur trägt, bevor wir das teure Fundament II angehen.

---

## 6. Grafiken: Arbeitsauftrag für den Bild-Agenten

**Liefernachtrag 23.10.2026:** Stadtwacht III und alle optionalen Motive sind fertig: 25 Einflusskarten-Motive, drei Rückseiten, Händler in zehn Farben, vier Wächter-Aktionssymbole, Fisch- und Kaperschiff-Banner sowie Vorder- und Rückseite des Würfelstapels. Originale und Web-Fassungen liegen in den beauftragten Verzeichnissen. [Lieferübersicht und Vorschau](../output/designs/stadtwacht-2026-10-23/LIEFERUNG.md). Eingebunden am 23.10.2026 bis auf Fisch- und Kaperschiff-Banner und die Vorderseite des Würfelstapels, die erst mit passenden Anzeigen gebraucht werden. Flussläufe, Stadtwacht I/II und die übrigen Bedienelemente wurden bereits am 22.10.2026 geliefert und sind inzwischen eingebunden: [vorherige Lieferung](../output/designs/stadtwacht-2026-10-22/LIEFERUNG.md).

Für alle neuen Motive gilt, was [GRAFIKEN.md](GRAFIKEN.md) festlegt: Papiercollage-Stil, Licht von oben links, Gelände als spitze Sechsecke mit freier Mitte, Figuren als transparente PNGs mit Grundbild + Maske für die acht Spielerfarben (`scripts/build-piece-assets.py`), Karten textfrei im Design „Symbolstark“, Web-Fassungen über `node scripts/optimize-images.mjs`. Prompts und Vorschauen kommen wie bisher nach `output/designs/<thema>-<datum>/`.

Ergänzende Regeln:
- In Prompts nur die Neuland-Begriffe aus dem Glossar verwenden, keine Originalnamen und keine Beschreibung des Original-Artworks.
- Neue Figuren müssen neben den vorhandenen auf allen Geländen lesbar bleiben (dunkler Rand wie Variante E1).
- Pro Erweiterung zuerst eine Übersichtsseite zur Stilprüfung, dann Einzeldateien.

Bedarf nach Paket (Details in den Abschnitten 2.x):

| Paket | Gelände | Figuren | Karten/Icons | Banner |
|---|---|---|---|---|
| Kleine Varianten | – | graue Figuren (Duell) | Würfelstapel-Rückseite und -Vorderseite, Ereignismotive, Hafenvogt-Abzeichen, Handelsmarke | Hafenvogt |
| Seewege | Goldgrund, Nebel, ggf. Meerfeld | Schiff ×8, Kaperschiff | Inselbonus | Insel, Kaperschiff |
| Fernhandel I | See, Fischgrund-Plättchen, Flussfelder (mehrere Richtungen) | Brücke ×8 | Fischplättchen 1–3, Rostiger Anker, Münze | – |
| Stadtwacht | – | Wächter 3 Stufen ×8, Prachtstadt ×8, Palisade, Händler ×8, Flotte | 3 Güterkarten, 3 Güter-Icons, 3 Einfluss-Rückseiten, ca. 20 Motive, Ereigniswürfel-Symbole, Ehrenschild | Angriff, Stadt gefallen, Prachtstadt |
| Fernhandel II | Oase, Burg/Sonderstätten | Kamel, Kantenritter ×8, Plünderer, Wagen 3 Stufen ×8 | Waren (4), Aufträge | – |
| Ferne Küsten | Schlupfwinkel, Fischgrund-Feld, Dorf, Inselrat | großes Schiff ×8, Siedlertrupp ×8, Matrose ×8, Hafenort ×8 | Gold, Fisch, Gewürz, Auftragsleisten | Land entdeckt, Schlupfwinkel |

Stand 23.10.2026: Alle in den drei konkreten Grafikaufträgen genannten Motive einschließlich der optionalen sind geliefert. Seewege, Fischgründe, Duell, Hafenvogt, Flussläufe, Stadtwacht I–III und alle Bedienelemente sind eingebunden; Fisch- und Kaperschiff-Banner und die Vorderseite des Würfelstapels liegen bereit, bis es passende Anzeigen gibt. Neu hinzugekommen und noch offen sind die Lobby-Variantensymbole: `output/designs/oberflaeche-2026-10-22/grafik-auftrag.md`. Dateinamen, Formate und Einbindung: Seewege (mit Nebel und Inselbonus) in `output/designs/seewege-2026-10-22/grafik-auftrag.md`, Fischgründe, Duell, Flussläufe, Hafenvogt und Würfelstapel in `output/designs/fernhandel-2026-10-22/grafik-auftrag.md`, Stadtwacht I–III in `output/designs/stadtwacht-2026-10-22/grafik-auftrag.md`.

---

## 7. Offene Fragen an den Eigentümer

1. **Auslegung:** Passt die Auswahl (vier große Erweiterungen plus kleine Varianten)? Sollen Szenario-Sammlungen, Jubiläums- oder Sonderbretter dazu?
2. **Priorität:** Ist Seewege als erste große Erweiterung richtig, oder ist Stadtwacht im Team gefragter?
3. **Schummelschutz:** Reicht Maßnahme A (keine vorhersagbaren Würfel und Stapel) für das Grundspiel und Seewege? Ist Maßnahme B vor Stadtwacht gewünscht, oder bleibt „unter Kollegen ist das egal“?
4. **Hausregeln:** Welche Varianten spielt das Team tatsächlich (Milder Räuber, Hafenvogt, Würfelstapel, Duell)? Gibt es eigene Hausregeln, die wir als Modul aufnehmen sollten?
5. **Zwei Spieler:** Soll das Duell für zwei das heutige 2-Spieler-Spiel ersetzen oder als Option daneben stehen?
6. **Szenarien:** Nur die Standardkarten je Erweiterung oder auch frei erzeugte Karten („Freie Karte“)? Brauchen wir einen Karteneditor?
7. **Begriffe:** Sind die Arbeitstitel und das Glossar in Ordnung, oder sollen wir mit jemandem mit Markenrechts-Kenntnis über die Namen schauen, bevor die Grafiken entstehen?
8. **Spieldauer:** Stadtwacht und Ferne Küsten dauern lange. Brauchen wir dafür Hilfen wie Zugzeit-Erinnerungen oder ein „Spiel pausieren“?
9. **Mobile:** Sollen die großen Erweiterungen auf dem Handy voll spielbar sein, oder reicht dort Zuschauen und einfache Züge?
10. **Mehrere Versionen im Raum:** Ist es in Ordnung, dass Spieler mit veralteter Seite erst neu laden müssen, bevor ein Spiel mit Erweiterung startet?
11. **Regelprüfung:** Wer prüft die mit „(prüfen)“ markierten Zahlen gegen die Originalregel, bevor ein Paket startet? Liegen die Original-Regelhefte vor?
12. **KONZEPT.md:** Dürfen wir den Abschnitt „Später denkbar“ auf die Arbeitstitel umstellen und auf dieses Dokument verweisen?
