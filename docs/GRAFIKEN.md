# Grafiken für die Spielfelder

So müssen Feldgrafiken aussehen, damit sie ohne Nacharbeit ins Brett passen.

## Web-Fassungen

Die Originale in `public/cards/`, `public/tiles/`, `public/icons/` und `public/pieces/`
sind groß (zusammen rund 74 MB) und werden **nicht** ausgeliefert (`ignore` in
`angular.json`). Die App lädt nur verkleinerte Fassungen aus `public/web/`
(zusammen rund 3,5 MB), etwa in doppelter Anzeigegröße:

| Gruppe | Längste Kante | Format |
|---|---|---|
| Karten | 384 px | JPEG |
| Gelände | 384 px | PNG mit Transparenz; fürs Brett zusätzlich JPEG (das Brett schneidet aufs Sechseck zu, ein Fünftel der Größe) |
| Wasser | 1024 px | JPEG |
| Rohstoff-Icons | 96 px | PNG mit Transparenz |
| Spielfiguren | 160 px | PNG mit Transparenz |

Nach neuen oder geänderten Grafiken einmal ausführen und `public/web/` mit committen
(der CI-Build hat kein `sips` und erzeugt die Fassungen nicht selbst):

```bash
node scripts/optimize-images.mjs
```

**Vorladen in der Lobby:** `src/app/ui/shared/image-cache.ts` holt schon in der Lobby
im Leerlauf, was Brett, Hand und Dock gleich beim Start zeigen (Felder der gewählten
Karte, Meer, Räuber, Rohstoffkarten und Hafen-Icons, Figuren in den Farben im Raum).
Teile einer Erweiterung (Schiffe und Kaperschiff bei Seewege, Wächter und Prachtstadt
bei Stadtwacht usw.) kommen nur dazu, wenn sie gewählt ist; wechselt eine Farbe oder die
Karte, wird nur das Neue nachgeladen. Wer eine neue Grafik einbaut, die gleich zu
Spielbeginn sichtbar ist, trägt sie in `gameStartImages()` ein, mit genau derselben
Adresse wie im Spiel (`web/...`), sonst trifft der Cache nicht.

## Aktueller Stil: Papiercollage

Die sechs Geländearten verwenden die transparenten PNG-Grafiken in
`public/tiles/papiercollage/`. Sie sind in `src/app/ui/board/tile-art.ts`
eingetragen. Die Originale sind 1254 × 1254 px groß; die seitliche Transparenz
wird durch das bestehende `preserveAspectRatio="xMidYMid slice"` beschnitten.
Das Brett zeichnet den exakten Hex-Ausschnitt, den Rand und die Zahlenchips.

Designvorlage, vollständige Generierungs-Prompts und eine Vorschau liegen in
`output/designs/hex-2026-10-21/`.

### Wasser

`public/tiles/papiercollage/ocean.png` ergänzt die Gelände um eine deckende,
quadratische Wassertextur aus türkisblauen Papierschichten. Das SVG-Muster
`p-ocean-paper` legt sie einmal über die gesamte Ozeanfläche und beschneidet
sie auf die jeweilige Brettform. So entstehen auch auf größeren Inseln keine
Kachelnähte. Der blaue Verlauf darunter bleibt als Ladehintergrund erhalten;
Häfen und Spielfelder werden über dem Wasser gezeichnet.

### Häfen

Die Häfen verwenden einzelne freigestellte Rohstoffsymbole aus
`public/icons/resources/`, abgeleitet aus den Papiercollage-Karten. Die
Zuordnung steht in `src/app/ui/shared/resource-art.ts`. Die Symbole haben
einen transparenten Hintergrund und stehen einzeln auf einem hellen Kreis
mit dünnem braunem Rand, ohne Landschaft. Allgemeine 3:1-Häfen zeigen ein Fragezeichen.
Die hellen Schilder mit **2:1** bzw. **3:1** bleiben erhalten; ihre Beschriftung
ist echter Text in Nunito Sans. Der Tooltip nennt Rohstoff und Verhältnis.
Positionen und Zuordnung zu den beiden Küstenkreuzungen folgen weiterhin
der Brettgeometrie. Prompts und Vorschauen: `output/designs/harbors-2026-10-21/`.

## Benötigte Dateien

### Karten und Schrift

Die Karten verwenden das gewählte Design **02 · Symbolstark**. Textfreie
Papiercollage-Motive für die fünf Rohstoffe, fünf Entwicklungskarten und eine
neutrale Rückseite liegen in `public/cards/symbolstark/`. Die Zuordnung steht
in `src/app/ui/shared/card-art.ts`; `CardFace` ergänzt Namen und Mengen als
echten Text und wird in Hand, Bankhandel und Rohstoffauswahl wiederverwendet.
Fluganimationen verwenden dieselben Bilder. Verdeckte Karten zeigen nur die
neutrale Rückseite. Auswahl, Spielbarkeit und Zähler folgen weiter dem Spielzustand.

**Nunito Sans** gilt global, einschließlich Formulare, Raumcodes, Dialoge,
Karten und SVG-Beschriftungen. Die verbindliche Entscheidung und Regeln für
neue Entwürfe stehen in [TYPOGRAFIE.md](TYPOGRAFIE.md).
Die variablen WOFF2-Dateien (normal/kursiv,
Gewichte 200–1000) mit SIL-OFL-Lizenz liegen in `public/fonts/nunito-sans/`
und werden über die globalen Styles eingebunden. Keine externe Font-Abfrage
zur Laufzeit. Quelle: [Google Fonts – Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans).

Designentwürfe, Produktions-Prompts und Screenshots der Integration:
`output/designs/cards-2026-10-21/`.

### Gelände

| Gelände | Rohstoff | Schlüssel |
|---|---|---|
| Wald | Holz | `wood` |
| Hügel | Lehm | `brick` |
| Weide | Wolle | `sheep` |
| Acker | Getreide | `wheat` |
| Gebirge | Erz | `ore` |
| Wüste | – | `desert` |

Pro Gelände reicht eine Datei. Mehrere Varianten (z. B. drei verschiedene Wälder) sind möglich und werden reihum verteilt, das wirkt lebendiger.

## Format

- **Form:** Sechseck mit **Spitze oben und unten** (pointy-top).
- **Seitenverhältnis:** Breite : Höhe = 0,866 : 1 (√3 : 2). Gute Größen sind **520 × 600 px** oder **1040 × 1200 px**.
- **Dateityp:** PNG oder WebP mit transparentem Hintergrund, alternativ SVG.
- **Ausschnitt:** Das Motiv füllt das Sechseck bis an den Rand. Was außerhalb liegt, wird ohnehin abgeschnitten.
- **Mitte freihalten:** Ein Kreis mit etwa **35 % der Breite** in der Mitte bekommt den Zahlenchip. Dort nichts Wichtiges platzieren.
- **Kein Rahmen:** Den cremefarbenen Rand zwischen den Feldern zeichnet das Brett selbst.
- **Licht:** Am besten einheitlich von oben links, damit die Felder zusammenpassen.

## Einbinden

1. Dateien nach `public/tiles/` kopieren, z. B. `public/tiles/wood-1.png`.
2. In `src/app/ui/board/tile-art.ts` eintragen:

   ```ts
   export const TILE_IMAGES: Partial<Record<Terrain, string[]>> = {
     wood: ['tiles/wood-1.png', 'tiles/wood-2.png'],
     brick: ['tiles/brick.png'],
   };
   ```

Gelände ohne Eintrag zeigen weiter die eingebaute SVG-Grafik.


## Spielfiguren

Städte, Siedlungen und Straßen verwenden transparente PNGs aus
`public/pieces/papiercollage/`. `src/app/ui/shared/piece-art.ts` ordnet die
Spielerfarbe der passenden Datei zu. Die Farbvarianten entstehen aus je
einem Grundbild und einer gespeicherten Maske; Export und Anleitung liegen in
`scripts/build-piece-assets.py` und `output/designs/pieces-2026-10-21/README.md`.

Die Lobby bietet Rot, Blau, Weiß, Orange, Grün, Schwarz, Pink und Violett
(`PLAYER_COLORS` in `src/app/net/protocol.ts`). Schwarz und Pink ersetzen seit dem
23.10.2026 Braun und Gold: Braun verschwand auf Lehm und neben Rot, Gold lag zu nah
an Orange (Vergleich mit Farbsehschwäche-Simulation in
`output/designs/figuren-lesbarkeit-2026-10-23/`). Die Figuren in Braun und Gold
bleiben für gespeicherte Spiele erhalten. Für Schrift, Linien und Punkte auf der
dunklen Oberfläche hellt `uiColor` (`src/app/ui/shared/player-color.ts`) Schwarz auf.

Neue Farbe: in `COLORS` von `scripts/build-piece-assets.py` eintragen, beide
Figurenskripte ausführen (das zweite ist `scripts/build-organic-piece-assets.py`
für Siedlung, Stadt und Prachtstadt), dann `node scripts/optimize-images.mjs` für
die Web-Fassungen der übrigen Figuren und die Farbe in `piece-art.ts` zuordnen.

Gebäude sitzen mittig auf ihren Kreuzungen (Siedlung 32, Stadt 46 Brett-Einheiten, `BUILDING_SIZE` in `board.ts`; auf dem großen Brett mal `PIECE_SCALE` 1,2).
Straßen werden um den Kantenmittelpunkt gedreht und vor den Gebäuden gezeichnet.
Über den Feldern liegt keine Aufhellung. Damit die Figuren auf jedem Gelände
lesbar bleiben, bekommen sie einen dünnen, leicht transparenten dunklen Rand
(Variante E1, Vergleich in `output/designs/board-kontrast-2026-10-21/`).
Figuren von Spielern tragen zusätzlich einen Rand in der Spielerfarbe mit dunkler
Außenkante (SVG-Filter je Farbe, `HALO` in `board.ts`): Die Gebäude zeigen die
Farbe sonst nur auf den Dächern, und ab fünf Spielern waren Braun, Weiß, Gold und
Orange auf dem kleineren Brett kaum zu unterscheiden. Gelände und Meer laufen mit
80 % Sättigung (`--map-saturation` in `board.scss`), damit die Figuren hervortreten.
Bauvorschau und Bauknöpfe verwenden dieselben PNGs. Die Rittergrafik erscheint
in der Spielerübersicht bei der Anzahl gespielter Ritter. Die Ritterkarte und
die Spielregeln ändern sich dadurch nicht. Für unbekannte Farben alter
Spielstände bleiben die bisherigen farbigen SVG-Figuren als Rückfall erhalten.
