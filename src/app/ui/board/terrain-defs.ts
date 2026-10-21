import { Component } from '@angular/core';

/**
 * Wiederverwendbare SVG-Grafiken für die Spielfelder. Jedes Gelände ist eine Gruppe
 * `#t-<terrain>` mit dem Mittelpunkt bei 0,0 und Radius 60 (passend zu S im Brett).
 * Die Mitte bleibt frei für den Zahlenchip.
 */
@Component({
  selector: '[appTerrainDefs]',
  templateUrl: './terrain-defs.svg.html',
})
export class TerrainDefs {}
