import { signal } from '@angular/core';

/**
 * SHA-256 des Zugangspassworts (kleingeschrieben). Neues Passwort setzen:
 * `printf '%s' neuespasswort | shasum -a 256` und den Wert hier eintragen.
 */
const PASSWORD_HASH = '5a30976afc62b3368a95ddbc6efe1168cf90b5d5cef7741b11edecf5b32916ae';
const STORAGE_KEY = 'neuland:access';

/**
 * Das Passwort selbst, sobald es einmal richtig eingegeben wurde. Es dient auch als
 * Schlüssel für den P2P-Verbindungsaufbau: Ohne Passwort kommt keine Verbindung zustande,
 * selbst wenn jemand die Sperrseite umgeht.
 */
export const accessPassword = signal<string | null>(readStored());

// Ein gespeichertes Passwort nachprüfen, z. B. nach einer Passwortänderung.
void verifyStored();

async function verifyStored(): Promise<void> {
  const stored = accessPassword();
  if (stored === null || (await sha256(stored)) === PASSWORD_HASH) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // egal
  }
  accessPassword.set(null);
}

export async function unlock(input: string): Promise<boolean> {
  const password = input.trim().toLowerCase();
  if ((await sha256(password)) !== PASSWORD_HASH) return false;
  try {
    localStorage.setItem(STORAGE_KEY, password);
  } catch {
    // Ohne Speicher muss man es eben beim nächsten Mal wieder eingeben.
  }
  accessPassword.set(password);
  return true;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
