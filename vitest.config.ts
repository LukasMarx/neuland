import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Ergänzt die Testumgebung von `ng test` (angular.json, runnerConfig) und gilt auch für `npx vitest`.
 * Viele Tests spielen ganze Partien mit Bots durch; sie prüfen Regeln, keine Geschwindigkeit. Auf dem
 * CI-Rechner teilen sich alle Testdateien wenige Kerne, dort brauchen sie ein Vielfaches der lokalen Zeit.
 */
export default defineConfig({
  test: {
    testTimeout: 30_000,
    // Arbeitskopien anderer Sitzungen liegen unter .claude/; ihre Tests gehören nicht dazu.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
