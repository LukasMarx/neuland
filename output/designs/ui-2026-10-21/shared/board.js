// Gemeinsames Beispielbrett für die UI-Mockups. Nutzt die echten Grafiken aus public/.
// Brett in Einheiten: Sechseck-Radius R = 60, Gesamtgröße 680 × 589.

export const ASSETS = '../../../public/';
const R = 60;
const W = Math.sqrt(3) * R;
const BOARD_W = 680;
const BOARD_H = 589;

const ROWS = [3, 4, 5, 4, 3];
const TERRAIN = [
  'ore', 'sheep', 'wood',
  'wheat', 'brick', 'sheep', 'brick',
  'wheat', 'wood', 'desert', 'wood', 'ore',
  'wood', 'ore', 'wheat', 'sheep',
  'brick', 'wheat', 'sheep',
];
const NUMBERS = [10, 2, 9, 12, 6, 4, 10, 9, 11, null, 3, 8, 8, 3, 4, 5, 5, 6, 11];

export const CARD = (kind) => `${ASSETS}cards/symbolstark/${kind}.png`;
export const PIECE = (kind, color) => `${ASSETS}pieces/papiercollage/${kind}-${color}.png`;
export const TILE = (terrain) => `${ASSETS}tiles/papiercollage/${terrain}.png`;

function hexCenters() {
  const list = [];
  ROWS.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      list.push({ x: BOARD_W / 2 + (i - (n - 1) / 2) * W, y: BOARD_H / 2 + (row - 2) * 1.5 * R });
    }
  });
  return list;
}

function corner(c, k) {
  const a = ((60 * k - 90) * Math.PI) / 180;
  return { x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) };
}

/** Beispielstand: Gebäude als [Feld, Ecke, Typ, Farbe], Straßen als [Feld, Kante, Farbe]. */
const BUILDINGS = [
  [4, 0, 'settlement', 'red'], [8, 2, 'city', 'red'], [13, 1, 'settlement', 'red'],
  [5, 3, 'settlement', 'blue'], [10, 0, 'city', 'blue'],
  [1, 4, 'settlement', 'orange'], [14, 2, 'settlement', 'orange'],
  [16, 1, 'settlement', 'white'], [11, 4, 'settlement', 'white'],
];
const ROADS = [
  [4, 0, 'red'], [4, 5, 'red'], [8, 1, 'red'], [13, 0, 'red'],
  [5, 2, 'blue'], [10, 5, 'blue'], [10, 0, 'blue'],
  [1, 3, 'orange'], [14, 1, 'orange'],
  [16, 0, 'white'], [11, 3, 'white'],
];
/** Häfen als [Feld, Kante, Motiv, Kurs]. */
const HARBORS = [
  [0, 5, 'back', '3:1'], [1, 0, 'wheat', '2:1'], [6, 0, 'back', '3:1'],
  [11, 1, 'ore', '2:1'], [18, 2, 'back', '3:1'], [17, 3, 'sheep', '2:1'],
  [12, 4, 'back', '3:1'], [7, 4, 'brick', '2:1'], [3, 5, 'wood', '2:1'],
];

/**
 * Zeichnet das Brett in `host`. Optionen:
 * - highlight: Zahl, deren Felder leuchten
 * - targets: Ecken-Markierungen als [Feld, Ecke]
 * - robber: Feldindex des Räubers
 */
export function renderBoard(host, { highlight = null, targets = [], robber = 9 } = {}) {
  const centers = hexCenters();
  const board = document.createElement('div');
  board.className = 'nl-board';
  board.style.width = `${BOARD_W}px`;
  board.style.height = `${BOARD_H}px`;

  const ocean = document.createElement('div');
  ocean.className = 'nl-ocean';
  ocean.style.backgroundImage = `url(${TILE('ocean')})`;
  board.append(ocean);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'nl-piers');
  svg.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);
  board.append(svg);

  for (const [h, k, motif, rate] of HARBORS) {
    const c = centers[h];
    const a = corner(c, k);
    const b = corner(c, (k + 1) % 6);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(mx - c.x, my - c.y);
    const px = mx + ((mx - c.x) / len) * 36;
    const py = my + ((my - c.y) / len) * 36;
    for (const p of [a, b]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      Object.entries({ x1: px, y1: py, x2: p.x, y2: p.y }).forEach(([k2, v]) => line.setAttribute(k2, v));
      svg.append(line);
    }
    const harbor = document.createElement('div');
    harbor.className = 'nl-harbor';
    harbor.style.left = `${px}px`;
    harbor.style.top = `${py}px`;
    harbor.innerHTML = `<img src="${CARD(motif)}" alt=""><span>${rate}</span>`;
    board.append(harbor);
  }

  centers.forEach((c, i) => {
    const tile = document.createElement('div');
    tile.className = 'nl-tile';
    if (highlight !== null && NUMBERS[i] === highlight) tile.classList.add('hit');
    tile.style.left = `${c.x - W / 2}px`;
    tile.style.top = `${c.y - R}px`;
    tile.style.backgroundImage = `url(${TILE(TERRAIN[i])})`;
    board.append(tile);

    const n = NUMBERS[i];
    if (n) {
      const token = document.createElement('div');
      token.className = 'nl-token' + (n === 6 || n === 8 ? ' red' : '') + (i === robber ? ' blocked' : '');
      token.style.left = `${c.x}px`;
      token.style.top = `${c.y + 3}px`;
      const pips = 6 - Math.abs(7 - n);
      token.innerHTML = `<b>${n}</b><i>${'•'.repeat(pips)}</i>`;
      board.append(token);
    }
    if (i === robber) {
      const r = document.createElement('div');
      r.className = 'nl-robber';
      r.style.left = `${c.x + 26}px`;
      r.style.top = `${c.y + 4}px`;
      board.append(r);
    }
  });

  for (const [h, k, color] of ROADS) {
    const c = centers[h];
    const a = corner(c, k);
    const b = corner(c, (k + 1) % 6);
    const road = document.createElement('img');
    road.className = 'nl-road';
    road.src = PIECE('road', color);
    road.style.left = `${(a.x + b.x) / 2}px`;
    road.style.top = `${(a.y + b.y) / 2}px`;
    road.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
    board.append(road);
  }

  for (const [h, k, type, color] of BUILDINGS) {
    const p = corner(centers[h], k);
    const img = document.createElement('img');
    img.className = `nl-building ${type}`;
    img.src = PIECE(type, color);
    img.style.left = `${p.x}px`;
    img.style.top = `${p.y}px`;
    board.append(img);
  }

  for (const [h, k] of targets) {
    const p = corner(centers[h], k);
    const t = document.createElement('div');
    t.className = 'nl-target';
    t.style.left = `${p.x}px`;
    t.style.top = `${p.y}px`;
    board.append(t);
  }

  host.append(board);
  fit(host, board);
}

/** Skaliert das Brett passend in seinen Container. */
function fit(host, board) {
  const resize = () => {
    const s = Math.min(host.clientWidth / BOARD_W, host.clientHeight / BOARD_H);
    board.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  new ResizeObserver(resize).observe(host);
  resize();
}
