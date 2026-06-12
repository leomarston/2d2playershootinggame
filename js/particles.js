'use strict';
/* ============================================================
   RECOIL RUMBLE — particles.js
   One pooled system handles sparks, smoke, dust, shell casings,
   debris, rings, confetti, KO streaks and floating text.
   ============================================================ */

const MAX_PARTICLES = 900;

class ParticleSystem {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  clear() { this.list.length = 0; this.texts.length = 0; }

  add(p) {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    p.age = 0;
    this.list.push(p);
  }

  /* ---------- spawn helpers ---------- */

  sparks(x, y, count, color, speed = 360, life = 0.35) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.add({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(life * 0.6, life), color,
        size: rand(1.5, 3.5), grav: 900, drag: 0.92
      });
    }
  }

  hitSparks(x, y, dir, color) {
    for (let i = 0; i < 7; i++) {
      const a = Math.atan2(rand(-0.6, 0.6), -dir);
      const s = rand(150, 480);
      this.add({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: rand(0.15, 0.32), color,
        size: rand(1.5, 3), grav: 800, drag: 0.9
      });
    }
  }

  smoke(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'smoke', x: x + rand(-6, 6), y: y + rand(-6, 6),
        vx: rand(-40, 40) + (opts.vx || 0), vy: rand(-70, -20) + (opts.vy || 0),
        life: rand(0.5, opts.life || 1.1),
        size: rand(6, opts.size || 14),
        color: opts.color || '#8b8b96', grav: -40, drag: 0.96,
        alpha: opts.alpha || 0.45
      });
    }
  }

  dust(x, y, count, dir = 0) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'dust', x: x + rand(-10, 10), y,
        vx: rand(-70, 70) + dir * rand(20, 90), vy: rand(-90, -20),
        life: rand(0.25, 0.55), size: rand(3, 7),
        color: '#cdc3ae', grav: 300, drag: 0.93, alpha: 0.55
      });
    }
  }

  casing(x, y, dir) {
    this.add({
      type: 'casing', x, y,
      vx: -dir * rand(80, 190), vy: rand(-260, -150),
      life: rand(0.8, 1.3), size: rand(2.5, 3.5),
      color: '#e8b34b', grav: 1500, drag: 0.99,
      rot: rand(0, TAU), vr: rand(-14, 14)
    });
  }

  debris(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'debris', x, y,
        vx: rand(-280, 280), vy: rand(-420, -80),
        life: rand(0.5, 1.1), size: rand(2.5, 6),
        color: chance(0.5) ? color : shade(color, 0.7),
        grav: 1300, drag: 0.99, rot: rand(0, TAU), vr: rand(-10, 10)
      });
    }
  }

  ring(x, y, color, maxR = 80, life = 0.35, width = 5) {
    this.add({ type: 'ring', x, y, vx: 0, vy: 0, life, maxR, width, color, grav: 0, drag: 1 });
  }

  flash(x, y, color, maxR = 40, life = 0.12) {
    this.add({ type: 'flash', x, y, vx: 0, vy: 0, life, maxR, color, grav: 0, drag: 1 });
  }

  explosion(x, y, radius) {
    this.flash(x, y, '#fff7d6', radius * 0.9, 0.14);
    this.ring(x, y, '#ffd166', radius * 1.25, 0.4, 7);
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), r = rand(0, radius * 0.45);
      this.add({
        type: 'fireball', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: Math.cos(a) * rand(60, 280), vy: Math.sin(a) * rand(60, 280) - 70,
        life: rand(0.25, 0.6), size: rand(radius * 0.12, radius * 0.3),
        grav: -120, drag: 0.92
      });
    }
    this.sparks(x, y, 22, '#ffd166', 620, 0.55);
    this.smoke(x, y - 8, 10, { size: radius * 0.35, life: 1.4, alpha: 0.5, color: '#5a5560' });
  }

  jumpRing(x, y) {
    this.add({ type: 'jring', x, y, vx: 0, vy: 0, life: 0.28, maxR: 34, color: '#ffffff', grav: 0, drag: 1 });
  }

  confetti(x, y, count) {
    const colors = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388eb', '#ff9e40'];
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'confetti', x: x + rand(-30, 30), y,
        vx: rand(-260, 260), vy: rand(-560, -220),
        life: rand(1.4, 2.6), size: rand(4, 7),
        color: pick(colors), grav: 620, drag: 0.985,
        rot: rand(0, TAU), vr: rand(-12, 12)
      });
    }
  }

  koStreak(x, y, vx, vy, color) {
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      this.add({
        type: 'streak', x: x - vx * t * 0.06, y: y - vy * t * 0.06,
        vx: vx * 0.12, vy: vy * 0.12,
        life: 0.5 - t * 0.3, size: 14 * (1 - t * 0.7),
        color, grav: 0, drag: 0.9
      });
    }
    this.flash(x, y, color, 70, 0.2);
    this.sparks(x, y, 18, color, 500, 0.5);
    this.add({ type: 'kostar', x, y, vx: 0, vy: 0, life: 0.45, maxR: 56, color: '#ffffff', grav: 0, drag: 1, rot: rand(0, TAU) });
  }

  muzzleSmoke(x, y, dir) {
    for (let i = 0; i < 3; i++) {
      this.add({
        type: 'smoke', x: x + rand(-2, 2), y: y + rand(-2, 2),
        vx: dir * rand(50, 130), vy: rand(-50, -10),
        life: rand(0.25, 0.5), size: rand(3, 7),
        color: '#9d9daa', grav: -60, drag: 0.92, alpha: 0.4
      });
    }
  }

  text(x, y, str, color, opts = {}) {
    this.texts.push({
      x, y, str, color, age: 0,
      life: opts.life || 1.1,
      size: opts.size || 20,
      vy: opts.vy !== undefined ? opts.vy : -55,
      stroke: opts.stroke || '#221d2b'
    });
  }

  /* ---------- update ---------- */
  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      const drag = Math.pow(p.drag || 1, dt * 60);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      // casings bounce on a virtual floor near where they spawned? keep simple: none
    }
    const texts = this.texts;
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.age += dt;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.94, dt * 60);
      if (t.age >= t.life) texts.splice(i, 1);
    }
  }

  /* ---------- draw ---------- */
  draw(ctx) {
    for (const p of this.list) {
      const t = p.age / p.life;
      const fade = 1 - t;
      switch (p.type) {
        case 'spark': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * fade + 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'smoke': case 'dust': {
          ctx.save();
          ctx.globalAlpha = (p.alpha || 0.4) * fade;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.9), 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'fireball': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.9;
          const r = Math.max(0.5, p.size * (1 - t * 0.6));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, '#fff3c4');
          g.addColorStop(0.4, '#ffb13d');
          g.addColorStop(1, 'rgba(214,64,25,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'casing': case 'debris': case 'confetti': {
          ctx.save();
          ctx.globalAlpha = p.type === 'confetti' ? Math.min(1, fade * 2) : fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot || 0);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        }
        case 'ring': case 'jring': {
          ctx.save();
          ctx.globalAlpha = fade * (p.type === 'jring' ? 0.6 : 0.85);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = (p.width || 3) * fade + 1;
          ctx.beginPath();
          const r = p.maxR * easeOutCubic(t);
          if (p.type === 'jring') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(1, 0.35);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.arc(p.x, p.y, r, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'flash': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          const r = Math.max(1, p.maxR * (0.5 + t * 0.5));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'streak': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * fade), 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'kostar': {
          // cartoon impact star
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + t * 2);
          const R = p.maxR * easeOutBack(Math.min(1, t * 1.6));
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#221d2b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          const spikes = 8;
          for (let i = 0; i < spikes * 2; i++) {
            const rr2 = i % 2 === 0 ? R : R * 0.45;
            const a = (i / (spikes * 2)) * TAU;
            const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }
    // floating text
    for (const t of this.texts) {
      const fade = t.age < 0.1 ? t.age / 0.1 : (1 - Math.max(0, (t.age - t.life * 0.6) / (t.life * 0.4)));
      ctx.save();
      ctx.globalAlpha = clamp(fade, 0, 1);
      const pop = 1 + 0.4 * Math.max(0, 1 - t.age / 0.18);
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      drawText(ctx, t.str, 0, 0, {
        size: t.size, color: t.color, stroke: t.stroke,
        strokeWidth: t.size * 0.22, font: FONT_TITLE, weight: '400'
      });
      ctx.restore();
    }
  }
}
