// Erklärvideo 9 · Die große Runde (5 bis 8 Spieler)
import { buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Die große Runde", "5 bis 8 Spieler");

  await d.step("Insel", "Ab fünf Spielern wird die Insel größer, damit alle Platz finden. Hier spielen sechs.", async () => {
    await b.spiel("gross");
  });

  await b.zeige("Felder", "Die Insel hat dann dreißig Felder und zwei Wüsten, bei sieben oder acht Spielern sogar siebenunddreißig.", {
    kopf: "Was sich ändert",
    unter: "Ab 5 Spielern",
    layout: "vergleich",
    nachher: "Ab 5 Spielern",
    elemente: [
      { titel: "Insel", vorher: "19 Felder, 1 Wüste", nachher: "30 Felder, 2 Wüsten<br>(7–8 Spieler: 37)" },
      { titel: "Bank", vorher: "19 Karten je Rohstoff", nachher: "24 je Rohstoff<br>(7–8 Spieler: 27)" },
      { titel: "Entwicklungskarten", vorher: "25 im Stapel", nachher: "34 im Stapel<br>(7–8 Spieler: 44)" },
      { titel: "Nach jedem Zug", vorher: "der Nächste würfelt", nachher: "erst die <b>Sonderbauphase</b>" },
    ],
    notiz: { html: "Alles andere bleibt wie im Grundspiel, auch das Siegziel. Die Werte gelten für die klassische Karte, andere Karten haben ihre eigene Größe.", takt: 5 },
  }, 1);
  await b.weiter("Bank", "In der Bank liegen vierundzwanzig Karten je Rohstoff, bei sieben oder acht Spielern siebenundzwanzig.", 2);
  await b.weiter("Entwicklungskarten", "Der Stapel hat vierunddreißig Entwicklungskarten, bei sieben oder acht Spielern vierundvierzig.", 3);
  await b.weiter("Nach jedem Zug", "Und nach jedem Zug kommt erst die Sonderbauphase.", 4);
  await b.weiter("Sonst gleich", "Alles andere bleibt wie im Grundspiel, auch das Siegziel. Die Werte gelten für die klassische Karte, andere Karten haben ihre eigene Größe.", 5);

  await b.zeige("Sonderbauphase", "Mit vielen Spielern dauert es lange, bis du wieder dran bist. Damit du deine Karten nicht an eine Sieben verlierst, darfst du zwischendurch bauen.", {
    kopf: "Die Sonderbauphase",
    layout: "bild",
    szene: "specialBuild",
    fokus: true,
    elemente: [
      { html: "Nach jedem Zug kommen alle anderen <b>der Reihe nach einmal</b> dran." },
      { html: "Erlaubt ist nur <b>Bauen</b> und <b>Entwicklungskarten kaufen</b>." },
      { html: "<b>Handeln</b> und <b>Karten ausspielen</b> geht in dieser Phase nicht." },
      { html: "Wer sich nichts leisten kann, wird <b>automatisch übersprungen</b>." },
    ],
  });
  await b.weiter("Reihum", "Nach jedem Zug kommen alle anderen der Reihe nach einmal dran. Im Bild hat Rot den Zug beendet, jetzt bauen Blau, Grün und Gelb.", 1);
  await b.weiter("Nur bauen", "Erlaubt ist nur Bauen und Entwicklungskarten kaufen.", 2);
  await b.weiter("Kein Handel", "Handeln und Karten ausspielen geht in dieser Phase nicht.", 3);
  await b.weiter("Überspringen", "Wer sich nichts leisten kann, wird automatisch übersprungen.", 4);

  await b.outro("Mehr Platz für alle!", "Das war die große Runde");
}
