# Fischgründe, Duell und Hafenvogt – fertige Grafikassets

Erzeugt mit dem eingebauten Imagegen-Tool am 22.10.2026. Alle Pflichtmotive aus `grafik-auftrag.md` liegen in den vorgegebenen Zielverzeichnissen. Prompts und Referenzen: `prompts.json`.

- `public/tiles/papiercollage/lake.png`: 1254 × 1254, spitzes Hexfeld, vollständig geschlossenes Ufer, unteres Drittel ruhig für die Beschriftung.
- `public/icons/fishing/{ground,fish-1,fish-2,fish-3,anchor}.png`: jeweils 256 × 256.
- `public/icons/duel/token.png`: 256 × 256.
- `public/icons/variants/harbor-master.png`: 256 × 256.
- `public/banner/papiercollage/{anchor,lighthouse}.png`: jeweils 1024 × 1024.

Alle Motive sind transparente PNGs. Web-Fassungen liegen unter denselben Unterpfaden in `public/web/` (Gelände 384 px, Icons 96 px, Banner 280 px).

## Neutrale Figuren

Die bestehende Farbpipeline enthält jetzt `grey-light` (#9aa1a8) und `grey-dark` (#5d646c), beide nicht als Lobbyfarbe markiert. Graue Dörfer und Städte liegen in `public/pieces/papiercollage-organic-v2/`, graue Straßen in `public/pieces/papiercollage/`. Die vollständige Pipeline liefert zusätzlich graue Varianten der übrigen Figuren. Web-Fassungen sind vorhanden.

Die bestehenden Grundbilder wurden verwendet; keine neue Gebäudegeometrie. Wiederholen mit `python scripts/build-piece-assets.py` und `python scripts/build-organic-piece-assets.py` (Pillow und NumPy).

## Prüfung und Vorschau

`vorschau.html` zeigt alle Motive und ihre Zielgrößen: Hafenvogt 20 px, Anker und Handelsmarke 24 px, Fischplättchen 30 px, Fischgrund 40 px, Banner 100 px. `neutrale-vorschau.html` vergleicht die Grautöne mit Weiß und Braun auf sieben Untergründen. Gleichnamige PNGs sind Browseraufnahmen. Die Vorschauen verwenden Nunito Sans.

Dateigrößen und Alpha wurden geprüft (`pruefung.json`). Die Farbpipeline prüft unveränderten Alphakanal und unmaskierte Pixel. Ein, zwei und drei Fische bleiben ohne Zahlen unterscheidbar.

**Einbindung:** Gemäß Auftrag folgt die UI-Zuordnung durch den Code-Agenten. Optionale Würfelstapel-Karten und das optionale Fisch-Banner sind nicht Teil dieses Pakets.
