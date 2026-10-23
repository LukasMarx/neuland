/** Mittelalterliches Stück (Kiravale, „Medieval Music“), in Schleife. */
const SRC = 'web/music/mittelalter.m4a';
/** Lautstärke bei voll aufgedrehtem Regler; die Musik soll unter Stimmen und Effekten bleiben. */
const MAX_VOLUME = 0.6;
const FADE_IN_MS = 2500;
const FADE_OUT_MS = 1200;
const DUCKED = 0.25;

/**
 * Hintergrundmusik: sanft ein- und ausgeblendet; ohne Klick oder Taste beginnt sie beim ersten.
 * Die Lautstärke ist Blende (0 bis 1, beim Ducken weniger) mal Regler (`setLevel`).
 */
export class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private blend = 0;
  private level = 1;
  private fade: ReturnType<typeof setInterval> | undefined;
  private unduck: ReturnType<typeof setTimeout> | undefined;
  private readonly onGesture = () => this.play();

  /** Reglerstellung 0 bis 1; wirkt sofort, auch mitten in einer Blende. */
  setLevel(level: number): void {
    this.level = level;
    this.apply();
  }

  start(): void {
    if (this.audio) return;
    this.audio = new Audio(SRC);
    this.audio.loop = true;
    this.blend = 0;
    this.apply();
    this.play();
  }

  stop(): void {
    const audio = this.audio;
    if (!audio) return;
    this.audio = null;
    this.removeGestureListeners();
    clearInterval(this.fade);
    clearTimeout(this.unduck);
    // Eigene Blende: Ein gleich danach gestartetes neues Stück darf das Ausblenden nicht abbrechen.
    const from = audio.volume;
    animate(1, 0, FADE_OUT_MS, (t) => (audio.volume = from * t), () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
  }

  /** Leiser, solange der Sprecher zu hören ist, danach langsam zurück. */
  duck(seconds: number): void {
    const audio = this.audio;
    if (!audio || audio.paused) return;
    clearTimeout(this.unduck);
    this.blendTo(DUCKED, 300);
    this.unduck = setTimeout(() => {
      if (this.audio === audio) this.blendTo(1, 1500);
    }, seconds * 1000);
  }

  private play(): void {
    const audio = this.audio;
    if (!audio) return;
    audio.play().then(
      () => {
        // Inzwischen ausgeschaltet: Das Ausblenden kümmert sich um dieses Stück.
        if (this.audio !== audio) return;
        this.removeGestureListeners();
        this.blendTo(1, FADE_IN_MS);
      },
      () => {
        // Der Browser lässt noch keinen Ton zu.
        if (this.audio !== audio) return;
        document.addEventListener('pointerdown', this.onGesture);
        document.addEventListener('keydown', this.onGesture);
      },
    );
  }

  private blendTo(target: number, ms: number): void {
    clearInterval(this.fade);
    this.fade = animate(this.blend, target, ms, (v) => {
      this.blend = v;
      this.apply();
    });
  }

  private apply(): void {
    if (this.audio) this.audio.volume = Math.min(1, this.blend * this.level * MAX_VOLUME);
  }

  private removeGestureListeners(): void {
    document.removeEventListener('pointerdown', this.onGesture);
    document.removeEventListener('keydown', this.onGesture);
  }
}

/** Läuft in Schritten von `from` nach `to` und meldet jeden Zwischenwert. */
function animate(from: number, to: number, ms: number, step: (value: number) => void, done?: () => void): ReturnType<typeof setInterval> {
  const started = performance.now();
  const timer = setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / ms);
    step(from + (to - from) * t);
    if (t < 1) return;
    clearInterval(timer);
    done?.();
  }, 50);
  return timer;
}

/** Ein Spieler für die ganze App: Die App startet und stoppt ihn, das Spiel macht ihn nur leiser. */
export const backgroundMusic = new BackgroundMusic();
