'use strict';
/* ============================================================
   RECOIL RUMBLE — game.js
   Match orchestration, collisions, explosions, HUD, menus.
   The same Game instance also runs the AI-vs-AI attract-mode
   demo behind the main menu.
   ============================================================ */

const SCREEN = { MENU: 'menu', CONTROLS: 'controls', GAME: 'game' };

class Game {
  constructor() {
    this.fx = new ParticleSystem();
    this.options = {
      mode: '1p',          // '1p' | '2p'
      mapIndex: 0,
      lives: 5,
      difficulty: 'normal',
      extraBots: 0
    };
    this.screen = SCREEN.MENU;
    this.menu = new Menu(this);
    this.paused = false;
    this.timeScale = 1;
    this.shakeTrauma = 0;
    this.flashAlpha = 0;
    this.t = 0;
    this.startDemo();
  }

  /* ---------------- match setup ---------------- */

  buildPlayers(demo) {
    const players = [];
    const o = this.options;
    if (demo) {
      players.push(new Player(0, 'ai'));
      players.push(new Player(1, 'ai'));
      players.push(new Player(2, 'ai'));
    } else {
      players.push(new Player(0, 'human', CONTROLS.p1));
      if (o.mode === '2p') players.push(new Player(1, 'human', CONTROLS.p2));
      else players.push(new Player(1, 'ai'));
      for (let i = 0; i < o.extraBots; i++) players.push(new Player(2 + i, 'ai'));
    }
    for (const p of players) {
      if (p.controller === 'ai') {
        p.ai = new AIController(p, demo ? 'normal' : o.difficulty);
        p.name = demo ? 'DEMO' : 'CPU';
      }
      p.lives = demo ? 99 : o.lives;
    }
    return players;
  }

  startDemo() {
    this.demo = true;
    this.level = new Level(LEVELS[randInt(0, LEVELS.length - 1)]);
    this.players = this.buildPlayers(true);
    this.resetArena();
    this.phase = 'play';
    this.phaseT = 0;
  }

  startMatch() {
    this.demo = false;
    this.level = new Level(LEVELS[this.options.mapIndex]);
    this.players = this.buildPlayers(false);
    this.resetArena();
    this.phase = 'intro';
    this.phaseT = 0;
    this.countPlayed = -1;
    this.screen = SCREEN.GAME;
    this.paused = false;
    this.winner = null;
  }

  resetArena() {
    this.bullets = [];
    this.grenades = [];
    this.crates = [];
    this.fx.clear();
    this.crateTimer = rand(3, 5);
    this.timeScale = 1;
    this.shakeTrauma = 0;
    this.flashAlpha = 0;
    const spawns = this.level.spawns;
    this.players.forEach((p, i) => {
      const sp = spawns[i % spawns.length];
      p.respawn(sp.x, sp.y - 2, true);
      p.eliminated = false;
      p.resetStats();
      p.lives = this.demo ? 99 : this.options.lives;
      p.invuln = this.demo ? 0 : 1.0;
      p.vy = 0; p.onGround = false;
    });
  }

  pickSpawn(forPlayer) {
    let best = this.level.spawns[0], bestScore = -1;
    for (const sp of this.level.spawns) {
      let minD = Infinity;
      for (const o of this.players) {
        if (o === forPlayer || o.dead || o.eliminated) continue;
        minD = Math.min(minD, dist(sp.x, sp.y, o.x, o.y));
      }
      if (minD > bestScore) { bestScore = minD; best = sp; }
    }
    return { x: best.x, y: -40 };
  }

  /* ---------------- effects helpers ---------------- */

  addShake(amount) { this.shakeTrauma = Math.min(1, this.shakeTrauma + amount / 24); }

  explode(x, y, radius, impulse, owner) {
    this.fx.explosion(x, y, radius);
    this.addShake(radius * 0.09);
    this.flashAlpha = Math.min(0.28, this.flashAlpha + 0.18);
    Sound.play('explosion', { vol: clamp(radius / 150, 0.5, 1) });
    for (const p of this.players) {
      if (p.dead) continue;
      const d = dist(x, y, p.x, p.cy);
      if (d < radius + p.w / 2) {
        const falloff = Math.pow(1 - clamp(d / (radius + p.w / 2), 0, 1), 0.6);
        const ang = Math.atan2(p.cy - y, p.x - x);
        const mag = impulse * falloff + 160;
        const hit = p.applyKnockback(Math.cos(ang) * mag, Math.sin(ang) * mag - impulse * 0.25 * falloff, owner);
        if (hit) this.fx.hitSparks(p.x, p.cy, sign(x - p.x), '#ffd166');
      }
    }
    // shove grenades around too
    for (const g of this.grenades) {
      const d = dist(x, y, g.x, g.y);
      if (d < radius && d > 1) {
        const ang = Math.atan2(g.y - y, g.x - x);
        g.vx += Math.cos(ang) * impulse * 0.7;
        g.vy += Math.sin(ang) * impulse * 0.7 - 120;
      }
    }
  }

  koPlayer(p) {
    if (p.dead) return;
    const exitX = clamp(p.x, 20, GAME_W - 20);
    const exitY = clamp(p.y, 30, GAME_H - 10);
    this.fx.koStreak(exitX, exitY, p.vx, p.vy, p.style.main);
    this.fx.text(exitX, exitY - 40, 'KO!', '#fff', { size: 34, life: 0.9 });
    this.addShake(7);
    Sound.play('ko');
    p.dead = true;
    p.falls++;
    p.lives--;
    p.respawnT = 1.6;
    if (p.lastHitBy && p.lastHitBy !== p) {
      p.lastHitBy.kills++;
      if (!this.demo) {
        this.fx.text(exitX, exitY - 70, p.lastHitBy.name + ' KO’d ' + p.name, p.lastHitBy.style.main, { size: 15, life: 1.3 });
      }
    }
    if (p.lives <= 0) {
      p.eliminated = true;
      if (!this.demo) this.fx.text(GAME_W / 2, 140, p.name + ' ELIMINATED!', p.style.main, { size: 26, life: 1.6 });
    }
    if (!this.demo) this.checkMatchEnd();
  }

  checkMatchEnd() {
    const alive = this.players.filter(p => !p.eliminated);
    if (alive.length <= 1 && this.phase !== 'over') {
      this.winner = alive[0] || null;
      this.phase = 'slowmo';
      this.phaseT = 0;
      this.timeScale = 0.3;
    }
  }

  /* ---------------- update ---------------- */

  update(rawDt) {
    this.t += rawDt;
    if (this.screen === SCREEN.MENU || this.screen === SCREEN.CONTROLS) {
      this.menu.update(rawDt);
      // demo match runs behind the menu
      this.updateWorld(rawDt);
      return;
    }
    if (this.paused) {
      if (Input.wasPressed(['KeyP', 'Escape'])) { this.paused = false; Sound.play('click'); }
      else if (Input.wasPressed('KeyQ')) { this.quitToMenu(); }
      return;
    }
    if (this.phase === 'play' || this.phase === 'slowmo') {
      if (Input.wasPressed(['KeyP', 'Escape'])) { this.paused = true; Sound.play('click'); return; }
    }

    this.phaseT += rawDt;
    switch (this.phase) {
      case 'intro': {
        const count = 3 - Math.floor(this.phaseT);
        if (count !== this.countPlayed && count > 0) {
          this.countPlayed = count;
          Sound.play('count');
        }
        if (this.phaseT >= 3) {
          this.phase = 'play';
          this.phaseT = 0;
          Sound.play('fight');
        }
        break;
      }
      case 'slowmo':
        this.timeScale = lerp(this.timeScale, 0.25, rawDt * 4);
        if (this.phaseT > 1.1) {
          this.phase = 'over';
          this.phaseT = 0;
          this.timeScale = 1;
          Sound.play('win');
          this.fx.confetti(GAME_W / 2, 140, 90);
        }
        break;
      case 'over':
        this.timeScale = 1;
        if (this.phaseT > 0.8) {
          if (Input.wasPressed(['Enter', 'KeyF', 'Space'])) { Sound.play('select'); this.startMatch(); return; }
          if (Input.wasPressed('Escape')) { this.quitToMenu(); return; }
        }
        break;
    }

    this.updateWorld(rawDt);
  }

  quitToMenu() {
    Sound.play('click');
    this.screen = SCREEN.MENU;
    this.startDemo();
  }

  updateWorld(rawDt) {
    const dt = Math.min(rawDt, 1 / 30) * this.timeScale;

    this.level.update(dt);

    /* crates */
    if (this.phase === 'play' || this.demo) {
      this.crateTimer -= dt;
      if (this.crateTimer <= 0 && this.crates.length < 3) {
        this.crateTimer = rand(5.5, 9);
        const plat = pick(this.level.platforms);
        const x = clamp(plat.x + rand(30, plat.w - 30), 40, GAME_W - 40);
        this.crates.push(new Crate(x, Crate.randomContent()));
      }
    }
    for (const c of this.crates) c.update(dt, this);
    this.crates = this.crates.filter(c => !c.dead);

    /* players */
    for (const p of this.players) {
      if (p.eliminated && p.dead) continue;
      p.update(dt, this);
    }

    /* crate pickup */
    for (const c of this.crates) {
      if (c.dead) continue;
      for (const p of this.players) {
        if (p.dead || p.eliminated || p.parachute) continue;
        if (rectsOverlap(p.x - p.w / 2, p.y - p.h, p.w, p.h,
                         c.x - c.size / 2, c.y - c.size / 2, c.size, c.size)) {
          p.pickupCrate(c, this);
          c.dead = true;
          break;
        }
      }
    }
    this.crates = this.crates.filter(c => !c.dead);

    /* bullets */
    for (const b of this.bullets) {
      b.update(dt, this);
      if (b.dead) continue;
      for (const p of this.players) {
        if (p === b.owner || p.dead || p.eliminated) continue;
        const rx = p.x - p.w / 2 - b.r, ry = p.y - p.h - b.r;
        const rw = p.w + b.r * 2, rh = p.h + b.r * 2;
        const t = segVsRect(b.prevX, b.prevY, b.x, b.y, rx, ry, rw, rh);
        if (t >= 0) {
          if (b.explosive) {
            this.explode(b.x, b.y, b.explosive.radius, b.explosive.impulse, b.owner);
          } else {
            const dir = sign(b.vx);
            const hit = p.applyKnockback(dir * b.kb, -b.kb * 0.22, b.owner);
            if (hit) {
              this.fx.hitSparks(b.x, b.y, dir, b.isFlame ? '#ff9e40' : '#fff');
              if (!b.isFlame) Sound.play('hit', { vol: 0.6 });
            } else {
              this.fx.sparks(b.x, b.y, 4, '#4cc9f0', 260, 0.25);
            }
          }
          b.dead = true;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    /* grenades */
    for (const g of this.grenades) g.update(dt, this);
    this.grenades = this.grenades.filter(g => !g.dead);

    this.fx.update(dt);

    this.shakeTrauma = Math.max(0, this.shakeTrauma - rawDt * 1.6);
    this.flashAlpha = Math.max(0, this.flashAlpha - rawDt * 0.9);

    // demo never ends — top up lives
    if (this.demo) {
      for (const p of this.players) {
        if (p.lives < 50) p.lives = 99;
        p.eliminated = false;
      }
    }
  }

  /* ---------------- draw ---------------- */

  draw(ctx) {
    const shake = this.shakeTrauma * this.shakeTrauma * 22;
    const sx = rand(-1, 1) * shake;
    const sy = rand(-1, 1) * shake;

    this.level.drawBackground(ctx);

    ctx.save();
    ctx.translate(sx, sy);

    this.level.drawPlatforms(ctx);
    for (const c of this.crates) c.draw(ctx, this.t);
    for (const p of this.players) p.drawShadow(ctx, this);
    for (const p of this.players) p.draw(ctx, this.t);
    for (const g of this.grenades) g.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    this.fx.draw(ctx);

    // offscreen-above indicators
    for (const p of this.players) {
      if (p.dead || p.eliminated) continue;
      if (p.y < -30) {
        const ix = clamp(p.x, 36, GAME_W - 36);
        ctx.save();
        ctx.translate(ix, 30);
        ctx.fillStyle = p.style.main;
        ctx.strokeStyle = '#221d2b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(11, -2); ctx.lineTo(-11, -2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 12, 12, 0, TAU);
        ctx.fill(); ctx.stroke();
        drawText(ctx, Math.round(-p.y / 10) + 'm', 0, 36, { size: 13, color: '#fff', stroke: '#221d2b', strokeWidth: 3 });
        ctx.restore();
      }
    }
    ctx.restore();

    this.level.drawVignette(ctx);

    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = '#fff4d6';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }

    if (this.screen === SCREEN.MENU) { this.dimWorld(ctx, 0.55); this.menu.draw(ctx); return; }
    if (this.screen === SCREEN.CONTROLS) { this.dimWorld(ctx, 0.66); this.menu.drawControls(ctx); return; }

    this.drawHUD(ctx);

    if (this.phase === 'intro') this.drawIntro(ctx);
    if (this.phase === 'over') this.drawVictory(ctx);
    if (this.paused) this.drawPause(ctx);
  }

  dimWorld(ctx, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#120e1d';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();
  }

  /* ---------------- HUD ---------------- */

  drawHUD(ctx) {
    const n = this.players.length;
    const panelW = 250, panelH = 76;
    const positions = [
      { x: 14, y: 12 },
      { x: GAME_W - panelW - 14, y: 12 },
      { x: 14 + panelW + 18, y: 12 },
      { x: GAME_W - panelW * 2 - 32, y: 12 }
    ];
    for (let i = 0; i < n; i++) {
      this.drawPlayerPanel(ctx, this.players[i], positions[i].x, positions[i].y, panelW, panelH);
    }
  }

  drawPlayerPanel(ctx, p, x, y, w, h) {
    const S = p.style;
    ctx.save();
    if (p.eliminated) ctx.globalAlpha = 0.45;
    // panel
    ctx.fillStyle = 'rgba(18,14,29,0.72)';
    ctx.strokeStyle = rgba(S.main, 0.9);
    ctx.lineWidth = 2.5;
    rr(ctx, x, y, w, h, 14);
    ctx.fill(); ctx.stroke();

    // portrait
    const px = x + 34, py = y + h / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, 24, 0, TAU); ctx.clip();
    ctx.fillStyle = shade(S.main, 0.45);
    ctx.fillRect(px - 26, py - 26, 52, 52);
    // mini face
    ctx.fillStyle = S.skin;
    ctx.beginPath(); ctx.arc(px, py + 4, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = S.main;
    ctx.beginPath(); ctx.arc(px, py - 4, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(px - 5, py + 3, 3, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + 5, py + 3, 3, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#221d2b';
    ctx.beginPath(); ctx.arc(px - 4, py + 4, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 6, py + 4, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = S.main;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px, py, 24, 0, TAU); ctx.stroke();

    // name
    drawText(ctx, p.name, x + 70, y + 16, { size: 15, color: '#fff', align: 'left', weight: '900' });

    // lives (small heads)
    const maxIcons = Math.min(p.lives, 8);
    for (let i = 0; i < maxIcons; i++) {
      const lx = x + 70 + i * 17, ly = y + 36;
      ctx.fillStyle = S.main;
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(lx, ly, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (p.lives > 8) drawText(ctx, '+' + (p.lives - 8), x + 70 + 8 * 17, y + 36, { size: 12, color: '#fff', align: 'left' });
    if (p.eliminated) drawText(ctx, 'OUT', x + 70, y + 36, { size: 16, color: '#ff5d73', align: 'left', weight: '900' });

    // weapon icon + ammo
    const w2 = WEAPONS[p.weapon];
    ctx.save();
    ctx.translate(x + 86, y + 58);
    ctx.scale(0.75, 0.75);
    drawGun(ctx, p.weapon);
    ctx.restore();
    // ammo bar
    const barX = x + 130, barY = y + 52, barW = w - 145, barH = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(ctx, barX, barY, barW, barH, 5); ctx.fill();
    const frac = p.ammo === Infinity ? 1 : clamp(p.ammo / w2.ammo, 0, 1);
    const infinite = p.ammo === Infinity || p.boosts.infinite > 0;
    ctx.fillStyle = infinite ? '#b388eb' : (frac > 0.3 ? '#ffd166' : '#ff5d73');
    if (frac > 0) { rr(ctx, barX, barY, Math.max(barW * frac, barH), barH, 5); ctx.fill(); }
    drawText(ctx, infinite ? '∞' : String(p.ammo), barX + barW + 2, barY + 5, { size: 13, color: '#fff', align: 'left' });

    // grenades
    for (let i = 0; i < Math.min(p.grenades, 6); i++) {
      const gx = x + 134 + i * 14, gy = y + 30;
      ctx.fillStyle = '#90be6d';
      ctx.strokeStyle = '#221d2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gx, gy, 5, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // active powerup chips
    let chipX = x + w - 12;
    for (const k in p.boosts) {
      if (p.boosts[k] > 0) {
        const info = POWERUPS[k];
        chipX -= 20;
        ctx.fillStyle = info.color;
        ctx.strokeStyle = '#221d2b';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(chipX, y + 16, 8, 0, TAU); ctx.fill(); ctx.stroke();
        // radial timer
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.moveTo(chipX, y + 16);
        ctx.arc(chipX, y + 16, 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.boosts[k] / POWERUPS[k].dur));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------------- overlays ---------------- */

  drawIntro(ctx) {
    const t = this.phaseT;
    this.dimWorld(ctx, clamp(0.5 - t * 0.16, 0, 0.5));
    // map name plate
    if (t < 1.1) {
      const a = clamp(t * 4, 0, 1) * clamp((1.1 - t) * 4, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      drawText(ctx, this.level.name, GAME_W / 2, 180, {
        size: 46, color: '#ffd166', stroke: '#221d2b', strokeWidth: 8, font: FONT_TITLE, weight: '400'
      });
      ctx.restore();
    }
    const count = 3 - Math.floor(t);
    if (count >= 1 && count <= 3) {
      const ft = t % 1;
      const scale = easeOutBack(Math.min(1, ft * 2.4));
      ctx.save();
      ctx.translate(GAME_W / 2, GAME_H / 2 - 30);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(2 - ft * 2.2, 0, 1);
      drawText(ctx, String(count), 0, 0, {
        size: 150, color: '#fff', stroke: '#221d2b', strokeWidth: 14, font: FONT_TITLE, weight: '400'
      });
      ctx.restore();
    }
  }

  drawVictory(ctx) {
    const t = this.phaseT;
    this.dimWorld(ctx, clamp(t * 1.4, 0, 0.62));
    const a = clamp(t * 2.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;

    const winner = this.winner;
    const title = winner ? winner.name + ' WINS!' : 'DRAW!';
    const color = winner ? winner.style.main : '#fff';

    const pop = easeOutBack(clamp(t * 1.6, 0, 1));
    ctx.save();
    ctx.translate(GAME_W / 2, 200);
    ctx.scale(pop, pop);
    drawText(ctx, title, 0, 0, {
      size: 84, color: '#fff', stroke: '#221d2b', strokeWidth: 14, font: FONT_TITLE, weight: '400',
      shadow: rgba(color, 0.65), shadowY: 8
    });
    ctx.restore();

    // stats panel
    if (t > 0.5) {
      const pa = clamp((t - 0.5) * 3, 0, 1);
      ctx.globalAlpha = a * pa;
      const pw = 480, ph = 64 + this.players.length * 34;
      const px = GAME_W / 2 - pw / 2, py = 280;
      ctx.fillStyle = 'rgba(18,14,29,0.85)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      rr(ctx, px, py, pw, ph, 16);
      ctx.fill(); ctx.stroke();
      drawText(ctx, 'FIGHTER', px + 40, py + 34, { size: 16, color: '#9d96ad', align: 'left', weight: '900' });
      drawText(ctx, 'KNOCKOUTS', px + pw - 200, py + 34, { size: 16, color: '#9d96ad', weight: '900' });
      drawText(ctx, 'FALLS', px + pw - 70, py + 34, { size: 16, color: '#9d96ad', weight: '900' });
      const ranked = [...this.players].sort((x2, y2) => y2.kills - x2.kills);
      ranked.forEach((p, i) => {
        const ry = py + 66 + i * 34;
        ctx.fillStyle = p.style.main;
        ctx.strokeStyle = '#221d2b';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px + 46, ry - 5, 11, 0, TAU); ctx.fill(); ctx.stroke();
        drawText(ctx, p.name + (p === winner ? '  ★' : ''), px + 68, ry - 4, { size: 18, color: p === winner ? '#ffd166' : '#fff', align: 'left', weight: '900' });
        drawText(ctx, String(p.kills), px + pw - 200, ry - 4, { size: 18, color: '#fff', weight: '900' });
        drawText(ctx, String(p.falls), px + pw - 70, ry - 4, { size: 18, color: '#fff', weight: '900' });
      });
    }

    if (t > 0.8) {
      const blink = 0.6 + 0.4 * Math.sin(this.t * 4);
      ctx.globalAlpha = a * blink;
      drawText(ctx, 'ENTER — REMATCH      ESC — MENU', GAME_W / 2, GAME_H - 70, {
        size: 22, color: '#fff', stroke: '#221d2b', strokeWidth: 5, weight: '900'
      });
    }
    ctx.restore();

    if (chance(0.06)) this.fx.confetti(rand(200, GAME_W - 200), -10, 4);
  }

  drawPause(ctx) {
    this.dimWorld(ctx, 0.6);
    drawText(ctx, 'PAUSED', GAME_W / 2, GAME_H / 2 - 40, {
      size: 80, color: '#fff', stroke: '#221d2b', strokeWidth: 12, font: FONT_TITLE, weight: '400'
    });
    drawText(ctx, 'P / ESC — RESUME      Q — QUIT TO MENU', GAME_W / 2, GAME_H / 2 + 40, {
      size: 20, color: '#cfc9dd', stroke: '#221d2b', strokeWidth: 4, weight: '900'
    });
  }
}

/* ============================================================
   Menu
   ============================================================ */
class Menu {
  constructor(game) {
    this.game = game;
    this.sel = 0;
    this.items = [
      { id: 'play', label: () => 'START GAME' },
      {
        id: 'mode', label: () => 'MODE:  ' + (game.options.mode === '1p' ? '1 PLAYER VS CPU' : '2 PLAYERS'),
        cycle: d => { game.options.mode = game.options.mode === '1p' ? '2p' : '1p'; }
      },
      {
        id: 'map', label: () => 'MAP:  ' + LEVELS[game.options.mapIndex].name,
        cycle: d => { game.options.mapIndex = (game.options.mapIndex + d + LEVELS.length) % LEVELS.length; }
      },
      {
        id: 'lives', label: () => 'LIVES:  ' + game.options.lives,
        cycle: d => {
          const opts = [3, 5, 8, 12];
          let i = opts.indexOf(game.options.lives);
          i = (i + d + opts.length) % opts.length;
          game.options.lives = opts[i];
        }
      },
      {
        id: 'diff', label: () => 'CPU SKILL:  ' + game.options.difficulty.toUpperCase(),
        cycle: d => {
          const opts = ['easy', 'normal', 'hard'];
          let i = opts.indexOf(game.options.difficulty);
          i = (i + d + opts.length) % opts.length;
          game.options.difficulty = opts[i];
        }
      },
      {
        id: 'bots', label: () => 'EXTRA BOTS:  ' + game.options.extraBots,
        cycle: d => { game.options.extraBots = (game.options.extraBots + d + 3) % 3; }
      },
      { id: 'controls', label: () => 'CONTROLS' }
    ];
    this.itemBounds = [];
  }

  activate(item) {
    const g = this.game;
    if (item.id === 'play') { Sound.play('select'); Music.start(); g.startMatch(); }
    else if (item.id === 'controls') { Sound.play('click'); g.screen = SCREEN.CONTROLS; }
    else if (item.cycle) { Sound.play('click'); item.cycle(1); }
  }

  update(dt) {
    const g = this.game;
    if (g.screen === SCREEN.CONTROLS) {
      if (Input.wasPressed(['Escape', 'Enter', 'KeyF', 'Space']) || Input.mouse.clicked) {
        Sound.play('click');
        g.screen = SCREEN.MENU;
      }
      return;
    }
    if (Input.wasPressed(['ArrowUp', 'KeyW'])) { this.sel = (this.sel + this.items.length - 1) % this.items.length; Sound.play('click', { vol: 0.6 }); }
    if (Input.wasPressed(['ArrowDown', 'KeyS'])) { this.sel = (this.sel + 1) % this.items.length; Sound.play('click', { vol: 0.6 }); }
    const item = this.items[this.sel];
    if (Input.wasPressed(['ArrowLeft', 'KeyA']) && item.cycle) { item.cycle(-1); Sound.play('click'); }
    if (Input.wasPressed(['ArrowRight', 'KeyD']) && item.cycle) { item.cycle(1); Sound.play('click'); }
    if (Input.wasPressed(['Enter', 'Space', 'KeyF'])) this.activate(item);

    // mouse
    if (Input.mouse.moved) {
      for (let i = 0; i < this.itemBounds.length; i++) {
        const b = this.itemBounds[i];
        if (b && Input.mouse.x > b.x && Input.mouse.x < b.x + b.w && Input.mouse.y > b.y && Input.mouse.y < b.y + b.h) {
          if (this.sel !== i) { this.sel = i; Sound.play('click', { vol: 0.5 }); }
        }
      }
    }
    if (Input.mouse.clicked) {
      for (let i = 0; i < this.itemBounds.length; i++) {
        const b = this.itemBounds[i];
        if (b && Input.mouse.x > b.x && Input.mouse.x < b.x + b.w && Input.mouse.y > b.y && Input.mouse.y < b.y + b.h) {
          this.sel = i;
          this.activate(this.items[i]);
        }
      }
    }
  }

  draw(ctx) {
    const g = this.game;
    const t = g.t;

    /* logo */
    ctx.save();
    const bounce = Math.sin(t * 1.6) * 6;
    ctx.translate(GAME_W / 2, 150 + bounce);
    ctx.rotate(Math.sin(t * 0.8) * 0.015);
    drawText(ctx, 'RECOIL', 0, -38, {
      size: 110, color: '#ffd166', stroke: '#221d2b', strokeWidth: 16, font: FONT_TITLE, weight: '400',
      shadow: 'rgba(0,0,0,0.5)', shadowY: 10
    });
    drawText(ctx, 'RUMBLE', 0, 58, {
      size: 110, color: '#ff5d73', stroke: '#221d2b', strokeWidth: 16, font: FONT_TITLE, weight: '400',
      shadow: 'rgba(0,0,0,0.5)', shadowY: 10
    });
    // crossing tracer lines behind the logo
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-330, 80); ctx.lineTo(330, -90);
    ctx.stroke();
    ctx.strokeStyle = '#4cc9f0';
    ctx.beginPath();
    ctx.moveTo(330, 84); ctx.lineTo(-330, -86);
    ctx.stroke();
    ctx.restore();

    drawText(ctx, 'A 2-PLAYER KNOCKOUT ARENA SHOOTER', GAME_W / 2, 268, {
      size: 17, color: '#b9b2c9', weight: '900'
    });

    /* menu items */
    this.itemBounds = [];
    const startY = 330, lineH = 47;
    this.items.forEach((item, i) => {
      const y = startY + i * lineH;
      const selected = i === this.sel;
      const label = item.label();
      const size = item.id === 'play' ? 34 : 23;
      const w = label.length * size * 0.62 + 60;
      this.itemBounds[i] = { x: GAME_W / 2 - w / 2, y: y - lineH / 2, w, h: lineH };
      if (selected) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = 'rgba(255,209,102,0.12)';
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        rr(ctx, GAME_W / 2 - w / 2, y - lineH / 2 + 4, w, lineH - 8, 12);
        ctx.fill(); ctx.stroke();
        // arrows
        const wob = Math.sin(t * 6) * 4;
        drawText(ctx, '▶', GAME_W / 2 - w / 2 - 22 - wob, y, { size: 18, color: '#ffd166' });
        drawText(ctx, '◀', GAME_W / 2 + w / 2 + 22 + wob, y, { size: 18, color: '#ffd166' });
        ctx.restore();
      }
      drawText(ctx, label, GAME_W / 2, y, {
        size, color: selected ? '#fff' : '#a79fbd',
        stroke: selected ? '#221d2b' : 'rgba(20,15,30,0.6)',
        strokeWidth: size * 0.16, font: FONT_TITLE, weight: '400'
      });
    });

    drawText(ctx, 'M — MUTE        ' + (Sound.muted ? '🔇 MUTED' : ''), GAME_W / 2, GAME_H - 28, {
      size: 15, color: '#8d86a0', weight: '900'
    });
  }

  drawControls(ctx) {
    const cx = GAME_W / 2;
    drawText(ctx, 'CONTROLS', cx, 110, {
      size: 64, color: '#ffd166', stroke: '#221d2b', strokeWidth: 10, font: FONT_TITLE, weight: '400'
    });

    const panel = (x, title, color, rows) => {
      const pw = 400, ph = 300;
      ctx.fillStyle = 'rgba(18,14,29,0.85)';
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineWidth = 3;
      rr(ctx, x - pw / 2, 180, pw, ph, 18);
      ctx.fill(); ctx.stroke();
      drawText(ctx, title, x, 222, { size: 28, color, font: FONT_TITLE, weight: '400' });
      rows.forEach((r, i) => {
        const y = 270 + i * 46;
        drawText(ctx, r[0], x - pw / 2 + 30, y, { size: 18, color: '#b9b2c9', align: 'left', weight: '900' });
        // key cap
        const keyW = Math.max(60, r[1].length * 13 + 24);
        ctx.fillStyle = '#2a2438';
        ctx.strokeStyle = '#4d4663';
        ctx.lineWidth = 2;
        rr(ctx, x + pw / 2 - 30 - keyW, y - 16, keyW, 32, 8);
        ctx.fill(); ctx.stroke();
        drawText(ctx, r[1], x + pw / 2 - 30 - keyW / 2, y, { size: 16, color: '#fff', weight: '900' });
      });
    };

    panel(cx - 230, 'PLAYER 1', '#3b82f6', [
      ['Move + Jump', 'W A S D'],
      ['Double Jump', 'W  ×2'],
      ['Shoot', 'F'],
      ['Grenade', 'G']
    ]);
    panel(cx + 230, 'PLAYER 2', '#ef4444', [
      ['Move + Jump', 'ARROWS'],
      ['Double Jump', '↑  ×2'],
      ['Shoot', 'L  or  .'],
      ['Grenade', 'K  or  ,']
    ]);

    drawText(ctx, 'Knock enemies off the islands — bullets push, they don’t hurt!  Grab crates for weapons & powerups.',
      cx, 530, { size: 17, color: '#cfc9dd', weight: '900' });
    drawText(ctx, 'P — PAUSE      M — MUTE      ESC — BACK', cx, 575, { size: 15, color: '#8d86a0', weight: '900' });

    const blink = 0.6 + 0.4 * Math.sin(this.game.t * 4);
    ctx.save();
    ctx.globalAlpha = blink;
    drawText(ctx, 'PRESS ANY KEY TO GO BACK', cx, GAME_H - 60, { size: 20, color: '#ffd166', weight: '900' });
    ctx.restore();
  }
}
