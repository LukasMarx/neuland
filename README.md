# Neuland

Ein Brettspiel um Rohstoffe, Handel und Siedlungen auf einer Insel aus Sechseckfeldern, im Browser für 2–6 Spieler. Kein Login, kein eigener Server: Ein Spieler eröffnet einen Raum und schickt den Link herum, die Browser verbinden sich direkt per WebRTC.

Wie das Ganze aufgebaut ist und warum, steht in [docs/KONZEPT.md](docs/KONZEPT.md).

Die verbindliche Schriftwahl **Nunito Sans** und ihre Verwendung sind in
[docs/TYPOGRAFIE.md](docs/TYPOGRAFIE.md) dokumentiert.

## Zugang

Die Seite ist privat und fragt beim ersten Besuch ein Passwort ab (Groß-/Kleinschreibung egal). Das Passwort bekommt ihr intern, es steht absichtlich nirgends im Repository. Der Browser merkt es sich. Das Passwort ist zugleich der Schlüssel für den P2P-Verbindungsaufbau: Wer es nicht kennt, kommt in keinen Raum, auch wenn er die Abfrage umgeht.

Passwort ändern: Hash erzeugen und in `src/app/net/access.ts` bei `PASSWORD_HASH` eintragen.

```bash
printf '%s' neuespasswort | shasum -a 256
```

## Entwickeln

```bash
npm install
```

```bash
npm start
```

Danach läuft die App unter http://localhost:4200.

- **Mehrere Spieler im selben Browser:** Normalerweise ist ein Browser ein Spieler, auch über mehrere Tabs. Mit `?tab` in der URL (z. B. `http://localhost:4200/?tab#/KX7Q2M`) bekommt jeder Tab eine eigene Identität, so lassen sich mehrere Spieler in einem Browser testen.
- **Ohne Internet testen:** `http://localhost:4200/?local` verbindet die Tabs über `BroadcastChannel` statt über P2P (jeder Tab ist dabei ein eigener Spieler).
- **Konsole:** Im Entwicklungsmodus liegen Raum-Service und Engine unter `window.neuland` (z. B. `neuland.room.game()`).
- **Ton** ist im Entwicklungsmodus standardmäßig aus und lässt sich über die Glocke einschalten.

## Tests

```bash
npx ng test --watch=false
```

Die Tests decken die Spiel-Engine ab (`src/app/engine/*.spec.ts`).

## Build und Hosting

```bash
npx ng build
```

Das Ergebnis in `dist/neuland/browser` ist eine rein statische Seite.

Veröffentlicht wird automatisch über GitHub Pages: Jeder Push auf `main` testet, baut und deployt (`.github/workflows/deploy.yml`). Einmalig muss im Repository unter **Settings → Pages → Source** „GitHub Actions“ ausgewählt sein. Die Seite liegt dann unter https://lukas-marx.com/neuland/ (GitHub leitet `lukasmarx.github.io` auf diese Domain um).

Grundsätzlich läuft sie auf jedem Static Hosting (GitHub/GitLab Pages, Netlify, Cloudflare Pages …), auch in einem Unterverzeichnis, weil die App Hash-Routing und relative Pfade nutzt.

## Wenn Spieler sich nicht verbinden können

Manche Firmennetze oder VPNs blockieren direkte WebRTC-Verbindungen. Dann einen TURN-Server in `src/app/net/trystero-transport.ts` unter `TURN_SERVERS` eintragen, z. B. von Cloudflare (Gratiskontingent) oder Open Relay von Metered.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/app/engine` | Spielregeln als reines TypeScript, ohne Angular |
| `src/app/net` | Transport (Trystero/P2P bzw. BroadcastChannel), Lobby, Host-Logik, Host-Wechsel, Speichern |
| `src/app/ui` | Angular-Komponenten: Startseite, Lobby, Spielbrett (SVG), Spielansicht, Handel |
