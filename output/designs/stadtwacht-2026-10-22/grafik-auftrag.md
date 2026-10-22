# Auftrag: Grafiken für Stadtwacht I und II

## Stand (22.10.2026)

**Alles offen.** Dieser Auftrag ist neuer als die letzte Lieferung. Im Spiel stehen Platzhalter: Güterkarten und -symbole als schlichte SVGs, Prachtstadt als Abzeichen, Palisade als Ring, Wächter als runde Marken, Flotte und Ereigniswürfel als einfache Formen. Stadtwacht III (Einflusskarten) bekommt einen eigenen Abschnitt, sobald die Kartenliste steht.

## Worum es geht

Neuland bekommt die Erweiterung **Stadtwacht** in drei Schritten. Der erste Schritt ist spielbar (in der Lobby „Stadtwacht (in Arbeit)“):

- **Güter:** Städte auf Wald, Weide und Gebirge liefern neben dem Rohstoff ein Gut: **Schriften** (Wald), **Stoff** (Weide) und **Silber** (Gebirge). Güter liegen auf der Hand wie Rohstoffe.
- **Stadtausbau:** drei Richtungen mit je fünf Stufen: **Markt** (zahlt mit Stoff), **Rat** (Silber), **Gelehrte** (Schriften). Wer zuerst Stufe 4 erreicht, macht eine Stadt zur **Prachtstadt**.
- **Palisade:** ein Ring unter einer Stadt, erhöht das Handkartenlimit.

Der zweite Schritt ist ebenfalls spielbar:

- **Ereigniswürfel:** ein dritter Würfel mit drei Schiffsseiten und drei Toren (gelb, blau, grün).
- **Plündererflotte:** rückt bei jedem Schiff auf einer Leiste mit 7 Feldern vor und greift dann an.
- **Wächter:** Figuren auf Ecken in drei Stufen (einfach, erfahren, mächtig), einsatzbereit oder ruhend.
- **Ehrenschild:** 1 Siegpunkt für den stärksten Verteidiger.

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

## Abnahme

- [ ] Hintergrund wirklich transparent, auch in Lücken des Motivs
- [ ] Die drei Güterkarten passen neben die Rohstoffkarten und sind untereinander klar verschieden
- [ ] Symbole bei 20 Pixeln erkennbar
- [ ] Prachtstadt klar größer als die Stadt, Farben lesbar
- [ ] Palisade lässt die Stadtfigur frei

Die verwendeten Prompts bitte in `output/designs/stadtwacht-2026-10-22/prompts.json` ablegen.
