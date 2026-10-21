# Papiercollage – finale Hex-Grafiken

Gewähltes Design: 03 · Papiercollage. Erstellt am 21.10.2026 mit dem integrierten image_gen-Werkzeug anhand von output/designs/hex-2026-10-21/03-papiercollage.png.

Die sechs transparenten PNG-Dateien liegen unter public/tiles/papiercollage/ und sind in src/app/ui/board/tile-art.ts registriert. Die quadratische Bildfläche enthält seitliche Transparenz. Das bestehende SVG-Brett passt sie über preserveAspectRatio="xMidYMid slice" in sein Sechseck ein und zeichnet Rahmen und Zahlenchip darüber.

## Vollständige Prompts

### wood

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: FOREST / WALD. Match the upper-left tile of the reference: layered deep dark-green paper pine trees of varied height surrounding a soft moss and olive-green clearing. Paper bushes and a few small gray stones at the perimeter. Large readable trees, lush darker edges, quiet natural green center. Entire footprint filled with green forest ground.
```

### brick

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: CLAY HILLS / LEHM. Match the upper-middle tile of the reference: rust and terracotta cut-paper cliffs and rounded clay hills, visible strata made of layered warm orange paper, scattered angular red clay stones. A couple of muted olive shrubs near the edges. Keep a broad relatively flat red-earth clearing in the center. Clearly orange-red terrain, no manufactured bricks or buildings.
```

### sheep

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: PASTURE / WEIDE. Match the upper-right tile of the reference: light fresh green textured paper meadow with three small white cut-paper sheep at the outer left, upper right and lower right, dark heads and short dark legs, recognizable sheep, tiny paper tufts and sparse white wildflowers near edges. Sparse low bushes. Broad softly rolling empty grassy center. Meadow distinctly lighter than the forest tile.
```

### wheat

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: WHEAT FIELDS / ACKER. Match the lower-left tile of the reference: rich warm golden-yellow paper wheat fields in broad sweeping curved crop rows. Layered straw paper and a few larger ears of wheat near edges. Central region a quiet flat golden cut-stubble field, low texture; no crop bunches in the center. Warm harvest amber terrain clearly darker and more golden than pale desert sand.
```

### ore

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: MOUNTAINS / GEBIRGE. Match the lower-middle tile of the reference: slate gray and cool blue-gray angular layered paper mountain peaks concentrated around the perimeter, modest off-white paper snow caps, faceted gray stones near edges and a very few tiny dark green pines. Flat quiet gravel-gray valley at center. Mountains visibly sculpted from cut folded paper. No peak or big rock in center.
```

### desert

```text
Use case: stylized-concept. Asset type: production terrain sprite for the Neuland hex board game.
Input image 1: STYLE REFERENCE and selected visual design, not a sheet to reproduce.
Generate ONE SINGLE LARGE hexagonal terrain tile matching the paper-collage style of the reference image closely. Layered cut-paper landscape, tactile visible paper fibers, carefully cut organic shapes and subtle shallow shadows. Rich believable miniature terrain built of matte colored paper, consistent with the corresponding tile in the reference. No typography or contact sheet.
Framing is critical: square 1024 by 1024 canvas, transparent background. The tile's regular pointy-top hexagon touches the TOP and BOTTOM of the image exactly, with the top vertex at (512,0) and bottom at (512,1024). Other vertices (955,256), (955,768), (69,768), (69,256). Ground surface entirely fills this hexagon without holes, inset edge, frame, bevel or platform. Only the four outer corners and narrow side areas beyond the hexagon are truly transparent. No exterior cast shadow, no white background, no simulated checkerboard. Do not leave padding above or below. NO object extends beyond the hexagon.
Camera directly over the ground plane so the hexagonal footprint is a regular pointy-top hexagon, not flattened or rotated. Landscape features can have illustrated sculptural depth as in the reference. All lighting comes softly from upper left.
The central circular region with diameter 35% of the tile's width stays visually quiet and relatively flat for a number token to be rendered by the game. This center is continuous natural-colored terrain matching its surroundings, not an empty white or transparent circle, not a painted ring, not a token. Place recognizable features along the upper, side, and lower edge regions. No numbers, no labels, no text, no watermarks, no buildings, no roads. Match the selected reference's level of detail and subdued warm earth palette.
Subject: DESERT / WÜSTE. Match the lower-right tile of the reference: flowing pale beige and sand-colored cut-paper dunes arranged around a broad quiet sandy center, a few angular warm-gray paper stones at edges, one small green paper cactus on right edge. Subtle dune bands and paper grain, warm dry light, desert distinctly paler and less golden than the wheat tile. No oasis, no water.
```
