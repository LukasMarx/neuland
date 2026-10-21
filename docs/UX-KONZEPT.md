# Neuland – UX/UI-Konzept

Für das gesamte Spiel gilt die festgelegte Schriftfamilie **Nunito Sans**.
Schriftwahl, Verwendung und lokale Einbindung: [TYPOGRAFIE.md](TYPOGRAFIE.md).

## Was am ersten Stand nicht gut ist

Ausgangspunkt ist ein Screenshot aus einer echten Partie (2 Spieler, Lukas am Zug nach einer 7).

| Problem | Warum es stört |
|---|---|
| Würfel sind zwei winzige Unicode-Zeichen in der Kopfzeile | Würfeln ist der emotionale Moment jedes Zugs, und man sieht ihn kaum. Wer nicht hinschaut, verpasst, was gefallen ist. |
| Nach dem Wurf passiert auf dem Brett nichts | Man muss im Verlauf nachlesen, welche Felder geliefert haben und wer was bekommt. |
| Die Hauptaktion wechselt den Ort | „Würfeln“ schwebt über dem Brett, „Zug beenden“ steht rechts in der Seitenleiste. Man sucht jedes Mal. |
| Die Hand steckt klein in der Seitenleiste | Die eigenen Karten sind das Wichtigste, was man selbst hat. Sie gehören groß in den Blick wie bei Kartenspielen. |
| Ausgegraute Bau-Buttons erklären nichts | Man sieht nicht, was fehlt („1 Lehm fehlt“). |
| Bank-Handel aus zehn blassen Mini-Buttons | Schwer zu lesen, nimmt dauerhaft Platz weg, obwohl man ihn selten braucht. |
| Spielerliste mit kryptischen Mini-Icons | Siegpunkte, Kartenzahl und Sonderkarten sind schwer zu erfassen. |
| Kein Moment für „Du bist dran“ | Nur der Tab-Titel ändert sich. |
| Beim Bauen keine Vorschau | Man klickt auf weiße Punkte und sieht erst danach, was entstanden ist. |
| Viel Leerraum links und rechts vom Brett | Das Brett ist breit genug, die Bedienelemente aber gequetscht. |

## Leitlinien

1. **Ein Ort für die nächste Aktion.** Unten rechts sitzt immer der große Hauptknopf: Würfeln → Zug beenden → Fertig (Sonderbauphase). Leertaste löst ihn aus.
2. **Das Brett erzählt, was passiert.** Würfe, Erträge, Räuber und neue Gebäude sieht man auf dem Brett, nicht nur im Verlauf.
3. **Die eigene Hand ist der Star.** Eine Leiste unten wie bei Kartenspielen: große Rohstoffkarten in Feldfarben, Entwicklungskarten daneben, Bauen direkt darunter.
4. **Was nicht geht, sagt warum.** Gesperrte Aktionen zeigen die fehlenden Rohstoffe.
5. **Weniger dauerhaft, mehr bei Bedarf.** Handel öffnet sich als Dialog. Angebote anderer Spieler erscheinen als Karten über dem Brett, dort, wo man ohnehin hinschaut.
6. **Jede Änderung an der Hand ist spürbar.** Neue Karten zeigen kurz „+2“, verlorene „−1“.
7. **Tastatur für Vielspieler.** Leertaste, S/R/C/E für Siedlung, Straße, Stadt, Entwicklung, H für Handel, Esc zum Abbrechen.

## Würfeln

- **Würfel:** zwei große 3D-Würfel mit echten Augen, unten rechts am Brett neben dem Hauptknopf. Wer dran ist, sieht sie leicht wackeln; Klick auf die Würfel oder Leertaste würfelt.
- **Ablauf für alle gleichzeitig:** Die Würfel taumeln etwa eine Sekunde und landen auf dem Ergebnis. Danach erscheint die Summe als Plakette, und die Felder mit dieser Zahl leuchten zwei Sekunden lang auf. So sieht jeder auf einen Blick, wo es Erträge gab.
- **7:** Die Summe wird rot. Das Räuber-Feld blinkt, und der aktive Spieler bekommt die möglichen Ziel-Felder markiert.
- **Ton:** kurzes Würfelklappern, erzeugt per Web Audio ohne Sounddatei. Er folgt dem Glocken-Schalter (beim Entwickeln standardmäßig aus).
- Das Ergebnis steht danach weiter sichtbar neben dem Hauptknopf, bis zum nächsten Wurf.

## Layout

```
┌──────────────────────────────────────────────┬───────────────────┐
│ ⬢ Neuland · Raum KX7Q2M          🔔  Verlassen │                   │
├──────────────────────────────────────────────┤  Spielerkarten    │
│   ( ● Lukas ist am Zug · Handeln und bauen ) │  (aktiver Spieler │
│                                    [Angebote]│   hervorgehoben)  │
│                 SPIELBRETT                   │                   │
│                                              ├───────────────────┤
│                                              │  Verlauf │ Chat   │
├──────────────────────────────────────────────┤                   │
│ [🌲2][🧱1][🐑0][🌾0][🪨1] [⚔️ Ritter]  ⚄⚂ 7  │                   │
│ [Straße][Siedlung][Stadt][Entw.][Handeln]  [ ZUG BEENDEN ] │      │
└──────────────────────────────────────────────┴───────────────────┘
```

- Oben auf dem Brett eine Status-Pille in der Farbe des aktiven Spielers.
- Unten die Hand-Leiste über die Breite des Bretts.
- Rechts die Spielerkarten und darunter Verlauf und Chat.
- Auf schmalen Bildschirmen wandert die rechte Spalte unter die Hand-Leiste.

## Brett

- **Bau-Vorschau:** Im Baumodus zeigt Hover über einem erlaubten Platz die Figur halbtransparent in der eigenen Farbe.
- **Treffer:** Felder mit der gewürfelten Zahl leuchten nach dem Wurf kurz auf.
- **Räuber versetzen:** Erlaubte Felder pulsieren, Hover zeigt den Räuber als Vorschau.

## Spielerkarten

- Name, Farbe und groß die Siegpunkte.
- Darunter klar beschriftet: Karten auf der Hand, Entwicklungskarten, Ritter, Straßenlänge.
- „Längste Straße“ und „Rittermacht“ als goldene Abzeichen mit Text, nicht nur als Hervorhebung.
- Der aktive Spieler hat einen pulsierenden Rahmen und das Label „am Zug“. Getrennte Spieler werden grau mit „getrennt“.

## Handel

- **„Handeln“** in der Bauleiste (Taste H) öffnet einen Dialog mit zwei Bereichen:
  - **Bank & Häfen:** Rohstoffe als große Karten mit Kurs („4:1“, „2:1“), wählen, was man gibt und was man bekommt, fertig.
  - **Mitspieler:** Angebot zusammenstellen und an alle schicken (bzw. als Gegenangebot an den aktiven Spieler).
- **Offene Angebote** schweben als Karten oben rechts über dem Brett, mit Annehmen/Ablehnen bzw. „Handeln mit …“.

## Rückmeldung

- **„Du bist dran!“** blendet groß über dem Brett ein, plus optional ein Ton.
- **Hand-Änderungen** zeigen „+n“/„−n“-Plaketten auf den Karten.
- **Fliegende Karten für alle:** Jede Kartenbewegung ist bei allen Spielern als Flug zu sehen.
  - Ertrag fliegt vom Feld zum Spieler, und zwar erst, wenn die Würfel gelandet sind.
  - Baukosten fliegen zum neuen Bauplatz.
  - Bank-Handel, Erfindung und Entwicklungskarten fliegen von oder zur Bank-Anzeige oben links.
  - Handel, Monopol und Räuber fliegen von Spieler zu Spieler.
  - Beim Räuber sehen nur die beiden Beteiligten, welche Karte es war. Alle anderen sehen eine verdeckte Karte.
  - Die Engine protokolliert dafür pro Aktion die Bewegungen (`GameState.transfers`).
- **Siegerbildschirm** mit Konfetti.
