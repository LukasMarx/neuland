# Spielfiguren · Papiercollage

Vier transparente Figuren in steiler Draufsicht: Ritter (`knight`), Stadt (`city`), Straße (`road`) und Dorf (`settlement`).

## Dateien

- `sources/*.png`: unveränderte, mit dem eingebauten Imagegen erzeugte Einzelgrafiken.
- `sources/*-base.png`: zugeschnittene und vereinheitlichte Grundbilder.
- `masks/*.png`: Graustufenmasken derselben Größe; Weiß färbt vollständig, Schwarz bleibt unverändert, Grau mischt.
- `../../../public/pieces/papiercollage/`: 32 fertige transparente PNGs und `manifest.json`.
- `preview.html`: eigenständig im Browser öffnungsfähige Farbvorschau mit Geländeauswahl, Brettgröße, Originalen und Masken.
- `farben-uebersicht.jpg`: kompakte Farbübersicht.
- `prompts.md`: vollständige Imagegen-Prompts und Referenzbeschreibung.

Die sechs bestehenden Lobbyfarben bleiben unverändert. Goldgelb und Violett sind zusätzliche Entwurfsvarianten. Farbwerte und Dateinamen stehen im Manifest. Die Grafiken sind im Angular-Spielbrett, in der Bauvorschau und in den Bauknöpfen eingebunden. Die Ritterfigur erscheint bei der Ritteranzahl in der Spielerübersicht; die vorhandene Ritterkarte bleibt erhalten. Die Zuordnung der Spielerfarben steht in `src/app/ui/shared/piece-art.ts`. Unbekannte Farben aus alten Spielständen verwenden weiterhin die ursprünglichen SVG-Figuren.

## Neu erzeugen

Benötigt Python 3, Pillow und NumPy, ausschließlich für den Asset-Build:

```sh
python scripts/build-piece-assets.py
```

Der normale Lauf erhält vorhandene Masken, damit manuelle Korrekturen nicht verloren gehen. Nur bei bewusst ausgetauschten Quellen neue Masken erzeugen:

```sh
python scripts/build-piece-assets.py --refresh-masks
```

Die automatische Ausgangsmaske erkennt gesättigte Terrakottaflächen. Beim Stadttor ist zusätzlich der untere neutrale Bereich ausgeschlossen. Nach neuen Quellen die Vorschau in Blau und Weiß prüfen und nötigenfalls die gespeicherten Masken nacharbeiten. Quellen niemals durch Farbvarianten ersetzen.

Die Umfärbung erhält die lokalen Helligkeitsabstufungen in den markierten Bereichen. Das Skript prüft für jede Variante pixelgenau, dass Alpha und vollständig unmaskierte Pixel gegenüber dem normalisierten Grundbild unverändert sind. Die acht Varianten einer Figur haben identische Maße und Positionen.

## Darstellung

Figuren: 512 × 512 px; Straße: 512 × 128 px. Eine transparente Randzone ist enthalten. Im SVG können sie über `<image>` eingebunden werden. Mitte der Bilddatei als Anker verwenden; Straßen um diesen Mittelpunkt entlang der jeweiligen Kante drehen. Das Manifest nennt erste Breitenvorschläge (32 / 40 / 44 Brett-Einheiten), die bei einer Integration am tatsächlichen Brettmaßstab zu prüfen sind. Kurzen Schatten in der Darstellung ergänzen, wie in der Vorschau.

Beispielpfad: `pieces/papiercollage/city-blue.png`. Keine Laufzeit-Umfärbung und keine neue Bildgenerierung pro Spielerfarbe erforderlich.

## Geprüft

- Alle 32 PNGs besitzen Transparenz.
- Alpha und unmaskierte Pixel sind unverändert.
- Browserprüfung mit Edge: alle 32 Bilder laden, keine Seiten- oder HTTP-Fehler; Geländeauswahl, Brettgröße, Original- und Maskenansicht funktionieren.
- Kontaktbogen und Screenshot auf Wald in Brettgröße visuell geprüft.

Die große Stadt ist bewusst detailreich; bei kleiner Darstellung gehen feine Gebäudedetails verloren, die Farbflächen bleiben sichtbar. Grün und Braun haben auf ähnlichen Geländearten weniger Kontrast als Blau und Violett.
