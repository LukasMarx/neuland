import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  // Hash-Routing, damit die Seite auf jedem statischen Hosting ohne Rewrite-Regeln läuft.
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes, withHashLocation())],
};
