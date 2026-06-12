'use strict';
/* ============================================================
   RECOIL RUMBLE — weapons.js
   Weapon stats, procedural gun art, bullets, grenades,
   crates and powerups.

   Knockback is the core stat: bullets shove players, they
   never deal damage. Recoil pushes the shooter back too.
   ============================================================ */

const WEAPONS = {
  pistol: {
    name: 'Pistol', ammo: Infinity, rof: 0.3, speed: 1500,
    kb: 300, recoil: 55, spread: 0.5, pellets: 1,
    color: '#ffd166', sfx: 'pistol', len: 26, muzzle: 14,
    bulletR: 3.4, weight: 10
  },
  uzi: {
    name: 'Dual Uzis', ammo: 56, rof: 0.075, speed: 1400,
    kb: 105, recoil: 22, spread: 4, pellets: 1,
    color: '#ffe28a', sfx: 'uzi', len: 24, muzzle: 12,
    bulletR: 2.6, weight: 16
  },
  ar: {
    name: 'Assault Rifle', ammo: 32, rof: 0.115, speed: 1650,
    kb: 195, recoil: 42, spread: 1.6, pellets: 1,
    color: '#ffc14d', sfx: 'ar', len: 36, muzzle: 20,
    bulletR: 3, weight: 16
  },
  shotgun: {
    name: 'Shotgun', ammo: 9, rof: 0.8, speed: 1250,
    kb: 165, recoil: 240, spread: 8, pellets: 6,
    color: '#ff9e40', sfx: 'shotgun', len: 34, muzzle: 18,
    bulletR: 2.4, weight: 13, range: 460
  },
  magnum: {
    name: 'Magnum', ammo: 12, rof: 0.52, speed: 2000,
    kb: 520, recoil: 160, spread: 0, pellets: 1,
    color: '#ffe9b8', sfx: 'magnum', len: 28, muzzle: 15,
    bulletR: 3.8, weight: 11
  },
  sniper: {
    name: 'Sniper', ammo: 5, rof: 1.15, speed: 2600,
    kb: 920, recoil: 210, spread: 0, pellets: 1,
    color: '#9bf6ff', sfx: 'sniper', len: 46, muzzle: 25,
    bulletR: 3.2, weight: 8
  },
  minigun: {
    name: 'Minigun', ammo: 130, rof: 0.05, speed: 1500,
    kb: 88, recoil: 26, spread: 5.5, pellets: 1,
    color: '#ffd166', sfx: 'minigun', len: 40, muzzle: 22,
    bulletR: 2.8, weight: 9, spinup: 0.35, slow: 0.7
  },
  rocket: {
    name: 'Rocket Launcher', ammo: 4, rof: 1.05, speed: 760,
    kb: 0, recoil: 200, spread: 0, pellets: 1,
    color: '#ff6b6b', sfx: 'rocketfire', len: 44, muzzle: 24,
    bulletR: 6, weight: 8, explosive: { radius: 130, impulse: 720 }
  },
  flame: {
    name: 'Flamethrower', ammo: 90, rof: 0.03, speed: 520,
    kb: 34, recoil: 10, spread: 7, pellets: 1,
    color: '#ff9e40', sfx: 'flame', len: 38, muzzle: 21,
    bulletR: 5, weight: 9, isFlame: true, flameLife: 0.5, aiRange: 240
  }
};
const WEAPON_DROPS = Object.keys(WEAPONS).filter(k => k !== 'pistol');

const POWERUPS = {
  shield:   { name: 'Shield!',       dur: 6,  color: '#4cc9f0', weight: 12 },
  speed:    { name: 'Speed Boost!',  dur: 7,  color: '#06d6a0', weight: 12 },
  power:    { name: 'Mega Punch!',   dur: 8,  color: '#ff5d73', weight: 12 },
  rapid:    { name: 'Rapid Fire!',   dur: 8,  color: '#ffd166', weight: 12 },
  infinite: { name: 'Infinite Ammo!',dur: 8,  color: '#b388eb', weight: 8  },
  nades:    { name: '+3 Grenades!',  dur: 0,  color: '#90be6d', weight: 10 }
};

function weightedPick(table, keys) {
  let total = 0;
  for (const k of keys) total += table[k].weight;
  let roll = Math.random() * total;
  for (const k of keys) {
    roll -= table[k].weight;
    if (roll <= 0) return k;
  }
  return keys[keys.length - 1];
}

/* ============================================================
   Gun art. Drawn pointing +x with the grip at the origin.
   Used for the in-hand weapon and (scaled) for HUD icons.
   ============================================================ */
function drawGun(ctx, id) {
  const dark = '#2c2733', metal = '#6e7280', metalHi = '#9aa0ad', grip = '#7a4a2b';
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = dark;
  ctx.lineJoin = 'round';

  const body = (x, y, w, h, c, r = 2) => {
    ctx.fillStyle = c; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
  };

  switch (id) {
    case 'pistol':
      body(-2, 2, 7, 11, grip, 2);            // grip
      body(-4, -4, 22, 8, metal, 3);          // slide
      body(14, -2, 8, 4, metalHi, 1);         // barrel tip
      break;
    case 'uzi':
      body(0, 2, 6, 12, dark, 2);
      body(-5, -4, 24, 9, '#494e59', 2);
      body(15, -2, 8, 4, metal, 1);
      body(2, -7, 7, 4, metal, 1);             // top sight
      break;
    case 'ar':
      body(2, 3, 7, 12, grip, 2);
      body(-10, -4, 36, 8, '#5b4632', 2);      // wooden body
      body(22, -2.5, 13, 5, metal, 1);         // barrel
      body(8, 4, 6, 9, '#3c3f48', 2);          // magazine
      body(-1, -8, 9, 4, metal, 1);            // sight
      break;
    case 'shotgun':
      body(0, 3, 8, 11, '#6e3b1c', 2);         // grip
      body(-8, -3.5, 30, 7, '#8a4d24', 2);     // stock+body
      body(20, -3, 14, 6, metal, 2);           // barrel
      body(10, 1, 13, 5, '#4a2f16', 2);        // pump handle
      break;
    case 'magnum':
      body(-2, 2, 7, 12, '#54382a', 2);
      body(-4, -4, 20, 7, metalHi, 3);
      body(14, -2.5, 12, 4.5, metal, 1);
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.arc(4, 1, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'sniper':
      body(2, 3, 7, 12, '#3d4a36', 2);
      body(-12, -3.5, 40, 7, '#506246', 2);
      body(26, -2.5, 18, 4.5, metal, 1);
      ctx.fillStyle = '#2c2733';
      ctx.beginPath(); ctx.arc(8, -8, 4, 0, TAU); ctx.fill(); ctx.stroke();  // scope
      body(-1, -9, 18, 3, metal, 1);
      break;
    case 'minigun':
      body(0, 3, 8, 12, dark, 2);
      body(-8, -7, 22, 15, '#494e59', 4);
      // triple barrels
      body(12, -6, 26, 3.6, metal, 1.5);
      body(12, -1.5, 28, 3.6, metalHi, 1.5);
      body(12, 3, 26, 3.6, metal, 1.5);
      break;
    case 'rocket':
      body(0, 4, 8, 11, dark, 2);
      body(-14, -6, 50, 13, '#4f6e4f', 4);     // tube
      body(34, -7.5, 8, 16, '#3d543d', 2);     // muzzle ring
      body(-18, -7.5, 7, 16, '#3d543d', 2);    // rear ring
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.moveTo(42, -5); ctx.lineTo(50, 0.5); ctx.lineTo(42, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();                // visible rocket nose
      break;
    case 'flame':
      body(0, 3, 8, 12, dark, 2);
      body(-8, -5, 28, 10, '#b3502d', 3);      // tank-ish body
      body(18, -2.5, 16, 5, metal, 1);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(34, 0, 3.4, 0, TAU); ctx.fill(); ctx.stroke(); // pilot light
      body(-6, -10, 10, 6, '#8c3c20', 2);
      break;
  }
  ctx.restore();
}

/* ============================================================
   Bullet
   ============================================================ */
class Bullet {
  constructor(owner, x, y, dir, weapon, kbMul) {
    const w = WEAPONS[weapon];
    this.owner = owner;
    this.weaponId = weapon;
    this.x = x; this.y = y;
    this.prevX = x; this.prevY = y;
    const spreadRad = (w.spread * Math.PI / 180);
    const ang = rand(-spreadRad, spreadRad);
    const speed = w.speed * rand(0.95, 1.05);
    this.vx = Math.cos(ang) * speed * dir;
    this.vy = Math.sin(ang) * speed;
    this.kb = w.kb * kbMul;
    this.r = w.bulletR * (kbMul > 1 ? 1.4 : 1);
    this.color = w.color;
    this.dead = false;
    this.age = 0;
    this.isFlame = !!w.isFlame;
    this.explosive = w.explosive || null;
    this.life = w.isFlame ? w.flameLife * rand(0.8, 1.2) : 2.2;
    this.maxDist = (!w.isFlame && w.range) || Infinity;
    this.startX = x;
    if (this.isFlame) {
      this.vy += rand(-60, 60);
      this.vx += owner ? owner.vx * 0.4 : 0;
    }
    if (this.explosive) { this.vy = 0; }
  }

  update(dt, game) {
    this.age += dt;
    this.prevX = this.x; this.prevY = this.y;
    if (this.isFlame) {
      this.vx *= Math.pow(0.93, dt * 60);
      this.vy -= 120 * dt; // flames rise
      this.r += 14 * dt;
    }
    if (this.explosive) {
      this.vy = Math.sin(this.age * 14) * 26; // rocket wobble
      if (chance(0.8)) game.fx.smoke(this.x - sign(this.vx) * 12, this.y, 1, { size: 6, life: 0.55, alpha: 0.5 });
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.age > this.life) {
      if (this.explosive) game.explode(this.x, this.y, this.explosive.radius, this.explosive.impulse, this.owner);
      this.dead = true;
      return;
    }
    if (Math.abs(this.x - this.startX) > this.maxDist) { this.dead = true; return; }
    if (this.x < -80 || this.x > GAME_W + 80 || this.y < -300 || this.y > GAME_H + 120) { this.dead = true; return; }

    // platforms block bullets
    for (const p of game.level.platforms) {
      const t = segVsRect(this.prevX, this.prevY, this.x, this.y, p.x, p.y, p.w, p.h);
      if (t >= 0) {
        const hx = this.prevX + (this.x - this.prevX) * t;
        const hy = this.prevY + (this.y - this.prevY) * t;
        if (this.explosive) {
          game.explode(hx, hy, this.explosive.radius, this.explosive.impulse, this.owner);
        } else if (!this.isFlame) {
          game.fx.dust(hx, hy, 3, -sign(this.vx));
          game.fx.sparks(hx, hy, 3, this.color, 220, 0.2);
        } else {
          game.fx.smoke(hx, hy, 1, { size: 5, life: 0.4 });
        }
        this.dead = true;
        return;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    if (this.isFlame) {
      const t = this.age / this.life;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 * (1 - t);
      const r = Math.max(1, this.r);
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(0.45, t < 0.4 ? '#ffb13d' : '#d65a2a');
      g.addColorStop(1, 'rgba(120,60,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    if (this.explosive) {
      const a = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(a);
      // exhaust glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(-14, 0, 0, -14, 0, 16);
      g.addColorStop(0, 'rgba(255,200,90,0.9)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(-14, 0, 16, 0, TAU); ctx.fill();
      ctx.restore();
      // body
      ctx.fillStyle = '#cfd4dc'; ctx.strokeStyle = '#2c2733'; ctx.lineWidth = 2;
      rr(ctx, -12, -4, 20, 8, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(16, 0); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-17, -7); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(-17, 7); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    // tracer with glow
    const a = Math.atan2(this.vy, this.vx);
    const lenScale = Math.min(1, this.age * 18);
    const L = 16 * lenScale + this.r * 2;
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 2.2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffbe8';
    rr(ctx, -L, -this.r, L + this.r, this.r * 2, this.r);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================================================
   Grenade — bounces, flashes faster as the fuse runs out.
   ============================================================ */
class Grenade {
  constructor(owner, x, y, dir) {
    this.owner = owner;
    this.x = x; this.y = y;
    this.prevY = y;
    this.vx = dir * 380 + owner.vx * 0.35;
    this.vy = -480;
    this.r = 7;
    this.fuse = 2.1;
    this.age = 0;
    this.rot = 0;
    this.dead = false;
    this.kbMul = owner.boosts.power > 0 ? 1.5 : 1;
  }

  update(dt, game) {
    this.age += dt;
    this.fuse -= dt;
    this.prevY = this.y;
    this.vy += 1900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vx * 0.012 * dt * 60;

    // bounce on platforms (top surface only)
    for (const p of game.level.platforms) {
      if (this.vy > 0 &&
          this.prevY + this.r <= p.y + 6 && this.y + this.r >= p.y &&
          this.x > p.x - 2 && this.x < p.x + p.w + 2) {
        this.y = p.y - this.r;
        this.vy *= -0.45;
        this.vx *= 0.75;
        if (Math.abs(this.vy) > 60) Sound.play('bounce', { vol: 0.7 });
        if (Math.abs(this.vy) < 40) this.vy = 0;
      }
    }
    if (this.fuse <= 0) {
      game.explode(this.x, this.y, 140, 700 * this.kbMul, this.owner);
      this.dead = true;
    }
    if (this.y > GAME_H + 200) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    // blink red as fuse runs out
    const blink = this.fuse < 0.8 && Math.sin(this.age * (this.fuse < 0.35 ? 55 : 25)) > 0;
    ctx.fillStyle = blink ? '#ff5d73' : '#3f5d3f';
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = blink ? '#ffd9de' : '#5d815d';
    ctx.beginPath(); ctx.arc(-2, -2, this.r * 0.4, 0, TAU); ctx.fill();
    // cap + pin
    ctx.fillStyle = '#8d99ae';
    rr(ctx, -3, -this.r - 4, 6, 5, 1.5); ctx.fill(); ctx.stroke();
    ctx.restore();
    // spark on fuse
    if (this.fuse < 1.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(this.x + Math.sin(this.rot) * 3, this.y - this.r - 5, 2.4 + Math.random() * 1.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ============================================================
   Crate — parachutes in, lands on a platform, holds a mystery
   weapon or powerup. Expires (blinking) if nobody grabs it.
   ============================================================ */
class Crate {
  constructor(x, content) {
    this.x = x;
    this.y = -60;
    this.vy = 0;
    this.size = 34;
    this.landed = false;
    this.content = content;   // {kind:'weapon'|'powerup', id}
    this.age = 0;
    this.lifeAfterLand = 14;
    this.landTime = 0;
    this.dead = false;
    this.sway = rand(0, TAU);
  }

  static randomContent() {
    if (chance(0.62)) {
      return { kind: 'weapon', id: pick(WEAPON_DROPS) };
    }
    return { kind: 'powerup', id: weightedPick(POWERUPS, Object.keys(POWERUPS)) };
  }

  update(dt, game) {
    this.age += dt;
    if (!this.landed) {
      this.vy = 86;
      this.y += this.vy * dt;
      this.x += Math.sin(this.age * 2 + this.sway) * 14 * dt;
      const half = this.size / 2;
      for (const p of game.level.platforms) {
        if (this.y + half >= p.y && this.y + half <= p.y + p.h + 8 &&
            this.x > p.x + 4 && this.x < p.x + p.w - 4) {
          this.y = p.y - half;
          this.landed = true;
          this.landTime = this.age;
          this.platform = p;
          game.fx.dust(this.x, p.y, 6);
          Sound.play('crate', { vol: 0.8 });
        }
      }
      if (this.y > GAME_H + 80) this.dead = true;
    } else {
      if (this.platform && this.platform.move) {
        this.x += this.platform.dxThisFrame || 0;
      }
      if (this.age - this.landTime > this.lifeAfterLand) {
        game.fx.smoke(this.x, this.y, 5, { size: 10 });
        this.dead = true;
      }
    }
  }

  draw(ctx, t) {
    const expiring = this.landed && (this.age - this.landTime > this.lifeAfterLand - 3);
    if (expiring && Math.sin(this.age * 14) > 0.2) return; // blink

    const s = this.size, half = s / 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (!this.landed) {
      const sway = Math.sin(this.age * 2 + this.sway) * 0.08;
      ctx.rotate(sway);
      // parachute
      ctx.save();
      ctx.strokeStyle = 'rgba(40,35,50,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half); ctx.lineTo(-20, -52);
      ctx.moveTo(half - 4, -half); ctx.lineTo(20, -52);
      ctx.moveTo(0, -half); ctx.lineTo(0, -54);
      ctx.stroke();
      const grad = ctx.createLinearGradient(-26, -78, 26, -50);
      grad.addColorStop(0, '#ff5d73');
      grad.addColorStop(1, '#e63946');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-26, -52);
      ctx.quadraticCurveTo(0, -88, 26, -52);
      ctx.quadraticCurveTo(13, -58, 0, -52);
      ctx.quadraticCurveTo(-13, -58, -26, -52);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // white stripes
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -55); ctx.quadraticCurveTo(-9, -74, 0, -77);
      ctx.moveTo(13, -55); ctx.quadraticCurveTo(9, -74, 0, -77);
      ctx.stroke();
    } else {
      const sq = Math.max(0, 1 - (this.age - this.landTime) * 6);
      ctx.scale(1 + sq * 0.18, 1 - sq * 0.18);
    }

    // crate body
    const wood = ctx.createLinearGradient(-half, -half, half, half);
    wood.addColorStop(0, '#c98e4f');
    wood.addColorStop(1, '#9c6a36');
    ctx.fillStyle = wood;
    ctx.strokeStyle = '#221d2b';
    ctx.lineWidth = 3;
    rr(ctx, -half, -half, s, s, 4);
    ctx.fill(); ctx.stroke();
    // planks
    ctx.strokeStyle = 'rgba(80,48,20,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-half + 5, -half + 3); ctx.lineTo(-half + 5, half - 3);
    ctx.moveTo(half - 5, -half + 3); ctx.lineTo(half - 5, half - 3);
    ctx.stroke();
    // glowing "?" badge
    const pulse = 0.75 + 0.25 * Math.sin(t * 4 + this.sway);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * pulse;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    g.addColorStop(0, '#ffd166');
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
    ctx.restore();
    drawText(ctx, '?', 0, 1, {
      size: 23, color: '#fff3c4', stroke: '#5d3a14',
      strokeWidth: 4, font: FONT_TITLE, weight: '400'
    });
    ctx.restore();
  }
}
