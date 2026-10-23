// Erklärvideo 5 · Handeln
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  const tisch = () => b.p.locator("app-trade-table");
  await b.bereit();

  await b.intro("Handeln", 5);

  await d.step("Tauschtisch", "In deinem Zug darfst du handeln. Über Handeln öffnest du den Tauschtisch.", async () => {
    await b.spiel("handel");
    await d.click(b.knopf("Handeln"));
    await d.see(tisch().getByRole("button", { name: "Allen anbieten" }));
  });

  await d.step("Angebot", "Du wählst, was du gibst und was du dafür willst. Hier ein Getreide gegen ein Erz.", async () => {
    // Oben „Du gibst“ (mit Kurs), unten „Du bekommst“.
    await d.click(tisch().getByRole("button", { name: /^Getreide/ }).first());
    await d.click(tisch().getByRole("button", { name: "Erz", exact: true }));
  });

  await d.step("Anbieten", "Dein Angebot geht an alle. Die anderen nehmen an oder lehnen ab.", async () => {
    await d.click(tisch().getByRole("button", { name: "Allen anbieten" }));
    await d.wait(700);
    await b.zug("Clara", { type: "respondTrade", offerId: 1, accept: false });
    await d.wait(700);
    await b.zug("Bruno", { type: "respondTrade", offerId: 1, accept: true });
    await d.wait(500);
    await b.zug("Jonas", { type: "respondTrade", offerId: 1, accept: false });
    await d.see(tisch().getByText("nimmt an"));
  });

  await d.step("Tauschen", "Bruno ist dabei, also tauschst du mit ihm.", async () => {
    await d.click(tisch().getByRole("button", { name: "Tauschen", exact: true }));
  });

  await d.step("Bank", "Ohne Mitspieler tauschst du mit der Bank: vier gleiche Karten gegen eine nach Wahl.", async () => {
    await b.szene("handel");
    await b.takt(1);
  });

  await d.step("Hafen", "Mit einer Siedlung am Hafen geht es günstiger, drei zu eins oder sogar zwei zu eins.", async () => {
    await b.takt(2);
  });

  await b.outro("Guter Handel!", "Als Nächstes: Die Sieben und der Räuber");
}
