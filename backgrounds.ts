/**
 * Retro background themes for the playfield.
 * NEON VOID is the free default; the other 5 cost shards.
 * Price: $1.99 at the 500-shards-per-$5.99 rate → 166 shards.
 */
export interface BackgroundTheme {
  id: string;
  name: string;
  cost: number;
  tagline: string;
  /** Vertical gradient stops. */
  top: string;
  mid: string;
  bottom: string;
  /** Soft radial glows; x/y are fractions of the playfield. */
  glows: { x: number; y: number; r: number; color: string }[];
  /** Optional striped retro sun on the horizon. */
  sun?: { x: number; y: number; r: number; from: string; to: string };
  /** Optional CRT-style scanlines. */
  scanlines?: boolean;
  starColor: string;
  /** CSS used for the store preview card. */
  css: string;
}

export const BACKGROUND_COST_SHARDS = 200;

export const UNLOCKED_BGS_KEY = "strike-neon:unlocked-bgs";
export const EQUIPPED_BG_KEY = "strike-neon:equipped-bg";

export const BACKGROUNDS: BackgroundTheme[] = [
  {
    id: "neon-void",
    name: "NEON VOID",
    cost: 0,
    tagline: "Default deep-space nebula.",
    top: "#0b0620",
    mid: "#140a30",
    bottom: "#080a24",
    glows: [
      { x: 0.2, y: 0.24, r: 230, color: "rgba(125,45,205,0.32)" },
      { x: 0.92, y: 0.7, r: 270, color: "rgba(20,90,205,0.22)" },
      { x: 0.08, y: 0.97, r: 210, color: "rgba(205,30,165,0.17)" },
      { x: 0.78, y: 0.08, r: 170, color: "rgba(0,165,225,0.09)" },
    ],
    starColor: "#e8f1ff",
    css: "linear-gradient(180deg,#0b0620 0%,#140a30 50%,#080a24 100%)",
  },
  {
    id: "synth-sunset",
    name: "SYNTH SUNSET",
    cost: BACKGROUND_COST_SHARDS,
    tagline: "80s horizon with a striped retro sun.",
    top: "#12032e",
    mid: "#3a0a4e",
    bottom: "#23041f",
    glows: [
      { x: 0.5, y: 0.78, r: 300, color: "rgba(255,90,60,0.20)" },
      { x: 0.12, y: 0.16, r: 190, color: "rgba(130,40,220,0.25)" },
      { x: 0.88, y: 0.3, r: 180, color: "rgba(255,43,150,0.14)" },
    ],
    sun: { x: 0.5, y: 0.74, r: 86, from: "#ffd83a", to: "#ff2bd6" },
    starColor: "#ffe3f2",
    css: "linear-gradient(180deg,#12032e 0%,#3a0a4e 46%,#b1255f 74%,#23041f 100%)",
  },
  {
    id: "vapor-tide",
    name: "VAPOR TIDE",
    cost: BACKGROUND_COST_SHARDS,
    tagline: "Teal abyss with drifting cyan haze.",
    top: "#021622",
    mid: "#07354a",
    bottom: "#031c28",
    glows: [
      { x: 0.25, y: 0.3, r: 250, color: "rgba(0,190,215,0.20)" },
      { x: 0.85, y: 0.72, r: 260, color: "rgba(40,120,235,0.18)" },
      { x: 0.55, y: 0.05, r: 170, color: "rgba(120,255,230,0.10)" },
    ],
    starColor: "#d2fbff",
    css: "linear-gradient(180deg,#021622 0%,#07354a 52%,#031c28 100%)",
  },
  {
    id: "midnight-arcade",
    name: "MIDNIGHT ARCADE",
    cost: BACKGROUND_COST_SHARDS,
    tagline: "CRT blue cabinet glow with scanlines.",
    top: "#06061f",
    mid: "#151043",
    bottom: "#0a0830",
    glows: [
      { x: 0.5, y: 0.1, r: 220, color: "rgba(60,80,255,0.22)" },
      { x: 0.15, y: 0.78, r: 230, color: "rgba(255,43,214,0.16)" },
      { x: 0.9, y: 0.5, r: 200, color: "rgba(0,200,255,0.14)" },
    ],
    scanlines: true,
    starColor: "#dbe4ff",
    css: "repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px),linear-gradient(180deg,#06061f 0%,#151043 55%,#0a0830 100%)",
  },
  {
    id: "emerald-nebula",
    name: "EMERALD NEBULA",
    cost: BACKGROUND_COST_SHARDS,
    tagline: "Toxic green gas clouds of sector X.",
    top: "#02160d",
    mid: "#07331e",
    bottom: "#021a0f",
    glows: [
      { x: 0.3, y: 0.35, r: 260, color: "rgba(40,220,130,0.18)" },
      { x: 0.85, y: 0.15, r: 190, color: "rgba(180,255,60,0.10)" },
      { x: 0.7, y: 0.85, r: 240, color: "rgba(0,170,110,0.16)" },
    ],
    starColor: "#dcffe9",
    css: "linear-gradient(180deg,#02160d 0%,#07331e 52%,#021a0f 100%)",
  },
  {
    id: "crimson-rift",
    name: "CRIMSON RIFT",
    cost: BACKGROUND_COST_SHARDS,
    tagline: "Blood-red tear in enemy space.",
    top: "#1c0410",
    mid: "#3c0a1c",
    bottom: "#15030c",
    glows: [
      { x: 0.5, y: 0.4, r: 280, color: "rgba(255,30,70,0.18)" },
      { x: 0.1, y: 0.12, r: 180, color: "rgba(255,90,40,0.14)" },
      { x: 0.9, y: 0.85, r: 220, color: "rgba(200,20,90,0.16)" },
    ],
    starColor: "#ffdce4",
    css: "linear-gradient(180deg,#1c0410 0%,#3c0a1c 50%,#15030c 100%)",
  },
];

export const DEFAULT_BACKGROUND_ID = BACKGROUNDS[0].id;

export function getBackgroundById(id: string): BackgroundTheme {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

/** The default background is always unlocked; stored ones merge on top. */
export function readUnlockedBackgrounds(): string[] {
  const fallback = [DEFAULT_BACKGROUND_ID];
  try {
    const raw = localStorage.getItem(UNLOCKED_BGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (id): id is string => typeof id === "string" && BACKGROUNDS.some((b) => b.id === id),
      );
      return Array.from(new Set([DEFAULT_BACKGROUND_ID, ...valid]));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeUnlockedBackgrounds(ids: string[]): string[] {
  const unique = Array.from(new Set([DEFAULT_BACKGROUND_ID, ...ids]));
  try {
    localStorage.setItem(UNLOCKED_BGS_KEY, JSON.stringify(unique));
  } catch {
    /* ignore */
  }
  return unique;
}

export function readEquippedBackgroundId(): string {
  try {
    const raw = localStorage.getItem(EQUIPPED_BG_KEY);
    if (raw && BACKGROUNDS.some((b) => b.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_BACKGROUND_ID;
}

export function writeEquippedBackgroundId(id: string): string {
  const bg = getBackgroundById(id);
  try {
    localStorage.setItem(EQUIPPED_BG_KEY, bg.id);
  } catch {
    /* ignore */
  }
  return bg.id;
}
