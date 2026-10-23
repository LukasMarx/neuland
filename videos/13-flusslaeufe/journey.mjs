// Erklärvideo 13 · Flussläufe
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Flussläufe", "Erweiterung");

  await d.step("Flüsse", "Zwei Flüsse ziehen sich durch das Land. An ihren Ufern wird Handel getrieben, und wer Brücken schlägt, verdient gut daran.", async () => {
    await b.spiel("flusslaeufe");
  });

  await b.zeige("Neu", "Neu sind zwei Flüsse, die von der Inselmitte zur Küste laufen.", {
    kopf: "Was neu dazukommt",
    layout: "bild",
    szene: "river",
    fokus: true,
    elemente: [
      { html: "Zwei <b>Flüsse</b>, die von der Inselmitte zur Küste laufen." },
      { bild: bild.figur("bridge-red"), html: "<b>Brücken</b>, der einzige Weg über das Wasser." },
      { bild: bild.symbol("rivers/coin"), html: "<b>Münzen</b> für alles, was du am Fluss baust." },
    ],
  }, 1);
  await b.weiter("Brücken", "Brücken sind der einzige Weg über das Wasser. Im Bild läuft der Fluss über die Kante zwischen Acker und Hügel, dort liegt keine Straße, nur eine Brücke.", 2);
  await b.weiter("Münzen", "Und für alles, was du am Fluss baust, gibt es Münzen.", 3);

  await b.zeige("Kanten", "Auf einer Kante mit Fluss geht keine Straße, nur eine Brücke.", {
    kopf: "Was sich ändert",
    layout: "vergleich",
    nachher: "Mit Flussläufen",
    elemente: [
      { titel: "Kanten mit Fluss", vorher: "Straße möglich", nachher: "nur eine <b>Brücke</b>" },
      { titel: "Bauen am Fluss", vorher: "nichts extra", nachher: "bringt <b>Münzen</b>" },
      { titel: "Punkte", vorher: "nur fürs Bauen", nachher: "reichster Spieler +1, ärmster −2" },
    ],
  }, 1);
  await b.weiter("Bauen am Fluss", "Wer am Fluss baut, bekommt Münzen.", 2);
  await b.weiter("Reich und arm", "Und Münzen zählen: Der reichste Spieler bekommt einen Punkt dazu, der ärmste verliert zwei.", 3);

  await b.zeige("Brücke", "Eine Brücke kostet ein Holz und zwei Lehm. Jeder hat drei, und sie zählen als Straße.", {
    kopf: "Brücken und Münzen",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.figur("bridge-red"), titel: "Brücke", html: "3 je Spieler, zählt als Straße", kosten: { wood: 1, brick: 2 } },
      { bild: bild.symbol("rivers/coin"), html: "Straße oder Siedlung am Fluss: <b>1 Münze</b>. Brücke: <b>3 Münzen</b>." },
      { wert: "2 : 1", html: "In deinem Zug tauschst du <b>2 Münzen</b> gegen einen Rohstoff aus der Bank." },
    ],
  }, 1);
  await b.weiter("Münzen bekommen", "Eine Straße oder Siedlung am Fluss bringt eine Münze, eine Brücke drei.", 2);
  await b.weiter("Münzen tauschen", "In deinem Zug tauschst du zwei Münzen gegen einen Rohstoff aus der Bank.", 3);

  await b.zeige("Reichster", "Wer die meisten Münzen hat, ist der Reichste und bekommt einen Punkt.", {
    kopf: "Reich und arm",
    layout: "galerie",
    fokus: true,
    elemente: [
      { bild: bild.symbol("rivers/rich"), form: "symbol", titel: "Reichster", wert: "+1 Punkt" },
      { bild: bild.symbol("rivers/poor"), form: "symbol", titel: "Bettler", wert: "−2 Punkte" },
    ],
    notiz: { html: "Bei Gleichstand gilt es für alle Gleichen. Haben alle gleich viele Münzen, gibt es weder Bonus noch Abzug.", takt: 3 },
  }, 1);
  await b.weiter("Bettler", "Wer die wenigsten hat, ist der Bettler und verliert zwei Punkte.", 2);
  await b.weiter("Gleichstand", "Bei Gleichstand gilt es für alle Gleichen. Haben alle gleich viele Münzen, gibt es weder Bonus noch Abzug.", 3);

  await b.outro("Brücken schlagen!", "Das war Flussläufe");
}
