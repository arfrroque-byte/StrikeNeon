import test from "node:test";
import assert from "node:assert/strict";
import { SHIP_SKINS, getRarityLabel, getRarityColor } from "./skins";
import { NEON_TRAILS, getTrailById, DEFAULT_TRAIL_ID } from "./trails";
import { PROGRESSION_TITLES, getTitleById } from "./profileCustomization";
import {
  activateTimeBooster,
  activateRunBooster,
  getActiveShardMultiplier,
  readBoosterState,
} from "./boosters";

test("skin rarities are assigned properly to all 10 skins", () => {
  assert.equal(SHIP_SKINS.length, 10);
  const common = SHIP_SKINS.filter((s) => s.rarity === "common");
  const epic = SHIP_SKINS.filter((s) => s.rarity === "epic");
  const legendary = SHIP_SKINS.filter((s) => s.rarity === "legendary");

  assert.equal(common.length, 4);
  assert.equal(epic.length, 3);
  assert.equal(legendary.length, 3);

  assert.equal(getRarityLabel("common"), "Common Skin");
  assert.equal(getRarityLabel("epic"), "Epic Skin");
  assert.equal(getRarityLabel("legendary"), "Legendary Skin");

  assert.equal(getRarityColor("legendary"), "#ffd83a");
  assert.equal(getRarityColor("epic"), "#d946ef");
});

test("neon trails contains 10 varied trails with default", () => {
  assert.equal(NEON_TRAILS.length, 10);
  const defaultTrail = getTrailById(DEFAULT_TRAIL_ID);
  assert.equal(defaultTrail.cost, 0);
  assert.equal(defaultTrail.id, "trail-cyan");

  const shapes = new Set(NEON_TRAILS.map((t) => t.shape));
  assert.ok(shapes.size >= 6, "Expected varied shapes across trails");
});

test("progression titles contains 20 titles", () => {
  assert.equal(PROGRESSION_TITLES.length, 20);
  const rookie = getTitleById("rookie-pilot");
  assert.equal(rookie.name, "ROOKIE PILOT");

  const wave10Title = getTitleById("hyper-survivor");
  assert.ok(wave10Title);
  assert.equal(wave10Title.name, "HYPER SURVIVOR");
});

test("boosters multiplier logic", () => {
  // Test time booster
  const timeState = activateTimeBooster(15, 2);
  assert.equal(timeState.multiplier, 2);
  assert.ok(timeState.expiresAt && timeState.expiresAt > Date.now());

  // Test run booster
  const runState = activateRunBooster(3, 2);
  assert.equal(runState.multiplier, 2);
  assert.equal(runState.runsRemaining, 3);
});

test("MenuBattle lifecycle, wave spawning and reset", async () => {
  const { MenuBattle } = await import("./menuBattle");
  const battle = new MenuBattle();
  const mockPlayer = {
    x: 180,
    y: 500,
    tx: 180,
    ty: 500,
    lives: 3,
    bombs: 1,
    missiles: 1,
    shields: 1,
    weapon: 1,
    fireCd: 0,
    invuln: 0,
    shield: 0,
    bank: 0,
    speed: 0,
    dead: false,
    deadTimer: 0,
  };

  // Run update to spawn enemies and simulate dogfight
  let particlesEmitted = 0;
  let ringsAdded = 0;
  for (let i = 0; i < 60; i++) {
    battle.update(
      0.033,
      mockPlayer,
      640,
      false,
      () => { particlesEmitted++; },
      () => { ringsAdded++; },
    );
  }

  assert.ok(particlesEmitted > 0, "Menu battle should emit thruster and battle particles");

  // Reset clears all active combat entities cleanly
  battle.reset();
  particlesEmitted = 0;
  battle.update(
    0.016,
    mockPlayer,
    640,
    false,
    () => { particlesEmitted++; },
    () => { ringsAdded++; },
  );
  assert.equal(particlesEmitted, 0, "Immediately after reset before spawn delay, no particles");
});

test("MenuBattle respects button exclusion boxes and keeps flight paths clear", async () => {
  const { MenuBattle } = await import("./menuBattle");
  const battle = new MenuBattle();
  const mockPlayer = {
    x: 180,
    y: 540,
    tx: 180,
    ty: 540,
    lives: 3,
    bombs: 1,
    missiles: 1,
    shields: 1,
    weapon: 1,
    fireCd: 0,
    invuln: 0,
    shield: 0,
    bank: 0,
    speed: 0,
    dead: false,
    deadTimer: 0,
  };

  const buttonBox = { left: 40, top: 180, right: 320, bottom: 460 };
  const exclusionBoxes = [buttonBox];

  // Run simulation for 200 ticks (over 6 seconds of dogfight)
  for (let i = 0; i < 200; i++) {
    battle.update(
      0.033,
      mockPlayer,
      640,
      false,
      () => {},
      () => {},
      exclusionBoxes,
    );

    // Check enemies internal array via any/reflection if needed
    const enemies = (battle as unknown as { enemies: { x: number; y: number }[] }).enemies;
    for (const e of enemies) {
      const insideBox =
        e.x >= buttonBox.left &&
        e.x <= buttonBox.right &&
        e.y >= buttonBox.top &&
        e.y <= buttonBox.bottom;
      assert.ok(!insideBox, `Enemy at (${e.x}, ${e.y}) should not be inside menu button box`);
    }

    const bullets = (battle as unknown as { bullets: { x: number; y: number }[] }).bullets;
    for (const b of bullets) {
      const insideBox =
        b.x >= buttonBox.left &&
        b.x <= buttonBox.right &&
        b.y >= buttonBox.top &&
        b.y <= buttonBox.bottom;
      assert.ok(!insideBox, `Bullet at (${b.x}, ${b.y}) should not be inside menu button box`);
    }
  }
});

