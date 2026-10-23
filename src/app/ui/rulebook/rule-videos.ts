/**
 * Erklärvideos im Regelbuch. Ein Video erscheint erst, wenn es hier eingetragen ist; bis dahin bleibt
 * die Stelle im Buch einfach leer. Dateien nach `public/web/videos/` legen und eintragen, z. B.
 * `aufbau: clip('02-aufbau', 'Der Aufbau', '0:40')`. Die Reihenfolge hier ist die Reihenfolge, in
 * der „Weiter“ am Ende eines Videos durch die Clips führt.
 */
export type VideoId =
  'worum-gehts' | 'aufbau' | 'wuerfeln' | 'bauen' | 'handeln' | 'raeuber' | 'entwicklung' | 'sieg';

export interface RuleVideo {
  src: string;
  /** Wie auf der Titelkarte des Clips. */
  title: string;
  /** Standbild vor dem Abspielen; ohne zeigt das Buch eine leere Tafel mit Abspielknopf. */
  poster?: string;
  /** Laufzeit als Text, etwa „1:20“. */
  length?: string;
}

/** Aufgenommen mit demo-video, siehe videos/README.md; Standbild und Film liegen nebeneinander. */
const clip = (name: string, title: string, length: string): RuleVideo => ({
  src: `web/videos/${name}.mp4`,
  title,
  poster: `web/videos/${name}.jpg`,
  length,
});

export const RULE_VIDEOS: Partial<Record<VideoId, RuleVideo>> = {
  'worum-gehts': clip('01-worum-gehts', 'Worum geht’s?', '0:46'),
  aufbau: clip('02-aufbau', 'Der Aufbau', '0:40'),
  wuerfeln: clip('03-wuerfeln', 'Würfeln und Ertrag', '0:34'),
  bauen: clip('04-bauen', 'Bauen', '0:51'),
  handeln: clip('05-handeln', 'Handeln', '0:39'),
  raeuber: clip('06-raeuber', 'Die Sieben und der Räuber', '0:35'),
  entwicklung: clip('07-entwicklung', 'Entwicklungskarten', '0:31'),
  sieg: clip('08-sieg', 'Sonderkarten und Sieg', '0:31'),
};

/** Reihenfolge der Clips, für „Teil 3 von 8“ und den Weiter-Knopf. */
export const VIDEO_ORDER = Object.keys(RULE_VIDEOS) as VideoId[];
