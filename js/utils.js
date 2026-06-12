'use strict';
/* ============================================================
   RECOIL RUMBLE — utils.js
   Math helpers, color helpers, canvas shape helpers.
   ============================================================ */

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function chance(p) { return Math.random() < p; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sign(v) { return v < 0 ? -1 : 1; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }

/* Easing */
function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { t = clamp(t, 0, 1); return t * t * t; }
function easeOutBack(t) {
  t = clamp(t, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutElastic(t) {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
}

/* Deterministic RNG for cached background generation */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Color helpers ---------- */
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
/* shade('#3b82f6', 1.2) brightens, 0.8 darkens */
function shade(hex, f) {
  const { r, g, b } = hexToRgb(hex);
  const adj = v => clamp(Math.round(v * f), 0, 255);
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mixHex(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return `rgb(${Math.round(lerp(a.r, b.r, t))},${Math.round(lerp(a.g, b.g, t))},${Math.round(lerp(a.b, b.b, t))})`;
}

/* ---------- Canvas helpers ---------- */
/* Rounded-rect path (does not fill/stroke) */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Text with outline, used heavily by UI. */
function drawText(ctx, text, x, y, opts = {}) {
  const size = opts.size || 24;
  const weight = opts.weight || '800';
  const family = opts.font || 'Nunito, "Trebuchet MS", sans-serif';
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.shadow) {
    ctx.fillStyle = opts.shadow;
    ctx.fillText(text, x + (opts.shadowX !== undefined ? opts.shadowX : 0), y + (opts.shadowY !== undefined ? opts.shadowY : 3));
  }
  if (opts.stroke) {
    ctx.lineWidth = opts.strokeWidth || Math.max(3, size * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = opts.color || '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* Display font used for big titles */
const FONT_TITLE = '"Luckiest Guy", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
const FONT_UI = '"Nunito", "Trebuchet MS", sans-serif';

/* Segment vs AABB intersection (for fast bullets vs platforms / players).
   Returns t in [0,1] of first hit or -1. */
function segVsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const dx = x2 - x1, dy = y2 - y1;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rx || x1 > rx + rw) return -1;
  } else {
    let t1 = (rx - x1) / dx, t2 = (rx + rw - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < ry || y1 > ry + rh) return -1;
  } else {
    let t1 = (ry - y1) / dy, t2 = (ry + rh - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
