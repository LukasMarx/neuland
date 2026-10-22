# Auftrag: Grafiken für Fischgründe und Duell

## Worum es geht

Neuland hat zwei neue Varianten aus „Fernhandel I“, beide in der Lobby zuschaltbar:

- **Fischgründe:** Ein See ersetzt die Wüste. An der Küste liegen Fischgründe mit Zahl. Wer daran baut, fängt Fischplättchen im Wert 1 bis 3. Unter den Plättchen ist ein **Rostiger Anker**; wer ihn hat, braucht einen Punkt mehr zum Sieg.
- **Duell:** Für zwei Spieler. Zwei neutrale Mitspieler in Grau bauen mit. **Handelsmarken** erzwingen einen Tausch oder schicken den Räuber in die Wüste.

Im Spiel stehen dafür im Moment einfache SVG-Platzhalter. Gebraucht werden Grafiken im bestehenden **Papiercollage-Stil**. Die Regeln stehen in `docs/ERWEITUNGEN.md`, Abschnitte 2.1 (Duell) und 2.4 (Fischgründe).

Stilreferenzen:

- **Gelände:** `public/tiles/papiercollage/*.png` und `output/designs/hex-2026-10-21/`
- **Figuren:** `public/pieces/papiercollage/*.png`, `public/pieces/papiercollage-organic-v2/*.png` und `output/designs/pieces-2026-10-21/`. Dort liegen Grundbild, Maske, Prompts und Farbpipeline.
- **Kleine Symbole:** `public/icons/resources/*.png` (Rohstoffsymbole in Hand und Häfen)
- **Banner-Motive:** `public/banner/papiercollage/*.png` und `output/designs/banner-2026-10-21/einzelteile-auftrag.md`

In Prompts nur die Neuland-Begriffe verwenden (See, Fischgrund, Rostiger Anker, Handelsmarke, Neutrale), keine Originalnamen und keine Beschreibung des Original-Artworks.

## Benötigte Dateien

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

### Optional

| Datei | Motiv | Hinweise |
|---|---|---|
| `public/banner/papiercollage/fish.png` | Banner-Motiv Fisch, 1024 × 1024 | nur falls später ein Banner für einen großen Fang kommt |

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

## Einbindung (macht danach der Code-Agent)

- **See:** `lake` in `src/app/ui/board/tile-art.ts` eintragen und mit `node scripts/optimize-images.mjs` die Web-Fassung erzeugen. Der SVG-Platzhalter `#t-lake` bleibt als Rückfall.
- **Fischgrund:** In `src/app/ui/board/board.html` im Block `.fishing` das `<use href="#fish">` durch `<image>` ersetzen.
- **Fischplättchen und Anker:** Fischstapel in der Hand (`src/app/ui/game/game.html`, `.fish-stack`), Fischmenü und Spielerleiste.
- **Handelsmarke:** Markenstapel in der Hand (`.fish-stack.tokens`) und Markenmenü.
- **Graue Figuren:** die beiden Grautöne in `PIECE_COLORS` (`src/app/ui/shared/piece-art.ts`) eintragen.
- **Banner Anker:** neue Banner-Art in `src/app/ui/game/event-banner.ts`.

## Abnahme

- [ ] Hintergrund wirklich transparent, auch in Lücken des Motivs
- [ ] See passt neben die übrigen Gelände, unteres Drittel ruhig für das Zahlenschild
- [ ] Fischgrund bei 40 Pixeln erkennbar und deutlich anders als ein Hafen
- [ ] Ein, zwei, drei Fische ohne Zahl unterscheidbar
- [ ] Anker und Handelsmarke bei 24 Pixeln erkennbar
- [ ] Graue Figuren auf jedem Gelände von Weiß und Braun zu unterscheiden

Die verwendeten Prompts bitte in `output/designs/fernhandel-2026-10-22/prompts.json` ablegen.
