# Erklärvideos

Acht kurze Clips zum Grundspiel und je ein Clip pro Erweiterung. Aufgenommen mit dem Claude-Code-Plugin `demo-video` gegen die Bühne der App unter `#/erklaer`.

| Clip | Inhalt |
|---|---|
| `01-worum-gehts` | Insel, Rohstoffe, Zahlen, Siegpunkte |
| `02-aufbau` | Aufbauphase, Abstandsregel, Startrohstoffe |
| `03-wuerfeln` | Würfeln, Ertrag, Zug beenden |
| `04-bauen` | Baukosten, Straße, Siedlung, Stadt |
| `05-handeln` | Tauschtisch, Bank und Häfen |
| `06-raeuber` | Die Sieben, Abwerfen, Räuber |
| `07-entwicklung` | Entwicklungskarten |
| `08-sieg` | Längste Handelsstraße, Größte Rittermacht, Sieg |
| `09-grosse-runde` | 5 bis 8 Spieler, Sonderbauphase |
| `10-seewege` | Schiffe, Kaperschiff, Gold, Inselbonus, Nebel |
| `11-stadtwacht` | Güter, Stadtausbau, Flotte, Wächter, alle Einflusskarten |
| `12-fischgruende` | See, Fischgründe, Fische ausgeben, Rostiger Anker |
| `13-flusslaeufe` | Brücken, Münzen, Reichster und Bettler |
| `14-duell` | Neutrale, Handelsmarken |
| `15-hausregeln` | Milder Räuber, Hafenvogt, Würfelstapel |

Die Erweiterungen erklären alle Regeln aus dem Regelbuch, fast nur mit Folien statt im laufenden Spiel.

## Wie es funktioniert

- Die Bühne (`src/app/ui/erklaer/`) zeigt Titelkarten, Erklärszenen und die echte Spielansicht, verbunden durch eine Sechseck-Blende. Sie braucht kein Netz und kein Passwort.
- Die Spielstände kommen aus `spielstand.ts`: fester Seed, der Bot setzt für alle, dann gezielte Eingriffe (Karten, Würfel). Jeder Clip sieht bei jeder Aufnahme gleich aus.
- Jede `journey.mjs` steuert die Bühne über `window.erklaer` und klickt im echten Spiel. Gemeinsame Handgriffe liegen in `buehne.mjs`.
- Folien (`folie.ts`) bekommen ihren Inhalt als Daten aus der Journey: Vergleich Grundspiel → jetzt, Liste, Galerie, Kartenraster oder ein Brettausschnitt aus dem Regelbuch mit Stichpunkten. Jeder Satz der Stimme deckt einen Takt auf.
- Fürs Regelbuch liegen MP4 und Standbild unter `public/web/videos/` und stehen in `src/app/ui/rulebook/rule-videos.ts`.
- Die Stimme ist die lebhafte Thorsten-Stimme des Plugins (`export const lively = true`).

## Neu aufnehmen

1. Dev-Server auf Port 4330 starten: `npx ng serve --port 4330`
2. In Claude Code: „Nimm videos/04-bauen neu auf“ (das Plugin `demo-video` muss aktiv sein).

Die MP4-Dateien landen unter `~/DemoVideos/<clip>.mp4`. Text ändern heißt: Erzählung in der `journey.mjs` ändern und neu aufnehmen.
