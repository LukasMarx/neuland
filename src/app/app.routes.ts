import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./ui/home/home').then((m) => m.Home) },
  // Bühne für die Erklärvideos; braucht kein Netz und daher kein Passwort (siehe App).
  { path: 'erklaer', loadComponent: () => import('./ui/erklaer/erklaer').then((m) => m.ErklaerPage) },
  { path: ':code', loadComponent: () => import('./ui/room/room').then((m) => m.RoomPage) },
  { path: '**', redirectTo: '' },
];
