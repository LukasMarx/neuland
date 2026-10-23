// Erklärvideo 8 · Sonderkarten und Sieg
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Sonderkarten und Sieg", 8);

  await d.step("Stand", "Du hast sechs Punkte, vier Straßen am Stück und schon zwei Ritter gespielt.", async () => {
    await b.spiel("sieg");
  });

  await d.step("Längste Handelsstraße", "Mit der fünften Straße bekommst du die Längste Handelsstraße. Sie zählt zwei Punkte.", async () => {
    const { strasse } = await b.plan();
    await d.click(b.knopf("Straße"));
    await d.click(b.kante(strasse));
    await d.see(b.p.getByText("Längste Handelsstraße").first());
  });

  await d.step("Wechsel", "Hat jemand später mehr Straßen am Stück, geht sie an ihn.", async () => {
    await d.wait(500);
  });

  await d.step("Rittermacht", "Der dritte Ritter bringt die Größte Rittermacht, noch einmal zwei Punkte.", async () => {
    await d.click(b.p.getByRole("button", { name: "Ritter spielen" }));
    await d.see(b.p.getByText("hat gewonnen"));
  });

  await d.step("Sieg", "Damit hast du zehn Punkte und gewinnst sofort.", async () => {
    await d.wait(300);
  });

  await b.outro("Viel Spaß auf der Insel!", "Das war das Grundspiel");
}
