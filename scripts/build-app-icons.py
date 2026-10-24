"""
Zeichnet das Neuland-Sechseck (wie das Favicon) als App-Icons, ohne Fremdpakete.
Aufruf: python3 scripts/build-app-icons.py public/app-icons
"""
import math, struct, sys, zlib

BG = (0x12, 0x1C, 0x24)
FILL = (0xE8, 0xC5, 0x47)
STROKE = (0x7B, 0x4A, 0x2A)

def hexagon(cx, cy, r):
    # Spitze oben, wie im Favicon (50,4 90,27 ...).
    return [(cx + r * math.sin(math.radians(a)), cy - r * math.cos(math.radians(a))) for a in range(0, 360, 60)]

def inside(poly, x, y):
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def render(size, scale, background):
    """scale: Radius des Sechsecks relativ zur halben Kantenlänge des Bildes."""
    ss = 4
    cx = cy = size / 2
    r_out = size / 2 * scale
    stroke = r_out * 0.12
    outer = hexagon(cx, cy, r_out)
    inner = hexagon(cx, cy, r_out - stroke)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    px = x + (sx + 0.5) / ss
                    py = y + (sy + 0.5) / ss
                    if inside(inner, px, py):
                        col, a = FILL, 1.0
                    elif inside(outer, px, py):
                        col, a = STROKE, 1.0
                    elif background:
                        col, a = BG, 1.0
                    else:
                        col, a = (0, 0, 0), 0.0
                    acc[0] += col[0] * a
                    acc[1] += col[1] * a
                    acc[2] += col[2] * a
                    acc[3] += a
            n = ss * ss
            alpha = acc[3] / n
            if alpha > 0:
                row += bytes([round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(alpha * 255)])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

out = sys.argv[1]
for name, size, scale, bg in [
    ('icon-192.png', 192, 0.92, False),
    ('icon-512.png', 512, 0.92, False),
    # Android schneidet maskable Icons bis auf einen Kreis von 80 % zu: Sechseck klein genug in der Mitte.
    ('icon-maskable-512.png', 512, 0.62, True),
    ('apple-touch-icon.png', 180, 0.74, True),
]:
    with open(f'{out}/{name}', 'wb') as f:
        f.write(render(size, scale, bg))
    print(name)
