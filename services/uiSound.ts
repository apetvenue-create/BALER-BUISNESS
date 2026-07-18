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
  /** Attack time in seconds (softer rise for melodic notes) */
  attack?: number;
  /** Extra release tail after duration */
  release?: number;
  /** Soft harmonic overtone multiplier (2 = octave) */
  harmonic?: number;
  harmonicGain?: number;
};

const MUTE_KEY = 'baler-ui-sound-muted';

// Frequencies for short, smooth major confirmation tones.
const G5 = 783.99;
const B5 = 987.77;
const D6 = 1174.66;
const A4 = 440;
const Cs5 = 554.37;

const PATTERNS: Record<UiSoundKind, Tone[]> = {
  // Soft tactile press
  tap: [{ freq: 620, duration: 0.045, type: 'sine', gain: 0.07 }],
  // Slightly brighter for selects / tabs / checkboxes
  select: [
    { freq: 740, duration: 0.035, type: 'sine', gain: 0.06 },
    { freq: 980, duration: 0.04, type: 'sine', gain: 0.045, delay: 0.028 },
  ],
  // Short, smooth save chime: a gentle three-note major resolve.
  success: [
    { freq: G5, duration: 0.07, type: 'sine', gain: 0.072, attack: 0.012, release: 0.09 },
    { freq: B5, duration: 0.075, type: 'sine', gain: 0.068, delay: 0.055, attack: 0.012, release: 0.1 },
    { freq: D6, duration: 0.11, type: 'sine', gain: 0.075, delay: 0.11, attack: 0.014, release: 0.13 },
  ],
  // Soft alert (not harsh)
  error: [
    { freq: 280, duration: 0.12, type: 'triangle', gain: 0.07, slideTo: 220 },
    { freq: 200, duration: 0.14, type: 'sine', gain: 0.05, delay: 0.1 },
  ],
  // Confirm dialog: short, warm two-note resolve.
  confirm: [
    { freq: A4, duration: 0.065, type: 'sine', gain: 0.07, attack: 0.012, release: 0.08 },
    { freq: Cs5, duration: 0.1, type: 'sine', gain: 0.075, delay: 0.055, attack: 0.012, release: 0.12 },
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
    // Allow the short confirmation chime to finish before another starts.
    if (kind === 'success' && now - this.lastPlayedAt < 260 && this.lastKind === 'success') return;

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
    this.scheduleVoice(ctx, dest, start, tone.freq, tone);
    if (tone.harmonic && tone.harmonicGain) {
      this.scheduleVoice(ctx, dest, start, tone.freq * tone.harmonic, {
        ...tone,
        gain: tone.harmonicGain,
        harmonic: undefined,
        harmonicGain: undefined,
      });
    }
  }

  private scheduleVoice(
    ctx: AudioContext,
    dest: AudioNode,
    start: number,
    freq: number,
    tone: Tone
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (tone.slideTo != null) {
      const ratio = tone.slideTo / Math.max(tone.freq, 1);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq * ratio),
        start + tone.duration
      );
    }

    const peak = tone.gain ?? 0.06;
    const attack = Math.max(0.004, tone.attack ?? 0.008);
    const release = Math.max(0.02, tone.release ?? 0.03);
    const sustainEnd = start + tone.duration;
    const end = sustainEnd + release;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    // Gentle hold then musical fade — feels settled / complete
    gain.gain.setValueAtTime(peak * 0.92, sustainEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export const uiSound = new UiSoundEngine();

export const playUiSound = (kind: UiSoundKind) => uiSound.play(kind);
