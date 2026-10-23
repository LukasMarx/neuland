# Erklärvideos

Acht kurze Clips zum Grundspiel, ohne Erweiterungen. Aufgenommen mit dem Claude-Code-Plugin `demo-video` gegen die Bühne der App unter `#/erklaer`.

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

## Wie es funktioniert

- Die Bühne (`src/app/ui/erklaer/`) zeigt Titelkarten, Erklärszenen und die echte Spielansicht, verbunden durch eine Sechseck-Blende. Sie braucht kein Netz und kein Passwort.
- Die Spielstände kommen aus `spielstand.ts`: fester Seed, der Bot setzt für alle, dann gezielte Eingriffe (Karten, Würfel). Jeder Clip sieht bei jeder Aufnahme gleich aus.
- Jede `journey.mjs` steuert die Bühne über `window.erklaer` und klickt im echten Spiel. Gemeinsame Handgriffe liegen in `buehne.mjs`.
- Die Stimme ist die lebhafte Thorsten-Stimme des Plugins (`export const lively = true`).

## Neu aufnehmen

1. Dev-Server auf Port 4330 starten: `npx ng serve --port 4330`
2. In Claude Code: „Nimm videos/04-bauen neu auf“ (das Plugin `demo-video` muss aktiv sein).

Die MP4-Dateien landen unter `~/DemoVideos/<clip>.mp4`. Text ändern heißt: Erzählung in der `journey.mjs` ändern und neu aufnehmen.
