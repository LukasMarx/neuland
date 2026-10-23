// Erklärvideo 7 · Entwicklungskarten
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Entwicklungskarten", 7);

  await d.step("Kaufen", "Für Wolle, Getreide und Erz ziehst du eine Entwicklungskarte vom Stapel.", async () => {
    await b.spiel("entwicklung");
    await d.click(b.knopf("Entwicklung"));
  });

  await d.step("Ritter", "Der Ritter versetzt den Räuber, und du ziehst eine Karte.", async () => {
    await b.szene("entwicklung");
    await b.takt(1);
  });

  await d.step("Fortschritt", "Straßenbau, Erfindung und Monopol bringen dir Straßen oder Rohstoffe.", async () => {
    await b.takt(2);
  });

  await d.step("Siegpunkt", "Eine Siegpunktkarte zählt einfach einen Punkt.", async () => {
    await b.takt(3);
  });

  await d.step("Eine pro Zug", "Du spielst höchstens eine Karte pro Zug, und nie die, die du gerade gekauft hast.", async () => {
    await b.takt(4);
  });

  await b.outro("Karten ausspielen!", "Als Nächstes: Sonderkarten und Sieg");
}
