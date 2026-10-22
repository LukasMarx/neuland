# Auftrag: Symbole für die Varianten in der Lobby

## Stand (22.10.2026)

**Alles offen.** Neu seit der überarbeiteten Lobby. Die Varianten stehen dort als kleine Karten in zwei Gruppen, „Erweiterungen“ und „Hausregeln“, bisher nur mit Name und einer Zeile Text. Ein Symbol je Karte macht die Liste schneller lesbar.

## Worum es geht

In der Lobby wählt der Gastgeber Karte und Varianten. Jede Variante bekommt links neben dem Namen ein kleines Symbol (etwa 28 Pixel). Vier Symbole gibt es schon oder sie stehen in einem anderen Auftrag; drei sind neu.

Stilreferenzen:

- **Kleine Symbole:** `public/icons/resources/*.png`, `public/icons/variants/harbor-master.png`, `public/icons/fishing/*.png`
- **Stil:** Papiercollage wie die übrigen Symbole, freigestellt, ohne Schrift

In Prompts nur die Neuland-Begriffe verwenden, keine Originalnamen und keine Beschreibung des Original-Artworks.

## Benötigte Dateien

### Neu

| Datei | Motiv | Format | Hinweise |
|---|---|---|---|
| `public/icons/variants/mild-robber.png` | **Milder Räuber:** Räuberfigur mit offener Hand oder gesenktem Knüppel | 256 × 256, transparent | Hausregel; erkennbar als der Räuber vom Brett, aber freundlich |
| `public/icons/variants/dice-deck.png` | **Würfelstapel:** kleiner Kartenstapel, oben eine Karte mit Würfelaugen | 256 × 256, transparent | Hausregel; Würfelaugen als Punkte, keine Ziffern |
| `public/icons/variants/city-watch.png` | **Stadtwacht:** Stadttor mit Wachturm, davor ein Speer | 256 × 256, transparent | Erweiterung; darf dem Ehrenschild aus dem Stadtwacht-Auftrag ähneln, aber nicht gleich sein |

### Schon vorhanden oder in einem anderen Auftrag

| Variante | Datei | Woher |
|---|---|---|
| Hafenvogt | `public/icons/variants/harbor-master.png` | vorhanden |
| Fischgründe | `public/icons/fishing/ground.png` | vorhanden |
| Duell | `public/icons/duel/token.png` | vorhanden |
| Flussläufe | `public/icons/rivers/coin.png` | offen im Auftrag `output/designs/fernhandel-2026-10-22/grafik-auftrag.md` |

## Technische Vorgaben

- Echte Transparenz, keine eingezeichneten Schachbrettmuster.
- Keine Schrift, Zahlen, Rahmen oder Schatten außerhalb des Motivs.
- Bei 24 Pixeln noch erkennbar.

## Einbindung (macht danach der Code-Agent)

- In `src/app/engine/variants.ts` je Variante ein Feld `icon` mit dem Pfad (Web-Fassung über `node scripts/optimize-images.mjs`).
- In `src/app/ui/lobby/lobby.ts` das Bild links neben dem Namen in `.variant b` zeigen; ohne Bild bleibt es wie heute.

## Abnahme

- [ ] Hintergrund wirklich transparent
- [ ] Die drei neuen Symbole passen im Stil zu Hafenvogt und Fischgrund
- [ ] Bei 24 Pixeln klar voneinander zu unterscheiden

Die verwendeten Prompts bitte in `output/designs/oberflaeche-2026-10-22/prompts.json` ablegen.
