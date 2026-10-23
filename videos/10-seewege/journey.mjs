// Erklärvideo 10 · Seewege
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Seewege", "Erweiterung");

  await d.step("Inseln", "Mit Seewegen liegen mehrere Inseln im Meer. Wer sich zuerst hinüberwagt, kann dort Land für sich beanspruchen.", async () => {
    await b.spiel("seewege");
  });

  await b.zeige("Neu", "Neu sind das Meer zwischen den Inseln, Schiffe, das Kaperschiff, Goldfelder, der Inselbonus und auf manchen Karten Nebel.", {
    kopf: "Was neu dazukommt",
    layout: "galerie",
    staffel: 750,
    elemente: [
      { bild: "web/tiles/papiercollage/ocean.jpg", form: "feld", titel: "Meer", takt: 1 },
      { bild: bild.figur("ship-red"), titel: "Schiffe", takt: 1 },
      { bild: bild.figur("pirate"), titel: "Kaperschiff", takt: 1 },
      { bild: bild.feld("gold"), form: "feld", titel: "Goldfelder", takt: 1 },
      { bild: bild.symbol("seewege/island-bonus"), form: "symbol", titel: "Inselbonus", takt: 1 },
      { bild: bild.feld("fog"), form: "feld", titel: "Nebel", takt: 1 },
    ],
  }, 1);

  await b.zeige("Siegziel", "Das Siegziel steigt auf zwölf oder dreizehn Punkte, je nach Karte.", {
    kopf: "Was sich ändert",
    layout: "vergleich",
    nachher: "Mit Seewegen",
    elemente: [
      { titel: "Siegziel", vorher: "10 Punkte", nachher: "12 oder 13, je nach Karte" },
      { titel: "Aufbau", vorher: "überall auf der Insel", nachher: "meist nur auf der großen Hauptinsel" },
      { titel: "Bei einer 7 oder einem Ritter", vorher: "Räuber versetzen", nachher: "Räuber <b>oder</b> Kaperschiff versetzen" },
      { titel: "Längste Straße", vorher: "nur Straßen", nachher: "<b>Längste Handelsroute</b> aus Straßen und Schiffen" },
      { titel: "Straßenbau-Karte", vorher: "2 Straßen", nachher: "2 Straßen oder Schiffe, auch gemischt" },
    ],
    notiz: { html: "Für die Längste Handelsroute zählen Straßen und Schiffe zusammen, wenn sie an einer eigenen Siedlung oder Stadt ineinander übergehen.", takt: 6 },
  }, 1);
  await b.weiter("Aufbau", "Beim Aufbau setzt ihr meist nur auf der großen Hauptinsel.", 2);
  await b.weiter("Sieben", "Bei einer Sieben oder einem Ritter versetzt du den Räuber oder das Kaperschiff.", 3);
  await b.weiter("Handelsroute", "Aus der Längsten Straße wird die Längste Handelsroute aus Straßen und Schiffen.", 4);
  await b.weiter("Straßenbau", "Die Karte Straßenbau bringt zwei Straßen oder Schiffe, auch gemischt.", 5);
  await b.weiter("Route zählen", "Für die Handelsroute zählen Straßen und Schiffe zusammen, wenn sie an einer eigenen Siedlung oder Stadt ineinander übergehen.", 6);

  await b.zeige("Schiff kostet", "Ein Schiff kostet Holz und Wolle. Jeder hat fünfzehn davon.", {
    kopf: "Schiffe bauen",
    layout: "bild",
    szene: "ships",
    fokus: true,
    elemente: [
      { titel: "Schiff", html: "15 je Spieler", kosten: { wood: 1, sheep: 1 } },
      { html: "Ein Schiff liegt auf einer <b>Kante am Wasser</b>: an der Küste oder zwischen zwei Meerfeldern." },
      { html: "Stück für Stück von deiner Siedlung aus entsteht eine <b>Schiffslinie</b>." },
      { html: "Wo die Linie an eine Küste stößt, darfst du eine <b>Siedlung gründen</b>." },
      { html: "Straße und Schiff gehen nur an einer <b>eigenen Siedlung oder Stadt</b> ineinander über." },
    ],
  }, 1);
  await b.weiter("Kante am Wasser", "Ein Schiff liegt auf einer Kante am Wasser, also an der Küste oder zwischen zwei Meerfeldern.", 2);
  await b.weiter("Schiffslinie", "Wie Straßen baust du Schiffe Stück für Stück von deiner Siedlung aus zu einer Schiffslinie.", 3);
  await b.weiter("Siedlung gründen", "Wo die Linie an eine Küste stößt, darfst du eine Siedlung gründen.", 4);
  await b.weiter("Übergang", "Straße und Schiff gehen nur an einer eigenen Siedlung oder Stadt ineinander über. Direkt an der Küste kann eine Straße also nicht in ein Schiff wechseln.", 5);

  await b.zeige("Versetzen", "Einmal pro Zug darfst du ein Schiff umsetzen, wenn du dich verfahren hast.", {
    kopf: "Schiffe versetzen",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("ui/move-ship"), html: "Einmal pro Zug darfst du <b>ein Schiff umsetzen</b>." },
      { html: "Nur das <b>letzte Schiff einer offenen Linie</b>, an deren Ende noch keine Siedlung steht." },
      { html: "Ein Schiff, das du <b>in diesem Zug gebaut</b> hast, bleibt liegen." },
    ],
  }, 1);
  await b.weiter("Letztes Schiff", "Erlaubt ist nur das letzte Schiff einer offenen Linie, an deren Ende noch keine Siedlung steht.", 2);
  await b.weiter("Neu gebaut", "Ein Schiff, das du in diesem Zug gebaut hast, bleibt liegen.", 3);

  await b.zeige("Kaperschiff", "Das Kaperschiff steht auf einem Meerfeld. An dessen Kanten darf niemand Schiffe bauen oder hinsetzen. Wer es versetzt, nimmt einem Spieler mit einem Schiff an diesem Feld eine Karte.", {
    kopf: "Was auf dem Meer wartet",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.figur("pirate"), titel: "Kaperschiff", html: "Sperrt die Kanten seines Meerfelds. Wer es versetzt, nimmt einem Spieler mit Schiff dort eine Karte." },
      { bild: bild.feld("gold"), titel: "Goldfeld", html: "Liefert Rohstoffe nach Wahl: 1 je Siedlung, 2 je Stadt." },
      { bild: bild.symbol("seewege/island-bonus"), titel: "Inselbonus", html: "Die erste eigene Siedlung auf einer neuen Insel bringt <b>2 Punkte</b> extra." },
      { bild: bild.feld("fog"), titel: "Nebel", html: "Straße oder Schiff daneben deckt ihn auf. Ist es Land, bekommst du einen Rohstoff davon." },
    ],
  }, 1);
  await b.weiter("Goldfeld", "Fällt die Zahl eines Goldfelds, wählt jeder dort Rohstoffe aus der Bank: einen je Siedlung und zwei je Stadt.", 2);
  await b.weiter("Inselbonus", "Deine erste Siedlung auf einer Insel, auf der du noch nichts hast, bringt zwei Punkte extra.", 3);
  await b.weiter("Nebel", "Baust du eine Straße oder ein Schiff an ein Nebelfeld, wird es aufgedeckt. Ist es Land, bekommst du als Entdecker einen Rohstoff davon.", 4);

  await b.outro("Leinen los!", "Das war Seewege");
}
