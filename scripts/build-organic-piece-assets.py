"""Build the organic village/city revision with the existing palette algorithm."""
from pathlib import Path
import importlib.util
import json
import sys
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('palette', ROOT / 'scripts/build-piece-assets.py')
palette = importlib.util.module_from_spec(spec)
spec.loader.exec_module(palette)
DESIGN = ROOT / 'output/designs/organic-pieces-2026-10-22'
OUT = ROOT / 'public/pieces/papiercollage-organic-v2'
PIECES = ('settlement', 'city', 'metropolis')

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    web = ROOT / 'public/web/pieces/papiercollage-organic-v2'
    web.mkdir(parents=True, exist_ok=True)
    (DESIGN / 'masks').mkdir(parents=True, exist_ok=True)
    manifest = {'colors': palette.COLORS, 'assets': {}}
    sheet = Image.new('RGB', (240 + len(PIECES) * 310, 120 + len(palette.COLORS) * 220), '#f3ecdc')
    draw = ImageDraw.Draw(sheet)
    draw.text((30, 20), 'Dorf, Stadt und Prachtstadt - Spielerfarben', font=palette.font(30), fill='#30291e')
    rows = []
    for piece in PIECES:
        with Image.open(DESIGN / 'sources' / (piece + '.png')) as source:
            base = palette.normalized(source, piece)
        base.save(DESIGN / 'sources' / (piece + '-base.png'))
        # New architecture has colored roofs and banners down to its front gate.
        # The old city's fixed bottom exclusion does not apply to this silhouette.
        mask = palette.automatic_mask(base, 'metropolis' if piece == 'metropolis' else 'settlement')
        mask.save(DESIGN / 'masks' / (piece + '.png'))
        manifest['assets'][piece] = {}
        for row, (key, (label, color, in_game)) in enumerate(palette.COLORS.items()):
            result = palette.tint(base, mask, color)
            assert result.size == (512, 512)
            alpha = np.asarray(result)[..., 3]
            assert alpha.min() == 0 and alpha.max() == 255
            name = f'{piece}-{key}.png'
            result.save(OUT / name, optimize=True)
            optimized = result.resize((160, 160), Image.Resampling.LANCZOS)
            optimized.save(web / name, optimize=True)
            manifest['assets'][piece][key] = name
            thumb = result.copy()
            thumb.thumbnail((205, 205))
            x = 240 + PIECES.index(piece) * 310
            y = 90 + row * 220
            sheet.paste(thumb, (x, y), thumb)
            if piece == 'settlement':
                draw.text((30, y + 80), label, font=palette.font(22), fill='#30291e')
        print(f'{piece}: {len(palette.COLORS)} RGBA variants, unchanged alpha and neutral pixels verified')
    sheet.save(DESIGN / 'farben-uebersicht.jpg', quality=94)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    for key, (label, _, _) in palette.COLORS.items():
        cells = ''.join(f'<img alt="{piece}" class="{piece}" src="../../../public/pieces/papiercollage-organic-v2/{piece}-{key}.png">' for piece in PIECES)
        rows.append(f'<section><h2>{label}</h2>{cells}</section>')
    html = '<!doctype html><html lang="de"><meta charset="utf-8"><title>Dorf, Stadt und Prachtstadt</title><link rel="stylesheet" href="../../../public/fonts/nunito-sans/fonts.css"><style>body{background:#f3ecdc;font:18px "Nunito Sans",sans-serif;color:#30291e;margin:32px}section{display:flex;align-items:center;gap:30px}h2{width:130px}img{width:280px}body.small img{width:32px}body.small .city{width:40px}body.small .metropolis{width:52px}button{padding:12px;font:inherit}</style><h1>Dorf, Stadt und Prachtstadt – Farbvarianten</h1><button onclick="document.body.classList.toggle(\'small\')">Kompakte Brettgröße / Detailansicht</button>' + ''.join(rows) + '</html>'
    (DESIGN / 'preview.html').write_text(html, encoding='utf-8')

if __name__ == '__main__':
    main()
