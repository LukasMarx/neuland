# Auftrag: freigestellte Einzelteile für Ereignis-Banner

## Worum es geht

Neuland ist ein Brettspiel im Browser. Bei wichtigen Ereignissen (Sieg, größte Rittermacht, längste Handelsstraße, Monopol, Erfindung, Räuber, „Du bist dran“) läuft ein breites, halbtransparentes Band über das Spielbrett. Links und rechts vom Text treten einzelne Motive auf und werden animiert: Sie fliegen herein, ploppen auf oder werden gespiegelt zu Paaren zusammengesetzt.

Dafür brauchen wir **freigestellte Einzelmotive als PNG mit echter Transparenz**. Kein Banner, keine Karte, keine Szene, nur das jeweilige Objekt. Band, Text und Animation baut die App selbst.

## Stil

Alles im bestehenden **Papiercollage-Stil** von Neuland: handgeschnittene, geschichtete Papierformen, sichtbare Papierfasern, weiche plastische Schatten innerhalb des Motivs, warme Creme- und Goldtöne.

**Stilreferenz** sind die Kartengrafiken in `public/cards/symbolstark/`. Mehrere Motive stammen direkt von dort, z. B. der Lorbeer und der Stern von `victoryPoint.png` oder Schild und Schwerter von `knight.png`. Wo eine Quelle angegeben ist, das Motiv aus dieser Karte freistellen und vereinfachen, nicht neu erfinden.

## Technische Vorgaben (für alle Dateien)

- PNG, **quadratisch 1024 × 1024 px**, echte Transparenz rundum (keine eingezeichneten Schachbrettmuster).
- Motiv mittig, vollständig sichtbar, füllt etwa **85 %** der Fläche, mit transparentem Rand.
- **Gerade von vorn** gesehen wie auf den Karten, keine Draufsicht.
- Keine Schrift, Zahlen, Rahmen, Kreise, Plaketten, Böden oder Schlagschatten außerhalb des Motivs.
- Muss auch klein noch lesbar sein: Motive werden mit etwa **80 bis 140 px** Höhe gezeigt. Feine Details vereinfachen.
- Ablage der Originale: `public/banner/papiercollage/<dateiname>.png`.

## Benötigte Motive

| Datei | Motiv | Quelle | Wofür |
|---|---|---|---|
| `laurel.png` | Ein einzelner goldener Lorbeerzweig, leicht gebogen, Stiel unten links, Spitze oben rechts | `victoryPoint.png` | Sieg: wird gespiegelt zum Kranz links und rechts vom Titel |
| `star.png` | Ein großer goldener Stern | `victoryPoint.png` | Sieg: über dem Titel |
| `shield.png` | Wappenschild mit goldener Lilie | `knight.png` | Größte Rittermacht |
| `sword.png` | Ein einzelnes Schwert, 45° schräg, Spitze oben rechts | `knight.png` | Rittermacht: gespiegelt ergeben zwei Schwerter ein gekreuztes Paar |
| `signpost.png` | Hölzerner Wegweiser mit zwei leeren Schildern | `roadBuilding.png` | Längste Handelsstraße |
| `chest.png` | Offene Schatztruhe mit Goldmünzen | `monopoly.png` | Monopol |
| `coin.png` | Eine einzelne Goldmünze, leicht schräg | `monopoly.png` | Monopol: fliegt mehrfach herein |
| `basket.png` | Geflochtener Korb mit Getreide, Wolle und Holz | `yearOfPlenty.png` | Erfindung |
| `horn.png` | Geschwungenes Messing-Signalhorn mit kleinem roten Wimpel | neu, im selben Stil | „Du bist dran“ |
| `robber.png` | Dunkle, schlichte Räuberfigur mit Kapuze, gesichtslos, freundlich-geheimnisvoll | neu, im selben Stil | Räuber wird versetzt |

## Prompts

Für Motive **mit Quelle** die jeweilige Karte als Bild mitgeben und diesen Prompt nutzen. Nur die letzte Zeile „Subject“ ändert sich:

```
Use case: background-extraction. Edit the reference card artwork into ONE isolated decorative game asset for an animated event banner. Keep only the requested subject, preserving the established cut-paper collage style, layered paper forms, visible paper fibers and recognizable colors. Remove ALL scenery, landscape, sky, clouds, hills, ground, buildings and backdrop. Simplify tiny details so the subject reads clearly at 100 pixels tall. Straight-on view as on the card. Center the complete subject on a square 1024x1024 canvas, occupying about 85% of the area with a transparent margin and no cropping. Genuine transparent background including all corners and gaps inside the silhouette. No circular disc, no border, no badge, no frame, no labels, no text, no numbers, no extra objects, no cast shadow outside the subject. Transparent cutout, not a card or a scene.
Subject: <siehe unten>
```

Subjects:

- **laurel:** `ONE single golden laurel branch only, gently curved, stem at bottom left, leaves sweeping up to the top right, so that a mirrored copy forms a wreath`
- **star:** `the single large golden star only`
- **shield:** `the heraldic shield with the golden fleur-de-lis only, without swords`
- **sword:** `ONE single sword only, tilted 45 degrees with the tip pointing to the top right, so that a mirrored copy forms crossed swords`
- **signpost:** `the wooden signpost with two blank arrow boards only, no writing on the boards`
- **chest:** `the open treasure chest filled with gold coins only, no loose coins around it`
- **coin:** `ONE single gold coin only, seen slightly from the side, plain face without symbols or numbers`
- **basket:** `the woven basket filled with wheat, wool and wood only`

Für die **zwei neuen Motive** ohne Quelle eine beliebige Karte als Stilreferenz mitgeben und diesen Prompt nutzen:

```
Use case: stylized-concept. Input image is STYLE REFERENCE only: match its tactile cut-paper collage look with layered paper forms, visible paper fibers, warm cream and gold accents and soft dimensional shading inside the subject. Create ONE isolated decorative game asset for an animated event banner. Straight-on view. Center the complete subject on a square 1024x1024 canvas, occupying about 85% of the area with a transparent margin and no cropping. Genuine transparent background including all corners and gaps inside the silhouette. Must read clearly at 100 pixels tall. No circular disc, no border, no badge, no frame, no labels, no text, no numbers, no extra objects, no cast shadow outside the subject. Transparent cutout, not a card or a scene.
Subject: <siehe unten>
```

- **horn:** `ONE curved brass herald horn with a small red pennant hanging from it`
- **robber:** `ONE simple dark hooded robber figure, standing, faceless shadow under the hood, friendly-mysterious rather than scary, dark charcoal and slate paper with subtle highlights`

## Abnahme

Vor dem Abliefern jede Datei prüfen:

- [ ] Hintergrund wirklich transparent, auch in Lücken innerhalb des Motivs
- [ ] Motiv vollständig, nicht angeschnitten, mittig
- [ ] Keine Schrift, kein Rahmen, kein Schatten außerhalb des Motivs
- [ ] Stil passt neben den Karten aus `public/cards/symbolstark/`
- [ ] `laurel.png` und `sword.png` funktionieren gespiegelt als Paar
- [ ] Bei 100 px Höhe noch klar erkennbar

Bitte die verwendeten Prompts in `output/designs/banner-2026-10-21/einzelteile-prompts.json` ablegen, im selben Format wie `output/designs/harbors-2026-10-21/icon-prompts.json`.
