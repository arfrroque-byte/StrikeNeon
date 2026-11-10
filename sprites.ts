import { SHIP_SKINS, type Pt, type ShipSkin } from "./skins";

export const FONT = '"Orbitron Variable", "Orbitron", system-ui, sans-serif';

const TAU = Math.PI * 2;

export interface Sprite {
  c: HTMLCanvasElement;
  w: number;
  h: number;
}

export interface SpriteSet {
  player: Sprite;
  scout: Sprite;
  dart: Sprite;
  tank: Sprite;
  medic: Sprite;
  sniper: Sprite;
  guardian: Sprite;
  kamikaze: Sprite;
  bossSkins: Sprite[];
  bullet: Sprite;
  orbPink: Sprite; // Red plasma orb
  orbAmber: Sprite; // Fiery red-orange plasma orb
  pWeapon: Sprite;
  pBomb: Sprite;
  pMissile: Sprite;
  pShield: Sprite;
  pLife: Sprite;
  lifeIcon: Sprite;
  bombIcon: Sprite;
}

/** Boss flagship hull colour cycles through this palette after every boss killed. */
export const BOSS_PALETTE = ["#ff1e46", "#ff8a1e", "#ffd21f", "#39ff8a", "#22e6ff", "#9a5cff", "#ff2bd6"];

/** Signature hull colour of each enemy ship class — every class reads as its own colour. */
export const ENEMY_COLORS: Record<"scout" | "dart" | "tank" | "medic" | "sniper" | "guardian" | "kamikaze", string> = {
  scout: "#ff224a",
  dart: "#ff8a1e",
  tank: "#ff2bd6",
  medic: "#5dffa8",
  sniper: "#9a5cff",
  guardian: "#22e6ff",
  kamikaze: "#ffd21f",
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

type G = CanvasRenderingContext2D;

/** Renders a sprite once, at device resolution, centred on its origin. */
function make(w: number, h: number, px: number, draw: (g: G) => void): Sprite {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * px));
  c.height = Math.max(1, Math.ceil(h * px));
  const g = c.getContext("2d");
  if (g) {
    g.scale(px, px);
    g.translate(w / 2, h / 2);
    draw(g);
  }
  return { c, w, h };
}

function poly(g: G, pts: Pt[]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
}

function ngon(cx: number, cy: number, r: number, n: number, rot: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = rot + (i * TAU) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Fills the current path and strokes it with a double-pass neon glow. */
function neon(g: G, color: string, width: number, blur: number, fill?: string | CanvasGradient) {
  g.lineJoin = "round";
  g.lineCap = "round";
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = color;
  g.lineWidth = width;
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.stroke();
  g.shadowBlur = blur * 0.4;
  g.stroke();
  g.shadowBlur = 0;
}

/** Half-size glowing plasma orbs for enemy shots (14x14 px, radius 6). */
function orb(px: number, rgb: string): Sprite {
  return make(14, 14, px, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 6.2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.28, "rgba(255,240,245,1)");
    gr.addColorStop(0.42, `rgba(${rgb},1)`);
    gr.addColorStop(0.72, `rgba(${rgb},0.5)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 6.2, 0, TAU);
    g.fill();
  });
}

function power(px: number, color: string, fill: string, glyph: string, size = 46): Sprite {
  return make(size, size, px, (g) => {
    poly(g, ngon(0, 0, 14, 6, -Math.PI / 2));
    neon(g, color, 2, 10, fill);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#ffffff";
    if (glyph === "+") {
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(6, 0);
      g.moveTo(0, -6);
      g.lineTo(0, 6);
      g.stroke();
    } else {
      g.font = `900 14px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(glyph, 0, 1);
    }
  });
}

/** Player spaceship sprite - KEPT AT EXACT FULL SIZE (80x84 px) with tiered detail (Common < Epic < Legendary). */
export function buildPlayerSprite(px: number, skin: ShipSkin = SHIP_SKINS[0]): Sprite {
  return make(80, 84, px, (g) => {
    const isCommon = skin.rarity === "common";
    const isEpic = skin.rarity === "epic";
    const isLegendary = skin.rarity === "legendary";

    // 1. LEGENDARY ONLY: Background celestial energy halo
    if (isLegendary) {
      g.save();
      g.beginPath();
      g.arc(0, 0, 27, 0, TAU);
      g.strokeStyle = skin.color;
      g.lineWidth = 1.2;
      g.shadowColor = skin.color;
      g.shadowBlur = 12;
      g.stroke();
      // Outer dashed resonance ring
      g.beginPath();
      g.setLineDash([4, 4]);
      g.arc(0, 0, 31, 0, TAU);
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 0.9;
      g.stroke();
      g.restore();
    }

    // 2. Base hull polygon and gradient fill
    poly(g, skin.hull);
    const grad = g.createLinearGradient(0, -28, 0, 22);
    grad.addColorStop(0, skin.fillTop);
    grad.addColorStop(1, skin.fillBottom);

    const glowBlur = isLegendary ? 20 : isEpic ? 14 : 8;
    const strokeW = isLegendary ? 2.6 : isEpic ? 2.2 : 1.8;
    neon(g, skin.color, strokeW, glowBlur, grad);

    // 3. LEGENDARY ONLY: Inner hull resonance trace & forward hyper-canards
    if (isLegendary) {
      // Echo the unique hull shape inside
      g.save();
      g.beginPath();
      skin.hull.forEach(([x, y], i) => {
        const sx = x * 0.7;
        const sy = y * 0.7;
        if (i === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      });
      g.closePath();
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = 1.2;
      g.shadowColor = skin.color;
      g.shadowBlur = 10;
      g.stroke();
      g.restore();

      // Forward hyper-canard plasma prongs flanking prow
      g.beginPath();
      g.moveTo(-4, -26);
      g.lineTo(-9, -15);
      g.moveTo(4, -26);
      g.lineTo(9, -15);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.4;
      g.stroke();

      // Outboard plasma crystal energy emitters on wingtips
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * 22, 12, 2.4, 0, TAU);
        g.fillStyle = "#ffffff";
        g.shadowColor = skin.color;
        g.shadowBlur = 10;
        g.fill();
        g.strokeStyle = skin.color;
        g.lineWidth = 1.4;
        g.stroke();
      }
    }

    // 4. EPIC & LEGENDARY: Structural wing armor conduits & secondary energy traces
    if (isEpic || isLegendary) {
      g.beginPath();
      g.moveTo(-10, -2);
      g.lineTo(-19, 13);
      g.moveTo(10, -2);
      g.lineTo(19, 13);
      g.strokeStyle = skin.color;
      g.globalAlpha = isLegendary ? 0.95 : 0.8;
      g.lineWidth = isLegendary ? 1.8 : 1.4;
      g.stroke();

      // Secondary white energy conduit
      g.beginPath();
      g.moveTo(-6, -7);
      g.lineTo(-14, 6);
      g.moveTo(6, -7);
      g.lineTo(14, 6);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.0;
      g.stroke();

      // Wingtip stabilizer fins
      g.beginPath();
      g.moveTo(-21, 13);
      g.lineTo(-25, 18);
      g.moveTo(21, 13);
      g.lineTo(25, 18);
      g.strokeStyle = isLegendary ? "#ffffff" : skin.color;
      g.lineWidth = 1.4;
      g.stroke();
    }

    // 5. COMMON ONLY: Minimalist, clean central spine (no heavy wing clutter)
    if (isCommon) {
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(0, 11);
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = 1.0;
      g.stroke();
    }

    g.globalAlpha = 1;

    // 6. Cockpit Canopy
    poly(g, [[0, -12], [4.5, -1], [0, 8], [-4.5, -1]]);
    g.fillStyle = skin.cockpitColor;
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = isCommon ? 0.9 : 1.2;
    g.stroke();

    // 7. Epic: Inner glowing cockpit slit
    if (isEpic || isLegendary) {
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(0, 4);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.5;
      g.stroke();
    }

    // 8. Legendary ONLY: Hyper-reactor core diamond jewel below cockpit
    if (isLegendary) {
      poly(g, [[0, 3], [3.5, 6.5], [0, 10], [-3.5, 6.5]]);
      g.fillStyle = "#ffffff";
      g.shadowColor = skin.color;
      g.shadowBlur = 12;
      g.fill();
      g.shadowBlur = 0;
    }
  });
}

export function buildBulletSprite(px: number, color: string, cockpitColor = "#ffffff"): Sprite {
  return make(8, 16, px, (g) => {
    g.beginPath();
    g.arc(0, -3.2, 1.4, Math.PI, 0);
    g.arc(0, 3.2, 1.4, 0, Math.PI);
    g.closePath();
    const grad = g.createLinearGradient(0, -5, 0, 5);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, cockpitColor);
    grad.addColorStop(1, color);
    neon(g, color, 1.3, 7, grad);

    // High-energy white laser core
    g.beginPath();
    g.moveTo(0, -3.8);
    g.lineTo(0, 2.8);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1;
    g.lineCap = "round";
    g.stroke();
  });
}

export function buildSprites(px: number, skin: ShipSkin = SHIP_SKINS[0]): SpriteSet {
  // Player ship kept at original full size (80x84)
  const player = buildPlayerSprite(px, skin);
  const C = ENEMY_COLORS;

  // =========================================================================
  // 1. SCOUT FIGHTER (Scout spaceship, half size: 30x30 px) — RED
  // NOSE POINTS DOWN (+Y) toward the player: sharp chin wedge, wings swept
  // back (up), forward cockpit canopy and stern engine glows at the top.
  // =========================================================================
  const scout = make(30, 30, px, (g) => {
    // Down-facing fighter hull: nose tip at bottom, wings swept upward
    const scoutHull: Pt[] = [
      [0, 12], [3, 4.5], [5.5, 3], [11, -5], [11.5, -8], [5, -5.5], [2.5, -9],
      [0, -6.5], [-2.5, -9], [-5, -5.5], [-11.5, -8], [-11, -5], [-5.5, 3], [-3, 4.5],
    ];
    poly(g, scoutHull);
    const grad = g.createLinearGradient(0, -10, 0, 12);
    grad.addColorStop(0, rgba(C.scout, 0.25));
    grad.addColorStop(1, rgba(C.scout, 0.5));
    neon(g, C.scout, 1.4, 7, grad);

    // Wing conduits swept back toward the stern (up/outward)
    g.beginPath();
    g.moveTo(-3.5, 1);
    g.lineTo(-9, -5);
    g.moveTo(3.5, 1);
    g.lineTo(9, -5);
    g.strokeStyle = rgba(C.scout, 0.65);
    g.lineWidth = 0.8;
    g.stroke();

    // Forward cockpit canopy (shifted toward the nose, below center)
    poly(g, [[0, 8], [2.2, 2], [0, -2], [-2.2, 2]]);
    g.fillStyle = "rgba(255, 240, 244, 0.95)";
    g.fill();
    g.strokeStyle = C.scout;
    g.lineWidth = 0.7;
    g.stroke();

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 2.5, -8, 1, 0, TAU);
      g.fillStyle = rgba(C.scout, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 2. DART INTERCEPTOR (Dart spaceship, half size: 28x28 px) — ORANGE
  // NOSE POINTS DOWN (+Y): needle prow dives toward the player, stabilizers
  // and engine glows trail behind at the top.
  // =========================================================================
  const dart = make(28, 28, px, (g) => {
    const dartHull: Pt[] = [
      [0, 12], [3, 2], [10, -7], [6, -10], [2, -6],
      [0, -9], [-2, -6], [-6, -10], [-10, -7], [-3, 2],
    ];
    poly(g, dartHull);
    const grad = g.createLinearGradient(0, -10, 0, 12);
    grad.addColorStop(0, rgba(C.dart, 0.25));
    grad.addColorStop(1, rgba(C.dart, 0.5));
    neon(g, C.dart, 1.4, 7, grad);

    // Glowing spine running toward the nose
    g.beginPath();
    g.moveTo(0, -4);
    g.lineTo(0, 9);
    g.strokeStyle = rgba(C.dart, 0.7);
    g.lineWidth = 1;
    g.stroke();

    // Forward pilot core (shifted toward the nose)
    g.beginPath();
    g.arc(0, 3, 1.8, 0, TAU);
    g.fillStyle = "#ffffff";
    g.fill();

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 2, -7.5, 0.9, 0, TAU);
      g.fillStyle = rgba(C.dart, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 3. TANK CRUISER (Tank dreadnought spaceship, half size: 48x48 px) — MAGENTA
  // NOSE POINTS DOWN (+Y): protruding prow wedge, forward plasma cannons,
  // reactor core ahead of center and stern engines trailing at the top.
  // =========================================================================
  const tank = make(48, 48, px, (g) => {
    const tankHull: Pt[] = [
      [0, 18], [7, 12], [15, 12], [20, 4], [16, -6], [19, -13], [11, -15],
      [0, -12], [-11, -15], [-19, -13], [-16, -6], [-20, 4], [-15, 12], [-7, 12],
    ];
    poly(g, tankHull);
    const grad = g.createLinearGradient(0, -15, 0, 18);
    grad.addColorStop(0, rgba(C.tank, 0.3));
    grad.addColorStop(1, rgba(C.tank, 0.5));
    neon(g, C.tank, 1.6, 9, grad);

    // Inner heavy armor plates
    poly(g, [
      [0, 10], [8, 7], [10, -4], [0, -3], [-10, -4], [-8, 7],
    ]);
    g.strokeStyle = rgba(C.tank, 0.65);
    g.lineWidth = 1;
    g.stroke();

    // Forward dual plasma cannons (firing downward toward the player)
    g.beginPath();
    g.moveTo(-8, 13);
    g.lineTo(-8, 20);
    g.moveTo(8, 13);
    g.lineTo(8, 20);
    g.strokeStyle = rgba(C.tank, 0.9);
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.stroke();

    // Reactor core (ahead of center, toward the nose)
    g.beginPath();
    g.arc(0, 2, 4.2, 0, TAU);
    g.fillStyle = rgba(C.tank, 0.85);
    g.fill();
    g.beginPath();
    g.arc(0, 2, 2, 0, TAU);
    g.fillStyle = "#ffffff";
    g.fill();

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 5, -12, 1.2, 0, TAU);
      g.fillStyle = rgba(C.tank, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 3b. MEDIC FRIGATE (medic spaceship, half size: 30x30 px) — GREEN
  // Wide support hull with twin recovery pods and a medical cross emblem.
  // =========================================================================
  const medic = make(30, 30, px, (g) => {
    const hull: Pt[] = [
      [0, 10], [6, 12], [13, 8], [13, -2], [8, -6], [0, -8], [-8, -6], [-13, -2], [-13, 8], [-6, 12],
    ];
    poly(g, hull);
    const grad = g.createLinearGradient(0, -8, 0, 12);
    grad.addColorStop(0, rgba(C.medic, 0.3));
    grad.addColorStop(1, rgba(C.medic, 0.5));
    neon(g, C.medic, 1.4, 7, grad);

    // Twin recovery pods bolted to the flanks
    for (const s of [-1, 1]) {
      poly(g, [[s * 13, -2], [s * 9, -2], [s * 9, 5], [s * 13, 5]]);
      g.fillStyle = rgba(C.medic, 0.35);
      g.fill();
      g.strokeStyle = C.medic;
      g.lineWidth = 0.9;
      g.stroke();
    }

    // Red cross emblem on the hull face
    g.fillStyle = C.medic;
    g.fillRect(-1.7, -1, 3.4, 8);
    g.fillRect(-4.8, 1.4, 9.6, 3.2);
    g.strokeStyle = "rgba(230, 255, 240, 0.9)";
    g.lineWidth = 0.5;
    g.strokeRect(-1.7, -1, 3.4, 8);
    g.strokeRect(-4.8, 1.4, 9.6, 3.2);

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 4, -6.5, 1, 0, TAU);
      g.fillStyle = rgba(C.medic, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 3c. SNIPER RAILGUN (sniper spaceship, half size: 30x34 px) — VIOLET
  // Needle hull with a long forward railgun barrel and optic eye.
  // =========================================================================
  const sniper = make(30, 34, px, (g) => {
    // Long railgun barrel protruding toward the nose
    g.beginPath();
    g.moveTo(0, 5);
    g.lineTo(0, 15.5);
    g.strokeStyle = C.sniper;
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.stroke();

    const hull: Pt[] = [
      [0, 6], [3.5, 0], [6.5, -6], [3, -12], [0, -10], [-3, -12], [-6.5, -6], [-3.5, 0],
    ];
    poly(g, hull);
    const grad = g.createLinearGradient(0, -12, 0, 8);
    grad.addColorStop(0, rgba(C.sniper, 0.3));
    grad.addColorStop(1, rgba(C.sniper, 0.5));
    neon(g, C.sniper, 1.3, 7, grad);

    // Swept scope fins
    g.beginPath();
    g.moveTo(3, -2);
    g.lineTo(9, -9);
    g.moveTo(-3, -2);
    g.lineTo(-9, -9);
    g.strokeStyle = rgba(C.sniper, 0.85);
    g.lineWidth = 0.9;
    g.stroke();

    // Optic targeting eye ahead of center
    g.beginPath();
    g.arc(0, 1, 2, 0, TAU);
    g.fillStyle = "rgba(242, 234, 255, 0.95)";
    g.fill();
    g.beginPath();
    g.arc(0, 1, 0.9, 0, TAU);
    g.fillStyle = C.sniper;
    g.fill();

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 1.6, -11, 0.9, 0, TAU);
      g.fillStyle = rgba(C.sniper, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 3d. GUARDIAN BULWARK (guardian spaceship, half size: 36x36 px) — CYAN
  // Hexagonal shield hull with layered armor arcs and a central pylon.
  // =========================================================================
  const guardian = make(36, 36, px, (g) => {
    poly(g, ngon(0, 1, 13, 6, Math.PI / 6));
    const grad = g.createLinearGradient(0, -12, 0, 14);
    grad.addColorStop(0, rgba(C.guardian, 0.3));
    grad.addColorStop(1, rgba(C.guardian, 0.5));
    neon(g, C.guardian, 1.6, 9, grad);

    // Layered armor arcs facing the player
    g.beginPath();
    g.arc(0, 1, 8.5, Math.PI * 0.2, Math.PI * 0.8);
    g.strokeStyle = rgba(C.guardian, 0.9);
    g.lineWidth = 1.4;
    g.stroke();
    g.beginPath();
    g.arc(0, 1, 5.5, Math.PI * 0.25, Math.PI * 0.75);
    g.strokeStyle = rgba(C.guardian, 0.6);
    g.lineWidth = 1;
    g.stroke();

    // Central pylon spine
    g.fillStyle = rgba(C.guardian, 0.45);
    g.fillRect(-2, -7, 4, 14);
    g.strokeStyle = C.guardian;
    g.lineWidth = 0.8;
    g.strokeRect(-2, -7, 4, 14);

    // Shield emitter studs around the hexagon
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 6 + (i * TAU) / 6;
      g.beginPath();
      g.arc(Math.cos(a) * 13, 1 + Math.sin(a) * 13, 1.1, 0, TAU);
      g.fillStyle = "rgba(224, 250, 255, 0.95)";
      g.fill();
    }

    // Stern engine glows (top = rear of the ship)
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(s * 5, -8, 1.1, 0, TAU);
      g.fillStyle = rgba(C.guardian, 0.85);
      g.fill();
    }
  });

  // =========================================================================
  // 3e. RED KAMIKAZE SPIKE-BOMB (kamikaze spaceship, half size: 26x26 px)
  // Compact diamond core with outer attack spikes and a burning fuse core.
  // =========================================================================
  const kamikaze = make(26, 26, px, (g) => {
    const hull: Pt[] = [
      [0, 10.5], [3, 3], [10.5, 0], [3, -3], [0, -10.5], [-3, -3], [-10.5, 0], [-3, 3],
    ];
    poly(g, hull);
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, 11);
    grad.addColorStop(0, rgba(C.kamikaze, 0.6));
    grad.addColorStop(1, rgba(C.kamikaze, 0.3));
    neon(g, C.kamikaze, 1.4, 8, grad);

    // Outer attack spikes on the diagonals
    g.beginPath();
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      g.moveTo(sx * 4.5, sy * 4.5);
      g.lineTo(sx * 9, sy * 9);
    }
    g.strokeStyle = rgba(C.kamikaze, 0.85);
    g.lineWidth = 1.2;
    g.lineCap = "round";
    g.stroke();

    // Burning fuse core
    g.beginPath();
    g.arc(0, 0, 2.8, 0, TAU);
    g.fillStyle = "rgba(255, 170, 60, 0.9)";
    g.fill();
    g.beginPath();
    g.arc(0, 0, 1.2, 0, TAU);
    g.fillStyle = "#ffffff";
    g.fill();

    // Fuse spark at the stern (top = rear of the ship)
    g.beginPath();
    g.arc(0, -8, 1, 0, TAU);
    g.fillStyle = "rgba(255, 235, 170, 0.95)";
    g.fill();
  });

  // =========================================================================
  // 4. RED BOSS FLAGSHIP (Boss mothership, half size: 94x72 px)
  // NOSE POINTS DOWN (+Y): prow wedge dives toward the player, forward chin
  // cannons, reactor ahead of center and engine array trailing at the top.
  // Rebuilt per palette colour so each new boss wears a different hull tint.
  // =========================================================================
  function buildBossSprite(px: number, color: string): Sprite {
    return make(94, 72, px, (g) => {
      const bossHull: Pt[] = [
        [0, 24], [11, 16], [28, 20], [37, 5], [24, -7], [20, -22], [7, -15],
        [0, -20], [-7, -15], [-20, -22], [-24, -7], [-37, 5], [-28, 20], [-11, 16],
      ];
      poly(g, bossHull);
      const grad = g.createLinearGradient(0, -22, 0, 24);
      grad.addColorStop(0, rgba(color, 0.15));
      grad.addColorStop(0.4, rgba(color, 0.3));
      grad.addColorStop(1, rgba(color, 0.5));
      neon(g, color, 1.8, 11, grad);

      // Sweeping wing energy conduits converging on the forward prow
      g.beginPath();
      g.moveTo(-24, -7);
      g.lineTo(-11, 6);
      g.lineTo(0, 14);
      g.lineTo(11, 6);
      g.lineTo(24, -7);
      g.strokeStyle = rgba(color, 0.85);
      g.lineWidth = 1.1;
      g.stroke();

      // Forward chin wedge highlighting the downward nose
      g.beginPath();
      g.moveTo(-6, 17);
      g.lineTo(0, 22);
      g.lineTo(6, 17);
      g.strokeStyle = rgba(color, 0.9);
      g.lineWidth = 1;
      g.stroke();

      // Wing plasma emitter pods (forward of center)
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * 29, 10, 2.8, 0, TAU);
        g.fillStyle = "rgba(255,235,242,0.95)";
        g.fill();
      }

      // Heavy forward bridge & reactor core (ahead of center, toward the nose)
      g.beginPath();
      g.arc(0, 5, 10.5, 0, TAU);
      g.strokeStyle = rgba(color, 0.85);
      g.lineWidth = 1.2;
      g.stroke();
      g.beginPath();
      g.arc(0, 5, 6.4, 0, TAU);
      g.fillStyle = rgba(color, 0.8);
      g.fill();
      g.beginPath();
      g.arc(0, 5, 3.2, 0, TAU);
      g.fillStyle = "#ffffff";
      g.fill();

      // Stern engine array (top = rear of the ship)
      for (const ex of [-12, 0, 12]) {
        g.beginPath();
        g.arc(ex, -18, 1.8, 0, TAU);
        g.fillStyle = rgba(color, 0.75);
        g.fill();
      }
    });
  }

  // =========================================================================
  // 5. BULLETS (Half size: 8x14 px for player, 14x14 px for enemy orbs)
  // Shot color dynamically matches the equipped player ship skin color!
  // =========================================================================
  const bullet = buildBulletSprite(px, skin.color, skin.cockpitColor);

  // Life icon on HUD matches equipped player ship hull
  const lifeIcon = make(26, 26, px, (g) => {
    g.scale(0.4, 0.4);
    g.translate(0, 3);
    poly(g, skin.hull);
    neon(g, skin.color, 3.4, 6, skin.fillTop);
  });

  const bombIcon = make(26, 26, px, (g) => {
    poly(g, ngon(0, 0, 10.5, 6, -Math.PI / 2));
    neon(g, "#ff9a2e", 1.6, 5, "rgba(255,154,46,0.18)");
    g.fillStyle = "#ffcf9a";
    g.font = `900 10px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("B", 0, 1);
  });

  return {
    player,
    scout,
    dart,
    tank,
    medic,
    sniper,
    guardian,
    kamikaze,
    bossSkins: BOSS_PALETTE.map((color) => buildBossSprite(px, color)),
    bullet,
    // Red and Fiery Orange-Red plasma shots matching the red armada
    orbPink: orb(px, "255,30,65"),
    orbAmber: orb(px, "255,90,35"),
    pWeapon: power(px, "#ffd83a", "rgba(255,216,58,0.18)", "W"),
    pBomb: power(px, "#ff9a2e", "rgba(255,154,46,0.18)", "B"),
    pMissile: power(px, "#ff5a5f", "rgba(255,90,95,0.18)", "M"),
    pShield: power(px, "#5dffa8", "rgba(93,255,168,0.18)", "S"),
    pLife: power(px, "#22e6ff", "rgba(34,230,255,0.18)", "+"),
    lifeIcon,
    bombIcon,
  };
}
