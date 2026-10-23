// Erklärvideo 4 · Bauen
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Bauen", 4);

  await d.step("Straße kostet", "Gebaut wird mit Rohstoffkarten. Eine Straße kostet Holz und Lehm.", async () => {
    await b.szene("kosten");
    await b.takt(1);
  });

  await d.step("Siedlung kostet", "Eine Siedlung kostet Holz, Lehm, Wolle und Getreide.", async () => {
    await b.takt(2);
  });

  await d.step("Stadt kostet", "Eine Stadt kostet zwei Getreide und drei Erz.", async () => {
    await b.takt(3);
  });

  await d.step("Entwicklung kostet", "Und eine Entwicklungskarte Wolle, Getreide und Erz.", async () => {
    await b.takt(4);
  });

  await d.step("Straße bauen", "Klick auf Straße und dann auf eine Kante. Straßen baust du an deine eigenen Straßen oder Siedlungen.", async () => {
    await b.spiel("bauen");
    d.cue();
    const { strassen } = await b.plan();
    await d.click(b.knopf("Straße"));
    await d.click(b.kante(strassen[0]));
  });

  await d.step("Zweite Straße", "Mit einer zweiten Straße erreichst du eine Ecke, an der wieder Platz für eine Siedlung ist.", async () => {
    const { strassen } = await b.plan();
    await d.click(b.knopf("Straße"));
    await d.click(b.kante(strassen[1]));
  });

  await d.step("Siedlung bauen", "Dort baust du eine neue Siedlung. Sie bringt dir einen Punkt.", async () => {
    const { ecke } = await b.plan();
    await d.click(b.knopf("Siedlung"));
    await d.click(b.ecke(ecke));
  });

  await d.step("Stadt bauen", "Eine Stadt ersetzt eine Siedlung. Sie zählt zwei Punkte und liefert doppelt.", async () => {
    const { stadt } = await b.plan();
    await d.click(b.knopf("Stadt"));
    await d.click(b.ecke(stadt));
  });

  await b.outro("Gut gebaut!", "Als Nächstes: Handeln");
}
