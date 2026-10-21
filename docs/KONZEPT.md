# Neuland – Konzept

Ein Brettspiel für Remote-Teams: Rohstoffe sammeln, handeln, Straßen und Siedlungen bauen, auf einer Insel aus Sechseckfeldern. Ein Link genügt: man öffnet ihn, gibt einen Namen ein und sitzt in der Lobby. Es gibt keinen Login und keinen eigenen Server.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Spielerzahl | 2–6. Ab 5 Spielern gelten die Regeln der offiziellen 5–6-Erweiterung. |
| Netzwerk | Peer-to-Peer über WebRTC. Der Browser des Gastgebers ist die Spielleitung. |
| Verbindungsaufbau | [Trystero](https://github.com/dmotz/trystero) über öffentliche Nostr-Relays. Nur der Verbindungsaufbau läuft darüber, Spieldaten gehen direkt und verschlüsselt zwischen den Browsern. |
| Frontend | Angular + TypeScript, Spielbrett als SVG |
| Hosting | Rein statische Seite (GitHub/GitLab Pages, Netlify, Cloudflare Pages …). Wo genau, entscheiden wir später. |
| Sprache | Deutsch |

## Ablauf für die Spieler

1. **Spiel erstellen:** Jemand öffnet die Seite, gibt seinen Namen ein und klickt „Neues Spiel“. Er bekommt einen 6-stelligen Raumcode (z. B. `KX7Q2M`) und einen Link (`…/#/KX7Q2M`), den er in den Team-Chat kopiert.
2. **Beitreten:** Die anderen öffnen den Link oder geben den Code ein, tippen ihren Namen und landen in der Lobby. Dort sehen alle, wer da ist, und können ihre Farbe wählen.
3. **Starten:** Der Gastgeber legt die Siegpunkte fest (Standard 10) und startet. Die Sitzreihenfolge wird ausgelost. Bei 5–6 Spielern wird automatisch das große Brett verwendet.
4. **Spielen:** Ganz normal nach den Regeln (siehe unten). Ein Ereignisprotokoll und ein kleiner Chat laufen am Rand mit.
5. **Abbrüche:** Lädt jemand die Seite neu oder fliegt raus, kommt er über denselben Link zurück auf seinen Platz. Der Browser merkt sich dafür eine zufällige Spieler-ID. Verliert der Gastgeber die Verbindung, übernimmt automatisch ein anderer Spieler (siehe „Host-Wechsel“).

## Spielregeln

### Umfang der ersten Version

Komplettes Basisspiel:

- Aufbauphase in Schlangenreihenfolge (1→n, n→1). Die zweite Siedlung bringt Starterrohstoffe.
- Würfeln und Rohstoffertrag. Wenn die Bank von einem Rohstoff nicht genug für alle hat, bekommt niemand etwas davon, außer es ist nur ein Spieler betroffen; der bekommt den Rest.
- Räuber bei einer 7: Wer mehr als 7 Karten hat, wirft die Hälfte ab (alle gleichzeitig). Danach versetzt der aktive Spieler den Räuber und zieht eine Karte bei einem Nachbarn.
- Bauen: Straße, Siedlung, Stadt, Entwicklungskarte. Abstandsregel und Limits (15 Straßen, 5 Siedlungen, 4 Städte).
- Handel mit der Bank (4:1), über Häfen (3:1 / 2:1) und mit Mitspielern.
- Entwicklungskarten: Ritter, Straßenbau, Erfindung, Monopol, Siegpunkt. Pro Zug darf eine gespielt werden, nicht in dem Zug, in dem sie gekauft wurde (Siegpunktkarten zählen sofort). Wie in der aktuellen Regel-Edition darf jede Entwicklungskarte auch schon vor dem Würfeln gespielt werden.
- Längste Handelsstraße (ab 5) und größte Rittermacht (ab 3), je 2 Siegpunkte.
- Sieg: Wer im eigenen Zug die Zielpunktzahl erreicht, gewinnt.

### Handel unter Spielern

Der aktive Spieler stellt ein Angebot ein („gebe 2 Holz, will 1 Erz“). Alle anderen sehen es und klicken „Annehmen“ oder „Ablehnen“. Der aktive Spieler wählt unter denen, die angenommen haben, einen aus, und der Tausch wird ausgeführt. Mitspieler können auch ein Gegenangebot an den aktiven Spieler schicken. Wie im Original handelt man nur mit dem Spieler, der gerade am Zug ist.

### 5–6 Spieler (offizielle Erweiterung)

| | 2–4 Spieler | 5–6 Spieler |
|---|---|---|
| Landfelder | 19 (Reihen 3-4-5-4-3) | 30 (Reihen 3-4-5-6-5-4-3) |
| Wüsten | 1 | 2 |
| Zahlenchips | 18 | 28 |
| Häfen | 9 (4× 3:1, 5× 2:1) | 11 (5× 3:1, 6× 2:1, zweimal Wolle) |
| Rohstoffkarten je Sorte | 19 | 24 |
| Entwicklungskarten | 25 (14 Ritter, je 2 Fortschritt, 5 SP) | 34 (20 Ritter, je 3 Fortschritt, 5 SP) |

**Sonderbauphase:** Nach jedem Zug dürfen alle anderen Spieler der Reihe nach noch bauen und Entwicklungskarten kaufen, aber nicht handeln und keine Karten ausspielen. Damit es flott geht, überspringt das Spiel automatisch alle, die sich gar nichts leisten können.

### Brettaufbau

Das Brett wird zufällig erzeugt: Landschaften mischen, Zahlenchips verteilen, Häfen gleichmäßig an der Küste verteilen. Dabei gilt die übliche Einschränkung, dass 6 und 8 nie nebeneinander liegen. Der Räuber startet in einer Wüste.

## Netzwerk-Architektur

### Warum P2P mit Trystero

Damit zwei Browser sich per WebRTC direkt verbinden können, müssen sie zuerst ihre Verbindungsdaten austauschen („Signaling“). Normalerweise braucht man dafür einen eigenen Server. Trystero nutzt stattdessen bestehende öffentliche Infrastruktur, standardmäßig Nostr-Relays. Darüber laufen nur die verschlüsselten Verbindungsangebote. Sobald die Verbindung steht, gehen alle Spieldaten direkt von Browser zu Browser.

Trystero verbindet alle Spieler eines Raums direkt miteinander (Mesh). Bei maximal 6 Spielern sind das höchstens 15 Verbindungen, das ist unproblematisch. Weil jeder jeden kennt, kann bei einem Ausfall jeder andere die Spielleitung übernehmen.

Verglichen haben wir außerdem:

- **PeerJS:** Sternverbindung zum Host über den öffentlichen PeerJS-Server. Einfach, aber ein Host-Wechsel wäre deutlich umständlicher, und das Projekt wird kaum noch gepflegt.
- **Serverless-Relay (Cloudflare Durable Objects, PartyKit):** robuster, braucht aber einen Account und ein Deployment. Bleibt die Rückfalloption, falls P2P bei euch nicht zuverlässig läuft.

### Rollen

- **Host:** führt den maßgeblichen Spielstand. Er nimmt Aktionen entgegen, prüft sie mit der Spiel-Engine und schickt den neuen Stand an alle.
- **Clients:** zeigen den Stand an und schicken Aktionen („baue Straße auf Kante 42“). Sie ändern den Stand nie selbst.

Der Spielstand ist klein (wenige KB). Deshalb schickt der Host nach jeder Aktion den kompletten Stand mit fortlaufender Versionsnummer. Das ist einfacher und robuster als Deltas: Wer eine Nachricht verpasst, ist mit der nächsten wieder aktuell.

### Nachrichten

| Nachricht | Richtung | Inhalt |
|---|---|---|
| `hello` | Client → alle | Spieler-ID, Name |
| `room` | Host → alle | Spielerliste, Farben, Einstellungen, Host und Epoche, dazu der vollständige Spielstand mit Version |
| `profile` | Client → Host | Name und Farbe ändern |
| `action` | Client → Host | Spielaktion |
| `reject` | Host → Client | Aktion ungültig, mit Grund |
| `chat` | alle → alle | Chatnachricht |

### Identität und Wiedereinstieg

Jeder Browser erzeugt beim ersten Besuch eine zufällige Spieler-ID und speichert sie zusammen mit dem Namen im `localStorage`. Die Plätze im Spiel hängen an dieser ID, nicht an der WebRTC-Verbindung. Wer neu lädt, meldet sich mit `hello` und derselben ID und bekommt seinen Platz zurück.

### Host-Wechsel

Alle Clients haben immer den aktuellen Spielstand. Verlässt der Host den Raum, ernennt sich der verbundene Spieler mit dem kleinsten Sitzplatz zum neuen Host und schickt `room` mit einer um eins erhöhten Epoche. Der Spielstand selbst enthält auch den Zustand des Zufallsgenerators und den Stapel der Entwicklungskarten, deshalb läuft das Spiel ohne Bruch weiter.

Treffen zwei Hosts aufeinander (z. B. weil zwei Leute gleichzeitig einen leeren Raum geöffnet haben), gewinnt das laufende Spiel, dann die höhere Spielstand-Version (ein veralteter Stand darf nie gewinnen), dann die höhere Epoche, dann die größere Spielerzahl, dann die kleinere Spieler-ID.

Wird ein Tab normal geschlossen, meldet er sich ab und der Wechsel geschieht sofort. Bricht die Verbindung hart ab, erkennt WebRTC das nach etwa 15 Sekunden.

### Spielstand sichern

Jeder Browser speichert den letzten Stand unter dem Raumcode im `localStorage`. Haben alle den Tab geschlossen, öffnet man einfach wieder den Link. Findet sich nach 12 Sekunden kein Host, macht der Browser automatisch mit dem gespeicherten Stand weiter (oder man klickt vorher auf „Gespeichertes Spiel fortsetzen“).

### Verdeckte Informationen

Damit der Host-Wechsel funktioniert, bekommt jeder den kompletten Stand, also auch die Handkarten der anderen und den Kartenstapel. Die Oberfläche zeigt davon nur, was man sehen darf. Wer in den Entwicklertools des Browsers wühlt, könnte schummeln. Für ein Spiel unter Kollegen nehmen wir das bewusst in Kauf, denn dicht zu machen ginge nur mit Server oder aufwendiger Kryptografie.

### Bekannte Risiken

- **Strenge Firewalls / Firmen-VPN:** Manche Netze lassen keine direkten WebRTC-Verbindungen zu. Dann braucht es einen TURN-Server als Umleitung, z. B. Cloudflare TURN (1.000 GB/Monat gratis) oder Open Relay von Metered. Das ist reine Konfiguration (`turnConfig`) und kein Code-Umbau.
- **Ausfall der Nostr-Relays:** Trystero verbindet sich mit mehreren Relays gleichzeitig. Fallen trotzdem alle aus, können wir per Einstellung auf MQTT- oder BitTorrent-Tracker umschalten.

## Software-Architektur

```
src/app/
  engine/        Reine Spiellogik in TypeScript, ohne Angular und ohne Netzwerk
    types.ts       Datentypen für Spielstand und Aktionen
    board.ts       Brettgenerierung und Topologie (Felder, Ecken, Kanten)
    rules.ts       applyAction(state, playerId, action) → neuer Stand oder Fehler
    rng.ts         Zufallsgenerator mit Seed, Zustand liegt im Spielstand
  net/
    transport.ts   Schnittstelle für die Verbindung
    trystero-transport.ts   Echte P2P-Verbindung
    local-transport.ts      BroadcastChannel für Tests mit mehreren Tabs ohne Internet (`?local`)
    room.service.ts         Lobby, Host/Client-Logik, Host-Wechsel, Speichern
  ui/            Angular-Komponenten: Startseite, Lobby, Spielbrett, Hand, Handel, Dialoge
```

Die Spiel-Engine ist eine reine Funktion: Stand plus Aktion ergibt einen neuen Stand oder einen Fehler. Das macht sie gut testbar, und Host und Client nutzen denselben Code. Clients prüfen damit vorab, welche Buttons und Bauplätze gerade erlaubt sind.

## Stand der Umsetzung

| Schritt | Stand |
|---|---|
| Engine mit allen Regeln inkl. 5–6-Erweiterung | fertig, 102 Unit-Tests |
| Netzwerk: Lobby, P2P, Wiedereinstieg, Host-Wechsel, Speichern | fertig, mit mehreren Tabs getestet (lokal und über echtes P2P) |
| Oberfläche: Startseite, Lobby, Brett, Hand, Handel, Dialoge, Verlauf, Chat | fertig |
| Komplette Spiele 3 und 6 Spieler (Bots über das Netzwerk) | durchgespielt |
| Test über verschiedene echte Netze / Firmen-VPN | offen |
| Deployment | offen, Hosting noch nicht gewählt |

## Später denkbar

- Seefahrer oder Städte & Ritter
- Würfelstatistik und Spielende-Auswertung
- Sounds und Benachrichtigung „Du bist dran“
- Eigener WebSocket-Relay als Rückfall, falls öffentliche Relays zicken
