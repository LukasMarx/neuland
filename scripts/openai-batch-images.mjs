// Grafiken über die OpenAI-Batch-API erzeugen (halber Preis, Ergebnis meist binnen Minuten, spätestens 24 h).
//
//   node scripts/openai-batch-images.mjs submit output/designs/<ordner>/auftrag.json
//   node scripts/openai-batch-images.mjs status output/designs/<ordner>/auftrag.json
//   node scripts/openai-batch-images.mjs fetch  output/designs/<ordner>/auftrag.json
//
// Der Auftrag nennt Modell, Größe, Qualität, einen gemeinsamen Stilsatz und je Bild Prompt, Zielpfad und
// bestehende Assets als Stilreferenz. Referenzen gehen verkleinert (512 px) als Daten-URL mit, das spart
// Eingabe-Token. `submit` merkt sich die Batch-ID in batch.json neben dem Auftrag; `fetch` legt die Bilder
// unter sources/ ab und kopiert sie an ihren Zielpfad in public/. Danach: node scripts/optimize-images.mjs.
//
// Der Schlüssel kommt aus OPENAI_API_KEY oder aus .env.local im Projekt (nicht im Repository).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [command, specPath] = process.argv.slice(2);
if (!['submit', 'status', 'fetch'].includes(command) || !specPath) {
  console.error('Aufruf: node scripts/openai-batch-images.mjs submit|status|fetch <auftrag.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const dir = dirname(resolve(specPath));
const statePath = join(dir, 'batch.json');

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const env = join(root, '.env.local');
  const line = existsSync(env) && readFileSync(env, 'utf8').split('\n').find((l) => l.startsWith('OPENAI_API_KEY='));
  if (line) return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  throw new Error('Kein OPENAI_API_KEY (Umgebung oder .env.local).');
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.openai.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey()}`, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res;
}

/** Referenz verkleinert auf 512 px als Daten-URL (macOS: sips, sonst Python mit Pillow). */
function reference(path) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'neuland-ref-')), 'ref.png');
  const src = join(root, path);
  if (process.platform === 'darwin') execFileSync('sips', ['-Z', '512', src, '--out', tmp], { stdio: 'ignore' });
  else execFileSync(process.env.NEULAND_PYTHON ?? 'python3', ['-c', `from PIL import Image; i=Image.open(${JSON.stringify(src)}); i.thumbnail((512,512)); i.save(${JSON.stringify(tmp)})`]);
  return `data:image/png;base64,${readFileSync(tmp).toString('base64')}`;
}

async function submit() {
  if (existsSync(statePath)) throw new Error(`Schon eingereicht, siehe ${statePath}.`);
  const lines = spec.assets.map((a) =>
    JSON.stringify({
      custom_id: a.name,
      method: 'POST',
      url: '/v1/images/edits',
      body: {
        model: spec.model,
        prompt: `${spec.style} ${a.prompt}`,
        images: a.references.map((r) => ({ image_url: reference(r) })),
        background: 'transparent',
        output_format: 'png',
        size: spec.size,
        quality: spec.quality,
        n: 1,
      },
    }),
  );
  const form = new FormData();
  form.append('purpose', 'batch');
  form.append('file', new Blob([lines.join('\n')], { type: 'application/jsonl' }), 'auftrag.jsonl');
  const file = await (await api('/files', { method: 'POST', body: form })).json();
  const batch = await (
    await api('/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_file_id: file.id, endpoint: '/v1/images/edits', completion_window: '24h', metadata: { project: 'neuland' } }),
    })
  ).json();
  writeFileSync(statePath, JSON.stringify({ id: batch.id, input_file_id: file.id, submitted: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Eingereicht: ${batch.id} (${lines.length} Bilder), Status ${batch.status}`);
}

async function status() {
  const { id } = JSON.parse(readFileSync(statePath, 'utf8'));
  const batch = await (await api(`/batches/${id}`)).json();
  console.log(`${batch.id}: ${batch.status} · fertig ${batch.request_counts?.completed ?? 0}/${batch.request_counts?.total ?? '?'} · Fehler ${batch.request_counts?.failed ?? 0}`);
  return batch;
}

async function fetchResults() {
  const batch = await status();
  if (batch.error_file_id) {
    const errors = await (await api(`/files/${batch.error_file_id}/content`)).text();
    for (const line of errors.trim().split('\n')) {
      const e = JSON.parse(line);
      console.error(`Fehler ${e.custom_id}: ${JSON.stringify(e.response?.body?.error ?? e.error)}`);
    }
  }
  if (!batch.output_file_id) return;
  const out = await (await api(`/files/${batch.output_file_id}/content`)).text();
  mkdirSync(join(dir, 'sources'), { recursive: true });
  const usage = {};
  for (const line of out.trim().split('\n')) {
    const r = JSON.parse(line);
    const asset = spec.assets.find((a) => a.name === r.custom_id);
    const data = r.response?.body?.data?.[0]?.b64_json;
    if (!asset || !data) {
      console.error(`Kein Bild für ${r.custom_id}: ${JSON.stringify(r.response?.body?.error ?? r.error)}`);
      continue;
    }
    const source = join(dir, 'sources', `${asset.name}.png`);
    writeFileSync(source, Buffer.from(data, 'base64'));
    mkdirSync(dirname(join(root, asset.path)), { recursive: true });
    copyFileSync(source, join(root, asset.path));
    usage[asset.name] = r.response.body.usage ?? null;
    console.log(`${asset.name} → ${asset.path}`);
  }
  writeFileSync(join(dir, 'usage.json'), JSON.stringify(usage, null, 2) + '\n');
}

await { submit, status, fetch: fetchResults }[command]();
