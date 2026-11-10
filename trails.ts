export type TrailShape =
  | "spark"
  | "flame"
  | "ring"
  | "square"
  | "void"
  | "crystal"
  | "overdrive"
  | "prism"
  | "star"
  | "arc";

export interface NeonTrail {
  id: string;
  name: string;
  cost: number;
  description: string;
  color: string;
  glowColor: string;
  shape: TrailShape;
  size: number;
  speed: number;
  rarity: "common" | "epic" | "legendary";
}

export const TRAILS_KEY = "strike-neon:unlocked-trails";
export const EQUIPPED_TRAIL_KEY = "strike-neon:equipped-trail";

export const NEON_TRAILS: NeonTrail[] = [
  {
    id: "trail-cyan",
    name: "CYAN HYPERDRIVE",
    cost: 0,
    description: "Iconic dual cyan plasma stream with high-frequency micro sparks.",
    color: "#22e6ff",
    glowColor: "rgba(34,230,255,0.8)",
    shape: "spark",
    size: 2.2,
    speed: 90,
    rarity: "common",
  },
  {
    id: "trail-solar",
    name: "SOLAR FLARES",
    cost: 300,
    description: "Incandescent amber & gold plasma embers from high-thrust thrusters.",
    color: "#ff9a2e",
    glowColor: "rgba(255,154,46,0.8)",
    shape: "flame",
    size: 2.8,
    speed: 95,
    rarity: "common",
  },
  {
    id: "trail-plasma",
    name: "PLASMA PULSE",
    cost: 300,
    description: "Rhythmic neon-magenta energy rings pulsing behind the hull.",
    color: "#ff2bd6",
    glowColor: "rgba(255,43,214,0.8)",
    shape: "ring",
    size: 3.5,
    speed: 80,
    rarity: "common",
  },
  {
    id: "trail-matrix",
    name: "EMERALD MATRIX",
    cost: 300,
    description: "Digital data streams and radiant cyber cubes dissolving in space.",
    color: "#3dff9e",
    glowColor: "rgba(61,255,158,0.8)",
    shape: "square",
    size: 2.6,
    speed: 85,
    rarity: "common",
  },
  {
    id: "trail-void",
    name: "VOID RIFT",
    cost: 300,
    description: "Singularity pulses and deep-violet graviton spheres.",
    color: "#b36bff",
    glowColor: "rgba(179,107,255,0.85)",
    shape: "void",
    size: 3.2,
    speed: 75,
    rarity: "epic",
  },
  {
    id: "trail-frost",
    name: "GLACIAL FROST",
    cost: 300,
    description: "Sharp crystalline diamond facets shedding sub-zero light.",
    color: "#9cf6ff",
    glowColor: "rgba(156,246,255,0.85)",
    shape: "crystal",
    size: 2.8,
    speed: 100,
    rarity: "epic",
  },
  {
    id: "trail-crimson",
    name: "CRIMSON OVERDRIVE",
    cost: 300,
    description: "Supercharged red afterburner flames with dynamic heat distortion.",
    color: "#ff224a",
    glowColor: "rgba(255,34,74,0.85)",
    shape: "overdrive",
    size: 3.4,
    speed: 110,
    rarity: "epic",
  },
  {
    id: "trail-prism",
    name: "RAINBOW PRISM",
    cost: 300,
    description: "Full chromatic spectrum beam shifting across all radiant colors.",
    color: "#ffd83a",
    glowColor: "rgba(255,216,58,0.9)",
    shape: "prism",
    size: 3.0,
    speed: 90,
    rarity: "legendary",
  },
  {
    id: "trail-starlight",
    name: "STARLIGHT NOVA",
    cost: 300,
    description: "Luminescent 4-point stellar flares leaving a galaxy dust path.",
    color: "#ffffff",
    glowColor: "rgba(255,255,255,0.9)",
    shape: "star",
    size: 3.6,
    speed: 80,
    rarity: "legendary",
  },
  {
    id: "trail-cyber",
    name: "CYBER SPARKS",
    cost: 300,
    description: "Forked high-voltage electrical arcs and lightning particle bursts.",
    color: "#528bff",
    glowColor: "rgba(82,139,255,0.9)",
    shape: "arc",
    size: 3.0,
    speed: 105,
    rarity: "legendary",
  },
];

export const DEFAULT_TRAIL_ID = "trail-cyan";

export function getTrailById(id: string): NeonTrail {
  return NEON_TRAILS.find((t) => t.id === id) ?? NEON_TRAILS[0];
}

export function readUnlockedTrails(): string[] {
  const fallback = [DEFAULT_TRAIL_ID];
  try {
    const raw = localStorage.getItem(TRAILS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (id): id is string => typeof id === "string" && NEON_TRAILS.some((t) => t.id === id)
      );
      return Array.from(new Set([DEFAULT_TRAIL_ID, ...valid]));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeUnlockedTrails(ids: string[]): string[] {
  const unique = Array.from(new Set([DEFAULT_TRAIL_ID, ...ids]));
  try {
    localStorage.setItem(TRAILS_KEY, JSON.stringify(unique));
  } catch {
    /* ignore */
  }
  return unique;
}

export function readEquippedTrailId(): string {
  try {
    const raw = localStorage.getItem(EQUIPPED_TRAIL_KEY);
    if (raw && NEON_TRAILS.some((t) => t.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_TRAIL_ID;
}

export function writeEquippedTrailId(id: string): string {
  const trail = getTrailById(id);
  try {
    localStorage.setItem(EQUIPPED_TRAIL_KEY, trail.id);
  } catch {
    /* ignore */
  }
  return trail.id;
}
