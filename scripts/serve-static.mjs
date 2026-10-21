// Minimaler statischer Server für Design-Mockups: node scripts/serve-static.mjs [port]
// Liefert das Projektverzeichnis aus, damit Mockups in output/designs/ die Grafiken aus public/ nutzen können.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.argv[2] ?? 4310);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    statSync(file);
  } catch {
    return res.writeHead(404).end('Nicht gefunden');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Design-Server: http://127.0.0.1:${port}/output/designs/`));
