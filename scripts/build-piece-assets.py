"""Build Neuland paper-piece palettes. Requires Pillow and NumPy.
Run: python scripts/build-piece-assets.py
Existing masks are preserved for hand refinement. Use --refresh-masks only to
recreate them after deliberately changing a source image.
"""
from pathlib import Path
import argparse
import colorsys
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "output/designs/pieces-2026-10-21"
OUT = ROOT / "public/pieces/papiercollage"
PIECES = {"knight": "Ritter", "city": "Stadt", "road": "Straße", "settlement": "Dorf", "ship": "Schiff",
          "bridge": "Brücke", "guard1": "Wächter I", "guard2": "Wächter II", "guard3": "Wächter III", "trader": "Händler"}
COLORS = {
    "red": ("Rot", "#d23c3c", True),
    "blue": ("Blau", "#2f64d6", True),
    "gold": ("Goldgelb", "#d5a824", False),
    "purple": ("Violett", "#8152b3", False),
    "white": ("Weiß", "#f4f1e8", True),
    "orange": ("Orange", "#ee8a1c", True),
    "green": ("Grün", "#2f9a48", True),
    # Seit 23.10.2026 statt Braun und Goldgelb in der Lobby; die alten bleiben für gespeicherte Spiele.
    "black": ("Schwarz", "#2e2b2f", True),
    "pink": ("Pink", "#e0569f", False),
    "brown": ("Braun", "#7b4a2a", False),
    "grey-light": ("Hellgrau", "#9aa1a8", False),
    "grey-dark": ("Dunkelgrau", "#5d646c", False),
}

def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)

def normalized(source, piece):
    rgba = source.convert("RGBA")
    # Ignore nearly invisible generation noise when finding the occupied area.
    bounds = rgba.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    if not bounds:
        raise ValueError(f"Empty source: {piece}")
    rgba = rgba.crop(bounds)
    size = (512, 128) if piece in ("road", "bridge") else (512, 256) if piece == "ship" else (256, 256) if piece == "trader" else (512, 512)
    rgba.thumbnail((size[0] - 32, size[1] - 32), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size)
    result.alpha_composite(rgba, ((size[0] - rgba.width) // 2, (size[1] - rgba.height) // 2))
    return result

def automatic_mask(base, piece):
    hsv = np.asarray(base.convert("RGB").convert("HSV"), dtype=np.float32)
    hue = hsv[..., 0] * 360 / 255
    saturation = hsv[..., 1] / 255
    distance = np.minimum(hue, 360 - hue)
    # Only saturated terracotta: stone, cream, brass and green foliage are excluded.
    weight = (1 - smooth(20, 29, distance)) * smooth(0.23, 0.42, saturation)
    if piece in ("ship", "bridge", "guard1", "guard2", "guard3", "metropolis", "trader"):
        # The overhead deck exposes warm brown wood. Select only the saturated
        # red hull; the broad architectural mask would also tint mast/hatches.
        weight = (1 - smooth(6, 12, distance)) * smooth(0.40, 0.60, saturation)
    weight[np.asarray(base)[..., 3] == 0] = 0
    if piece == "city":
        # The front gate is warm wood, not a player-color surface.
        weight[int(base.height * 0.83):, :] = 0
    return Image.fromarray(np.rint(weight * 255).astype(np.uint8))

def tint(base, mask, color):
    pixels = np.asarray(base, dtype=np.uint8)
    rgb = pixels[..., :3].astype(np.float32) / 255
    weight = np.asarray(mask, dtype=np.float32) / 255
    active = (weight > 0.95) & (pixels[..., 3] > 240)
    if np.count_nonzero(active) < 50:
        raise ValueError("Mask has insufficient player-color area")
    light = (rgb.max(axis=2) + rgb.min(axis=2)) / 2
    middle = float(np.median(light[active]))
    target_rgb = tuple(int(color[i:i+2], 16) / 255 for i in (1, 3, 5))
    hue, target_light, saturation = colorsys.rgb_to_hls(*target_rgb)
    # A shaded white paper surface must retain headroom for highlights.
    target_light = min(target_light, 0.83)
    mapped = np.where(
        light <= middle,
        light / max(middle, 0.001) * target_light,
        target_light + (light - middle) / max(1 - middle, 0.001) * (1 - target_light),
    )
    chroma = (1 - np.abs(2 * mapped - 1)) * saturation
    x = chroma * (1 - abs((hue * 6) % 2 - 1))
    zero = np.zeros_like(chroma)
    sectors = [(chroma, x, zero), (x, chroma, zero), (zero, chroma, x),
               (zero, x, chroma), (x, zero, chroma), (chroma, zero, x)]
    colored = np.stack(sectors[int(hue * 6) % 6], axis=2) + (mapped - chroma / 2)[..., None]
    result = pixels.copy()
    result[..., :3] = np.rint(np.clip(
        rgb * (1 - weight[..., None]) + colored * weight[..., None], 0, 1
    ) * 255).astype(np.uint8)
    # Alpha is copied verbatim; unmasked colors must remain pixel-identical.
    assert np.array_equal(result[..., 3], pixels[..., 3])
    assert np.array_equal(result[weight == 0], pixels[weight == 0])
    return Image.fromarray(result)

def font(size):
    for name in ("C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-masks", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    (DESIGN / "masks").mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "style": "papiercollage", "colors": [], "pieces": {}, "assets": {}}
    for key, (label, hex_color, in_game) in COLORS.items():
        manifest["colors"].append({"id": key, "label": label, "hex": hex_color, "inGame": in_game})
    for piece, label in PIECES.items():
        with Image.open(DESIGN / "sources" / f"{piece}.png") as source:
            base = normalized(source, piece)
        base.save(DESIGN / "sources" / f"{piece}-base.png")
        if piece == "trader":
            # Uncolored base requested by the artwork brief, alongside palettes.
            base.save(OUT / "trader.png", optimize=True)
        mask_path = DESIGN / "masks" / f"{piece}.png"
        if args.refresh_masks or not mask_path.exists():
            automatic_mask(base, piece).save(mask_path)
        with Image.open(mask_path) as im:
            mask = im.convert("L")
        if mask.size != base.size:
            raise ValueError(f"Mask size mismatch: {mask_path}. Refresh or adjust the mask.")
        manifest["pieces"][piece] = {
            "label": label, "width": base.width, "height": base.height,
            "anchor": [0.5, 0.5], "recommendedBoardWidth": 44 if piece in ("road", "bridge") else 40 if piece == "city" else 24 if piece.startswith("guard") else 30 if piece == "trader" else 32,
        }
        manifest["assets"][piece] = {}
        for key, (_, hex_color, _) in COLORS.items():
            result = tint(base, mask, hex_color)
            filename = f"{piece}-{key}.png"
            result.save(OUT / filename, optimize=True)
            manifest["assets"][piece][key] = f"pieces/papiercollage/{filename}"
        alpha = np.asarray(base)[..., 3]
        assert alpha.min() == 0 and alpha.max() == 255
        coverage = float(np.count_nonzero(np.asarray(mask) > 128) / max(1, np.count_nonzero(alpha)))
        print(f"{piece}: {base.width}x{base.height}, mask {coverage:.0%}, {len(COLORS)} variants")
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    template = (DESIGN / "preview.template.html").read_text(encoding="utf-8-sig")
    (DESIGN / "preview.html").write_text(template.replace("__MANIFEST__", json.dumps(manifest, ensure_ascii=False)), encoding="utf-8")
    # Compact visual inspection artifact; compositing is part of this asset build.
    sheet = Image.new("RGB", (200 + len(PIECES) * 230, 130 + len(COLORS) * 192), "#f3ecdc")
    draw = ImageDraw.Draw(sheet)
    draw.text((32, 20), "Neuland · Papierfiguren in Spielerfarben", font=font(28), fill="#2b2418")
    for col, label in enumerate(PIECES.values()):
        draw.text((190 + col * 230, 70), label, font=font(20), fill="#2b2418")
    for row, (color, (label, hex_color, _)) in enumerate(COLORS.items()):
        y = 110 + row * 192
        draw.ellipse((24, y + 65, 44, y + 85), fill=hex_color, outline="#6f6148")
        draw.text((52, y + 64), label, font=font(16), fill="#2b2418")
        for col, piece in enumerate(PIECES):
            with Image.open(OUT / f"{piece}-{color}.png") as im:
                sprite = im.convert("RGBA")
                sprite.thumbnail((180, 170), Image.Resampling.LANCZOS)
                sheet.paste(sprite, (170 + col * 230 + (180 - sprite.width)//2, y + (170 - sprite.height)//2), sprite)
    sheet.save(DESIGN / "farben-uebersicht.jpg", quality=92)
    count = sum(len(variants) for variants in manifest["assets"].values())
    print(f"Validated {count} assets: alpha unchanged, unmasked pixels unchanged.")

if __name__ == "__main__":
    main()
