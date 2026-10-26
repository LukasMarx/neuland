"""Räumt erzeugte Figuren auf: weicher Schein und Schlagschatten rund ums Motiv fallen weg, das Motiv wird
auf seinen Umriss zugeschnitten und mittig auf ein quadratisches Feld mit Rand gesetzt.

    python scripts/trim-glow.py <quelle.png> <ziel.png> [kante=512]

Als Motiv gilt, was fast deckend ist (Alpha ab 230), ein paar Pixel aufgeweitet; Löcher darin werden
gefüllt. Außerhalb davon wird alles transparent, die Kante bekommt einen schmalen weichen Übergang.
Braucht Pillow und NumPy (z. B. uv run --with pillow --with numpy python scripts/trim-glow.py …).
"""

import sys

import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
edge = int(sys.argv[3]) if len(sys.argv) > 3 else 512

image = Image.open(src).convert('RGBA')
alpha = np.array(image)[:, :, 3]
solid = Image.fromarray(((alpha >= 230) * 255).astype(np.uint8))
# Aufweiten (Kante behalten), Löcher schließen, dann eine schmale weiche Kante.
mask = solid.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
keep = np.minimum(alpha.astype(np.float32), np.array(mask, dtype=np.float32))
pixels = np.array(image)
pixels[:, :, 3] = keep.astype(np.uint8)
cleaned = Image.fromarray(pixels)

box = cleaned.getbbox()
cleaned = cleaned.crop(box)
# Motiv füllt etwa 88 % der längeren Kante, wie die übrigen Figuren.
side = int(max(cleaned.size) / 0.88)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(cleaned, ((side - cleaned.width) // 2, (side - cleaned.height) // 2))
canvas.resize((edge, edge), Image.LANCZOS).save(out)
print(f'{out}: Motiv {box[2] - box[0]}×{box[3] - box[1]} → {edge}×{edge}')
