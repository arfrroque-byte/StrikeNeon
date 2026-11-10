import { ENEMY_COLORS, type SpriteSet } from "./sprites";
import type { Player } from "./engine";

const TAU = Math.PI * 2;
const W = 360;

export type MenuEnemyKind = "scout" | "dart" | "tank" | "sniper" | "kamikaze";

export interface ExclusionBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface MenuEnemy {
  id: number;
  kind: MenuEnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  hp: number;
  maxHp: number;
  flash: number;
  age: number;
  fireTimer: number;
  trailTimer: number;
  pattern: "pincer_left" | "pincer_right" | "dive_bomb" | "heavy_cruise" | "spiral_flank" | "railgun_aim";
  fired: boolean;
  dead: boolean;
}

interface MenuBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPlayer: boolean;
  amber: boolean;
  color: string;
  life: number;
}

interface MenuShieldFlash {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  life: number;
}

type EmitParticleFn = (
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  color: string,
  size: number,
  dash: boolean,
  drag: number,
) => void;

type AddRingFn = (
  x: number,
  y: number,
  maxR: number,
  dur: number,
  color: string,
  width: number,
  delay?: number,
) => void;

/** Checks if a 2D line segment intersects an exclusion box rectangle with optional padding. */
function lineIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  b: ExclusionBox,
  pad = 6,
): boolean {
  const minX = b.left - pad;
  const maxX = b.right + pad;
  const minY = b.top - pad;
  const maxY = b.bottom + pad;

  if (Math.max(x1, x2) < minX || Math.min(x1, x2) > maxX) return false;
  if (Math.max(y1, y2) < minY || Math.min(y1, y2) > maxY) return false;

  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

export class MenuBattle {
  private enemies: MenuEnemy[] = [];
  private bullets: MenuBullet[] = [];
  private shieldFlashes: MenuShieldFlash[] = [];
  private nextId = 1;
  private spawnTimer = 0.8;
  private waveIndex = 0;
  private playerFireCooldown = 0.6;
  private time = 0;

  /** Resets all active menu combat entities when entering gameplay. */
  reset() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.shieldFlashes.length = 0;
    this.spawnTimer = 0.8;
    this.waveIndex = 0;
    this.playerFireCooldown = 0.6;
  }

  update(
    dt: number,
    player: Player,
    screenH: number,
    reduceMotion: boolean,
    emit: EmitParticleFn,
    addRing: AddRingFn,
    exclusionBoxes?: ExclusionBox[],
  ) {
    this.time += dt;

    // Compute safe combat ceiling (the vertical line below which dogfight happens, completely clear of buttons)
    let maxBoxBottom = 0;
    if (exclusionBoxes && exclusionBoxes.length > 0) {
      for (const b of exclusionBoxes) {
        if (b.bottom > maxBoxBottom) maxBoxBottom = b.bottom;
      }
    }
    const safeCombatCeiling = maxBoxBottom > 0 ? maxBoxBottom + 12 : Math.max(100, player.y - 75);

    // 1. Spawning choreography waves in the lower arena around the blue ship
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave(player, screenH, safeCombatCeiling);
      // Spawn next attack pattern every 2.6 to 3.8 seconds
      this.spawnTimer = 2.6 + Math.random() * 1.2;
    }

    // 2. Player defensive evasive tracking and counter-firing
    let nearestEnemy: MenuEnemy | null = null;
    let nearestDist = 9999;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < nearestDist && e.y >= safeCombatCeiling) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }

    // Dynamic blue ship evasive banking
    if (nearestEnemy) {
      const dx = nearestEnemy.x - player.x;
      const targetBank = Math.max(-0.7, Math.min(0.7, dx / 80));
      player.bank += (targetBank - player.bank) * Math.min(1, dt * 7);
    } else {
      player.bank += (0 - player.bank) * Math.min(1, dt * 4);
    }

    // Blue ship retaliatory fire at incoming enemies (strictly verifying line of fire never crosses any menu buttons)
    this.playerFireCooldown -= dt;
    if (nearestEnemy && nearestDist < 260 && this.playerFireCooldown <= 0) {
      const spread = 13;
      let blockedByButton = false;

      if (exclusionBoxes && exclusionBoxes.length > 0) {
        for (const box of exclusionBoxes) {
          if (
            lineIntersectsBox(player.x - spread, player.y - 12, nearestEnemy.x, nearestEnemy.y, box) ||
            lineIntersectsBox(player.x + spread, player.y - 12, nearestEnemy.x, nearestEnemy.y, box)
          ) {
            blockedByButton = true;
            break;
          }
        }
      }

      if (!blockedByButton) {
        this.playerFireCooldown = 0.45 + Math.random() * 0.25;
        for (const s of [-1, 1]) {
          const bx = player.x + s * spread;
          const by = player.y - 12;
          const edx = nearestEnemy.x - bx;
          const edy = nearestEnemy.y - by;
          const ed = Math.hypot(edx, edy) || 1;
          const speed = 440;
          this.bullets.push({
            x: bx,
            y: by,
            vx: (edx / ed) * speed + (Math.random() - 0.5) * 30,
            vy: (edy / ed) * speed,
            isPlayer: true,
            amber: false,
            color: "#22e6ff",
            life: 1.2,
          });

          // Muzzle flash particle
          emit(bx, by - 2, (Math.random() - 0.5) * 20, -60, 0.12, "#22e6ff", 1.8, true, 4);
        }
      }
    }

    // 3. Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.fireTimer -= dt;

      // Pattern steering & physics
      this.updateEnemyPattern(e, player, dt, screenH, safeCombatCeiling);

      // Deflection away from any menu button exclusion boxes
      if (exclusionBoxes && exclusionBoxes.length > 0) {
        for (const box of exclusionBoxes) {
          const pad = 16;
          if (
            e.x >= box.left - pad &&
            e.x <= box.right + pad &&
            e.y >= box.top - pad &&
            e.y <= box.bottom + pad
          ) {
            e.y = box.bottom + pad + 2;
            e.vy = Math.max(Math.abs(e.vy), 50);
          }
        }
      }

      // Apply velocity
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Rotation aligns with flight vector
      const targetRot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      let rotDiff = targetRot - e.rot;
      while (rotDiff > Math.PI) rotDiff -= TAU;
      while (rotDiff < -Math.PI) rotDiff += TAU;
      e.rot += rotDiff * Math.min(1, dt * 8);

      // Engine thruster particle trail
      e.trailTimer -= dt;
      if (e.trailTimer <= 0) {
        e.trailTimer = 0.04;
        const rearDist = e.kind === "tank" ? 22 : 14;
        const rx = e.x - Math.cos(e.rot + Math.PI / 2) * rearDist;
        const ry = e.y - Math.sin(e.rot + Math.PI / 2) * rearDist;
        const color = ENEMY_COLORS[e.kind];
        emit(
          rx + (Math.random() - 0.5) * 4,
          ry + (Math.random() - 0.5) * 4,
          -e.vx * 0.18 + (Math.random() - 0.5) * 25,
          -e.vy * 0.18 + (Math.random() - 0.5) * 25,
          0.22,
          color,
          e.kind === "tank" ? 2.2 : 1.5,
          true,
          3.5,
        );
      }

      // Enemy firing at the blue ship (strictly checking clear line of fire outside buttons)
      if (e.fireTimer <= 0 && Math.abs(e.x - player.x) < 160 && e.y >= safeCombatCeiling) {
        let blocked = false;
        if (exclusionBoxes && exclusionBoxes.length > 0) {
          for (const box of exclusionBoxes) {
            if (lineIntersectsBox(e.x, e.y, player.x, player.y, box)) {
              blocked = true;
              break;
            }
          }
        }
        if (!blocked) {
          this.enemyShoot(e, player, emit);
          e.fireTimer = e.kind === "tank" ? 0.9 : 1.5 + Math.random() * 0.8;
        }
      }

      // Boundary cleanup
      if (e.y > screenH + 80 || e.y < -120 || e.x < -100 || e.x > W + 100) {
        e.dead = true;
      }
    }

    // 4. Update bullets & collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Remove bullet if it expires or leaves screen bounds
      if (b.life <= 0 || b.y < -30 || b.y > screenH + 40 || b.x < -40 || b.x > W + 40) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Extra guarantee: if bullet ever reaches within any menu button box, dissipate cleanly
      if (exclusionBoxes && exclusionBoxes.length > 0) {
        let hitButton = false;
        for (const box of exclusionBoxes) {
          if (b.x >= box.left && b.x <= box.right && b.y >= box.top && b.y <= box.bottom) {
            hitButton = true;
            break;
          }
        }
        if (hitButton) {
          this.bullets.splice(i, 1);
          continue;
        }
      }

      if (b.isPlayer) {
        // Player bullet hitting enemy ship
        let hit = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const hitR = e.kind === "tank" ? 28 : 18;
          if (Math.hypot(b.x - e.x, b.y - e.y) < hitR) {
            hit = true;
            e.hp -= 1;
            e.flash = 0.22;
            for (let k = 0; k < 5; k++) {
              const a = Math.random() * TAU;
              const s = 50 + Math.random() * 90;
              emit(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 0.2, ENEMY_COLORS[e.kind], 1.5, true, 3);
            }

            if (e.hp <= 0) {
              e.dead = true;
              const size = e.kind === "tank" ? 1.6 : 1.1;
              const color = ENEMY_COLORS[e.kind];
              const count = Math.round(12 * size + 6);
              for (let k = 0; k < count; k++) {
                const a = Math.random() * TAU;
                const s = (60 + Math.random() * 160) * Math.sqrt(size);
                emit(
                  e.x,
                  e.y,
                  Math.cos(a) * s,
                  Math.sin(a) * s,
                  0.35 + Math.random() * 0.3,
                  Math.random() < 0.35 ? "#ffffff" : color,
                  1.6,
                  true,
                  2.5,
                );
              }
              addRing(e.x, e.y, 48 * size, 0.45, color, 2.5);
              addRing(e.x, e.y, 65 * size, 0.6, "#ffffff", 1.8, 0.05);
            }
            break;
          }
        }
        if (hit) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Enemy bullet hitting the blue ship's defensive energy shield
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const distToShip = Math.hypot(dx, dy);
        if (distToShip < 34) {
          const hitAngle = Math.atan2(dy, dx);
          this.shieldFlashes.push({
            x: player.x,
            y: player.y,
            angle: hitAngle,
            alpha: 1.0,
            life: 0.28,
          });

          for (let k = 0; k < 6; k++) {
            const a = hitAngle + (Math.random() - 0.5) * 1.4;
            const s = 60 + Math.random() * 100;
            emit(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 0.25, "#22e6ff", 1.6, true, 3);
          }
          addRing(player.x, player.y, 38, 0.3, "#22e6ff", 2);

          this.bullets.splice(i, 1);
          continue;
        }
      }
    }

    // 5. Update shield flash flares
    for (let i = this.shieldFlashes.length - 1; i >= 0; i--) {
      const f = this.shieldFlashes[i];
      f.life -= dt;
      f.alpha = Math.max(0, f.life / 0.28);
      if (f.life <= 0) {
        this.shieldFlashes.splice(i, 1);
      }
    }
  }

  /**
   * Spawns combat waves specifically choreographed in the lower arena around the blue ship,
   * completely clear of the menu buttons above.
   */
  private spawnWave(player: Player, screenH: number, safeCombatCeiling: number) {
    const waveType = this.waveIndex % 5;
    this.waveIndex++;

    const arenaCenterY = Math.max(safeCombatCeiling + 20, player.y);

    switch (waveType) {
      case 0: {
        // Pincer Scout Pair: Two scouts flank inward from left & right of blue ship, then bank away
        this.enemies.push({
          id: this.nextId++,
          kind: "scout",
          x: -25,
          y: Math.max(safeCombatCeiling + 10, arenaCenterY - 30),
          vx: 140,
          vy: 20,
          rot: 0,
          hp: 2,
          maxHp: 2,
          flash: 0,
          age: 0,
          fireTimer: 0.55,
          trailTimer: 0,
          pattern: "pincer_left",
          fired: false,
          dead: false,
        });
        this.enemies.push({
          id: this.nextId++,
          kind: "scout",
          x: W + 25,
          y: Math.max(safeCombatCeiling + 10, arenaCenterY - 30),
          vx: -140,
          vy: 20,
          rot: 0,
          hp: 2,
          maxHp: 2,
          flash: 0,
          age: 0,
          fireTimer: 0.7,
          trailTimer: 0,
          pattern: "pincer_right",
          fired: false,
          dead: false,
        });
        break;
      }

      case 1: {
        // High-speed Orange Dart: Enters from lower right flank, swoops across front of player, banks away
        this.enemies.push({
          id: this.nextId++,
          kind: "dart",
          x: W + 25,
          y: arenaCenterY + 30,
          vx: -220,
          vy: -35,
          rot: 0,
          hp: 1,
          maxHp: 1,
          flash: 0,
          age: 0,
          fireTimer: 0.5,
          trailTimer: 0,
          pattern: "dive_bomb",
          fired: false,
          dead: false,
        });
        break;
      }

      case 2: {
        // Heavy Magenta Tank cruiser: Stately horizontal sweep across mid-arena below buttons
        const fromLeft = Math.random() < 0.5;
        this.enemies.push({
          id: this.nextId++,
          kind: "tank",
          x: fromLeft ? -45 : W + 45,
          y: Math.max(safeCombatCeiling + 12, arenaCenterY - 48),
          vx: fromLeft ? 60 : -60,
          vy: 0,
          rot: 0,
          hp: 5,
          maxHp: 5,
          flash: 0,
          age: 0,
          fireTimer: 0.8,
          trailTimer: 0,
          pattern: "heavy_cruise",
          fired: false,
          dead: false,
        });
        break;
      }

      case 3: {
        // Yellow Kamikaze: Enters from lower left corner, loops past player's wing and boosts out
        this.enemies.push({
          id: this.nextId++,
          kind: "kamikaze",
          x: -25,
          y: arenaCenterY + 40,
          vx: 180,
          vy: -40,
          rot: 0,
          hp: 2,
          maxHp: 2,
          flash: 0,
          age: 0,
          fireTimer: 0.45,
          trailTimer: 0,
          pattern: "spiral_flank",
          fired: false,
          dead: false,
        });
        break;
      }

      case 4: {
        // Violet Sniper: Glides in from lower left, hovers to take aim, fires railgun pulse, boosts away
        this.enemies.push({
          id: this.nextId++,
          kind: "sniper",
          x: 28,
          y: arenaCenterY + 50,
          vx: 40,
          vy: -50,
          rot: 0,
          hp: 2,
          maxHp: 2,
          flash: 0,
          age: 0,
          fireTimer: 0.85,
          trailTimer: 0,
          pattern: "railgun_aim",
          fired: false,
          dead: false,
        });
        break;
      }
    }
  }

  private updateEnemyPattern(
    e: MenuEnemy,
    player: Player,
    dt: number,
    screenH: number,
    safeCombatCeiling: number,
  ) {
    // Hard floor ceiling clamp so no pattern ever rises into button space
    if (e.y < safeCombatCeiling) {
      e.y = safeCombatCeiling;
      e.vy = Math.max(Math.abs(e.vy), 40);
    }

    switch (e.pattern) {
      case "pincer_left":
        // Sweeps inward toward player, then banks sharply outward to bottom-left
        if (e.x > player.x - 55) {
          e.vx = Math.max(-180, e.vx - dt * 320);
          e.vy = Math.min(160, e.vy + dt * 140);
        } else {
          e.vx = Math.min(140, e.vx + dt * 40);
        }
        break;

      case "pincer_right":
        if (e.x < player.x + 55) {
          e.vx = Math.min(180, e.vx + dt * 320);
          e.vy = Math.min(160, e.vy + dt * 140);
        } else {
          e.vx = Math.max(-140, e.vx - dt * 40);
        }
        break;

      case "dive_bomb":
        // Swoops in front of player, then arches down and away
        if (e.x < player.x) {
          e.vy = Math.min(120, e.vy + dt * 180);
          e.vx = Math.max(-250, e.vx - dt * 100);
        }
        break;

      case "heavy_cruise":
        // Smooth undulating cruise horizontally across the arena
        e.vy = Math.sin(e.age * 2.2) * 16;
        break;

      case "spiral_flank":
        // Arching sweep around player
        if (e.x > player.x + 20) {
          e.vy = Math.min(140, e.vy + dt * 160);
          e.vx = Math.min(220, e.vx + dt * 100);
        }
        break;

      case "railgun_aim":
        // Decelerates to line up a shot, then hyper-boosts away to bottom-right
        if (e.age < 1.1) {
          e.vx *= Math.exp(-2.5 * dt);
          e.vy *= Math.exp(-2.5 * dt);
        } else {
          e.vx = Math.min(220, e.vx + dt * 260);
          e.vy = Math.min(160, e.vy + dt * 180);
        }
        break;
    }
  }

  private enemyShoot(e: MenuEnemy, player: Player, emit: EmitParticleFn) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = e.kind === "sniper" ? 340 : e.kind === "dart" ? 280 : 220;

    if (e.kind === "tank") {
      // Tank fires dual heavy plasma charges from chin cannons
      for (const side of [-10, 10]) {
        this.bullets.push({
          x: e.x + side,
          y: e.y + 14,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          isPlayer: false,
          amber: false,
          color: ENEMY_COLORS.tank,
          life: 2.0,
        });
        emit(e.x + side, e.y + 14, (dx / dist) * 40, (dy / dist) * 40, 0.16, ENEMY_COLORS.tank, 2.2, true, 4);
      }
    } else {
      const isAmber = e.kind === "dart" || e.kind === "kamikaze";
      this.bullets.push({
        x: e.x,
        y: e.y + 8,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        isPlayer: false,
        amber: isAmber,
        color: ENEMY_COLORS[e.kind],
        life: 1.8,
      });
      emit(e.x, e.y + 8, (dx / dist) * 30, (dy / dist) * 30, 0.15, ENEMY_COLORS[e.kind], 2.0, true, 4);
    }
  }

  /**
   * Draws attacking enemies, projectiles, thruster flames and shield flares
   * in the menu background using the EXACT sprites from the gameplay SpriteSet.
   *
   * An optional set of exclusionBoxes guarantees that no pixels are drawn over menu buttons.
   */
  draw(
    g: CanvasRenderingContext2D,
    s: SpriteSet,
    player: Player,
    time: number,
    exclusionBoxes?: ExclusionBox[],
    screenH?: number,
  ) {
    const hasBoxes = exclusionBoxes && exclusionBoxes.length > 0;
    if (hasBoxes) {
      g.save();
      g.beginPath();
      // Outer canvas frame
      g.rect(-60, -60, W + 120, (screenH || 800) + 120);
      // Even-odd hole punches for each button box
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
    }

    // 1. Draw enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sp = s[e.kind];
      if (!sp) continue;

      g.save();
      g.translate(e.x, e.y);
      g.rotate(e.rot);

      // Enemy stern thruster flame
      const rearY = -sp.h / 2 + 5;
      const flameLen = 6 + Math.random() * 5;
      g.globalCompositeOperation = "lighter";
      g.fillStyle = ENEMY_COLORS[e.kind];
      g.beginPath();
      g.moveTo(-3, rearY);
      g.lineTo(3, rearY);
      g.lineTo(0, rearY - flameLen);
      g.closePath();
      g.fill();

      // White inner flame core
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.moveTo(-1.4, rearY);
      g.lineTo(1.4, rearY);
      g.lineTo(0, rearY - flameLen * 0.55);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "source-over";

      // Draw the exact gameplay enemy sprite!
      g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);

      // White flash when taking hit
      if (e.flash > 0) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, e.flash * 7) * 0.85;
        g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      }

      g.restore();
    }

    // 2. Draw bullets
    for (const b of this.bullets) {
      if (b.isPlayer) {
        // Player blaster bolt (cyan plasma tracer)
        g.save();
        g.translate(b.x, b.y);
        g.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        g.drawImage(s.bullet.c, -s.bullet.w / 2, -s.bullet.h / 2, s.bullet.w, s.bullet.h);
        g.restore();
      } else {
        // Enemy plasma orb (pink or amber from gameplay SpriteSet)
        g.save();
        g.globalCompositeOperation = "lighter";
        const sp = b.amber ? s.orbAmber : s.orbPink;
        g.drawImage(sp.c, b.x - sp.w / 2, b.y - sp.h / 2, sp.w, sp.h);
        g.globalCompositeOperation = "source-over";
        g.restore();
      }
    }

    // 3. Draw blue ship's defensive energy shield flares
    for (const f of this.shieldFlashes) {
      g.save();
      g.translate(f.x, f.y);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = f.alpha * 0.95;

      const shieldR = 32;
      g.strokeStyle = "#22e6ff";
      g.lineWidth = 2.4;
      g.shadowColor = "#22e6ff";
      g.shadowBlur = 14;

      g.beginPath();
      g.arc(0, 0, shieldR, f.angle - 0.7, f.angle + 0.7);
      g.stroke();

      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(0, 0, shieldR - 1, f.angle - 0.4, f.angle + 0.4);
      g.stroke();

      g.fillStyle = "rgba(34, 230, 255, 0.22)";
      g.beginPath();
      g.arc(0, 0, shieldR, f.angle - 0.7, f.angle + 0.7);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();

      g.restore();
    }

    if (hasBoxes) {
      g.restore();
    }
  }
}
