import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./ui/home/home').then((m) => m.Home) },
  { path: ':code', loadComponent: () => import('./ui/room/room').then((m) => m.RoomPage) },
  { path: '**', redirectTo: '' },
];
