'use strict';
/* ============================================================
   RECOIL RUMBLE — ai.js
   Bot brain. Re-decides on a reaction-time interval, navigates
   one-way platforms, recovers from knockback with double jumps,
   hunts crates, and gates its aim by difficulty.
   ============================================================ */

const AI_LEVELS = {
  easy:   { react: 0.42, aimGate: 0.45, recover: 0.65, dodge: 0.05, crateLove: 0.5, nadeRate: 0.004 },
  normal: { react: 0.24, aimGate: 0.8,  recover: 0.92, dodge: 0.3,  crateLove: 0.8, nadeRate: 0.008 },
  hard:   { react: 0.12, aimGate: 0.95, recover: 1.0,  dodge: 0.6,  crateLove: 1.0, nadeRate: 0.012 }
};

class AIController {
  constructor(player, difficulty) {
    this.p = player;
    this.cfg = AI_LEVELS[difficulty] || AI_LEVELS.normal;
    this.decideT = 0;
    this.plan = { moveX: null, wantJump: false, target: null, mode: 'hunt' };
    this.strafeT = 0;
    this.strafeDir = 0;
    this.jumpCd = 0;
  }

  /* find the platform whose top is nearest below a point */
  platformBelow(game, x, y) {
    let best = null;
    for (const p of game.level.platforms) {
      if (x < p.x - 10 || x > p.x + p.w + 10) continue;
      if (p.y >= y - 4 && (!best || p.y < best.y)) best = p;
    }
    return best;
  }

  nearestPlatform(game, x, y) {
    let best = null, bestD = Infinity;
    for (const p of game.level.platforms) {
      const px = clamp(x, p.x + 20, p.x + p.w - 20);
      const d = Math.abs(px - x) + Math.abs(p.y - y) * 1.6;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  nearestEnemy(game) {
    let best = null, bestD = Infinity;
    for (const o of game.players) {
      if (o === this.p || o.dead || o.eliminated) continue;
      const d = dist(this.p.x, this.p.cy, o.x, o.cy);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  bestCrate(game) {
    let best = null, bestD = Infinity;
    for (const c of game.crates) {
      if (!c.landed || c.dead) continue;
      const d = dist(this.p.x, this.p.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { crate: best, d: bestD } : null;
  }

  think(dt, game) {
    const p = this.p;
    const cmd = p.cmd;
    cmd.left = cmd.right = cmd.down = false;
    cmd.jumpPressed = false;
    cmd.jumpHeld = false;
    cmd.shoot = false;
    cmd.grenadePressed = false;

    this.jumpCd -= dt;
    this.decideT -= dt;
    this.strafeT -= dt;

    /* ---------- emergency: falling with no ground below ---------- */
    const support = this.platformBelow(game, p.x, p.y);
    const offMap = !support && !p.onGround;
    if (offMap) {
      // recover toward the nearest platform
      const target = this.nearestPlatform(game, clamp(p.x, 120, GAME_W - 120), p.y);
      if (target) {
        const tx = clamp(p.x, target.x + 30, target.x + target.w - 30);
        if (tx < p.x - 8) cmd.left = true;
        else if (tx > p.x + 8) cmd.right = true;
        const needJump = p.y > target.y - 20 && p.vy > -100;
        if (needJump && this.jumpCd <= 0 && chance(this.cfg.recover)) {
          cmd.jumpPressed = true;
          cmd.jumpHeld = true;
          this.jumpCd = 0.28;
        }
        cmd.jumpHeld = cmd.jumpHeld || p.vy < 0;
      }
      return;
    }

    /* ---------- periodic re-planning ---------- */
    if (this.decideT <= 0) {
      this.decideT = this.cfg.react * rand(0.7, 1.3);
      this.replan(game);
    }

    const plan = this.plan;
    const enemy = plan.target && !plan.target.dead && !plan.target.eliminated
      ? plan.target : this.nearestEnemy(game);

    /* ---------- movement toward plan.moveX ---------- */
    if (plan.moveX !== null) {
      const dx = plan.moveX - p.x;
      if (Math.abs(dx) > 14) {
        if (dx < 0) cmd.left = true; else cmd.right = true;
      } else if (plan.mode === 'hunt' && enemy) {
        // arrived: strafe a little, face the enemy
        if (this.strafeT <= 0) {
          this.strafeT = rand(0.3, 0.9);
          this.strafeDir = chance(0.5) ? 0 : (chance(0.5) ? -1 : 1);
        }
        if (this.strafeDir < 0) cmd.left = true;
        else if (this.strafeDir > 0) cmd.right = true;
      }
    }

    /* ---------- climb: jump when target is above ---------- */
    if (plan.wantJump && p.onGround && this.jumpCd <= 0) {
      cmd.jumpPressed = true;
      this.jumpCd = 0.32;
    }
    // double jump while climbing if rising too slowly
    if (plan.wantJump && !p.onGround && p.vy > 40 && p.jumpsLeft > 0 && this.jumpCd <= 0) {
      if (chance(this.cfg.recover)) {
        cmd.jumpPressed = true;
        this.jumpCd = 0.3;
      }
    }
    cmd.jumpHeld = p.vy < -50 || cmd.jumpPressed;

    /* ---------- edge safety while hunting on same tier ---------- */
    if (p.onGround && p.groundPlat && plan.mode === 'hunt' && enemy) {
      const plat = p.groundPlat;
      const dyToEnemy = enemy.cy - p.cy;
      if (Math.abs(dyToEnemy) < 60) {
        // don't walk off the edge while exchanging fire on the same tier
        if (cmd.left && p.x - 26 < plat.x && enemy.x > plat.x - 60) cmd.left = false;
        if (cmd.right && p.x + 26 > plat.x + plat.w && enemy.x < plat.x + plat.w + 60) cmd.right = false;
      }
    }

    /* ---------- dodge incoming fire ---------- */
    if (this.cfg.dodge > 0 && p.onGround && this.jumpCd <= 0) {
      for (const b of game.bullets) {
        if (b.owner === p || b.isFlame) continue;
        if (Math.abs(b.y - p.cy) < 36 && sign(b.vx) === sign(p.x - b.x) && Math.abs(b.x - p.x) < 320) {
          if (chance(this.cfg.dodge * dt * 22)) {
            cmd.jumpPressed = true;
            this.jumpCd = 0.5;
          }
        }
      }
    }

    /* ---------- aim & fire ---------- */
    if (enemy) {
      const dx = enemy.x - p.x;
      const dy = enemy.cy - p.cy;
      const w = WEAPONS[p.weapon];
      // face the enemy when not actively traveling the other way
      if (plan.mode !== 'crate' && Math.abs(dx) > 30) {
        if ((dx > 0 && !cmd.left) || (dx < 0 && cmd.right)) {
          // facing comes from movement; nudge with a micro-move
          if (dx > 0 && !cmd.right && !cmd.left) cmd.right = cmd.left = false;
        }
      }
      const facingEnemy = (dx > 0 && p.dir > 0) || (dx < 0 && p.dir < 0);
      const inRangeX = Math.abs(dx) < (w.aiRange || w.range || 1100) && Math.abs(dx) > (w.explosive ? 200 : 24);
      const aligned = Math.abs(dy) < 42;
      if (facingEnemy && inRangeX && aligned && chance(this.cfg.aimGate)) {
        cmd.shoot = true;
      }
      // turn to face if aligned but looking away (movement-free turn via tap)
      if (!facingEnemy && aligned && inRangeX && !cmd.left && !cmd.right) {
        if (dx > 0) cmd.right = true; else cmd.left = true;
      }
      // grenade at enemies on other tiers
      if (p.grenades > 0 && Math.abs(dy) > 60 && Math.abs(dx) < 420 && chance(this.cfg.nadeRate)) {
        cmd.grenadePressed = true;
      }
    }
  }

  replan(game) {
    const p = this.p;
    const plan = this.plan;
    plan.wantJump = false;
    plan.mode = 'hunt';

    const enemy = this.nearestEnemy(game);
    plan.target = enemy;

    // consider grabbing a crate (more tempting when stuck with the pistol)
    const crateInfo = this.bestCrate(game);
    if (crateInfo && enemy) {
      const enemyD = dist(p.x, p.cy, enemy.x, enemy.cy);
      const want = (p.weapon === 'pistol' ? 1.5 : 0.6) * this.cfg.crateLove;
      if (crateInfo.d < enemyD * want + 140) {
        plan.mode = 'crate';
        plan.moveX = crateInfo.crate.x;
        plan.wantJump = crateInfo.crate.y < p.y - 60;
        return;
      }
    }

    if (!enemy) { plan.moveX = null; return; }

    const dy = enemy.cy - p.cy;
    if (dy < -70) {
      // enemy above: position under a platform near them, then climb
      const target = this.nearestPlatform(game, enemy.x, enemy.y + 10);
      if (target) {
        plan.moveX = clamp(enemy.x, target.x + 26, target.x + target.w - 26);
        plan.wantJump = true;
      } else {
        plan.moveX = enemy.x;
        plan.wantJump = true;
      }
    } else if (dy > 70) {
      // enemy below: walk toward their column and drop off the edge
      plan.moveX = enemy.x + rand(-30, 30);
    } else {
      // same tier: keep a weapon-appropriate distance
      const w = WEAPONS[p.weapon];
      let ideal = 320;
      if (p.weapon === 'shotgun' || p.weapon === 'flame') ideal = 170;
      if (p.weapon === 'sniper') ideal = 520;
      if (w.explosive) ideal = 360;
      const dir = sign(p.x - enemy.x) || (chance(0.5) ? 1 : -1);
      plan.moveX = clamp(enemy.x + dir * ideal, 60, GAME_W - 60);
    }
  }
}
