# Auftrag: Grafiken für Stadtwacht

## Stand (22.10.2026)

**Geliefert und eingebunden (22.10.2026):** Stadtwacht I und II und das Symbol „Ausbau“: Güterkarten und -symbole, Richtungssymbole (Ausbau-Tafel und Abzeichen der Prachtstadt), Prachtstadt, Palisade, Wächter in drei Stufen, Flotte, Ereigniswürfel, Ehrenschild, Banner „Angriff“. Übersicht und Dateizuordnung: [LIEFERUNG.md](LIEFERUNG.md).

**Nachtrag 23.10.2026:** Auch Stadtwacht III, der Händler in zehn Spielerfarben und alle vier optionalen Wächter-Aktionssymbole sind als Originale und Web-Fassungen fertig. [Neue Lieferung und Vorschau](../stadtwacht-2026-10-23/LIEFERUNG.md).

**Einbindung noch offen:** Stadtwacht III und die Wächter-Aktionssymbole sind geliefert; im Spiel stehen dafür weiterhin Platzhalter: Einflusskarten als farbige Karten mit Namen ohne Motiv, der Händler als Marke mit „H“.

## Worum es geht

Neuland hat die Erweiterung **Stadtwacht** (in der Lobby „Stadtwacht“). Sie besteht aus drei Teilen. Erstens:

- **Güter:** Städte auf Wald, Weide und Gebirge liefern neben dem Rohstoff ein Gut: **Schriften** (Wald), **Stoff** (Weide) und **Silber** (Gebirge). Güter liegen auf der Hand wie Rohstoffe.
- **Stadtausbau:** drei Richtungen mit je fünf Stufen: **Markt** (zahlt mit Stoff), **Rat** (Silber), **Gelehrte** (Schriften). Wer zuerst Stufe 4 erreicht, macht eine Stadt zur **Prachtstadt**.
- **Palisade:** ein Ring unter einer Stadt, erhöht das Handkartenlimit.

Zweitens:

- **Ereigniswürfel:** ein dritter Würfel mit drei Schiffsseiten und drei Toren (gelb, blau, grün).
- **Plündererflotte:** rückt bei jedem Schiff auf einer Leiste mit 7 Feldern vor und greift dann an.
- **Wächter:** Figuren auf Ecken in drei Stufen (einfach, erfahren, mächtig), einsatzbereit oder ruhend.
- **Ehrenschild:** 1 Siegpunkt für den stärksten Verteidiger.

Drittens:

- **Einflusskarten:** drei Stapel in den Farben der Ausbaurichtungen (gelb, blau, grün) mit je 18 Karten, 25 verschiedene Karten. Gezogen wird, wenn der Ereigniswürfel ein Tor zeigt.
- **Händler:** eine Figur, die über eine Einflusskarte auf ein Feld kommt und ihrem Besitzer einen besseren Tausch bringt.

Im Spiel stehen dafür Platzhalter: Güterkarten und -symbole als schlichte SVGs (`src/app/ui/shared/goods-art.ts`), die Prachtstadt als farbiges Abzeichen mit Anfangsbuchstaben, die Palisade als gestrichelter Ring. Gebraucht werden Grafiken im bestehenden **Papiercollage-Stil**. Regeln: `docs/ERWEITUNGEN.md`, Abschnitt 2.3.

Stilreferenzen:

- **Karten:** `public/cards/symbolstark/*.png` (Rohstoffkarten, textfrei)
- **Symbole:** `public/icons/resources/*.png`
- **Figuren:** `public/pieces/papiercollage-organic-v2/*.png` (Dorf und Stadt) und `output/designs/organic-pieces-2026-10-22/`

In Prompts nur die Neuland-Begriffe verwenden (Schriften, Stoff, Silber, Markt, Rat, Gelehrte, Prachtstadt, Palisade), keine Originalnamen und keine Beschreibung des Original-Artworks.

## Benötigte Dateien

### Güter

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/cards/symbolstark/paper.png` | **Schriften:** Schriftrolle und gebundenes Buch auf Pergament | wie die Rohstoffkarten | textfrei, Grundton warmes Pergament |
| `public/cards/symbolstark/cloth.png` | **Stoff:** Stoffballen in Rot mit Webmuster | wie die Rohstoffkarten | textfrei, Grundton Rot |
| `public/cards/symbolstark/silver.png` | **Silber:** Silbermünzen und ein kleiner Barren | wie die Rohstoffkarten | textfrei, Grundton kühles Grau; Dateiname im Spiel `coin` (siehe Einbindung) |
| `public/icons/resources/paper.png`, `cloth.png`, `coin.png` | dieselben Motive als freigestellte Symbole | wie die Rohstoffsymbole | für Hand, Baukosten, Bank und Ausbau-Tafel, etwa 20 bis 28 Pixel |

### Stadtausbau und Prachtstadt

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/city/market.png`, `council.png`, `scholars.png` | **Richtungen:** Marktstand (gelb), Ratshaus mit Glocke (blau), Studierstube mit Fernrohr (grün) | 256 × 256, transparent | Kopf der drei Spalten in der Ausbau-Tafel und Abzeichen auf der Prachtstadt, muss bei 18 Pixeln erkennbar sein |
| `output/designs/organic-pieces-2026-10-22/sources/metropolis.png` | **Prachtstadt:** größere Stadt mit Turm und Fahnen | wie `city.png` (Grundbild + Maske) | Dächer und Fahnen einfärbbar wie bei der Stadt; erkennbar größer als die Stadt |

### Palisade

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/pieces/papiercollage/wall.png` | **Palisade:** Ring aus angespitzten Holzpfählen, von schräg oben | 512 × 512, transparent, Mitte frei | liegt unter der Stadtfigur, die Mitte bleibt für die Stadt frei; neutral, nicht eingefärbt |

### Stadtwacht II

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `output/designs/pieces-2026-10-21/sources/guard1.png`, `guard2.png`, `guard3.png` | **Wächter** in drei Stufen: Wachmann mit Speer, mit Schild und Helm, mit Rüstung und Banner | wie die übrigen Figuren (Grundbild + Maske) | Umhang und Wimpel einfärbbar; die Stufe muss auch bei 24 Pixeln an der Silhouette erkennbar sein. Ruhende Wächter dimmt das Spiel per Filter. |
| `public/pieces/papiercollage/raiders.png` | **Plündererflotte:** Langschiff mit dunklen Segeln | 512 × 256, transparent | für die Leiste neben der Bank und das Banner, nicht eingefärbt |
| `public/icons/city/event-ship.png`, `event-market.png`, `event-council.png`, `event-scholars.png` | **Ereigniswürfel:** Schiff und drei Tore in Gelb, Blau, Grün | 256 × 256, transparent | als Würfelseite, etwa 28 Pixel |
| `public/icons/city/honor.png` | **Ehrenschild:** kleiner Schild mit Lorbeer | 256 × 256, transparent | Punkteübersicht und Spielerleiste |
| `public/banner/papiercollage/raiders.png` | **Banner-Motiv Angriff:** Langschiff vor einer Stadtmauer | 1024 × 1024, transparent, Motiv ca. 85 % | für „Flotte abgewehrt“ und „Die Flotte plündert“; heute ersatzweise Schild und Schwerter |

### Stadtwacht III: Einflusskarten

Die Karten tragen ihren Namen und Text als echten Text im Spiel. Gebraucht werden Rückseiten und Motive ohne Schrift. Motive dürfen schlicht sein; sie sitzen im oberen Teil einer kleinen Karte (78 × 108 Pixel in der Hand, größer im Dialog).

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/cards/progress/back-market.png`, `back-council.png`, `back-scholars.png` | **Rückseiten** in Gelb, Blau, Grün mit dem Richtungssymbol (Marktstand, Ratshaus, Studierstube) | wie die Rohstoffkarten | für die Stapel neben der Bank und die Hände der Mitspieler |
| `public/cards/progress/bulkBuy.png` | **Großeinkauf:** Händler mit vollen Säcken auf einem Karren | 512 × 384, transparent oder Pergamentgrund | Gelb |
| `public/cards/progress/guildRight.png` | **Zunftrecht:** gesiegelte Urkunde mit Zunftzeichen | wie oben | Gelb |
| `public/cards/progress/tradingPost.png` | **Frachtkontor:** Lagerhaus am Kai mit Kränen und Kisten | wie oben | Gelb |
| `public/cards/progress/charter.png` | **Stadtrecht:** Pergament mit großem Siegel und Stadtwappen | wie oben | Blau, Punktkarte |
| `public/cards/progress/alarmBell.png` | **Alarmglocke:** Glocke im Turm, Wächter laufen herbei | wie oben | Blau |
| `public/cards/progress/agitator.png` | **Unruhestifter:** Redner auf einer Kiste vor aufgebrachter Menge | wie oben | Blau |
| `public/cards/progress/banquet.png` | **Festbankett:** gedeckte Tafel mit Pokalen | wie oben | Blau |
| `public/cards/progress/taxCollector.png` | **Steuereintreiber:** Mann mit Geldbeutel und Schreibbrett | wie oben | Blau |
| `public/cards/progress/pulley.png` | **Flaschenzug:** Seilrollen heben einen Steinblock | wie oben | Grün |
| `public/cards/progress/pileDriver.png` | **Pfahlramme:** Holzgerüst rammt Pfähle ein | wie oben | Grün |
| `public/cards/progress/waterwheel.png` | **Wasserrad:** Mühlrad am Bach, Getreidefeld dahinter | wie oben | Grün |
| `public/cards/progress/gallery.png` | **Stollen:** Mineneingang mit Lore voller Erz | wie oben | Grün |
| `public/cards/progress/lodge.png` | **Bauhütte:** Steinmetze an einem halbfertigen Stadttor | wie oben | Grün |
| `public/cards/progress/observatory.png` | **Sternwarte:** Kuppel mit Fernrohr unter Sternen | wie oben | Grün, Punktkarte |
| `public/cards/progress/surveyor.png` | **Landvermesser:** Mann mit Messlatte an einem abgesteckten Weg | wie oben | Grün |
| `public/cards/progress/armory.png` | **Waffenkammer:** Wand mit Speeren, Schilden, Helmen | wie oben | Grün |

| `public/cards/progress/peddler.png` | **Wanderhändler:** Händler mit Rückentrage und Wanderstab | wie oben | Gelb |
| `public/cards/progress/bond.png` | **Schuldschein:** Hand reicht ein gesiegeltes Papier über einen Tisch mit Münzen | wie oben | Gelb |
| `public/cards/progress/fair.png` | **Jahrmarkt:** bunte Marktstände mit Wimpeln | wie oben | Gelb |
| `public/cards/progress/turncoat.png` | **Überläufer:** Wachmann wechselt den Wappenrock | wie oben | Blau |
| `public/cards/progress/envoy.png` | **Gesandter:** Reiter mit Schriftrolle und Banner | wie oben | Blau |
| `public/cards/progress/intrigue.png` | **Ränkespiel:** zwei Gestalten flüstern hinter einem Vorhang | wie oben | Blau |
| `public/cards/progress/scout.png` | **Kundschafter:** Gestalt mit Kapuze und Fernglas hinter einem Busch | wie oben | Blau |
| `public/cards/progress/fortune.png` | **Losbuch:** aufgeschlagenes Buch mit Sternzeichen und zwei Würfeln | wie oben | Grün |
| `public/cards/progress/landReform.png` | **Flurbereinigung:** Landkarte mit Messkette und zwei vertauschten Zahlenscheiben | wie oben | Grün |
| `public/pieces/papiercollage/trader.png` | **Händlerfigur:** kleiner Händler mit Waagschale | 256 × 256, transparent, wie die Figuren (Grundbild + Maske) | auf einem Feld neben der Zahl, Mantel einfärbbar; heute eine Marke mit „H“ |

### Bedienelemente

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/city/improve.png` | **Stadtausbau:** Stadt mit kleinem Baugerüst oder drei gestaffelten Türmen in Gelb, Blau, Grün | 256 × 256, transparent | Knopf „Ausbau“ im Bauraster, etwa 28 Pixel; heute ein Dreieck ▲ |
| optional `public/icons/city/guard-activate.png`, `guard-upgrade.png`, `guard-move.png`, `guard-chase.png` | **Wächter-Aktionen:** Fackel (bereit machen), Stern oder Pfeil nach oben (aufwerten), Fußspuren (ziehen), verjagter Räuberhut (Räuber vertreiben) | 256 × 256, transparent | für den Wächter-Dialog, etwa 22 Pixel; heute nur Text |

## Technische Vorgaben

- Echte Transparenz, keine eingezeichneten Schachbrettmuster.
- Keine Schrift, Zahlen, Rahmen oder Schatten außerhalb des Motivs.

## Einbindung (macht danach der Code-Agent)

- **Güterkarten und -symbole:** in `src/app/ui/shared/goods-art.ts` die Platzhalter durch die Web-Fassungen ersetzen (`node scripts/optimize-images.mjs`). Achtung: Silber heißt im Code `coin`.
- **Richtungssymbole:** Kopf der Spalten in `src/app/ui/game/city-panel.ts`, Abzeichen `.metro` in `src/app/ui/board/board.html`.
- **Prachtstadt:** über die Pipeline in `scripts/build-organic-piece-assets.py` in allen Farben, dann `pieceImage('metropolis', …)` für Ecken mit Prachtstadt.
- **Palisade:** in `board.html` den Ring `.wall` durch das Bild ersetzen.
- **Wächter:** in `board.html` die Marke `.guard` durch `pieceImage('guard' + Stufe, Farbe)` ersetzen (neue `PieceKind`), den Bauknopf „Wächter“ in `game.html` ebenso.
- **Flotte, Ereigniswürfel, Ehrenschild:** `.raiders` und `.event-die` in `game.html`, Banner-Fall `raid` in `event-banner.ts`.
- **Bedienelemente:** Knopf „Ausbau“ in `game.html` (heute ▲), Wächter-Dialog `@case ('guard')`.
- **Einflusskarten:** in `game.html` die Karten `.pcard` (Hand), `.pstack` (Stapel neben der Bank) und der Dialog `@case ('progress')`; Motive über eine Tabelle je `ProgressCard` wie `CARD_ART`.
- **Händlerfigur:** in `board.html` die Marke `.trader` (und die Vorschau in `.hex-target`) durch `pieceImage('trader', Farbe)` ersetzen.

## Abnahme

- [ ] Hintergrund wirklich transparent, auch in Lücken des Motivs
- [ ] Die drei Güterkarten passen neben die Rohstoffkarten und sind untereinander klar verschieden
- [ ] Symbole bei 20 Pixeln erkennbar
- [ ] Prachtstadt klar größer als die Stadt, Farben lesbar
- [ ] Palisade lässt die Stadtfigur frei

Die verwendeten Prompts bitte in `output/designs/stadtwacht-2026-10-22/prompts.json` ablegen.
