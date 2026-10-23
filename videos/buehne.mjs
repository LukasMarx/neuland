// Gemeinsame Handgriffe der Erklärvideos auf der Bühne #/erklaer (src/app/ui/erklaer).
export const URL = "http://localhost:4330/#/erklaer";
export const TEILE = 8;

// Grafiken der App (public/web/…), für Folien.
export const bild = {
  feld: (n) => `web/tiles/papiercollage/${n}.png`,
  figur: (n) => `web/pieces/papiercollage/${n}.png`,
  gebaeude: (n) => `web/pieces/papiercollage-organic-v2/${n}.png`,
  symbol: (n) => `web/icons/${n}.png`,
  banner: (n) => `web/banner/papiercollage/${n}.png`,
  karte: (n) => `web/cards/symbolstark/${n}.jpg`,
  einfluss: (n) => `web/cards/progress/${n}.jpg`,
};

export function buehne(d) {
  const p = d.page;
  const e = (fn, arg) => p.evaluate(fn, arg);
  return {
    p,
    e,
    bereit: () => p.waitForFunction(() => window.erklaer),
    /** Grundspiel: `teil` ist die Nummer. Erweiterungen: `teil` ist die Unterzeile, etwa „Erweiterung“. */
    intro: (titel, teil) =>
      d.step("Intro", "", async () => {
        const karte =
          typeof teil === "number"
            ? { art: "intro", titel, unter: `Teil ${teil} von ${TEILE}` }
            : { art: "intro", titel, unter: teil, zeile: "Erweiterungen erklärt" };
        await e((k) => erklaer.karte(k), karte);
        await d.wait(2400);
      }),
    outro: (titel, unter) =>
      d.step("Outro", "", async () => {
        await e((k) => erklaer.karte(k), { art: "outro", titel, unter });
        await d.wait(1200);
      }),
    spiel: (id) => e((id) => erklaer.spiel(id), id),
    szene: (id) => e((id) => erklaer.szene(id), id),
    takt: (n) => e((n) => erklaer.takt(n), n),
    folie: (f) => e((f) => erklaer.folie(f), f),
    /** Eine Folie zeigen und dazu sprechen; `takt` deckt gleich die ersten Elemente auf. */
    zeige: (label, narration, f, takt = 0) =>
      d.step(label, narration, async () => {
        await e((f) => erklaer.folie(f), f);
        if (takt) await e((n) => erklaer.takt(n), takt);
      }),
    /** Auf der aktuellen Folie den nächsten Takt aufdecken und dazu sprechen. */
    weiter: (label, narration, n) =>
      d.step(label, narration, async () => {
        await e((n) => erklaer.takt(n), n);
      }),
    plan: () => e(() => erklaer.plan()),
    vorschlag: () => e(() => erklaer.vorschlag()),
    wurf: (a, b) => e(([a, b]) => erklaer.wurf(a, b), [a, b]),
    zug: (name, action) => e(([n, a]) => erklaer.zug(n, a), [name, action]),
    andere: (ms) => e((ms) => erklaer.andere(ms), ms),
    ecke: (v) => p.locator(`.vertex-target[data-vertex="${v}"]`),
    kante: (k) => p.locator(`.edge-target[data-edge="${k}"]`),
    feld: (h) => p.locator(`.hex-target[data-hex="${h}"]`),
    /** Der große Würfelknopf unten rechts (der Würfelbecher daneben heißt auch „Würfeln“). */
    wuerfeln: () => p.locator("button.go", { hasText: "Würfeln" }),
    knopf: (anfang) => p.getByRole("button", { name: new RegExp(`^${anfang}`) }),
  };
}
