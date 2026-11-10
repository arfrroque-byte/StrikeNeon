export type Difficulty = "normal" | "hard" | "nightmare";
export type ModuleId = "vital-core" | "twin-core" | "vector-drive";

export interface GameSettings {
  difficulty: Difficulty;
  sensitivity: number;
  abilitySide: "left" | "right";
  buttonScale: number;
  screenShake: number;
  particles: number;
  colorBlind: boolean;
  secondFingerBomb: boolean;
  damageNumbers: boolean;
}

export interface Mission {
  id: string;
  title: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  kind: "kills" | "waves" | "bosses" | "missiles" | "score" | "runs" | "bombs" | "shields" | "combo" | "noHit";
  cycle: "daily" | "weekly";
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  reward: number;
}

export interface ScoreEntry {
  score: number;
  kills?: number;
  wave: number;
  difficulty: Difficulty;
  at: number;
}

export interface Profile {
  level: number;
  xp: number;
  earnedShards: number;
  totalKills: number;
  bestKills: number;
  bosses: number;
  missiles: number;
  runs: number;
  bestWave: number;
  tutorialDone: boolean;
  equippedModule: ModuleId;
  unlockedModules: ModuleId[];
  missions: Mission[];
  achievements: Achievement[];
  scores: ScoreEntry[];
  settings: GameSettings;
  missionDay: string;
  missionWeek: string;
  lastDailyClaim: string;
}

const KEY = "strike-neon:profile-v2";

export const MODULES = [
  { id: "vital-core" as const, name: "VITAL CORE", perk: "+1 LIFE", unlock: 1 },
  { id: "twin-core" as const, name: "TWIN CORE", perk: "1.25x DAMAGE", unlock: 4 },
  { id: "vector-drive" as const, name: "VECTOR DRIVE", perk: "1.20x SPEED", unlock: 7 },
];

type MissionSeed = [string, Mission["kind"], number, number];

/**
 * Absolute cap for any single mission payout (daily or weekly).
 * 4 shards is deliberately tiny so free mission income can never replace
 * buying shards through Google Play.
 */
export const MAX_MISSION_REWARD = 4;

/**
 * 25 daily objectives — very long grinds. Targets are intentionally steep, and
 * each mission pays between 1 and MAX_MISSION_REWARD (4) shards.
 */
const DAILY_SEEDS: MissionSeed[] = [
  ["d01", "kills", 350, 1], ["d02", "kills", 750, 3], ["d03", "kills", 1300, 4],
  ["d04", "waves", 25, 2], ["d05", "waves", 50, 3], ["d06", "waves", 90, 4],
  ["d07", "bosses", 5, 2], ["d08", "bosses", 10, 3], ["d09", "bosses", 18, 4],
  ["d10", "missiles", 90, 2], ["d11", "missiles", 200, 3], ["d12", "missiles", 350, 4],
  ["d13", "score", 400000, 2], ["d14", "score", 900000, 3], ["d15", "score", 1800000, 4],
  ["d16", "runs", 12, 1], ["d17", "runs", 30, 3], ["d18", "bombs", 25, 2],
  ["d19", "bombs", 55, 4], ["d20", "shields", 25, 2], ["d21", "shields", 55, 4],
  ["d22", "combo", 20, 2], ["d23", "combo", 40, 4], ["d24", "noHit", 5, 3],
  ["d25", "noHit", 12, 4],
];

/** 25 weekly objectives — month-scale grinds, still capped at 4 shards each. */
const WEEKLY_SEEDS: MissionSeed[] = [
  ["w01", "kills", 3500, 1], ["w02", "kills", 8000, 3], ["w03", "kills", 16000, 4],
  ["w04", "waves", 250, 2], ["w05", "waves", 550, 3], ["w06", "waves", 1000, 4],
  ["w07", "bosses", 40, 2], ["w08", "bosses", 85, 3], ["w09", "bosses", 150, 4],
  ["w10", "missiles", 800, 2], ["w11", "missiles", 1750, 3], ["w12", "missiles", 3500, 4],
  ["w13", "score", 6000000, 2], ["w14", "score", 15000000, 3], ["w15", "score", 30000000, 4],
  ["w16", "runs", 110, 1], ["w17", "runs", 250, 4], ["w18", "bombs", 220, 2],
  ["w19", "bombs", 480, 4], ["w20", "shields", 220, 2], ["w21", "shields", 480, 4],
  ["w22", "combo", 60, 3], ["w23", "combo", 90, 4], ["w24", "noHit", 40, 3],
  ["w25", "noHit", 80, 4],
];

const goalLabel = (kind: Mission["kind"], target: number): string => {
  const n = target.toLocaleString("en-US");
  switch (kind) {
    case "kills": return `DESTROY ${n} ENEMIES`;
    case "waves": return `CLEAR ${n} WAVES`;
    case "bosses": return `DEFEAT ${n} BOSS${target > 1 ? "ES" : ""}`;
    case "missiles": return `GET ${n} MISSILE KILLS`;
    case "score": return `SCORE ${n} POINTS`;
    case "runs": return `COMPLETE ${n} RUN${target > 1 ? "S" : ""}`;
    case "bombs": return `USE ${n} BOMB${target > 1 ? "S" : ""}`;
    case "shields": return `ACTIVATE ${n} SHIELD${target > 1 ? "S" : ""}`;
    case "combo": return `REACH A x${target} COMBO`;
    default: return `CLEAR ${n} RUN${target > 1 ? "S" : ""} WITHOUT BEING HIT`;
  }
};

const buildMissions = (cycle: Mission["cycle"]): Mission[] =>
  (cycle === "daily" ? DAILY_SEEDS : WEEKLY_SEEDS).map(([id, kind, target, reward]) => ({
    id, kind, target, cycle, progress: 0, claimed: false,
    // Hard-capped so no mission can ever pay more than MAX_MISSION_REWARD.
    reward: Math.min(reward, MAX_MISSION_REWARD),
    title: goalLabel(kind, target),
  }));

const missions = (): Mission[] => [...buildMissions("daily"), ...buildMissions("weekly")];

/** Daily login reward: 50 shards, once per UTC day. */
export const DAILY_CLAIM_SHARDS = 50;

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function canClaimDaily(profile: Profile, now = new Date()): boolean {
  return profile.lastDailyClaim !== utcDay(now);
}

/** Daily login reward: 50 shards, once per UTC day. */
export function claimDaily(profile: Profile, now = new Date()): { profile: Profile; shards: number } {
  if (!canClaimDaily(profile, now)) return { profile, shards: 0 };
  const next: Profile = structuredClone(profile);
  next.lastDailyClaim = utcDay(now);
  next.earnedShards += DAILY_CLAIM_SHARDS;
  return { profile: writeProfile(next), shards: DAILY_CLAIM_SHARDS };
}

/**
 * Generates the in-game mission completion notification text,
 * e.g. "Kill 20/20 enemies. +20 Shards." matching the user's requested format.
 */
export function getMissionPopupText(mission: Mission): string {
  const n = mission.target.toLocaleString("en-US");
  const frac = `${n}/${n}`;
  switch (mission.kind) {
    case "kills":
      return `Kill ${frac} enemies. +${mission.reward} Shards.`;
    case "waves":
      return `Clear ${frac} waves. +${mission.reward} Shards.`;
    case "bosses":
      return `Defeat ${frac} boss${mission.target > 1 ? "es" : ""}. +${mission.reward} Shards.`;
    case "missiles":
      return `Get ${frac} missile kills. +${mission.reward} Shards.`;
    case "score":
      return `Score ${frac} points. +${mission.reward} Shards.`;
    case "runs":
      return `Complete ${frac} run${mission.target > 1 ? "s" : ""}. +${mission.reward} Shards.`;
    case "bombs":
      return `Use ${frac} bomb${mission.target > 1 ? "s" : ""}. +${mission.reward} Shards.`;
    case "shields":
      return `Activate ${frac} shield${mission.target > 1 ? "s" : ""}. +${mission.reward} Shards.`;
    case "combo":
      return `Reach x${mission.target}/x${mission.target} combo. +${mission.reward} Shards.`;
    case "noHit":
      return `Clear ${frac} run${mission.target > 1 ? "s" : ""} without a hit. +${mission.reward} Shards.`;
    default:
      return `${mission.title} (${frac}). +${mission.reward} Shards.`;
  }
}

const achievements = (): Achievement[] => [
  { id: "first-boss", title: "RED GIANT", description: "Defeat your first boss.", unlocked: false, reward: 30 },
  { id: "wave-10", title: "DOUBLE DIGITS", description: "Reach wave 10.", unlocked: false, reward: 40 },
  { id: "kills-500", title: "ACE PILOT", description: "Destroy 500 enemies.", unlocked: false, reward: 50 },
  { id: "score-100k", title: "HIGH VOLTAGE", description: "Score 100,000 points.", unlocked: false, reward: 50 },
];

export function defaultProfile(): Profile {
  const now = new Date();
  const week = `${now.getUTCFullYear()}-${Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 1)) / 604800000)}`;
  return {
    level: 1, xp: 0, earnedShards: 0, totalKills: 0, bestKills: 0, bosses: 0, missiles: 0, runs: 0, bestWave: 1,
    tutorialDone: false, equippedModule: "vital-core", unlockedModules: ["vital-core"],
    missions: missions(), achievements: achievements(), scores: [],
    missionDay: now.toISOString().slice(0, 10), missionWeek: week,
    lastDailyClaim: "",
    settings: {
      difficulty: "normal", sensitivity: 1, abilitySide: "left", buttonScale: 1,
      screenShake: 1, particles: 1, colorBlind: false, secondFingerBomb: false, damageNumbers: true,
    },
  };
}

export function readProfile(): Profile {
  const base = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Profile>;
    const merged: Profile = {
      ...base, ...p,
      settings: { ...base.settings, ...(p.settings ?? {}) },
      missions: base.missions.map((m) => {
        const saved = p.missions?.find((x) => x.id === m.id);
        if (!saved) return m;
        const targetChanged = saved.target !== m.target;
        return {
          ...m,
          claimed: targetChanged ? false : Boolean(saved.claimed),
          progress: targetChanged ? 0 : Math.min(m.target, Number(saved.progress) || 0),
        };
      }),
      achievements: base.achievements.map((a) => ({ ...a, ...(p.achievements?.find((x) => x.id === a.id) ?? {}) })),
    };
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    // Ability buttons live on the left edge so they never sit under the ship
    // play area; older saves that recorded the old right-side default are
    // migrated here (no settings UI ever exposed the toggle).
    merged.settings.abilitySide = "left";
    const week = `${now.getUTCFullYear()}-${Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 1)) / 604800000)}`;
    if (merged.missionDay !== day) {
      merged.missions.filter((m) => m.cycle === "daily").forEach((m) => { m.progress = 0; m.claimed = false; });
      merged.missionDay = day;
    }
    if (merged.missionWeek !== week) {
      merged.missions.filter((m) => m.cycle === "weekly").forEach((m) => { m.progress = 0; m.claimed = false; });
      merged.missionWeek = week;
    }
    return merged;
  } catch { return base; }
}

export function writeProfile(profile: Profile): Profile {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
  return profile;
}

export function difficultyScale(difficulty: Difficulty) {
  if (difficulty === "nightmare") return { hp: 1.45, bullets: 1.25, score: 1.65 };
  if (difficulty === "hard") return { hp: 1.2, bullets: 1.12, score: 1.3 };
  return { hp: 1, bullets: 1, score: 1 };
}

export function moduleStats(id: ModuleId) {
  return {
    lives: id === "vital-core" ? 1 : 0,
    damage: id === "twin-core" ? 1.25 : 1,
    speed: id === "vector-drive" ? 1.2 : 1,
  };
}

export interface RunProgress {
  score: number;
  wave: number;
  kills: number;
  bosses: number;
  missileKills: number;
  bombsUsed?: number;
  shieldsUsed?: number;
  maxCombo?: number;
  flawless?: boolean;
}

export function applyRun(profile: Profile, run: RunProgress, startMissions?: Mission[]): Profile {
  const next: Profile = structuredClone(profile);
  next.runs += 1;
  next.totalKills += run.kills;
  next.bestKills = Math.max(next.bestKills ?? 0, run.kills);
  next.bosses += run.bosses;
  next.missiles += run.missileKills;
  next.bestWave = Math.max(next.bestWave, run.wave);
  next.xp += run.kills * 2 + run.wave * 20 + run.bosses * 100;
  next.level = 1 + Math.floor(next.xp / 500);
  next.unlockedModules = MODULES.filter((m) => next.level >= m.unlock).map((m) => m.id);
  next.scores = [{ score: run.score, kills: run.kills, wave: run.wave, difficulty: next.settings.difficulty, at: Date.now() }, ...next.scores]
    .sort((a, b) => b.score - a.score).slice(0, 20);
  const values: Record<Mission["kind"], number> = {
    kills: run.kills,
    waves: run.wave,
    bosses: run.bosses,
    missiles: run.missileKills,
    score: run.score,
    runs: 1,
    bombs: run.bombsUsed ?? 0,
    shields: run.shieldsUsed ?? 0,
    combo: run.maxCombo ?? 0,
    noHit: run.flawless && run.wave > 1 ? 1 : 0,
  };
  // Counters accumulate across runs; only combo is a peak (best single run).
  // Score accumulates so the long score goals are a real grind.
  const peak: Mission["kind"][] = ["combo"];
  next.missions.forEach((m) => {
    if (m.claimed) return;
    const v = values[m.kind];
    const base = startMissions?.find((x) => x.id === m.id);
    const baseProgress = base ? base.progress : m.progress;
    m.progress = Math.min(m.target, peak.includes(m.kind) ? Math.max(baseProgress, v) : baseProgress + v);
  });
  const unlock = (id: string, condition: boolean) => {
    const a = next.achievements.find((x) => x.id === id);
    if (a && condition && !a.unlocked) { a.unlocked = true; next.earnedShards += a.reward; }
  };
  unlock("first-boss", next.bosses >= 1); unlock("wave-10", next.bestWave >= 10);
  unlock("kills-500", next.totalKills >= 500); unlock("score-100k", run.score >= 100000);
  return writeProfile(next);
}

export function claimMission(profile: Profile, id: string): Profile {
  const next: Profile = structuredClone(profile);
  const m = next.missions.find((x) => x.id === id);
  if (m && !m.claimed && m.progress >= m.target) {
    m.claimed = true;
    // Second safety net: a mission can never pay above the cap.
    next.earnedShards += Math.min(m.reward, MAX_MISSION_REWARD);
  }
  return writeProfile(next);
}