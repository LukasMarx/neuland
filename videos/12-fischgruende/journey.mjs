// Erklärvideo 12 · Fischgründe
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Fischgründe", "Erweiterung");

  await d.step("Küste", "Die Fischer der Insel kennen die besten Stellen an der Küste und im See. Wer dort siedelt, bringt Fang nach Hause und tauscht ihn gegen allerlei Gefälligkeiten.", async () => {
    await b.spiel("fischgruende");
  });

  await b.zeige("Neu", "Neu sind Fische als zweite Währung, ein See und mehrere Fischgründe, die Fische liefern, und der Rostige Anker, ein Plättchen, das niemand haben will.", {
    kopf: "Was neu dazukommt",
    layout: "galerie",
    staffel: 900,
    elemente: [
      { bild: bild.feld("lake"), form: "feld", titel: "See", takt: 1 },
      { bild: bild.symbol("fishing/ground"), form: "symbol", titel: "Fischgrund", takt: 1 },
      { bild: bild.symbol("fishing/fish-2"), form: "symbol", titel: "Fischplättchen", takt: 1 },
      { bild: bild.symbol("fishing/anchor"), form: "symbol", titel: "Rostiger Anker", takt: 1 },
    ],
  }, 1);

  await b.zeige("Wüste wird See", "Die Wüste wird zum See, der Fische liefert.", {
    kopf: "Was sich ändert",
    layout: "vergleich",
    nachher: "Mit Fischgründen",
    elemente: [
      { titel: "Wüste", vorher: "liefert nichts", nachher: "wird zum <b>See</b>, der Fische liefert" },
      { titel: "Räuber", vorher: "startet in der Wüste", nachher: "startet neben dem Brett" },
      { titel: "Küste", vorher: "nur Häfen", nachher: "dazu Fischgründe mit Zahlen" },
    ],
  }, 1);
  await b.weiter("Räuber neben dem Brett", "Der Räuber startet neben dem Brett.", 2);
  await b.weiter("Fischgründe an der Küste", "Und an der Küste liegen neben den Häfen Fischgründe mit Zahlen.", 3);

  await b.zeige("See liefert", "Der See liefert bei den seltenen Würfen zwei, drei, elf und zwölf an alle Siedlungen und Städte um ihn herum.", {
    kopf: "Fische fangen",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.feld("lake"), titel: "See", html: "liefert bei <b>2, 3, 11 und 12</b> an alle Siedlungen und Städte um ihn herum." },
      { bild: bild.symbol("fishing/ground"), titel: "Fischgrund", html: "hat eine eigene Zahl und beliefert die <b>beiden Ecken</b> neben sich." },
      { bild: bild.symbol("fishing/fish-3"), titel: "Treffer", html: "Je Siedlung ein verdecktes Fischplättchen, je Stadt zwei. Darauf sind <b>1 bis 3 Fische</b>." },
      { html: "Die anderen sehen nur, <b>wie viele Plättchen</b> du hast." },
    ],
  }, 1);
  await b.weiter("Fischgrund liefert", "Jeder Fischgrund an der Küste hat eine eigene Zahl und beliefert die beiden Ecken neben sich.", 2);
  await b.weiter("Plättchen ziehen", "Bei einem Treffer zieht jede Siedlung dort ein verdecktes Fischplättchen, jede Stadt zwei. Auf den Plättchen sind ein bis drei Fische.", 3);
  await b.weiter("Verdeckt", "Die anderen sehen nur, wie viele Plättchen du hast.", 4);

  await b.zeige("Ausgeben", "In deinem Zug kannst du nach dem Würfeln Fische eintauschen. Die Fische auf deinen Plättchen werden zusammengezählt.", {
    kopf: "Fische ausgeben",
    layout: "liste",
    dicht: true,
    fokus: true,
    alleSichtbar: true,
    elemente: [
      { wert: "2 Fische", html: "den Räuber vom Brett nehmen", takt: 2 },
      { wert: "3 Fische", html: "einem Mitspieler eine Karte wegnehmen", takt: 3 },
      { wert: "4 Fische", html: "einen Rohstoff aus der Bank", takt: 4 },
      { wert: "5 Fische", html: "eine Straße bauen, ohne zu bezahlen", takt: 5 },
      { wert: "7 Fische", html: "eine Entwicklungskarte, ohne zu bezahlen", takt: 6 },
    ],
    notiz: { label: "Beispiel", html: "Du hast Plättchen mit 3 und 2 Fischen und willst einen Rohstoff für 4. Du gibst beide ab, den übrigen Fisch bekommst du nicht zurück. Wechselgeld gibt es nicht.", takt: 7 },
  });
  await b.weiter("Zwei Fische", "Für zwei Fische nimmst du den Räuber vom Brett.", 2);
  await b.weiter("Drei Fische", "Für drei nimmst du einem Mitspieler eine Karte weg.", 3);
  await b.weiter("Vier Fische", "Für vier bekommst du einen Rohstoff aus der Bank.", 4);
  await b.weiter("Fünf Fische", "Für fünf baust du eine Straße, ohne zu bezahlen.", 5);
  await b.weiter("Sieben Fische", "Und für sieben gibt es eine Entwicklungskarte, ohne zu bezahlen.", 6);
  await b.weiter("Kein Wechselgeld", "Ein Beispiel: Du hast Plättchen mit drei und zwei Fischen und willst einen Rohstoff für vier. Du gibst beide ab, den übrigen Fisch bekommst du nicht zurück. Wechselgeld gibt es nicht.", 7);

  await b.zeige("Anker", "Unter den Plättchen liegt ein rostiger Anker. Wer ihn zieht, braucht einen Punkt mehr zum Sieg.", {
    kopf: "Der Rostige Anker",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("fishing/anchor"), html: "Wer ihn zieht, braucht <b>einen Punkt mehr</b> zum Sieg." },
      { html: "Du darfst ihn an jemanden <b>weitergeben</b>, der gleich viele oder mehr Punkte hat als du." },
    ],
  }, 1);
  await b.weiter("Weitergeben", "Du darfst ihn an jemanden weitergeben, der gleich viele oder mehr Punkte hat als du.", 2);

  await b.outro("Petri Heil!", "Das war Fischgründe");
}
