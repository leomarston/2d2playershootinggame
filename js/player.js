'use strict';
/* ============================================================
   RECOIL RUMBLE — player.js
   Movement, one-way platform physics, knockback, shooting,
   and the full procedural character renderer.
   ============================================================ */

const PHYS = {
  gravity: 2300,
  moveSpeed: 330,
  groundAccel: 3400,
  airAccel: 2000,
  groundFriction: 2600,
  airFriction: 260,
  jumpVel: 770,
  doubleJumpVel: 700,
  maxFall: 1350,
  fastFall: 1900,
  coyote: 0.1,
  jumpBuffer: 0.12,
  maxKnockVel: 1400
};

const CHAR_STYLES = [
  { main: '#3b82f6', dark: '#2456ad', skin: '#ffd9b3', hat: 'cap',    name: 'P1' },
  { main: '#ef4444', dark: '#a82626', skin: '#f2c098', hat: 'beanie', name: 'P2' },
  { main: '#22c55e', dark: '#15803d', skin: '#e8b88a', hat: 'headband', name: 'BOT' },
  { main: '#a855f7', dark: '#7222b5', skin: '#ffd9b3', hat: 'mohawk', name: 'BOT' }
];

class Player {
  constructor(index, controller, controls) {
    this.index = index;
    this.controller = controller;     // 'human' | 'ai'
    this.controls = controls || null; // CONTROLS.p1 / CONTROLS.p2
    this.style = CHAR_STYLES[index];
    this.name = controller === 'ai' ? 'CPU ' + (index + 1) : 'P' + (index + 1);
    this.w = 40; this.h = 62;
    this.ai = null;
    this.resetStats();
    this.respawn(640, 100, true);
    this.lives = 5;
    this.eliminated = false;
  }

  resetStats() { this.kills = 0; this.falls = 0; }

  respawn(x, y, instant) {
    this.x = x; this.y = y;
    this.prevX = x; this.prevY = y;
    this.vx = 0; this.vy = 0;
    this.dir = x < GAME_W / 2 ? 1 : -1;
    this.onGround = false;
    this.groundPlat = null;
    this.jumpsLeft = 2;
    this.coyoteT = 0;
    this.jumpBufT = 0;
    this.weapon = 'pistol';
    this.ammo = Infinity;
    this.fireCd = 0;
    this.spinT = 0;
    this.grenades = 3;
    this.grenadeCd = 0;
    this.boosts = { shield: 0, speed: 0, power: 0, rapid: 0, infinite: 0 };
    this.invuln = instant ? 1.2 : 2.4;
    this.parachute = !instant;
    this.dead = false;
    this.respawnT = 0;
    this.lastHitBy = null;
    this.lastHitT = 0;
    // animation state
    this.walkPhase = 0;
    this.squash = 0;          // >0 squashed (landing), <0 stretched (jumping)
    this.recoilAnim = 0;
    this.blinkT = rand(1, 4);
    this.blink = 0;
    this.muzzleT = 0;
    this.landedAt = -9;
    this.cmd = { left: false, right: false, down: false, jumpPressed: false, jumpHeld: false, shoot: false, grenadePressed: false };
  }

  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }
  get feetY() { return this.y; }

  readHumanInput() {
    const c = this.controls;
    this.cmd.left = Input.isDown(c.left);
    this.cmd.right = Input.isDown(c.right);
    this.cmd.down = Input.isDown(c.down);
    this.cmd.jumpPressed = Input.wasPressed(c.jump);
    this.cmd.jumpHeld = Input.isDown(c.jump);
    this.cmd.shoot = Input.isDown(c.shoot);
    this.cmd.grenadePressed = Input.wasPressed(c.grenade);
  }

  applyKnockback(ix, iy, source) {
    if (this.invuln > 0 || this.boosts.shield > 0) return false;
    this.vx = clamp(this.vx + ix, -PHYS.maxKnockVel, PHYS.maxKnockVel);
    this.vy = clamp(this.vy + iy, -PHYS.maxKnockVel, PHYS.maxKnockVel);
    if (source && source !== this) {
      this.lastHitBy = source;
      this.lastHitT = 4;
    }
    return true;
  }

  update(dt, game) {
    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && this.lives > 0) {
        const sp = game.pickSpawn(this);
        this.respawn(sp.x, sp.y, false);
        Sound.play('respawn');
      }
      return;
    }

    const locked = game.phase !== 'play' && game.phase !== 'slowmo';
    if (locked) {
      this.cmd = { left: false, right: false, down: false, jumpPressed: false, jumpHeld: false, shoot: false, grenadePressed: false };
    } else if (this.controller === 'human') {
      this.readHumanInput();
    } else if (this.ai) {
      this.ai.think(dt, game);
    }

    // timers
    this.fireCd -= dt;
    this.grenadeCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.lastHitT > 0) { this.lastHitT -= dt; if (this.lastHitT <= 0) this.lastHitBy = null; }
    for (const k in this.boosts) if (this.boosts[k] > 0) this.boosts[k] -= dt;
    this.recoilAnim = Math.max(0, this.recoilAnim - dt * 6);
    this.muzzleT -= dt;
    this.squash *= Math.pow(0.0001, dt); // fast decay
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = rand(2, 5); }
    if (this.blink > 0) this.blink -= dt;

    const speedMul = (this.boosts.speed > 0 ? 1.45 : 1) *
      (this.weapon === 'minigun' && this.cmd.shoot ? WEAPONS.minigun.slow : 1);

    /* ---------- parachute respawn descent ---------- */
    if (this.parachute) {
      this.vy = 130;
      const steer = (this.cmd.right ? 1 : 0) - (this.cmd.left ? 1 : 0);
      this.vx = steer * 170;
      if (steer !== 0) this.dir = steer;
      this.prevY = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x, 20, GAME_W - 20);
      this.collidePlatforms(game);
      if (this.onGround || this.cmd.jumpPressed) {
        this.parachute = false;
        if (!this.onGround) this.vy = 0;
        game.fx.dust(this.x, this.y, 5);
      }
      return;
    }

    /* ---------- horizontal movement ---------- */
    const wish = ((this.cmd.right ? 1 : 0) - (this.cmd.left ? 1 : 0));
    const ice = this.groundPlat && this.groundPlat.surface === 'ice';
    const accel = (this.onGround ? PHYS.groundAccel : PHYS.airAccel) * (ice ? 0.35 : 1);
    const fric = (this.onGround ? PHYS.groundFriction : PHYS.airFriction) * (ice ? 0.12 : 1);
    const target = wish * PHYS.moveSpeed * speedMul;

    if (wish !== 0) {
      this.dir = wish;
      this.vx += wish * accel * dt;
      const maxRun = Math.abs(target);
      if (sign(this.vx) === wish && Math.abs(this.vx) > maxRun) {
        if (Math.abs(this.vx) > maxRun * 1.6) {
          // knockback overspeed: bleed it off gradually instead of snapping
          this.vx -= sign(this.vx) * fric * 0.5 * dt;
        } else {
          this.vx = wish * maxRun;
        }
      }
      this.walkPhase += dt * 13 * speedMul;
    } else {
      const dec = fric * dt;
      if (Math.abs(this.vx) <= dec) this.vx = 0;
      else this.vx -= sign(this.vx) * dec;
      this.walkPhase = 0;
    }

    /* ---------- jumping ---------- */
    if (this.cmd.jumpPressed) this.jumpBufT = PHYS.jumpBuffer;
    else this.jumpBufT -= dt;
    if (this.onGround) this.coyoteT = PHYS.coyote;
    else this.coyoteT -= dt;

    if (this.jumpBufT > 0) {
      if (this.coyoteT > 0) {
        this.vy = -PHYS.jumpVel;
        this.onGround = false;
        this.groundPlat = null;
        this.coyoteT = 0;
        this.jumpBufT = 0;
        this.jumpsLeft = 1;
        this.squash = -0.35;
        Sound.play('jump', { vol: 0.7 });
        game.fx.dust(this.x, this.y, 4);
      } else if (this.jumpsLeft > 0) {
        this.vy = -PHYS.doubleJumpVel;
        this.jumpsLeft--;
        this.jumpBufT = 0;
        this.squash = -0.35;
        Sound.play('djump', { vol: 0.7 });
        game.fx.jumpRing(this.x, this.y - 6);
      }
    }
    // variable jump height
    if (!this.cmd.jumpHeld && this.vy < -300) this.vy = -300;

    /* ---------- gravity ---------- */
    this.vy += PHYS.gravity * dt;
    const maxFall = this.cmd.down ? PHYS.fastFall : PHYS.maxFall;
    if (this.vy > maxFall) this.vy = maxFall;

    /* ---------- integrate ---------- */
    this.prevX = this.x; this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.collidePlatforms(game);

    /* ---------- shooting ---------- */
    if (this.cmd.shoot && game.phase !== 'over') this.tryShoot(game, dt);
    else this.spinT = 0;

    if (this.cmd.grenadePressed && this.grenades > 0 && this.grenadeCd <= 0 && game.phase !== 'over') {
      this.grenades--;
      this.grenadeCd = 0.5;
      game.grenades.push(new Grenade(this, this.x, this.cy - 6, this.dir));
      Sound.play('throw');
      this.recoilAnim = 0.5;
    }

    /* ---------- out of bounds = KO ---------- */
    if (this.x < -90 || this.x > GAME_W + 90 || this.y > GAME_H + 110) {
      game.koPlayer(this);
    }
  }

  collidePlatforms(game) {
    const wasOnGround = this.onGround;
    this.onGround = false;
    const prevPlat = this.groundPlat;
    this.groundPlat = null;
    if (this.vy >= 0) {
      const halfW = this.w * 0.38;
      for (const p of game.level.platforms) {
        if (this.x + halfW < p.x || this.x - halfW > p.x + p.w) continue;
        const margin = p.dyThisFrame !== undefined ? Math.max(6, Math.abs(p.dyThisFrame) + 4) : 6;
        if (this.prevY <= p.y + margin && this.y >= p.y) {
          this.y = p.y;
          this.vy = 0;
          this.onGround = true;
          this.groundPlat = p;
          this.jumpsLeft = 2;
          break;
        }
      }
    }
    // ride moving platforms
    if (this.onGround && this.groundPlat && this.groundPlat.move) {
      this.x += this.groundPlat.dxThisFrame || 0;
      this.y += this.groundPlat.dyThisFrame || 0;
    }
    if (this.onGround && !wasOnGround) {
      const impact = clamp((this.vyAtLand || 600) / 1200, 0.2, 1);
      this.squash = 0.45 * impact;
      this.landedAt = performance.now() / 1000;
      Sound.play('land', { vol: 0.5 * impact });
      game.fx.dust(this.x, this.y, Math.round(3 + impact * 4));
    }
    if (!this.onGround) this.vyAtLand = this.vy;
  }

  gunMuzzle() {
    const w = WEAPONS[this.weapon];
    return {
      x: this.x + this.dir * (this.w * 0.32 + w.muzzle + w.len * 0.55),
      y: this.y - 38 // matches where the gun is drawn
    };
  }

  tryShoot(game, dt) {
    const w = WEAPONS[this.weapon];
    if (w.spinup) {
      this.spinT += dt;
      if (this.spinT < w.spinup) {
        if (this.spinT < dt * 1.5) Sound.play('spinup');
        return;
      }
    }
    if (this.fireCd > 0) return;
    if (this.ammo <= 0) { this.switchTo('pistol'); return; }

    const rofMul = this.boosts.rapid > 0 ? 0.55 : 1;
    this.fireCd = w.rof * rofMul;
    if (this.boosts.infinite <= 0) this.ammo--;
    const kbMul = this.boosts.power > 0 ? 1.55 : 1;

    const m = this.gunMuzzle();
    for (let i = 0; i < w.pellets; i++) {
      game.bullets.push(new Bullet(this, m.x, m.y, this.dir, this.weapon, kbMul));
    }

    // recoil pushes the shooter back — core Gun-Mayhem-style mechanic
    this.vx -= this.dir * w.recoil * (this.onGround ? 0.55 : 1);
    this.recoilAnim = 1;
    this.muzzleT = 0.05;
    Sound.play(w.sfx, { vol: 0.9 });
    game.fx.casing(m.x - this.dir * (w.len * 0.8), m.y, this.dir);
    if (w.pellets > 1 || w.explosive) game.fx.muzzleSmoke(m.x, m.y, this.dir);
    if (w.explosive) game.addShake(5);

    if (this.ammo <= 0 && this.boosts.infinite <= 0) {
      this.switchTo('pistol');
      game.fx.text(this.x, this.cy - 50, 'OUT OF AMMO', '#cfd4dc', { size: 15 });
    }
  }

  switchTo(weaponId, ammo) {
    this.weapon = weaponId;
    this.ammo = ammo !== undefined ? ammo : WEAPONS[weaponId].ammo;
    this.fireCd = Math.max(this.fireCd, 0.18);
    this.spinT = 0;
  }

  pickupCrate(crate, game) {
    const c = crate.content;
    if (c.kind === 'weapon') {
      this.switchTo(c.id, WEAPONS[c.id].ammo);
      game.fx.text(this.x, this.cy - 56, WEAPONS[c.id].name + '!', WEAPONS[c.id].color, { size: 19 });
      Sound.play('pickup');
    } else {
      const p = POWERUPS[c.id];
      if (c.id === 'nades') this.grenades += 3;
      else this.boosts[c.id] = p.dur;
      game.fx.text(this.x, this.cy - 56, p.name, p.color, { size: 19 });
      Sound.play('powerup');
    }
    game.fx.sparks(crate.x, crate.y, 14, '#ffd166', 380, 0.45);
    game.fx.debris(crate.x, crate.y, 8, '#9c6a36');
    game.fx.ring(crate.x, crate.y, '#ffd166', 46, 0.3, 4);
  }

  /* ==========================================================
     RENDERING
     ========================================================== */
  draw(ctx, t) {
    if (this.dead) return;

    const blinkOut = this.invuln > 0 && !this.parachute && Math.sin(t * 26) > 0.45;
    ctx.save();
    if (blinkOut) ctx.globalAlpha = 0.35;

    const S = this.style;
    const dir = this.dir;
    const running = Math.abs(this.vx) > 40 && this.onGround;
    const airborne = !this.onGround && !this.parachute;

    // squash & stretch
    const sq = clamp(this.squash, -0.4, 0.5);
    const sx = 1 + sq * 0.5;
    const sy = 1 - sq * 0.5;

    ctx.translate(this.x, this.y);
    ctx.scale(sx, sy);

    const bob = running ? Math.sin(this.walkPhase * 2) * 1.6 : 0;
    const lean = clamp(this.vx / PHYS.moveSpeed, -1, 1) * 0.09;
    ctx.rotate(lean * (this.onGround ? 1 : 0.4));

    /* ---- legs ---- */
    const hipY = -22 + bob;
    const legSwing = running ? Math.sin(this.walkPhase) * 0.85 : (airborne ? 0.35 : 0);
    const legSwing2 = running ? Math.sin(this.walkPhase + Math.PI) * 0.85 : (airborne ? -0.3 : 0);
    const drawLeg = (swing, back) => {
      ctx.save();
      ctx.translate(dir * (back ? -5 : 5), hipY);
      ctx.rotate(swing * dir * 0.55);
      ctx.fillStyle = back ? shade('#33415c', 0.75) : '#33415c';
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 2.5;
      rr(ctx, -4.5, 0, 9, 18, 4);
      ctx.fill(); ctx.stroke();
      // shoe
      ctx.fillStyle = back ? shade(S.main, 0.6) : shade(S.main, 0.85);
      rr(ctx, -5.5 + dir * 1.5, 14, 12, 7, 3);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    drawLeg(legSwing2, true);

    /* ---- torso ---- */
    const torsoY = -44 + bob;
    ctx.save();
    const torsoGrad = ctx.createLinearGradient(-12, torsoY, 12, torsoY + 26);
    torsoGrad.addColorStop(0, shade(S.main, 1.15));
    torsoGrad.addColorStop(1, shade(S.main, 0.8));
    ctx.fillStyle = torsoGrad;
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 2.5;
    rr(ctx, -12, torsoY, 24, 26, 8);
    ctx.fill(); ctx.stroke();
    // chest strap
    ctx.strokeStyle = shade(S.dark, 0.85);
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-10 * dir, torsoY + 4);
    ctx.lineTo(8 * dir, torsoY + 20);
    ctx.stroke();
    ctx.strokeStyle = '#221d2b';
    ctx.restore();

    drawLeg(legSwing, false);

    /* ---- head ---- */
    const headY = -62 + bob * 1.2;
    const headR = 17;
    ctx.save();
    const headGrad = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.4, 2, 0, headY, headR * 1.25);
    headGrad.addColorStop(0, shade(S.skin, 1.12));
    headGrad.addColorStop(1, shade(S.skin, 0.82));
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, TAU);
    ctx.fill(); ctx.stroke();

    /* ---- face ---- */
    const eyeX = dir * 7, eyeY = headY - 2;
    const shooting = this.recoilAnim > 0.2 || this.cmd.shoot;
    const blinking = this.blink > 0;
    const drawEye = (ox) => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 1.6;
      if (blinking) {
        ctx.beginPath();
        ctx.moveTo(ox - 3.4, eyeY); ctx.lineTo(ox + 3.4, eyeY);
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      ctx.ellipse(ox, eyeY, 3.6, shooting ? 3.2 : 4.4, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#221d2b';
      ctx.beginPath();
      ctx.arc(ox + dir * 1.4, eyeY + 0.5, 1.8, 0, TAU);
      ctx.fill();
    };
    drawEye(eyeX - 4.5);
    drawEye(eyeX + 4.5);
    if (shooting) { // angry brows
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(eyeX - 8, eyeY - 7.5); ctx.lineTo(eyeX - 1, eyeY - 5);
      ctx.moveTo(eyeX + 8, eyeY - 8.5); ctx.lineTo(eyeX + 1.5, eyeY - 5.5);
      ctx.stroke();
    }
    // mouth
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (airborne && this.vy > 500) {
      ctx.arc(dir * 5, headY + 8, 3, 0, TAU); // "o" mouth while falling
    } else if (shooting) {
      ctx.moveTo(dir * 2, headY + 8.5); ctx.lineTo(dir * 9, headY + 7.5);
    } else {
      ctx.arc(dir * 4, headY + 6, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();

    /* ---- hat ---- */
    ctx.fillStyle = S.main;
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 2.5;
    if (S.hat === 'cap') {
      ctx.beginPath();
      ctx.arc(0, headY - 4, headR * 0.92, Math.PI, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // backwards brim
      ctx.fillStyle = shade(S.main, 0.8);
      rr(ctx, -dir * (headR + 8), headY - 8, 11, 5.5, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(S.main, 1.25);
      ctx.beginPath(); ctx.arc(0, headY - 12, 3, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (S.hat === 'beanie') {
      ctx.beginPath();
      ctx.arc(0, headY - 3, headR * 0.95, Math.PI * 1.05, -Math.PI * 0.05); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(S.main, 0.75);
      rr(ctx, -headR * 0.95, headY - 7, headR * 1.9, 5, 2.5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(S.main, 1.3);
      ctx.beginPath(); ctx.arc(0, headY - 18, 4, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (S.hat === 'headband') {
      ctx.fillStyle = S.main;
      rr(ctx, -headR * 0.98, headY - 10, headR * 1.96, 6, 3);
      ctx.fill(); ctx.stroke();
      // knot tails
      ctx.beginPath();
      ctx.moveTo(-dir * headR * 0.9, headY - 7);
      ctx.lineTo(-dir * (headR + 9), headY - 3);
      ctx.lineTo(-dir * (headR + 6), headY + 3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else { // mohawk
      ctx.fillStyle = S.main;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const px = i * 5.5;
        ctx.moveTo(px - 3, headY - headR + 4);
        ctx.lineTo(px, headY - headR - 9 - Math.abs(2 - Math.abs(i)) * 2);
        ctx.lineTo(px + 3, headY - headR + 4);
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    /* ---- gun + hands ---- */
    const w = WEAPONS[this.weapon];
    const recoilOff = -this.recoilAnim * 5;
    ctx.save();
    ctx.translate(dir * (this.w * 0.32) + dir * recoilOff, -38 + bob);
    ctx.scale(dir, 1);
    drawGun(ctx, this.weapon);
    // hands (gloves)
    ctx.fillStyle = '#e9e4da';
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(2, 6, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
    if (w.len > 30) { ctx.beginPath(); ctx.arc(16, 3, 4.2, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    /* ---- muzzle flash ---- */
    if (this.muzzleT > 0) {
      const m = this.gunMuzzle();
      ctx.save();
      ctx.translate(m.x - this.x, (m.y - this.y) / sy);
      ctx.scale(dir, 1);
      ctx.globalCompositeOperation = 'lighter';
      const fr = 8 + Math.random() * 7 + (w.explosive ? 8 : 0);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr * 1.6);
      fg.addColorStop(0, '#fffbe8');
      fg.addColorStop(0.5, '#ffd166');
      fg.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, 0, fr * 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.moveTo(-2, -fr * 0.45);
      ctx.lineTo(fr * 1.5, 0);
      ctx.lineTo(-2, fr * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* ---- parachute ---- */
    if (this.parachute) {
      ctx.save();
      const sway = Math.sin(t * 2.4 + this.index) * 0.07;
      ctx.rotate(sway);
      ctx.strokeStyle = 'rgba(40,35,50,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-12, -68); ctx.lineTo(-30, -104);
      ctx.moveTo(12, -68); ctx.lineTo(30, -104);
      ctx.stroke();
      const pg = ctx.createLinearGradient(-36, -135, 36, -100);
      pg.addColorStop(0, shade(S.main, 1.2));
      pg.addColorStop(1, S.main);
      ctx.fillStyle = pg;
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-36, -104);
      ctx.quadraticCurveTo(0, -148, 36, -104);
      ctx.quadraticCurveTo(18, -112, 0, -104);
      ctx.quadraticCurveTo(-18, -112, -36, -104);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, -108); ctx.quadraticCurveTo(-12, -132, 0, -136);
      ctx.moveTo(18, -108); ctx.quadraticCurveTo(12, -132, 0, -136);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // end body transform

    /* ---- shield bubble ---- */
    if (this.boosts.shield > 0) {
      const fading = this.boosts.shield < 1.5 && Math.sin(t * 18) > 0;
      if (!fading) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#4cc9f0';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(76,201,240,0.13)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.cy - 4, 36, 46, 0, 0, TAU);
        ctx.fill(); ctx.stroke();
        // shimmer
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(this.x, this.cy - 4, 36, 46, 0, t * 3 % TAU, t * 3 % TAU + 0.7);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ---- speed afterimage lines ---- */
    if (this.boosts.speed > 0 && Math.abs(this.vx) > 200) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#06d6a0';
      ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(this.x - sign(this.vx) * (14 + i * 10), this.cy - 18 + i * 12);
        ctx.lineTo(this.x - sign(this.vx) * (30 + i * 14), this.cy - 18 + i * 12);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---- power glow ---- */
    if (this.boosts.power > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 8);
      const g = ctx.createRadialGradient(this.x, this.cy, 4, this.x, this.cy, 52);
      g.addColorStop(0, '#ff5d73');
      g.addColorStop(1, 'rgba(255,93,115,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.cy, 52, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /* soft elliptical shadow projected onto the platform below */
  drawShadow(ctx, game) {
    if (this.dead) return;
    let best = null;
    const halfW = this.w * 0.38;
    for (const p of game.level.platforms) {
      if (this.x + halfW < p.x || this.x - halfW > p.x + p.w) continue;
      if (p.y >= this.y - 2 && (!best || p.y < best.y)) best = p;
    }
    if (!best) return;
    const d = clamp((best.y - this.y) / 380, 0, 1);
    const r = lerp(20, 9, d);
    ctx.save();
    ctx.globalAlpha = lerp(0.32, 0.07, d);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, best.y + 4, r, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
