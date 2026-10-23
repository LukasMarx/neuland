// Erklärvideo 3 · Würfeln und Ertrag
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Würfeln und Ertrag", 3);

  await d.step("Würfeln", "Jeder Zug beginnt mit dem Würfeln.", async () => {
    await b.spiel("zug");
    const { wurf } = await b.plan();
    await b.wurf(...wurf);
    await d.click(b.wuerfeln());
  });

  await d.step("Ertrag", "Alle Felder mit dieser Zahl liefern. Jede Siedlung daran bekommt eine Karte, egal wer gerade am Zug ist.", async () => {
    await d.see(b.knopf("Zug beenden"));
  });

  await d.step("Handeln und bauen", "Danach darfst du handeln und bauen, so viel du dir leisten kannst.", async () => {
    await d.hover(b.knopf("Straße"));
  });

  await d.step("Zug beenden", "Mit Zug beenden gibst du die Würfel weiter.", async () => {
    await d.click(b.knopf("Zug beenden"));
  });

  await d.step("Reihum", "Dann sind die anderen dran. So geht es reihum, bis jemand zehn Punkte hat.", async () => {
    await b.andere(450);
    await d.see(b.wuerfeln());
  });

  await b.outro("Jetzt wird gebaut", "Als Nächstes: Bauen");
}
