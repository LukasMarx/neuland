# Stadtwacht III und alle optionalen Grafiken

Grafiklieferung vom 23.10.2026. **37 Grundmotive**: 25 Einflusskarten, drei Rückseiten, eine Händlerfigur und acht zuvor optionale Motive. Der Nutzer hat alle optionalen Motive ausdrücklich beauftragt. Einschließlich Spielerfarben sind das **47 Produktionsdateien und 77 Web-Fassungen**.

## Dateien

| Inhalt | Originale | Web-Fassungen |
|---|---|---|
| 25 Einflusskarten-Motive | `public/cards/progress/<Kartenkennung>.png`, 512 × 384, Pergamentgrund | `public/web/cards/progress/*.jpg`, 384 × 288; `public/web/cards-large/progress/*.jpg`, 512 × 384 |
| Drei Rückseiten | `public/cards/progress/back-{market,council,scholars}.png`, 1024 × 1536 | dieselben Web-Ordner, 256 × 384 und 600 × 900 |
| Händler | `public/pieces/papiercollage/trader.png` und `trader-<Farbe>.png`, 256 × 256, transparent | `public/web/pieces/papiercollage/`, 160 × 160 |
| Vier Wächter-Aktionen | `public/icons/city/guard-{activate,upgrade,move,chase}.png`, 256 × 256, transparent | `public/web/icons/city/`, 96 × 96 |
| Fisch- und Kaperschiff-Banner | `public/banner/papiercollage/{fish,pirate}.png`, 1024 × 1024, transparent | `public/web/banner/papiercollage/`, 280 × 280 |
| Würfelstapel | `public/cards/dice-deck-{front,back}.png`, 1024 × 1536 | `public/web/cards/`, 256 × 384; `public/web/cards-large/`, 600 × 900 |

Der Händler wird in zehn Farben geliefert: Rot, Blau, Goldgelb, Violett, Weiß, Orange, Grün, Braun, Hellgrau und Dunkelgrau. Das Grundbild liegt in `output/designs/pieces-2026-10-21/sources/trader.png`, die normalisierte Fassung daneben als `trader-base.png`, die Farbmaske in `masks/trader.png`. Nur rote Mantelflächen wechseln die Farbe; Hut, Waage, Gürtel und Schuhe bleiben neutral. Blickrichtung steil von oben passend zum Brett.

Alle Motive verwenden die bestehende Papiercollage. Markt ist gelb, Rat blau, Gelehrte grün. Bilder sind textfrei; Namen, Werte und Texte ergänzt das Spiel in **Nunito Sans**. Die Vorderseite des Würfelstapels hat zwei freie Würfelfelder. Die beiden Scheiben bei „Flurbereinigung“ sind unbeschriftet, damit das Spiel Zahlen als echten Text ergänzen kann.

## Vorschau und Herkunft

- [Interaktive Vorschau](vorschau.html): Gruppenfilter, Transparenz-Hintergrund, Einflusskarten bei 78 × 108 px, Aktionssymbole bei 22/32 px, Händler bei 30 px.
- [Vollständige Prompts und Referenzen](prompts.json). Erzeugt mit dem eingebauten `image_gen`; Originalgenerierungen bleiben erhalten.
- Die passenden Einträge sind zusätzlich in den angeforderten Prompt-Dateien der Auftragsordner vom 22.10.2026 abgelegt.

## Export und Einbindung

```text
python scripts/build-piece-assets.py
node scripts/optimize-images.mjs
python scripts/build-progress-preview.py
```

Python benötigt Pillow und NumPy. Für den Web-Export kann `NEULAND_PYTHON` auf diese Python-Installation zeigen. Vorhandene Farbmasken beim normalen Export behalten.

Die Dateien sind zur Einbindung bereit. Die Änderungen an `game.html`, `board.html`, der Kartenzuordnung und den Ereignis-Bannern übernimmt wie im Grafikauftrag vorgesehen der Code-Agent. Diese Lieferung ändert keine Spielregeln oder App-Ansichten.

## Abnahme

Alle 47 Produktionsdateien und 77 Web-Fassungen sind lesbar und vollständig. Formate und transparente Ränder sind geprüft; die Händlerfarben behalten Alpha und neutrale Pixel unverändert. Alle Motive wurden visuell geprüft, Blau und Weiß zusätzlich auf unerwünschte Verfärbungen. Die Browser-Vorschau lädt alle 98 Bildinstanzen ohne Fehler, verwendet Nunito Sans und hat auf Desktop sowie bei 390 px Breite keinen horizontalen Überlauf. Berichte: `pruefung.json`, `abschluss-pruefung.json` und `browser-pruefung.json`. Der Web-Satz benötigt rund 3,5 MiB statt 25,1 MiB für die Produktionsdateien.
