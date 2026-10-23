// Erklärvideo 14 · Duell
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Duell", "Erweiterung für zwei");

  await d.step("Zwei Siedler", "Im Duell sind nur zwei Siedler auf der Insel. Doch zwei Sippen, die schon länger hier leben, breiten sich mit aus und machen das Land eng.", async () => {
    await b.spiel("duell");
  });

  await b.zeige("Neutrale", "Dazu kommen zwei neutrale Mitspieler in Grau. Sie sind nie am Zug, bekommen keine Rohstoffe und können nicht gewinnen. Sie nehmen euch nur Platz weg.", {
    kopf: "Was neu dazukommt",
    layout: "galerie",
    fokus: true,
    elemente: [
      { bild: bild.gebaeude("settlement-grey-light"), titel: "Neutral 1", html: "nie am Zug, keine Rohstoffe, kein Sieg", takt: 1 },
      { bild: bild.gebaeude("settlement-grey-dark"), titel: "Neutral 2", html: "nimmt euch nur Platz weg", takt: 1 },
      { bild: bild.symbol("duel/token"), form: "symbol", titel: "Handelsmarke", html: "Tausch erzwingen oder Räuber vertreiben", takt: 2 },
    ],
  }, 1);
  await b.weiter("Handelsmarken", "Neu sind außerdem Handelsmarken, mit denen du einen Tausch erzwingen oder den Räuber vertreiben kannst.", 2);

  await b.zeige("Spieler", "Gespielt wird zu zweit, dazu kommen die beiden Neutralen.", {
    kopf: "Was sich ändert",
    layout: "vergleich",
    nachher: "Im Duell",
    elemente: [
      { titel: "Spieler", vorher: "2 bis 8", nachher: "genau 2, dazu 2 Neutrale" },
      { titel: "Aufbau", vorher: "2 Siedlungen je Spieler", nachher: "danach noch 1 Siedlung mit Straße für einen Neutralen" },
      { titel: "Straße oder Siedlung kaufen", vorher: "du baust sie", nachher: "dazu ein gleiches Teil für einen Neutralen, gratis" },
      { titel: "Ritter ausspielen", vorher: "Räuber versetzen", nachher: "dazu <b>1 Handelsmarke</b>" },
    ],
    notiz: { html: "Gibt es für den Neutralen keinen Platz für eine Siedlung, bekommt er eine Straße. Neutrale zählen nicht für die Längste Straße.", takt: 5 },
  }, 1);
  await b.weiter("Aufbau Neutrale", "Nach euren zwei Siedlungen setzt jeder noch eine Siedlung mit Straße für einen Neutralen.", 2);
  await b.weiter("Mitbauen", "Kaufst du eine Straße oder Siedlung, setzt du zusätzlich ein gleiches Teil für einen Neutralen, gratis.", 3);
  await b.weiter("Ritter Marke", "Für jeden ausgespielten Ritter bekommst du dazu eine Handelsmarke.", 4);
  await b.weiter("Kein Platz", "Gibt es für den Neutralen keinen Platz für eine Siedlung, bekommt er eine Straße. Neutrale zählen nicht für die Längste Straße.", 5);

  await b.zeige("Marken bekommen", "Eine Handelsmarke bekommst du für jede Siedlung an der Küste, jede Siedlung an der Wüste und jeden ausgespielten Ritter.", {
    kopf: "Handelsmarken",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("duel/token"), titel: "Bekommen", html: "für jede Siedlung an der Küste, jede Siedlung an der Wüste und jeden Ritter" },
      { titel: "Tausch erzwingen", html: "Du nimmst dem Gegner 2 zufällige Karten und gibst ihm 2 Karten deiner Wahl." },
      { titel: "Räuber vertreiben", html: "Der Räuber geht zurück in die Wüste." },
    ],
    notiz: { html: "Wer mehr Punkte hat, zahlt <b>2 Marken</b>, sonst kostet es <b>1</b>. So kann der Zurückliegende leichter aufholen.", takt: 4 },
  }, 1);
  await b.weiter("Tausch erzwingen", "In deinem Zug kannst du sie nach dem Würfeln einsetzen. Beim Tausch erzwingen nimmst du dem Gegner zwei zufällige Karten und gibst ihm zwei Karten deiner Wahl.", 2);
  await b.weiter("Räuber vertreiben", "Oder du schickst den Räuber zurück in die Wüste.", 3);
  await b.weiter("Preis", "Wer mehr Punkte hat, zahlt zwei Marken, sonst kostet es eine. So kann der Zurückliegende leichter aufholen.", 4);

  await b.outro("Auf ins Duell!", "Das war das Duell");
}
