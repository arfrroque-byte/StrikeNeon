export type SkinPerkType = "none" | "cosmetic" | "life" | "damage" | "speed";

export type SkinRarity = "common" | "epic" | "legendary";

export type Pt = [number, number];

export interface ShipSkin {
  id: string;
  name: string;
  cost: number;
  rarity: SkinRarity;
  color: string;
  fillTop: string;
  fillBottom: string;
  cockpitColor: string;
  /** Cosmetic category. Gameplay attributes are supplied by free pilot modules. */
  perk: SkinPerkType;
  livesBonus: number;
  damageMultiplier: number;
  speedMultiplier: number;
  hull: Pt[];
}

export function getRarityLabel(rarity: SkinRarity): string {
  switch (rarity) {
    case "legendary":
      return "Legendary Skin";
    case "epic":
      return "Epic Skin";
    case "common":
    default:
      return "Common Skin";
  }
}

export function getRarityColor(rarity: SkinRarity): string {
  switch (rarity) {
    case "legendary":
      return "#ffd83a";
    case "epic":
      return "#d946ef";
    case "common":
    default:
      return "#38bdf8";
  }
}

export const SHARDS_PER_PACK = 500;
export const PACK_PRICE_USD = 5.99;
export const SKIN_COST_SHARDS = 500;

export const SHARDS_KEY = "strike-neon:shards";
export const UNLOCKED_SKINS_KEY = "strike-neon:unlocked-skins";
export const EQUIPPED_SKIN_KEY = "strike-neon:equipped-skin";

export interface ShardPack {
  id: string;
  shards: number;
  priceUsd: number;
  label: string;
  tag?: string;
  /** Google Play in-app product ID. Must match Play Console exactly. */
  playProductId: string;
}

export const SHARD_PACKS: ShardPack[] = [
  {
    id: "pack-500",
    shards: 500,
    priceUsd: 5.99,
    label: "500 SHARDS",
    playProductId: "shards_500",
  },
  {
    id: "pack-1000",
    shards: 1000,
    priceUsd: 11.98,
    label: "1,000 SHARDS",
    playProductId: "shards_1000",
  },
  {
    id: "weekly-deal",
    shards: 1000,
    priceUsd: 0.90,
    label: "WEEKLY DEAL · 1,000 SHARDS",
    tag: "WEEKLY DEAL",
    playProductId: "shards_weekly_090",
  },
  {
    id: "pack-2500",
    shards: 2500,
    priceUsd: 29.95,
    label: "2,500 SHARDS",
    playProductId: "shards_2500",
  },
];

export function getPackByPlayProductId(productId: string): ShardPack | undefined {
  return SHARD_PACKS.find((pack) => pack.playProductId === productId);
}

/**
 * 10 Ship Skins.
 * - VANGUARD MK-I is the free default skin and has NO gameplay attributes.
 * - Every other skin costs 500 Shards (500 Shards = $5.99).
 * - All paid skins are cosmetic only. Power comes from modules unlocked by play.
 */
export const SHIP_SKINS: ShipSkin[] = [
  {
    id: "vanguard-cyan",
    name: "VANGUARD MK-I",
    cost: 0,
    rarity: "common",
    color: "#22e6ff",
    fillTop: "rgba(34,230,255,0.40)",
    fillBottom: "rgba(16,75,165,0.26)",
    cockpitColor: "#d9fbff",
    perk: "none",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Classic balanced tactical delta fighter: clean triangular prow, swept delta wings
    hull: [
      [0, -26], [6, -11], [13, -3], [24, 13], [19, 18], [9, 13], [5, 19],
      [0, 15], [-5, 19], [-9, 13], [-19, 18], [-24, 13], [-13, -3], [-6, -11],
    ],
  },
  {
    id: "crimson-fury",
    name: "CRIMSON FURY",
    cost: SKIN_COST_SHARDS,
    rarity: "common",
    color: "#ff2a6d",
    fillTop: "rgba(255,42,109,0.42)",
    fillBottom: "rgba(120,12,48,0.28)",
    cockpitColor: "#ffd6e4",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Ultra-sharp needle interceptor: elongated stiletto prow, narrow sleek fuselage
    hull: [
      [0, -29], [3, -16], [6, -9], [11, -3], [21, 15], [13, 17], [6, 12], [3, 20],
      [0, 16], [-3, 20], [-6, 12], [-13, 17], [-21, 15], [-11, -3], [-6, -9], [-3, -16],
    ],
  },
  {
    id: "volt-runner",
    name: "VOLT RUNNER",
    cost: SKIN_COST_SHARDS,
    rarity: "common",
    color: "#ffd83a",
    fillTop: "rgba(255,216,58,0.40)",
    fillBottom: "rgba(140,95,10,0.26)",
    cockpitColor: "#fff8d6",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Twin-boom catamaran / fork speedster: split dual-prong lightning nose
    hull: [
      [0, -15], [5, -23], [8, -28], [10, -16], [16, -3], [25, 12], [18, 17], [9, 11], [5, 19],
      [0, 15], [-5, 19], [-9, 11], [-18, 17], [-25, 12], [-16, -3], [-10, -16], [-8, -28], [-5, -23],
    ],
  },
  {
    id: "cobalt-streak",
    name: "COBALT STREAK",
    cost: SKIN_COST_SHARDS,
    rarity: "common",
    color: "#528bff",
    fillTop: "rgba(82,139,255,0.42)",
    fillBottom: "rgba(22,45,135,0.28)",
    cockpitColor: "#dce7ff",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Forward-swept wing (Berkut / switchblade): inverted forward wing stance
    hull: [
      [0, -26], [5, -15], [8, -3], [26, 2], [24, 10], [15, 16], [9, 21], [4, 18],
      [0, 19], [-4, 18], [-9, 21], [-15, 16], [-24, 10], [-26, 2], [-8, -3], [-5, -15],
    ],
  },
  {
    id: "emerald-aegis",
    name: "EMERALD AEGIS",
    cost: SKIN_COST_SHARDS,
    rarity: "epic",
    color: "#3dff9e",
    fillTop: "rgba(61,255,158,0.38)",
    fillBottom: "rgba(120,12,48,0.28)",
    cockpitColor: "#dcffee",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Heavy faceted hexagonal bastion shield: bulky armored dreadnought with reinforced flanks
    hull: [
      [0, -25], [9, -21], [16, -12], [26, -2], [27, 10], [19, 18], [11, 14], [5, 21],
      [0, 17], [-5, 21], [-11, 14], [-19, 18], [-27, 10], [-26, -2], [-16, -12], [-9, -21],
    ],
  },
  {
    id: "solar-titan",
    name: "SOLAR TITAN",
    cost: SKIN_COST_SHARDS,
    rarity: "epic",
    color: "#ff9a2e",
    fillTop: "rgba(255,154,46,0.42)",
    fillBottom: "rgba(135,55,8,0.28)",
    cockpitColor: "#ffead1",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Sun-cruiser gull-wing with stepped radiator canards & solar collector wings
    hull: [
      [0, -28], [5, -19], [11, -12], [17, -15], [23, -4], [27, 8], [18, 14], [13, 21], [6, 16],
      [0, 19], [-6, 16], [-13, 21], [-18, 14], [-27, 8], [-23, -4], [-17, -15], [-11, -12], [-5, -19],
    ],
  },
  {
    id: "void-nova",
    name: "VOID NOVA",
    cost: SKIN_COST_SHARDS,
    rarity: "epic",
    color: "#b36bff",
    fillTop: "rgba(179,107,255,0.42)",
    fillBottom: "rgba(72,24,135,0.28)",
    cockpitColor: "#efe0ff",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Bio-cyber crescent fighter: sweeping curved scythe wings forming a warp crescent
    hull: [
      [0, -27], [7, -17], [13, -9], [21, -2], [28, 9], [21, 19], [13, 13], [7, 21],
      [0, 15], [-7, 21], [-13, 13], [-21, 19], [-28, 9], [-21, -2], [-13, -9], [-7, -17],
    ],
  },
  {
    id: "plasma-reaper",
    name: "PLASMA REAPER",
    cost: SKIN_COST_SHARDS,
    rarity: "legendary",
    color: "#ff2bd6",
    fillTop: "rgba(255,43,214,0.40)",
    fillBottom: "rgba(115,15,110,0.28)",
    cockpitColor: "#ffd9f8",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Dark celestial reaper: raptor beak prow, dual forward hyper-canards, hooked scythe wings
    hull: [
      [0, -29], [3, -23], [9, -16], [7, -7], [18, -4], [28, 6], [26, 17], [16, 13], [12, 22], [5, 17],
      [0, 18], [-5, 17], [-12, 22], [-16, 13], [-26, 17], [-28, 6], [-18, -4], [-7, -7], [-9, -16], [-3, -23],
    ],
  },
  {
    id: "arctic-phantom",
    name: "ARCTIC PHANTOM",
    cost: SKIN_COST_SHARDS,
    rarity: "legendary",
    color: "#9cf6ff",
    fillTop: "rgba(156,246,255,0.42)",
    fillBottom: "rgba(45,110,138,0.28)",
    cockpitColor: "#ffffff",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Multi-faceted crystalline stealth diamond: sharp faceted stealth geometry
    hull: [
      [0, -29], [4, -21], [8, -22], [13, -11], [19, -9], [27, 4], [23, 14], [14, 15], [11, 22], [4, 18],
      [0, 16], [-4, 18], [-11, 22], [-14, 15], [-23, 14], [-27, 4], [-19, -9], [-13, -11], [-8, -22], [-4, -21],
    ],
  },
  {
    id: "omega-seraph",
    name: "OMEGA SERAPH",
    cost: SKIN_COST_SHARDS,
    rarity: "legendary",
    color: "#ff4d8d",
    fillTop: "rgba(255,77,141,0.42)",
    fillBottom: "rgba(120,18,62,0.28)",
    cockpitColor: "#ffe0ec",
    perk: "cosmetic",
    livesBonus: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    // Divine 6-winged seraph archangel: crown prow, triple-tier feather wings
    hull: [
      [0, -28], [5, -23], [9, -14], [15, -16], [22, -6], [28, 8], [19, 14], [24, 22], [14, 17], [6, 21],
      [0, 17], [-6, 21], [-14, 17], [-24, 22], [-19, 14], [-28, 8], [-22, -6], [-15, -16], [-9, -14], [-5, -23],
    ],
  },
];

export function getSkinById(id: string): ShipSkin {
  return SHIP_SKINS.find((s) => s.id === id) ?? SHIP_SKINS[0];
}

export function readShards(): number {
  try {
    const raw = localStorage.getItem(SHARDS_KEY);
    if (raw === null) return 0;
    const val = Number(raw);
    return Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
  } catch {
    return 0;
  }
}

export function writeShards(shards: number): number {
  const clean = Math.max(0, Math.floor(shards));
  try {
    localStorage.setItem(SHARDS_KEY, String(clean));
  } catch {
    /* ignore */
  }
  return clean;
}

export const DEFAULT_SKIN_ID = SHIP_SKINS.find((s) => s.perk === "none")?.id ?? SHIP_SKINS[0].id;

/** The default ship is always unlocked; stored skins are merged on top. */
export function readUnlockedSkins(): string[] {
  const fallback = [DEFAULT_SKIN_ID];
  try {
    const raw = localStorage.getItem(UNLOCKED_SKINS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (id): id is string => typeof id === "string" && SHIP_SKINS.some((s) => s.id === id),
      );
      return Array.from(new Set([DEFAULT_SKIN_ID, ...valid]));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeUnlockedSkins(ids: string[]): string[] {
  const unique = Array.from(new Set(ids));
  try {
    localStorage.setItem(UNLOCKED_SKINS_KEY, JSON.stringify(unique));
  } catch {
    /* ignore */
  }
  return unique;
}

export function readEquippedSkinId(): string {
  try {
    const raw = localStorage.getItem(EQUIPPED_SKIN_KEY);
    if (raw && SHIP_SKINS.some((s) => s.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return SHIP_SKINS[0].id;
}

export function writeEquippedSkinId(id: string): string {
  const skin = getSkinById(id);
  try {
    localStorage.setItem(EQUIPPED_SKIN_KEY, skin.id);
  } catch {
    /* ignore */
  }
  return skin.id;
}
