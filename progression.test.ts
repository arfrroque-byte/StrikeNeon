import test from "node:test";
import assert from "node:assert/strict";
import {
  difficultyScale,
  moduleStats,
  applyRun,
  claimMission,
  MAX_MISSION_REWARD,
  type Profile,
} from "./progression";

function createMockProfile(): Profile {
  return {
    level: 1,
    xp: 0,
    earnedShards: 0,
    totalKills: 0,
    bestKills: 0,
    bosses: 0,
    missiles: 0,
    runs: 0,
    bestWave: 1,
    tutorialDone: true,
    equippedModule: "vital-core",
    unlockedModules: ["vital-core"],
    missions: [
      {
        id: "d01",
        title: "Defeat 350 enemies",
        target: 350,
        progress: 0,
        reward: 1,
        claimed: false,
        kind: "kills",
        cycle: "daily",
      },
    ],
    achievements: [
      {
        id: "first-boss",
        title: "Boss Slayer",
        description: "Defeat your first boss",
        unlocked: false,
        reward: 10,
      },
    ],
    scores: [],
    settings: {
      difficulty: "normal",
      sensitivity: 1,
      abilitySide: "left",
      buttonScale: 1,
      screenShake: 1,
      particles: 1,
      colorBlind: false,
      secondFingerBomb: false,
      damageNumbers: true,
    },
    missionDay: "2026-11-01",
    missionWeek: "2026-44",
    lastDailyClaim: "",
  };
}

test("difficultyScale returns correct multipliers", () => {
  const normal = difficultyScale("normal");
  assert.equal(normal.hp, 1);
  assert.equal(normal.score, 1);

  const hard = difficultyScale("hard");
  assert.equal(hard.hp, 1.2);
  assert.equal(hard.score, 1.3);

  const nightmare = difficultyScale("nightmare");
  assert.equal(nightmare.hp, 1.45);
  assert.equal(nightmare.score, 1.65);
});

test("moduleStats provides proper stats for equipped module", () => {
  assert.deepEqual(moduleStats("vital-core"), { lives: 1, damage: 1, speed: 1 });
  assert.deepEqual(moduleStats("twin-core"), { lives: 0, damage: 1.25, speed: 1 });
  assert.deepEqual(moduleStats("vector-drive"), { lives: 0, damage: 1, speed: 1.2 });
});

test("applyRun increments runs, kills, xp and unlocks achievements", () => {
  const initial = createMockProfile();
  const updated = applyRun(initial, {
    score: 25000,
    wave: 5,
    kills: 40,
    bosses: 1,
    missileKills: 10,
  });

  assert.equal(updated.runs, 1);
  assert.equal(updated.totalKills, 40);
  assert.equal(updated.bosses, 1);
  assert.equal(updated.bestWave, 5);
  // XP: 40*2 + 5*20 + 1*100 = 80 + 100 + 100 = 280
  assert.equal(updated.xp, 280);
  // first-boss achievement should be unlocked and rewarded
  const bossAch = updated.achievements.find((a) => a.id === "first-boss");
  assert.equal(bossAch?.unlocked, true);
  assert.equal(updated.earnedShards, 10);
});

test("claimMission grants reward up to MAX_MISSION_REWARD", () => {
  const profile = createMockProfile();
  profile.missions[0].progress = 350; // met target

  const claimed = claimMission(profile, "d01");
  assert.equal(claimed.missions[0].claimed, true);
  assert.equal(claimed.earnedShards, Math.min(1, MAX_MISSION_REWARD));
});
