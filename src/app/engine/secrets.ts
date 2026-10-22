import { bankSize, getTopology } from './board';
import { shuffle, RngState } from './rng';
import { DEV_DECK, humanCount } from './rules';
import { FISH_POOL } from './variants';
import { DevCard, emptyResources, GameState, HiddenCounts, Resource, RESOURCES, ResourceCounts, totalResources, Transfer } from './types';

/**
 * Verdeckte Informationen (docs/ERWEITUNGEN.md, Abschnitt 4, Maßnahme B): Der Host hält den vollen Stand
 * und schickt jedem Spieler nur dessen Sicht. Geht der Host verloren, baut der neue Host den vollen Stand
 * aus seiner Sicht und den Geheimnissen der Mitspieler wieder auf.
 */

/** Was nur ein Spieler selbst weiß: seine Karten und Fische. */
export interface Secret {
  resources: ResourceCounts;
  devCards: DevCard[];
  newDevCards: DevCard[];
  fish: number[];
}

/** Sicht eines Sitzes (-1 = Zuschauer): fremde Karten nur als Anzahl, Stapelinhalte unbekannt. Am Ende sieht jeder alles. */
export function viewFor(s: GameState, seat: number): GameState {
  if (s.phase.kind === 'ended') return s;
  const v = structuredClone(s);
  v.view = seat;
  v.players.forEach((p, i) => {
    if (i === seat || p.neutral || p.hidden) return;
    p.hidden = { cards: totalResources(p.resources), dev: p.devCards.length + p.newDevCards.length, fish: v.fish?.[i].length ?? 0 };
    p.resources = emptyResources();
    p.devCards = [];
    p.newDevCards = [];
    if (v.fish) v.fish[i] = [];
  });
  if (v.hiddenDeck === undefined) {
    v.hiddenDeck = v.devDeck.length;
    v.devDeck = [];
  }
  if (v.fishPool) v.fishPool = {};
  // Welche Karte der Räuber gezogen hat, sehen nur Geber und Nehmer.
  v.transfers = v.transfers.map((t) => (t.hidden && !involves(t, seat) ? { ...t, card: 'wood' } : t));
  return v;
}

function involves(t: Transfer, seat: number): boolean {
  return (t.from.kind === 'player' && t.from.seat === seat) || (t.to.kind === 'player' && t.to.seat === seat);
}

export function isView(s: GameState): boolean {
  return s.view !== undefined;
}

/** Die eigenen Karten aus einem Stand oder einer Sicht. */
export function secretOf(s: GameState, seat: number): Secret | null {
  const p = s.players[seat];
  if (!p || p.hidden) return null;
  return { resources: { ...p.resources }, devCards: [...p.devCards], newDevCards: [...p.newDevCards], fish: [...(s.fish?.[seat] ?? [])] };
}

/**
 * Baut aus einer Sicht und den gemeldeten Geheimnissen wieder einen vollen Stand. Ein Geheimnis zählt nur,
 * wenn es zu den öffentlichen Anzahlen passt und die Karten darin noch zu haben sind (ein Spieler aus einem
 * verworfenen Spielverlauf kann eine Hand melden, deren Anzahl stimmt, deren Karten aber nicht). Die
 * Reihenfolge der Geheimnisse ist ihr Vorrang. Für wen keines passt, teilt der Zufall aus dem Rest aus, was
 * fehlt: Rohstoffe aus Vorrat minus Bank minus bekannte Hände, Entwicklungskarten und Fische ebenso.
 * Geliefert wird auch, welche Sitze so neu ausgeteilt wurden.
 */
export function rebuild(view: GameState, secrets: ReadonlyMap<number, Secret>, rng: RngState): { state: GameState; dealt: number[] } {
  const s = structuredClone(view);
  delete s.view;
  for (const [seat, secret] of secrets) {
    const p = s.players[seat];
    if (!p?.hidden || !fits(secret, p.hidden) || !available(s, secret)) continue;
    p.resources = pick(secret.resources);
    p.devCards = [...secret.devCards];
    p.newDevCards = [...secret.newDevCards];
    if (s.fish) s.fish[seat] = [...secret.fish];
    delete p.hidden;
  }
  const missing = s.players.flatMap((p, seat) => (p.hidden ? [{ seat, counts: p.hidden }] : []));

  // Rohstoffe: Was weder in der Bank noch in bekannten Händen liegt, verteilt sich auf die Fehlenden.
  const left = remaining(s);
  const unknownCards = shuffle(rng, RESOURCES.flatMap((r) => Array<Resource>(Math.max(0, left.resources[r])).fill(r)));
  // Entwicklungskarten: Was übrig ist, liegt im Stapel oder bei den Fehlenden.
  const unknownDev = shuffle(rng, (Object.keys(left.dev) as DevCard[]).flatMap((c) => Array<DevCard>(Math.max(0, left.dev[c])).fill(c)));
  // Fische: Stapel minus bekannte Plättchen; der Anker liegt beim Inhaber oder im Stapel.
  let unknownFish: number[] = [];
  if (s.fish) {
    unknownFish = shuffle(rng, [1, 2, 3].flatMap((k) => Array<number>(Math.max(0, left.fish[k] ?? 0)).fill(k)));
    s.fishPool = { anchor: s.anchor != null ? 0 : 1 };
  }

  for (const { seat, counts } of missing) {
    const p = s.players[seat];
    p.resources = emptyResources();
    for (const r of unknownCards.splice(0, counts.cards)) p.resources[r]++;
    p.devCards = unknownDev.splice(0, counts.dev);
    p.newDevCards = [];
    if (s.fish) s.fish[seat] = unknownFish.splice(0, counts.fish);
    delete p.hidden;
  }
  // Was übrig bleibt, ist der Stapel; bei alten Ständen ohne Liste notfalls auf die bekannte Größe gekürzt.
  if (s.hiddenDeck !== undefined) {
    s.devDeck = unknownDev.slice(0, s.hiddenDeck);
    delete s.hiddenDeck;
  }
  if (s.fish) {
    for (const t of unknownFish) s.fishPool![t] = (s.fishPool![t] ?? 0) + 1;
  }
  return { state: s, dealt: missing.map((m) => m.seat) };
}

/** Geht der volle Stand auf? Je Rohstoff Bank plus alle Hände gleich dem Anfangsvorrat. */
export function isConsistent(s: GameState): boolean {
  if (s.supply === undefined) return true;
  return RESOURCES.every((r) => s.bank[r] + s.players.reduce((n, p) => n + p.resources[r], 0) === s.supply);
}

/** Was noch nicht in Bank, bekannten Händen, Ablage oder (bei Fischen) beim Ankerinhaber liegt. */
function remaining(s: GameState): { resources: Record<Resource, number>; dev: Record<DevCard, number>; fish: Record<number, number> } {
  const supply = s.supply ?? bankSize(getTopology(s.board).hexes.filter((h) => !h.sea).length);
  const known = s.players.filter((p) => !p.hidden);
  const resources = Object.fromEntries(
    RESOURCES.map((r) => [r, supply - s.bank[r] - known.reduce((n, p) => n + p.resources[r], 0)]),
  ) as Record<Resource, number>;
  const dev: Record<DevCard, number> = { ...DEV_DECK[humanCount(s) > 4 ? 'ext' : 'base'] };
  for (const c of [...(s.playedDev ?? []), ...known.flatMap((p) => [...p.devCards, ...p.newDevCards])]) dev[c]--;
  // Ohne Liste der ausgespielten Karten (alte Spielstände) zählen wenigstens die Ritter.
  if (!s.playedDev) for (const p of s.players) dev.knight -= p.knights;
  const fish: Record<number, number> = { 1: FISH_POOL[1], 2: FISH_POOL[2], 3: FISH_POOL[3] };
  s.fish?.forEach((tokens, seat) => {
    if (!s.players[seat].hidden) for (const t of tokens) fish[t]--;
  });
  return { resources, dev, fish };
}

/** Sind die Karten dieses Geheimnisses noch zu haben? */
function available(s: GameState, secret: Secret): boolean {
  const left = remaining(s);
  const need = (counts: Record<string, number>, items: (string | number)[]) =>
    items.every((x) => (counts[x] = (counts[x] ?? 0) - 1) >= 0);
  return (
    RESOURCES.every((r) => secret.resources[r] <= left.resources[r]) &&
    need(left.dev, [...secret.devCards, ...secret.newDevCards]) &&
    need(left.fish, secret.fish)
  );
}

function fits(secret: Secret, counts: HiddenCounts): boolean {
  return (
    RESOURCES.every((r) => Number.isInteger(secret.resources?.[r]) && secret.resources[r] >= 0) &&
    totalResources(secret.resources) === counts.cards &&
    (secret.devCards?.length ?? 0) + (secret.newDevCards?.length ?? 0) === counts.dev &&
    (secret.fish?.length ?? 0) === counts.fish &&
    (secret.fish ?? []).every((t) => t === 1 || t === 2 || t === 3)
  );
}

function pick(r: ResourceCounts): ResourceCounts {
  const out = emptyResources();
  for (const k of RESOURCES) out[k] = r[k];
  return out;
}
