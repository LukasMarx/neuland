/**
 * Vorgeladene Aufnahmen: Im Leerlauf geholt und als Blob-URL gehalten, damit eine Ansage sofort kommt und
 * nicht erst über das Netz muss. Was (noch) nicht geladen ist, spielt einfach von der normalen Adresse.
 */
const loaded = new Map<string, string>();
const queued = new Set<string>();
const PARALLEL = 2;

/** Die vorgeladene Fassung einer Adresse, sonst die Adresse selbst. */
export function cachedUrl(url: string): string {
  return loaded.get(url) ?? url;
}

/** Lädt die Adressen nach und nach im Leerlauf; bei „Datensparen“ gar nicht. */
export function preload(urls: string[]): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const todo = urls.filter((u) => !loaded.has(u) && !queued.has(u));
  if (!todo.length) return;
  todo.forEach((u) => queued.add(u));
  const next = async (): Promise<void> => {
    const url = todo.shift();
    if (!url) return;
    try {
      const response = await fetch(url);
      if (response.ok) loaded.set(url, URL.createObjectURL(await response.blob()));
    } catch {
      // Dann eben beim ersten Abspielen über das Netz.
    }
    queued.delete(url);
    await idle();
    return next();
  };
  void idle().then(() => {
    for (let i = 0; i < PARALLEL; i++) void next();
  });
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 50);
  });
}
