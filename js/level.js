'use strict';
/* ============================================================
   RECOIL RUMBLE — level.js
   Map data + themed background/platform rendering.
   Static parts of each background are rendered once into an
   offscreen canvas; animated layers draw on top each frame.
   ============================================================ */

const GAME_W = 1280;
const GAME_H = 720;

const LEVELS = [
  {
    id: 'sanctum',
    name: 'SKY SANCTUM',
    theme: 'sunset',
    surface: 'grass',
    platforms: [
      { x: 390, y: 560, w: 500, h: 30 },
      { x: 110, y: 450, w: 215, h: 26 },
      { x: 955, y: 450, w: 215, h: 26 },
      { x: 295, y: 330, w: 215, h: 26 },
      { x: 770, y: 330, w: 215, h: 26 },
      { x: 553, y: 215, w: 174, h: 26 }
    ],
    spawns: [
      { x: 480, y: 540 }, { x: 800, y: 540 },
      { x: 215, y: 430 }, { x: 1062, y: 430 }
    ]
  },
  {
    id: 'frost',
    name: 'FROST PEAK',
    theme: 'frost',
    surface: 'ice',
    platforms: [
      { x: 420, y: 580, w: 440, h: 30 },
      { x: 90, y: 460, w: 230, h: 26 },
      { x: 960, y: 460, w: 230, h: 26 },
      { x: 510, y: 350, w: 260, h: 26, move: { axis: 'x', range: 180, speed: 0.55 } },
      { x: 230, y: 240, w: 190, h: 26 },
      { x: 860, y: 240, w: 190, h: 26 }
    ],
    spawns: [
      { x: 520, y: 560 }, { x: 760, y: 560 },
      { x: 200, y: 440 }, { x: 1080, y: 440 }
    ]
  },
  {
    id: 'ruins',
    name: 'TEMPLE RUINS',
    theme: 'jungle',
    surface: 'stone',
    platforms: [
      { x: 80, y: 590, w: 380, h: 30 },
      { x: 820, y: 590, w: 380, h: 30 },
      { x: 490, y: 480, w: 300, h: 28 },
      { x: 180, y: 360, w: 220, h: 26 },
      { x: 880, y: 360, w: 220, h: 26 },
      { x: 540, y: 250, w: 200, h: 26 },
      { x: 60, y: 180, w: 130, h: 24 },
      { x: 1090, y: 180, w: 130, h: 24 }
    ],
    spawns: [
      { x: 250, y: 570 }, { x: 1030, y: 570 },
      { x: 640, y: 460 }, { x: 640, y: 230 }
    ]
  }
];

class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.theme = def.theme;
    // deep-copy platforms so moving ones can mutate
    this.platforms = def.platforms.map(p => Object.assign({}, p, {
      surface: p.surface || def.surface,
      baseX: p.x, baseY: p.y, dxThisFrame: 0, dyThisFrame: 0,
      seed: Math.floor(Math.random() * 1e9)
    }));
    this.spawns = def.spawns;
    this.t = 0;
    this.bgCache = null;
    this.clouds = [];
    this.ambient = [];   // snow / fireflies / birds
    const rng = mulberry32(42 + LEVELS.indexOf(def));
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: rng() * GAME_W, y: 40 + rng() * 320,
        scale: 0.5 + rng() * 1.1, speed: 6 + rng() * 18,
        layer: i < 3 ? 0 : 1
      });
    }
    const ambientCount = this.theme === 'frost' ? 80 : (this.theme === 'jungle' ? 26 : 5);
    for (let i = 0; i < ambientCount; i++) {
      this.ambient.push({
        x: rng() * GAME_W, y: rng() * GAME_H,
        s: 1 + rng() * 2.4, ph: rng() * TAU, sp: 20 + rng() * 50
      });
    }
  }

  update(dt) {
    this.t += dt;
    for (const p of this.platforms) {
      if (p.move) {
        const prevX = p.x, prevY = p.y;
        const off = Math.sin(this.t * p.move.speed * TAU) * p.move.range;
        if (p.move.axis === 'x') p.x = p.baseX + off;
        else p.y = p.baseY + off;
        p.dxThisFrame = p.x - prevX;
        p.dyThisFrame = p.y - prevY;
      }
    }
    for (const c of this.clouds) {
      c.x += c.speed * dt * (c.layer === 0 ? 0.5 : 1);
      if (c.x > GAME_W + 220) c.x = -220;
    }
    if (this.theme === 'frost') {
      for (const a of this.ambient) {
        a.y += a.sp * dt;
        a.x += Math.sin(this.t * 1.3 + a.ph) * 18 * dt;
        if (a.y > GAME_H + 8) { a.y = -8; a.x = Math.random() * GAME_W; }
      }
    }
  }

  /* ====================== BACKGROUNDS ====================== */

  buildCache() {
    const c = document.createElement('canvas');
    c.width = GAME_W; c.height = GAME_H;
    const ctx = c.getContext('2d');
    const rng = mulberry32(1337);
    if (this.theme === 'sunset') this.paintSunset(ctx, rng);
    else if (this.theme === 'frost') this.paintFrost(ctx, rng);
    else this.paintJungle(ctx, rng);
    this.bgCache = c;
  }

  paintSunset(ctx, rng) {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_H);
    sky.addColorStop(0, '#241a4f');
    sky.addColorStop(0.38, '#6b3074');
    sky.addColorStop(0.68, '#c8527a');
    sky.addColorStop(1, '#ff9a5c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // stars up top
    for (let i = 0; i < 70; i++) {
      const y = rng() * 260;
      ctx.globalAlpha = (1 - y / 280) * (0.3 + rng() * 0.6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(rng() * GAME_W, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // sun with layered glow
    const sunX = 640, sunY = 560, sunR = 110;
    for (let i = 4; i >= 0; i--) {
      ctx.globalAlpha = 0.1 + (4 - i) * 0.04;
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR + i * 55, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunR);
    sg.addColorStop(0, '#fff4d6');
    sg.addColorStop(1, '#ffb86b');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, TAU); ctx.fill();
    // distant island silhouettes (two depths)
    const isl = (x, y, w, color, treeCount) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x - w / 2 + 14, y - 16, x, y - 18);
      ctx.quadraticCurveTo(x + w / 2 - 14, y - 16, x + w / 2, y);
      ctx.quadraticCurveTo(x + w / 3, y + w * 0.16, x, y + w * 0.2);
      ctx.quadraticCurveTo(x - w / 3, y + w * 0.16, x - w / 2, y);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < treeCount; i++) {
        const tx = x - w / 2 + 20 + rng() * (w - 40);
        ctx.beginPath();
        ctx.moveTo(tx - 7, y - 16);
        ctx.lineTo(tx, y - 34 - rng() * 12);
        ctx.lineTo(tx + 7, y - 16);
        ctx.closePath();
        ctx.fill();
      }
    };
    ctx.globalAlpha = 0.5;
    isl(190, 330, 150, '#3d2a63', 2);
    isl(1110, 280, 130, '#3d2a63', 2);
    isl(870, 580, 200, '#3d2a63', 3);
    ctx.globalAlpha = 0.75;
    isl(330, 620, 230, '#552d5e', 3);
    isl(1010, 150, 110, '#552d5e', 1);
    ctx.globalAlpha = 1;
    // birds
    ctx.strokeStyle = 'rgba(40,25,60,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const bx = 100 + rng() * 1100, by = 90 + rng() * 200, s = 4 + rng() * 5;
      ctx.beginPath();
      ctx.moveTo(bx - s, by);
      ctx.quadraticCurveTo(bx - s / 2, by - s * 0.8, bx, by);
      ctx.quadraticCurveTo(bx + s / 2, by - s * 0.8, bx + s, by);
      ctx.stroke();
    }
  }

  paintFrost(ctx, rng) {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_H);
    sky.addColorStop(0, '#0c1a3a');
    sky.addColorStop(0.5, '#27496b');
    sky.addColorStop(1, '#7fa8c9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 110; i++) {
      const y = rng() * 380;
      ctx.globalAlpha = (1 - y / 400) * (0.3 + rng() * 0.7);
      ctx.fillStyle = '#eaf6ff';
      ctx.fillRect(rng() * GAME_W, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // aurora ribbons
    for (let band = 0; band < 3; band++) {
      ctx.save();
      ctx.globalAlpha = 0.16 - band * 0.035;
      ctx.fillStyle = band === 1 ? '#7af0c5' : '#52d8a8';
      ctx.beginPath();
      const baseY = 110 + band * 46;
      ctx.moveTo(-20, baseY);
      for (let x = 0; x <= GAME_W + 20; x += 60) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.008 + band * 1.8) * 42);
      }
      for (let x = GAME_W + 20; x >= -20; x -= 60) {
        ctx.lineTo(x, baseY + 95 + Math.sin(x * 0.007 + band) * 30);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // moon
    const mg = ctx.createRadialGradient(1050, 130, 5, 1050, 130, 60);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(1, '#bcd8ef');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(1050, 130, 46, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.arc(1050, 130, 78, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // mountain layers
    const ridge = (baseY, amp, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, GAME_H);
      let y = baseY;
      for (let x = 0; x <= GAME_W; x += 16) {
        y = baseY + Math.sin(x * 0.004 + baseY) * amp + (rng() - 0.5) * 14;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(GAME_W, GAME_H);
      ctx.closePath();
      ctx.fill();
      // snow caps: redraw top edge lighter
    };
    ridge(430, 90, '#1d3450');
    ridge(530, 70, '#2b4a6b');
    ridge(620, 50, '#3c6285');
  }

  paintJungle(ctx, rng) {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_H);
    sky.addColorStop(0, '#06131f');
    sky.addColorStop(0.55, '#0d2b33');
    sky.addColorStop(1, '#1a4a40');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 90; i++) {
      const y = rng() * 300;
      ctx.globalAlpha = (1 - y / 320) * (0.3 + rng() * 0.6);
      ctx.fillStyle = '#dff3ff';
      ctx.fillRect(rng() * GAME_W, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // big moon
    const mg = ctx.createRadialGradient(250, 150, 10, 250, 150, 90);
    mg.addColorStop(0, '#fdf6d8');
    mg.addColorStop(1, '#d6c98f');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(250, 150, 75, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.beginPath(); ctx.arc(250, 150, 120, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#b8a972';
    ctx.beginPath(); ctx.arc(230, 130, 14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(275, 170, 9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // jungle silhouette layers
    const canopy = (baseY, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, GAME_H);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= GAME_W; x += 40) {
        const h = baseY - rng() * 70;
        ctx.quadraticCurveTo(x + 10, h, x + 40, baseY - rng() * 40);
      }
      ctx.lineTo(GAME_W, GAME_H);
      ctx.closePath();
      ctx.fill();
      // a few palm-ish trunks
      for (let i = 0; i < 4; i++) {
        const tx = rng() * GAME_W;
        ctx.beginPath();
        ctx.moveTo(tx, GAME_H);
        ctx.quadraticCurveTo(tx + 18, baseY + 40, tx + 8, baseY - 60);
        ctx.lineTo(tx + 16, baseY - 58);
        ctx.quadraticCurveTo(tx + 30, baseY + 60, tx + 14, GAME_H);
        ctx.closePath();
        ctx.fill();
        for (let f = 0; f < 5; f++) {
          const a = -0.4 - f * 0.5;
          ctx.beginPath();
          ctx.moveTo(tx + 12, baseY - 58);
          ctx.quadraticCurveTo(tx + 12 + Math.cos(a) * 60, baseY - 58 + Math.sin(a) * 40,
            tx + 12 + Math.cos(a) * 95, baseY - 50 + Math.sin(a) * 30);
          ctx.lineWidth = 7;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
      }
    };
    canopy(420, '#0a2129');
    canopy(540, '#0e2e2c');
    // ruined ziggurat silhouette center-back
    ctx.fillStyle = '#123832';
    const zx = 640, zy = 640;
    for (let s = 0; s < 4; s++) {
      const w = 360 - s * 80, h = 46;
      ctx.fillRect(zx - w / 2, zy - (s + 1) * h, w, h);
    }
  }

  drawBackground(ctx) {
    if (!this.bgCache) this.buildCache();
    ctx.drawImage(this.bgCache, 0, 0);

    /* animated layers */
    if (this.theme !== 'jungle') {
      // drifting clouds
      for (const c of this.clouds) {
        ctx.save();
        ctx.translate(c.x, c.y + Math.sin(this.t * 0.5 + c.x) * 3);
        ctx.scale(c.scale, c.scale);
        ctx.globalAlpha = c.layer === 0 ? 0.35 : 0.55;
        ctx.fillStyle = this.theme === 'sunset' ? '#ffd9e8' : '#dceefc';
        const blob = (ox, oy, r) => { ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill(); };
        blob(0, 0, 26); blob(28, -8, 20); blob(-30, -4, 18); blob(56, 2, 15); blob(-54, 4, 13);
        rr(ctx, -62, 2, 128, 16, 8); ctx.fill();
        ctx.restore();
      }
    }
    if (this.theme === 'frost') {
      // snow
      ctx.save();
      ctx.fillStyle = '#eaf6ff';
      for (const a of this.ambient) {
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(a.ph);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (this.theme === 'jungle') {
      // fireflies
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const a of this.ambient) {
        const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 1.8 + a.ph * 3));
        const fx = a.x + Math.sin(this.t * 0.6 + a.ph) * 26;
        const fy = a.y + Math.cos(this.t * 0.43 + a.ph * 2) * 18;
        ctx.globalAlpha = glow * 0.7;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 6);
        g.addColorStop(0, '#e8ffa8');
        g.addColorStop(1, 'rgba(180,255,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fx, fy, 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ====================== PLATFORMS ====================== */

  drawPlatforms(ctx) {
    for (const p of this.platforms) this.drawPlatform(ctx, p);
  }

  drawPlatform(ctx, p) {
    const rng = mulberry32(p.seed);
    ctx.save();
    ctx.translate(p.x, p.y);
    const w = p.w, h = p.h;
    const bodyDepth = h + 26;

    if (p.surface === 'grass') {
      // dirt body (island belly)
      const dirt = ctx.createLinearGradient(0, 0, 0, bodyDepth);
      dirt.addColorStop(0, '#8a5a34');
      dirt.addColorStop(1, '#5d3a21');
      ctx.fillStyle = dirt;
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, 6);
      ctx.lineTo(w - 2, 6);
      ctx.quadraticCurveTo(w + 6, bodyDepth * 0.5, w * 0.78, bodyDepth * 0.82);
      ctx.quadraticCurveTo(w * 0.5, bodyDepth * 1.12, w * 0.22, bodyDepth * 0.82);
      ctx.quadraticCurveTo(-6, bodyDepth * 0.5, 2, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // rocks in the dirt
      ctx.fillStyle = 'rgba(70,45,28,0.8)';
      for (let i = 0; i < w / 60; i++) {
        const rx = 18 + rng() * (w - 36), ry = 14 + rng() * (bodyDepth * 0.5);
        ctx.beginPath(); ctx.ellipse(rx, ry, 5 + rng() * 5, 4 + rng() * 3, rng(), 0, TAU); ctx.fill();
      }
      // grass cap
      const grass = ctx.createLinearGradient(0, -6, 0, 14);
      grass.addColorStop(0, '#7ec850');
      grass.addColorStop(1, '#4e9134');
      ctx.fillStyle = grass;
      rr(ctx, -4, -6, w + 8, 16, 8);
      ctx.fill(); ctx.stroke();
      // grass highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rr(ctx, 2, -4, w - 4, 4, 2.5);
      ctx.fill();
      // blades on the lip
      ctx.fillStyle = '#69b542';
      for (let i = 0; i < w / 22; i++) {
        const gx = 6 + rng() * (w - 12);
        ctx.beginPath();
        ctx.moveTo(gx - 3, -5);
        ctx.quadraticCurveTo(gx - 1 + rng() * 2, -14 - rng() * 5, gx + (rng() - 0.5) * 4, -15 - rng() * 4);
        ctx.quadraticCurveTo(gx + 2, -9, gx + 3, -5);
        ctx.closePath();
        ctx.fill();
      }
      // tiny flowers
      for (let i = 0; i < w / 140 + 1; i++) {
        const fx2 = 12 + rng() * (w - 24);
        ctx.fillStyle = pick(['#ffd166', '#ff5d73', '#fff']);
        ctx.beginPath(); ctx.arc(fx2, -10, 2.6, 0, TAU); ctx.fill();
      }
      // hanging vines
      ctx.strokeStyle = '#4e9134';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < w / 110; i++) {
        const vx = 14 + rng() * (w - 28);
        const vl = 14 + rng() * 22;
        ctx.beginPath();
        ctx.moveTo(vx, 9);
        ctx.quadraticCurveTo(vx + 5, 9 + vl * 0.6, vx - 2, 9 + vl);
        ctx.stroke();
      }
    } else if (p.surface === 'ice') {
      const body = ctx.createLinearGradient(0, 0, 0, bodyDepth);
      body.addColorStop(0, '#9fd0e8');
      body.addColorStop(1, '#5b8fb8');
      ctx.fillStyle = body;
      ctx.strokeStyle = '#22384f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.lineTo(w - 2, 4);
      ctx.quadraticCurveTo(w + 4, bodyDepth * 0.5, w * 0.8, bodyDepth * 0.8);
      ctx.quadraticCurveTo(w * 0.5, bodyDepth * 1.05, w * 0.2, bodyDepth * 0.8);
      ctx.quadraticCurveTo(-4, bodyDepth * 0.5, 2, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // icicles
      ctx.fillStyle = '#bfe3f5';
      for (let i = 0; i < w / 46; i++) {
        const ix = 14 + rng() * (w - 28);
        const il = 10 + rng() * 18;
        ctx.beginPath();
        ctx.moveTo(ix - 4, bodyDepth * 0.55);
        ctx.lineTo(ix, bodyDepth * 0.55 + il);
        ctx.lineTo(ix + 4, bodyDepth * 0.55);
        ctx.closePath();
        ctx.fill();
      }
      // snow cap
      const snow = ctx.createLinearGradient(0, -6, 0, 14);
      snow.addColorStop(0, '#ffffff');
      snow.addColorStop(1, '#cfe6f5');
      ctx.fillStyle = snow;
      rr(ctx, -4, -7, w + 8, 17, 9);
      ctx.fill(); ctx.stroke();
      // glints
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < w / 70; i++) {
        const gx = 12 + rng() * (w - 24);
        ctx.save();
        ctx.translate(gx, 0);
        ctx.rotate(rng() * 0.6);
        ctx.fillRect(-4, -1, 8, 2);
        ctx.fillRect(-1, -4, 2, 8);
        ctx.restore();
      }
    } else { // stone (mossy temple blocks)
      const body = ctx.createLinearGradient(0, 0, 0, bodyDepth);
      body.addColorStop(0, '#7d8a83');
      body.addColorStop(1, '#4a5751');
      ctx.fillStyle = body;
      ctx.strokeStyle = '#1c2622';
      ctx.lineWidth = 3;
      rr(ctx, 0, -4, w, bodyDepth, 6);
      ctx.fill(); ctx.stroke();
      // block seams
      ctx.strokeStyle = 'rgba(28,38,34,0.55)';
      ctx.lineWidth = 2;
      const cols = Math.max(2, Math.round(w / 70));
      for (let i = 1; i < cols; i++) {
        const sx2 = (w / cols) * i + (rng() - 0.5) * 10;
        ctx.beginPath(); ctx.moveTo(sx2, -2); ctx.lineTo(sx2, bodyDepth - 6); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(2, bodyDepth * 0.45); ctx.lineTo(w - 2, bodyDepth * 0.45); ctx.stroke();
      // moss cap
      ctx.fillStyle = '#5e8c4a';
      rr(ctx, -3, -6, w + 6, 12, 6);
      ctx.fill();
      ctx.strokeStyle = '#1c2622';
      ctx.stroke();
      // moss drips
      ctx.fillStyle = '#5e8c4a';
      for (let i = 0; i < w / 50; i++) {
        const mx = 10 + rng() * (w - 20);
        ctx.beginPath();
        ctx.ellipse(mx, 8 + rng() * 6, 5 + rng() * 4, 7 + rng() * 6, 0, 0, TAU);
        ctx.fill();
      }
      // glowing torches on wide platforms
      if (w > 280) {
        for (const tx of [26, w - 26]) {
          ctx.fillStyle = '#5b4632';
          rr(ctx, tx - 3, -26, 6, 22, 2);
          ctx.fill(); ctx.stroke();
          const flick = 0.8 + 0.2 * Math.sin(this.t * 11 + tx);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(tx, -32, 1, tx, -32, 30 * flick);
          g.addColorStop(0, 'rgba(255,200,90,0.9)');
          g.addColorStop(1, 'rgba(255,120,30,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(tx, -32, 30 * flick, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#ffb13d';
          ctx.beginPath();
          ctx.ellipse(tx, -32, 4.5, 7 * flick, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.42, GAME_W / 2, GAME_H / 2, GAME_H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,20,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }
}
