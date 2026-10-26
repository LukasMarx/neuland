# Seewege-Szenarien und Kamelzüge – Figuren

Erzeugt am 25.10.2026 über die OpenAI-Batch-API mit `gpt-image-2.5-flare` (`/v1/images/edits`, 1024 × 1024, Qualität medium, transparent, ein Bild je Motiv). Auftrag mit Stilsatz, Prompts und Stilreferenzen: `auftrag.json`. Batch-ID: `batch.json`, Token je Bild: `usage.json`.

| Motiv | Datei | Verwendung |
|---|---|---|
| Festung | `public/pieces/papiercollage/fortress.png` | Freibeuterbuchten; Fahne und Mauerzahl in Spielerfarbe zeichnet das Brett darüber |
| Dorf | `public/pieces/papiercollage/village.png` | Stoffhandel, mit Zahl und Ballenvorrat |
| Hütten | `public/pieces/papiercollage/tribe-hut.png` | Die Verschollenen, auf jedem Feld der bewohnten Inseln |
| Oase | `public/pieces/papiercollage/oasis.png` | Kamelzüge |
| Kamel | `public/pieces/papiercollage/camel.png` | Kamelzüge, je Kamel auf seiner Kante |

Rohbilder liegen unter `sources/`. Die Modelle legen einen weichen halbtransparenten Schein ums Motiv; `scripts/trim-glow.py` schneidet ihn weg, beschneidet auf das Motiv und setzt es auf 512 × 512 (wie die übrigen Figuren). Web-Fassungen danach mit `node scripts/optimize-images.mjs pieces/papiercollage/<name>.png`.

Kosten (Tokenpreise GPT Image 2.5, Batch 50 % günstiger): 8192 Eingabe-Bildtoken, 1172 Text-Token und 2195 Ausgabe-Bildtoken, zusammen etwa 0,14 $ ohne und etwa 0,07 $ mit Batch-Rabatt.

Neu erzeugen: `node scripts/openai-batch-images.mjs submit|status|fetch output/designs/szenarien-2026-10-25/auftrag.json` (vorher `batch.json` löschen). Der Schlüssel kommt aus `OPENAI_API_KEY` oder `.env.local`.
