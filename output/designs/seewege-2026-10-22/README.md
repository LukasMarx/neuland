# Seewege – fertige Grafikassets

Erzeugt mit dem eingebauten Imagegen-Tool am 22.10.2026. Alle Pflichtdateien aus `grafik-auftrag.md` sind vorhanden, einschließlich Web-Fassungen. Vollständige Prompts und Referenzen: `prompts.json`.

## Perspektive und Figuren

Nach dem Hinweis des Nutzers zeigen **Schiff und Kaperschiff eine steile Draufsicht**, ungefähr 75° über der Brettfläche: Deck und beide Bordkanten sichtbar, kurze perspektivisch verkürzte Masten. Die frühen seitlichen Brett-Entwürfe wurden verworfen. Die hochgeladene Dorf-Stilreferenz liegt unter `stilreferenz-spielfiguren.png`.

- Rohquelle: `output/designs/pieces-2026-10-21/sources/ship.png`
- Normalisiertes Grundbild: `output/designs/pieces-2026-10-21/sources/ship-base.png`, 512 × 256
- Rumpfmaske: `output/designs/pieces-2026-10-21/masks/ship.png`
- Farbvarianten: `public/pieces/papiercollage/ship-<farbe>.png`
- Kaperschiff: `public/pieces/papiercollage/pirate.png`, 512 × 512

Die bestehende Pipeline exportiert acht Spielerfarben sowie die beiden neuen Neutralfarben. Nur der Rumpf wird eingefärbt. Mast, Deck und Segel bleiben unverändert; Alpha und unmaskierte Pixel wurden durch die Pipeline geprüft.

Das eigenständige **Banner-Schiff** bleibt gemäß Auftrag in Seitenansicht. Es wird nicht als Brettfigur verwendet.

## Übrige Dateien

- Gelände: `public/tiles/papiercollage/gold.png` und `fog.png`, jeweils 1254 × 1254
- Banner: `public/banner/papiercollage/ship.png` und `island.png`, jeweils 1024 × 1024
- Inselbonus: `public/icons/seewege/island-bonus.png`, 256 × 256

Die verkleinerten Fassungen liegen unter denselben Unterpfaden in `public/web/`: Gelände 384 px, Figuren 160 px, Banner 280 px, Icons 96 px (jeweils längste Kante).

## Vorschau und Prüfung

`vorschau.html` zeigt das Paket, `figuren-vorschau.html` die acht Schiffsfarben auf Wasser in 40 px Breite, auch gedreht, sowie das Kaperschiff in 50 px. Die gleichnamigen PNGs sind Browseraufnahmen. Größen, transparente Ecken und Alpha wurden geprüft; Daten stehen in `pruefung.json`. Die Vorschauen verwenden Nunito Sans.

Farben erneut erzeugen: `python scripts/build-piece-assets.py` (Pillow und NumPy). Web-Exporte: `node scripts/optimize-images.mjs` (macOS: sips; Windows/Linux: Python mit Pillow, optional über `NEULAND_PYTHON`). Einzelne public-relative PNG-Pfade als Argumente begrenzen den Export.

**Einbindung:** Die App-Zuordnung bleibt Aufgabe des Code-Agenten gemäß Grafikauftrag. Noch keine Änderungen an Brett- oder Banner-Komponenten. Das ausdrücklich optionale Kaperschiff-Banner wurde nicht erzeugt.
