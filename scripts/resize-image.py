"""Portable size-only export for optimize-images.mjs. Requires Pillow."""
import sys
from PIL import Image


def main():
    source, destination, edge, file_format = sys.argv[1:]
    with Image.open(source) as image:
        image = image.convert("RGB" if file_format == "jpeg" else "RGBA")
        image.thumbnail((int(edge), int(edge)), Image.Resampling.LANCZOS)
        options = {"quality": 82} if file_format == "jpeg" else {"optimize": True}
        image.save(destination, format=file_format.upper(), **options)


if __name__ == "__main__":
    main()
