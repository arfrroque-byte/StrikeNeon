import { Music, Sfx } from "./audio";
import { getBackgroundById, readEquippedBackgroundId, writeEquippedBackgroundId, type BackgroundTheme } from "./backgrounds";
import { getSkinById, readEquippedSkinId, writeEquippedSkinId, type ShipSkin } from "./skins";
import { getTrailById, readEquippedTrailId, writeEquippedTrailId, type NeonTrail } from "./trails";
import { BOSS_PALETTE, ENEMY_COLORS, FONT, buildSprites, type Sprite, type SpriteSet } from "./sprites";
import { MenuBattle, type ExclusionBox } from "./menuBattle";
import {
  difficultyScale,
  moduleStats,
  readProfile,
  writeProfile,
  type Mission,
  type Profile,
} from "./progression";

export type Phase = "menu" | "playing" | "paused" | "gameover";

export interface GameResult {
  score: number;
  best: number;
  wave: number;
  kills: number;
  newRecord: boolean;
  bosses: number;
  missileKills: number;
  maxCombo: number;
  bombsUsed: number;
  shieldsUsed: number;
  flawless: boolean;
}

/** Charges of every manual ability, pushed to the UI whenever they change. */
export interface AbilityState {
  bombs: number;
  missiles: number;
  shields: number;
  /** Seconds of shield left (0 when inactive). */
  shieldTime: number;
  shieldDuration: number;
}

export interface EngineEvents {
  onPhase: (phase: Phase) => void;
  onAbilities: (state: AbilityState) => void;
  onGameOver: (result: GameResult) => void;
}

export const BEST_KEY = "strike-neon:best";
export const MUTE_KEY = "strike-neon:muted";
export const SFX_MUTE_KEY = "strike-neon:sfx-muted";
export const MUSIC_MUTE_KEY = "strike-neon:music-muted";
export const SFX_VOL_KEY = "strike-neon:sfx-volume";
export const MUSIC_VOL_KEY = "strike-neon:music-volume";

export function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function readSfxMuted(): boolean {
  try {
    return localStorage.getItem(SFX_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function readMusicMuted(): boolean {
  try {
    return localStorage.getItem(MUSIC_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function readSfxVolume(): number {
  try {
    const val = localStorage.getItem(SFX_VOL_KEY);
    return val !== null ? Number(val) : 0.8;
  } catch {
    return 0.8;
  }
}

export function readMusicVolume(): number {
  try {
    const val = localStorage.getItem(MUSIC_VOL_KEY);
    return val !== null ? Number(val) : 0.8;
  } catch {
    return 0.8;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */

/** Logical width of the playfield. Height adapts to the screen aspect. */
const W = 360;
const TAU = Math.PI * 2;
/** Player fire speed (halved as requested). */
const BULLET_SPEED = 320;
export const START_BOMBS = 1;
export const MAX_BOMBS = 3;
export const START_MISSILES = 1;
export const MAX_MISSILES = 3;
export const START_SHIELDS = 1;
export const MAX_SHIELDS = 3;
/** A manually activated shield lasts this long. */
export const SHIELD_DURATION = 5;
const MISSILE_SALVO = 6;
const MISSILE_DAMAGE = 14;

export const INITIAL_ABILITIES: AbilityState = {
  bombs: START_BOMBS,
  missiles: START_MISSILES,
  shields: START_SHIELDS,
  shieldTime: 0,
  shieldDuration: SHIELD_DURATION,
};
export const BASE_LIVES = 3;
const MAX_LIVES = 5;

/** Difficulty tuning: tankier enemies, much longer waves, slower enemy fire. */
export const ENEMY_HP_SCALE = 2;
export const WAVE_LENGTH_SCALE = 3;
export const ENEMY_BULLET_SPEED_SCALE = 0.5;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pad7 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(7, "0");

function prune<T>(arr: T[], keep: (v: T) => boolean) {
  let j = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (keep(v)) arr[j++] = v;
  }
  arr.length = j;
}

/** [x offset, angle (rad, + = right), damage] per projectile.
 *  Cadence stays the same as before; since bullets travel half as fast, the
 *  on-screen density stays familiar but shots feel slower/heavier.
 */
const WEAPONS: { interval: number; shots: [number, number, number][] }[] = [
  { interval: 0.14, shots: [[-5, 0, 1], [5, 0, 1]] },
  { interval: 0.13, shots: [[-8, 0, 1], [0, 0, 1], [8, 0, 1]] },
  { interval: 0.125, shots: [[-5, 0, 1], [5, 0, 1], [-11, -0.12, 1], [11, 0.12, 1]] },
  {
    interval: 0.115,
    shots: [[-4, 0, 1], [4, 0, 1], [-10, -0.1, 1], [10, 0.1, 1], [-15, -0.22, 1], [15, 0.22, 1]],
  },
  {
    interval: 0.105,
    shots: [[0, 0, 1.5], [-8, 0, 1], [8, 0, 1], [-13, -0.12, 1], [13, 0.12, 1], [-18, -0.26, 1], [18, 0.26, 1]],
  },
];

const WAVE_TIPS = ["GET READY", "STAY SHARP", "INCOMING!", "HOLD THE LINE", "DODGE EVERYTHING", "KEEP MOVING"];

/* ------------------------------------------------------------------ */
/* Entity types                                                         */
/* ------------------------------------------------------------------ */

type EnemyKind = "scout" | "dart" | "tank" | "medic" | "sniper" | "guardian" | "kamikaze" | "boss";
type Behavior = "hover" | "sine" | "dive" | "strafe" | "tank" | "boss";
type PowerType = "weapon" | "bomb" | "missile" | "shield" | "life";

interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Enemy | null;
  age: number;
  dmg: number;
  trail: number;
  dead: boolean;
}

interface Star {
  x: number;
  y: number;
  v: number;
  len: number;
  a: number;
  w: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  a: number;
  dead: boolean;
}

interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  amber: boolean;
  dead: boolean;
}

interface Enemy {
  kind: EnemyKind;
  behavior: Behavior;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  score: number;
  age: number;
  baseX: number;
  targetY: number;
  amp: number;
  freq: number;
  phase: number;
  hold: number;
  fireCd: number;
  fireEvery: number;
  flash: number;
  leaving: boolean;
  aux: number;
  spin: number;
  dead: boolean;
  bossParts: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: PowerType;
  age: number;
  dead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  dash: boolean;
  drag: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  maxR: number;
  t: number;
  dur: number;
  delay: number;
  color: string;
  width: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  t: number;
  dur: number;
  color: string;
  size: number;
}

interface Banner {
  title: string;
  sub: string;
  t: number;
  dur: number;
  color: string;
}

interface Timed {
  at: number;
  run: () => void;
}

export interface Player {
  x: number;
  y: number;
  tx: number;
  ty: number;
  lives: number;
  bombs: number;
  missiles: number;
  /** Stored shield charges, spent manually. */
  shields: number;
  weapon: number;
  fireCd: number;
  invuln: number;
  shield: number;
  bank: number;
  speed: number;
  dead: boolean;
  deadTimer: number;
}

/* ------------------------------------------------------------------ */
/* Engine                                                               */
/* ------------------------------------------------------------------ */

export class NeonShooter {
  private readonly host: HTMLElement;
  private readonly events: EngineEvents;
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly sfx: Sfx;
  private readonly music: Music;
  /** Whether the faster boss theme is currently active. */
  private bossActive = false;
  private skin: ShipSkin = getSkinById(readEquippedSkinId());
  private trail: NeonTrail = getTrailById(readEquippedTrailId());
  private bgTheme: BackgroundTheme = getBackgroundById(readEquippedBackgroundId());
  private profile: Profile = readProfile();
  private sprites: SpriteSet | null = null;
  private bg: HTMLCanvasElement | null = null;
  private observer: ResizeObserver | null = null;
  private dpr = 1;
  private scale = 1;
  private px = 1;
  private H = 640;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private reduceMotion = false;

  private phase: Phase = "menu";
  private time = 0;
  private best = 0;
  private score = 0;
  private shownScore = 0;
  private kills = 0;
  private bossKills = 0;
  /** Index into BOSS_PALETTE — every boss killed shifts the next boss's hull colour. */
  private bossColor = 0;
  private missileKills = 0;
  private salvosFired = 0;
  private bombsUsed = 0;
  private shieldsUsed = 0;
  private hitsTaken = 0;
  private waveTookHit = false;
  private cleanWaves = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboTime = 0;
  private lastDamageSource: "gun" | "missile" = "gun";
  private startMissions: Mission[] = [];
  private notifiedMissions = new Set<string>();
  private wave = 0;
  private shake = 0;
  private flash = 0;
  private flashColor = "255,255,255";
  private slowT = 0;
  private warp = 0;

  private trailAcc = 0;
  private waveClock = 0;
  private clearTimer = 0;
  private banner: Banner | null = null;

  private player: Player = this.makePlayer();
  private stars: Star[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EBullet[] = [];
  private missileList: Missile[] = [];
  private enemies: Enemy[] = [];
  private powerups: PowerUp[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private queue: Timed[] = [];
  private timers: Timed[] = [];
  private menuBattle = new MenuBattle();

  private pid = -1;
  private lx = 0;
  private ly = 0;
  private keys = new Set<string>();

  constructor(host: HTMLElement, events: EngineEvents) {
    this.host = host;
    this.events = events;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    host.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not supported on this device.");
    this.g = ctx;

    this.best = readBest();
    this.sfx = new Sfx(
      readMuted(),
      readSfxMuted(),
      readMusicMuted(),
      readSfxVolume(),
      readMusicVolume(),
    );
    this.music = new Music(this.sfx);
    this.music.setTheme(this.bgTheme.id);
    this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.bind();
    this.resize();
    this.seedStars();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);

    // Re-bake sprites once the Orbitron font is ready so glyphs render correctly.
    const fonts = document.fonts;
    if (fonts?.load) {
      void Promise.all([fonts.load(`900 20px ${FONT}`), fonts.load(`600 12px ${FONT}`)])
        .then(() => {
          if (!this.destroyed) this.rebuildAssets();
        })
        .catch(() => undefined);
    }

    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------------------------- public API --------------------------- */

  getBest() {
    return this.best;
  }

  getSkin(): ShipSkin {
    return this.skin;
  }

  setSkin(skinId: string): ShipSkin {
    const next = getSkinById(writeEquippedSkinId(skinId));
    this.skin = next;
    this.rebuildAssets();
    if (this.phase === "menu") {
      this.player = this.makePlayer();
    }
    return next;
  }

  getTrail(): NeonTrail {
    return this.trail;
  }

  setTrail(trailId: string): NeonTrail {
    const next = getTrailById(writeEquippedTrailId(trailId));
    this.trail = next;
    return next;
  }

  getBackground(): BackgroundTheme {
    return this.bgTheme;
  }

  setBackground(bgId: string): BackgroundTheme {
    const next = getBackgroundById(writeEquippedBackgroundId(bgId));
    this.bgTheme = next;
    this.buildBackground();
    return next;
  }

  playBuySfx() {
    this.sfx.unlock();
    this.sfx.life();
  }

  playEquipSfx() {
    this.sfx.unlock();
    this.sfx.power();
  }

  updateSettings(settings: Profile["settings"]): void {
    this.profile = { ...this.profile, settings: { ...settings } };
  }

  getStartMissions(): Mission[] {
    return this.startMissions;
  }

  isMuted() {
    return this.sfx.isMuted();
  }

  setMuted(muted: boolean) {
    this.sfx.setMuted(muted);
    store(MUTE_KEY, muted ? "1" : "0");
    if (!muted) this.sfx.unlock();
  }

  isSfxMuted() {
    return this.sfx.isSfxMuted();
  }

  setSfxMuted(muted: boolean) {
    this.sfx.setSfxMuted(muted);
    store(SFX_MUTE_KEY, muted ? "1" : "0");
    if (!muted) this.sfx.unlock();
  }

  isMusicMuted() {
    return this.sfx.isMusicMuted();
  }

  setMusicMuted(muted: boolean) {
    this.sfx.setMusicMuted(muted);
    store(MUSIC_MUTE_KEY, muted ? "1" : "0");
    if (!muted) this.sfx.unlock();
  }

  getSfxVolume() {
    return this.sfx.getSfxVolume();
  }

  setSfxVolume(vol: number) {
    this.sfx.setSfxVolume(vol);
    store(SFX_VOL_KEY, String(vol));
  }

  getMusicVolume() {
    return this.sfx.getMusicVolume();
  }

  setMusicVolume(vol: number) {
    this.sfx.setMusicVolume(vol);
    store(MUSIC_VOL_KEY, String(vol));
  }

  testSfx() {
    this.sfx.unlock();
    this.sfx.shoot();
  }

  start() {
    this.profile = readProfile();
    this.startMissions = structuredClone(this.profile.missions);
    this.notifiedMissions.clear();
    this.sfx.unlock();
    this.commitBest();
    this.clearField();
    this.menuBattle.reset();
    this.score = 0;
    this.shownScore = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.bossColor = 0;
    this.missileKills = 0;
    this.bombsUsed = 0;
    this.shieldsUsed = 0;
    this.hitsTaken = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTime = 0;
    this.wave = 0;
    this.shake = 0;
    this.flash = 0;
    this.slowT = 0;
    this.warp = 1;
    this.banner = null;
    this.keys.clear();
    this.pid = -1;

    const p = this.makePlayer();
    p.ty = this.H - 112;
    p.invuln = 2;
    this.player = p;
    this.emitAbilities();

    this.bossActive = false;
    this.music.setBoss(false);
    this.setPhase("playing");
    this.startWave(1);
    this.music.start();
  }

  pause() {
    if (this.phase !== "playing") return;
    this.keys.clear();
    this.pid = -1;
    this.music.stop();
    // Push the exact shield time left so the UI ring resumes from the right spot.
    this.emitAbilities();
    this.setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.pid = -1;
    this.setPhase("playing");
    this.music.start();
  }

  quit() {
    this.commitBest();
    this.clearField();
    this.menuBattle.reset();
    this.banner = null;
    this.keys.clear();
    this.pid = -1;
    this.player = this.makePlayer();
    this.bossActive = false;
    this.music.setBoss(false);
    this.setPhase("menu");
    this.music.start();
  }

  /**
   * Wakes the audio graph from a user gesture so the menu theme can start.
   * Safe to call repeatedly.
   */
  prepareAudio() {
    this.sfx.unlock();
    if (this.phase === "menu" || this.phase === "playing") this.music.start();
  }

  /**
   * Bomb: wipes every enemy bullet currently on screen.
   * It never damages or destroys enemies.
   */
  bomb() {
    const p = this.player;
    if (this.phase !== "playing" || p.dead || p.bombs <= 0) return;
    p.bombs -= 1;
    this.bombsUsed += 1;
    this.emitAbilities();
    this.checkLiveMissions();
    // Short grace window so a bullet fired on the same frame can't hit you.
    p.invuln = Math.max(p.invuln, 0.5);

    this.sfx.bomb();
    this.vibrate(60);
    this.shake = Math.max(this.shake, 6);
    this.flash = 0.35;
    this.flashColor = "255,170,60";
    this.addRing(p.x, p.y, this.H * 1.05, 0.7, "#ff9a2e", 5);
    this.addRing(p.x, p.y, this.H * 0.8, 0.6, "#ffffff", 2, 0.08);
    this.clearEnemyBullets();
  }

  /**
   * Missile salvo: launches homing rockets that lock onto the nearest enemies
   * and explode with a small splash. Skin damage multipliers apply.
   */
  missiles() {
    const p = this.player;
    if (this.phase !== "playing" || p.dead || p.missiles <= 0) return;
    p.missiles -= 1;
    this.salvosFired += 1;
    this.emitAbilities();
    this.checkLiveMissions();

    const dmg = MISSILE_DAMAGE * this.skin.damageMultiplier;
    for (let i = 0; i < MISSILE_SALVO; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const spread = Math.floor(i / 2);
      this.missileList.push({
        x: p.x + side * (10 + spread * 4),
        y: p.y - 4,
        vx: side * (110 + spread * 40),
        vy: -40 - spread * 25,
        target: null,
        age: -spread * 0.06,
        dmg,
        trail: 0,
        dead: false,
      });
    }
    this.sfx.missile();
    this.vibrate(25);
    this.shake = Math.max(this.shake, 3);
  }

  /** Spends one stored shield charge. Does nothing while a shield is active. */
  activateShield() {
    const p = this.player;
    if (this.phase !== "playing" || p.dead || p.shields <= 0 || p.shield > 0) return;
    p.shields -= 1;
    p.shield = SHIELD_DURATION;
    this.shieldsUsed += 1;
    this.sfx.shieldOn();
    this.vibrate(20);
    this.addRing(p.x, p.y, 60, 0.45, "#5dffa8", 3);
    this.emitAbilities();
    this.checkLiveMissions();
  }

  private emitAbilities() {
    const p = this.player;
    this.events.onAbilities({
      bombs: p.bombs,
      missiles: p.missiles,
      shields: p.shields,
      shieldTime: Math.max(0, p.shield),
      shieldDuration: SHIELD_DURATION,
    });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("contextmenu", this.onContext);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.commitBest();
    this.music.dispose();
    this.sfx.close();
    c.remove();
  }

  /* ----------------------------- plumbing ---------------------------- */

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.events.onPhase(phase);
  }

  private maxLives(): number {
    return MAX_LIVES + (this.skin?.livesBonus ?? 0);
  }

  /**
   * Follow the menu's reserved space so the canvas ship moves with the menu,
   * including responsive sizing and scrolling, without covering any labels.
   */
  private menuShipY(): number {
    const slot = this.host?.parentElement?.querySelector<HTMLElement>(".menu-ship-space");
    const slotBounds = slot?.getBoundingClientRect();
    const canvasBounds = this.canvas?.getBoundingClientRect();
    if (slotBounds && canvasBounds && slotBounds.height > 0 && canvasBounds.width > 0) {
      // Position ship lower down the slot to avoid huge empty dead space at the bottom of the screen.
      const halfCss = (32 * canvasBounds.width) / W;
      // Keep comfortable breathing room (e.g. 24px) from the bottom edge of the container
      const bottomClearance = Math.max(18, (24 * canvasBounds.width) / W);
      const maxFromTop = Math.max(slotBounds.height * 0.45, slotBounds.height - bottomClearance - halfCss);
      const preferredFromTop = slotBounds.height * 0.72;
      const fromTop = Math.min(maxFromTop, preferredFromTop);
      const center = slotBounds.top - canvasBounds.top + fromTop;
      return (center * W) / canvasBounds.width;
    }

    const lowest = this.H - 75;
    const preferred = Math.max(this.H * 0.72, this.H - 120);
    return Math.max(this.H * 0.55, Math.min(preferred, lowest));
  }

  /**
   * Measures all interactive button areas in the main menu (.menu-center, .menu-top-bar)
   * in virtual canvas coordinates so background combat entities never overlap them.
   */
  private getMenuExclusionBoxes(): ExclusionBox[] {
    const boxes: ExclusionBox[] = [];
    if (!this.canvas || !this.host?.parentElement) return boxes;
    const canvasBounds = this.canvas.getBoundingClientRect();
    if (canvasBounds.width <= 0) return boxes;
    const scale = W / canvasBounds.width;

    // 1. Menu action buttons container (.menu-center)
    const menuCenter = this.host.parentElement.querySelector<HTMLElement>(".menu-center");
    if (menuCenter) {
      const r = menuCenter.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) {
        boxes.push({
          left: (r.left - canvasBounds.left) * scale,
          top: (r.top - canvasBounds.top) * scale,
          right: (r.right - canvasBounds.left) * scale,
          bottom: (r.bottom - canvasBounds.top) * scale,
        });
      }
    }

    // 2. Menu top bar (.menu-top-bar: pilot, shards, sound)
    const topBar = this.host.parentElement.querySelector<HTMLElement>(".menu-top-bar");
    if (topBar) {
      const r = topBar.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) {
        boxes.push({
          left: (r.left - canvasBounds.left) * scale,
          top: (r.top - canvasBounds.top) * scale,
          right: (r.right - canvasBounds.left) * scale,
          bottom: (r.bottom - canvasBounds.top) * scale,
        });
      }
    }

    return boxes;
  }

  private makePlayer(): Player {
    const bonusLives = this.skin?.livesBonus ?? 0;
    const mod = moduleStats(this.profile?.equippedModule ?? "vital-core");
    const y0 = this.menuShipY();
    return {
      x: W / 2,
      y: y0,
      tx: W / 2,
      ty: y0,
      lives: BASE_LIVES + bonusLives + mod.lives,
      bombs: START_BOMBS,
      missiles: START_MISSILES,
      shields: START_SHIELDS,
      weapon: 1,
      fireCd: 0,
      invuln: 0,
      shield: 0,
      bank: 0,
      speed: 0,
      dead: false,
      deadTimer: 0,
    };
  }

  private clearField() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.ebullets.length = 0;
    this.missileList.length = 0;
    this.powerups.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
    this.popups.length = 0;
    this.queue.length = 0;
    this.timers.length = 0;
  }

  private commitBest() {
    if (this.score > this.best) {
      this.best = this.score;
      store(BEST_KEY, String(this.best));
    }
  }

  private vibrate(ms: number) {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* unsupported */
    }
  }

  private bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("contextmenu", this.onContext);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private resize = () => {
    const cssW = this.host.clientWidth;
    const cssH = this.host.clientHeight;
    if (cssW < 10 || cssH < 10) return;
    const oldH = this.H;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = cssW / W;
    this.H = cssH / this.scale;
    this.px = this.scale * this.dpr;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.rebuildAssets();
    if (Math.abs(oldH - this.H) > 1) this.seedStars();
    const p = this.player;
    if (this.phase === "menu") {
      p.x = W / 2;
      p.tx = W / 2;
      p.y = this.menuShipY();
      p.ty = this.menuShipY();
    } else {
      p.tx = clamp(p.tx, 18, W - 18);
      p.ty = clamp(p.ty, 60, this.H - 108);
      p.y = clamp(p.y, 40, this.H + 60);
    }
  };

  private rebuildAssets() {
    this.sprites = buildSprites(this.px, this.skin);
    this.buildBackground();
  }

  /** Paints the equipped retro background theme into an offscreen canvas. */
  private buildBackground() {
    const theme = this.bgTheme;
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(this.px, this.px);
    const H = this.H;

    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, theme.top);
    base.addColorStop(0.5, theme.mid);
    base.addColorStop(1, theme.bottom);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    for (const gl of theme.glows) {
      const gr = g.createRadialGradient(W * gl.x, H * gl.y, 0, W * gl.x, H * gl.y, gl.r);
      gr.addColorStop(0, gl.color);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }

    // Striped retro sun (synthwave horizon).
    if (theme.sun) {
      const { x, y, r, from, to } = theme.sun;
      const cx = W * x;
      const cy = H * y;
      const grad = g.createLinearGradient(0, cy - r, 0, cy + r);
      grad.addColorStop(0, from);
      grad.addColorStop(1, to);
      g.save();
      g.globalAlpha = 0.6;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = grad;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      // horizontal gaps get wider toward the bottom of the sun
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "#000";
      for (let i = 0; i < 6; i += 1) {
        const gy = cy + r * 0.05 + i * (r * 0.16);
        g.fillRect(cx - r, gy, r * 2, 2 + i * 1.4);
      }
      g.restore();
    }

    // CRT scanlines.
    if (theme.scanlines) {
      g.fillStyle = "rgba(255,255,255,0.028)";
      for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
    }

    const vignette = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,8,0.4)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);
    this.bg = c;
  }

  private seedStars() {
    const stars: Star[] = [];
    const layer = (count: number, v: [number, number], len: [number, number], a: [number, number], w: number) => {
      for (let i = 0; i < count; i += 1) {
        stars.push({
          x: rand(0, W),
          y: rand(0, this.H),
          v: rand(v[0], v[1]),
          len: rand(len[0], len[1]),
          a: rand(a[0], a[1]),
          w,
        });
      }
    };
    layer(70, [25, 60], [2, 5], [0.25, 0.55], 1);
    layer(12, [90, 150], [6, 12], [0.3, 0.5], 1.2);
    layer(26, [240, 420], [14, 34], [0.12, 0.3], 1);
    this.stars = stars;
  }

  /* ------------------------------ input ------------------------------ */

  private onContext = (e: Event) => e.preventDefault();

  private onDown = (e: PointerEvent) => {
    if (this.phase !== "playing") return;
    if (e.pointerType === "mouse") {
      this.pointToTarget(e);
      return;
    }
    if (this.pid !== -1 && this.pid !== e.pointerId && this.profile.settings.secondFingerBomb) {
      // A second finger tapping anywhere fires a bomb.
      this.bomb();
      return;
    }
    this.pid = e.pointerId;
    this.lx = e.clientX;
    this.ly = e.clientY;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.phase !== "playing" || this.player.dead) return;
    if (e.pointerType === "mouse") {
      this.pointToTarget(e);
      return;
    }
    if (e.pointerId !== this.pid) return;
    const k = (1.25 * this.skin.speedMultiplier * this.profile.settings.sensitivity) / this.scale;
    const p = this.player;
    p.tx += (e.clientX - this.lx) * k;
    p.ty += (e.clientY - this.ly) * k;
    this.lx = e.clientX;
    this.ly = e.clientY;
    this.clampTarget();
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.pid) this.pid = -1;
  };

  private pointToTarget(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const p = this.player;
    p.tx = (e.clientX - rect.left) / this.scale;
    p.ty = (e.clientY - rect.top) / this.scale;
    this.clampTarget();
  }

  private clampTarget() {
    const p = this.player;
    p.tx = clamp(p.tx, 18, W - 18);
    // Keeps the hull (and its shield ring) above the bottom HUD block
    // (weapon pips + life ships), so it never hides behind that UI.
    p.ty = clamp(p.ty, 60, this.H - 108);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (code === "KeyP" || code === "Escape") {
      if (this.phase === "playing") this.pause();
      else if (this.phase === "paused") this.resume();
      return;
    }
    if (this.phase !== "playing") return;
    if (code === "Space" || code === "KeyB") {
      e.preventDefault();
      if (!e.repeat) this.bomb();
      return;
    }
    if (code === "KeyQ" || code === "KeyM") {
      e.preventDefault();
      if (!e.repeat) this.missiles();
      return;
    }
    if (code === "KeyE" || code === "ShiftLeft" || code === "ShiftRight") {
      e.preventDefault();
      if (!e.repeat) this.activateShield();
      return;
    }
    if (code.startsWith("Arrow") || ["KeyW", "KeyA", "KeyS", "KeyD"].includes(code)) {
      e.preventDefault();
      this.keys.add(code);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => this.pause();

  private onVisibility = () => {
    if (document.hidden) this.pause();
  };

  /* ---------------------------- main loop ---------------------------- */

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.033, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    if (this.phase === "playing") this.update(dt);
    else if (this.phase !== "paused") this.idle(dt);
    this.render();
  };

  /** Menu / game-over: only ambient motion. */
  private idle(dt: number) {
    this.time += dt;
    this.updateStars(dt);
    this.updateScore(dt);
    this.updateFx(dt);
    const p = this.player;
    if (!p.dead) {
      p.tx = W / 2;
      p.ty = this.menuShipY() + Math.sin(this.time * 1.6) * 4;
      this.followTarget(dt);
      this.emitTrail(dt);
    }
    if (this.phase === "menu") {
      const exclusionBoxes = this.getMenuExclusionBoxes();
      this.menuBattle.update(
        dt,
        this.player,
        this.H,
        this.reduceMotion,
        (x, y, vx, vy, life, col, size, dash, drag) => this.emit(x, y, vx, vy, life, col, size, dash, drag),
        (x, y, maxR, dur, col, w, delay) => this.addRing(x, y, maxR, dur, col, w, delay),
        exclusionBoxes,
      );
    }
  }

  private update(dt: number) {
    const real = dt;
    if (this.slowT > 0) {
      this.slowT -= real;
      dt = real * 0.4;
    }
    this.time += dt;
    this.updateStars(dt);
    this.updatePlayer(dt);
    this.updateWave(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updatePowerups(dt);
    this.collide();
    this.updateScore(dt);
    this.updateFx(dt);
    this.updateMusic();
    if (this.comboTime > 0) {
      this.comboTime -= dt;
      if (this.comboTime <= 0) this.combo = 0;
    }

    if (this.player.dead) {
      this.player.deadTimer -= real;
      if (this.player.deadTimer <= 0) this.endGame();
    }
  }

  private updateStars(dt: number) {
    const mul = 1 + this.warp * 2.2;
    this.warp = Math.max(0, this.warp - dt * 1.2);
    for (const s of this.stars) {
      s.y += s.v * mul * dt;
      if (s.y > this.H + s.len) {
        s.y = -s.len;
        s.x = rand(0, W);
      }
    }

  }

  /** Switches the soundtrack into its faster boss variant while a boss lives. */
  private updateMusic() {
    const boss = this.enemies.some((e) => e.kind === "boss" && !e.dead);
    if (boss === this.bossActive) return;
    this.bossActive = boss;
    this.music.setBoss(boss);
    if (boss) this.sfx.bossAlert();
  }

  private updateScore(dt: number) {
    const diff = this.score - this.shownScore;
    if (Math.abs(diff) < 1) this.shownScore = this.score;
    else this.shownScore += diff * Math.min(1, dt * 9);
    this.checkLiveMissions();
  }

  /**
   * Tracks mission progress silently during gameplay and persists it as soon as
   * a mission is completed. No in-game notification is shown: the player sees
   * completed missions in the menu's missions panel.
   */
  private checkLiveMissions() {
    if (this.phase !== "playing") return;
    const currentValues: Record<Mission["kind"], number> = {
      kills: this.kills,
      waves: this.wave,
      bosses: this.bossKills,
      missiles: this.missileKills,
      score: this.score,
      runs: 0,
      bombs: this.bombsUsed,
      shields: this.shieldsUsed,
      combo: this.maxCombo,
      noHit: 0,
    };
    // Score accumulates across runs like other counters; only combo is a peak.
    const peak: Mission["kind"][] = ["combo"];

    for (const m of this.profile.missions) {
      if (m.claimed || this.notifiedMissions.has(m.id)) continue;
      const base = this.startMissions.find((x) => x.id === m.id);
      const baseProgress = base ? base.progress : 0;
      if (baseProgress >= m.target) continue;

      const v = currentValues[m.kind] ?? 0;
      const cur = Math.min(
        m.target,
        peak.includes(m.kind) ? Math.max(baseProgress, v) : baseProgress + v,
      );
      m.progress = cur;

      if (cur >= m.target) {
        this.notifiedMissions.add(m.id);
        writeProfile(this.profile);
      }
    }
  }

  /* ------------------------------ player ----------------------------- */

  private followTarget(dt: number) {
    const p = this.player;
    const ox = p.x;
    const oy = p.y;
    const k = 1 - Math.exp(-20 * this.skin.speedMultiplier * dt);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    if (dt > 0) {
      const vx = (p.x - ox) / dt;
      p.bank += (clamp(vx / 260, -1, 1) - p.bank) * (1 - Math.exp(-12 * dt));
      p.speed = Math.hypot(vx, (p.y - oy) / dt);
    }
  }

  private emitTrail(dt: number) {
    const p = this.player;
    const trail = this.trail;
    this.trailAcc += dt * (trail.speed * 0.55);
    const isWave10Plus = this.wave >= 10;

    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      const life = rand(0.2, 0.45);
      const spreadX = trail.shape === "flame" || trail.shape === "overdrive" ? rand(-2.5, 2.5) : rand(-3.5, 3.5);
      const isSpark = trail.shape === "spark" || trail.shape === "arc";
      const isDash = isSpark;
      
      let particleColor = trail.color;
      if (trail.shape === "prism") {
        const spectrum = ["#ff224a", "#ff9a2e", "#ffd83a", "#5dffa8", "#22e6ff", "#d946ef"];
        particleColor = spectrum[Math.floor(Math.random() * spectrum.length)];
      } else if (Math.random() < 0.22) {
        particleColor = "#ffffff";
      }

      this.emit(
        p.x + spreadX,
        p.y + 18,
        rand(-12, 12),
        rand(trail.speed * 0.7, trail.speed * 1.3),
        life,
        particleColor,
        rand(trail.size * 0.8, trail.size * 1.3),
        isDash,
        0.5,
      );

      // Wave 10+ dynamic hyper-drive resonance particles
      if (isWave10Plus && Math.random() < 0.35) {
        this.emit(
          p.x + (Math.random() < 0.5 ? -14 : 14),
          p.y + 10,
          rand(-6, 6),
          rand(40, 90),
          rand(0.15, 0.3),
          "#ffffff",
          rand(1.2, 2.4),
          true,
          0.4,
        );
      }
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.dead) return;

    let kx = 0;
    let ky = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) kx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) kx += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) ky -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      const moveSpeed = 320 * this.skin.speedMultiplier * moduleStats(this.profile.equippedModule).speed;
      p.tx += (kx / len) * moveSpeed * dt;
      p.ty += (ky / len) * moveSpeed * dt;
      this.clampTarget();
    }

    this.followTarget(dt);
    this.emitTrail(dt);

    if (p.invuln > 0) p.invuln -= dt;
    if (p.shield > 0) {
      p.shield -= dt;
      if (p.shield <= 0) {
        p.shield = 0;
        this.emitAbilities();
      }
    }

    p.fireCd -= dt;
    if (p.fireCd <= 0) {
      this.firePlayer();
      p.fireCd = WEAPONS[p.weapon - 1].interval;
    }
  }

  private firePlayer() {
    const p = this.player;
    const dmgScale = this.skin.damageMultiplier * moduleStats(this.profile.equippedModule).damage;
    for (const [dx, ang, dmg] of WEAPONS[p.weapon - 1].shots) {
      this.bullets.push({
        x: p.x + dx,
        y: p.y - 18,
        vx: Math.sin(ang) * BULLET_SPEED,
        vy: -Math.cos(ang) * BULLET_SPEED,
        dmg: dmg * dmgScale,
        a: ang,
        dead: false,
      });
      this.spark(p.x + dx, p.y - 18, this.skin.color);
    }
    this.sfx.shoot();
  }

  private hurt() {
    const p = this.player;
    if (p.dead || p.invuln > 0 || p.shield > 0) return;
    p.lives -= 1;
    this.hitsTaken += 1;
    this.waveTookHit = true;
    this.combo = 0;
    this.comboTime = 0;
    p.weapon = Math.max(1, p.weapon - 1);
    this.explosion(p.x, p.y, 1.3, "#22e6ff");
    this.sfx.hurt();
    this.vibrate(70);
    this.shake = Math.max(this.shake, 14);
    this.flash = 0.6;
    this.flashColor = "255,40,90";
    this.clearEnemyBulletsNear(p.x, p.y, 140);
    this.addRing(p.x, p.y, 150, 0.5, "#22e6ff", 3);

    if (p.lives <= 0) {
      p.dead = true;
      p.deadTimer = 1.6;
      this.explosion(p.x, p.y, 2.4, "#22e6ff");
      this.sfx.explode(2.5);
      this.slowT = 0.6;
    } else {
      p.invuln = 2.4;
    }
  }

  private endGame() {
    const newRecord = this.score > this.best && this.score > 0;
    this.commitBest();
    this.enemies.length = 0;
    this.ebullets.length = 0;
    this.bullets.length = 0;
    this.missileList.length = 0;
    this.powerups.length = 0;
    this.queue.length = 0;
    this.banner = null;
    this.bossActive = false;
    this.music.setBoss(false);
    this.music.stop();
    this.sfx.gameOver();
    this.setPhase("gameover");
    this.events.onGameOver({
      score: this.score,
      best: this.best,
      wave: this.wave,
      kills: this.kills,
      newRecord,
      bosses: this.bossKills,
      missileKills: this.missileKills,
      maxCombo: this.maxCombo,
      bombsUsed: this.bombsUsed,
      shieldsUsed: this.shieldsUsed,
      flawless: this.hitsTaken <= 1,
    });
  }

  /* ------------------------------- waves ----------------------------- */

  private later(at: number, run: () => void) {
    this.queue.push({ at, run });
  }

  private startWave(n: number) {
    this.wave = n;
    this.queue.length = 0;
    this.waveClock = 0;
    this.clearTimer = 0;
    this.warp = 1;
    const boss = n % 5 === 0;
    this.banner = {
      title: `WAVE ${n}`,
      sub: n === 1 ? "AUTO-FIRE · DODGE!" : boss ? "WARNING · BOSS INCOMING" : WAVE_TIPS[(n - 2) % WAVE_TIPS.length],
      t: 0,
      dur: 2.6,
      color: boss ? "#ff224a" : "#13e0ff",
    };
    this.sfx.wave();
    this.planWave(n);
    this.queue.sort((a, b) => a.at - b.at);
  }

  private planWave(n: number) {
    const lead = 1.7;
    if (n % 5 === 0) {
      this.later(lead + 0.4, () => this.addEnemy("boss", W / 2, -80, { aux: 5.2 }));
      // Later bosses bring escorts so the arena is never empty around them.
      if (n >= 10) {
        this.later(lead + 1.1, () => {
          this.addEnemy("scout", 70, -26, {
            behavior: "hover",
            baseX: 70,
            targetY: 168,
            hold: 14,
            amp: 16,
            freq: 1.5,
            phase: 0,
          });
          this.addEnemy("scout", W - 70, -26, {
            behavior: "hover",
            baseX: W - 70,
            targetY: 168,
            hold: 14,
            amp: 16,
            freq: 1.5,
            phase: Math.PI,
          });
        });
      }
      if (n >= 15) {
        this.later(lead + 2.2, () =>
          this.addEnemy("tank", W / 2, -44, { targetY: 200, hold: 16, amp: 40, freq: 0.7 }),
        );
      }
      return;
    }
    const gap = Math.max(1.35, 2.9 - n * 0.12);
    const patterns: ((t: number) => void)[] = [
      (t) => this.rowPattern(t),
      (t) => this.columnsPattern(t),
      (t) => this.divePattern(t),
      (t) => this.sweepPattern(t),
      (t) => this.tankPattern(t),
    ];
    // Each wave lasts WAVE_LENGTH_SCALE times longer: the same progression of
    // formation types, repeated over a much longer timeline.
    const base = n === 1 ? [0, 0, 1] : n === 2 ? [0, 1, 2] : null;
    const slots = base ? base.length : Math.min(3 + Math.floor(n / 2), 9);
    // Long waves, but capped so late waves don't become endless slogs.
    const count = Math.min(slots * WAVE_LENGTH_SCALE, 15);
    // Cycle through every formation type (row, columns, dive, sweep, tank) so
    // no wave degenerates into a single heavy pattern, and cap tank formations
    // per wave — the old formula made wave 9 almost entirely tanks.
    const seq: number[] = [];
    const maxTanks = 1 + Math.floor(n / 6);
    let tanks = 0;
    for (let i = 0; i < count; i += 1) {
      let idx = base ? base[i % base.length] : (n + i) % patterns.length;
      if (idx === 4) {
        if (tanks >= maxTanks) idx = i % 2 === 0 ? 0 : 2;
        else tanks += 1;
      }
      seq.push(idx);
    }
    seq.forEach((idx, i) => {
      const k = idx === 4 && n < 3 ? 0 : idx;
      patterns[k](lead + i * gap);
    });
    // Special tactical units start appearing gradually, never all at once.
    if (n >= 3 && n % 5 !== 0) this.later(lead + gap * 1.5, () => this.addEnemy("kamikaze", rand(45, W - 45), -22, { vy: 125 + n * 4 }));
    if (n >= 4 && n % 5 !== 0) this.later(lead + gap * 3.2, () => this.addEnemy("medic", W / 2, -26, { targetY: 120, hold: 10 }));
    if (n >= 6 && n % 5 !== 0) this.later(lead + gap * 5, () => this.addEnemy(n % 2 ? "sniper" : "guardian", rand(80, W - 80), -30, { targetY: 105, hold: 12 }));
  }

  private rowPattern(t: number) {
    const n = this.wave;
    const count = Math.min(5 + Math.floor((n - 1) / 2), 8);
    const rowY = rand(62, 92);
    const hold = rand(4.6, 6.4) + n * 0.12;
    for (let i = 0; i < count; i += 1) {
      const x = (W * (i + 1)) / (count + 1);
      const ty = rowY + 34 * Math.sin((Math.PI * i) / Math.max(1, count - 1));
      this.later(t + i * 0.12, () => {
        this.addEnemy("scout", x, -26, {
          behavior: "hover",
          baseX: x,
          targetY: ty,
          hold,
          amp: rand(8, 18) + n * 0.4,
          freq: rand(1.2, 1.8) + n * 0.04,
          phase: rand(0, TAU),
        });
      });
    }
  }

  private columnsPattern(t: number) {
    const n = this.wave;
    const count = Math.min(4 + Math.floor((n - 1) / 2), 8);
    const speed = 54 + n * 4.2;
    const stagger = Math.max(0.22, 0.4 - n * 0.012);
    for (let i = 0; i < count; i += 1) {
      this.later(t + i * stagger, () => {
        this.addEnemy("scout", 70, -26, { behavior: "sine", baseX: 70, amp: 46, freq: 2.1 + n * 0.04, phase: 0, vy: speed });
        this.addEnemy("scout", W - 70, -26, {
          behavior: "sine",
          baseX: W - 70,
          amp: 46,
          freq: 2.1 + n * 0.04,
          phase: Math.PI,
          vy: speed,
        });
      });
    }
  }

  private divePattern(t: number) {
    const n = this.wave;
    const count = 3 + Math.min(5, Math.floor(n / 2.4));
    const gap = Math.max(0.26, 0.44 - n * 0.012);
    const vy = 132 + n * 6;
    for (let i = 0; i < count; i += 1) {
      this.later(t + i * gap, () => this.addEnemy("dart", rand(30, W - 30), -22, { vy }));
    }
  }

  private sweepPattern(t: number) {
    const n = this.wave;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 92 + n * 5.5;
    const count = Math.min(5 + Math.floor((n - 1) / 4), 8);
    for (let i = 0; i < count; i += 1) {
      this.later(t + i * 0.32, () => {
        this.addEnemy("scout", dir > 0 ? -26 : W + 26, 0, {
          behavior: "strafe",
          vx: dir * speed,
          targetY: 112,
          phase: i * 0.8,
        });
      });
    }
  }

  private tankPattern(t: number) {
    const n = this.wave;
    this.later(t, () => {
      this.addEnemy("tank", W / 2, -44, { targetY: 96, hold: rand(8, 11) + n * 0.15, amp: 52 + n, freq: 0.7 + n * 0.02 });
    });
    if (n >= 12) {
      this.later(t + 0.45, () => {
        this.addEnemy("tank", W * (Math.random() < 0.5 ? 0.28 : 0.72), -44, {
          targetY: 128,
          hold: rand(7, 10),
          amp: 36,
          freq: 0.85,
        });
      });
    }
    this.later(t + 0.8, () => {
      const spots = n >= 6 ? [0.18, 0.5, 0.82] : [0.2, 0.8];
      for (const fx of spots) {
        this.addEnemy("scout", W * fx, -26, {
          behavior: "hover",
          baseX: W * fx,
          targetY: 150,
          hold: 8,
          amp: 12,
          freq: 1.4,
          phase: rand(0, TAU),
        });
      }
    });
  }

  private updateWave(dt: number) {
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    if (this.player.dead) return;

    // Pacing: if too many enemies are alive, hold the spawn timeline until the
    // player thins them out. Waves stay long, but formations never pile up.
    const alive = this.enemies.reduce((n, en) => n + (en.dead ? 0 : 1), 0);
    if (alive < this.maxAliveEnemies()) this.waveClock += dt;
    while (this.queue.length > 0 && this.queue[0].at <= this.waveClock) {
      const job = this.queue.shift();
      job?.run();
    }

    if (this.queue.length === 0 && !this.enemies.some((e) => !e.dead)) {
      this.clearTimer += dt;
      if (this.clearTimer >= 1.3) this.finishWave();
    } else {
      this.clearTimer = 0;
    }
  }

  private finishWave() {
    if (!this.waveTookHit) this.cleanWaves += 1;
    this.waveTookHit = false;
    const bonus = 250 * this.wave;
    this.score += bonus;
    this.popup(W / 2, this.H * 0.47, `WAVE CLEAR +${bonus}`, "#8dffb5", 13);
    this.checkLiveMissions();
    this.startWave(this.wave + 1);
  }

  /* ------------------------------ enemies ---------------------------- */

  private addEnemy(kind: EnemyKind, x: number, y: number, o: Partial<Enemy> = {}): Enemy {
    const n = Math.max(1, this.wave);
    // Enemies are red combat spaceships at half size (radii scaled by 0.5)
    const defs: Record<EnemyKind, { behavior: Behavior; r: number; hp: number; score: number; fireEvery: number }> = {
      scout: {
        behavior: "hover",
        r: 7,
        hp: 2 + Math.floor((n - 1) / 3),
        score: 100 + n * 8,
        fireEvery: Math.max(1.25, 2.92 - n * 0.11),
      },
      dart: {
        behavior: "dive",
        r: 5.5,
        hp: 1 + Math.floor((n - 1) / 4),
        score: 150 + n * 10,
        fireEvery: 99,
      },
      tank: {
        behavior: "tank",
        r: 12,
        hp: 14 + Math.round(n * 2.4),
        score: 500 + n * 40,
        fireEvery: Math.max(1.08, 2.28 - n * 0.075),
      },
      medic: { behavior: "hover", r: 8, hp: 8 + n, score: 350 + n * 20, fireEvery: 3.2 },
      sniper: { behavior: "hover", r: 8, hp: 6 + n, score: 400 + n * 22, fireEvery: 2.8 },
      guardian: { behavior: "hover", r: 10, hp: 12 + n * 1.5, score: 500 + n * 25, fireEvery: 3.4 },
      kamikaze: { behavior: "dive", r: 6, hp: 2 + Math.floor(n / 4), score: 220 + n * 12, fireEvery: 99 },
      boss: {
        behavior: "boss",
        r: 22,
        // Doubled by ENEMY_HP_SCALE: wave 5 = 720, wave 10 = 920, wave 15 = 1120.
        hp: Math.round(360 + Math.max(0, n - 5) * 20),
        score: 3500 + n * 280,
        fireEvery: 1,
      },
    };
    const d = defs[kind];
    const e: Enemy = {
      kind,
      behavior: d.behavior,
      x,
      y,
      vx: 0,
      vy: 0,
      r: d.r,
      hp: d.hp,
      maxHp: d.hp,
      score: d.score,
      age: 0,
      baseX: x,
      targetY: 100,
      amp: 0,
      freq: 1,
      phase: 0,
      hold: 6,
      fireCd: rand(0.9, 2.2),
      fireEvery: d.fireEvery,
      flash: 0,
      leaving: false,
      aux: 0,
      spin: 0,
      dead: false,
      bossParts: kind === "boss" ? 2 : 0,
      ...o,
    };
    const diff = difficultyScale(this.profile.settings.difficulty);
    e.hp = Math.round(e.hp * ENEMY_HP_SCALE * diff.hp);
    e.score = Math.round(e.score * diff.score);
    e.maxHp = e.hp;
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      // Medics repair nearby allies in small, readable pulses.
      if (e.kind === "medic") {
        e.aux -= dt;
        if (e.aux <= 0) {
          e.aux = 2.5;
          for (const ally of this.enemies) {
            if (ally !== e && !ally.dead && Math.hypot(ally.x - e.x, ally.y - e.y) < 85) {
              ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, ally.maxHp * 0.05));
            }
          }
          this.addRing(e.x, e.y, 55, 0.45, "#5dffa8", 1.5);
        }
      }

      switch (e.behavior) {
        case "hover":
        case "tank": {
          e.x = e.baseX + Math.sin(e.age * e.freq + e.phase) * e.amp;
          if (!e.leaving) {
            e.y += (e.targetY - e.y) * (1 - Math.exp(-2.4 * dt));
            if (e.age > e.hold) {
              e.leaving = true;
              e.vy = 40;
            }
          } else {
            e.vy += 360 * dt;
            e.y += e.vy * dt;
          }
          break;
        }
        case "sine": {
          e.y += e.vy * dt;
          e.x = e.baseX + Math.sin(e.age * e.freq + e.phase) * e.amp;
          break;
        }
        case "dive": {
          const n = this.wave;
          if (!p.dead && e.y < p.y - 90 && e.age > 0.25) {
            const want = clamp((p.x - e.x) * (1.9 + n * 0.08), -160 - n * 5, 160 + n * 5);
            e.vx += (want - e.vx) * Math.min(1, (2.3 + n * 0.08) * dt);
          }
          e.vy = Math.min(e.vy + (210 + n * 5) * dt, 290 + n * 8);
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          break;
        }
        case "strafe": {
          e.x += e.vx * dt;
          e.y = e.targetY + Math.sin(e.age * 3 + e.phase) * 10 + e.age * 5;
          break;
        }
        case "boss": {
          const n = this.wave;
          if (e.age < 2.2) {
            e.y += (110 - e.y) * (1 - Math.exp(-2 * dt));
          } else {
            // Sway tuned for the slower player bullets (they need ~1.5s to
            // reach the boss), so shots aimed at it actually land.
            const sway = 0.34 + Math.min(0.22, n * 0.01);
            const amp = Math.min(95, 60 + n * 2);
            e.x = W / 2 + Math.sin((e.age - 2.2) * sway) * amp;
            e.y = 108 + Math.sin(e.age * (0.85 + n * 0.02)) * (10 + n * 0.4);
          }
          if (e.age > Math.max(1.55, 2.75 - n * 0.08) && !p.dead) this.bossAttack(e, dt);
          break;
        }
      }

      if (e.behavior !== "boss" && e.kind !== "dart" && !e.leaving && !p.dead && e.y > 8 && e.y < this.H - 110) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          this.enemyFire(e);
          e.fireCd = e.fireEvery * rand(0.8, 1.35);
        }
      }

      if (e.y > this.H + 60 || (e.age > 0.5 && (e.x < -70 || e.x > W + 70))) e.dead = true;
    }
    prune(this.enemies, (e) => !e.dead);
  }

  /** Max enemies on screen before new formations wait (grows slowly). */
  private maxAliveEnemies() {
    return Math.min(16, 9 + Math.floor(this.wave / 2));
  }

  /** Soft cap on enemy bullets; regular enemies hold fire above it. */
  private maxEnemyBullets() {
    return Math.min(70, 34 + this.wave * 3);
  }

  private enemyBulletSpeed() {
    return Math.min(94 + this.wave * 8.2, 230) * difficultyScale(this.profile.settings.difficulty).bullets;
  }

  private enemyFire(e: Enemy) {
    // Too much on screen already: skip this volley instead of flooding.
    if (this.ebullets.length >= this.maxEnemyBullets()) return;
    const p = this.player;
    const n = this.wave;
    const sp = this.enemyBulletSpeed();
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.kind === "sniper") {
      this.ebullet(e.x, e.y + 12, ang, sp * 1.35, false);
      return;
    }
    if (e.kind === "tank") {
      e.aux += 1;
      if (e.aux % 2 === 1) {
        const fan = n >= 13 ? 3 : 2;
        for (let k = -fan; k <= fan; k += 1) this.ebullet(e.x, e.y + 16, ang + k * 0.24, sp * 0.9, true);
      } else {
        const count = n >= 12 ? 12 : 10;
        const off = rand(0, TAU);
        for (let i = 0; i < count; i += 1) this.ebullet(e.x, e.y + 10, off + (i * TAU) / count, sp * 0.75, true);
      }
      return;
    }
    const triple = n >= 3 && Math.random() < Math.min(0.3, 0.035 * n);
    const spread = Math.max(0.04, 0.07 - n * 0.003);
    if (triple) {
      for (let k = -1; k <= 1; k += 1) this.ebullet(e.x, e.y + 12, ang + k * 0.22, sp, false);
    } else {
      this.ebullet(e.x, e.y + 12, ang + rand(-spread, spread), sp, false);
    }
  }

  private ebullet(x: number, y: number, angle: number, speed: number, amber: boolean) {
    if (this.ebullets.length > 420) return;
    this.ebullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.7, // half-size plasma bullet radius
      amber,
      dead: false,
    });
  }

  private bossAttack(e: Enemy, dt: number) {
    const p = this.player;
    const n = this.wave;
    const rage = e.hp < e.maxHp * 0.5;
    const pattern = Math.floor((e.age - 2.6) / Math.max(3.6, 5.2 - n * 0.08)) % 4;
    const haste = Math.max(0.62, 1 - (n - 5) * 0.035);

    e.aux -= dt;
    if (e.aux <= 0) {
      e.aux = Math.max(4.2, (rage ? 7.2 : 10.4) - n * 0.22);
      const spots = n >= 15 ? [-1, 0, 1] : [-1, 1];
      for (const s of spots) {
        this.addEnemy("scout", e.x + s * 40, e.y + 22, {
          behavior: "sine",
          baseX: e.x + s * 40,
          amp: 28 + n,
          freq: 2 + n * 0.04,
          phase: s > 0 ? 0 : Math.PI,
          vy: 72 + n * 1.6,
          fireEvery: Math.max(1.4, 3.1 - n * 0.08),
        });
      }
    }

    e.fireCd -= dt;
    if (e.fireCd > 0) return;
    const speed = 108 + (rage ? 28 : 0) + n * 4.2;

    switch (pattern) {
      case 0: {
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        const fan = n >= 15 ? 3 : 2;
        for (let k = -fan; k <= fan; k += 1) this.ebullet(e.x, e.y + 30, base + k * 0.16, speed, false);
        e.fireCd = (rage ? 0.66 : 0.92) * haste;
        break;
      }
      case 1: {
        e.spin += 0.16 + n * 0.004;
        const ang = Math.PI / 2 + Math.sin(e.spin) * 1.15;
        this.ebullet(e.x, e.y + 30, ang, speed, false);
        this.ebullet(e.x, e.y + 30, Math.PI - ang, speed, true);
        if (n >= 10) this.ebullet(e.x, e.y + 30, Math.PI / 2, speed * 0.9, n >= 15);
        e.fireCd = (rage ? 0.052 : 0.072) * haste;
        break;
      }
      case 2: {
        e.spin += 0.2;
        const count = 13 + Math.min(7, Math.floor(n / 5));
        for (let i = 0; i < count; i += 1) this.ebullet(e.x, e.y + 10, e.spin + (i * TAU) / count, speed * 0.85, true);
        e.fireCd = (rage ? 0.85 : 1.2) * haste;
        break;
      }
      default: {
        const cols = 12 + Math.min(4, Math.floor((n - 5) / 5));
        const gap = Math.floor(rand(1, cols - 2));
        const gapSize = n >= 15 ? 1 : 2;
        for (let i = 0; i < cols; i += 1) {
          if (i === gap || (gapSize > 1 && i === gap + 1)) continue;
          this.ebullet(18 + i * ((W - 36) / Math.max(1, cols - 1)), e.y + 34, Math.PI / 2, speed * 0.9, false);
        }
        e.fireCd = (rage ? 1.05 : 1.42) * haste;
      }
    }
  }

  private hitEnemy(e: Enemy, dmg: number, x: number, y: number) {
    if (e.dead) return;
    const guarded = e.kind !== "guardian" && this.enemies.some((g) => !g.dead && g.kind === "guardian" && Math.hypot(g.x - e.x, g.y - e.y) < 80);
    if (guarded) dmg *= 0.55;
    const ratioBefore = e.hp / e.maxHp;
    e.hp -= dmg;
    if (this.profile.settings.damageNumbers) this.popup(x, y, `${Math.round(dmg)}`, "#fff3b0", 7);
    if (e.kind === "boss" && e.bossParts > 0) {
      const threshold = e.bossParts === 2 ? 0.66 : 0.33;
      if (ratioBefore > threshold && e.hp / e.maxHp <= threshold) {
        e.bossParts -= 1;
        this.clearEnemyBullets();
        this.explosion(e.x + (e.bossParts ? -24 : 24), e.y, 1.2, "#ff5a5f");
        this.popup(e.x, e.y + 30, "WING DESTROYED", "#ffd83a", 11);
        this.sfx.explode(1.4);
      }
    }
    e.flash = 0.09;
    this.spark(x, y, this.skin.color);
    if (e.hp <= 0) this.kill(e);
    else this.sfx.hit();
  }

  private kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTime = 2.5;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (e.kind === "boss") {
      this.bossKills += 1;
      this.bossColor = (this.bossColor + 1) % BOSS_PALETTE.length;
    }
    if (this.lastDamageSource === "missile") this.missileKills += 1;
    const multiplier = 1 + Math.min(2, Math.floor(this.combo / 5) * 0.25);
    this.score += Math.round(e.score * multiplier);

    const boss = e.kind === "boss";
    const size = e.kind === "scout" ? 0.75 : e.kind === "dart" ? 0.65 : e.kind === "tank" ? 1.25 : 2.4;
    const color = e.kind === "boss"
      ? BOSS_PALETTE[(this.bossColor + BOSS_PALETTE.length - 1) % BOSS_PALETTE.length]
      : ENEMY_COLORS[e.kind];

    this.explosion(e.x, e.y, size, color);
    this.popup(e.x, e.y - 10, String(e.score), "#fff3b0", boss ? 18 : 12);
    this.sfx.enemyDown(e.kind);
    this.shake = Math.max(this.shake, size > 1.8 ? 14 : size > 1 ? 6 : 2.2);

    if (boss) {
      this.slowT = 0.9;
      this.flash = 0.6;
      this.flashColor = "255,40,75";
      this.clearEnemyBullets();
      for (let i = 1; i <= 7; i += 1) {
        this.timers.push({
          at: this.time + i * 0.1,
          run: () => {
            this.explosion(e.x + rand(-30, 30), e.y + rand(-20, 20), 1.0, i % 2 ? "#ff1e46" : "#ff4d6d");
            this.sfx.explode(1.2);
          },
        });
      }
      this.dropPower(e.x - 24, e.y, "weapon");
      this.dropPower(e.x + 24, e.y, this.player.lives < this.maxLives() ? "life" : "shield");
    } else {
      this.maybeDrop(e.x, e.y, e.kind === "tank" ? 0.55 : e.kind === "dart" ? 0.08 : 0.1);
    }
    this.checkLiveMissions();
  }

  /* ----------------------------- power-ups --------------------------- */

  private maybeDrop(x: number, y: number, chance: number) {
    const comboBonus = 1 + Math.min(0.5, this.combo * 0.015);
    if (Math.random() > chance * comboBonus) return;
    const p = this.player;
    const pool: [PowerType, number][] = [["weapon", 40]];
    if (p.bombs < MAX_BOMBS) pool.push(["bomb", 8]);
    if (p.missiles < MAX_MISSILES) pool.push(["missile", 14]);
    if (p.shields < MAX_SHIELDS) pool.push(["shield", 12]);
    if (p.lives < this.maxLives()) pool.push(["life", 12]);
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [type, w] of pool) {
      roll -= w;
      if (roll <= 0) {
        this.dropPower(x, y, type);
        return;
      }
    }
  }

  private dropPower(x: number, y: number, type: PowerType) {
    this.powerups.push({ x, y, type, age: 0, dead: false });
  }

  private updatePowerups(dt: number) {
    const p = this.player;
    for (const u of this.powerups) {
      u.age += dt;
      u.y += 62 * dt;
      u.x += Math.sin(u.age * 2) * 14 * dt;
      if (!p.dead) {
        const dx = p.x - u.x;
        const dy = p.y - u.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 80 * 80) {
          const d = Math.sqrt(d2) || 1;
          u.x += (dx / d) * 190 * dt;
          u.y += (dy / d) * 190 * dt;
        }
        if (d2 < 24 * 24) {
          this.collect(u);
          u.dead = true;
        }
      }
      if (u.y > this.H + 24) u.dead = true;
    }
    prune(this.powerups, (u) => !u.dead);
  }

  private collect(u: PowerUp) {
    const p = this.player;
    switch (u.type) {
      case "weapon":
        if (p.weapon < WEAPONS.length) {
          p.weapon += 1;
          this.popup(u.x, u.y - 14, "WEAPON UP", "#ffd83a", 11);
        } else {
          this.score += 500;
          this.popup(u.x, u.y - 14, "+500", "#ffd83a", 11);
        }
        this.sfx.power();
        break;
      case "bomb":
        if (p.bombs < MAX_BOMBS) {
          p.bombs += 1;
          this.popup(u.x, u.y - 14, "+1 BOMB", "#ff9a2e", 11);
        } else {
          this.score += 500;
          this.popup(u.x, u.y - 14, "+500", "#ff9a2e", 11);
        }
        this.sfx.power();
        this.emitAbilities();
        break;
      case "missile":
        if (p.missiles < MAX_MISSILES) {
          p.missiles += 1;
          this.popup(u.x, u.y - 14, "+1 MISSILES", "#ff5a5f", 11);
        } else {
          this.score += 500;
          this.popup(u.x, u.y - 14, "+500", "#ff5a5f", 11);
        }
        this.sfx.power();
        this.emitAbilities();
        break;
      case "shield":
        // Shields are stored and activated manually from the ability dock.
        if (p.shields < MAX_SHIELDS) {
          p.shields += 1;
          this.popup(u.x, u.y - 14, "+1 SHIELD", "#5dffa8", 11);
        } else {
          this.score += 500;
          this.popup(u.x, u.y - 14, "+500", "#5dffa8", 11);
        }
        this.sfx.power();
        this.emitAbilities();
        break;
      case "life":
        if (p.lives < this.maxLives()) {
          p.lives += 1;
          this.popup(u.x, u.y - 14, "1UP", "#22e6ff", 12);
        } else {
          this.score += 1000;
          this.popup(u.x, u.y - 14, "+1000", "#22e6ff", 12);
        }
        this.sfx.life();
        break;
    }
    this.vibrate(15);
  }

  /* -------------------------- projectiles & hits --------------------- */

  private updateShots(dt: number) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -24 || b.x < -24 || b.x > W + 24) b.dead = true;
    }
    prune(this.bullets, (b) => !b.dead);

    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.H + 16 || b.y < -30 || b.x < -16 || b.x > W + 16) b.dead = true;
    }
    prune(this.ebullets, (b) => !b.dead);
    this.updateMissiles(dt);
  }

  /** Picks the closest living enemy, preferring ones no other missile is chasing. */
  private pickMissileTarget(m: Missile): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.y < -10 || e.y > this.H) continue;
      const chasers = this.missileList.filter((o) => o !== m && !o.dead && o.target === e).length;
      const d = Math.hypot(e.x - m.x, e.y - m.y) + chasers * 60;
      if (d < bestScore) {
        bestScore = d;
        best = e;
      }
    }
    return best;
  }

  private updateMissiles(dt: number) {
    for (const m of this.missileList) {
      m.age += dt;
      if (m.age < 0) continue; // staggered launch
      if (!m.target || m.target.dead) m.target = this.pickMissileTarget(m);

      // After a short burst outward, steer toward the target (or straight up).
      if (m.age > 0.12) {
        const tx = m.target ? m.target.x : m.x;
        const ty = m.target ? m.target.y : -60;
        const speed = Math.min(460, 160 + m.age * 900);
        const dx = tx - m.x;
        const dy = ty - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const turn = Math.min(1, 7 * dt);
        m.vx += ((dx / d) * speed - m.vx) * turn;
        m.vy += ((dy / d) * speed - m.vy) * turn;
      } else {
        m.vx *= Math.exp(-3 * dt);
        m.vy -= 220 * dt;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Exhaust trail
      m.trail += dt * 60;
      while (m.trail >= 1) {
        m.trail -= 1;
        this.emit(m.x, m.y, rand(-15, 15), rand(-15, 15), rand(0.2, 0.35), Math.random() < 0.5 ? "#ffb347" : "#ff5a3c", rand(1.2, 2.2), false, 2);
      }

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (this.shotHits(e, m.x, m.y, 3)) {
          this.missileImpact(m);
          break;
        }
      }
      if (m.age > 3.5 || m.y < -40 || m.y > this.H + 40 || m.x < -40 || m.x > W + 40) m.dead = true;
    }
    prune(this.missileList, (m) => !m.dead);
  }

  private missileImpact(m: Missile) {
    m.dead = true;
    this.explosion(m.x, m.y, 0.6, "#ff7a3c");
    this.sfx.explode(0.6);
    // Direct hit plus a small splash on nearby enemies.
    this.lastDamageSource = "missile";
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (this.shotHits(e, m.x, m.y, 3)) this.hitEnemy(e, m.dmg, m.x, m.y);
      else if (this.shotHits(e, m.x, m.y, 24)) this.hitEnemy(e, m.dmg * 0.5, e.x, e.y);
    }
    this.lastDamageSource = "gun";
  }

  /**
   * Hit test for player shots/missiles against the visible hull. Uses an
   * ellipse matching each ship's real silhouette (bosses and tanks are much
   * wider than tall), so shots on the wings count.
   */
  private shotHits(e: Enemy, x: number, y: number, pad = 2) {
    const [hw, hh] =
      e.kind === "boss" ? [36, 21] : e.kind === "tank" ? [19, 16] : e.kind === "scout" ? [12, 11] : [10, 11];
    const dx = (x - e.x) / (hw + pad);
    const dy = (y - e.y) / (hh + pad);
    return dx * dx + dy * dy <= 1;
  }

  private collide() {
    const p = this.player;

    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (this.shotHits(e, b.x, b.y)) {
          b.dead = true;
          this.lastDamageSource = "gun";
          this.hitEnemy(e, b.dmg, b.x, b.y);
          break;
        }
      }
    }

    if (p.dead) return;
    const shielded = p.shield > 0;
    const safe = shielded || p.invuln > 0;

    for (const eb of this.ebullets) {
      if (eb.dead) continue;
      const dx = eb.x - p.x;
      const dy = eb.y - p.y;
      if (shielded) {
        if (dx * dx + dy * dy < 30 * 30) {
          eb.dead = true;
          this.spark(eb.x, eb.y, "#7dffb0");
        }
        continue;
      }
      if (safe) continue;
      const rr = eb.r + 4.5;
      if (dx * dx + dy * dy < rr * rr) {
        eb.dead = true;
        this.hurt();
        break;
      }
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.r + 8;
      if (dx * dx + dy * dy >= rr * rr) continue;
      if (shielded && (e.kind === "scout" || e.kind === "dart")) {
        this.kill(e);
        continue;
      }
      if (!safe) {
        this.hurt();
        if (e.kind === "scout" || e.kind === "dart") this.kill(e);
        break;
      }
    }
  }

  private clearEnemyBullets() {
    let sparks = 0;
    for (const b of this.ebullets) {
      if (sparks < 40) {
        this.spark(b.x, b.y, b.amber ? "#ff7043" : "#ff224a");
        sparks += 1;
      }
    }
    this.ebullets.length = 0;
  }

  private clearEnemyBulletsNear(x: number, y: number, radius: number) {
    for (const b of this.ebullets) {
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        b.dead = true;
        this.spark(b.x, b.y, "#ff224a");
      }
    }
    prune(this.ebullets, (b) => !b.dead);
  }

  /* -------------------------------- fx ------------------------------- */

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size: number,
    dash: boolean,
    drag: number,
  ) {
    if (this.particles.length > 520 * this.profile.settings.particles) return;
    this.particles.push({ x, y, vx, vy, life, max: life, color, size, dash, drag });
  }

  private spark(x: number, y: number, color: string) {
    for (let i = 0; i < 3; i += 1) {
      const a = rand(0, TAU);
      const s = rand(40, 120);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.3), color, 1.3, true, 3);
    }
  }

  private addRing(x: number, y: number, maxR: number, dur: number, color: string, width: number, delay = 0) {
    this.rings.push({ x, y, r0: 6, maxR, t: 0, dur, delay, color, width });
  }

  private explosion(x: number, y: number, size: number, color: string) {
    const count = Math.round(9 * size + 6);
    const speedScale = Math.sqrt(size);
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, TAU);
      const s = rand(60, 200) * speedScale;
      this.emit(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.3, 0.65),
        Math.random() < 0.35 ? "#ffffff" : color,
        rand(1.2, 2.2),
        true,
        2.2,
      );
    }
    this.addRing(x, y, 44 * Math.pow(size, 0.8) + 4, 0.5, color, 2.5);
    if (size > 1.2) this.addRing(x, y, 62 * Math.pow(size, 0.8), 0.65, "#ffffff", 1.6, 0.08);
  }

  private popup(x: number, y: number, text: string, color: string, size: number) {
    this.popups.push({ x: clamp(x, 40, W - 40), y, text, t: 0, dur: 0.9, color, size });
  }

  private updateFx(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      const d = Math.exp(-q.drag * dt);
      q.vx *= d;
      q.vy *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    prune(this.particles, (q) => q.life > 0);

    for (const r of this.rings) {
      if (r.delay > 0) r.delay -= dt;
      else r.t += dt;
    }
    prune(this.rings, (r) => r.t < r.dur);

    for (const t of this.popups) t.t += dt;
    prune(this.popups, (t) => t.t < t.dur);

    for (let i = 0; i < this.timers.length; ) {
      if (this.timers[i].at <= this.time) {
        const [job] = this.timers.splice(i, 1);
        job.run();
      } else {
        i += 1;
      }
    }

    this.shake *= Math.exp(-8 * dt);
    if (this.shake < 0.05) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  /* ----------------------------- rendering --------------------------- */

  private spriteFor(kind: EnemyKind, s: SpriteSet): Sprite {
    if (kind === "boss") return s.bossSkins[this.bossColor % s.bossSkins.length];
    return s[kind];
  }

  private render() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0);
    else {
      g.fillStyle = "#0a0618";
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const s = this.sprites;
    if (!s) return;

    g.setTransform(this.px, 0, 0, this.px, 0, 0);
    this.drawStars(g);

    g.save();
    if (this.shake > 0) {
      const amp = this.shake * (this.reduceMotion ? 0.25 : 1) * this.profile.settings.screenShake * 0.6;
      g.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }
    this.drawPowerups(g, s);
    this.drawEnemies(g, s);
    this.drawPlayerShots(g, s);
    this.drawMissiles(g);
    this.drawEnemyShots(g, s);
    if (this.phase === "menu") {
      const exclusionBoxes = this.getMenuExclusionBoxes();
      this.menuBattle.draw(g, s, this.player, this.time, exclusionBoxes, this.H);
      this.drawPlayer(g, s);
      if (exclusionBoxes.length > 0) {
        g.save();
        g.beginPath();
        g.rect(-60, -60, W + 120, this.H + 120);
        for (const box of exclusionBoxes) {
          const pad = 4;
          g.rect(
            box.left - pad,
            box.top - pad,
            box.right - box.left + pad * 2,
            box.bottom - box.top + pad * 2,
          );
        }
        g.clip("evenodd");
        this.drawFx(g);
        g.restore();
      } else {
        this.drawFx(g);
      }
    } else {
      this.drawPlayer(g, s);
      this.drawFx(g);
    }
    this.drawPopups(g);
    g.restore();

    if (this.flash > 0) {
      g.fillStyle = `rgba(${this.flashColor},${this.flash * 0.4})`;
      g.fillRect(0, 0, W, this.H);
    }
    if (this.phase !== "menu") this.drawHud(g, s);
    if (this.banner) this.drawBanner(g, this.banner);
  }

  private drawStars(g: CanvasRenderingContext2D) {
    g.fillStyle = this.bgTheme.starColor;
    for (const s of this.stars) {
      g.globalAlpha = s.a;
      g.fillRect(s.x, s.y, s.w, s.len);
    }
    g.globalAlpha = 1;
  }

  private drawPowerups(g: CanvasRenderingContext2D, s: SpriteSet) {
    for (const u of this.powerups) {
      const sp =
        u.type === "weapon"
          ? s.pWeapon
          : u.type === "bomb"
          ? s.pBomb
          : u.type === "missile"
          ? s.pMissile
          : u.type === "shield"
          ? s.pShield
          : s.pLife;
      const pulse = 1 + Math.sin(u.age * 5) * 0.07;
      g.save();
      g.translate(u.x, u.y);
      g.scale(pulse, pulse);
      g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      g.restore();
    }
  }

  private drawEnemies(g: CanvasRenderingContext2D, s: SpriteSet) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sp = this.spriteFor(e.kind, s);
      g.save();
      g.translate(e.x, e.y);
      if (e.kind === "dart") g.rotate(Math.atan2(-e.vx, Math.max(e.vy, 1)));
      else if (e.kind === "scout") {
        const pulse = 1 + Math.sin(e.age * 6 + e.phase) * 0.035;
        g.scale(pulse, pulse);
      }
      g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      if (e.kind !== "scout" && e.kind !== "dart" && e.kind !== "kamikaze" && e.kind !== "boss") {
        const bw = 24;
        g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(-bw / 2, -e.r - 9, bw, 2.5);
        g.fillStyle = ENEMY_COLORS[e.kind];
        g.fillRect(-bw / 2, -e.r - 9, bw * clamp(e.hp / e.maxHp, 0, 1), 2.5);
      }
      if (e.kind === "sniper" && e.fireCd < 0.65 && e.fireCd > 0) {
        g.strokeStyle = `rgba(255,255,255,${1 - e.fireCd / 0.65})`;
        g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 5); g.lineTo(this.player.x - e.x, this.player.y - e.y); g.stroke();
      }
      if (e.flash > 0) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, e.flash * 8) * 0.75;
        g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      }
      g.restore();
    }
  }

  private drawPlayerShots(g: CanvasRenderingContext2D, s: SpriteSet) {
    const sp = s.bullet;
    for (const b of this.bullets) {
      if (b.a === 0) {
        g.drawImage(sp.c, b.x - sp.w / 2, b.y - sp.h / 2, sp.w, sp.h);
      } else {
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.a);
        g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
        g.restore();
      }
    }
  }

  private drawMissiles(g: CanvasRenderingContext2D) {
    for (const m of this.missileList) {
      if (m.age < 0) continue;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2);
      // flame
      g.globalCompositeOperation = "lighter";
      g.fillStyle = "rgba(255,150,60,0.9)";
      g.beginPath();
      g.moveTo(-1.6, 4);
      g.lineTo(1.6, 4);
      g.lineTo(0, 9 + Math.random() * 3);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "source-over";
      // body
      g.fillStyle = "#ffe3d6";
      g.strokeStyle = "#ff5a3c";
      g.lineWidth = 0.8;
      g.shadowColor = "#ff5a3c";
      g.shadowBlur = 6;
      g.beginPath();
      g.moveTo(0, -5);
      g.lineTo(1.7, -2);
      g.lineTo(1.7, 4);
      g.lineTo(-1.7, 4);
      g.lineTo(-1.7, -2);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
  }

  private drawEnemyShots(g: CanvasRenderingContext2D, s: SpriteSet) {
    g.globalCompositeOperation = "lighter";
    for (const b of this.ebullets) {
      const sp = b.amber ? s.orbAmber : s.orbPink;
      g.drawImage(sp.c, b.x - sp.w / 2, b.y - sp.h / 2, sp.w, sp.h);
      if (this.profile.settings.colorBlind) {
        g.strokeStyle = "#ffffff"; g.lineWidth = 1;
        g.beginPath(); g.arc(b.x, b.y, 5, 0, TAU); g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  private drawPlayer(g: CanvasRenderingContext2D, s: SpriteSet) {
    const p = this.player;
    if (p.dead) return;
    const blink = p.invuln > 0 && p.shield <= 0 && Math.floor(this.time * 14) % 2 === 0;
    g.save();
    g.translate(p.x, p.y);
    g.globalAlpha = blink ? 0.35 : 1;
    g.scale(1 - Math.abs(p.bank) * 0.14, 1);
    g.rotate(p.bank * 0.1);

    // engine flame
    const wave10Boost = this.wave >= 10 ? Math.min(6, (this.wave - 9) * 0.8) : 0;
    const flame = 9 + Math.random() * 7 + Math.min(5, p.speed / 80) + wave10Boost;
    g.globalCompositeOperation = "lighter";
    g.fillStyle = this.trail ? this.trail.color : this.skin.color;
    g.beginPath();
    g.moveTo(-4.5, 15);
    g.lineTo(4.5, 15);
    g.lineTo(0, 15 + flame);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.moveTo(-2, 15);
    g.lineTo(2, 15);
    g.lineTo(0, 15 + flame * 0.58);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = "source-over";

    g.drawImage(s.player.c, -s.player.w / 2, -s.player.h / 2, s.player.w, s.player.h);
    g.restore();

    // Wave 10+ Dynamic Ship Overdrive Aura & Resonance Animations
    if (this.wave >= 10 && !p.dead) {
      const overdriveTier = Math.min(2.5, 1 + (this.wave - 10) * 0.08);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
      const auraR = (28 + Math.sin(this.time * 5) * 2.5) * Math.min(1.3, overdriveTier);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = (0.24 + 0.16 * pulse) * (p.invuln > 0 ? 0.35 : 1);
      g.strokeStyle = this.skin.color;
      g.lineWidth = 1.6 + pulse * 1.2;
      g.beginPath();
      g.arc(p.x, p.y, auraR, 0, TAU);
      g.stroke();

      // Energy orbit prongs
      const rot = this.time * 3;
      for (let i = 0; i < 3; i++) {
        const a = rot + (i * TAU) / 3;
        g.lineWidth = 1.2;
        g.strokeStyle = "rgba(255,255,255,0.85)";
        g.beginPath();
        g.arc(p.x, p.y, auraR + 2, a, a + 0.4);
        g.stroke();
      }
      g.restore();
    }

    if (p.shield > 0) {
      const fade = p.shield < 1.5 ? 0.35 + 0.65 * Math.abs(Math.sin(this.time * 12)) : 1;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.85 * fade;
      g.strokeStyle = "#5dffa8";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(p.x, p.y, 29 + Math.sin(this.time * 6) * 1.2, 0, TAU);
      g.stroke();
      g.globalAlpha = 0.12 * fade;
      g.fillStyle = "#5dffa8";
      g.fill();
      g.restore();
    }
  }

  private drawFx(g: CanvasRenderingContext2D) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";

    for (const r of this.rings) {
      if (r.delay > 0) continue;
      const u = r.t / r.dur;
      const ease = 1 - Math.pow(1 - u, 3);
      const rad = r.r0 + (r.maxR - r.r0) * ease;
      const a = Math.pow(1 - u, 1.4);
      g.strokeStyle = r.color;
      g.globalAlpha = a * 0.28;
      g.lineWidth = r.width * 3 * (1 - u) + 1;
      g.beginPath();
      g.arc(r.x, r.y, rad, 0, TAU);
      g.stroke();
      g.globalAlpha = a;
      g.lineWidth = r.width * (1 - u) + 0.5;
      g.beginPath();
      g.arc(r.x, r.y, rad, 0, TAU);
      g.stroke();
    }

    for (const q of this.particles) {
      const a = clamp(q.life / q.max, 0, 1);
      g.globalAlpha = a;
      if (q.dash) {
        g.strokeStyle = q.color;
        g.lineWidth = q.size;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - q.vx * 0.045, q.y - q.vy * 0.045);
        g.stroke();
      } else {
        g.fillStyle = q.color;
        const size = q.size * (0.4 + 0.6 * a);
        g.fillRect(q.x - size / 2, q.y - size / 2, size, size);
      }
    }
    g.restore();
  }

  private drawPopups(g: CanvasRenderingContext2D) {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of this.popups) {
      const u = t.t / t.dur;
      const rise = 28 * (1 - Math.pow(1 - u, 3));
      const pop = u < 0.14 ? 1.4 - 0.4 * (u / 0.14) : 1;
      g.globalAlpha = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
      g.font = `800 ${t.size}px ${FONT}`;
      g.fillStyle = t.color;
      g.save();
      g.translate(t.x, t.y - rise);
      g.scale(pop, pop);
      g.fillText(t.text, 0, 0);
      g.restore();
    }
    g.restore();
  }

  private drawHud(g: CanvasRenderingContext2D, s: SpriteSet) {
    const p = this.player;
    const H = this.H;
    const ls = g as CanvasRenderingContext2D & { letterSpacing: string };

    g.save();
    g.textBaseline = "alphabetic";
    g.textAlign = "left";

    ls.letterSpacing = "2px";
    g.font = `600 9px ${FONT}`;
    g.fillStyle = "rgba(120,232,255,0.88)";
    g.fillText("SCORE", 14, 22);

    ls.letterSpacing = "1px";
    g.font = `900 19px ${FONT}`;
    g.fillStyle = "#eafcff";
    g.shadowColor = "#19e6ff";
    g.shadowBlur = 12;
    g.fillText(pad7(Math.round(this.shownScore)), 14, 49);
    g.shadowBlur = 0;

    // Best score line sits between the score digits (baseline 49) and the
    // wave chip below it, updating live as the player passes their record.
    ls.letterSpacing = "2px";
    g.font = `700 9px ${FONT}`;
    g.fillStyle = "rgba(255, 216, 58, 0.8)";
    g.fillText(`BEST ${pad7(this.best)}`, 14, 60);

    // Wave chip sits right-aligned directly above the KILLS counter.
    const waveLabel = `WAVE ${this.wave}`;
    ls.letterSpacing = "1.5px";
    g.font = `800 10px ${FONT}`;
    const chipW = Math.max(54, g.measureText(waveLabel).width + 16);
    const chipX = W - 14 - chipW;
    g.fillStyle = this.wave % 5 === 0 ? "rgba(255,34,74,0.22)" : "rgba(34,230,255,0.16)";
    g.strokeStyle = this.wave % 5 === 0 ? "rgba(255,34,74,0.85)" : "rgba(34,230,255,0.7)";
    g.lineWidth = 1;
    g.beginPath();
    const r = 4;
    const chipY = 50;
    const chipH = 16;
    g.moveTo(chipX + r, chipY);
    g.lineTo(chipX + chipW - r, chipY);
    g.quadraticCurveTo(chipX + chipW, chipY, chipX + chipW, chipY + r);
    g.lineTo(chipX + chipW, chipY + chipH - r);
    g.quadraticCurveTo(chipX + chipW, chipY + chipH, chipX + chipW - r, chipY + chipH);
    g.lineTo(chipX + r, chipY + chipH);
    g.quadraticCurveTo(chipX, chipY + chipH, chipX, chipY + chipH - r);
    g.lineTo(chipX, chipY + r);
    g.quadraticCurveTo(chipX, chipY, chipX + r, chipY);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = this.wave % 5 === 0 ? "#ff7086" : "#9df6ff";
    g.textAlign = "right";
    g.fillText(waveLabel, chipX + chipW - 8, chipY + 11.5);

    // Combo counter sits below the score and best score on the left side
    if (this.combo >= 2) {
      g.textAlign = "left";
      ls.letterSpacing = "2px";
      g.font = `800 11px ${FONT}`;
      g.fillStyle = "#ffd83a";
      g.shadowColor = "#ffd83a";
      g.shadowBlur = 10;
      g.fillText(`COMBO x${this.combo}`, 14, 75);
      g.shadowBlur = 0;
    }

    // boss health
    const boss = this.enemies.find((e) => e.kind === "boss" && !e.dead);
    if (boss) {
      const bossColor = BOSS_PALETTE[this.bossColor % BOSS_PALETTE.length];
      const bw = 200;
      const bx = (W - bw) / 2;
      const by = 98;
      ls.letterSpacing = "3px";
      g.textAlign = "center";
      g.font = `700 8px ${FONT}`;
      g.fillStyle = bossColor;
      g.fillText("BOSS", W / 2, by - 6);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(bx, by, bw, 5);
      const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, bossColor);
      grad.addColorStop(1, "#ffffff");
      g.fillStyle = grad;
      g.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 5);
    }

    // Total destruction counter (enemy ships + bosses), right-aligned below
    // the wave chip so the two stack on the right edge.
    g.textAlign = "right";
    ls.letterSpacing = "2px";
    g.font = `800 11px ${FONT}`;
    g.fillStyle = "#ffd83a";
    g.shadowColor = "#ffd83a";
    g.shadowBlur = 10;
    g.fillText(`KILLS ${this.kills}`, W - 14, 82);
    g.shadowBlur = 0;

    // Lives + weapon level stack flush with the bottom-right corner of the
    // screen (right edge + bottom edge): lives on top, weapon pips below.
    // The ability dock floats just above this stack (bottom: 76px in CSS).
    const hudRight = W - 14;

    // weapon level (bottom row)
    const pipY = H - 24;
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const on = i < p.weapon;
      g.fillStyle = on ? "#ffd83a" : "rgba(255,255,255,0.14)";
      if (on) {
        g.shadowColor = "#ffd83a";
        g.shadowBlur = 6;
      }
      g.fillRect(hudRight - (WEAPONS.length - i) * 11 + 3, pipY, 8, 8);
      g.shadowBlur = 0;
    }
    ls.letterSpacing = "1.5px";
    g.textAlign = "right";
    g.font = `600 9px ${FONT}`;
    g.fillStyle = "#d6e86a";
    g.fillText("WEAPON", hudRight - WEAPONS.length * 11 - 2, pipY + 7);

    // life ships (row above the weapon pips)
    const maxLives = this.maxLives();
    const iconW = 18;
    const iconH = 18;
    const iconGap = 4;
    const iconY = H - 52;
    ls.letterSpacing = "2px";
    g.font = `700 8px ${FONT}`;
    g.fillStyle = "rgba(120,200,255,0.9)";
    g.fillText("HEALTH", hudRight, iconY - 4);
    for (let i = 0; i < maxLives; i += 1) {
      const alive = i < p.lives;
      g.globalAlpha = alive ? 1 : 0.16;
      if (alive) {
        g.shadowColor = "#22e6ff";
        g.shadowBlur = 7;
      }
      g.drawImage(s.lifeIcon.c, hudRight - (maxLives - i) * (iconW + iconGap) + iconGap, iconY, iconW, iconH);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }

    g.restore();
  }

  private drawBanner(g: CanvasRenderingContext2D, b: Banner) {
    const ls = g as CanvasRenderingContext2D & { letterSpacing: string };
    const u = b.t / b.dur;
    const alpha = u < 0.12 ? u / 0.12 : u > 0.78 ? (1 - u) / 0.22 : 1;
    const sc = u < 0.12 ? 1.25 - 0.25 * (u / 0.12) : 1 + (u - 0.12) * 0.04;

    g.save();
    g.translate(W / 2, this.H * 0.38);
    g.scale(sc, sc);
    g.globalAlpha = clamp(alpha, 0, 1);
    g.textAlign = "center";
    g.textBaseline = "middle";

    ls.letterSpacing = "3px";
    g.font = `900 34px ${FONT}`;
    g.fillStyle = "#eaffff";
    g.shadowColor = b.color;
    g.shadowBlur = 22;
    g.fillText(b.title, 0, 0);
    g.shadowBlur = 8;
    g.fillText(b.title, 0, 0);
    g.shadowBlur = 0;

    ls.letterSpacing = "2px";
    g.font = `500 11px ${FONT}`;
    g.fillStyle = "rgba(214,224,255,0.92)";
    g.fillText(b.sub, 0, 34);
    g.restore();
  }
}
