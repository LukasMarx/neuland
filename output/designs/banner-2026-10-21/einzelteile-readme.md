# Freigestellte Banner-Motive

Erstellt am 22.10.2026 nach `einzelteile-auftrag.md` mit dem eingebauten Imagegen-Tool.

## Dateien

Alle zehn PNGs liegen in `public/banner/papiercollage/`:

- `laurel.png` – einzelner Lorbeerzweig
- `star.png` – goldener Stern
- `shield.png` – Schild mit Lilie
- `sword.png` – einzelnes diagonales Schwert
- `signpost.png` – Wegweiser mit zwei leeren Pfeilschildern
- `chest.png` – offene Schatztruhe
- `coin.png` – einzelne Goldmünze
- `basket.png` – Korb mit Getreide, Wolle und Holz
- `horn.png` – Signalhorn mit rotem Wimpel
- `robber.png` – gesichtslose Räuberfigur

## Export und Prüfung

Die generierten Motive wurden proportional auf eine transparente 1024 × 1024-Pixel-Fläche zentriert. Die längste Motivkante beträgt ungefähr 870 Pixel (85 %). Der Alphakanal bleibt erhalten; die technischen Exporte verändern keine Motive.

Alle zehn PNGs wurden im Browser geladen und auf hellem und dunklem Hintergrund geprüft. Transparente Ränder und Aussparungen, vollständige Motive, Erkennbarkeit bei 100 Pixeln sowie Lorbeer und Schwerter als gespiegelte Paare wurden kontrolliert. Die numerische Größen- und Alphaprüfung steht in `einzelteile-pruefung.json`.

Die fertigen Motive und die Paare zeigt `einzelteile-vorschau.html`; `einzelteile-vorschau.png` ist eine Browseraufnahme. Die Vorschau verwendet die lokale Nunito Sans.

## Reproduzierbarkeit

`einzelteile-prompts.json` enthält die Ausgangsprompts, Kartenreferenzen, finalen Korrekturprompts und Quelldateien der ausgewählten Generierungen. Beim Korb wurde die ursprüngliche Generierung mit einem gezielten Framing-Edit korrigiert. Ein verworfener Zwischenschritt hatte zusätzliche Blätter und Beeren hinzugefügt und wird nicht verwendet.

## Einbindung

Die Motive sind als Assets vorbereitet. Die Ereignis-Banner im Spiel verwenden noch ihre bisherigen Grafiken. Für die spätere Einbindung sind passend verkleinerte Web-Exporte und die Zuordnung im Event-Banner erforderlich.
