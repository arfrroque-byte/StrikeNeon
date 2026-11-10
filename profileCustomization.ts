import type { Profile } from "./progression";

export const PILOT_NAME_KEY = "strike-neon:pilot-name";
export const ACTIVE_TITLE_KEY = "strike-neon:active-title";

export interface ProgressionTitle {
  id: string;
  name: string;
  category: "rank" | "combat" | "mastery";
  requirement: string;
  isUnlocked: (p: Profile, maxScore?: number) => boolean;
}

export const PROGRESSION_TITLES: ProgressionTitle[] = [
  // Rank Titles (Level progression)
  {
    id: "rookie-pilot",
    name: "ROOKIE PILOT",
    category: "rank",
    requirement: "Starting title",
    isUnlocked: () => true,
  },
  {
    id: "star-cadet",
    name: "STAR CADET",
    category: "rank",
    requirement: "Reach Pilot Level 2",
    isUnlocked: (p) => p.level >= 2,
  },
  {
    id: "neon-striker",
    name: "NEON STRIKER",
    category: "rank",
    requirement: "Reach Pilot Level 3",
    isUnlocked: (p) => p.level >= 3,
  },
  {
    id: "void-vanguard",
    name: "VOID VANGUARD",
    category: "rank",
    requirement: "Reach Pilot Level 5",
    isUnlocked: (p) => p.level >= 5,
  },
  {
    id: "sector-ace",
    name: "SECTOR ACE",
    category: "rank",
    requirement: "Reach Pilot Level 7",
    isUnlocked: (p) => p.level >= 7,
  },
  {
    id: "plasma-veteran",
    name: "PLASMA VETERAN",
    category: "rank",
    requirement: "Reach Pilot Level 10",
    isUnlocked: (p) => p.level >= 10,
  },
  {
    id: "solar-knight",
    name: "SOLAR KNIGHT",
    category: "rank",
    requirement: "Reach Pilot Level 12",
    isUnlocked: (p) => p.level >= 12,
  },
  {
    id: "orbital-hunter",
    name: "ORBITAL HUNTER",
    category: "rank",
    requirement: "Reach Pilot Level 15",
    isUnlocked: (p) => p.level >= 15,
  },
  {
    id: "cosmic-phantom",
    name: "COSMIC PHANTOM",
    category: "rank",
    requirement: "Reach Pilot Level 18",
    isUnlocked: (p) => p.level >= 18,
  },
  {
    id: "galaxy-apex",
    name: "GALAXY APEX",
    category: "rank",
    requirement: "Reach Pilot Level 20",
    isUnlocked: (p) => p.level >= 20,
  },

  // Wave / Survival Titles
  {
    id: "wave-breaker",
    name: "WAVE BREAKER",
    category: "combat",
    requirement: "Reach Wave 5",
    isUnlocked: (p) => p.bestWave >= 5,
  },
  {
    id: "hyper-survivor",
    name: "HYPER SURVIVOR",
    category: "combat",
    requirement: "Reach Wave 10",
    isUnlocked: (p) => p.bestWave >= 10,
  },
  {
    id: "nebula-conqueror",
    name: "NEBULA CONQUEROR",
    category: "combat",
    requirement: "Reach Wave 15",
    isUnlocked: (p) => p.bestWave >= 15,
  },
  {
    id: "abyss-dreadnought",
    name: "ABYSS DREADNOUGHT",
    category: "combat",
    requirement: "Reach Wave 20",
    isUnlocked: (p) => p.bestWave >= 20,
  },

  // Combat Feat Titles
  {
    id: "scrap-collector",
    name: "SCRAP COLLECTOR",
    category: "combat",
    requirement: "Eliminate 50 enemies",
    isUnlocked: (p) => p.totalKills >= 50,
  },
  {
    id: "fleet-annihilator",
    name: "FLEET ANNIHILATOR",
    category: "combat",
    requirement: "Eliminate 500 enemies",
    isUnlocked: (p) => p.totalKills >= 500,
  },
  {
    id: "boss-executioner",
    name: "BOSS EXECUTIONER",
    category: "mastery",
    requirement: "Defeat 5 Flagship Bosses",
    isUnlocked: (p) => p.bosses >= 5,
  },
  {
    id: "missile-maestro",
    name: "MISSILE MAESTRO",
    category: "combat",
    requirement: "30 homing missile kills",
    isUnlocked: (p) => p.missiles >= 30,
  },
  {
    id: "century-centurion",
    name: "CENTURY CENTURION",
    category: "mastery",
    requirement: "Achieve 100,000+ points",
    isUnlocked: (p, maxScore) => {
      const top = p.scores[0]?.score ?? 0;
      return Math.max(top, maxScore ?? 0) >= 100000;
    },
  },
  {
    id: "neon-legend",
    name: "NEON LEGEND",
    category: "mastery",
    requirement: "Achieve 500,000+ points",
    isUnlocked: (p, maxScore) => {
      const top = p.scores[0]?.score ?? 0;
      return Math.max(top, maxScore ?? 0) >= 500000;
    },
  },
];

export function readPilotName(): string {
  try {
    const raw = localStorage.getItem(PILOT_NAME_KEY);
    if (raw && raw.trim().length > 0) return raw.trim().slice(0, 16);
  } catch {
    /* ignore */
  }
  return "NEON ACE";
}

export function writePilotName(name: string): string {
  const clean = name.trim().slice(0, 16) || "NEON ACE";
  try {
    localStorage.setItem(PILOT_NAME_KEY, clean);
  } catch {
    /* ignore */
  }
  return clean;
}

export function readActiveTitleId(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_TITLE_KEY);
    if (raw && PROGRESSION_TITLES.some((t) => t.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return "rookie-pilot";
}

export function writeActiveTitleId(id: string): string {
  const title = PROGRESSION_TITLES.find((t) => t.id === id) ?? PROGRESSION_TITLES[0];
  try {
    localStorage.setItem(ACTIVE_TITLE_KEY, title.id);
  } catch {
    /* ignore */
  }
  return title.id;
}

export function getTitleById(id: string): ProgressionTitle {
  return PROGRESSION_TITLES.find((t) => t.id === id) ?? PROGRESSION_TITLES[0];
}
