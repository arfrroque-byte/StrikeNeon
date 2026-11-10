type AudioCtor = typeof AudioContext;

/* ------------------------------------------------------------------ */
/* Mixing levels                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every effect peaks at or above SFX_FLOOR, and every music voice peaks at or
 * below MUSIC_CEILING * MUSIC_LEVEL. That keeps the soundtrack sitting under
 * the game sounds at all times.
 */
const SFX_FLOOR = 0.06;

const MUSIC_LEVEL = 0.55;
/** Largest peak any single music voice can reach after the music bus. */
const MUSIC_CEILING = 0.055;

/** A4 = 440 Hz; `n` is semitones relative to A4. */
const note = (n: number) => 440 * Math.pow(2, n / 12);

/** One bar of the loop: root note + chord intervals. */
export interface Bar {
  root: number;
  chord: [number, number, number];
}

/** Oscillator shape for the arpeggio lead. */
export type LeadWave = "triangle" | "square" | "sawtooth" | "sine";

/**
 * A complete retro theme. Each background id has its own progression, tempo,
 * waveforms and drum density, so switching a background also switches the tune.
 */
export interface ThemeTracks {
  bars: Bar[];
  bossBars: Bar[];
  bpm: number;
  bossBpm: number;
  leadWave: LeadWave;
  /** Lead note density: 2 = every other sixteenth, 1 = every sixteenth. */
  leadStep: 1 | 2;
  /** Drum density: 2 = eighth-note hats, 1 = sixteenth-note hats. */
  hatStep: 1 | 2;
  /** Bass note length multiplier. */
  bassLength: number;
}

/**
 * One entry per background id. NEON VOID is the default calm retro groove;
 * boss mode overlays its own faster, denser treatment.
 */
export const THEME_TRACKS: Record<string, ThemeTracks> = {
  // Calm 104 BPM groove, Am - F - C - G: warm triangle lead every other
  // sixteenth, laid-back eighth hats and a long rolling bass. Boss mode still
  // kicks everything up (denser steps, square lead, 204 BPM).
  "neon-void": {
    bars: [
      { root: -24, chord: [0, 3, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -21, chord: [0, 4, 7] },
      { root: -26, chord: [0, 4, 7] },
    ],
    bossBars: [
      { root: -24, chord: [0, 3, 7] },
      { root: -24, chord: [0, 3, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -17, chord: [0, 4, 7] },
    ],
    bpm: 104,
    bossBpm: 204,
    leadWave: "triangle",
    leadStep: 2,
    hatStep: 2,
    bassLength: 2.2,
  },
  // 118 BPM, Dm - Bb - F - C, sawtooth synthwave lead with long bass.
  "synth-sunset": {
    bars: [
      { root: -26, chord: [0, 3, 7] },
      { root: -31, chord: [0, 4, 7] },
      { root: -24, chord: [0, 4, 7] },
      { root: -29, chord: [0, 4, 9] },
    ],
    bossBars: [
      { root: -26, chord: [0, 3, 7] },
      { root: -26, chord: [0, 3, 7] },
      { root: -21, chord: [0, 3, 7] },
      { root: -19, chord: [0, 4, 7] },
    ],
    bpm: 118,
    bossBpm: 156,
    leadWave: "sawtooth",
    leadStep: 2,
    hatStep: 2,
    bassLength: 2.1,
  },
  // 146 BPM, Em - C - G - D, bright square arpeggio.
  "vapor-tide": {
    bars: [
      { root: -23, chord: [0, 3, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -21, chord: [0, 4, 7] },
      { root: -26, chord: [0, 4, 7] },
    ],
    bossBars: [
      { root: -23, chord: [0, 3, 7] },
      { root: -23, chord: [0, 3, 7] },
      { root: -16, chord: [0, 4, 7] },
      { root: -18, chord: [0, 4, 7] },
    ],
    bpm: 146,
    bossBpm: 182,
    leadWave: "square",
    leadStep: 1,
    hatStep: 1,
    bassLength: 1.2,
  },
  // 126 BPM, C - Am - F - G, sine lead, minimal drums.
  "midnight-arcade": {
    bars: [
      { root: -21, chord: [0, 4, 7] },
      { root: -24, chord: [0, 3, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -26, chord: [0, 4, 7] },
    ],
    bossBars: [
      { root: -21, chord: [0, 4, 7] },
      { root: -21, chord: [0, 4, 7] },
      { root: -26, chord: [0, 3, 7] },
      { root: -23, chord: [0, 4, 7] },
    ],
    bpm: 126,
    bossBpm: 164,
    leadWave: "sine",
    leadStep: 2,
    hatStep: 2,
    bassLength: 1.9,
  },
  // 140 BPM, Gm - Eb - F - D, aggressive sawtooth, busy hats.
  "emerald-nebula": {
    bars: [
      { root: -25, chord: [0, 3, 7] },
      { root: -30, chord: [0, 4, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -31, chord: [0, 3, 7] },
    ],
    bossBars: [
      { root: -25, chord: [0, 3, 7] },
      { root: -25, chord: [0, 3, 7] },
      { root: -20, chord: [0, 4, 7] },
      { root: -22, chord: [0, 4, 7] },
    ],
    bpm: 140,
    bossBpm: 176,
    leadWave: "sawtooth",
    leadStep: 1,
    hatStep: 1,
    bassLength: 1.1,
  },
  // 152 BPM, Am - E - F - E, urgent square, driving sixteenth bass.
  "crimson-rift": {
    bars: [
      { root: -24, chord: [0, 3, 7] },
      { root: -23, chord: [0, 4, 7] },
      { root: -28, chord: [0, 4, 7] },
      { root: -23, chord: [0, 4, 7] },
    ],
    bossBars: [
      { root: -24, chord: [0, 3, 7] },
      { root: -24, chord: [0, 3, 7] },
      { root: -17, chord: [0, 3, 7] },
      { root: -19, chord: [0, 4, 7] },
    ],
    bpm: 152,
    bossBpm: 186,
    leadWave: "square",
    leadStep: 1,
    hatStep: 1,
    bassLength: 0.9,
  },
};

/** Lead melody order over the chord tones, eight sixteenths long. */
const LEAD_ORDER = [0, 1, 2, 1, 0, 2, 1, 2];
const LEAD_OCTAVE = [0, 0, 0, 12, 0, 0, 12, 0];



/* ------------------------------------------------------------------ */
/* Sound effects                                                       */
/* ------------------------------------------------------------------ */

/**
 * Tiny procedural sound-effects engine. Everything is synthesised with the
 * Web Audio API, so the game ships without any audio files and works offline.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;
  private sfxMuted: boolean;
  private musicMuted: boolean;
  private sfxVolume: number;
  private musicVolume: number;
  private lastShot = 0;
  private lastHit = 0;
  private lastKillAt = -10;
  private lastKillVoiceAt = -10;
  private killStreak = 0;

  constructor(
    muted = false,
    sfxMuted = false,
    musicMuted = false,
    sfxVolume = 0.8,
    musicVolume = 0.8,
  ) {
    this.muted = muted;
    this.sfxMuted = sfxMuted;
    this.musicMuted = musicMuted;
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
  }

  /** Shared context (created lazily, ideally from a user gesture). */
  get context() {
    return this.ctx;
  }

  /** Bus sound effects are mixed into, before master and limiter. */
  get bus(): GainNode | null {
    return this.sfxGain ?? this.master;
  }

  /** Explicit SFX bus for sound effects */
  get sfxBus(): GainNode | null {
    return this.sfxGain ?? this.master;
  }

  /** Explicit Music bus for background tracks */
  get musicBus(): GainNode | null {
    return this.musicGain ?? this.master;
  }

  /** One second of white noise, shared by every percussive sound. */
  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  /** Must be called from a user gesture (tap / click / key). */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();

        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 0.8;

        const sfxGain = ctx.createGain();
        sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;

        const musicGain = ctx.createGain();
        musicGain.gain.value = this.musicMuted ? 0 : this.musicVolume;

        const limiter = ctx.createDynamicsCompressor();

        sfxGain.connect(master);
        musicGain.connect(master);
        master.connect(limiter);
        limiter.connect(ctx.destination);

        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

        this.ctx = ctx;
        this.master = master;
        this.sfxGain = sfxGain;
        this.musicGain = musicGain;
        this.noise = buffer;
      }
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio is optional */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }
  }

  isMuted() {
    return this.muted;
  }

  setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : this.sfxVolume, this.ctx.currentTime, 0.02);
    }
  }

  isSfxMuted() {
    return this.sfxMuted;
  }

  setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(muted ? 0 : this.musicVolume, this.ctx.currentTime, 0.02);
    }
  }

  isMusicMuted() {
    return this.musicMuted;
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.sfxGain && !this.sfxMuted) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.02);
    }
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.musicGain && !this.musicMuted) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.02);
    }
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
  }

  private tone(from: number, to: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    const ctx = this.ctx;
    const dest = this.sfxGain ?? this.master;
    if (!ctx || !dest || this.muted || this.sfxMuted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  private burst(duration: number, volume: number, from: number, to: number, delay = 0) {
    const ctx = this.ctx;
    const dest = this.sfxGain ?? this.master;
    if (!ctx || !dest || !this.noise || this.muted || this.sfxMuted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  shoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShot < 0.09) return;
    this.lastShot = now;
    this.tone(980, 380, 0.07, "square", Math.max(SFX_FLOOR, 0.06));
  }

  hit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.05) return;
    this.lastHit = now;
    this.tone(320, 180, 0.05, "triangle", Math.max(SFX_FLOOR + 0.015, 0.075));
  }

  explode(size: number) {
    const s = Math.min(size, 3.5);
    this.burst(0.25 + s * 0.16, 0.22 + s * 0.05, 2600, 120);
    this.tone(150, 38, 0.2 + s * 0.1, "sawtooth", 0.08 + s * 0.02);
  }

  /**
   * Satisfying enemy kill sting, distinct from the generic explosion used for
   * the player, bombs and shockwaves. Three layers:
   *  1. snap transient (noise) for punch,
   *  2. pop body (fast pitch drop) for weight,
   *  3. reward sparkle (short rising blip) that climbs a pentatonic ladder
   *     while chained kills land within ~0.9 s of each other.
   * Tanks get a crunchier body with a two-note reward; bosses get a sub drop
   * plus a triumphant four-note payoff.
   */
  enemyDown(kind: "scout" | "dart" | "tank" | "medic" | "sniper" | "guardian" | "kamikaze" | "boss") {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this.killStreak = now - this.lastKillAt > 0.9 ? 0 : Math.min(this.killStreak + 1, 12);
    this.lastKillAt = now;
    // Stack guard: kills landing on the same frame keep the punch but share
    // one sparkle so rapid multi-kills never stack harshly.
    const solo = now - this.lastKillVoiceAt > 0.045;
    if (solo) this.lastKillVoiceAt = now;

    const v = 0.94 + Math.random() * 0.12;
    const ladder = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29];
    const sparkle = (delay: number, stepsUp = 0, volume = 0.09) => {
      if (!solo) return;
      const f = note(12 + ladder[Math.min(this.killStreak + stepsUp, ladder.length - 1)]);
      this.tone(f, f * 1.01, 0.1, "triangle", volume, delay);
    };

    if (kind === "boss") {
      this.burst(0.8, 0.38, 4200, 70);
      this.tone(140, 26, 0.9, "sine", 0.38);
      this.tone(420 * v, 36, 0.7, "sawtooth", 0.22);
      this.tone(820 * v, 90, 0.35, "square", 0.12);
      [0, 4, 7, 12].forEach((s, i) => this.tone(note(12 + s), note(12 + s), 0.16, "triangle", 0.11, 0.24 + i * 0.1));
      return;
    }

    if (kind === "tank") {
      this.burst(0.26, 0.3, 3600, 140);
      this.tone(250 * v, 42, 0.3, "sawtooth", 0.2);
      this.tone(360 * v, 90, 0.2, "square", 0.13);
      this.tone(190 * v, 55, 0.22, "sine", 0.18);
      sparkle(0.07);
      sparkle(0.14, 2, 0.08);
      return;
    }

    const pop = kind === "dart" || kind === "kamikaze" ? 1.18 : 1;
    this.burst(0.08, 0.22, 5200, 1100);
    this.tone(700 * v * pop, 150, 0.13, "square", 0.15);
    this.tone(200 * v, 70, 0.1, "sine", 0.16);
    sparkle(0.045);
  }

  hurt() {
    this.burst(0.55, 0.38, 3200, 90);
    this.tone(260, 45, 0.5, "sawtooth", 0.17);
  }

  power() {
    this.tone(520, 520, 0.07, "triangle", 0.1);
    this.tone(660, 660, 0.07, "triangle", 0.1, 0.07);
    this.tone(880, 880, 0.12, "triangle", 0.1, 0.14);
  }

  life() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.1, "triangle", 0.1, i * 0.08));
  }

  bomb() {
    this.burst(1.1, 0.5, 4200, 60);
    this.tone(110, 28, 0.9, "sine", 0.4);
    this.tone(60, 24, 1.1, "sawtooth", 0.1);
  }

  /** Rocket salvo: hissing ignition plus a rising whoosh. */
  missile() {
    this.burst(0.35, 0.18, 6000, 900);
    this.tone(180, 720, 0.28, "sawtooth", 0.09);
    this.tone(240, 960, 0.22, "square", 0.06, 0.06);
  }

  /** Shield up: bright two-note shimmer. */
  shieldOn() {
    this.tone(440, 880, 0.18, "triangle", 0.1);
    this.tone(660, 1320, 0.22, "sine", 0.08, 0.08);
  }

  wave() {
    this.tone(220, 660, 0.35, "sine", 0.11);
    this.tone(330, 990, 0.35, "sine", 0.07, 0.12);
  }

  /** Rising sting used when a boss appears. */
  bossAlert() {
    [0, 3, 7, 12].forEach((s, i) => this.tone(note(-12 + s), note(-12 + s), 0.16, "square", 0.11, i * 0.11));
  }

  gameOver() {
    [440, 330, 220, 110].forEach((f, i) => this.tone(f, f * 0.8, 0.28, "sawtooth", 0.12, i * 0.22));
  }
}

/* ------------------------------------------------------------------ */
/* Background music                                                    */
/* ------------------------------------------------------------------ */

/**
 * Procedural retro/arcade action loop: a driving bass, an arpeggio lead and a
 * noise-based drum kit, all scheduled slightly ahead of time so the tempo is
 * sample accurate. `setBoss(true)` shifts to a tenser progression at a faster
 * tempo while a boss is alive.
 */
export class Music {
  private readonly sfx: Sfx;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private boss = false;
  /** Active retro theme; each background id maps to its own track set. */
  private theme: ThemeTracks = THEME_TRACKS["neon-void"];
  private themeId = "neon-void";

  constructor(sfx: Sfx) {
    this.sfx = sfx;
  }

  /** Id of the background whose track is currently loaded. */
  get themeIdValue() {
    return this.themeId;
  }

  /**
   * Loads the track set that belongs to a background id.
   * Safe to call while playing: it only swaps the pattern tables.
   */
  setTheme(backgroundId: string) {
    if (this.themeId === backgroundId) return;
    const next = THEME_TRACKS[backgroundId];
    if (!next) return;
    this.themeId = backgroundId;
    this.theme = next;
  }

  isPlaying() {
    return this.playing;
  }

  isBoss() {
    return this.boss;
  }

  /** Current tempo in BPM; bosses push the loop harder. */
  get bpm() {
    return this.boss ? this.theme.bossBpm : this.theme.bpm;
  }

  /** Speed multiplier applied by boss mode, exposed for tests. */
  get tempoScale() {
    return this.theme.bossBpm / this.theme.bpm;
  }

  /** Seconds per sixteenth note at the current tempo. */
  get stepDuration() {
    return 60 / this.bpm / 4;
  }

  start() {
    if (this.playing) return;
    const ctx = this.ensure();
    if (!ctx || !this.gain) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(MUSIC_LEVEL, ctx.currentTime, 0.15);
    this.timer = window.setTimeout(this.tick, 25);
  }

  stop() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.playing) return;
    this.playing = false;
    const ctx = this.sfx.context;
    if (ctx && this.gain) this.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
  }

  setBoss(boss: boolean) {
    if (this.boss === boss) return;
    this.boss = boss;
  }

  /** Releases the audio graph reference; called on teardown. */
  dispose() {
    this.stop();
    this.gain = null;
  }

  private ensure(): AudioContext | null {
    this.sfx.unlock();
    const ctx = this.sfx.context;
    const bus = this.sfx.musicBus;
    if (!ctx || !bus) return null;
    if (!this.gain) {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(bus);
      this.gain = gain;
    }
    return ctx;
  }

  private tick = () => {
    const ctx = this.sfx.context;
    if (!this.playing || !ctx) {
      this.timer = null;
      return;
    }
    const horizon = ctx.currentTime + 0.14;
    let guard = 0;
    while (this.nextTime < horizon && guard < 64) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDuration;
      this.step = (this.step + 1) % 64;
      guard += 1;
    }
    this.timer = window.setTimeout(this.tick, 25);
  };

  private playStep(step: number, time: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const cfg = (this.boss ? this.theme.bossBars : this.theme.bars)[bar];
    const dur = this.stepDuration;
    // Boss loop tightens every density by one step.
    const bassStep = this.boss ? 1 : 2;
    const hatStep = this.boss ? 1 : this.theme.hatStep;
    const leadStep = this.boss ? 1 : this.theme.leadStep;

    // Bass pattern per theme.
    if (s % bassStep === 0) {
      const lift = s % 8 === 4 ? 12 : 0;
      this.bass(note(cfg.root + lift), time, dur * this.theme.bassLength);
    }

    if (s === 0 || s === 8 || (this.boss && (s === 6 || s === 11))) this.kick(time);
    if (s === 4 || s === 12) this.snare(time);
    if (s % hatStep === 1) this.hat(time);

    // Lead arpeggio with the theme's own waveform and density.
    if (this.boss || s % leadStep === 0) {
      const i = step % LEAD_ORDER.length;
      const tone = cfg.root + 12 + cfg.chord[LEAD_ORDER[i]] + LEAD_OCTAVE[i];
      this.lead(note(tone), time, dur * 1.15);
    }

    // Low fifth drone on each bar change adds weight to the boss theme.
    if (this.boss && s === 0) this.drone(note(cfg.root), note(cfg.root + 7), dur * 14);
  }

  private bass(freq: number, time: number, duration: number) {
    const ctx = this.sfx.context;
    if (!ctx || !this.gain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(MUSIC_CEILING, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.gain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private lead(freq: number, time: number, duration: number) {
    const ctx = this.sfx.context;
    if (!ctx || !this.gain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Boss fights always go harsh (square); otherwise use the theme's own wave.
    osc.type = this.boss ? "square" : this.theme.leadWave;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(MUSIC_CEILING * 0.7, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.gain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  /** Sustained root + fifth that pads the start of each boss bar. */
  private drone(a: number, b: number, duration: number) {
    const ctx = this.sfx.context;
    if (!ctx || !this.gain) return;
    const now = ctx.currentTime;
    for (const freq of [a, b]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(MUSIC_CEILING * 0.5, now + 0.05);
      gain.gain.setValueAtTime(MUSIC_CEILING * 0.5, now + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.gain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
  }

  private kick(time: number) {
    const ctx = this.sfx.context;
    if (!ctx || !this.gain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.11);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(MUSIC_CEILING * 0.9, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    osc.connect(gain);
    gain.connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private snare(time: number) {
    this.noiseHit(time, 0.09, MUSIC_CEILING * 0.6, 1800);
  }

  private hat(time: number) {
    this.noiseHit(time, 0.03, MUSIC_CEILING * 0.5, 6200);
  }

  private noiseHit(time: number, duration: number, volume: number, highpass: number) {
    const ctx = this.sfx.context;
    const buffer = this.sfx.noiseBuffer;
    if (!ctx || !this.gain || !buffer) return;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = 1;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.gain);
    const offset = Math.floor(Math.random() * (buffer.duration - 0.2));
    src.start(time, offset, duration + 0.02);
  }
}


