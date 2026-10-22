# Grafiklieferung vom 22.10.2026

## Geliefert

Stadtwacht I und II, Flussläufe sowie die Bedienelemente „Handeln“, „Versetzen“ und „Ausbau“: **28 neue Grundmotive**, daraus **73 Produktionsdateien** und **76 Web-Fassungen** einschließlich Karten in zwei Auflösungen.

Die Motive wurden mit dem eingebauten `image_gen` erzeugt. Vollständige Ausgangsprompts, Referenzen und Korrekturen stehen in `prompts.json`, für Flussläufe und Seewege in den jeweiligen Nachbarordnern. Frühere Lieferungen bleiben in deren Prompt-Dateien erhalten.

## Vorschauen

- [Güterkarten, Symbole und Flotte](vorschau.html)
- [Wächter, Prachtstadt und Palisade](figuren-vorschau.html)
- [Brücke, Münze und Geldbeutel](../fernhandel-2026-10-22/nachtrag-vorschau.html)
- [Handeln und Schiff versetzen](../seewege-2026-10-22/nachtrag-vorschau.html)

Alle HTML-Vorschauen verwenden die lokal gespeicherte **Nunito Sans**. Bilder bleiben textfrei.

## Dateien und Einbindung

| Gruppe | Originale | Web-Fassungen |
|---|---|---|
| Güterkarten | `public/cards/symbolstark/{paper,cloth,silver}.png` | `public/web/cards/symbolstark/*.jpg` und `public/web/cards-large/symbolstark/*.jpg` |
| Gütersymbole | `public/icons/resources/{paper,cloth,coin}.png` | entsprechend unter `public/web/`, 96 px |
| Stadtausbau, Würfel, Ehrenschild | `public/icons/city/*.png` | entsprechend unter `public/web/`, 96 px |
| Flussläufe | `public/icons/rivers/{coin,rich,poor}.png` | entsprechend unter `public/web/`, 96 px |
| Bedienelemente | `public/icons/ui/{move-ship,trade}.png` | entsprechend unter `public/web/`, 96 px |
| Brücke und Wächter | `public/pieces/papiercollage/{bridge,guard1,guard2,guard3}-<farbe>.png` | entsprechend unter `public/web/`, längste Kante 160 px |
| Prachtstadt | `public/pieces/papiercollage-organic-v2/metropolis-<farbe>.png` | entsprechend unter `public/web/`, 160 px |
| Palisade und Flotte | `public/pieces/papiercollage/{wall,raiders}.png` | entsprechend unter `public/web/`, längste Kante 160 px |
| Angriffsbanner | `public/banner/papiercollage/raiders.png` | entsprechend unter `public/web/`, 280 px |

**Silber heißt im Code `coin`**, seine Karte dagegen `silver`. Die Grafikdateien sind für die nachgelagerte Einbindung vorbereitet; diese Lieferung ändert keine Spielregeln oder UI-Zuordnungen.

## Figuren und Farbpipeline

Brücke und Wächter: Grundbilder und Masken in `output/designs/pieces-2026-10-21/`; Prachtstadt in `output/designs/organic-pieces-2026-10-22/`. Jeweils acht Farben plus Hellgrau und Dunkelgrau. Nur Belag, Umhang, Dach und Fahnen werden eingefärbt. Alpha und vollständig unmaskierte Pixel bleiben unverändert.

Brücke: 512 × 128; Wächter und Prachtstadt: 512 × 512; Palisade: 512 × 512 mit freier Mitte; Flotte: 512 × 256. Brettfiguren zeigen eine steile Draufsicht. Die Prachtstadt wurde dafür nach der ersten Generierung nochmals korrigiert. Banner und Würfelsymbole verwenden eine lesbare Präsentationsansicht.

Die Vorschau zeigt Wächter bei 24 px, die Prachtstadt bei 52 px neben einer Stadt bei 40 px und die Palisade bei 68 px unter der Stadt. Das sind Größen zur Stilprüfung; der Code-Agent muss sie auf die tatsächlichen Brett-Einheiten und den vorhandenen Kontrastrand abstimmen.

Reproduktion (Python mit Pillow und NumPy):

```text
python scripts/build-piece-assets.py
python scripts/build-organic-piece-assets.py
node scripts/optimize-images.mjs
python scripts/build-expansion-previews.py
```

Unter Windows/Linux kann `NEULAND_PYTHON` auf den Python mit Pillow zeigen. Bestehende Masken nicht pauschal mit `--refresh-masks` überschreiben.

## Prüfung

Format, Alphakanal und transparente Ecken der Einzeldateien: `pruefung-nachtrag.json` in den jeweiligen Designordnern. Die Palisadenmitte ist leer; technisch verbleiben vereinzelte Alpha-Werte von 1/255 aus der Bildgenerierung. Farbvarianten wurden mit unverändertem Alpha und unveränderten neutralen Pixeln erzeugt. Blau und Weiß wurden zusätzlich visuell auf Holz-/Metallverfärbungen geprüft. Die Vorschauen zeigen Symbole bei 18, 20 und 28 px.

## Neu eingegangener Auftrag: Stadtwacht III

Während dieser Lieferung wurde auf Wunsch des Nutzers `48a0564` gepullt. Neu im [Grafikauftrag](grafik-auftrag.md#stadtwacht-iii-einflusskarten): **25 Einflusskarten-Motive, drei Rückseiten und eine Händlerfigur mit Farbvarianten**. Diese neue Lieferung steht noch aus. Auch die ausdrücklich optionalen Wächter-Aktionssymbole sind noch offen.
