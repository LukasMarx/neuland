# Schriftentscheidung: Nunito Sans

**Status:** verbindlich · **Gewählt am:** 21.10.2026 · **Auswahl:** durch den Nutzer

Neuland verwendet **Nunito Sans** als gemeinsame Schriftfamilie im gesamten
Spiel. Der genaue Familienname für CSS und neue Entwürfe ist `Nunito Sans`.
Die Entscheidung gilt auch für das gewählte Kartendesign **02 · Symbolstark**.

## Ziel und Geltungsbereich

Die einheitliche Schrift verbindet die Papiercollage-Grafiken mit einer gut
lesbaren Oberfläche. Unterschiede zwischen Überschriften, Fließtext und
Zählern entstehen durch Größe und Gewicht innerhalb derselben Familie.

Die Wahl gilt für Startseite, Zugang, Lobby, Raumcodes, Spielansicht,
Spielkarten, Dialoge, Formulare, Buttons, Chat, Verlauf und SVG-Beschriftungen.
Neue Komponenten und Designentwürfe übernehmen diese Schriftwahl.

## Verwendung

- Text und Bedienelemente erben die globale Schrift; Formulare verwenden
  `font: inherit`.
- Für normalen Text ist Gewicht 400 vorgesehen, für Hervorhebungen und
  Buttons 600–800. Kartennamen und Kartenmengen verwenden 900.
- Zahlen, deren Stellen vergleichbar bleiben sollen, verwenden zusätzlich
  `font-variant-numeric: tabular-nums`, etwa Raumcodes und Kartenzähler.
- Kartennamen, Zähler und Aktionen bleiben echter HTML- bzw. SVG-Text.
  Neue Kartenillustrationen enthalten keine eingebrannte Beschriftung.
- Die Schrift in den ursprünglichen generierten Designbeispielen dokumentiert
  die damaligen Entwürfe. Maßgeblich für die Umsetzung ist Nunito Sans.

## Technische Einbindung

Die globale Definition steht in [src/styles.scss](../src/styles.scss):

```css
font-family: 'Nunito Sans', sans-serif;
font-optical-sizing: auto;
```

Die variablen WOFF2-Dateien liegen in
[public/fonts/nunito-sans/](../public/fonts/nunito-sans/), mit normalen und
kursiven Schnitten für die Gewichte 200–1000. Die `@font-face`-Definitionen
in [fonts.css](../public/fonts/nunito-sans/fonts.css) verwenden
`font-display: swap` und werden über die globale Styles-Liste in
[angular.json](../angular.json) gebündelt. Der Browser lädt die Schrift vom
Spielserver; eine Google-Fonts-Verbindung ist zur Laufzeit nicht erforderlich.

Quelle: [Google Fonts – Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans).
Die mitgelieferte [SIL Open Font License 1.1](../public/fonts/nunito-sans/OFL.txt)
bleibt bei der Weitergabe der Schriftdateien erhalten.

Eine Vorschau mit den echten Kartenkomponenten liegt unter
[Kartendesign 02 mit Nunito Sans](../output/designs/cards-2026-10-21/gallery.png).
