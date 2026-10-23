// Erklärvideo 6 · Die Sieben und der Räuber
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  const mehr = (r) => b.p.getByRole("button", { name: `${r} mehr` });
  await b.bereit();

  await b.intro("Die Sieben und der Räuber", 6);

  await d.step("Sieben", "Fällt eine Sieben, liefert kein Feld etwas.", async () => {
    await b.spiel("sieben");
    const { wurf } = await b.plan();
    await b.wurf(...wurf);
    await d.click(b.wuerfeln());
    await d.see(b.knopf("Abwerfen"));
  });

  await d.step("Abwerfen", "Wer mehr als sieben Karten hat, gibt die Hälfte ab.", async () => {
    await d.click(mehr("Holz"));
    await d.click(mehr("Holz"));
  });

  await d.step("Vier Karten", "Du hast neun Karten, also wählst du vier aus und wirfst sie ab.", async () => {
    await d.click(mehr("Lehm"));
    await d.click(mehr("Wolle"));
    await d.click(b.p.getByRole("button", { name: "Abwerfen", exact: true }));
  });

  await d.step("Räuber versetzen", "Dann setzt du den Räuber auf ein anderes Feld und ziehst eine Karte bei einem Spieler dort.", async () => {
    const { feld } = await b.plan();
    await d.click(b.feld(feld));
    await d.see(b.knopf("Zug beenden"));
  });

  await d.step("Blockiert", "Solange der Räuber dort steht, liefert das Feld nichts. Erst die nächste Sieben oder ein Ritter vertreibt ihn.", async () => {
    const { feld } = await b.plan();
    await d.spotlight(b.p.locator(`.hex[data-hex="${feld}"]`));
  });

  await b.outro("Vorsicht vor dem Räuber!", "Als Nächstes: Entwicklungskarten");
}
