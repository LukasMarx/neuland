# Neuland – drei Kartendesigns

Erstellt am 21.10.2026 mit dem integrierten image_gen-Werkzeug.

Alle Entwürfe zeigen dieselben Beispiele: eine Holz-Rohstoffkarte, eine Ritter-Entwicklungskarte und eine allgemeine Rückseite für Entwicklungskarten.

1. **Klassisch:** helle Papierrahmen, detailreiche Illustrationen und Serifenschrift.
2. **Symbolstark:** große Motive, farbige Flächen, deutliche Beschriftung und Ecksymbole.
3. **Edel:** dunkles Petrol, goldene Akzente und gerahmte Illustrationen.

Gewählt und eingebaut: **02 · Symbolstark**, kombiniert mit **Nunito Sans** im gesamten Spiel. Die drei ursprünglichen Bilder dokumentieren die Stilauswahl; ihre eingebrannte Beispielschrift ist keine UI-Schrift.

Die elf textfreien Produktionsmotive liegen in `public/cards/symbolstark/`: fünf Rohstoffe, fünf Entwicklungskarten und eine gemeinsame verdeckte Rückseite. Erstellt mit dem integrierten `image_gen`-Werkzeug, jeweils anhand von `02-symbolstark.png`. Alle Produktions-Prompts stehen in `production-prompts.json`.

`CardFace` rendert Namen, Mengen und projizierte Aktionen als echten Text. Die eigene Hand, Bankhandel und Rohstoffauswahl verwenden dieselbe Komponente. Fluganimationen nutzen dieselben Motive; verdeckte Übertragungen und gekaufte Entwicklungskarten zeigen die Rückseite.

Die Schrift wird einschließlich normaler und kursiver variabler Schnitte sowie Lizenz lokal aus `public/fonts/nunito-sans/` ausgeliefert. Es gibt keine Google-Fonts-Abhängigkeit zur Laufzeit.

Die Screenshots `gallery.png`, `game-desktop.png` und `game-mobile.png` zeigen die echten Angular-Komponenten mit einem lokalen Testspielstand. Die Vorschau verändert keine laufende Partie.

Validierung: Produktionsbuild erfolgreich. Alle 112 Engine-Tests bestanden mit lokalem Testlimit von 15 Sekunden; der bestehende Zufallsspieltest „4 Spieler, Seed 4“ überschritt beim Standardlauf das 5-Sekunden-Limit knapp (ca. 5,5 Sekunden). Die Projekt-Testkonfiguration wurde nicht geändert. `ui-check.json` protokolliert Schriftladung, Bildladung, Kartennamen, Handelsauswahl, Mengentasten und die verdeckte Kartenanimation. Bildschirmbreiten: 1440, 390 und 320 Pixel; Kartenübersicht: 1280 Pixel.

Referenz: output/designs/hex-2026-10-21/03-papiercollage.png

## Vollständige Generierungs-Prompts

### 01 · Klassisch

```text
Use case: stylized-concept.
Asset type: visual design proposal for playable cards in the existing browser board game Neuland.
Input image 1: STYLE REFERENCE ONLY: the game's approved handcrafted paper-collage terrain artwork. Use its textured cut-paper materials and earthy color family, not its layout.
Produce ONE polished landscape design sheet with exactly THREE large portrait cards side by side, shown perfectly straight-on, all the same dimensions and approximately 2:3 width-to-height proportion. Generous balanced spacing, warm ivory background #f3ecdc, subtle contact shadows, corners gently rounded. This is a card design comparison board, not a web page or a photograph with props. The cards should occupy most of the composition beneath a clear title.
Left card: a resource card for WOOD. The exact card title is "HOLZ". Prominent recognizable paper illustration of three cut logs with visible rings and layered green conifer foliage, with a hint of forest matching the reference. Use earthy browns and forest green, emphasize the recognizable log silhouette. Small category label "ROHSTOFF".
Middle card: a KNIGHT development card. Exact card title "RITTER", small category label "ENTWICKLUNG". Prominent illustration of a crafted steel-gray shield and crossed swords, all made from layered matte paper with warm muted metal-colored paper highlights, coherent with the terrain art. Calm organized composition. Do not add written rules, combat statistics, numbers or invented gameplay mechanics.
Right card: the common BACK of development cards. It must not reveal the card's action or resource. Use a rotationally symmetric pattern of nested hexagons, small paper-wave contours, and a central abstract island-like hexagon emblem; no resource symbol and no knight equipment. Exact text "NEULAND" and a smaller "ENTWICKLUNG", no other text on the back.
Below each card, outside its rounded rectangle, small restrained captions exactly: "Rohstoffkarte", "Entwicklungskarte", "Rückseite".
Cards are intended to be readable in a compact hand of cards on screen: strong central silhouettes, clear titles and type hierarchy, no tiny decorative information, no clutter. Art is visibly tactile paper collage with subtle fibers and layered cut edges, softly lit from upper left. Keep each front's lower central area calm enough that the real game can later overlay a count badge. Do not show a badge or count in this design.
No extra cards, hands, tabletop props, watermarks, UI controls, dummy Latin, commercial game branding or unrelated copy. Only the specified German text and requested sheet title.
Specific design direction: CLASSIC CREAM PAPER FRAME. Friendly premium tabletop illustrations inside a generous warm-ivory paper border, slightly deckled inner picture edge, slim forest-green accent for the wood card and muted warm plum accent for the knight card. The large scene occupies the upper two thirds; a cream footer holds the large dark-brown card title and small category with highly legible elegant serif typography. The wood art shows the logs in front of a lush paper forest; the knight shield stands against softly layered gray stone and muted plum paper. The back is warm ivory with a tasteful navy-teal paper lattice and central small honey-gold hex emblem. Restrained and crafted, charming illustrated board-game feel. Header at the top of the sheet verbatim: "01 · Klassisch".
```

### 02 · Symbolstark

```text
Use case: stylized-concept.
Asset type: visual design proposal for playable cards in the existing browser board game Neuland.
Input image 1: STYLE REFERENCE ONLY: the game's approved handcrafted paper-collage terrain artwork. Use its textured cut-paper materials and earthy color family, not its layout.
Produce ONE polished landscape design sheet with exactly THREE large portrait cards side by side, shown perfectly straight-on, all the same dimensions and approximately 2:3 width-to-height proportion. Generous balanced spacing, warm ivory background #f3ecdc, subtle contact shadows, corners gently rounded. This is a card design comparison board, not a web page or a photograph with props. The cards should occupy most of the composition beneath a clear title.
Left card: a resource card for WOOD. The exact card title is "HOLZ". Prominent recognizable paper illustration of three cut logs with visible rings and layered green conifer foliage, with a hint of forest matching the reference. Use earthy browns and forest green, emphasize the recognizable log silhouette. Small category label "ROHSTOFF".
Middle card: a KNIGHT development card. Exact card title "RITTER", small category label "ENTWICKLUNG". Prominent illustration of a crafted steel-gray shield and crossed swords, all made from layered matte paper with warm muted metal-colored paper highlights, coherent with the terrain art. Calm organized composition. Do not add written rules, combat statistics, numbers or invented gameplay mechanics.
Right card: the common BACK of development cards. It must not reveal the card's action or resource. Use a rotationally symmetric pattern of nested hexagons, small paper-wave contours, and a central abstract island-like hexagon emblem; no resource symbol and no knight equipment. Exact text "NEULAND" and a smaller "ENTWICKLUNG", no other text on the back.
Below each card, outside its rounded rectangle, small restrained captions exactly: "Rohstoffkarte", "Entwicklungskarte", "Rückseite".
Cards are intended to be readable in a compact hand of cards on screen: strong central silhouettes, clear titles and type hierarchy, no tiny decorative information, no clutter. Art is visibly tactile paper collage with subtle fibers and layered cut edges, softly lit from upper left. Keep each front's lower central area calm enough that the real game can later overlay a count badge. Do not show a badge or count in this design.
No extra cards, hands, tabletop props, watermarks, UI controls, dummy Latin, commercial game branding or unrelated copy. Only the specified German text and requested sheet title.
Specific design direction: BOLD COLORED CARDS WITH OVERSIZED PAPER SYMBOLS. Full colored backgrounds from textured paper, broad simple color shapes and big tactile central emblems. Wood card deep forest green with a beautifully dimensional oversized stacked-log emblem; knight card muted plum and slate with an oversized shield-and-crossed-swords emblem. Keep tiny scenery out: prioritize big unmistakable shapes. An integrated pale-ivory rounded title strip near the foot carries bold dark high-contrast clean sans-serif "HOLZ" or "RITTER", and the small category. Small repeated emblem near an upper corner may aid identification in an overlapping hand. The back is rich teal-blue, with a bold ivory nested-hexagon emblem and pale-gold accents. Contemporary approachable game design, chunky paper layers, crisp visual hierarchy, visually distinct from an ornate framed illustration. Header at the top of the sheet verbatim: "02 · Symbolstark".
```

### 03 · Edel

```text
Use case: stylized-concept.
Asset type: visual design proposal for playable cards in the existing browser board game Neuland.
Input image 1: STYLE REFERENCE ONLY: the game's approved handcrafted paper-collage terrain artwork. Use its textured cut-paper materials and earthy color family, not its layout.
Produce ONE polished landscape design sheet with exactly THREE large portrait cards side by side, shown perfectly straight-on, all the same dimensions and approximately 2:3 width-to-height proportion. Generous balanced spacing, warm ivory background #f3ecdc, subtle contact shadows, corners gently rounded. This is a card design comparison board, not a web page or a photograph with props. The cards should occupy most of the composition beneath a clear title.
Left card: a resource card for WOOD. The exact card title is "HOLZ". Prominent recognizable paper illustration of three cut logs with visible rings and layered green conifer foliage, with a hint of forest matching the reference. Use earthy browns and forest green, emphasize the recognizable log silhouette. Small category label "ROHSTOFF".
Middle card: a KNIGHT development card. Exact card title "RITTER", small category label "ENTWICKLUNG". Prominent illustration of a crafted steel-gray shield and crossed swords, all made from layered matte paper with warm muted metal-colored paper highlights, coherent with the terrain art. Calm organized composition. Do not add written rules, combat statistics, numbers or invented gameplay mechanics.
Right card: the common BACK of development cards. It must not reveal the card's action or resource. Use a rotationally symmetric pattern of nested hexagons, small paper-wave contours, and a central abstract island-like hexagon emblem; no resource symbol and no knight equipment. Exact text "NEULAND" and a smaller "ENTWICKLUNG", no other text on the back.
Below each card, outside its rounded rectangle, small restrained captions exactly: "Rohstoffkarte", "Entwicklungskarte", "Rückseite".
Cards are intended to be readable in a compact hand of cards on screen: strong central silhouettes, clear titles and type hierarchy, no tiny decorative information, no clutter. Art is visibly tactile paper collage with subtle fibers and layered cut edges, softly lit from upper left. Keep each front's lower central area calm enough that the real game can later overlay a count badge. Do not show a badge or count in this design.
No extra cards, hands, tabletop props, watermarks, UI controls, dummy Latin, commercial game branding or unrelated copy. Only the specified German text and requested sheet title.
Specific design direction: DARK TEAL WITH RESTRAINED GOLD ACCENTS. Premium collector-card appearance built from textured dark navy-teal paper, slim warm golden-ochre double lines and elegant minimal corner geometry inspired by hexagons. Warm ivory high-contrast serif titles. A central arched or chamfered picture window reveals lush cut-paper art: forest-green foliage and brown wood logs for wood, gray shield and swords on muted slate/plum paper for knight. Keep the frame dark and the artwork bright enough to read clearly; no busy filigree. Fine golden paper edges, not shiny plastic or photoreal metal. Lower dark title band with generous space and no tiny extra text. Development back is dark teal with a symmetrical gold-ochre and ivory hexagonal paper motif, tasteful and cohesive. Rich, quiet and refined, related to the new blue paper ocean. Header at the top of the sheet verbatim: "03 · Edel".
```
