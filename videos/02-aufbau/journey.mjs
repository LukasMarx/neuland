// Erklärvideo 2 · Der Aufbau
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Der Aufbau", 2);

  await d.step("Erste Siedlung", "Zu Beginn setzt jeder reihum eine Siedlung und eine Straße. Du fängst an.", async () => {
    await b.spiel("aufbau");
    const { vertex } = await b.vorschlag();
    await d.click(b.ecke(vertex));
  });

  await d.step("Erste Straße", "Die Straße kommt direkt an deine Siedlung.", async () => {
    const { edge } = await b.vorschlag();
    await d.click(b.kante(edge));
  });

  await d.step("Abstandsregel", "Dabei gilt die Abstandsregel: Direkt neben einer Siedlung darf niemand bauen.", async () => {
    await b.szene("abstand");
    await b.takt(1);
    await d.wait(700);
    await b.takt(2);
  });

  await d.step("Zwei Kanten weiter", "Erst zwei Kanten weiter ist wieder Platz.", async () => {
    await b.takt(3);
  });

  await d.step("Die anderen", "Dann setzen die anderen. Der Letzte setzt gleich zweimal, danach geht es rückwärts zurück zu dir.", async () => {
    await b.spiel();
    await b.andere(330);
  });

  await d.step("Zweite Siedlung", "Für deine zweite Siedlung bekommst du sofort je einen Rohstoff der Felder daneben.", async () => {
    const { vertex } = await b.vorschlag();
    await d.click(b.ecke(vertex));
    await d.wait(1200);
  });

  await d.step("Zweite Straße", "Mit der letzten Straße ist der Aufbau fertig, und das Spiel beginnt.", async () => {
    const { edge } = await b.vorschlag();
    await d.click(b.kante(edge));
    await d.see(b.wuerfeln());
  });

  await b.outro("Bereit zum Würfeln!", "Als Nächstes: Würfeln und Ertrag");
}
