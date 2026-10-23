# Auftrag: Grafiken für Fernhandel I und kleine Varianten

## Stand (22.10.2026)

**Geliefert und eingebunden:** See, Fischgrund, Fischplättchen 1–3, Rostiger Anker (Symbol und Banner), Handelsmarke, graue Figuren der Neutralen, Hafenvogt-Abzeichen, Banner-Motiv Leuchtturm. Lieferung siehe `README.md` in diesem Ordner.

**Nachgeliefert und eingebunden (Flussläufe):** Brücke in allen Spielerfarben (Brett und Bauknopf), Münze (Hand und Lobby), Abzeichen „meiste“ und „wenigste Münzen“ (Spielerleiste).

**Optionale Motive geliefert am 23.10.2026:** Banner-Motiv Fisch sowie Würfelstapel Vorder- und Rückseite, jeweils mit Web-Fassungen. [Lieferung und Vorschau](../stadtwacht-2026-10-23/LIEFERUNG.md). Eingebunden ist die Rückseite des Würfelstapels (neben den Würfeln, mit der Zahl der übrigen Karten). Fisch-Banner und Vorderseite liegen bereit, bis es ein Banner für einen großen Fang bzw. eine Kartenanzeige statt der Würfel gibt.

## Worum es geht

Neuland hat drei neue Varianten aus „Fernhandel I“, alle in der Lobby zuschaltbar:

- **Fischgründe:** Ein See ersetzt die Wüste. An der Küste liegen Fischgründe mit Zahl. Wer daran baut, fängt Fischplättchen im Wert 1 bis 3. Unter den Plättchen ist ein **Rostiger Anker**; wer ihn hat, braucht einen Punkt mehr zum Sieg.
- **Duell:** Für zwei Spieler. Zwei neutrale Mitspieler in Grau bauen mit. **Handelsmarken** erzwingen einen Tausch oder schicken den Räuber in die Wüste.
- **Flussläufe:** Zwei Flüsse laufen über das Brett zur Küste. Über den Fluss führen nur **Brücken**. Bauen am Fluss bringt **Münzen**; die meisten Münzen geben einen Punkt, die wenigsten kosten zwei.

Dazu kommen Nachträge für zwei kleine Varianten, die schon länger spielbar sind:

- **Hafenvogt:** Wer zuerst 3 Hafenpunkte hat (Siedlung am Hafen 1, Stadt 2), bekommt 2 Siegpunkte; wer mehr hat, übernimmt.
- **Würfelstapel:** 36 Karten statt Würfeln, genau mit der Verteilung zweier Würfel.

Im Spiel stehen dafür im Moment einfache SVG-Platzhalter oder nur Text. Gebraucht werden Grafiken im bestehenden **Papiercollage-Stil**. Die Regeln stehen in `docs/ERWEITUNGEN.md`, Abschnitte 2.1 (Duell) und 2.4 (Fischgründe, Flussläufe).

Stilreferenzen:

- **Gelände:** `public/tiles/papiercollage/*.png` und `output/designs/hex-2026-10-21/`
- **Figuren:** `public/pieces/papiercollage/*.png`, `public/pieces/papiercollage-organic-v2/*.png` und `output/designs/pieces-2026-10-21/`. Dort liegen Grundbild, Maske, Prompts und Farbpipeline.
- **Kleine Symbole:** `public/icons/resources/*.png` (Rohstoffsymbole in Hand und Häfen)
- **Banner-Motive:** `public/banner/papiercollage/*.png` und `output/designs/banner-2026-10-21/einzelteile-auftrag.md`

In Prompts nur die Neuland-Begriffe verwenden (See, Fischgrund, Rostiger Anker, Handelsmarke, Neutrale, Brücke, Münze), keine Originalnamen und keine Beschreibung des Original-Artworks.

## Benötigte Dateien

**Liefernachtrag 22.10.2026:** Auch Brücke (acht Farben und zwei Grautöne), Münze und Geldbeutel liegen jetzt inklusive Web-Fassungen vor und sind eingebunden. [Vorschau](nachtrag-vorschau.html), [Lieferdetails](../stadtwacht-2026-10-22/LIEFERUNG.md).

### Fischgründe

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/tiles/papiercollage/lake.png` | **See:** ruhiges Gewässer aus blauen Papierschichten, Schilf und Steine am Ufer, ringsum ein schmaler grüner Uferstreifen | wie die übrigen Gelände (1254 × 1254, transparent, Sechseck mit Spitze oben) | Das Feld trägt keinen Zahlenchip, aber unten mittig ein schmales Schild „2 3 11 12“; das untere Drittel ruhig halten. Kein Rand, Licht von oben links. |
| `public/icons/fishing/ground.png` | **Fischgrund:** rundes Plättchen, darauf ein springender Fisch über Wellen | 256 × 256, transparent, Motiv rund | Liegt im Wasser vor der Küste, etwa 40 Pixel groß, unten mittig Platz für die Zahl (die Zahl setzt das Spiel selbst). Muss sich vom Hafenschild unterscheiden (die Häfen sind dunkle Scheiben mit Rohstoffsymbol). |
| `public/icons/fishing/fish-1.png`, `fish-2.png`, `fish-3.png` | **Fischplättchen:** ein, zwei, drei Fische auf einem kleinen Papierplättchen | 256 × 256, transparent | Die Anzahl muss ohne Zahl erkennbar sein. Erscheint in der Hand etwa 30 Pixel groß. |
| `public/icons/fishing/anchor.png` | **Rostiger Anker:** alter Anker mit Rostflecken und Tang | 256 × 256, transparent | Für Hand, Spielerleiste und Menü, klein lesbar. Freundlich, nicht düster. |
| `public/banner/papiercollage/anchor.png` | **Banner-Motiv Anker** | 1024 × 1024, transparent, Motiv ca. 85 % | für „zieht den Rostigen Anker“ |

### Duell

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/duel/token.png` | **Handelsmarke:** runde Marke aus Messing oder Karton mit eingeprägten Waagschalen oder zwei Pfeilen im Kreis | 256 × 256, transparent | Für Hand und Menü, etwa 30 Pixel. Keine Schrift. |
| Graue Figuren | **Neutrale Mitspieler:** Dorf, Stadt und Straße in zwei Grautönen | keine neue Grafik nötig | siehe „Graue Figuren“ unten |

### Flussläufe

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `output/designs/pieces-2026-10-21/sources/bridge-base.png` | **Brücke:** kleine Holzbrücke mit Geländer, steile Draufsicht wie die übrigen Figuren, liegt quer | 512 × 128 wie die Straße, transparent | Der **Belag** muss einfärbbar sein wie die Terrakottaflächen bei Straße und Stadt; Geländer und Pfosten bleiben holzbraun. Liegt auf einer Kante quer über einem Fluss und muss sich von einer Straße unterscheiden. |
| `public/icons/rivers/coin.png` | **Münze:** Goldmünze aus Papier mit eingeprägter Welle | 256 × 256, transparent | Für Hand, Menü und Spielerleiste, etwa 24 bis 30 Pixel. Keine Zahl, keine Schrift. |
| `public/icons/rivers/rich.png`, `poor.png` | **Abzeichen:** voller Geldbeutel (meiste Münzen, +1 Punkt) und leerer, geflickter Beutel (wenigste Münzen, −2 Punkte) | 256 × 256, transparent | Für die Spielerleiste, etwa 20 Pixel. Freundlich, nicht abwertend. |

Die Flüsse selbst zeichnet das Spiel als Linien über die Felder; dafür braucht es keine Feldgrafiken je Flussrichtung.

### Hafenvogt

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/variants/harbor-master.png` | **Abzeichen Hafenvogt:** Kapitänsmütze oder kleiner Leuchtturm auf einer runden Plakette | 256 × 256, transparent | Für Spielerleiste und Punkteübersicht, etwa 20 bis 24 Pixel. Steht neben den Abzeichen für längste Straße und Rittermacht, muss sich davon abheben. |
| `public/banner/papiercollage/lighthouse.png` | **Banner-Motiv Hafenvogt:** Leuchtturm an einer Mole, ein paar Wellen | 1024 × 1024, transparent, Motiv ca. 85 % | Für das Banner „Hafenvogt“. Heute zeigt es ersatzweise Gebäude des Spielers und Münzen. |

### Optional

| Datei | Motiv | Hinweise |
|---|---|---|
| `public/banner/papiercollage/fish.png` | Banner-Motiv Fisch, 1024 × 1024 | nur falls später ein Banner für einen großen Fang kommt |
| `public/cards/dice-deck-back.png` | **Würfelstapel, Rückseite:** zwei Würfel auf Papier, im Design „Symbolstark“ der übrigen Karten | Format wie die Entwicklungskarten. Heute zeigt das Spiel nur „N Karten“ als Text; nötig erst, wenn der Stapel als Karte erscheint oder Ereigniskarten dazukommen. |
| `public/cards/dice-deck-front.png` | **Würfelstapel, Vorderseite:** leere Karte mit Platz für zwei Würfelaugen | Die Augen setzt das Spiel selbst, die Karte bleibt textfrei. |

## Technische Vorgaben

- Echte Transparenz, keine eingezeichneten Schachbrettmuster.
- Keine Schrift, Zahlen, Rahmen oder Schatten außerhalb des Motivs.
- Muss klein lesbar sein: Symbole erscheinen mit 24 bis 40 Pixeln.

## Graue Figuren (Duell)

Die Neutralen brauchen kein neues Grundbild. Dorf, Stadt und Straße laufen durch dieselbe Farbpipeline wie die Spielerfarben:

1. In `scripts/build-piece-assets.py` bei `COLORS` zwei Einträge ergänzen, nicht wählbar in der Lobby:
   - `"grey-light": ("Hellgrau", "#9aa1a8", False)`
   - `"grey-dark": ("Dunkelgrau", "#5d646c", False)`
2. Ausführen: `python scripts/build-piece-assets.py` (Straße) und `python scripts/build-organic-piece-assets.py` (Dorf und Stadt).
3. Ergebnis prüfen: Grau muss sich auf allen Geländen von Weiß und Braun abheben. Notfalls die Grautöne leicht bläulich verschieben, dann aber auch `NEUTRALS` in `src/app/engine/variants.ts` anpassen.

## Brücken in Spielerfarben (Flussläufe)

Wie beim Schiff läuft die Brücke durch dieselbe Pipeline wie die Straße (`scripts/build-piece-assets.py`):

1. In `PIECES` den Eintrag `"bridge": "Brücke"` ergänzen und wie `road` flach behandeln (`size = (512, 128)`).
2. Ausführen: `python scripts/build-piece-assets.py`. Das legt `masks/bridge.png` an; die Maske so nacharbeiten, dass nur der Belag eingefärbt wird.
3. Ergebnis: `public/pieces/papiercollage/bridge-<farbe>.png` für alle Farben, auch die beiden Grautöne der Neutralen.

## Einbindung (macht danach der Code-Agent)

- **See:** `lake` in `src/app/ui/board/tile-art.ts` eintragen und mit `node scripts/optimize-images.mjs` die Web-Fassung erzeugen. Der SVG-Platzhalter `#t-lake` bleibt als Rückfall.
- **Fischgrund:** In `src/app/ui/board/board.html` im Block `.fishing` das `<use href="#fish">` durch `<image>` ersetzen.
- **Fischplättchen und Anker:** Fischstapel in der Hand (`src/app/ui/game/game.html`, `.fish-stack`), Fischmenü und Spielerleiste.
- **Handelsmarke:** Markenstapel in der Hand (`.fish-stack.tokens`) und Markenmenü.
- **Graue Figuren:** die beiden Grautöne in `PIECE_COLORS` (`src/app/ui/shared/piece-art.ts`) eintragen.
- **Banner Anker:** neue Banner-Art in `src/app/ui/game/event-banner.ts`.
- **Hafenvogt:** Abzeichen in Spielerleiste und Punkteübersicht (`src/app/ui/game/game.html`), Motiv im Fall `harbor` von `event-banner.ts` statt der Münzen.
- **Würfelstapel:** Rückseite neben dem Würfelbecher (`.dice-deck` in `game.html`).
- **Brücke:** `bridge` als `PieceKind` in `src/app/ui/shared/piece-art.ts`; in `board.html` ersetzt das Bild den Holzsteg `.bridge-deck` samt Straße, dazu der Bauknopf „Brücke“ in `game.html`.
- **Münze und Abzeichen:** Münzstapel in der Hand (`.fish-stack.coins`), Münzmenü, „Reichster“/„Bettler“ in der Spielerleiste.

## Abnahme

- [ ] Hintergrund wirklich transparent, auch in Lücken des Motivs
- [ ] See passt neben die übrigen Gelände, unteres Drittel ruhig für das Zahlenschild
- [ ] Fischgrund bei 40 Pixeln erkennbar und deutlich anders als ein Hafen
- [ ] Ein, zwei, drei Fische ohne Zahl unterscheidbar
- [ ] Anker und Handelsmarke bei 24 Pixeln erkennbar
- [ ] Graue Figuren auf jedem Gelände von Weiß und Braun zu unterscheiden
- [ ] Hafenvogt-Abzeichen bei 20 Pixeln erkennbar und anders als die übrigen Abzeichen
- [ ] Brücke auf dem Fluss klar von einer Straße zu unterscheiden, Belag in allen Farben lesbar
- [ ] Münze und Geldbeutel-Abzeichen bei 20 Pixeln erkennbar

Die verwendeten Prompts bitte in `output/designs/fernhandel-2026-10-22/prompts.json` ablegen.
