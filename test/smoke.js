'use strict';
/* ============================================================
   Headless smoke test.
   Stubs window/document/canvas, loads every game script in the
   same order as index.html, then drives hundreds of simulated
   frames through menus, combat, every weapon, crates, KOs,
   victory, rematch and all three maps. Any uncaught exception
   fails the run.

   Usage: node test/smoke.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'js/utils.js', 'js/audio.js', 'js/input.js', 'js/particles.js',
  'js/level.js', 'js/weapons.js', 'js/player.js', 'js/ai.js',
  'js/game.js', 'js/main.js'
];

/* ---------- canvas / DOM stubs ---------- */
function makeCtx() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in t) return t[prop];
      return () => undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; }
  });
}
function makeCanvas() {
  return {
    width: 0, height: 0, style: {},
    getContext: () => makeCtx(),
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  };
}

const clock = { t: 0 };
const sandbox = {
  console,
  Math, JSON, Object, Array,
  window: {
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720
  },
  document: {
    getElementById: () => makeCanvas(),
    createElement: () => makeCanvas()
  },
  performance: { now: () => clock.t },
  setInterval: () => 0,
  clearInterval: () => {},
  __rafQ: [],
  requestAnimationFrame: cb => sandbox.__rafQ.push(cb)
};
sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
sandbox.globalThis = sandbox;

const code = FILES.map(f =>
  fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
).join('\n;\n');

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'bundle.js' });

/* ---------- driver helpers (run inside the sandbox context) ---------- */
const drive = `
  var __game = window.__game;
  function __step(n) {
    for (let i = 0; i < n; i++) {
      __clockTick(16.7);
      const cbs = __rafQ.splice(0);
      for (const cb of cbs) cb(performance.now());
      if (!__rafQ.length) throw new Error('frame loop stopped re-registering');
    }
  }
  function __press(code) { Input.pressed[code] = true; Input.down[code] = true; }
  function __tap(code) { Input.pressed[code] = true; }
  function __release(code) { Input.down[code] = false; }
  function __assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }
`;
sandbox.__clockTick = ms => { clock.t += ms; };
vm.runInContext(drive, sandbox);

function run(snippet, label) {
  try {
    vm.runInContext(snippet, sandbox, { filename: label });
    console.log('PASS  ' + label);
  } catch (e) {
    console.error('FAIL  ' + label);
    console.error(e.stack || e);
    process.exitCode = 1;
    throw e;
  }
}

/* ---------- scenarios ---------- */

run(`__step(60);`, 'menu + attract-mode demo runs 1s');

run(`
  // navigate the menu a bit, then start a 1P match with 2 extra bots
  __tap('ArrowDown'); __step(2);
  __tap('ArrowRight'); __step(2);
  __tap('ArrowUp'); __step(2);
  __game.options.mode = '1p';
  __game.options.extraBots = 2;
  __game.options.lives = 3;
  __game.options.mapIndex = 0;
  __game.menu.sel = 0;
  __tap('Enter'); __step(2);
  __assert(__game.screen === 'game', 'screen should be game, got ' + __game.screen);
  __assert(__game.players.length === 4, 'expected 4 players, got ' + __game.players.length);
  __assert(__game.phase === 'intro', 'phase should be intro');
`, 'start 1P match with bots');

run(`
  __step(200);
  __assert(__game.phase === 'play', 'phase should be play after countdown, got ' + __game.phase);
`, 'countdown completes');

run(`
  // P1 runs right, jumps, double jumps, shoots, throws a grenade
  __press('KeyD'); __press('KeyF');
  __step(30);
  __tap('KeyW'); __step(10); __tap('KeyW'); __step(30);
  __tap('KeyG'); __step(60);
  __release('KeyD'); __release('KeyF');
  __step(120);
  __assert(!__game.players[0].dead || __game.players[0].respawnT > 0, 'p1 state sane');
`, 'P1 movement, jumping, shooting, grenade');

run(`
  // fire every weapon from P1
  const ids = Object.keys(WEAPONS);
  for (const id of ids) {
    __game.players[0].switchTo(id);
    __press('KeyF');
    __step(50);
    __release('KeyF');
    __step(10);
  }
`, 'every weapon fires without errors');

run(`
  // force-grant every powerup via crates dropped onto P1
  const p1 = __game.players[0];
  const pin = () => {
    p1.dead = false; p1.eliminated = false; p1.parachute = false;
    p1.invuln = 0; p1.x = 640; p1.y = 560; p1.vx = 0; p1.vy = 0;
  };
  for (const id of Object.keys(POWERUPS)) {
    pin();
    const c = new Crate(p1.x, { kind: 'powerup', id });
    c.landed = true; c.x = p1.x; c.y = p1.y - 20;
    __game.crates.push(c);
    __step(3);
  }
  pin();
  const c2 = new Crate(p1.x, { kind: 'weapon', id: 'rocket' });
  c2.landed = true; c2.x = p1.x; c2.y = p1.y - 20;
  __game.crates.push(c2);
  __step(2);
  __assert(p1.weapon === 'rocket', 'weapon pickup applied, got ' + p1.weapon);
  __step(120);
`, 'crate pickups: all powerups + weapon');

run(`
  // natural crate spawning over ~20s of play
  __step(1200);
`, 'long AI free-for-all with natural crates');

run(`
  // fresh match, then force KOs until it ends with P1 the winner
  __game.startMatch();
  __step(200); // countdown
  __assert(__game.phase === 'play', 'fresh match playing');
  let guard = 200;
  while (__game.phase !== 'over' && guard-- > 0) {
    for (let i = 1; i < __game.players.length; i++) {
      const p = __game.players[i];
      if (!p.dead && !p.eliminated) { p.x = -500; p.y = 300; }
    }
    __step(12);
  }
  __step(120);
  __assert(__game.phase === 'over', 'match should be over, got ' + __game.phase);
  __assert(__game.winner === __game.players[0], 'P1 should win');
`, 'KOs, slow-mo, victory screen');

run(`
  __tap('Enter'); __step(5);
  __assert(__game.phase === 'intro', 'rematch should restart at intro, got ' + __game.phase);
  __step(30);
  __tap('Escape'); __step(2); // pause is not active in intro; escape ignored there
  __step(200);
  __assert(__game.phase === 'play', 'playing after rematch countdown');
  __tap('KeyP'); __step(2);
  __assert(__game.paused, 'game should pause');
  __tap('KeyQ'); __step(2);
  __assert(__game.screen === 'menu', 'quit to menu');
`, 'rematch, pause, quit to menu');

run(`
  // 2P mode on every map, including the moving-platform frost map
  for (let m = 0; m < LEVELS.length; m++) {
    __game.options.mode = '2p';
    __game.options.extraBots = 1;
    __game.options.mapIndex = m;
    __game.startMatch();
    __step(200); // countdown
    __press('KeyD'); __press('KeyF');
    __press('ArrowLeft'); __press('KeyL');
    __step(240);
    __tap('ArrowUp'); __tap('KeyW'); __step(20);
    __tap('KeyK'); __tap('KeyG'); __step(120);
    __release('KeyD'); __release('KeyF');
    __release('ArrowLeft'); __release('KeyL');
    __step(60);
    __assert(__game.players.length === 3, '2p+1bot = 3 players');
  }
  __game.quitToMenu();
  __step(30);
`, '2P versus on all three maps');

run(`
  // controls screen open/close
  __game.menu.sel = __game.menu.items.length - 1;
  __tap('Enter'); __step(2);
  __assert(__game.screen === 'controls', 'controls screen open');
  __tap('Escape'); __step(2);
  __assert(__game.screen === 'menu', 'controls screen closed');
  __step(60);
`, 'controls screen');

run(`
  // mute toggle + long idle on menu demo
  __tap('KeyM'); __step(300);
`, 'mute + extended demo soak');

console.log('\\nAll smoke scenarios passed.');
