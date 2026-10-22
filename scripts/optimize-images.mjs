// Erzeugt verkleinerte Web-Fassungen der Grafiken: node scripts/optimize-images.mjs
//
// Die Originale bleiben unverändert in public/ (dort schreiben auch die Asset-Skripte hin)
// und werden nicht mit ausgeliefert, siehe "ignore" in angular.json. Die App lädt nur die
// Fassungen aus public/web/. Ziel ist jeweils etwa die doppelte Anzeigegröße, damit es
// auf Retina-Bildschirmen scharf bleibt. Benötigt sips (macOS).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pub = join(root, 'public');

/**
 * Quellordner, längste Kante in Pixeln und Zielformat. Deckende Bilder als JPEG, transparente als PNG.
 * `out` legt eine zweite Fassung desselben Ordners an, z. B. große Karten für die Kartenansicht.
 */
const GROUPS = [
  { dir: 'cards/symbolstark', size: 384, format: 'jpeg' },
  { dir: 'cards/symbolstark', out: 'cards-large/symbolstark', size: 900, format: 'jpeg' },
  { dir: 'tiles/papiercollage', size: 384, format: 'png', except: { 'ocean.png': { size: 1024, format: 'jpeg' } } },
  { dir: 'icons/resources', size: 96, format: 'png' },
  { dir: 'pieces/papiercollage', size: 160, format: 'png' },
  // Motive der Ereignis-Banner werden mit etwa 80 bis 140 px Höhe gezeigt.
  { dir: 'banner/papiercollage', size: 280, format: 'png' },
  { dir: 'pieces/papiercollage-organic-v2', size: 160, format: 'png' },
];

const sources = new Set();
let before = 0;
let after = 0;
for (const group of GROUPS) {
  const outDir = join(pub, 'web', group.out ?? group.dir);
  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(join(pub, group.dir)).filter((f) => f.endsWith('.png'))) {
    const { size, format } = group.except?.[file] ?? group;
    const src = join(pub, group.dir, file);
    const out = join(outDir, basename(file, extname(file)) + (format === 'jpeg' ? '.jpg' : '.png'));
    const args = ['-Z', String(size), '-s', 'format', format];
    if (format === 'jpeg') args.push('-s', 'formatOptions', '82');
    execFileSync('sips', [...args, src, '--out', out], { stdio: 'ignore' });
    if (!sources.has(src)) before += statSync(src).size;
    sources.add(src);
    after += statSync(out).size;
  }
}
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`Web-Fassungen in public/web/: ${mb(before)} → ${mb(after)}`);
