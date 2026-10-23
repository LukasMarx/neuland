// Erklärvideo 1 · Worum geht's? Aufnahme: siehe videos/README.md.
export const url = "http://localhost:4330/#/erklaer";
export const lively = true;

export default async function (d) {
  const p = d.page;
  const e = (fn, arg) => p.evaluate(fn, arg);
  await p.waitForFunction(() => window.erklaer);

  await d.step("Intro", "", async () => {
    await e(() => erklaer.karte({ art: "intro", titel: "Worum geht’s?", unter: "Teil 1 von 8" }));
    await d.wait(2400);
  });

  await d.step("Insel", "Neuland spielt auf einer Insel aus Sechseckfeldern. Darauf baut ihr Straßen, Siedlungen und Städte.", async () => {
    await e(() => erklaer.spiel("mitte"));
    await d.see(p.getByRole("img", { name: "Spielbrett" }));
  });

  await d.step("Rohstoffe", "Jedes Feld liefert einen Rohstoff: Wald gibt Holz, Hügel Lehm, Weide Wolle, Acker Getreide und Gebirge Erz.", async () => {
    await e(() => erklaer.szene("rohstoffe"));
    await e(() => erklaer.takt(1));
    await d.see(p.getByText("Getreide", { exact: true }));
  });

  await d.step("Wüste", "Nur die Wüste liefert nichts.", async () => {
    await e(() => erklaer.takt(2));
    await d.see(p.getByText("nichts", { exact: true }));
  });

  await d.step("Zahlen", "Auf jedem Feld liegt eine Zahl. Wird sie gewürfelt, liefert das Feld seinen Rohstoff.", async () => {
    await e(() => erklaer.szene("zahlen"));
    await e(() => erklaer.takt(1));
  });

  await d.step("Sechs und Acht", "Sechs und Acht fallen am häufigsten, Zwei und Zwölf nur selten.", async () => {
    await e(() => erklaer.takt(2));
  });

  await d.step("Siegpunkte", "Punkte gibt es für Siedlungen und Städte, für zwei Sonderkarten und für Siegpunktkarten.", async () => {
    await e(() => erklaer.szene("punkte"));
    await e(() => erklaer.takt(1));
    await d.see(p.getByText("Größte Rittermacht"));
  });

  await d.step("Ziel", "Wer zuerst zehn Punkte hat, gewinnt das Spiel.", async () => {
    await e(() => erklaer.takt(2));
    await d.see(p.getByText("Punkte gewinnen"));
  });

  await d.step("Outro", "", async () => {
    await e(() => erklaer.karte({ art: "outro", titel: "Ab auf die Insel!", unter: "Als Nächstes: Der Aufbau" }));
    await d.wait(1200);
  });
}
