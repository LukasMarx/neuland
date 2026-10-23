# Auftrag: Grafiken für Seewege

## Stand (22.10.2026)

**Geliefert und eingebunden:** Goldfeld, Nebelfeld, Schiff in allen Farben (Draufsicht, auch in den beiden Grautönen), Kaperschiff, Banner-Motive Schiff und Insel, Inselbonus-Symbol. Lieferung siehe `README.md` in diesem Ordner.

**Nachgeliefert und eingebunden:** Symbole für die Knöpfe „Versetzen“ und „Handeln“ im Bauraster.

**Optionales Motiv geliefert am 23.10.2026:** Kaperschiff-Banner inklusive Web-Fassung. [Lieferung und Vorschau](../stadtwacht-2026-10-23/LIEFERUNG.md); liegt bereit, bis es ein Banner „Kaperschiff versetzt“ gibt (noch nicht eingebunden).

## Worum es geht

Neuland hat jetzt die Erweiterung **Seewege**: Karten mit Meerfeldern und Inseln, Schiffe auf den Kanten, ein Kaperschiff auf dem Meer und Goldfelder, die einen Rohstoff nach Wahl liefern. Im Spiel stehen dafür im Moment einfache SVG-Platzhalter. Gebraucht werden Grafiken im bestehenden **Papiercollage-Stil**.

Stilreferenzen:

- **Gelände:** `public/tiles/papiercollage/*.png` und `output/designs/hex-2026-10-21/`
- **Figuren:** `public/pieces/papiercollage/*.png` und `output/designs/pieces-2026-10-21/`. Dort liegen Grundbild, Maske, Prompts und Farbpipeline.
- **Banner-Motive:** `public/banner/papiercollage/*.png` und `output/designs/banner-2026-10-21/einzelteile-auftrag.md`

## Benötigte Dateien

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/tiles/papiercollage/gold.png` | **Goldfeld:** Flussbett mit Goldkörnern und Nuggets zwischen Steinen, goldgelbe und warme Brauntöne, ein Bach aus hellblauen Papierschichten | wie die übrigen Gelände (1254 × 1254, transparent, Sechseck mit Spitze oben) | Mitte (ca. 35 % der Breite) für den Zahlenchip frei halten, kein Rand, Licht von oben links |
| `output/designs/pieces-2026-10-21/sources/ship-base.png` | **Schiff:** kleines Segelschiff, Rumpf und Segel aus Papier, steile Draufsicht wie die übrigen Figuren, liegt quer | 512 × 256 oder 512 × 128 wie die Straße, transparent | Der **Rumpf** muss einfärbbar sein, wie die Terrakottaflächen bei Straße und Stadt. Segel cremeweiß, nicht eingefärbt. |
| `public/pieces/papiercollage/pirate.png` | **Kaperschiff:** dunkles Schiff mit schwarzen oder anthrazitfarbenen Segeln, ein kleiner heller Totenkopf-freier Wimpel (kein Totenkopf, freundlich-bedrohlich) | 512 × 512, transparent | Eine Datei, nicht eingefärbt |
| `public/banner/papiercollage/ship.png` | **Banner-Motiv Schiff:** Segelschiff, Seitenansicht | 1024 × 1024, transparent, Motiv ca. 85 % | wie die übrigen Banner-Motive |
| `public/banner/papiercollage/island.png` | **Banner-Motiv Insel:** kleine Insel mit Palme oder Baum und einem Fähnchen | 1024 × 1024, transparent | für „Neue Insel“ |
| `public/tiles/papiercollage/fog.png` | **Nebelfeld:** Nebelschwaden aus weißem Seidenpapier über dunklem Wasser | wie Gelände | Für das Szenario „Im Dunst“, das schon spielbar ist. Ohne Zahl, klar unterscheidbar von Meer und von allen Landfeldern. Beim Aufdecken dreht sich das Feld wie eine Karte um, es darf also wie eine Kartenrückseite wirken. |
| `public/icons/seewege/island-bonus.png` | **Inselbonus:** kleine Insel mit Fähnchen | 256 × 256, transparent | Für die Punkteübersicht der Spieler, etwa 24 Pixel. Darf dasselbe Motiv sein wie das Banner „Insel“, nur vereinfacht. |

Optional, erst nötig, wenn es dafür ein Banner gibt:

| Datei | Motiv | Hinweise |
|---|---|---|
| `public/banner/papiercollage/pirate.png` | **Banner-Motiv Kaperschiff**, 1024 × 1024, transparent | für ein späteres Banner „Kaperschiff versetzt“; darf die Datei `pieces/papiercollage/pirate.png` als Vorlage nehmen |

### Bedienelemente

**Geliefert und eingebunden am 22.10.2026:** `move-ship.png` und `trade.png`, jeweils Original und Web-Fassung. [Vorschau](nachtrag-vorschau.html).

Die Knöpfe im Bauraster zeigen Straße, Siedlung, Stadt, Schiff als Figuren und die Entwicklungskarte als Kartenrückseite. Zwei Knöpfe haben noch ein Textzeichen:

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/ui/move-ship.png` | **Schiff versetzen:** kleines Schiff mit geschwungenem Pfeil | 256 × 256, transparent | Knopf „Versetzen“ (Seewege), etwa 28 Pixel; neutral, nicht eingefärbt |
| `public/icons/ui/trade.png` | **Handeln:** zwei Hände tauschen Karten, oder zwei Karten mit Pfeilen | 256 × 256, transparent | Knopf „Handeln“ (Grundspiel), etwa 28 Pixel |

## Technische Vorgaben

- Echte Transparenz, keine eingezeichneten Schachbrettmuster.
- Keine Schrift, Zahlen, Rahmen oder Schatten außerhalb des Motivs.
- Muss klein lesbar sein. Schiffe erscheinen auf dem Brett mit etwa 30 bis 40 Pixeln Länge, das Kaperschiff mit etwa 50.

## Farbvarianten des Schiffs

Das Schiff läuft durch dieselbe Pipeline wie Straße und Stadt (`scripts/build-piece-assets.py`):

1. In `PIECES` den Eintrag `"ship": "Schiff"` ergänzen. Das Format wie bei `road` behandeln, also flach (`size = (512, 128)`), oder eigens 512 × 256.
2. Ausführen: `python scripts/build-piece-assets.py`. Das legt `masks/ship.png` an; die Maske so nacharbeiten, dass nur der Rumpf eingefärbt wird.
3. Ergebnis: `public/pieces/papiercollage/ship-<farbe>.png` für alle acht Farben.

## Einbindung (macht danach der Code-Agent)

- **Bedienelemente:** in `src/app/ui/game/game.html` die Zeichen ⤳ (Versetzen) und ⇄ (Handeln) im Bauraster durch die Bilder ersetzen.

- **Goldfeld:** `gold` in `src/app/ui/board/tile-art.ts` eintragen und mit `node scripts/optimize-images.mjs` die Web-Fassung erzeugen. Der SVG-Platzhalter `#t-gold` bleibt als Rückfall.
- **Schiff und Kaperschiff:** In `src/app/ui/board/board.html` die `<use href="#ship">` bzw. `#pirate` durch `<image>` mit `pieceImage('ship', farbe)` bzw. der Kaperschiff-Datei ersetzen. Danach noch der Bauknopf in `game.html`.
- **Banner:** Die Motive `ship` und `island` kommen in `src/app/ui/game/event-banner.ts`, Fall `island`.
- **Nebelfeld:** `fog` in `src/app/ui/board/tile-art.ts` eintragen, Web-Fassung erzeugen. Der SVG-Platzhalter `#t-fog` bleibt als Rückfall.
- **Inselbonus:** Symbol in der Punkteübersicht (`src/app/ui/game/game.html`, Zeile „Inselbonus“).

## Abnahme

- [ ] Hintergrund wirklich transparent, auch in Lücken des Motivs
- [ ] Goldfeld passt neben die übrigen Gelände, Mitte frei
- [ ] Schiff in Blau und Weiß gut lesbar, Segel bleiben hell
- [ ] Kaperschiff hebt sich auf dem Wasser deutlich ab
- [ ] Bei 40 Pixeln noch als Schiff erkennbar
- [ ] Nebelfeld neben Meer und Land eindeutig als verdeckt erkennbar

Die verwendeten Prompts bitte in `output/designs/seewege-2026-10-22/prompts.json` ablegen.
