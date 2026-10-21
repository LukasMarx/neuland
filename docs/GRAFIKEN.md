# Grafiken für die Spielfelder

So müssen Feldgrafiken aussehen, damit sie ohne Nacharbeit ins Brett passen.

## Aktueller Stil: Papiercollage

Die sechs Geländearten verwenden die transparenten PNG-Grafiken in
`public/tiles/papiercollage/`. Sie sind in `src/app/ui/board/tile-art.ts`
eingetragen. Die Originale sind 1254 × 1254 px groß; die seitliche Transparenz
wird durch das bestehende `preserveAspectRatio="xMidYMid slice"` beschnitten.
Das Brett zeichnet den exakten Hex-Ausschnitt, den Rand und die Zahlenchips.

Designvorlage, vollständige Generierungs-Prompts und eine Vorschau liegen in
`output/designs/hex-2026-10-21/`.

## Benötigte Dateien

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
