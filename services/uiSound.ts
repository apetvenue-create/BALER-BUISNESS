/**
 * Professional UI sound engine (Web Audio API).
 * Soft synthesized tones — no audio files required.
 */

export type UiSoundKind = 'tap' | 'select' | 'success' | 'error' | 'confirm' | 'cancel';

type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
};

const MUTE_KEY = 'baler-ui-sound-muted';

const PATTERNS: Record<UiSoundKind, Tone[]> = {
  // Soft tactile press
  tap: [{ freq: 620, duration: 0.045, type: 'sine', gain: 0.07 }],
  // Slightly brighter for selects / tabs / checkboxes
  select: [
    { freq: 740, duration: 0.035, type: 'sine', gain: 0.06 },
    { freq: 980, duration: 0.04, type: 'sine', gain: 0.045, delay: 0.028 },
  ],
  // Pleasant confirmation chime (saved / success)
  success: [
    { freq: 523.25, duration: 0.09, type: 'sine', gain: 0.08 },
    { freq: 659.25, duration: 0.11, type: 'sine', gain: 0.07, delay: 0.07 },
    { freq: 783.99, duration: 0.14, type: 'triangle', gain: 0.05, delay: 0.14 },
  ],
  // Soft alert (not harsh)
  error: [
    { freq: 280, duration: 0.12, type: 'triangle', gain: 0.07, slideTo: 220 },
    { freq: 200, duration: 0.14, type: 'sine', gain: 0.05, delay: 0.1 },
  ],
  // Confirm dialog affirmative
  confirm: [
    { freq: 440, duration: 0.06, type: 'sine', gain: 0.07 },
    { freq: 554.37, duration: 0.1, type: 'sine', gain: 0.06, delay: 0.05 },
  ],
  // Cancel / dismiss
  cancel: [{ freq: 360, duration: 0.05, type: 'sine', gain: 0.05, slideTo: 300 }],
};

class UiSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastPlayedAt = 0;
  private lastKind: UiSoundKind | null = null;
  private unlocked = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(value: boolean) {
    this.muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Call from a user gesture so browsers allow audio. */
  unlock() {
    if (this.unlocked) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    // Silent buffer primes some mobile browsers
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
    this.unlocked = true;
  }

  play(kind: UiSoundKind) {
    if (this.muted) return;

    const now = performance.now();
    // Rate-limit identical rapid taps (double-fire from capture + bubble, etc.)
    if (this.lastKind === kind && now - this.lastPlayedAt < 55) return;
    // Slightly longer debounce for success chimes so stacked saves don't stack tones
    if (kind === 'success' && now - this.lastPlayedAt < 280 && this.lastKind === 'success') return;

    this.lastKind = kind;
    this.lastPlayedAt = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const tones = PATTERNS[kind];
    const t0 = ctx.currentTime;

    for (const tone of tones) {
      this.scheduleTone(ctx, this.master, t0 + (tone.delay || 0), tone);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        // Strong enough to remain audible on phones and busy shop floors.
        this.master.gain.value = 1.65;
        this.master.connect(this.ctx.destination);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private scheduleTone(ctx: AudioContext, dest: AudioNode, start: number, tone: Tone) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type || 'sine';
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.slideTo), start + tone.duration);
    }

    const peak = tone.gain ?? 0.06;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + tone.duration + 0.02);
  }
}

export const uiSound = new UiSoundEngine();

export const playUiSound = (kind: UiSoundKind) => uiSound.play(kind);
