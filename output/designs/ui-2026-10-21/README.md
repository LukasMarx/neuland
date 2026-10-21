# UI-Redesign · drei Richtungen

Statische Mockups der Spielansicht (1440 × 900) auf Basis der Papiercollage-Kacheln,
der Symbolstark-Karten, der Spielfiguren und Nunito Sans. Alle Grafiken kommen
direkt aus `public/`, das Beispielbrett aus `shared/board.js`.

| Entwurf | Datei | Idee |
|---|---|---|
| 01 · Spieltisch | `01-spieltisch.html` | Filztisch, Brett leicht geneigt, Mitspieler ringsum, Kartenfächer, Figurenvorrat, Würfelschale und Wachssiegel-Knopf |
| 02 · Nachtbühne | `02-nachtbuehne.html` | Dunkel und edel in Bordeaux-Gold, Spieler-Medaillons oben, leuchtendes Brett, Dock unten |
| 03 · Atlas | `03-atlas.html` | Hell und strukturiert, geführte Zugkarte links mit Schritten und Bauliste, Brett auf Papierbogen rechts |

`index.html` zeigt alle drei nebeneinander mit Stärken und Schwächen.

## Ansehen

Die Seiten laden JavaScript-Module und brauchen deshalb einen lokalen Webserver:

```bash
node scripts/serve-static.mjs 4310
```

Danach http://127.0.0.1:4310/output/designs/ui-2026-10-21/ öffnen.
