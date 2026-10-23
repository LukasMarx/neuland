/** Mittelalterliches Stück (Kiravale, „Medieval Music“), in Schleife. */
const SRC = 'web/music/mittelalter.m4a';
const VOLUME = 0.35;
const FADE_IN_MS = 2500;
const FADE_OUT_MS = 1200;

/** Hintergrundmusik: sanft ein- und ausgeblendet; ohne Klick oder Taste beginnt sie beim ersten. */
export class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private fade: ReturnType<typeof setInterval> | undefined;
  private unduck: ReturnType<typeof setTimeout> | undefined;
  private readonly onGesture = () => this.play();

  start(): void {
    if (this.audio) return;
    this.audio = new Audio(SRC);
    this.audio.loop = true;
    this.audio.volume = 0;
    this.play();
  }

  stop(): void {
    const audio = this.audio;
    if (!audio) return;
    this.audio = null;
    this.removeGestureListeners();
    clearInterval(this.fade);
    clearTimeout(this.unduck);
    // Eigener Timer: Ein gleich danach gestartetes neues Stück darf das Ausblenden nicht abbrechen.
    fade(audio, 0, FADE_OUT_MS, () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
  }

  /** Leiser, solange eine Fanfare oder der Sprecher zu hören ist, danach langsam zurück. */
  duck(seconds: number): void {
    const audio = this.audio;
    if (!audio || audio.paused) return;
    clearInterval(this.fade);
    clearTimeout(this.unduck);
    this.fade = fade(audio, VOLUME * 0.25, 300);
    this.unduck = setTimeout(() => {
      if (this.audio !== audio) return;
      clearInterval(this.fade);
      this.fade = fade(audio, VOLUME, 1500);
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
        clearInterval(this.fade);
        this.fade = fade(audio, VOLUME, FADE_IN_MS);
      },
      () => {
        // Der Browser lässt noch keinen Ton zu.
        if (this.audio !== audio) return;
        document.addEventListener('pointerdown', this.onGesture);
        document.addEventListener('keydown', this.onGesture);
      },
    );
  }

  private removeGestureListeners(): void {
    document.removeEventListener('pointerdown', this.onGesture);
    document.removeEventListener('keydown', this.onGesture);
  }
}

function fade(audio: HTMLAudioElement, target: number, ms: number, done?: () => void): ReturnType<typeof setInterval> {
  const from = audio.volume;
  const started = performance.now();
  const timer = setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / ms);
    audio.volume = from + (target - from) * t;
    if (t < 1) return;
    clearInterval(timer);
    done?.();
  }, 50);
  return timer;
}
