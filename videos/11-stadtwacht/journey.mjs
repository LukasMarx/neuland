// Erklärvideo 11 · Stadtwacht
import { bild, buehne, URL } from "../buehne.mjs";

export const url = URL;
export const lively = true;

/** Die Einflusskarten je Farbe, mit Text fürs Bild und für die Stimme. */
const KARTEN = {
  market: {
    kopf: "Die Karten des Markts",
    karten: [
      ["bulkBuy", "Großeinkauf", "Nenne einen Rohstoff. Jeder Mitspieler gibt dir bis zu 2 Karten davon.", "Nenne einen Rohstoff. Jeder Mitspieler gibt dir bis zu zwei Karten davon."],
      ["guildRight", "Zunftrecht", "Nenne ein Gut. Jeder Mitspieler gibt dir 1 Karte davon, wenn er eine hat.", "Nenne ein Gut. Jeder Mitspieler gibt dir eine Karte davon, wenn er eine hat."],
      ["tradingPost", "Frachtkontor", "Wähle eine Kartenart. Bis zum Ende deines Zuges tauschst du sie 2:1 mit der Bank.", "Wähle eine Kartenart. Bis zum Ende deines Zuges tauschst du sie zwei zu eins mit der Bank."],
      ["peddler", "Wanderhändler", "Setze den Händler auf ein Feld an deiner Siedlung oder Stadt: Rohstoff 2:1 und 1 Siegpunkt.", "Setze den Händler auf ein Feld an deiner Siedlung oder Stadt. Solange er dir gehört, tauschst du dessen Rohstoff zwei zu eins und hast einen Siegpunkt."],
      ["bond", "Schuldschein", "Sieh dir die Hand eines Spielers mit mehr Siegpunkten an und nimm dir 2 Karten.", "Sieh dir die Hand eines Spielers mit mehr Siegpunkten an und nimm dir zwei Karten davon."],
      ["fair", "Jahrmarkt", "Nenne einen Rohstoff. Wer Güter hat, bekommt 1 davon von dir und gibt dir 1 zufälliges Gut.", "Nenne einen Rohstoff. Jeder Mitspieler mit Gütern bekommt eine Karte davon von dir und gibt dir ein zufälliges Gut."],
    ],
  },
  council: {
    kopf: "Die Karten des Rats",
    karten: [
      ["charter", "Stadtrecht", "1 Siegpunkt. Wird sofort offen ausgelegt.", "Ein Siegpunkt, den du sofort offen auslegst."],
      ["alarmBell", "Alarmglocke", "Alle deine ruhenden Wächter werden kostenlos einsatzbereit.", "Alle deine ruhenden Wächter werden kostenlos einsatzbereit."],
      ["agitator", "Unruhestifter", "Wer mindestens so viele Siegpunkte hat wie du, wirft die Hälfte seiner Handkarten ab.", "Wer mindestens so viele Siegpunkte hat wie du, wirft die Hälfte seiner Handkarten ab."],
      ["banquet", "Festbankett", "Wer mehr Siegpunkte hat als du, schenkt dir 2 Handkarten seiner Wahl.", "Wer mehr Siegpunkte hat als du, schenkt dir zwei Handkarten seiner Wahl."],
      ["taxCollector", "Steuereintreiber", "Versetze den Räuber und ziehe bei jedem, der an das Feld grenzt, eine Karte.", "Versetze den Räuber und ziehe bei jedem, der an das Feld grenzt, eine Karte."],
      ["turncoat", "Überläufer", "Nimm einen fremden Wächter vom Brett und stelle einen eigenen derselben Stufe an deine Straße.", "Nimm einen fremden Wächter vom Brett und stelle einen eigenen derselben Stufe an deine Straße."],
      ["envoy", "Gesandter", "Entferne eine offene Straße. Ist es deine eigene, baust du sie gleich kostenlos neu.", "Entferne eine offene Straße. Ist es deine eigene, baust du sie gleich kostenlos neu."],
      ["intrigue", "Ränkespiel", "Verdränge einen fremden Wächter an deiner Straße. Sein Besitzer setzt ihn um.", "Verdränge einen fremden Wächter an deiner Straße. Sein Besitzer setzt ihn um."],
      ["scout", "Kundschafter", "Sieh dir die Einflusskarten eines Mitspielers an und nimm dir eine davon.", "Sieh dir die Einflusskarten eines Mitspielers an und nimm dir eine davon."],
    ],
  },
  scholars: {
    kopf: "Die Karten der Gelehrten",
    karten: [
      ["pulley", "Flaschenzug", "Dein nächster Stadtausbau in diesem Zug kostet ein Gut weniger.", "Dein nächster Stadtausbau in diesem Zug kostet ein Gut weniger."],
      ["pileDriver", "Pfahlramme", "Baue kostenlos eine Palisade unter eine deiner Städte.", "Baue kostenlos eine Palisade unter eine deiner Städte."],
      ["waterwheel", "Wasserrad", "Je Getreidefeld an deinen Siedlungen und Städten bekommst du 2 Getreide.", "Je Getreidefeld an deinen Siedlungen und Städten bekommst du zwei Getreide."],
      ["gallery", "Stollen", "Je Gebirge an deinen Siedlungen und Städten bekommst du 2 Erz.", "Je Gebirge an deinen Siedlungen und Städten bekommst du zwei Erz."],
      ["lodge", "Bauhütte", "Mache eine Siedlung für 2 Erz und 1 Getreide zur Stadt.", "Mache eine Siedlung für zwei Erz und ein Getreide zur Stadt."],
      ["observatory", "Sternwarte", "1 Siegpunkt. Wird sofort offen ausgelegt.", "Ein Siegpunkt, den du sofort offen auslegst."],
      ["surveyor", "Landvermesser", "Baue 2 Straßen kostenlos.", "Baue zwei Straßen kostenlos."],
      ["armory", "Waffenkammer", "Werte bis zu 2 deiner Wächter kostenlos auf.", "Werte bis zu zwei deiner Wächter kostenlos auf."],
      ["fortune", "Losbuch", "Statt zu würfeln: Du legst beide Zahlenwürfel selbst fest, der Ereigniswürfel wird geworfen.", "Spiele die Karte statt zu würfeln. Du legst beide Zahlenwürfel selbst fest, der Ereigniswürfel wird geworfen."],
      ["landReform", "Flurbereinigung", "Tausche zwei Zahlenchips auf dem Brett. 2, 12, 6 und 8 bleiben liegen.", "Tausche zwei Zahlenchips auf dem Brett. Die Zwei, die Zwölf, die Sechs und die Acht bleiben liegen."],
    ],
  },
};

export default async function (d) {
  const b = buehne(d);
  await b.bereit();

  await b.intro("Stadtwacht", "Erweiterung");

  await d.step("Städte", "Mit der Stadtwacht blühen die Städte auf. Draußen auf dem Meer sammelt sich eine Flotte von Plünderern, und nur gemeinsam halten die Städte stand.", async () => {
    await b.spiel("stadtwacht");
  });

  await b.zeige("Neu", "Neu sind Güter, der Stadtausbau mit Prachtstädten, ein dritter Würfel, die Plündererflotte, Wächter, Einflusskarten und Palisaden.", {
    kopf: "Was neu dazukommt",
    layout: "galerie",
    staffel: 700,
    elemente: [
      { bild: bild.karte("cloth"), form: "karte", titel: "Güter", takt: 1 },
      { bild: bild.symbol("city/improve"), form: "symbol", titel: "Stadtausbau", takt: 1 },
      { bild: bild.symbol("city/event-ship"), form: "symbol", titel: "Ereigniswürfel", takt: 1 },
      { bild: bild.figur("raiders"), titel: "Plündererflotte", takt: 1 },
      { bild: bild.figur("guard1-red"), titel: "Wächter", takt: 1 },
      { bild: bild.einfluss("back-council"), form: "karte", titel: "Einflusskarten", takt: 1 },
      { bild: bild.figur("wall"), titel: "Palisaden", takt: 1 },
    ],
  }, 1);

  await b.zeige("Siegziel", "Das Siegziel steigt um drei Punkte, meist auf dreizehn.", {
    kopf: "Was sich ändert",
    layout: "vergleich",
    dicht: true,
    nachher: "Mit Stadtwacht",
    elemente: [
      { titel: "Siegziel", vorher: "10 Punkte", nachher: "3 Punkte mehr, meist 13" },
      { titel: "Aufbau", vorher: "2 Siedlungen", nachher: "1 Siedlung und 1 <b>Stadt</b>" },
      { titel: "Stadt an Wald, Weide, Gebirge", vorher: "2 Rohstoffe", nachher: "1 Rohstoff und 1 <b>Gut</b>" },
      { titel: "Würfel", vorher: "2 Würfel", nachher: "weiß, rot und der Ereigniswürfel" },
      { titel: "Entwicklungskarten", vorher: "kaufen", nachher: "gibt es nicht, dafür <b>Einflusskarten</b>" },
      { titel: "Ritter", vorher: "Größte Rittermacht", nachher: "gibt es nicht, dafür <b>Wächter</b>" },
      { titel: "Räuber", vorher: "von Anfang an", nachher: "erst nach dem ersten Angriff der Flotte" },
      { titel: "Kartenlimit bei einer 7", vorher: "7 Karten", nachher: "7, plus 2 je Palisade" },
    ],
    notiz: { html: "Auch vor dem ersten Angriff gilt bei einer 7: Wer zu viele Karten hat, gibt die Hälfte ab. Nur der Räuber bleibt noch weg.", takt: 9 },
  }, 1);
  await b.weiter("Aufbau", "Beim Aufbau setzt du eine Siedlung und eine Stadt.", 2);
  await b.weiter("Stadt liefert Gut", "Eine Stadt an Wald, Weide oder Gebirge liefert einen Rohstoff und ein Gut.", 3);
  await b.weiter("Drei Würfel", "Gewürfelt wird mit einem weißen, einem roten und dem Ereigniswürfel.", 4);
  await b.weiter("Keine Entwicklungskarten", "Entwicklungskarten gibt es nicht, dafür Einflusskarten.", 5);
  await b.weiter("Keine Ritter", "Auch Ritter und die Größte Rittermacht entfallen, dafür gibt es Wächter.", 6);
  await b.weiter("Räuber später", "Der Räuber kommt erst nach dem ersten Angriff der Flotte ins Spiel.", 7);
  await b.weiter("Kartenlimit", "Bei einer Sieben darfst du sieben Karten halten, plus zwei je Palisade.", 8);
  await b.weiter("Vor dem Angriff", "Auch vor dem ersten Angriff gilt bei einer Sieben: Wer zu viele Karten hat, gibt die Hälfte ab. Nur der Räuber bleibt noch weg.", 9);

  await b.zeige("Güter", "Es gibt drei Güter: Schriften aus dem Wald, Stoff von der Weide und Silber aus dem Gebirge.", {
    kopf: "Güter",
    layout: "liste",
    dicht: true,
    fokus: true,
    elemente: [
      { bild: bild.karte("paper"), form: "karte", titel: "Schriften", html: "aus dem Wald", takt: 1 },
      { bild: bild.karte("cloth"), form: "karte", titel: "Stoff", html: "von der Weide", takt: 1 },
      { bild: bild.karte("silver"), form: "karte", titel: "Silber", html: "aus dem Gebirge", takt: 1 },
      { html: "Güter entstehen nur in <b>Städten</b>: an Wald, Weide oder Gebirge 1 Rohstoff und 1 Gut.", takt: 2 },
      { html: "An Hügel und Acker bleibt es bei 2 Rohstoffen. Siedlungen liefern wie gewohnt.", takt: 3 },
      { html: "Güter brauchst du für den <b>Stadtausbau</b>. Sonst zählen sie wie Rohstoffe zur Hand.", takt: 4 },
    ],
    notiz: { label: "Tipp", html: "Baue früh Städte an Wald, Weide oder Gebirge. Ohne Güter kommst du beim Ausbau nicht voran.", takt: 5 },
  }, 1);
  await b.weiter("Nur Städte", "Güter entstehen nur in Städten. Steht eine Stadt an Wald, Weide oder Gebirge, bekommt sie bei einem Treffer einen Rohstoff und ein Gut.", 2);
  await b.weiter("Hügel und Acker", "An Hügel und Acker bleibt es bei zwei Rohstoffen. Siedlungen liefern wie gewohnt.", 3);
  await b.weiter("Wie Rohstoffe", "Güter brauchst du für den Stadtausbau. Sonst verhalten sie sich wie Rohstoffe: Sie zählen zu deiner Hand, du kannst sie handeln, und der Räuber kann sie stehlen.", 4);
  await b.weiter("Tipp Güter", "Ein Tipp: Baue früh Städte an Wald, Weide oder Gebirge. Ohne Güter kommst du beim Ausbau nicht voran.", 5);

  await b.zeige("Richtungen", "Deine Städte baust du in drei Richtungen aus: den Markt mit Stoff, den Rat mit Silber und die Gelehrten mit Schriften.", {
    kopf: "Stadtausbau",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("city/market"), titel: "Markt", html: "mit Stoff", takt: 1 },
      { bild: bild.symbol("city/council"), titel: "Rat", html: "mit Silber", takt: 1 },
      { bild: bild.symbol("city/scholars"), titel: "Gelehrte", html: "mit Schriften", takt: 1 },
      { wert: "5 Stufen", html: "Stufe 1 kostet 1 Gut, Stufe 2 kostet 2 und so weiter. Du brauchst mindestens eine Stadt.", takt: 2 },
    ],
    notiz: { label: "Beispiel", html: "Um den Rat von 0 auf Stufe 3 zu bringen, zahlst du nacheinander 1, 2 und 3 Silber, zusammen 6.", takt: 3 },
  }, 1);
  await b.weiter("Stufen", "Jede Richtung hat fünf Stufen. Jede Stufe kostet so viele Güter, wie ihre Zahl sagt. Dafür brauchst du mindestens eine Stadt.", 2);
  await b.weiter("Beispiel Rat", "Um den Rat von null auf Stufe drei zu bringen, zahlst du nacheinander eins, zwei und drei Silber, zusammen sechs.", 3);

  await b.zeige("Fähigkeiten", "Ab Stufe drei bekommst du eine Fähigkeit dazu. Mit dem Markt tauschst du Güter zwei zu eins mit der Bank.", {
    kopf: "Ab Stufe 3",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("city/market"), titel: "Markt", html: "Güter tauschst du <b>2:1</b> mit der Bank." },
      { bild: bild.symbol("city/council"), titel: "Rat", html: "Deine Wächter dürfen bis <b>Stufe 3</b> aufsteigen." },
      { bild: bild.symbol("city/scholars"), titel: "Gelehrte", html: "Bekommst du bei einem Wurf außer der 7 nichts, nimmst du dir <b>einen Rohstoff deiner Wahl</b>." },
    ],
  }, 1);
  await b.weiter("Rat Fähigkeit", "Mit dem Rat dürfen deine Wächter bis Stufe drei aufsteigen.", 2);
  await b.weiter("Gelehrte Fähigkeit", "Mit den Gelehrten nimmst du dir einen Rohstoff deiner Wahl, wenn du bei einem Wurf außer der Sieben nichts bekommst.", 3);

  await b.zeige("Prachtstadt", "Wer in einer Richtung zuerst Stufe vier erreicht, macht eine Stadt zur Prachtstadt.", {
    kopf: "Prachtstädte",
    layout: "bild",
    szene: "metropolis",
    fokus: true,
    elemente: [
      { html: "Wer in einer Richtung zuerst <b>Stufe 4</b> erreicht, macht eine Stadt zur Prachtstadt." },
      { html: "Sie bringt <b>2 Punkte extra</b>, und die Flotte kann sie nicht nehmen." },
      { html: "Wer später <b>Stufe 5</b> erreicht, nimmt sie einem Inhaber ab, der nur Stufe 4 hat." },
    ],
  }, 1);
  await b.weiter("Prachtstadt Punkte", "Sie bringt zwei Punkte extra, und die Flotte kann sie nicht nehmen.", 2);
  await b.weiter("Stufe fünf", "Wer später Stufe fünf erreicht, nimmt sie einem Inhaber ab, der nur Stufe vier hat.", 3);

  await b.zeige("Ereigniswürfel", "Bei jedem Wurf rollt ein dritter Würfel mit, der Ereigniswürfel. Auf drei Seiten zeigt er ein Schiff, auf den anderen ein gelbes, blaues oder grünes Tor.", {
    kopf: "Der Ereigniswürfel",
    layout: "galerie",
    staffel: 600,
    elemente: [
      { bild: bild.symbol("city/event-ship"), form: "symbol", titel: "Schiff", html: "3 Seiten: die Flotte kommt näher", takt: 1 },
      { bild: bild.symbol("city/event-market"), form: "symbol", titel: "Gelbes Tor", html: "Karten des Markts", takt: 1 },
      { bild: bild.symbol("city/event-council"), form: "symbol", titel: "Blaues Tor", html: "Karten des Rats", takt: 1 },
      { bild: bild.symbol("city/event-scholars"), form: "symbol", titel: "Grünes Tor", html: "Karten der Gelehrten", takt: 1 },
    ],
    notiz: { html: "Die beiden Zahlenwürfel liefern wie gewohnt. Der <b>rote</b> spielt bei den Einflusskarten eine Rolle.", takt: 2 },
  }, 1);
  await b.weiter("Schiff und Tor", "Zeigt er ein Schiff, kommt die Flotte näher. Zeigt er ein Tor, gibt es Einflusskarten in dieser Farbe. Die Zahlenwürfel liefern wie gewohnt, der rote spielt bei den Einflusskarten eine Rolle.", 2);

  await b.zeige("Flotte", "Jedes Schiff auf dem Ereigniswürfel rückt die Plündererflotte ein Feld vor.", {
    kopf: "Die Plündererflotte",
    layout: "bild",
    szene: "raiders",
    fokus: true,
    elemente: [
      { html: "Jedes <b>Schiff</b> auf dem Ereigniswürfel rückt die Flotte ein Feld vor." },
      { html: "Auf dem <b>siebten Feld</b> greift sie an, noch bevor die Felder liefern." },
    ],
  }, 1);
  await b.weiter("Angriff kommt", "Auf dem siebten Feld greift sie an, noch bevor die Felder liefern.", 2);

  await b.zeige("Stärke", "Beim Angriff werden zwei Zahlen verglichen. Die Flotte ist so stark, wie es Städte auf der Insel gibt, Prachtstädte mitgezählt.", {
    kopf: "Der Angriff",
    layout: "liste",
    dicht: true,
    fokus: true,
    elemente: [
      { bild: bild.figur("raiders"), titel: "Flotte", html: "so stark, wie es Städte auf der Insel gibt, Prachtstädte mitgezählt" },
      { bild: bild.figur("guard2-red"), titel: "Verteidigung", html: "Summe der Stufen aller <b>einsatzbereiten</b> Wächter, von allen zusammen" },
      { wert: "Flotte stärker", html: "Wer am wenigsten beigetragen hat, verliert eine <b>gewöhnliche Stadt</b>, sie wird zur Siedlung. Prachtstädte sind sicher." },
      { bild: bild.symbol("city/honor"), titel: "Verteidigung hält", html: "Wer am meisten beigetragen hat, bekommt einen <b>Ehrenschild</b>, 1 Punkt. Bei Gleichstand zieht jeder der Besten eine Einflusskarte." },
      { html: "Danach ruhen alle Wächter wieder, und die Flotte fängt vorn an." },
    ],
    notiz: { label: "Beispiel", html: "5 Städte, die Flotte hat Stärke 5. Rot hat bereite Wächter der Stufen 2 und 1, Blau einen der Stufe 2: zusammen 5, Gleichstand reicht. Rot hat mit 3 am meisten beigetragen und bekommt den Ehrenschild.", takt: 6 },
  }, 1);
  await b.weiter("Verteidigung", "Die Verteidigung ist die Summe der Stufen aller einsatzbereiten Wächter, von allen Spielern zusammen.", 2);
  await b.weiter("Flotte stärker", "Ist die Flotte stärker, verliert der Spieler eine Stadt, der am wenigsten zur Verteidigung beigetragen hat. Sie wird wieder zur Siedlung. Das trifft nur Spieler mit einer gewöhnlichen Stadt, Prachtstädte sind sicher.", 3);
  await b.weiter("Verteidigung hält", "Hält die Verteidigung, bekommt der Spieler mit dem größten Beitrag einen Ehrenschild, also einen Siegpunkt. Bei Gleichstand zieht jeder der Besten eine Einflusskarte.", 4);
  await b.weiter("Danach", "Nach jedem Angriff ruhen alle Wächter und müssen neu bereit gemacht werden. Die Flotte fängt wieder vorn an.", 5);
  await b.weiter("Beispiel Angriff", "Ein Beispiel: Auf der Insel stehen fünf Städte, die Flotte hat Stärke fünf. Rot hat bereite Wächter der Stufen zwei und eins, Blau einen der Stufe zwei. Das ergibt fünf, Gleichstand reicht zur Abwehr. Rot hat am meisten beigetragen und bekommt den Ehrenschild.", 6);

  await b.zeige("Wächter", "Wächter gibt es in drei Stufen. Für sie gibt es drei Handgriffe.", {
    kopf: "Wächter",
    layout: "liste",
    fokus: true,
    alleSichtbar: true,
    elemente: [
      { bild: bild.figur("guard1-red"), titel: "Aufstellen", html: "auf eine Ecke an deiner Straße, zuerst Stufe 1", kosten: { sheep: 1, ore: 1 }, takt: 2 },
      { bild: bild.symbol("city/guard-upgrade"), titel: "Aufwerten", html: "eine Stufe höher, bis Stufe 2, mit Rat 3 bis Stufe 3", kosten: { sheep: 1, ore: 1 }, takt: 3 },
      { bild: bild.symbol("city/guard-activate"), titel: "Bereit machen", html: "nur bereite Wächter verteidigen", kosten: { wheat: 1 }, takt: 4 },
    ],
  });
  await b.weiter("Aufstellen", "Einen Wächter stellst du für Wolle und Erz auf eine Ecke an deiner Straße.", 2);
  await b.weiter("Aufwerten", "Für noch einmal Wolle und Erz wertest du ihn eine Stufe auf.", 3);
  await b.weiter("Bereit machen", "Für ein Getreide machst du ihn bereit. Nur bereite Wächter verteidigen.", 4);

  await b.zeige("Ruhen", "Ein neuer Wächter ruht erst einmal. Erst wenn du ihn bereit machst, zählt er für die Verteidigung.", {
    kopf: "Was Wächter tun",
    layout: "liste",
    dicht: true,
    fokus: true,
    elemente: [
      { bild: bild.figur("guard1-red"), html: "Ein neuer Wächter <b>ruht</b>. Erst <b>bereit gemacht</b> zählt er für die Verteidigung." },
      { html: "Ab deinem nächsten Zug kann ein bereiter Wächter <b>einmal handeln</b> und ruht danach wieder:" },
      { bild: bild.symbol("city/guard-move"), titel: "Ziehen", html: "entlang deiner Straßen auf eine andere Ecke" },
      { bild: bild.figur("guard2-red"), titel: "Verdrängen", html: "einen schwächeren fremden Wächter" },
      { bild: bild.symbol("city/guard-chase"), titel: "Räuber vertreiben", html: "von einem Feld neben dem Wächter" },
    ],
    notiz: { html: "Wächter besetzen ihre Ecke, dort darf niemand bauen. Fremde Straßen werden an einem Wächter unterbrochen. Je Stufe hat jeder 2 Wächter.", takt: 6 },
  }, 1);
  await b.weiter("Einmal handeln", "Ab deinem nächsten Zug kann er außerdem einmal handeln und ruht danach wieder.", 2);
  await b.weiter("Ziehen", "Er zieht entlang deiner Straßen auf eine andere Ecke,", 3);
  await b.weiter("Verdrängen", "verdrängt einen schwächeren fremden Wächter,", 4);
  await b.weiter("Räuber vertreiben", "oder vertreibt den Räuber von einem Feld daneben.", 5);
  await b.weiter("Ecke besetzt", "Wächter besetzen ihre Ecke, dort darf niemand bauen. Fremde Straßen werden an einem Wächter unterbrochen. Je Stufe hat jeder zwei Wächter.", 6);

  await b.zeige("Einflusskarten", "Einflusskarten gibt es in drei Farben: gelb für den Markt, blau für den Rat und grün für die Gelehrten. Sie ersetzen die Entwicklungskarten, kaufen kannst du sie nicht.", {
    kopf: "Einflusskarten",
    layout: "galerie",
    staffel: 500,
    elemente: [
      { bild: bild.einfluss("back-market"), form: "karte", titel: "Markt", takt: 1 },
      { bild: bild.einfluss("back-council"), form: "karte", titel: "Rat", takt: 1 },
      { bild: bild.einfluss("back-scholars"), form: "karte", titel: "Gelehrte", takt: 1 },
    ],
    notiz: { html: "Zeigt der Ereigniswürfel ein <b>Tor</b>, zieht jeder eine Karte dieser Farbe, dessen Ausbau in dieser Richtung hoch genug ist für den <b>roten Würfel</b>.", takt: 2 },
  }, 1);
  await b.weiter("Tor", "Du bekommst sie, wenn der Ereigniswürfel ein Tor zeigt: Dann zieht jeder eine Karte dieser Farbe, dessen Ausbau in dieser Richtung hoch genug ist für den roten Würfel.", 2);

  await b.zeige("Beispiel Tor", "Ein Beispiel: Das blaue Tor fällt, der rote Würfel zeigt drei. Wer den Rat auf Stufe zwei oder höher hat, zieht eine blaue Karte. Mit Stufe eins bräuchte es eine rote Eins oder Zwei, ohne Rat gibt es keine Karte.", {
    kopf: "Einflusskarten bekommen und spielen",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.symbol("city/event-council"), titel: "Beispiel", html: "Blaues Tor, rot zeigt 3: Rat ab Stufe 2 zieht. Stufe 1 braucht rot 1 oder 2, ohne Rat keine Karte." },
      { wert: "4", html: "Du hältst <b>höchstens 4</b> Karten. Wer 4 hat, zieht keine weitere." },
      { html: "<b>Punktkarten</b> legst du sofort offen aus." },
      { html: "Gespielt wird in deinem Zug <b>nach dem Würfeln</b>, so viele du willst. Nur das <b>Losbuch</b> spielst du statt zu würfeln." },
    ],
  }, 1);
  await b.weiter("Höchstens vier", "Du hältst höchstens vier Karten. Wer vier hat, zieht keine weitere.", 2);
  await b.weiter("Punktkarten", "Punktkarten legst du sofort offen aus.", 3);
  await b.weiter("Ausspielen", "Gespielt wird in deinem Zug nach dem Würfeln, so viele du willst. Nur das Losbuch spielst du statt zu würfeln.", 4);

  await b.zeige("Palisade", "Eine Palisade kostet zwei Lehm und kommt unter eine eigene Stadt, höchstens drei.", {
    kopf: "Palisade und Händler",
    layout: "liste",
    fokus: true,
    elemente: [
      { bild: bild.figur("wall"), titel: "Palisade", html: "unter eine eigene Stadt, höchstens 3", kosten: { brick: 2 } },
      { html: "Jede Palisade erlaubt dir bei einer 7 <b>zwei Karten mehr</b>. Verlierst du die Stadt an die Flotte, ist auch die Palisade weg." },
      { bild: bild.figur("trader-red"), titel: "Händler", html: "Mit der Karte Wanderhändler auf ein Feld an deiner Siedlung oder Stadt: dessen Rohstoff <b>2:1</b> und <b>1 Punkt</b>." },
      { html: "Spielt jemand anderes den Wanderhändler, <b>nimmt er dir den Händler ab</b>." },
    ],
  }, 1);
  await b.weiter("Zwei Karten mehr", "Jede Palisade erlaubt dir bei einer Sieben zwei Karten mehr auf der Hand. Verlierst du die Stadt an die Flotte, ist auch die Palisade weg.", 2);
  await b.weiter("Händler", "Den Händler setzt du mit der Karte Wanderhändler auf ein Feld an deiner Siedlung oder Stadt. Solange er dir gehört, tauschst du den Rohstoff dieses Feldes zwei zu eins und hast einen Punkt mehr.", 3);
  await b.weiter("Händler abnehmen", "Spielt jemand anderes die Karte, nimmt er dir den Händler ab.", 4);

  for (const farbe of ["market", "council", "scholars"]) {
    const { kopf, karten } = KARTEN[farbe];
    const folie = {
      kopf,
      layout: "karten",
      fokus: true,
      alleSichtbar: true,
      elemente: karten.map(([art, titel, text]) => ({ bild: bild.einfluss(art), titel, html: text })),
    };
    for (const [i, [, titel, , gesprochen]] of karten.entries()) {
      if (i === 0) await b.zeige(titel, `${titel}: ${gesprochen}`, folie, 1);
      else await b.weiter(titel, `${titel}: ${gesprochen}`, i + 1);
    }
  }

  await b.outro("Haltet die Stadt!", "Das war die Stadtwacht");
}
