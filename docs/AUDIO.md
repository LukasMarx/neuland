# Neuland – Audio

Stand: 23.10.2026. Musik, Geräusche und drei Sprecher, die das Spiel kommentieren. Alle Töne lassen sich unter
`/#/klaenge` (Klangprobe) einzeln anhören. Die Liste dort entsteht aus dem Code, neue Töne erscheinen also von selbst.

## 1. Kanäle und Einstellungen

Drei Kanäle mit je An/Aus und Lautstärke, standardmäßig alle an (`src/app/ui/shared/audio-settings.ts`):

| Kanal | Inhalt | Vorgabe |
|---|---|---|
| Musik | Hintergrundmusik | an, 60 % |
| Effekte | Würfel und Geräusche | an, 80 % |
| Sprecher | Berater, Erzfeind, Herold | an, 100 % |

- Gespeichert unter `neuland:audio` im `localStorage`. Die früheren Schalter `neuland:sound` und `neuland:music` gelten
  weiter, solange noch nichts unter `neuland:audio` steht.
- Der Dialog (`settings-dialog.ts`) mit dem Reiter „Audio“ ist im Spiel (Kopfzeile, auf dem Handy das Zahnrad),
  in der Lobby und auf der Startseite erreichbar. Änderungen wirken sofort. „Probe“ spielt auch bei ausgeschaltetem Kanal.
- `channelVolume(kanal)` liefert 0, wenn ein Kanal aus ist. Alles, was spielt, fragt das unmittelbar vorher.
- Ohne Klick oder Taste lässt der Browser keinen Ton zu. Die Musik beginnt deshalb mit der ersten Bedienung.

## 2. Musik

„Medieval Music“ (Kiravale) als AAC, 128 kbit/s, 3:04 in Schleife (`public/web/music/mittelalter.m4a`).

- Ein Spieler für die ganze App (`backgroundMusic` in `music.ts`). Die App startet und stoppt ihn (`app.ts`), dieselbe
  Musik läuft also ohne Bruch von der Startseite über die Lobby ins Spiel. In der Klangprobe und vor dem Passwort schweigt sie.
- Lautstärke = Blende × Regler × 0,6. Ein- und Ausblenden dauert 2,5 bzw. 1,2 s. Der Regler wirkt auch mitten in einer Blende.
- `duck(sekunden)`: Solange jemand spricht oder die Siegesfanfare spielt, geht die Musik auf ein Viertel, danach langsam zurück.

## 3. Geräusche

Erkannt aus dem Unterschied zweier Spielstände (`src/app/ui/game/effects.ts`, reine Funktion mit Tests). Bauen, Handel
und Räuber hört jeder bei allen Spielern, das Kartenrascheln nur, wer die Rohstoffe bekommt.

| Geräusch | Anlass | Datei |
|---|---|---|
| Würfelklappern | jemand würfelt | `wuerfel.mp3` |
| Hammerschlag | Straße oder Schiff (auch Brücke) | `strasse.m4a` |
| Hämmern | Siedlung | `siedlung.m4a` |
| Schweres Hämmern | Stadt | `stadt.m4a` |
| Kartenrascheln | eigene Rohstoffe aus Feldern, wenn die Karten ankommen (650 ms nach dem Wurf) | `karten.m4a` |
| Münzen | zwei Spieler tauschen | `muenzen.m4a` |
| Eine Münze | Handel mit Bank oder Hafen | `muenze.m4a` |
| Pergament | Entwicklungskarte gekauft | `pergament.m4a` |
| Schwert | Ritter gespielt | `schwert.m4a` |
| Holzfigur | Räuber versetzt | `raeuber.m4a` |
| Horn | Handelsstraße oder Rittermacht wechselt | `horn.m4a` |
| Siegesfanfare | jemand gewinnt, übertönt alles andere | `sieg.m4a` |

Alle in `public/web/sounds/`. Die Geräusche sind zugeschnitten, auf Mono gemischt und angeglichen: Kleine liegen bei
−17 dBFS (lautester 50-ms-Abschnitt), Horn und Fanfare bei −12, die Stimmen bei −8,5. Bei einem Horn wartet der Sprecher
1 s, bei der Fanfare bis sie verklungen ist.

## 4. Sprecher

| Sprecher | Ordner | ElevenLabs-Stimme | Rolle |
|---|---|---|---|
| Berater | `public/audio/friend/` | Ritter | kommentiert, was mir gelingt oder misslingt |
| Erzfeind | `public/audio/enemy/` | Erzfeind (Barbar) | kommentiert, was jeder Gegner tut |
| Herold | `public/audio/herald/` | Herold | ruft aus, was alle angeht |

Jeder hört die Ansagen auf seinem Gerät aus seiner Sicht. Wer mein Erzfeind ist, ist für den anderen sein Berater.
Zuschauer hören keine Sprecher.

### Wo was steht

- **Katalog** `src/app/ui/shared/voice.ts`: `VoiceEvent` (alle Anlässe), `VOICE` (je Anlass Beschreibung und Sätze).
  `clip()` ist eine über die API erzeugte AAC-Datei, `first()` eine der ersten MP3-Aufnahmen aus der ElevenLabs-Oberfläche.
- **Erkennung** `src/app/ui/game/announcer.ts`: `voiceEvents(vorher, nachher, sitz)` liefert die Anlässe in Sprechreihenfolge,
  `expansionEvents` die der Erweiterungen. Reine Funktionen mit Tests (`announcer.spec.ts`, `announcer-expansions.spec.ts`).
- **In der Spielansicht** (`game.ts`) entstehen die Anlässe, die kein Spielstand-Unterschied sind: Spielbeginn, Zugbeginn,
  Bauhinweis nach dem Wurf, Tauschangebot an mich, Zögern, Mitspieler weg oder zurück.

### Regeln für das Zusammenspiel

- Es spricht immer nur eine Stimme. In der Warteschlange stehen höchstens zwei Ansagen, und was länger als 6,5 s warten
  musste, fällt weg (`Announcer` in `voice.ts`).
- Bei mehreren Fassungen kommt eine erst wieder, wenn mindestens die Hälfte der anderen gelaufen ist.
- Reihenfolge bei mehreren Ansagen: der Herold zuerst, dann Berater oder Erzfeind. Beim Sieg nur Fanfare, Herold und die eine
  Seite. Wo der Herold ausruft, entfällt der allgemeine Kommentar zur selben Sache (Insel statt Siedlung, Brücke statt Straße,
  Prachtstadt statt Ausbau).
- Mindestabstand in Zügen (`MIN_TURN_GAP` in `game.ts`): Straßen und Schiffe einmal je Zug, die leere Bank alle 10 Züge,
  „noch ein Punkt bis zum Sieg“ alle 6 Züge.
- „Du bist dran“ kommt nur, wenn der Zug wirklich beginnt (Würfelphase oder Aufbauphase), nicht beim Abwerfen oder in der
  Sonderbaurunde.

### Vorladen

Sobald eine Partie geladen ist, holt `audio-cache.ts` im Leerlauf alle Aufnahmen, die in dieser Partie vorkommen können,
und hält sie als Blob-URL. Gespielt wird danach ohne Netz. Welche Anlässe eine Erweiterung brauchen, steht in `NEEDS`
(`voice.ts`); in einem Grundspiel sind das 173 Sätze (gut 8 MB) und 12 Geräusche. Bei „Datensparen“ des Browsers wird nichts vorgeladen,
bei ausgeschaltetem Kanal auch nicht.

## 5. Einen neuen Satz aufnehmen

1. **Text abstimmen**, in der Anrede „Ihr/Euch“ wie alle anderen Sätze.
2. **Regieanweisung** in eckigen Klammern davor, englisch (`[laughs]`, `[whispers]`, `[triumphantly]`, `[sighs]`,
   `[mockingly]`, `[excited]` …). Sie wird nicht mitgesprochen, sondern verändert die Aufnahme.
3. **Erzeugen:**
   ```bash
   python3 scripts/audio/sprecher.py herald neues-land "[excited] Neues Land in Sicht!"
   ```
   Das Skript ruft ElevenLabs mit Modell `eleven_v4` und den Einstellungen der Stimmen auf (Tempo 1,0, Stabilität 0,5,
   Ähnlichkeit 0,75), gleicht die Lautstärke an und legt `public/audio/<sprecher>/<id>.m4a` ab. Der Key steht in
   `~/.config/elevenlabs/key` und wird nie ausgegeben.
4. **Gegenhören.** Ohne Lautsprecher hilft die Rückschrift: mit `SPRECHER_MP3_DIR=/tmp/mp3` behält das Skript die MP3,
   `scripts/audio/build-transcribe.sh` baut die Rückschrift, dann
   `open -W -n --stdout /tmp/stt.txt /tmp/Transcribe.app --args /tmp/mp3/*.mp3`.
   Dafür muss in macOS das Diktieren eingeschaltet sein (Systemeinstellungen → Tastatur → Diktieren).
5. **Eintragen** in `VOICE` (`voice.ts`), bei einem neuen Anlass auch in `VoiceEvent`, die Erkennung in `announcer.ts`
   mit Test, und gegebenenfalls in `NEEDS`.
6. **In der Klangprobe anhören.** Neue Dateien liefert `ng serve` erst nach dem nächsten Neuaufbau aus, notfalls eine
   Quelldatei speichern oder den Server neu starten.

Erfahrungen:

- Der Effekt „großer Raum“ der ElevenLabs-Oberfläche ist über die API nicht zu haben. Die über die API erzeugten Sätze sind
  trocken, die 17 verbliebenen MP3-Aufnahmen der ersten Runde haben den Raum.
- `[shouts]` und `[commanding]` verschlucken kurze Anfangswörter („Kniet nieder …“). Dann lieber ohne Anweisung.
- Die Rückschrift verhört sich bei seltenen Wörtern („Körperschiff“, „Mylord“ als „my Lord“). Entscheidend ist, dass nichts
  fehlt und keine Anweisung mitgelesen wurde.

## 6. Bekannte Lücken

- **iPhone und iPad:** Safari auf iOS ignoriert die Lautstärke eines Audio-Elements. Regler und Leiserwerden wirken dort nicht,
  die Musik spielt laut. Abhilfe wäre, alles über Web Audio mit eigener Lautstärke zu leiten.
- **Ungeprüft in echten Partien:** Schiffe, Inseln, Nebel, Brücken, Stadtausbau, Prachtstadt und Kaperschiff. Die Bots nutzen
  sie nicht, die Erkennung ist nur mit gebauten Spielständen getestet.
- **Dichte bei 8 Spielern** nicht gehört. Falls zu viel: ein Gesamtlimit je fremdem Zug.
- **Fehlende Geräusche:** Stein für die Stadt, Raub, Abwerfen, Angriff der Plünderer.
- **Fehlende Sätze**, vor allem Stadtwacht: Einflusskarten, Händler, Wächter, Palisaden, verlorene Prachtstadt, verlorener
  Hafenvogt. Dazu Fische ausgeben und bei den Flussläufen die wenigsten Münzen.

## 7. Quellen

| Was | Quelle |
|---|---|
| Musik | „Medieval Music“ von Kiravale (Pixabay, Nr. 593694), umkodiert |
| Würfel | `wuerfel.mp3`, eingebracht mit Commit a72482e, Quelle dort nicht vermerkt |
| Hammerschlag | „Hammering“ (freesound_community, Pixabay 87396), ein Schlag |
| Hämmern | „Hammer Nails“ (spinopel, Pixabay 442325) |
| Schweres Hämmern | „Hammering Wooden Pegs“ (nematoki, Pixabay 401206) |
| Kartenrascheln | „Card Sounds“ (freesound_community, Pixabay 35956) |
| Münzen | „Coins Drop 1“ (u_xg7ssi08yr, Pixabay 404409) |
| Eine Münze | „Coin Drop“ (universfield, Pixabay 229314) |
| Pergament | „Page Flip 2“ (oxidvideos, Pixabay 178323) |
| Schwert | „Draw Sword 1“ (freesound_community, Pixabay 44724) |
| Holzfigur | „Wood Hit“ (sumaga123, Pixabay 432148) |
| Horn | „Dramatic Horn“ (freesound_community, Pixabay 44005) |
| Siegesfanfare | „Success Fanfare Trumpets“ (freesound_community, Pixabay 6185) |
| Sprecher | ElevenLabs, eigene Stimmen „Ritter“, „Erzfeind“, „Herold“ im Konto des Projekts |

Die Angaben zu Pixabay stammen aus den Dateinamen der Downloads. Die Pixabay-Lizenz erlaubt die Nutzung ohne Namensnennung.
Ob die Dateien wirklich daher stammen, ist nicht geprüft.
