// Erklärvideo 15 · Hausregeln
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Hausregeln", "Milder Räuber · Hafenvogt · Würfelstapel");

  await b.zeige("Hausregeln", "Hausregeln sind kleine Änderungen am Grundspiel. Ihr schaltet sie in der Lobby ein. Es gibt drei: den milden Räuber, den Hafenvogt und den Würfelstapel.", {
    kopf: "Hausregeln",
    layout: "galerie",
    staffel: 900,
    elemente: [
      { bild: bild.figur("robber"), titel: "Milder Räuber", takt: 1 },
      { bild: bild.symbol("variants/harbor-master"), form: "symbol", titel: "Hafenvogt", takt: 1 },
      { bild: "web/cards/dice-deck-back.jpg", form: "karte", titel: "Würfelstapel", takt: 1 },
    ],
  }, 1);

  await b.zeige("Milder Räuber", "Mit dem milden Räuber soll niemand, der schlecht gestartet ist, auch noch ausgeraubt werden.", {
    kopf: "Milder Räuber",
    layout: "vergleich",
    nachher: "Milder Räuber",
    elemente: [{ titel: "Wohin der Räuber darf", vorher: "auf jedes andere Feld", nachher: "nicht an Felder von Spielern mit <b>höchstens 2 Punkten</b>" }],
    notiz: { html: "Gibt es kein erlaubtes Feld, kommt der Räuber in die Wüste.", takt: 2 },
  });
  await b.weiter("Höchstens zwei Punkte", "Der Räuber darf nicht an Felder von Spielern, die höchstens zwei Punkte haben.", 1);
  await b.weiter("Wüste", "Gibt es kein erlaubtes Feld, kommt der Räuber in die Wüste.", 2);

  await b.zeige("Hafenvogt", "Mit dem Hafenvogt werden Häfen wertvoller, weil sie Punkte bringen können.", {
    kopf: "Hafenvogt",
    layout: "vergleich",
    nachher: "Hafenvogt",
    elemente: [
      { titel: "Siegziel", vorher: "10 Punkte", nachher: "1 Punkt mehr" },
      { titel: "Bauen am Hafen", vorher: "nur günstiger Tausch", nachher: "dazu Hafenpunkte: Siedlung 1, Stadt 2" },
    ],
    notiz: { label: "Der Hafenvogt", html: "Wer zuerst <b>3 Hafenpunkte</b> hat, wird Hafenvogt und bekommt <b>2 Siegpunkte</b>. Hat später jemand mehr Hafenpunkte, übernimmt er das Amt samt Punkten.", takt: 3 },
  });
  await b.weiter("Siegziel Hafenvogt", "Das Siegziel steigt um einen Punkt.", 1);
  await b.weiter("Hafenpunkte", "Eine Siedlung am Hafen bringt einen Hafenpunkt, eine Stadt zwei.", 2);
  await b.weiter("Amt", "Wer zuerst drei Hafenpunkte hat, wird Hafenvogt und bekommt zwei Siegpunkte. Hat später jemand mehr Hafenpunkte, übernimmt er das Amt samt Punkten.", 3);

  await b.zeige("Würfelstapel", "Mit Würfeln kann eine Zahl lange ausbleiben. Der Würfelstapel sorgt dafür, dass über das Spiel jede Zahl so oft kommt, wie sie soll.", {
    kopf: "Würfelstapel",
    layout: "liste",
    fokus: true,
    alleSichtbar: true,
    elemente: [
      { bild: "web/cards/dice-deck-front.jpg", form: "karte", titel: "Statt zu würfeln", html: "ziehst du eine Karte aus einem Stapel mit <b>36 Karten</b>." },
      { html: "Jede Summe ist so oft drin, wie zwei Würfel sie ergeben: <b>eine 2</b>, zwei 3er und so weiter bis zu <b>sechs 7ern</b>." },
      { html: "Bei <b>5 übrigen Karten</b> wird neu gemischt, damit niemand das Ende ausrechnen kann." },
    ],
  });
  await b.weiter("Karte statt Würfel", "Statt zu würfeln ziehst du eine Karte aus einem Stapel mit sechsunddreißig Karten.", 1);
  await b.weiter("Verteilung", "Jede Summe ist so oft drin, wie zwei Würfel sie ergeben können: eine Zwei, zwei Dreier und so weiter bis zu sechs Siebenern.", 2);
  await b.weiter("Neu mischen", "Bei fünf übrigen Karten wird neu gemischt, damit niemand das Ende ausrechnen kann.", 3);

  await b.outro("Eure Insel, eure Regeln!", "Das war Hausregeln");
}
